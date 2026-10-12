import { NextResponse } from "next/server";
import { authenticatedUser, realtimeFetch } from "@/lib/agents-server";
import { backendFetch } from "@/lib/backend";
import { randomUUID } from "node:crypto";

export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const identity = await authenticatedUser();
  if (!identity) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  const { roles = [], permissions = [] } = identity.user;
  if (!roles.includes("root") && !(permissions.includes("agents.manage") && permissions.includes("content.manage"))) {
    return NextResponse.json({ message: "No tienes permisos para solicitar mejoras a Lucía." }, { status: 403 });
  }

  const { slug } = await params;
  if (!/^[a-z0-9-]{1,240}$/.test(slug)) {
    return NextResponse.json({ message: "Servicio inválido." }, { status: 400 });
  }
  const response = await backendFetch("/content/public/legacy-services/" + encodeURIComponent(slug));
  if (!response.ok) return NextResponse.json({ message: "Servicio no disponible." }, { status: 404 });
  const post = (await response.json()).data as { id: number; title: string; slug: string };
  const url = "https://gaspronal.programandoweb.net/2019/servicios/" + encodeURIComponent(post.slug);
  const original = "https://www.gaspronal.com/2019/servicios/" + encodeURIComponent(post.slug);
  const message = [
    "Lucía, solicitud editorial sobre un servicio EXISTENTE de Gaspronal (no crees un post nuevo).",
    "Servicio: " + post.title + " (post ID " + post.id + ").",
    "Ficha actual: " + url,
    "Fuente histórica para investigar: " + original,
    "Investiga fuentes verificables y propón mejoras del contenido, estructura, SEO, título y metadescripción sin inventar especificaciones.",
    "Propón y genera imágenes profesionales relevantes para la GALERÍA del MISMO servicio, conservando todas las imágenes originales y sus archivos.",
    "No modifiques ni publiques automáticamente la ficha. Presenta las propuestas y las imágenes para revisión y aprobación administrativa. No crees una segunda publicación.",
    "Si tu flujo actual solo crea publicaciones nuevas, informa la limitación y entrega un plan; no ejecutes ese flujo sobre esta solicitud.",
  ].join("\n");
  try {
    const agentResponse = await realtimeFetch("/api/agents/lucia/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, requestId: randomUUID(), history: [] }),
    });
    const data = await agentResponse.json().catch(() => ({}));
    if (!agentResponse.ok) {
      return NextResponse.json({ message: data.message ?? "No fue posible contactar a Lucía." }, { status: agentResponse.status });
    }
    return NextResponse.json({ data, message: "Solicitud enviada a Lucía. Revisa su respuesta en el panel de agentes." });
  } catch {
    return NextResponse.json({ message: "Lucía no está disponible en este momento." }, { status: 503 });
  }
}
