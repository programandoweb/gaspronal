"use client";

import { useEffect, useMemo, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { FiCheckCircle, FiRefreshCw, FiSend, FiUserCheck, FiXCircle } from "react-icons/fi";

type ConversationMessage = {
  id:number;
  direction:"inbound"|"outbound";
  sender_type:"customer"|"agent"|"human"|"system";
  content:string;
  status:string;
  created_at?:string|null;
  sent_at?:string|null;
};

type ConversationSummary = {
  id:number;
  provider_id?:number|null;
  contact_phone?:string|null;
  contact_name?:string|null;
  status:"active"|"waiting_human"|"human_active"|"closed";
  last_message_at?:string|null;
  customer?:{id:number;name:string;email?:string|null;whatsapp?:string|null}|null;
  latest_message?:ConversationMessage|null;
};

type ConversationDetail = ConversationSummary & {
  messages:ConversationMessage[];
};

const statusLabels:Record<ConversationSummary["status"],string> = {
  active:"Claudio atendiendo",
  waiting_human:"Requiere asesor",
  human_active:"Asesor atendiendo",
  closed:"Cerrada",
};

function dateLabel(value?:string|null){
  if(!value)return "";
  return new Intl.DateTimeFormat("es-CO",{
    month:"short",
    day:"numeric",
    hour:"numeric",
    minute:"2-digit",
  }).format(new Date(value));
}

export default function ClaudioWhatsAppConversations(){
  const [conversations,setConversations]=useState<ConversationSummary[]>([]);
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [selected,setSelected]=useState<ConversationDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [reply,setReply]=useState("");
  const [message,setMessage]=useState("");

  async function loadList(silent=false){
    if(!silent)setLoading(true);
    const response=await fetch("/api/admin/agents/claudio/whatsapp-conversations?per_page=100",{cache:"no-store"});
    const json=await response.json().catch(()=>({}));
    if(!silent)setLoading(false);

    if(!response.ok){
      setMessage(json.message??"No fue posible cargar las conversaciones de WhatsApp.");
      return;
    }

    const items:ConversationSummary[]=json.data??[];
    setConversations(items);
    setSelectedId(current=>current??items[0]?.id??null);
  }

  async function loadConversation(id:number,silent=false){
    const response=await fetch(`/api/admin/agents/claudio/whatsapp-conversations/${id}`,{cache:"no-store"});
    const json=await response.json().catch(()=>({}));
    if(!response.ok){
      if(!silent)setMessage(json.message??"No fue posible cargar la conversación.");
      return;
    }
    setSelected(json.data??null);
  }

  useEffect(()=>{
    void loadList();
    const timer=window.setInterval(()=>void loadList(true),5000);
    return ()=>window.clearInterval(timer);
  },[]);

  useEffect(()=>{
    if(!selectedId){setSelected(null);return;}
    void loadConversation(selectedId);
    const timer=window.setInterval(()=>void loadConversation(selectedId,true),3000);
    return ()=>window.clearInterval(timer);
  },[selectedId]);

  async function action(name:"takeover"|"resume"|"close"){
    if(!selectedId||busy)return;
    setBusy(true);
    setMessage("");
    const response=await fetch(`/api/admin/agents/claudio/whatsapp-conversations/${selectedId}/${name}`,{method:"POST"});
    const json=await response.json().catch(()=>({}));
    setBusy(false);

    if(!response.ok){
      setMessage(json.message??"No fue posible cambiar el estado de la conversación.");
      return;
    }

    setSelected(json.data??null);
    await loadList(true);
  }

  async function sendReply(e:React.FormEvent){
    e.preventDefault();
    const text=reply.trim();
    if(!selectedId||!text||busy)return;

    setBusy(true);
    setMessage("");
    const response=await fetch(`/api/admin/agents/claudio/whatsapp-conversations/${selectedId}/messages`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:text}),
    });
    const json=await response.json().catch(()=>({}));
    setBusy(false);

    if(!response.ok){
      setMessage(json.message??"No fue posible enviar el mensaje.");
      return;
    }

    setReply("");
    await Promise.all([loadConversation(selectedId,true),loadList(true)]);
  }

  const activeCount=useMemo(
    ()=>conversations.filter(item=>item.status!=="closed").length,
    [conversations],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <header className="flex flex-col gap-3 border-b border-[var(--border)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FaWhatsapp className="text-xl text-[var(--brand)]" aria-hidden="true"/>
            <h2 className="font-bold">Conversaciones de WhatsApp de Claudio</h2>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Claudio responde automáticamente mientras la conversación esté activa. Puedes tomar el control y devolverla cuando termines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-bold text-[var(--brand)]">
            {activeCount} activas
          </span>
          <button
            type="button"
            onClick={()=>void loadList()}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--border)]"
            aria-label="Actualizar conversaciones"
          >
            <FiRefreshCw className={loading?"animate-spin":""}/>
          </button>
        </div>
      </header>

      <div className="grid min-h-[580px] lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
          {loading&&conversations.length===0&&<p className="p-5 text-sm text-[var(--muted)]">Cargando conversaciones…</p>}
          {!loading&&conversations.length===0&&<div className="p-8 text-center">
            <FaWhatsapp className="mx-auto text-3xl text-[var(--brand)]"/>
            <p className="mt-3 font-semibold">Aún no hay conversaciones.</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Aparecerán aquí cuando un cliente escriba al WhatsApp conectado.</p>
          </div>}

          <div className="max-h-[580px] overflow-y-auto">
            {conversations.map(item=>{
              const selectedRow=item.id===selectedId;
              const title=item.customer?.name||item.contact_name||item.contact_phone||"Cliente";
              return <button
                key={item.id}
                type="button"
                onClick={()=>setSelectedId(item.id)}
                className={`w-full border-b border-[var(--border)] p-4 text-left transition ${selectedRow?"bg-[var(--brand-soft)]":"hover:bg-[var(--app-bg)]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm">{title}</strong>
                    <span className="mt-1 block text-xs text-[var(--muted)]">{item.contact_phone}</span>
                  </div>
                  <span className="shrink-0 text-[11px] text-[var(--muted)]">{dateLabel(item.last_message_at)}</span>
                </div>
                <p className="mt-2 truncate text-sm text-[var(--muted)]">{item.latest_message?.content??"Sin mensajes"}</p>
                <span className="mt-2 inline-flex rounded-full border border-[var(--border)] px-2 py-1 text-[11px] font-semibold">
                  {statusLabels[item.status]}
                </span>
              </button>;
            })}
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          {!selected&&<div className="grid flex-1 place-items-center p-8 text-center text-sm text-[var(--muted)]">
            Selecciona una conversación para revisar el historial.
          </div>}

          {selected&&<>
            <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <strong>{selected.customer?.name||selected.contact_name||selected.contact_phone||"Cliente"}</strong>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {selected.contact_phone} · {statusLabels[selected.status]}
                  {selected.customer?.email?` · ${selected.customer.email}`:""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {["active","waiting_human"].includes(selected.status)&&<button
                  type="button"
                  disabled={busy}
                  onClick={()=>void action("takeover")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--brand)] px-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  <FiUserCheck/>Tomar control
                </button>}
                {selected.status==="human_active"&&<button
                  type="button"
                  disabled={busy}
                  onClick={()=>void action("resume")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-bold disabled:opacity-50"
                >
                  <FiCheckCircle/>Devolver a Claudio
                </button>}
                {selected.status!=="closed"&&<button
                  type="button"
                  disabled={busy}
                  onClick={()=>{if(confirm("¿Cerrar esta conversación?"))void action("close");}}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-bold text-[var(--muted)] disabled:opacity-50"
                >
                  <FiXCircle/>Cerrar
                </button>}
                {selected.status==="closed"&&<button
                  type="button"
                  disabled={busy}
                  onClick={()=>void action("resume")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-bold disabled:opacity-50"
                >
                  <FiCheckCircle/>Reabrir con Claudio
                </button>}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--app-bg)] p-4 sm:p-5">
              {selected.messages.map(item=><div key={item.id} className={`flex ${item.direction==="inbound"?"justify-start":"justify-end"}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[72%] ${item.direction==="inbound"?"border border-[var(--border)] bg-[var(--surface)]":"bg-[var(--brand)] text-white"}`}>
                  <span className={`mb-1 block text-[10px] font-black uppercase tracking-wide ${item.direction==="inbound"?"text-[var(--muted)]":"text-white/70"}`}>
                    {item.sender_type==="customer"?"Cliente":item.sender_type==="human"?"Asesor":item.sender_type==="system"?"Sistema":"Claudio"}
                  </span>
                  <p className="whitespace-pre-wrap">{item.content}</p>
                  <span className={`mt-1 block text-[10px] ${item.direction==="inbound"?"text-[var(--muted)]":"text-white/70"}`}>
                    {dateLabel(item.sent_at||item.created_at)}
                  </span>
                </div>
              </div>)}
            </div>

            {selected.status==="human_active"?<form onSubmit={sendReply} className="flex gap-2 border-t border-[var(--border)] p-4">
              <textarea
                value={reply}
                onChange={event=>setReply(event.target.value)}
                placeholder="Responder como asesor humano…"
                rows={2}
                className="min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm"
              />
              <button
                disabled={busy||!reply.trim()}
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white disabled:opacity-45"
                aria-label="Enviar por WhatsApp"
              >
                <FiSend/>
              </button>
            </form>:<div className="border-t border-[var(--border)] p-4 text-xs text-[var(--muted)]">
              {selected.status==="active"?"Claudio tiene el control automático de esta conversación.":selected.status==="waiting_human"?"Claudio solicitó intervención humana. Toma el control para responder.":"La conversación está cerrada."}
            </div>}
          </>}
        </div>
      </div>

      {message&&<p className="border-t border-[var(--border)] px-5 py-3 text-xs font-medium text-[var(--brand)]">{message}</p>}
    </section>
  );
}
