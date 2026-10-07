import { EventEmitter } from "node:events";
import { Injectable } from "@nestjs/common";
import type { Socket } from "socket.io";

export type ConnectedExtension = {
  installationId: string;
  clientId: string;
  name: string;
  version: string;
  socketId: string;
  connectedAt: string;
  lastSeenAt: string;
};

@Injectable()
export class ExtensionRegistryService {
  private readonly sockets = new Map<string, Socket>();
  private readonly extensions = new Map<string, ConnectedExtension>();
  private readonly emitter = new EventEmitter();

  register(socket: Socket): ConnectedExtension | null {
    const installationId = String(socket.handshake.auth?.installationId ?? "").trim();
    if (!installationId) return null;

    const now = new Date().toISOString();
    const item: ConnectedExtension = {
      installationId,
      clientId: String(socket.handshake.auth?.clientId ?? "gaspronal-wa-extension"),
      name: String(socket.handshake.auth?.extensionName ?? "Gaspronal WhatsApp IA"),
      version: String(socket.handshake.auth?.version ?? ""),
      socketId: socket.id,
      connectedAt: now,
      lastSeenAt: now,
    };

    this.sockets.set(installationId, socket);
    this.extensions.set(installationId, item);
    this.emitChanged();
    return item;
  }

  heartbeat(socket: Socket, payload: Record<string, unknown> = {}): ConnectedExtension | null {
    const installationId = String(
      payload.installationId ?? socket.handshake.auth?.installationId ?? "",
    ).trim();
    if (!installationId) return null;

    const current = this.extensions.get(installationId);
    if (!current) return this.register(socket);

    const next: ConnectedExtension = {
      ...current,
      lastSeenAt: new Date().toISOString(),
      version: String(payload.version ?? current.version ?? ""),
      name: String(payload.name ?? current.name ?? "Gaspronal WhatsApp IA"),
    };

    this.sockets.set(installationId, socket);
    this.extensions.set(installationId, next);
    this.emitChanged();
    return next;
  }

  unregister(socket: Socket): void {
    for (const [installationId, registered] of this.sockets.entries()) {
      if (registered.id === socket.id) {
        this.sockets.delete(installationId);
        this.extensions.delete(installationId);
      }
    }
    this.emitChanged();
  }

  list(): ConnectedExtension[] {
    return [...this.extensions.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  getSocket(installationId: string): Socket | undefined {
    return this.sockets.get(installationId);
  }

  onChanged(listener: (items: ConnectedExtension[]) => void): () => void {
    this.emitter.on("changed", listener);
    return () => this.emitter.off("changed", listener);
  }

  private emitChanged(): void {
    this.emitter.emit("changed", this.list());
  }
}
