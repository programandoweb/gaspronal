import { Injectable } from "@nestjs/common";
import type { Socket } from "socket.io";
import type { LmStudioProxyCancel, LmStudioProxyRequest } from "./lm-studio-proxy.types";

type BrowserAgent = {
  agentId: string;
  socket: Socket;
  installationId: string;
  name: string;
  version: string;
};

type PendingRoute = {
  requester: Socket;
  agentSocketId: string;
  agentId: string;
};

@Injectable()
export class BrowserAgentRouterService {
  private readonly agents = new Map<string, BrowserAgent>();
  private readonly pending = new Map<string, PendingRoute>();

  register(socket: Socket, payload: Record<string, unknown> = {}): BrowserAgent | null {
    const agentId = String(payload.agentId ?? payload.id ?? socket.handshake.auth?.agentId ?? "").trim();
    if (!agentId) return null;

    const item: BrowserAgent = {
      agentId,
      socket,
      installationId: String(socket.handshake.auth?.installationId ?? "").trim(),
      name: String(payload.agentName ?? payload.name ?? socket.handshake.auth?.extensionName ?? agentId),
      version: String(payload.version ?? socket.handshake.auth?.version ?? ""),
    };

    this.agents.set(agentId, item);
    return item;
  }

  unregister(socket: Socket): void {
    for (const [agentId, item] of this.agents.entries()) {
      if (item.socket.id === socket.id) this.agents.delete(agentId);
    }

    for (const [requestId, route] of this.pending.entries()) {
      if (route.agentSocketId === socket.id || route.requester.id === socket.id) {
        this.pending.delete(requestId);
      }
    }
  }

  has(agentId: string): boolean {
    return Boolean(this.agents.get(agentId)?.socket.connected);
  }

  async route(requester: Socket, payload: LmStudioProxyRequest): Promise<{ ok: boolean; requestId: string; error?: string }> {
    const requestId = String(payload?.requestId ?? "").trim();
    const agentId = String(payload?.agentId ?? "").trim();

    if (!requestId) return { ok: false, requestId: "", error: "requestId is required" };
    if (!agentId) return { ok: false, requestId, error: "agentId is required" };

    const agent = this.agents.get(agentId);
    if (!agent?.socket.connected) {
      return { ok: false, requestId, error: `Browser agent ${agentId} is offline` };
    }

    this.pending.set(requestId, {
      requester,
      agentSocketId: agent.socket.id,
      agentId,
    });

    try {
      const ack = await agent.socket.timeout(10000).emitWithAck("lm.request", payload);
      if (!ack?.ok) {
        this.pending.delete(requestId);
        return {
          ok: false,
          requestId,
          error: String(ack?.error ?? "Browser agent rejected request"),
        };
      }

      return {
        ok: true,
        requestId,
      };
    } catch (error) {
      this.pending.delete(requestId);
      return {
        ok: false,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  cancel(requester: Socket, payload: LmStudioProxyCancel): boolean {
    const requestId = String(payload?.requestId ?? "").trim();
    const route = this.pending.get(requestId);
    if (!route || route.requester.id !== requester.id) return false;

    const agent = this.agents.get(route.agentId);
    agent?.socket.emit("lm.cancel", payload);
    this.pending.delete(requestId);
    return true;
  }

  forward(agentSocket: Socket, event: string, payload: Record<string, unknown>): boolean {
    const requestId = String(payload?.requestId ?? "").trim();
    if (!requestId) return false;

    const route = this.pending.get(requestId);
    if (!route || route.agentSocketId !== agentSocket.id) return false;

    route.requester.emit(event, payload);

    if (event === "lm.completed" || event === "lm.error") {
      this.pending.delete(requestId);
    }

    return true;
  }
}
