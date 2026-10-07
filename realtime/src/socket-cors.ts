export function socketCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  // CLI/server-to-server clients normally do not send Origin.
  if (!origin) {
    callback(null, true);
    return;
  }

  // Chrome extensions have dynamic installation IDs, so an exact origin
  // allowlist is not practical. Authentication is still enforced by each
  // Socket.IO gateway.
  if (origin.startsWith("chrome-extension://")) {
    callback(null, true);
    return;
  }

  const configured = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.length === 0 || configured.includes("*") || configured.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error("Socket.IO origin not allowed"), false);
}
