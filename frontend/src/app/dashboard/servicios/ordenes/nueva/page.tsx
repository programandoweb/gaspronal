import { redirect } from "next/navigation";

export default function NewServiceOrderRedirect() {
  redirect("/dashboard/servicios/ordenes");
}
