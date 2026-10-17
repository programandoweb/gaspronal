"use client";

import { Bot, ChevronUp, GraduationCap, LoaderCircle, Menu, MessageCircle, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { connectAgentSocket, type AgentSocket } from "@/lib/agent-socket";
import ClaudioTrainingPanel from "./ClaudioTrainingPanel";

type Message = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  request_id?: string | null;
  created_at?: string | null;
};

type SessionSummary = {
  id: number;
  agent_id: string;
  title: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
};

type Session = SessionSummary & { messages: Message[] };

type AgentResponse = {
  requestId: string;
  agent: { id: string };
  message: string;
  status: "completed" | "configuration_required";
};

function dateLabel(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-CO", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function ClaudioAdminChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [canTrain, setCanTrain] = useState(false);
  const [training, setTraining] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [transport, setTransport] = useState<"connecting" | "socket.io" | "rest">("connecting");
  const [transportMessage, setTransportMessage] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<AgentSocket | null>(null);
  const activeRequestRef = useRef<string | null>(null);
  const activeSessionRef = useRef<number | null>(null);

  async function loadSessions(selectLatest = true) {
    setLoading(true);
    const response = await fetch("/api/admin/agents/claudio/sessions?per_page=100", { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(json.message ?? "No fue posible cargar el historial de chats.");
      return;
    }
    const items: SessionSummary[] = json.data ?? [];
    setSessions(items);
    if (selectLatest && !session && items[0]) await selectSession(items[0].id);
  }

  async function selectSession(id: number) {
    setError("");
    const response = await fetch(`/api/admin/agents/claudio/sessions/${id}`, { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json.message ?? "No fue posible abrir este chat.");
      return;
    }
    setSession(json.data ?? null);
    setSidebarOpen(false);
  }

  async function newSession() {
    if (creating) return;
    setCreating(true);
    setError("");
    const response = await fetch("/api/admin/agents/claudio/sessions", { method: "POST" });
    const json = await response.json().catch(() => ({}));
    setCreating(false);
    if (!response.ok) {
      setError(json.message ?? "No fue posible crear una nueva conversación.");
      return;
    }
    const created: Session = json.data;
    setSession(created);
    setSessions(current => [created, ...current.filter(item => item.id !== created.id)]);
    setSidebarOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    const currentSession = session;
    if (!currentSession) {
      await newSession();
      return;
    }

    const requestId = crypto.randomUUID();
    setSending(true);
    setError("");
    setDraft("");

    const persisted = await fetch(`/api/admin/agents/claudio/sessions/${currentSession.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, request_id: requestId }),
    });
    const persistedJson = await persisted.json().catch(() => ({}));
    if (!persisted.ok) {
      setSending(false);
      setDraft(content);
      setError(persistedJson.message ?? "No fue posible guardar tu mensaje.");
      return;
    }

    const history = [...currentSession.messages, { role: "user" as const, content }]
      .filter(item => item.role === "user" || item.role === "assistant")
      .map(item => ({ role: item.role as "user" | "assistant", content: item.content }));

    activeRequestRef.current = requestId;
    activeSessionRef.current = currentSession.id;

    const socket = socketRef.current;
    if (transport === "socket.io" && socket?.connected) {
      socket.emit("agent:message", {
        agentId: "claudio",
        message: content,
        requestId,
        sessionId: currentSession.id,
        history,
      });
      return;
    }

    try {
      const response = await fetch("/api/agents/claudio/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, requestId, sessionId: currentSession.id, history }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message ?? "No fue posible obtener la respuesta de Claudio.");
      await Promise.all([selectSession(currentSession.id), loadSessions(false)]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible obtener la respuesta de Claudio.");
      await selectSession(currentSession.id);
    } finally {
      activeRequestRef.current = null;
      activeSessionRef.current = null;
      setSending(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void loadSessions();
    window.setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;

    async function connect() {
      try {
        const tokenResponse = await fetch("/api/agents/socket-token", { cache: "no-store" });
        const tokenJson = await tokenResponse.json().catch(() => ({}));
        if (!tokenResponse.ok || !tokenJson.realtime_url || !tokenJson.token) {
          if (active) {
            setTransport("rest");
            setTransportMessage(tokenJson.message ?? "Socket.IO no está disponible; REST fallback activo.");
          }
          return;
        }

        const socket = await connectAgentSocket(tokenJson.realtime_url, tokenJson.token);
        if (!active) {
          socket.disconnect();
          return;
        }
        socketRef.current = socket;

        socket.on("connect", () => {
          if (!active) return;
          setTransport("socket.io");
          setTransportMessage("Conectado en tiempo real.");
        });
        socket.on("disconnect", () => {
          if (!active) return;
          setTransport("rest");
          setTransportMessage("Socket.IO desconectado; REST fallback activo.");
        });
        socket.on("connect_error", () => {
          if (!active) return;
          setTransport("rest");
          setTransportMessage("Socket.IO no disponible; REST fallback activo.");
        });
        socket.on("agent:response", (response: AgentResponse) => {
          if (!active || response.agent?.id !== "claudio" || response.requestId !== activeRequestRef.current) return;
          const sessionId = activeSessionRef.current;
          activeRequestRef.current = null;
          activeSessionRef.current = null;
          setSending(false);
          if (sessionId) void Promise.all([selectSession(sessionId), loadSessions(false)]);
        });
        socket.on("agent:error", (payload: { message?: string }) => {
          if (!active || !activeRequestRef.current) return;
          const sessionId = activeSessionRef.current;
          activeRequestRef.current = null;
          activeSessionRef.current = null;
          setSending(false);
          setError(payload?.message ?? "No fue posible obtener la respuesta de Claudio.");
          if (sessionId) void selectSession(sessionId);
        });
      } catch {
        if (active) {
          setTransport("rest");
          setTransportMessage("Socket.IO no disponible; REST fallback activo.");
        }
      }
    }

    void connect();
    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
      activeRequestRef.current = null;
      activeSessionRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) { setTraining(false); return; }
    let alive = true;
    void fetch("/api/admin/agents/claudio/training", { cache: "no-store" }).then(r => {
      if (alive) setCanTrain(r.ok);
    }).catch(() => { if (alive) setCanTrain(false); });
    return () => { alive = false; };
  }, [open]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [session?.messages.length, sending]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return <section role="dialog" aria-modal="true" aria-label="Chats con Claudio" className="fixed inset-0 z-[100] flex bg-white shadow-2xl">
    <aside className={`${training ? "hidden" : (sidebarOpen ? "flex sm:flex" : "hidden sm:flex")} absolute inset-0 z-10 w-full flex-col bg-white sm:static sm:max-w-64 sm:shrink-0 sm:border-r sm:border-[var(--border)]`}>
      <header className="border-b border-[var(--border)] p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><MessageCircle size={20}/></span><div><h2 className="font-bold">Chats con Claudio</h2><p className="text-xs text-[var(--muted)]">Historial privado del agente</p></div></div><button type="button" onClick={onClose} aria-label="Cerrar drawer" className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--app-bg)] lg:hidden"><X size={20}/></button></div>
        <button type="button" onClick={() => void newSession()} disabled={creating} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white disabled:opacity-50"><Plus size={18}/>{creating ? "Creando…" : "Nueva sesión"}</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && sessions.length === 0 ? <p className="p-4 text-sm text-[var(--muted)]">Cargando conversaciones…</p> : null}
        {!loading && sessions.length === 0 ? <div className="p-6 text-center text-sm text-[var(--muted)]"><Bot className="mx-auto text-[var(--brand)]" size={28}/><p className="mt-3">Aún no hay sesiones.</p><p className="mt-1 text-xs">Crea una conversación para hablar con Claudio.</p></div> : null}
        {sessions.map(item => <button key={item.id} type="button" onClick={() => void selectSession(item.id)} className={`mb-1 w-full truncate rounded-xl px-3 py-2 text-left text-sm transition ${session?.id === item.id ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]" : "hover:bg-[var(--app-bg)]"}`}><strong className="block truncate">{item.title || "Nueva conversación"}</strong><span className="mt-0.5 block text-[10px] text-[var(--muted)]">{dateLabel(item.last_message_at || item.created_at)}</span></button>)}
      </div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-white px-4 py-3 sm:px-5"><div className="flex min-w-0 items-center gap-2"><button type="button" onClick={() => setSidebarOpen(value => !value)} aria-label="Conversaciones" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-[var(--app-fg)] hover:bg-[var(--app-bg)]"><Menu size={20}/></button><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-white"><Bot size={18}/></span><div className="min-w-0"><h2 className="truncate font-bold leading-tight">{training ? "Entrenamiento de Claudio" : "Claudio"}</h2><p className="truncate text-xs text-[var(--muted)]">Asesor virtual de Gaspronal{!training && transportMessage ? ` · ${transport === "socket.io" ? "En tiempo real" : transport === "connecting" ? "Conectando" : "REST"}` : ""}</p></div></div><div className="flex shrink-0 items-center gap-1 sm:gap-2">{canTrain && <button type="button" role="switch" aria-checked={training} onClick={() => setTraining(value => !value)} className={`inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold transition ${training ? "bg-orange-100 text-orange-800" : "text-[var(--muted)] hover:bg-[var(--app-bg)]"}`}><GraduationCap size={16}/><span className="hidden sm:inline">Entrenamiento</span><span className={`relative h-4 w-7 rounded-full ${training ? "bg-[var(--brand)]" : "bg-slate-300"}`}><span className={`absolute top-0.5 size-3 rounded-full bg-white transition-transform ${training ? "translate-x-3.5" : "translate-x-0.5"}`}/></span></button>}<button type="button" role="switch" aria-checked={showTechnical} onClick={() => setShowTechnical(value => !value)} className={`hidden h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold transition sm:inline-flex ${showTechnical ? "bg-slate-100 text-slate-800" : "text-[var(--muted)] hover:bg-[var(--app-bg)]"}`}><span>Técnico</span><span className={`relative h-4 w-7 rounded-full ${showTechnical ? "bg-slate-700" : "bg-slate-300"}`}><span className={`absolute top-0.5 size-3 rounded-full bg-white transition-transform ${showTechnical ? "translate-x-3.5" : "translate-x-0.5"}`}/></span></button><button type="button" onClick={onClose} aria-label="Cerrar chats" className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--app-bg)]"><X size={20}/></button></div></header>
      {training && <ClaudioTrainingPanel />}
      <div className={`${training ? "hidden" : ""} min-h-0 flex-1 overflow-y-auto`}>
        {!session ? <div className="grid h-full place-items-center text-center"><div><Bot className="mx-auto text-[var(--brand)]" size={34}/><h3 className="mt-3 text-xl font-bold">¿En qué te ayudo hoy?</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Crea o selecciona una conversación para trabajar con Claudio sin mezclar temas.</p></div></div> : <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">{session.messages.length === 0 ? <div className="py-16 text-center"><h3 className="text-xl font-bold">¿En qué te ayudo hoy?</h3><p className="mt-2 text-sm text-[var(--muted)]">Escribe tu mensaje y Claudio conservará este contexto en la sesión.</p></div> : null}{session.messages.map(message => message.role === "user" ? <div key={message.id} className="flex justify-end"><div className="max-w-[85%] rounded-3xl bg-[var(--brand)] px-4 py-2 text-sm leading-6 text-white"><p className="whitespace-pre-wrap">{message.content}</p><span className="mt-1 block text-[10px] text-white/70">{dateLabel(message.created_at)}</span></div></div> : message.role === "system" ? (showTechnical ? <details key={message.id} className="text-xs text-[var(--muted)]"><summary className="cursor-pointer select-none">Registro del sistema</summary><pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--app-bg)] p-2">{message.content}</pre></details> : null) : <div key={message.id} className="max-w-[90%] text-sm leading-7 text-[var(--app-fg)]"><div className="mb-1 flex items-center gap-2"><Bot size={15} className="text-[var(--brand)]"/><span className="text-xs font-bold">Claudio</span></div><p className="whitespace-pre-wrap">{message.content}</p><span className="mt-1 block text-[10px] text-[var(--muted)]">{dateLabel(message.created_at)}</span></div>)}{sending ? <div className="flex items-center gap-2 text-sm text-[var(--muted)]"><LoaderCircle size={16} className="animate-spin"/>Claudio está analizando…</div> : null}<div ref={bottomRef}/></div>}
      </div>
      <form onSubmit={send} className={`${training ? "hidden" : ""} shrink-0 bg-white px-4 pb-4 pt-2`}><div className="mx-auto max-w-3xl"><div className="flex items-end gap-2 rounded-3xl border border-[var(--border)] bg-white px-4 py-2 shadow-sm focus-within:border-[var(--brand)]"><textarea ref={inputRef} value={draft} onChange={event => { setDraft(event.target.value); event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 160)}px`; }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={session ? "Escribe a Claudio…" : "Crea una sesión para empezar…"} disabled={!session || sending} rows={1} className="max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed"/><button type="submit" disabled={!session || sending || !draft.trim()} className="mb-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white disabled:opacity-40" aria-label="Enviar mensaje"><ChevronUp size={18}/></button></div>{error ? <p className="mt-2 text-xs text-red-700">{error}</p> : <p className="mt-1 text-center text-[11px] text-[var(--muted)]">Enter envía · Shift+Enter nueva línea</p>}</div></form>
    </div>
  </section>;
}
