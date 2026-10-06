"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Bot, CheckCircle2, HelpCircle, KeyRound, LoaderCircle, Pause, Play, PlugZap, Save, Search, Send, ShieldCheck, Square, XCircle } from "lucide-react";
import { use, useEffect, useRef, useState } from "react";
import ClaudioWhatsAppConversations from "@/components/dashboard/ClaudioWhatsAppConversations";
import { connectAgentSocket, type AgentSocket } from "@/lib/agent-socket";

type Agent = { id:string; name:string; role:string };
type Settings = {
  agent_id:string;
  provider:string;
  model:string;
  has_api_key:boolean;
  primary_ai_model_id?:number|null;
  fallback_ai_model_id?:number|null;
};
type AiModelOption = {
  id:number;
  name:string;
  model_identifier:string;
  is_active:boolean;
  provider?:{id:number;name:string;code:string;driver:string;is_active?:boolean}|null;
};
type ChatMessage = { id:string; role:"user"|"assistant"; content:string; error?:boolean; progress?:boolean };
type AgentResponse = {
  requestId:string;
  agent:Agent;
  message:string;
  status:"completed"|"configuration_required";
};
type ResearchState = {
  run:{
    status:"idle"|"running"|"paused"|"stopped"|"completed";
    total_items:number;
    processed_items:number;
    successful_items:number;
    failed_items:number;
    last_error?:string|null;
    current_item?:{id:number;name:string;reference?:string|null}|null;
  };
  pending_items:number;
  completed_items:number;
};
type LuciaRun = {
  uuid:string;
  topic:string;
  status:string;
  source_urls:string[];
  sources_collected:number;
  sources_total:number;
  sources:Array<{url?:string|null;title?:string|null}>;
  images_generated:number;
  post_id?:number|null;
  error?:string|null;
  updated_at?:string|null;
};
type UnansweredQuestion = {
  id:number;
  question:string;
  times_asked:number;
  status:"pending"|"answered"|"discarded";
  last_asked_at?:string|null;
  created_at:string;
};

export default function AgentChatPage({ params }:{ params:Promise<{id:string}> }) {
  const { id } = use(params);
  const [agent,setAgent]=useState<Agent|null>(null);
  const [settings,setSettings]=useState<Settings|null>(null);
  const [aiModels,setAiModels]=useState<AiModelOption[]>([]);
  const [primaryAiModelId,setPrimaryAiModelId]=useState("");
  const [fallbackAiModelId,setFallbackAiModelId]=useState("");
  const [saving,setSaving]=useState(false);
  const [settingsMessage,setSettingsMessage]=useState("");
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [draft,setDraft]=useState("");
  const [sending,setSending]=useState(false);
  const [transport,setTransport]=useState<"connecting"|"socket.io"|"rest">("connecting");
  const [socketMessage,setSocketMessage]=useState("");
  const [research,setResearch]=useState<ResearchState|null>(null);
  const [researchBusy,setResearchBusy]=useState(false);
  const [researchMessage,setResearchMessage]=useState("");
  const [luciaRun,setLuciaRun]=useState<LuciaRun|null>(null);
  const [unanswered,setUnanswered]=useState<UnansweredQuestion[]>([]);
  const [unansweredLoading,setUnansweredLoading]=useState(false);
  const [unansweredMessage,setUnansweredMessage]=useState("");
  const [answers,setAnswers]=useState<Record<number,string>>({});
  const socketRef=useRef<AgentSocket|null>(null);
  const bottomRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    async function load(){
      const [agentsResponse,settingsResponse,modelsResponse]=await Promise.all([
        fetch("/api/agents",{cache:"no-store"}),
        fetch(`/api/agents/${id}/settings`,{cache:"no-store"}),
        fetch("/api/admin/ai/agent-models",{cache:"no-store"}),
      ]);
      const agentsJson=await agentsResponse.json().catch(()=>({}));
      const settingsJson=await settingsResponse.json().catch(()=>({}));
      const modelsJson=await modelsResponse.json().catch(()=>({}));

      const found=(agentsJson.data??[]).find((item:Agent)=>item.id===id)??null;
      setAgent(found);

      if(modelsResponse.ok){
        setAiModels(modelsJson.data??[]);
      }

      if(settingsResponse.ok&&settingsJson.data){
        setSettings(settingsJson.data);
        setPrimaryAiModelId(settingsJson.data.primary_ai_model_id?String(settingsJson.data.primary_ai_model_id):"");
        setFallbackAiModelId(settingsJson.data.fallback_ai_model_id?String(settingsJson.data.fallback_ai_model_id):"");
      }
    }
    void load();
  },[id]);

  useEffect(()=>{
    let active=true;

    async function connect(){
      try{
        const tokenResponse=await fetch("/api/agents/socket-token",{cache:"no-store"});
        const tokenJson=await tokenResponse.json().catch(()=>({}));
        if(!tokenResponse.ok||!tokenJson.realtime_url){
          if(active){
            setTransport("rest");
            setSocketMessage(tokenJson.realtime_url?"No fue posible autenticar Socket.IO.":"Socket.IO público no configurado; usando REST.");
          }
          return;
        }

        const socket=await connectAgentSocket(tokenJson.realtime_url,tokenJson.token);
        if(!active){socket.disconnect();return;}
        socketRef.current=socket;

        socket.on("connect",()=>{
          if(!active)return;
          setTransport("socket.io");
          setSocketMessage("Conectado en tiempo real.");
        });
        socket.on("disconnect",()=>{
          if(!active)return;
          setTransport("rest");
          setSocketMessage("Socket.IO desconectado; REST fallback activo.");
        });
        socket.on("connect_error",()=>{
          if(!active)return;
          setTransport("rest");
          setSocketMessage("Socket.IO no disponible; REST fallback activo.");
        });
        socket.on("agent:progress",(payload:{requestId?:string;agentId?:string;message?:string})=>{
          const progressMessage=payload?.message;
          if(!active||typeof progressMessage!=="string"||!progressMessage.trim())return;
          setMessages(current=>[...current,{
            id:crypto.randomUUID(),
            role:"assistant",
            content:progressMessage,
            progress:true,
          }]);
        });
        socket.on("agent:response",(response:AgentResponse)=>{
          if(!active)return;
          setMessages(current=>[...current,{id:crypto.randomUUID(),role:"assistant",content:response.message}]);
          setSending(false);
        });
        socket.on("agent:error",(payload:{message?:string})=>{
          if(!active)return;
          setMessages(current=>[...current,{id:crypto.randomUUID(),role:"assistant",content:payload?.message??"Error del agente.",error:true}]);
          setSending(false);
        });
      }catch{
        if(active){
          setTransport("rest");
          setSocketMessage("Socket.IO no disponible; REST fallback activo.");
        }
      }
    }

    void connect();
    return ()=>{
      active=false;
      socketRef.current?.disconnect();
      socketRef.current=null;
    };
  },[id]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,sending]);

  useEffect(()=>{
    if(id!=="lucia")return;
    let active=true;

    async function loadLuciaRun(){
      const response=await fetch("/api/admin/agents/lucia/content-run",{cache:"no-store"});
      const json=await response.json().catch(()=>({}));
      if(active&&response.ok)setLuciaRun(json.data??null);
    }

    void loadLuciaRun();
    const timer=window.setInterval(()=>void loadLuciaRun(),1500);
    return ()=>{active=false;window.clearInterval(timer);};
  },[id]);

  useEffect(()=>{
    if(id!=="jorge")return;
    let active=true;

    async function loadResearch(){
      const response=await fetch("/api/admin/agents/jorge/research",{cache:"no-store"});
      const json=await response.json().catch(()=>({}));
      if(active&&response.ok)setResearch(json.data);
    }

    void loadResearch();
    const timer=window.setInterval(()=>void loadResearch(),5000);
    return ()=>{active=false;window.clearInterval(timer);};
  },[id]);

  useEffect(()=>{
    if(id!=="claudio")return;
    let active=true;

    async function loadUnanswered(){
      setUnansweredLoading(true);
      const response=await fetch("/api/admin/agents/claudio/unanswered-questions?status=pending&per_page=50",{cache:"no-store"});
      const json=await response.json().catch(()=>({}));
      if(!active)return;
      setUnansweredLoading(false);
      if(response.ok){
        setUnanswered(json.data??[]);
      }else{
        setUnansweredMessage(json.message??"No fue posible cargar las preguntas pendientes.");
      }
    }

    void loadUnanswered();
    return ()=>{active=false;};
  },[id]);

  async function researchAction(action:"play"|"pause"|"stop"){
    setResearchBusy(true);
    setResearchMessage("");
    const response=await fetch(`/api/admin/agents/jorge/research/${action}`,{method:"POST"});
    const json=await response.json().catch(()=>({}));
    setResearchBusy(false);
    if(!response.ok){
      setResearchMessage(json.message??"No fue posible cambiar el estado de Jorge.");
      return;
    }
    setResearch(json.data);
    setResearchMessage(action==="play"?"Investigación iniciada.":action==="pause"?"Investigación pausada.":"Investigación detenida.");
  }

  async function refreshUnanswered(){
    const response=await fetch("/api/admin/agents/claudio/unanswered-questions?status=pending&per_page=50",{cache:"no-store"});
    const json=await response.json().catch(()=>({}));
    if(response.ok)setUnanswered(json.data??[]);
  }

  async function answerQuestion(question:UnansweredQuestion){
    const answer=(answers[question.id]??"").trim();
    if(!answer)return;

    setUnansweredMessage("");
    const response=await fetch(`/api/admin/agents/claudio/unanswered-questions/${question.id}/answer`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({answer,category:"preguntas frecuentes"}),
    });
    const json=await response.json().catch(()=>({}));

    if(!response.ok){
      setUnansweredMessage(json.message??"No fue posible guardar la respuesta.");
      return;
    }

    setAnswers(current=>{
      const next={...current};
      delete next[question.id];
      return next;
    });
    setUnansweredMessage("Respuesta incorporada al RAG de Claudio.");
    await refreshUnanswered();
  }

  async function discardQuestion(question:UnansweredQuestion){
    if(!confirm("¿Descartar esta pregunta del aprendizaje de Claudio?"))return;

    setUnansweredMessage("");
    const response=await fetch(`/api/admin/agents/claudio/unanswered-questions/${question.id}/discard`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({reason:"Descartada desde el perfil de Claudio."}),
    });
    const json=await response.json().catch(()=>({}));

    if(!response.ok){
      setUnansweredMessage(json.message??"No fue posible descartar la pregunta.");
      return;
    }

    setUnansweredMessage("Pregunta descartada.");
    await refreshUnanswered();
  }

  async function saveSettings(e:React.FormEvent){
    e.preventDefault();
    setSaving(true);
    setSettingsMessage("");

    const payload:Record<string,unknown>={
      primary_ai_model_id:primaryAiModelId?Number(primaryAiModelId):null,
      fallback_ai_model_id:fallbackAiModelId?Number(fallbackAiModelId):null,
    };

    const response=await fetch(`/api/agents/${id}/settings`,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload),
    });
    const json=await response.json().catch(()=>({}));
    setSaving(false);

    if(!response.ok){
      setSettingsMessage(json.message??"No fue posible guardar la configuración.");
      return;
    }

    setSettings(json.data);
    setSettingsMessage("Modelos del agente actualizados.");
  }

  async function send(e:React.FormEvent){
    e.preventDefault();
    const message=draft.trim();
    if(!message||sending)return;

    const requestId=crypto.randomUUID();
    setMessages(current=>[...current,{id:requestId,role:"user",content:message}]);
    setDraft("");
    setSending(true);

    const socket=socketRef.current;
    if(transport==="socket.io"&&socket?.connected){
      socket.emit("agent:message",{agentId:id,message,requestId,history:messages.filter(item=>!item.progress).map(({role,content})=>({role,content}))});
      return;
    }

    try{
      const response=await fetch(`/api/agents/${id}/messages`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message,requestId,history:messages.filter(item=>!item.progress).map(({role,content})=>({role,content}))}),
      });
      const json=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(json.message??"No fue posible consultar el agente.");
      const result:AgentResponse=json.data;
      setMessages(current=>[...current,{id:crypto.randomUUID(),role:"assistant",content:result.message}]);
    }catch(error){
      setMessages(current=>[...current,{id:crypto.randomUUID(),role:"assistant",content:error instanceof Error?error.message:"Error consultando el agente.",error:true}]);
    }finally{
      setSending(false);
    }
  }

  const name=agent?.name??id.charAt(0).toUpperCase()+id.slice(1);

  return <div className="w-full max-w-none space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]"><Bot size={24}/></div>
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Agente Gaspronal</span>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{name}</h1>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${transport==="socket.io"?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-amber-200 bg-amber-50 text-amber-800"}`}>
                <PlugZap size={14}/>{transport==="connecting"?"Conectando…":transport==="socket.io"?"Socket.IO":"REST fallback"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Link href="/dashboard/agentes" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium">
        <ArrowLeft size={16}/>Agentes
      </Link>
    </header>

    <section className={id==="lucia"?"grid gap-6":"grid gap-6 xl:grid-cols-[1.55fr_.75fr]"}>
      <div className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-bold">Chat con {name}</h2>
          {agent?.role&&<p className="mt-1 text-sm text-[var(--muted)]">{agent.role}</p>}
          {socketMessage&&<p className="mt-1 text-xs text-[var(--muted)]">{socketMessage}</p>}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!messages.length&&<div className="mx-auto max-w-md py-16 text-center">
            <Bot size={34} className="mx-auto text-[var(--brand)]"/>
            <h3 className="mt-3 font-bold">Inicia una conversación</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{id==="lucia"?"Lucía trabaja con el Browser Collector conectado directamente a su flujo editorial.":settings?.primary_ai_model_id?"El modelo principal seleccionado está listo para este agente.":settings?.has_api_key?"Gemini está configurado para este agente.":"Configura primero un modelo principal en el panel lateral."}</p>
          </div>}
          {messages.map(message=><div key={message.id} className={`flex ${message.role==="user"?"justify-end":"justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${message.role==="user"?"bg-[var(--brand)] text-white":message.error?"border border-red-200 bg-red-50 text-red-800":message.progress?"border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]":"bg-[var(--app-bg)] text-[var(--app-fg)]"}`}>
              {message.progress?<span className="inline-flex items-start gap-2"><LoaderCircle size={15} className="mt-1 shrink-0 animate-spin text-[var(--brand)]"/><span>{message.content}</span></span>:message.content}
            </div>
          </div>)}
          {sending&&id!=="lucia"&&<div className="flex justify-start"><div className="inline-flex items-center gap-2 rounded-2xl bg-[var(--app-bg)] px-4 py-3 text-sm text-[var(--muted)]"><LoaderCircle size={16} className="animate-spin"/>{name} está respondiendo…</div></div>}
          <div ref={bottomRef}/>
        </div>

        <form onSubmit={send} className="border-t border-[var(--border)] p-4">
          {id==="lucia"&&<div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={()=>setDraft("Haz una prueba completa de investigación para crear un nuevo post de Gaspronal. Usa la extensión recolectora conectada por WebSocket para visitar las fuentes web configuradas, identifica un tema útil y relevante para nuestros clientes, recopila información verificable y sus URLs de origen, y con esa investigación prepara un borrador completo de post. Genera también las 5 imágenes relacionadas con el tema siguiendo el flujo secuencial definido: generar una imagen, guardarla y registrar su trazabilidad antes de continuar con la siguiente. No publiques el post: déjalo como borrador para revisión.")}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-sm font-semibold text-[var(--brand)] transition hover:opacity-85"
            >
              <Search size={16}/>Prueba de investigación para post
            </button>
            <span className="text-xs text-[var(--muted)]">Carga la instrucción en el textarea; tú decides cuándo enviarla.</span>
          </div>}
          <div className="flex gap-2">
            <textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit();}}} placeholder={`Escribe a ${name}…`} rows={2} className="min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm"/>
            <button disabled={sending||!draft.trim()} className="inline-flex min-h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white disabled:opacity-45" aria-label="Enviar mensaje"><Send size={18}/></button>
          </div>
        </form>
      </div>

      <aside className="space-y-5">
        {id==="lucia"&&<section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div>
            <div className="flex items-center gap-2"><Search size={18} className="text-[var(--brand)]"/><h2 className="font-bold">Proceso editorial en vivo</h2></div>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Seguimiento real de la corrida, incluso cuando el chat está usando REST fallback.</p>
          </div>

          {!luciaRun?<div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">Aún no hay una corrida registrada.</div>:<>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--app-bg)] p-3"><span className="block text-xs text-[var(--muted)]">Estado</span><strong className="mt-1 block capitalize">{luciaRun.status.replaceAll("_"," ")}</strong></div>
              <div className="rounded-xl bg-[var(--app-bg)] p-3"><span className="block text-xs text-[var(--muted)]">Fuentes</span><strong className="mt-1 block">{luciaRun.sources_collected}/{luciaRun.sources_total}</strong></div>
              <div className="rounded-xl bg-[var(--app-bg)] p-3"><span className="block text-xs text-[var(--muted)]">Imágenes</span><strong className="mt-1 block">{luciaRun.images_generated}/5</strong></div>
              <div className="rounded-xl bg-[var(--app-bg)] p-3"><span className="block text-xs text-[var(--muted)]">Post</span><strong className="mt-1 block">{luciaRun.post_id??"Pendiente"}</strong></div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Fuentes recolectadas</span>
              {luciaRun.sources.length===0?<p className="text-sm text-[var(--muted)]">Esperando que la extensión entregue la primera fuente…</p>:luciaRun.sources.map((source,index)=><div key={source.url??index} className="rounded-xl border border-[var(--border)] p-3">
                <strong className="block truncate text-sm">{source.title||`Fuente ${index+1}`}</strong>
                <span className="mt-1 block truncate text-xs text-[var(--muted)]">{source.url}</span>
              </div>)}
            </div>

            {luciaRun.error&&<p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">{luciaRun.error}</p>}
          </>}
        </section>}
        {id==="claudio"&&<section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><HelpCircle size={18} className="text-[var(--brand)]"/><h2 className="font-bold">Preguntas pendientes del RAG</h2></div>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Preguntas reales que Claudio no respondió por falta de evidencia. Respóndelas para entrenar su base de conocimiento o descártalas.</p>
            </div>
            <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-bold text-[var(--brand)]">{unanswered.length}</span>
          </div>

          {unansweredLoading&&<p className="text-sm text-[var(--muted)]">Cargando preguntas…</p>}
          {!unansweredLoading&&unanswered.length===0&&<div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center">
            <BookOpen size={24} className="mx-auto text-[var(--brand)]"/>
            <p className="mt-2 text-sm font-medium">No hay preguntas pendientes.</p>
          </div>}

          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {unanswered.map(question=><article key={question.id} className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-6">{question.question}</p>
                <span className="shrink-0 rounded-full bg-[var(--app-bg)] px-2 py-1 text-[11px] font-bold text-[var(--muted)]">{question.times_asked}×</span>
              </div>

              <textarea
                value={answers[question.id]??""}
                onChange={e=>setAnswers(current=>({...current,[question.id]:e.target.value}))}
                placeholder="Escribe la respuesta verificada que Claudio podrá utilizar…"
                rows={4}
                className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!(answers[question.id]??"").trim()}
                  onClick={()=>void answerQuestion(question)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-45"
                >
                  <CheckCircle2 size={16}/>Guardar en RAG
                </button>
                <button
                  type="button"
                  onClick={()=>void discardQuestion(question)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--muted)]"
                >
                  <XCircle size={16}/>Descartar
                </button>
              </div>
            </article>)}
          </div>

          {unansweredMessage&&<p className="text-xs font-medium text-[var(--brand)]">{unansweredMessage}</p>}
        </section>}

        {id==="jorge"&&<section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex items-center gap-2"><Search size={18} className="text-[var(--brand)]"/><h2 className="font-bold">Investigación del catálogo</h2></div>
          <p className="text-sm leading-6 text-[var(--muted)]">Jorge recorre uno a uno los productos de la web oficial de Gaspronal, recupera contenido, SEO, metatags e imágenes y los guarda localmente.</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[var(--app-bg)] p-3"><span className="block text-xs text-[var(--muted)]">Estado</span><strong className="mt-1 block capitalize">{research?.run.status??"cargando"}</strong></div>
            <div className="rounded-xl bg-[var(--app-bg)] p-3"><span className="block text-xs text-[var(--muted)]">Progreso</span><strong className="mt-1 block">{research?.run.processed_items??0} / {research?.run.total_items??0}</strong></div>
            <div className="rounded-xl bg-[var(--app-bg)] p-3"><span className="block text-xs text-[var(--muted)]">Completados</span><strong className="mt-1 block">{research?.run.successful_items??0}</strong></div>
            <div className="rounded-xl bg-[var(--app-bg)] p-3"><span className="block text-xs text-[var(--muted)]">Fallidos</span><strong className="mt-1 block">{research?.run.failed_items??0}</strong></div>
          </div>

          {research&&research.run.total_items>0&&<div className="h-2 overflow-hidden rounded-full bg-[var(--app-bg)]"><div className="h-full bg-[var(--brand)] transition-all" style={{width:`${Math.min(100,Math.round((research.run.processed_items/research.run.total_items)*100))}%`}}/></div>}

          {research?.run.current_item&&<div className="rounded-xl border border-[var(--border)] p-3 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Producto actual</span>
            <strong className="mt-1 block">{research.run.current_item.name}</strong>
          </div>}

          <div className="grid grid-cols-3 gap-2">
            <button type="button" disabled={researchBusy||research?.run.status==="running"} onClick={()=>void researchAction("play")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-45"><Play size={16}/>Play</button>
            <button type="button" disabled={researchBusy||research?.run.status!=="running"} onClick={()=>void researchAction("pause")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold disabled:opacity-45"><Pause size={16}/>Pausa</button>
            <button type="button" disabled={researchBusy||!["running","paused"].includes(research?.run.status??"")} onClick={()=>void researchAction("stop")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-45"><Square size={16}/>Stop</button>
          </div>

          {research?.run.last_error&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{research.run.last_error}</p>}
          {researchMessage&&<p className="text-xs font-medium text-[var(--brand)]">{researchMessage}</p>}
        </section>}

        {id!=="lucia"&&<form onSubmit={saveSettings} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex items-center gap-2"><KeyRound size={18} className="text-[var(--brand)]"/><h2 className="font-bold">Modelo de IA</h2></div>
          <p className="text-sm leading-6 text-[var(--muted)]">
            El agente intenta primero el modelo principal. Si falla, utiliza automáticamente el fallback.
          </p>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Modelo principal</span>
            <select
              value={primaryAiModelId}
              onChange={e=>{
                setPrimaryAiModelId(e.target.value);
                if(e.target.value===fallbackAiModelId)setFallbackAiModelId("");
              }}
              className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"
            >
              <option value="">Selecciona un modelo</option>
              {aiModels.map(item=><option key={item.id} value={item.id}>
                {item.name} · {item.provider?.name??"Sin proveedor"} · {item.model_identifier}
              </option>)}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Modelo fallback</span>
            <select
              value={fallbackAiModelId}
              onChange={e=>setFallbackAiModelId(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"
            >
              <option value="">Sin fallback</option>
              {aiModels.filter(item=>String(item.id)!==primaryAiModelId).map(item=><option key={item.id} value={item.id}>
                {item.name} · {item.provider?.name??"Sin proveedor"} · {item.model_identifier}
              </option>)}
            </select>
          </label>

          <div className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-3 text-xs leading-5 text-[var(--muted)]">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--brand)]"/>
            Las credenciales pertenecen al proveedor central. El agente no almacena API keys propias.
          </div>

          <Link href="/dashboard/ia" className="inline-flex text-sm font-semibold text-[var(--brand)] hover:underline">
            Administrar proveedores y modelos
          </Link>

          <button disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-semibold text-white disabled:opacity-50"><Save size={17}/>{saving?"Guardando…":"Guardar modelos"}</button>

          {settingsMessage&&<p className="text-xs leading-5 text-[var(--muted)]">{settingsMessage}</p>}
        </form>}
      </aside>
    </section>

    {id==="claudio"&&<ClaudioWhatsAppConversations/>}
  </div>;
}
