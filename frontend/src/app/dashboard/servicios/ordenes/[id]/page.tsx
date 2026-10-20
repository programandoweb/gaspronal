import { redirect } from "next/navigation";

export default async function ServiceOrderRedirect({ params }:{ params:Promise<{id:string}> }) {
  const { id } = await params;
  redirect(`/dashboard/servicios/ordenes?order=${id}`);
}
