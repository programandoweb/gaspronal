import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

const COOKIE = "gaspronal_claudio_web_session";
const routes: Record<string, { method: "GET" | "POST"; path: string }> = {
  current: { method: "GET", path: "/public/claudio-web/sessions/current" },
  message: { method: "POST", path: "/public/claudio-web/messages" },
  consent: { method: "POST", path: "/public/claudio-web/consent" },
};

async function ensureSession(initialPath?: string) {
  const store = await cookies();
  const existingToken = store.get(COOKIE)?.value;
  let token: string;
  if (existingToken) return { token: existingToken, created: false, response: null as NextResponse | null };
  const response = await backendFetch("/public/claudio-web/sessions", { method: "POST", body: JSON.stringify({ initial_path: initialPath }) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.data?.token) return { token: "", created: false, response: NextResponse.json(json, { status: response.status }) };
  token = String(json.data.token);
  const next = NextResponse.json({ data: json.data.conversation }, { status: 201 });
  next.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return { token, created: true, response: next };
}

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (action === "session") {
    const body = await request.json().catch(() => ({}));
    const session = await ensureSession(body?.initial_path);
    return session.response ?? NextResponse.json({ data: { existing: true } });
  }
  const route = routes[action];
  if (!route || route.method !== "POST") return NextResponse.json({ message: "Ruta no encontrada." }, { status: 404 });
  const session = await ensureSession();
  if (session.response && !session.created) return session.response;
  const response = await backendFetch(route.path, { method: "POST", headers: { "X-Claudio-Web-Session": session.token }, body: await request.text() });
  const next = new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  if (session.created) next.cookies.set(COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return next;
}

export async function GET(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  const route = routes[action];
  if (!route || route.method !== "GET") return NextResponse.json({ message: "Ruta no encontrada." }, { status: 404 });
  const session = await ensureSession();
  if (session.response && !session.created) return session.response;
  const response = await backendFetch(route.path, { headers: { "X-Claudio-Web-Session": session.token } });
  const next = new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  if (session.created) next.cookies.set(COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return next;
}
