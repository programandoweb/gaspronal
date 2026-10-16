import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

type Context = { params: Promise<{ id: string }> };

async function mutate(id: string, suffix: string, method: "POST" | "DELETE") {
  const token = (await cookies()).get("gaspronal_access_token")?.value;
  if (!token) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: "Identificador inválido." }, { status: 400 });
  const response = await backendFetch(`/deployments/${id}${suffix}`, {
    method, headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({ message: "Error del servidor." }));
  return NextResponse.json(payload, { status: response.status });
}

export async function POST(_request: Request, { params }: Context) {
  return mutate((await params).id, "/cancel", "POST");
}

export async function DELETE(_request: Request, { params }: Context) {
  return mutate((await params).id, "", "DELETE");
}
