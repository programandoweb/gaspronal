import { NextResponse } from "next/server";
import { authenticatedUser, createSocketToken } from "@/lib/agents-server";

export async function GET(request: Request) {
  const auth = await authenticatedUser();
  if (!auth) return NextResponse.json({ message: "No autenticado." }, { status: 401 });

  if (!auth.user.permissions?.includes("extensions.view")) {
    return NextResponse.json({ message: "No autorizado." }, { status: 403 });
  }

  try {
    return NextResponse.json({
      token: createSocketToken(`extensions:${auth.user.id}`),
      realtime_url: process.env.NEXT_PUBLIC_REALTIME_URL?.trim() || new URL(request.url).origin,
      expires_in: 300,
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "No fue posible generar el token Socket.IO.",
    }, { status: 503 });
  }
}
