export type AgentSocket = {
  connected: boolean;
  emit: (event: string, payload?: unknown, callback?: (response: any) => void) => void;
  on: (event: string, callback: (payload: any) => void) => void;
  off: (event: string, callback?: (payload: any) => void) => void;
  disconnect: () => void;
};

declare global {
  interface Window {
    io?: (url: string, options?: Record<string, unknown>) => AgentSocket;
  }
}

let socketIoLoader: Promise<void> | null = null;

async function loadSocketIo(baseUrl: string): Promise<void> {
  if (window.io) return;
  if (socketIoLoader) return socketIoLoader;

  socketIoLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${baseUrl.replace(/\/$/, "")}/socket.io/socket.io.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No fue posible cargar Socket.IO."));
    document.head.appendChild(script);
  });

  return socketIoLoader;
}

export async function connectAgentSocket(baseUrl: string, token: string): Promise<AgentSocket> {
  await loadSocketIo(baseUrl);
  if (!window.io) throw new Error("Socket.IO no está disponible.");

  return window.io(`${baseUrl.replace(/\/$/, "")}/agents`, {
    auth: { token },
    transports: ["websocket", "polling"],
  });
}
