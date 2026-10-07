import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { socketCorsOrigin } from "../socket-cors";
import { LmStudioProxyService } from "./lm-studio-proxy.service";
import { BrowserAgentRouterService } from "./browser-agent-router.service";
import { ExtensionRegistryService } from "../extensions/extension-registry.service";
import type {
  LmStudioProxyCancel,
  LmStudioProxyRequest,
} from "./lm-studio-proxy.types";

@WebSocketGateway({
  cors: { origin: socketCorsOrigin, credentials: true },
  transports: ["websocket", "polling"],
})
export class InferenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(InferenceGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly lmStudio: LmStudioProxyService,
    private readonly extensions: ExtensionRegistryService,
    private readonly browserAgents: BrowserAgentRouterService,
  ) {}

  handleConnection(socket: Socket): void {
    const role = String(
      socket.handshake.auth?.type ??
        socket.handshake.query?.type ??
        "",
    ).trim();

    const token = String(
      socket.handshake.auth?.token ??
        socket.handshake.query?.token ??
        "",
    ).trim();

    if (role === "inference-client") {
      const expected = this.config
        .get<string>("INFERENCE_CLIENT_TOKEN", "")
        .trim();

      if (!expected || token !== expected) {
        this.logger.warn(`Rejected inference client socket ${socket.id}`);
        socket.disconnect(true);
        return;
      }

      socket.data.role = "inference-client";
      socket.data.clientId = String(
        socket.handshake.auth?.clientId ??
          socket.handshake.query?.clientId ??
          socket.id,
      );

      this.extensions.register(socket);

      this.logger.log(
        `Inference client connected: ${socket.data.clientId} (${socket.id})`,
      );
      return;
    }

    if (role === "agent") {
      const expected = this.config
        .get<string>("BROWSER_AGENT_TOKEN", "")
        .trim();

      if (!expected || token !== expected) {
        this.logger.warn(`Rejected browser agent socket ${socket.id}`);
        socket.disconnect(true);
        return;
      }

      socket.data.role = "browser-agent";
      socket.data.agentId = String(
        socket.handshake.auth?.agentId ??
          socket.handshake.query?.agentId ??
          "",
      ).trim();

      this.extensions.register(socket);
      this.browserAgents.register(socket, {
        agentId: socket.data.agentId,
        name: socket.handshake.auth?.extensionName,
        version: socket.handshake.auth?.version,
      });

      this.logger.log(
        `Browser agent connected: ${socket.data.agentId || socket.id} (${socket.id})`,
      );
    }
  }

  handleDisconnect(socket: Socket): void {
    this.extensions.unregister(socket);
    this.browserAgents.unregister(socket);
    if (socket.data.role === "inference-client") {
      this.logger.log(
        `Inference client disconnected: ${socket.data.clientId || socket.id}`,
      );
    } else if (socket.data.role === "browser-agent") {
      this.logger.log(
        `Browser agent disconnected: ${socket.data.agentId || socket.id}`,
      );
    }
  }

  @SubscribeMessage("extension.heartbeat")
  handleExtensionHeartbeat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: Record<string, unknown>,
  ): { ok: boolean; data?: unknown } {
    if (socket.data.role !== "inference-client" && socket.data.role !== "browser-agent") return { ok: false };
    const data = this.extensions.heartbeat(socket, payload);
    return { ok: Boolean(data), data };
  }

  @SubscribeMessage("agent.register")
  handleAgentRegister(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: Record<string, unknown>,
  ): { ok: boolean } {
    if (socket.data.role !== "browser-agent") return { ok: false };
    const agent = this.browserAgents.register(socket, payload);
    this.extensions.heartbeat(socket, {
      installationId: socket.handshake.auth?.installationId,
      name: payload.agentName ?? payload.name ?? socket.handshake.auth?.extensionName,
      version: payload.version ?? socket.handshake.auth?.version,
      type: socket.handshake.auth?.extensionType ?? "gemini_web",
      targetUrl: socket.handshake.auth?.targetUrl ?? "https://gemini.google.com/app",
    });
    return { ok: Boolean(agent) };
  }

  @SubscribeMessage("agent.heartbeat")
  handleAgentHeartbeat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: Record<string, unknown>,
  ): { ok: boolean } {
    if (socket.data.role !== "browser-agent") return { ok: false };
    this.extensions.heartbeat(socket, {
      ...payload,
      installationId: socket.handshake.auth?.installationId,
      name: socket.handshake.auth?.extensionName,
      version: socket.handshake.auth?.version,
      type: socket.handshake.auth?.extensionType ?? "gemini_web",
      targetUrl: socket.handshake.auth?.targetUrl ?? "https://gemini.google.com/app",
    });
    return { ok: true };
  }

  @SubscribeMessage("lm.accepted")
  handleLmAccepted(@ConnectedSocket() socket: Socket, @MessageBody() payload: Record<string, unknown>): void {
    if (socket.data.role === "browser-agent") this.browserAgents.forward(socket, "lm.accepted", payload);
  }

  @SubscribeMessage("lm.started")
  handleLmStarted(@ConnectedSocket() socket: Socket, @MessageBody() payload: Record<string, unknown>): void {
    if (socket.data.role === "browser-agent") this.browserAgents.forward(socket, "lm.started", payload);
  }

  @SubscribeMessage("lm.completed")
  handleLmCompleted(@ConnectedSocket() socket: Socket, @MessageBody() payload: Record<string, unknown>): void {
    if (socket.data.role === "browser-agent") this.browserAgents.forward(socket, "lm.completed", payload);
  }

  @SubscribeMessage("lm.error")
  handleLmError(@ConnectedSocket() socket: Socket, @MessageBody() payload: Record<string, unknown>): void {
    if (socket.data.role === "browser-agent") this.browserAgents.forward(socket, "lm.error", payload);
  }

  @SubscribeMessage("lm.request")
  async handleLmRequest(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: LmStudioProxyRequest,
  ): Promise<{ ok: boolean; requestId: string; error?: string }> {
    if (socket.data.role !== "inference-client") {
      return {
        ok: false,
        requestId: String(payload?.requestId || ""),
        error: "Unauthorized socket role",
      };
    }

    const agentId = String(payload?.agentId ?? "").trim();
    if (agentId && this.browserAgents.has(agentId)) {
      return this.browserAgents.route(socket, payload);
    }

    if (agentId === "browser-gemini") {
      return {
        ok: false,
        requestId: String(payload?.requestId ?? ""),
        error: "Browser agent browser-gemini is offline",
      };
    }

    return this.lmStudio.start(
      socket.id,
      payload,
      (event, response) => socket.emit(event, response),
    );
  }

  @SubscribeMessage("lm.cancel")
  handleLmCancel(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: LmStudioProxyCancel,
  ): { ok: boolean; error?: string } {
    if (socket.data.role !== "inference-client") {
      return { ok: false, error: "Unauthorized socket role" };
    }

    const requestId = String(payload?.requestId || "").trim();
    if (!requestId) {
      return { ok: false, error: "requestId is required" };
    }

    if (this.browserAgents.cancel(socket, payload)) {
      return { ok: true };
    }

    return { ok: this.lmStudio.cancel(socket.id, requestId) };
  }

  @SubscribeMessage("enterprise.registration.turn")
  handleEnterpriseRegistrationTurn(
    @ConnectedSocket() socket: Socket,
  ): { ok: boolean; error?: string; statusCode?: number } {
    if (socket.data.role !== "inference-client") {
      return {
        ok: false,
        error: "Unauthorized socket role",
        statusCode: 403,
      };
    }

    // Se conserva el evento porque forma parte del contrato actual de la
    // extensión. Gaspronal no utiliza el flujo empresarial de Migo.
    return {
      ok: false,
      error:
        "El flujo enterprise.registration.turn no está habilitado en Gaspronal.",
      statusCode: 404,
    };
  }
}
