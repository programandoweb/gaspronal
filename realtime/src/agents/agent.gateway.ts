import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { ForbiddenException } from "@nestjs/common";
import { verifySocketToken } from "../socket-auth";
import { socketCorsOrigin } from "../socket-cors";
import type { Server, Socket } from "socket.io";
import { AgentRegistryService } from "./agent-registry.service";
import { AgentRuntimeService } from "./agent-runtime.service";
import type { AgentMessageInput } from "./agent.types";

@WebSocketGateway({
  namespace: "/agents",
  cors: { origin: socketCorsOrigin, credentials: true },
})
export class AgentGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly registry: AgentRegistryService,
    private readonly runtime: AgentRuntimeService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      this.authorize(client);
      client.emit("agent:ready", { transport: "socket.io" });
      client.emit("agent:list", this.registry.list());
    } catch {
      client.emit("agent:error", { message: "No autorizado." });
      client.disconnect(true);
    }
  }

  @SubscribeMessage("agent:list")
  list(@ConnectedSocket() client: Socket): void {
    this.authorize(client);
    client.emit("agent:list", this.registry.list());
  }

  @SubscribeMessage("agent:message")
  async message(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AgentMessageInput & { agentId?: string },
  ): Promise<void> {
    try {
      this.authorize(client);
      const result = await this.runtime.execute(String(payload.agentId ?? ""), payload, progress => client.emit("agent:progress", progress));
      client.emit("agent:response", result);
    } catch (error) {
      client.emit("agent:error", { message: error instanceof Error ? error.message : String(error) });
    }
  }

  private authorize(client: Socket): void {
    const secret = process.env.AGENT_SHARED_SECRET?.trim();
    if (!secret) return;

    const token = String(client.handshake.auth?.token ?? "").trim();
    try {
      verifySocketToken(token, secret);
    } catch {
      throw new ForbiddenException();
    }
  }
}
