import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WAMessage,
} from "@whiskeysockets/baileys";
import nodemailer from "nodemailer";
import * as QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { LaravelChannelsClient } from "./laravel-channels.client";
import { parseInboundWhatsAppJid, resolveWhatsAppRecipientJid } from "./baileys-address";
import { AgentRuntimeService } from "../agents/agent-runtime.service";
import { WhatsAppVoiceService, getVoiceAudio, checkVoiceAudio, voiceErrorMessage, VoiceError } from "./whatsapp-voice.service";
import type {
  Channel,
  ChannelMessage,
  ChannelProvider,
  ChannelProviderView,
  ChannelRuntimeStatus,
} from "./channel.types";

type RuntimeConnection = {
  status: ChannelRuntimeStatus;
  socket?: ReturnType<typeof makeWASocket>;
  qrDataUrl?: string;
  phoneNumber?: string;
  displayName?: string;
  lastError?: string;
  manualClose?: boolean;
};

@Injectable()
export class ChannelsRuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChannelsRuntimeService.name);
  private readonly runtime = new Map<string, RuntimeConnection>();
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly inboundQueues = new Map<string, Promise<void>>();
  private readonly voiceSeen = new Map<string, number>();
  private readonly voiceWindows = new Map<string, { started: number; count: number }>();
  private readonly sessionsPath: string;

  constructor(
    private readonly client: LaravelChannelsClient,
    private readonly agents: AgentRuntimeService,
    private readonly voice: WhatsAppVoiceService,
    config: ConfigService,
  ) {
    this.sessionsPath = resolve(
      process.cwd(),
      config.get<string>("BAILEYS_SESSIONS_PATH", "data/baileys"),
    );
  }

  async onModuleInit(): Promise<void> {
    await fs.mkdir(this.sessionsPath, { recursive: true });

    const providers = await this.client.providers().catch((error) => {
      this.logger.warn("No fue posible cargar canales: " + String(error));
      return [];
    });

    for (const provider of providers) {
      if (provider.enabled && provider.auto_connect && provider.driver === "baileys") {
        void this.connect(provider.id).catch((error) => {
          this.logger.warn(`AutoConnect ${provider.id}: ${String(error)}`);
        });
      }
    }
  }

  async list(): Promise<ChannelProviderView[]> {
    const providers = await this.client.providers();

    for (const provider of providers) {
      if (!provider.enabled && this.runtime.has(provider.id)) {
        await this.disconnect(provider.id, false).catch(() => undefined);
        continue;
      }

      if (
        provider.enabled &&
        provider.auto_connect &&
        provider.driver === "baileys" &&
        !this.runtime.has(provider.id)
      ) {
        void this.connect(provider.id).catch(() => undefined);
      }
    }

    const ids = new Set(providers.map((provider) => provider.id));
    for (const id of [...this.runtime.keys()]) {
      if (!ids.has(id)) {
        const current = this.runtime.get(id);
        if (current?.socket) {
          current.manualClose = true;
          current.socket.end(undefined);
        }
        this.runtime.delete(id);
        await fs.rm(resolve(this.sessionsPath, id), { recursive: true, force: true }).catch(() => undefined);
      }
    }

    return Promise.all(providers.map((provider) => this.view(provider)));
  }

  async connect(id: string): Promise<ChannelProviderView> {
    const provider = await this.requireProvider(id);
    if (!provider.enabled) throw new ConflictException("El proveedor está deshabilitado.");

    if (provider.driver === "smtp") {
      await this.verifySmtp(provider);
      this.runtime.set(id, { status: "ready" });
      return this.view(provider);
    }

    if (provider.driver === "whatsapp_link") {
      this.runtime.set(id, { status: "ready" });
      return this.view(provider);
    }

    if (provider.driver !== "baileys") {
      throw new BadRequestException("Driver no soportado.");
    }

    const current = this.runtime.get(id);
    if (current?.socket && ["connecting", "qr_pending", "connected"].includes(current.status)) {
      return this.view(provider);
    }

    this.runtime.set(id, { status: "connecting", manualClose: false });

    const { state, saveCreds } = await useMultiFileAuthState(resolve(this.sessionsPath, id));
    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    this.runtime.set(id, { status: "connecting", socket, manualClose: false });
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;

      for (const message of messages) {
        this.enqueueIncomingMessage(provider, message);
      }
    });

    socket.ev.on("connection.update", async (update) => {
      const latest = await this.findProvider(id);
      if (!latest) return;

      // Ignore delayed events from sockets already replaced or manually closed.
      const active = this.runtime.get(id);
      if (!active || active.socket !== socket || active.manualClose) return;

      if (update.qr) {
        const qrDataUrl = await QRCode.toDataURL(update.qr, { width: 320, margin: 2 });
        this.runtime.set(id, {
          ...active,
          socket,
          status: "qr_pending",
          qrDataUrl,
          lastError: undefined,
        });
      }

      if (update.connection === "open") {
        const phoneNumber = socket.user?.id
          ? socket.user.id.split(":")[0].split("@")[0]
          : undefined;

        this.runtime.set(id, {
          ...active,
          socket,
          status: "connected",
          qrDataUrl: undefined,
          phoneNumber,
          displayName: socket.user?.name,
          lastError: undefined,
          manualClose: false,
        });
      }

      if (update.connection === "close") {
        const statusCode = (update.lastDisconnect?.error as {output?: {statusCode?: number}} | undefined)
          ?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const manualClose = this.runtime.get(id)?.manualClose === true;

        this.runtime.delete(id);

        if (loggedOut) {
          this.runtime.set(id, {
            status: "error",
            lastError: "WhatsApp cerró la sesión. Escanea nuevamente el QR.",
          });
          await fs.rm(resolve(this.sessionsPath, id), { recursive: true, force: true });
        } else if (!manualClose && latest.auto_connect && latest.enabled) {
          this.scheduleReconnect(id);
        }
      }
    });

    return this.view(provider);
  }

  async disconnect(id: string, logout = false): Promise<ChannelProviderView> {
    const provider = await this.requireProvider(id);
    const timer = this.reconnectTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(id);
    }

    const current = this.runtime.get(id);
    if (current?.socket) {
      current.manualClose = true;
      if (logout) {
        try {
          await current.socket.logout();
        } catch {
          current.socket.end(undefined);
        }
      } else {
        current.socket.end(undefined);
      }
    }

    this.runtime.delete(id);
    if (logout) {
      await fs.rm(resolve(this.sessionsPath, id), { recursive: true, force: true });
    }

    return this.view(provider);
  }

  async test(id: string, payload: ChannelMessage): Promise<Record<string, unknown>> {
    return this.send(id, payload);
  }

  async send(id: string, payload: ChannelMessage): Promise<Record<string, unknown>> {
    const provider = await this.requireProvider(id);
    const result = await this.sendWithProvider(provider, payload);

    await this.client.log({
      provider_id: Number(provider.id),
      channel: provider.channel,
      recipient: payload.recipient,
      subject: payload.subject ?? null,
      body: payload.text,
      status: "sent",
      attempts: 1,
      fallback_used: false,
      external_message_id: result.message_id ?? null,
    }).catch(() => undefined);

    return result;
  }

  async routeAndSend(channel: Channel, payload: ChannelMessage): Promise<Record<string, unknown>> {
    const providers = (await this.client.providers())
      .filter((provider) =>
        provider.enabled
        && provider.channel === channel
        && provider.driver !== "whatsapp_link"
      )
      .sort((a, b) =>
        Number(a.is_fallback) - Number(b.is_fallback) ||
        a.priority - b.priority ||
        a.name.localeCompare(b.name)
      );

    if (!providers.length) {
      throw new ConflictException(`No hay proveedores habilitados para ${channel}.`);
    }

    const errors: string[] = [];
    let attempts = 0;

    for (const provider of providers) {
      attempts += 1;
      try {
        const result = await this.sendWithProvider(provider, payload);
        await this.client.log({
          provider_id: Number(provider.id),
          channel,
          recipient: payload.recipient,
          subject: payload.subject ?? null,
          body: payload.text,
          status: "sent",
          attempts,
          fallback_used: provider.is_fallback,
          external_message_id: result.message_id ?? null,
        }).catch(() => undefined);

        return {
          ...result,
          provider_id: provider.id,
          provider_name: provider.name,
          fallback_used: provider.is_fallback,
          attempts,
        };
      } catch (error) {
        errors.push(provider.name + ": " + this.errorMessage(error));
      }
    }

    await this.client.log({
      provider_id: null,
      channel,
      recipient: payload.recipient,
      subject: payload.subject ?? null,
      body: payload.text,
      status: "failed",
      attempts,
      fallback_used: providers.some((provider) => provider.is_fallback),
      last_error: errors.join(" | "),
    }).catch(() => undefined);

    throw new ConflictException("Todos los proveedores fallaron: " + errors.join(" | "));
  }

  onModuleDestroy(): void {
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    for (const current of this.runtime.values()) {
      current.manualClose = true;
      current.socket?.end(undefined);
    }
    this.runtime.clear();
    this.inboundQueues.clear();
    this.voiceSeen.clear();
    this.voiceWindows.clear();
  }

  private enqueueIncomingMessage(provider: ChannelProvider, message: WAMessage): void {
    const key = `${provider.id}:${String(message.key.remoteJid ?? "unknown")}`;
    const previous = this.inboundQueues.get(key) ?? Promise.resolve();

    const next = previous
      .then(() => this.handleIncomingMessage(provider, message))
      .catch((error) => {
        this.logger.error(`WhatsApp inbound ${provider.id}: ${this.errorMessage(error)}`);
      });

    this.inboundQueues.set(key, next);
    void next.finally(() => {
      if (this.inboundQueues.get(key) === next) {
        this.inboundQueues.delete(key);
      }
    });
  }

  private async handleIncomingMessage(provider: ChannelProvider, message: WAMessage): Promise<void> {
    if (message.key.fromMe) return;

    const remoteJid = String(message.key.remoteJid ?? "");
    if (
      !remoteJid
      || remoteJid === "status@broadcast"
      || remoteJid.endsWith("@g.us")
      || remoteJid.endsWith("@newsletter")
    ) {
      return;
    }

    // Preserve @lid identity: do not infer a phone number from its digits.
    const sender = parseInboundWhatsAppJid(remoteJid);
    if (!sender) {
      this.logger.warn(`WhatsApp inbound ${provider.id}: unsupported sender JID domain`);
      return;
    }

    let text = this.messageText(message);
    let isVoiceInput = false;
    let voiceSeconds: number | null = null;
    const voice = getVoiceAudio(message);
    if (!text && voice) {
      const messageId = message.key.id;
      // Prevent duplicate media downloads on repeated Baileys notifications.
      if (!messageId || !this.acceptVoiceMessage(provider.id, sender.chatJid, messageId)) return;
      const decision = checkVoiceAudio(voice);
      if (!decision.allowed) {
        await this.replyToVoiceFailure(provider.id, sender.chatJid, decision.reason);
        return;
      }
      const voiceRate = this.withinVoiceRate(provider.id, sender.chatJid);
      if (voiceRate !== true) {
        if (voiceRate === false) await this.replyToVoiceFailure(provider.id, sender.chatJid, "rate_limited");
        return;
      }
      try {
        const agentId = String(provider.settings?.agent_id ?? "claudio").toLowerCase();
        text = await this.voice.transcribe(voice, agentId);
        isVoiceInput = true;
        voiceSeconds = decision.seconds;
        if (!text) {
          await this.replyToVoiceFailure(provider.id, sender.chatJid, "no_speech");
          return;
        }
      } catch (error) {
        const reason = error instanceof VoiceError ? error.reason : "stt_failed";
        this.logger.warn(`WhatsApp voice provider=${provider.id} reason=${reason}`);
        await this.replyToVoiceFailure(provider.id, sender.chatJid, reason);
        return;
      }
    }
    if (!text) return;
    const contactPhone = sender.contactPhone;
    const inbound = await this.client.receiveInbound({
      provider_id: Number(provider.id),
      external_thread_id: remoteJid,
      external_message_id: message.key.id ?? randomUUID(),
      contact_phone: contactPhone,
      contact_name: message.pushName?.trim() || null,
      text,
      metadata: {
        message_type: Object.keys(message.message ?? {})[0] ?? "text",
        address_type: sender.addressType,
        ...(isVoiceInput ? { input_mode: "voice", audio_duration_seconds: voiceSeconds } : {}),
      },
    });

    if (inbound.duplicate || !inbound.should_automate) return;

    try {
      const assignedAgentId = String(provider.settings?.agent_id ?? inbound.agent_id ?? "claudio").toLowerCase();
      const response = await this.agents.execute(assignedAgentId, {
        message: text,
        history: inbound.history,
        context: {
          channel: "whatsapp",
          voiceInput: isVoiceInput,
          communicationConversationId: inbound.conversation.id,
          customerPhone: contactPhone ?? undefined,
          customerName: inbound.customer?.name ?? inbound.conversation.contact_name ?? undefined,
          customerEmail: inbound.customer?.email ?? undefined,
          hasDataProcessingConsent: inbound.customer?.has_data_processing_consent ?? false,
        },
      });

      if (response.status !== "completed") {
        throw new Error(response.message);
      }

      const liveStatus = await this.client
        .conversationStatus(inbound.conversation.id)
        .catch(() => inbound.conversation.status);

      if (liveStatus === "human_active" || liveStatus === "closed") {
        return;
      }

      const sent = await this.send(provider.id, {
        recipient: sender.chatJid,
        text: response.message,
      });

      await this.client.recordOutbound(inbound.conversation.id, {
        external_message_id: sent.message_id ?? null,
        text: response.message,
        sender_type: "agent",
        status: "sent",
      });
    } catch (error) {
      this.logger.warn(`Agente de WhatsApp no pudo responder ${sender.chatJid}: ${this.errorMessage(error)}`);
      await this.client.updateConversation(inbound.conversation.id, "waiting_human").catch(() => undefined);

      const fallback = "Gracias por escribir a Gaspronal. En este momento no pude completar la atención automática. Dejé tu conversación pendiente para que un asesor pueda continuarla.";

      try {
        const sent = await this.send(provider.id, {
          recipient: sender.chatJid,
          text: fallback,
        });

        await this.client.recordOutbound(inbound.conversation.id, {
          external_message_id: sent.message_id ?? null,
          text: fallback,
          sender_type: "system",
          status: "sent",
        });
      } catch (sendError) {
        this.logger.error(`No fue posible enviar fallback WhatsApp ${sender.chatJid}: ${this.errorMessage(sendError)}`);
      }
    }
  }

  /** Avoid duplicate audio transcription and bound in-memory tracking. */
  private acceptVoiceMessage(providerId: string, jid: string, messageId: string): boolean {
    const now = Date.now();
    for (const [key, at] of this.voiceSeen) {
      if (now - at > 600_000) this.voiceSeen.delete(key);
    }
    const key = `${providerId}:${jid}:${messageId}`;
    if (this.voiceSeen.has(key)) return false;
    if (this.voiceSeen.size >= 3000) this.voiceSeen.delete(this.voiceSeen.keys().next().value!);
    this.voiceSeen.set(key, now);
    return true;
  }

  /** Ten notes per chat every ten minutes limits transcription spend. */
  private withinVoiceRate(providerId: string, jid: string): boolean {
    const now = Date.now();
    for (const [key, window] of this.voiceWindows) {
      if (now - window.started >= 600_000) this.voiceWindows.delete(key);
    }
    const key = `${providerId}:${jid}`;
    const current = this.voiceWindows.get(key);
    if (current && current.count >= 10) {
      // Notify only once; additional rejected notes are silently ignored to prevent outbound spam.
      if (current.count === 10) {
        current.count++;
        return false;
      }
      return undefined;
    }
    if (this.voiceWindows.size >= 3000 && !current) this.voiceWindows.delete(this.voiceWindows.keys().next().value!);
    this.voiceWindows.set(key, current ? { started: current.started, count: current.count + 1 } : { started: now, count: 1 });
    return true;
  }

  private async replyToVoiceFailure(id: string, jid: string, reason: string): Promise<void> {
    try {
      await this.send(id, { recipient: jid, text: voiceErrorMessage(reason) });
    } catch {
      this.logger.warn(`WhatsApp voice provider=${id}: could not send text notice`);
    }
  }

  private messageText(message: WAMessage): string {
    const wrapped =
      message.message?.ephemeralMessage?.message
      ?? message.message?.viewOnceMessage?.message
      ?? message.message;

    return String(
      wrapped?.conversation
      ?? wrapped?.extendedTextMessage?.text
      ?? wrapped?.imageMessage?.caption
      ?? wrapped?.videoMessage?.caption
      ?? "",
    ).trim();
  }

  private async sendWithProvider(
    provider: ChannelProvider,
    payload: ChannelMessage,
  ): Promise<{message_id?: string}> {
    if (provider.driver === "baileys") {
      let current = this.runtime.get(provider.id);

      if (!current?.socket || current.status !== "connected") {
        await this.connect(provider.id);
        current = this.runtime.get(provider.id);
      }

      if (!current?.socket || current.status !== "connected") {
        throw new ConflictException("WhatsApp no está conectado.");
      }

      const jid = resolveWhatsAppRecipientJid(payload?.recipient);
      if (!jid || typeof payload?.text !== "string" || !payload.text.trim()) {
        throw new BadRequestException("Destinatario o mensaje WhatsApp inválido.");
      }

      const result = await current.socket.sendMessage(jid, { text: payload.text });
      return { message_id: result?.key.id ?? undefined };
    }

    if (provider.driver === "smtp") {
      const transporter = this.smtpTransport(provider);
      const user = String(provider.credentials.user ?? "");
      const from = String(provider.settings.from ?? user);
      const result = await transporter.sendMail({
        from,
        to: payload.recipient,
        subject: payload.subject ?? "Gaspronal",
        text: payload.text,
      });
      return { message_id: result.messageId };
    }

    throw new BadRequestException("Driver no soportado.");
  }

  private async verifySmtp(provider: ChannelProvider): Promise<void> {
    const transporter = this.smtpTransport(provider);
    await transporter.verify();
  }

  private smtpTransport(provider: ChannelProvider) {
    const host = String(provider.settings.host ?? "");
    const port = Number(provider.settings.port ?? 587);
    const secure = Boolean(provider.settings.secure ?? false);
    const user = String(provider.credentials.user ?? "");
    const pass = String(provider.credentials.password ?? "");

    if (!host || !user || !pass) {
      throw new ConflictException("Configuración SMTP incompleta.");
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  private async requireProvider(id: string): Promise<ChannelProvider> {
    const provider = await this.findProvider(id);
    if (!provider) throw new BadRequestException("Proveedor no encontrado.");
    return provider;
  }

  private async findProvider(id: string): Promise<ChannelProvider | undefined> {
    return (await this.client.providers()).find((provider) => provider.id === id);
  }

  private async view(provider: ChannelProvider): Promise<ChannelProviderView> {
    const current = this.runtime.get(provider.id);
    const { credentials: _credentials, ...safe } = provider;

    return {
      ...safe,
      has_credentials: Object.keys(_credentials ?? {}).length > 0,
      runtime_status:
        current?.status ??
        ((provider.driver === "smtp" || provider.driver === "whatsapp_link") && provider.enabled ? "ready" : "disconnected"),
      phone_number: current?.phoneNumber,
      display_name: current?.displayName,
      qr_data_url: current?.qrDataUrl,
      last_error: current?.lastError,
    };
  }

  private scheduleReconnect(id: string): void {
    if (this.reconnectTimers.has(id)) return;

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(id);
      void this.connect(id).catch((error) => {
        this.logger.warn(`Reconexión ${id} falló: ${String(error)}`);
        this.scheduleReconnect(id);
      });
    }, 5000);

    this.reconnectTimers.set(id, timer);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
