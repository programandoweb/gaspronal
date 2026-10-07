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
import { LmStudioProxyService } from "./lm-studio-proxy.service";
import type {
  LmStudioProxyCancel,
  LmStudioProxyRequest,
} from "./lm-studio-proxy.types";

@WebSocketGateway({
  cors: { origin: true, credentials: false },
  transports: ["websocket", "polling"],
})
export class InferenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(InferenceGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly lmStudio: LmStudioProxyService,
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

    if (role !== "inference-client") {
      return;
    }

    const expected = this.config
      .get<string>("INFERENCE_CLIENT_TOKEN", "")
      .trim();

    if (!expected || token !== expected) {
      this.logger.warn(
        `Rejected inference client socket ${socket.id}`,
      );
      socket.disconnect(true);
      return;
    }

    socket.data.role = "inference-client";
    socket.data.clientId = String(
      socket.handshake.auth?.clientId ??
        socket.handshake.query?.clientId ??
        socket.id,
    );

    this.logger.log(
      `Inference client connected: ${socket.data.clientId} (${socket.id})`,
    );
  }

  handleDisconnect(socket: Socket): void {
    if (socket.data.role === "inference-client") {
      this.logger.log(
        `Inference client disconnected: ${socket.data.clientId || socket.id}`,
      );
    }
  }

  @SubscribeMessage("lm.request")
  handleLmRequest(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: LmStudioProxyRequest,
  ): { ok: boolean; requestId: string; error?: string } {
    if (socket.data.role !== "inference-client") {
      return {
        ok: false,
        requestId: String(payload?.requestId || ""),
        error: "Unauthorized socket role",
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
