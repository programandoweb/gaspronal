"use client";

import { useCallback, useEffect, useState } from "react";

type Provider = { id:string;name:string;driver:string;settings:Record<string,unknown>;enabled:boolean };
type Runtime = { id:string;runtime_status:string;phone_number?:string;qr_data_url?:string;last_error?:string };

export default function AgentWhatsAppConnection({agentId}:{agentId:string}){
 const [provider,setProvider]=useState<Provider|null>(null);
 const [runtime,setRuntime]=useState<Runtime|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  try{
   const [p,r]=await Promise.all([
    fetch("/api/admin/communications/providers?per_page=100",{cache:"no-store"}),
    fetch("/api/channels",{cache:"no-store"})
   ]);
   const providers=await p.json();const statuses=await r.json();
   if(!p.ok||!r.ok)throw new Error("No fue posible consultar los canales.");
   const selected=((providers.data ?? []) as Provider[]).find((x: Provider)=>x.driver==="baileys"&&String(x.settings?.agent_id??"claudio")===agentId)??null;
   setProvider(selected);setRuntime(selected?((statuses.data ?? []) as Runtime[]).find((x: Runtime)=>String(x.id)===String(selected.id))??null:null);
  }catch(e){setError(e instanceof Error?e.message:"Error consultando WhatsApp");}
 },[agentId]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>clearInterval(timer);},[refresh]);
 async function updateAutoConnect(value:boolean){
  if(!provider)throw new Error("Proveedor no encontrado.");
  const res=await fetch("/api/admin/communications/providers/"+provider.id,{
   method:"PUT",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({name:provider.name,channel:"whatsapp",driver:"baileys",enabled:provider.enabled,
    is_fallback:false,priority:100,auto_connect:value,settings:provider.settings})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.message??"No fue posible actualizar la reconexión automática.");
 }
 async function action(kind:"create"|"connect"|"disconnect"){
  setBusy(true);setError("");
  try{
   if(kind==="disconnect") await updateAutoConnect(false);
   if(kind==="connect") await updateAutoConnect(true);
   const url=kind==="create"?"/api/admin/communications/providers":`/api/channels/${provider?.id}/${kind}`;
   const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(kind==="create"?{name:"WhatsApp "+agentId,channel:"whatsapp",driver:"baileys",enabled:true,auto_connect:true,is_fallback:false,priority:100,settings:{agent_id:agentId}} :{logout:kind==="disconnect"})});
   const json=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(json.message??"No se pudo actualizar la conexión.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Error de conexión");}
  finally{setBusy(false);}
 }
 const status=runtime?.runtime_status??"disconnected";
 return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
  <h2 className="font-bold">WhatsApp del agente · Baileys</h2>
  <p className="mt-1 text-sm text-[var(--muted)]">Vincula un número con QR. Los mensajes utilizarán las instrucciones y el modelo de este agente.</p>
  <p className="mt-3 text-sm">Estado: <strong>{status}</strong>{runtime?.phone_number?` · ${runtime.phone_number}`:""}</p>
  {status==="qr_pending"&&runtime?.qr_data_url&&<div className="mt-4 w-fit rounded-xl bg-white p-3"><img alt="QR de vinculación WhatsApp" src={runtime.qr_data_url} className="h-56 w-56"/><p className="mt-2 max-w-56 text-xs text-slate-600">WhatsApp → Dispositivos vinculados → Vincular dispositivo.</p></div>}
  {runtime?.last_error&&<p className="mt-2 text-sm text-red-700">{runtime.last_error}</p>}
  <div className="mt-4 flex flex-wrap gap-2">
   {!provider?<button disabled={busy} onClick={()=>void action("create")} className="rounded-xl bg-[var(--brand)] px-4 py-2 font-semibold text-white">Crear WhatsApp</button>:<>
   <button disabled={busy} onClick={()=>void action("connect")} className="rounded-xl bg-[var(--brand)] px-4 py-2 font-semibold text-white">Conectar / generar QR</button>
   <button disabled={busy} onClick={()=>void action("disconnect")} className="rounded-xl border border-[var(--border)] px-4 py-2 font-semibold">Desvincular y generar nuevo QR</button>
   </>}
  </div>
  {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
 </section>;
}
