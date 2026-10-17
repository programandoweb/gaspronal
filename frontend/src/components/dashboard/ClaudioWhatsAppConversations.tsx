"use client";

import { useEffect, useMemo, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";

type ConversationSummary = {
  id:number;
  contact_phone?:string|null;
  contact_name?:string|null;
  status:"active"|"waiting_human"|"human_active"|"closed";
  last_message_at?:string|null;
  customer?:{id:number;name:string}|null;
  latest_message?:{content:string}|null;
};

const statusLabels:Record<ConversationSummary["status"],string> = {
  active:"Claudio atendiendo",waiting_human:"Requiere asesor",human_active:"Asesor atendiendo",closed:"Cerrada",
};

function dateLabel(value?:string|null){
  if(!value)return "";
  return new Intl.DateTimeFormat("es-CO",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value));
}

export default function ClaudioWhatsAppConversations({ onOpenConversation }:{ onOpenConversation:(conversationId:number)=>void }){
  const [conversations,setConversations]=useState<ConversationSummary[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");

  async function loadList(silent=false){
    if(!silent)setLoading(true);
    const response=await fetch("/api/admin/agents/claudio/whatsapp-conversations?per_page=100",{cache:"no-store"});
    const json=await response.json().catch(()=>({}));
    if(!silent)setLoading(false);
    if(!response.ok){setMessage(json.message??"No fue posible cargar las conversaciones de WhatsApp.");return;}
    setConversations(json.data??[]);
  }

  useEffect(()=>{
    void loadList();
    const timer=window.setInterval(()=>void loadList(true),5000);
    return ()=>window.clearInterval(timer);
  },[]);

  const activeCount=useMemo(()=>conversations.filter(item=>item.status!=="closed").length,[conversations]);

  return <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
    <header className="flex flex-col gap-3 border-b border-[var(--border)] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><FaWhatsapp className="text-xl text-[var(--brand)]" aria-hidden="true"/><h2 className="font-bold">Conversaciones de WhatsApp de Claudio</h2></div><p className="mt-1 text-sm text-[var(--muted)]">Selecciona una conversación para abrir su historial y gestionar la atención.</p></div>
      <div className="flex items-center gap-2"><span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-bold text-[var(--brand)]">{activeCount} activas</span><button type="button" onClick={()=>void loadList()} className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--border)]" aria-label="Actualizar conversaciones"><FiRefreshCw className={loading?"animate-spin":""}/></button></div>
    </header>
    {loading&&conversations.length===0&&<p className="p-5 text-sm text-[var(--muted)]">Cargando conversaciones…</p>}
    {!loading&&conversations.length===0&&<div className="p-10 text-center"><FaWhatsapp className="mx-auto text-3xl text-[var(--brand)]"/><p className="mt-3 font-semibold">Aún no hay conversaciones.</p><p className="mt-1 text-sm text-[var(--muted)]">Aparecerán aquí cuando un cliente escriba al WhatsApp conectado.</p></div>}
    <div className="divide-y divide-[var(--border)]">
      {conversations.map(item=>{const title=item.customer?.name||item.contact_name||item.contact_phone||"Cliente";return <button key={item.id} type="button" onClick={()=>onOpenConversation(item.id)} className="w-full p-4 text-left transition hover:bg-[var(--app-bg)] sm:px-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{title}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{item.contact_phone}</span></div><span className="shrink-0 text-[11px] text-[var(--muted)]">{dateLabel(item.last_message_at)}</span></div><p className="mt-2 truncate text-sm text-[var(--muted)]">{item.latest_message?.content??"Sin mensajes"}</p><span className="mt-2 inline-flex rounded-full border border-[var(--border)] px-2 py-1 text-[11px] font-semibold">{statusLabels[item.status]}</span></button>;})}
    </div>
    {message&&<p className="border-t border-[var(--border)] px-5 py-3 text-xs font-medium text-[var(--brand)]">{message}</p>}
  </section>;
}
