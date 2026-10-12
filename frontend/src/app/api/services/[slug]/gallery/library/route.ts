import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/agents-server";
import { backendFetch } from "@/lib/backend";

const TARGET_SLUG = "instalacion-reparacion-y-mantenimiento-de-equipos-a-gas-domesticos-e-industriales";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug !== TARGET_SLUG) return NextResponse.json({ message: "Servicio no permitido." }, { status: 404 });
  const identity = await authenticatedUser();
  if (!identity) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  if (!identity.user.roles?.includes("root")) return NextResponse.json({ message: "Solo root puede seleccionar imágenes." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.image_url !== "string") return NextResponse.json({ message: "Selecciona una imagen válida." }, { status: 422 });

  const serviceResponse = await backendFetch("/content/public/legacy-services/" + encodeURIComponent(slug));
  if (!serviceResponse.ok) return NextResponse.json({ message: "Servicio no encontrado." }, { status: 404 });
  const service = (await serviceResponse.json()).data as { id: number; slug: string };
  if (service.slug !== TARGET_SLUG) return NextResponse.json({ message: "Servicio no permitido." }, { status: 404 });

  const result = await backendFetch("/content/posts/" + service.id + "/gallery/library", {
    method: "POST",
    headers: { Authorization: "Bearer " + identity.token, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: body.image_url }),
  });
  return new NextResponse(await result.text(), {
    status: result.status,
    headers: { "Content-Type": result.headers.get("content-type") ?? "application/json" },
  });
}
