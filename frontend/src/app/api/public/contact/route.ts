import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ message: "Formato de solicitud no permitido." }, { status: 415 });
  }
  try {
    const body = await request.text();
    if (body.length > 20000) {
      return NextResponse.json({ message: "El mensaje supera el tamaño permitido." }, { status: 413 });
    }
    const response = await backendFetch("/public/contact", { method: "POST", body });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { message: "No fue posible conectar con Gaspronal. Inténtalo nuevamente." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
