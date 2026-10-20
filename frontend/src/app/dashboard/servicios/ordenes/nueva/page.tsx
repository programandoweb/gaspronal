"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiPlus, FiSave, FiX } from "react-icons/fi";
import { api, Customer } from "@/features/service-orders/api";

const maintenanceTypes = ["Mantenimiento preventivo", "Mantenimiento correctivo", "Diagnóstico técnico", "Instalación y puesta en marcha", "Garantía", "Otro"];
type CustomerForm = { name:string; document:string; email:string; phone:string; whatsapp:string; address:string };

export default function NewServiceOrder() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customType, setCustomType] = useState("");
  const [form, setForm] = useState({ customer_id:"", maintenance_type:"Mantenimiento preventivo", description:"", service_location:"", contact_name:"", contact_phone:"" });
  const [customer, setCustomer] = useState<CustomerForm>({ name:"", document:"", email:"", phone:"", whatsapp:"", address:"" });

  async function loadCustomers() {
    try { const response = await api("/customers"); setCustomers((response.data ?? []) as Customer[]); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar los clientes."); }
  }
  useEffect(() => { void loadCustomers(); }, []);

  function selectCustomer(id:string) {
    const selected = customers.find((item) => item.id === Number(id));
    setForm((current) => ({ ...current, customer_id:id, contact_name:selected?.name ?? current.contact_name, contact_phone:selected?.phone ?? selected?.whatsapp ?? current.contact_phone, service_location:Array.isArray(selected?.addresses) ? String(selected?.addresses?.[0] ?? current.service_location) : current.service_location }));
  }
  async function createCustomer() {
    if (!customer.name.trim()) return;
    setCustomerSaving(true); setMessage("");
    try {
      const response = await api("/customers", { method:"POST", body:JSON.stringify({ ...customer, addresses:customer.address.trim() ? [customer.address.trim()] : [] }) });
      const created = response.data as Customer;
      setCustomers((current) => [created, ...current]); setCreatingCustomer(false); setCustomer({ name:"", document:"", email:"", phone:"", whatsapp:"", address:"" });
      setForm((current) => ({ ...current, customer_id:String(created.id), contact_name:created.name, contact_phone:created.phone ?? created.whatsapp ?? "", service_location:customer.address }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible crear el cliente."); }
    finally { setCustomerSaving(false); }
  }
  async function submit(event:React.FormEvent) {
    event.preventDefault(); const maintenanceType = form.maintenance_type === "Otro" ? customType.trim() : form.maintenance_type;
    if (!maintenanceType) { setMessage("Indica el tipo de servicio."); return; }
    setSaving(true); setMessage("");
    try { const response = await api("", { method:"POST", body:JSON.stringify({ ...form, maintenance_type:maintenanceType, customer_id:Number(form.customer_id) }) }); router.push(`/dashboard/servicios/ordenes/${(response.data as { id:number }).id}`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible crear la orden."); }
    finally { setSaving(false); }
  }

  return <div className="w-full max-w-none space-y-6">
    <Link href="/dashboard/servicios/ordenes" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm"><FiArrowLeft/>Volver a órdenes</Link>
    <header><span className="text-xs font-bold uppercase tracking-[.18em] text-[var(--brand)]">Servicios técnicos</span><h1 className="mt-2 text-3xl font-bold">Nueva orden de servicio</h1><p className="mt-2 text-sm text-[var(--muted)]">Selecciona el cliente y registra los datos de la visita.</p></header>
    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 xl:col-span-2"><span className="text-sm font-medium">Cliente *</span><select required value={form.customer_id} onChange={(event) => selectCustomer(event.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"><option value="">Selecciona un cliente existente</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}{item.document ? ` · ${item.document}` : ""}</option>)}</select></label>
        <div className="flex items-end"><button type="button" onClick={() => setCreatingCustomer(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand)]"><FiPlus/>Crear cliente</button></div>
        <label className="space-y-2"><span className="text-sm font-medium">Tipo de servicio *</span><select value={form.maintenance_type} onChange={(event) => setForm({ ...form, maintenance_type:event.target.value })} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3">{maintenanceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        {form.maintenance_type === "Otro" && <label className="space-y-2 xl:col-span-2"><span className="text-sm font-medium">Especifica el tipo *</span><input required value={customType} onChange={(event) => setCustomType(event.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--border)] px-3"/></label>}
        <label className="space-y-2"><span className="text-sm font-medium">Contacto en sitio *</span><input required value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name:event.target.value })} className="min-h-11 w-full rounded-xl border border-[var(--border)] px-3"/></label>
        <label className="space-y-2"><span className="text-sm font-medium">Teléfono de contacto</span><input inputMode="tel" value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone:event.target.value })} className="min-h-11 w-full rounded-xl border border-[var(--border)] px-3"/></label>
        <label className="space-y-2 xl:col-span-2"><span className="text-sm font-medium">Ubicación del servicio *</span><input required value={form.service_location} onChange={(event) => setForm({ ...form, service_location:event.target.value })} className="min-h-11 w-full rounded-xl border border-[var(--border)] px-3"/></label>
        <label className="space-y-2 xl:col-span-4"><span className="text-sm font-medium">Descripción y alcance *</span><textarea required rows={6} value={form.description} onChange={(event) => setForm({ ...form, description:event.target.value })} className="w-full rounded-xl border border-[var(--border)] p-3"/></label>
      </div>
      <button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 font-semibold text-white disabled:opacity-50"><FiSave/>{saving ? "Creando…" : "Crear orden"}</button>
      {message && <p className="text-sm text-red-700">{message}</p>}
    </form>
    {creatingCustomer && <div className="fixed inset-0 z-50"><button type="button" aria-label="Cerrar creación de cliente" onClick={() => setCreatingCustomer(false)} className="absolute inset-0 bg-slate-950/45"/><aside role="dialog" aria-modal="true" aria-label="Crear cliente" className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-[var(--surface)] shadow-2xl"><header className="flex items-center justify-between border-b border-[var(--border)] p-5"><div><h2 className="text-xl font-bold">Crear cliente</h2><p className="mt-1 text-sm text-[var(--muted)]">Se guardará y quedará seleccionado en esta orden.</p></div><button type="button" onClick={() => setCreatingCustomer(false)} className="grid size-10 place-items-center rounded-xl border border-[var(--border)]" aria-label="Cerrar"><FiX/></button></header><div className="flex-1 overflow-y-auto p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 sm:col-span-2"><span className="text-sm font-medium">Nombre o razón social *</span><input autoFocus required value={customer.name} onChange={(event) => setCustomer({ ...customer, name:event.target.value })} className="min-h-11 w-full rounded-xl border border-[var(--border)] px-3"/></label>{([['document','Documento'],['email','Correo'],['phone','Teléfono'],['whatsapp','WhatsApp']] as const).map(([key,label]) => <label key={key} className="space-y-2"><span className="text-sm font-medium">{label}</span><input type={key === 'email' ? 'email' : 'text'} value={customer[key]} onChange={(event) => setCustomer({ ...customer, [key]:event.target.value })} className="min-h-11 w-full rounded-xl border border-[var(--border)] px-3"/></label>)}<label className="space-y-2 sm:col-span-2"><span className="text-sm font-medium">Dirección principal</span><textarea rows={3} value={customer.address} onChange={(event) => setCustomer({ ...customer, address:event.target.value })} className="w-full rounded-xl border border-[var(--border)] p-3"/></label></div></div><footer className="flex justify-end gap-3 border-t border-[var(--border)] p-5"><button type="button" onClick={() => setCreatingCustomer(false)} className="min-h-11 rounded-xl border border-[var(--border)] px-4 font-medium">Cancelar</button><button type="button" disabled={!customer.name.trim() || customerSaving} onClick={() => void createCustomer()} className="min-h-11 rounded-xl bg-[var(--brand)] px-4 font-semibold text-white disabled:opacity-50">{customerSaving ? "Guardando…" : "Guardar cliente"}</button></footer></aside></div>}
  </div>;
}
