import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

const routes: Record<string, { method: "GET" | "POST"; path: string }> = {
  status: { method: "GET", path: "/public/claudio-web/status" },
  current: { method: "GET", path: "/public/claudio-web/sessions/current" },
  message: { method: "POST", path: "/public/claudio-web/messages" },
  consent: { method: "POST", path: "/public/claudio-web/consent" },
};

const noStore = { "Cache-Control": "private, no-store, max-age=0", "Vary": "X-Claudio-Web-Session, X-Claudio-Browser-Id" };

function token(request: NextRequest): string | null {
  const value = request.headers.get("X-Claudio-Web-Session");
  return value && /^[a-zA-Z0-9]{40,128}$/.test(value) ? value : null;
}

async function forward(response: Response): Promise<NextResponse> {
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { ...noStore, "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (action === "session") {
    const body = await request.json().catch(() => ({}));
    const browserId = request.headers.get("X-Claudio-Browser-Id");
    if (!browserId || !/^[0-9a-f-]{36}$/i.test(browserId)) {
      return NextResponse.json({ message: "Identificador del navegador inválido." }, { status: 422, headers: noStore });
    }
    const response = await backendFetch("/public/claudio-web/sessions", {
      method: "POST",
      body: JSON.stringify({ initial_path: body.initial_path, browser_id: browserId }),
      cache: "no-store",
    });
    return forward(response);
  }
  const route = routes[action];
  if (!route || route.method !== "POST") return NextResponse.json({ message: "Ruta no encontrada." }, { status: 404 });
  const sessionToken = token(request);
  if (!sessionToken) return NextResponse.json({ message: "Inicia una sesión privada." }, { status: 401, headers: noStore });
  const response = await backendFetch(route.path, {
    method: "POST",
    headers: { "X-Claudio-Web-Session": sessionToken },
    body: await request.text(),
    cache: "no-store",
  });
  return forward(response);
}

export async function GET(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  const route = routes[action];
  if (!route || route.method !== "GET") return NextResponse.json({ message: "Ruta no encontrada." }, { status: 404 });
  if (action === "status") return forward(await backendFetch(route.path, { cache: "no-store" }));
  const sessionToken = token(request);
  if (!sessionToken) return NextResponse.json({ message: "Inicia una sesión privada." }, { status: 401, headers: noStore });
  return forward(await backendFetch(route.path, { headers: { "X-Claudio-Web-Session": sessionToken }, cache: "no-store" }));
}
