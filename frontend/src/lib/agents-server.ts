import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { backendFetch } from "@/lib/backend";

export async function authenticatedUser() {
  const token = (await cookies()).get("gaspronal_access_token")?.value;
  if (!token) return null;

  const response = await backendFetch("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;

  const json = await response.json();
  return { token, user: json.data as { id: number; name: string; email: string; roles?: string[]; permissions?: string[] } };
}

export async function realtimeFetch(path: string, init: RequestInit = {}) {
  const base = (process.env.REALTIME_INTERNAL_URL ?? "http://realtime:4100").replace(/\/$/, "");
  const secret = String(process.env.AGENT_SHARED_SECRET ?? "").trim();
  const headers = new Headers(init.headers);
  if (secret) headers.set("Authorization", `Bearer ${secret}`);

  return fetch(base + path, { ...init, headers, cache: "no-store" });
}

export function createSocketToken(subject: string) {
  const secret = String(process.env.AGENT_SHARED_SECRET ?? "").trim();
  if (!secret) throw new Error("AGENT_SHARED_SECRET no está configurado.");

  const payload = Buffer.from(JSON.stringify({
    sub: subject,
    exp: Math.floor(Date.now() / 1000) + 300,
  })).toString("base64url");

  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
