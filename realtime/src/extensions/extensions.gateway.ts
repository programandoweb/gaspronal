import { ForbiddenException, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { verifySocketToken } from "../socket-auth";
import { socketCorsOrigin } from "../socket-cors";
import { ExtensionRegistryService } from "./extension-registry.service";

@WebSocketGateway({
  namespace: "/extensions",
  cors: { origin: socketCorsOrigin, credentials: true },
  transports: ["websocket", "polling"],
})
export class ExtensionsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ExtensionsGateway.name);
  private unsubscribe?: () => void;

  constructor(private readonly registry: ExtensionRegistryService) {}

  afterInit(): void {
    this.unsubscribe = this.registry.onChanged((items) => {
      this.server.emit("extension:presence", { data: items });
    });
  }

  handleConnection(client: Socket): void {
    try {
      this.authorize(client);
      client.emit("extension:presence", { data: this.registry.list() });
    } catch {
      client.emit("extension:error", { message: "No autorizado." });
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // Dashboard observers are stateless.
  }

  @SubscribeMessage("extension:list")
  list(@ConnectedSocket() client: Socket): { ok: true; data: unknown[] } {
    this.authorize(client);
    return { ok: true, data: this.registry.list() };
  }

  @SubscribeMessage("extension:test")
  async test(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { installationId?: string },
  ): Promise<{ ok: boolean; message: string; data?: unknown }> {
    this.authorize(client);
    const installationId = String(payload?.installationId ?? "").trim();
    if (!installationId) return { ok: false, message: "installationId es obligatorio." };

    const extensionSocket = this.registry.getSocket(installationId);
    if (!extensionSocket?.connected) {
      return { ok: false, message: "La extensión no está conectada." };
    }

    try {
      const response = await extensionSocket.timeout(15000).emitWithAck("extension.test", {
        installationId,
        targetUrl: "https://web.whatsapp.com/",
        requestedAt: new Date().toISOString(),
      });

      return {
        ok: Boolean(response?.ok),
        message: response?.message || (response?.ok ? "Prueba ejecutada." : "La extensión rechazó la prueba."),
        data: response,
      };
    } catch (error) {
      this.logger.warn(`Extension test failed for ${installationId}: ${error instanceof Error ? error.message : String(error)}`);
      return { ok: false, message: "La extensión no respondió a la prueba dentro del tiempo esperado." };
    }
  }

  private authorize(client: Socket): void {
    const secret = process.env.AGENT_SHARED_SECRET?.trim();
    if (!secret) throw new ForbiddenException();

    const token = String(client.handshake.auth?.token ?? "").trim();
    try {
      const payload = verifySocketToken(token, secret);
      if (!String(payload.sub || "").startsWith("extensions:")) throw new ForbiddenException();
    } catch {
      throw new ForbiddenException();
    }
  }
}
