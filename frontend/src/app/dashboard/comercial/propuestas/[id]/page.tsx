"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Save, Share2, Mail, MessageCircle, X } from "lucide-react";
import { use, useEffect, useState } from "react";

type Item={id:number;description:string;quantity:string;unit_price:string;line_total:string};
type Quote={
 id:number;number:string;status:string;currency:string;notes?:string|null;total:string;
 lead:{name:string;email:string;whatsapp:string;status:string};
 items:Item[];
};

export default function ProposalDetailPage({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const [quote,setQuote]=useState<Quote|null>(null);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [sharing,setSharing]=useState(false);
 const [sendingMail,setSendingMail]=useState(false);
 const [recipient,setRecipient]=useState("");

 async function load(){
  const response=await fetch(`/api/admin/commercial/quotes/${id}`,{cache:"no-store"});
  const json=await response.json().catch(()=>({}));
  setLoading(false);
  if(!response.ok){setMessage(json.message??"No fue posible cargar la propuesta.");return;}
  setQuote(json.data);
  setRecipient(json.data?.lead?.email??"");
 }
 useEffect(()=>{void load();},[id]);

 async function save(){
  if(!quote)return;
  setSaving(true);setMessage("");
  const response=await fetch(`/api/admin/commercial/quotes/${id}`,{
   method:"PUT",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({notes:quote.notes||null,items:quote.items.map(item=>({id:item.id,quantity:Number(item.quantity),unit_price:Number(item.unit_price)}))}),
  });
  const json=await response.json().catch(()=>({}));
  setSaving(false);
  if(!response.ok){setMessage(json.message??"No fue posible guardar la propuesta.");return;}
  setQuote(json.data);setMessage("Propuesta actualizada.");
 }

 async function approve(){
  if(!quote||!confirm("¿Aprobar esta propuesta? Después de aprobarla no podrá editarse."))return;
  setSaving(true);setMessage("");
  const response=await fetch(`/api/admin/commercial/quotes/${id}/approve`,{method:"POST"});
  const json=await response.json().catch(()=>({}));
  setSaving(false);
  if(!response.ok){setMessage(json.message??"No fue posible aprobar la propuesta.");return;}
  setQuote(json.data);setMessage("Propuesta aprobada y lista para seguimiento humano.");
 }

 async function sendEmail(){
  if(!quote||quote.status!=="approved"||!recipient.trim())return;
  setSendingMail(true);setMessage("");
  try{
   const response=await fetch(`/api/admin/commercial/quotes/${id}/send`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:recipient.trim()})});
   const json=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(json.message??"No fue posible enviar el correo.");
   setMessage("Propuesta enviada correctamente a "+recipient.trim());setSharing(false);
  }catch(error){setMessage(error instanceof Error?error.message:"Error enviando correo.");}
  finally{setSendingMail(false);}
 }
 const whatsapp=(phone:string)=>{
  const digits=phone.replace(/\D/g,"");
  if(digits.length===10&&digits.startsWith("3"))return "57"+digits;
  if(digits.length===12&&digits.startsWith("57"))return digits;
  return "";
 };

 if(loading)return <div className="mx-auto w-full max-w-5xl py-8 text-sm text-[var(--muted)]">Cargando propuesta…</div>;
 if(!quote)return <div className="mx-auto w-full max-w-5xl py-8 text-sm text-red-700">{message||"Propuesta no encontrada."}</div>;

 const editable=quote.status!=="approved";
 const total=quote.items.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.unit_price),0);

 return <div className="mx-auto w-full max-w-5xl space-y-6">
  <Link href="/dashboard/comercial/propuestas" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium"><ArrowLeft size={16}/>Propuestas</Link>
  <header>
   <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Propuesta comercial</span>
   <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold">{quote.number}</h1><span className={`rounded-full px-3 py-1 text-xs font-semibold ${quote.status==="approved"?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800"}`}>{quote.status==="approved"?"Aprobada":"Pendiente de aprobación"}</span></div>
  </header>

  <section className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-3">
   <div><span className="text-xs text-[var(--muted)]">Cliente</span><strong className="block">{quote.lead.name}</strong></div>
   <div><span className="text-xs text-[var(--muted)]">Email</span><strong className="block break-all">{quote.lead.email}</strong></div>
   <div><span className="text-xs text-[var(--muted)]">WhatsApp</span><strong className="block">{quote.lead.whatsapp}</strong></div>
  </section>

  <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
   <h2 className="font-bold">Detalle</h2>
   <div className="space-y-3">
    {quote.items.map((item,index)=><div key={item.id} className="grid gap-3 rounded-xl border border-[var(--border)] p-4 sm:grid-cols-[1.5fr_.5fr_.7fr_.7fr] sm:items-end">
      <div><span className="text-xs text-[var(--muted)]">Ítem {index+1}</span><strong className="block">{item.description}</strong></div>
      <label className="space-y-1"><span className="text-xs text-[var(--muted)]">Cantidad</span><input disabled={!editable} type="number" min="0.01" step="0.01" value={item.quantity} onChange={e=>setQuote({...quote,items:quote.items.map(x=>x.id===item.id?{...x,quantity:e.target.value}:x)})} className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-transparent px-2 disabled:opacity-60"/></label>
      <label className="space-y-1"><span className="text-xs text-[var(--muted)]">Precio unitario</span><input disabled={!editable} type="number" min="0" step="0.01" value={item.unit_price} onChange={e=>setQuote({...quote,items:quote.items.map(x=>x.id===item.id?{...x,unit_price:e.target.value}:x)})} className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-transparent px-2 disabled:opacity-60"/></label>
      <div><span className="text-xs text-[var(--muted)]">Subtotal</span><strong className="block">{new Intl.NumberFormat("es-CO",{style:"currency",currency:quote.currency||"COP",maximumFractionDigits:0}).format(Number(item.quantity)*Number(item.unit_price))}</strong></div>
    </div>)}
   </div>
   <label className="block space-y-2"><span className="text-sm font-medium">Notas comerciales</span><textarea disabled={!editable} rows={5} value={quote.notes??""} onChange={e=>setQuote({...quote,notes:e.target.value})} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3 disabled:opacity-60"/></label>
   <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
    <div><span className="text-sm text-[var(--muted)]">Total revisado</span><strong className="ml-3 text-xl">{new Intl.NumberFormat("es-CO",{style:"currency",currency:quote.currency||"COP",maximumFractionDigits:0}).format(total)}</strong></div>
    {!editable&&<button type="button" onClick={()=>{setRecipient(quote.lead.email??"");setSharing(true);}} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-semibold text-white"><Share2 size={17}/>Compartir</button>}
    {editable&&<div className="flex gap-2">
      <button disabled={saving} onClick={save} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-4 font-semibold"><Save size={17}/>Guardar</button>
      <button disabled={saving} onClick={approve} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-semibold text-white"><CheckCircle2 size={17}/>Aprobar</button>
    </div>}
   </div>
   {message&&<p className="text-sm font-medium text-[var(--brand)]">{message}</p>}
  </section>
  {sharing&&quote.status==="approved"&&<div className="fixed inset-0 z-[110] flex justify-end bg-black/40" onMouseDown={event=>{if(event.target===event.currentTarget)setSharing(false);}}><section role="dialog" aria-modal="true" aria-label="Compartir propuesta" className="flex h-full w-full max-w-lg flex-col bg-[var(--surface)] p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Compartir propuesta {quote.number}</h2><button aria-label="Cerrar" onClick={()=>setSharing(false)}><X size={22}/></button></div><p className="mt-3 text-sm text-[var(--muted)]">Solo puedes compartir propuestas aprobadas.</p><label className="mt-6 block text-sm font-semibold">Correo del destinatario<input type="email" value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="cliente@empresa.com" className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/></label><button type="button" disabled={sendingMail||!recipient.trim()} onClick={()=>void sendEmail()} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-bold text-white disabled:opacity-50"><Mail size={18}/>{sendingMail?"Enviando…":"Enviar por correo"}</button>{whatsapp(quote.lead.whatsapp??"")?<a target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 font-semibold" href={`https://wa.me/${whatsapp(quote.lead.whatsapp)}?text=${encodeURIComponent(`Hola ${quote.lead.name}, tu propuesta comercial ${quote.number} de Gaspronal ha sido aprobada. Total: ${quote.currency} ${quote.total}. Contacta con nuestro equipo para recibir el detalle.`)}`}><MessageCircle size={18}/>Abrir WhatsApp</a>:<p className="mt-4 text-sm text-[var(--muted)]">WhatsApp no disponible o número colombiano inválido.</p>}<p className="mt-4 text-xs text-[var(--muted)]">El enlace de WhatsApp abre un mensaje preparado; no adjunta el documento de la propuesta.</p></section></div>}
 </div>;
}
