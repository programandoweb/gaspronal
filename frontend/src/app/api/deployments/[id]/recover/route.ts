import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: "Identificador inválido." }, { status: 400 });
  const token = (await cookies()).get("gaspronal_access_token")?.value;
  if (!token) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  const response = await backendFetch(`/deployments/${id}/recover`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  });
  return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
}
