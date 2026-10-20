import { redirect } from "next/navigation";

export default async function EditServiceOrderRedirect({ params }:{ params:Promise<{id:string}> }) {
  const { id } = await params;
  redirect(`/dashboard/servicios/ordenes?order=${id}`);
}
