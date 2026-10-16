"use client";

import { Bot, GraduationCap, LoaderCircle, MessageCircle, Plus, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

    let currentSession = session;
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

    const response = await fetch("/api/agents/claudio/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content, requestId, sessionId: currentSession.id, history }),
    });
    const json = await response.json().catch(() => ({}));
    setSending(false);
    if (!response.ok) {
      setError(json.message ?? "No fue posible obtener la respuesta de Claudio.");
      await selectSession(currentSession.id);
      return;
    }
    await Promise.all([selectSession(currentSession.id), loadSessions(false)]);
  }

  useEffect(() => {
    if (!open) return;
    void loadSessions();
    window.setTimeout(() => inputRef.current?.focus(), 100);
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

  return <section role="dialog" aria-modal="true" aria-label="Chats con Claudio" className="fixed inset-0 z-[100] flex bg-[var(--surface)] shadow-2xl">
    <aside className={`${training ? "hidden" : (sidebarOpen ? "flex sm:flex" : "hidden sm:flex")} absolute inset-0 z-10 w-full flex-col bg-white sm:static sm:max-w-[360px] sm:shrink-0 sm:border-r sm:border-[var(--border)]`}>
      <header className="border-b border-[var(--border)] p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><MessageCircle size={20}/></span><div><h2 className="font-bold">Chats con Claudio</h2><p className="text-xs text-[var(--muted)]">Historial privado del agente</p></div></div><button type="button" onClick={onClose} aria-label="Cerrar drawer" className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--app-bg)] lg:hidden"><X size={20}/></button></div>
        <button type="button" onClick={() => void newSession()} disabled={creating} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white disabled:opacity-50"><Plus size={18}/>{creating ? "Creando…" : "Nueva sesión"}</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && sessions.length === 0 ? <p className="p-4 text-sm text-[var(--muted)]">Cargando conversaciones…</p> : null}
        {!loading && sessions.length === 0 ? <div className="p-6 text-center text-sm text-[var(--muted)]"><Bot className="mx-auto text-[var(--brand)]" size={28}/><p className="mt-3">Aún no hay sesiones.</p><p className="mt-1 text-xs">Crea una conversación para hablar con Claudio.</p></div> : null}
        {sessions.map(item => <button key={item.id} type="button" onClick={() => void selectSession(item.id)} className={`mb-1 w-full rounded-xl p-3 text-left transition ${session?.id === item.id ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "hover:bg-[var(--app-bg)]"}`}><div className="flex items-start justify-between gap-2"><strong className="line-clamp-2 text-sm">{item.title || "Nueva conversación"}</strong><span className="shrink-0 text-[10px] text-[var(--muted)]">{dateLabel(item.last_message_at || item.created_at)}</span></div><span className="mt-1 block text-xs text-[var(--muted)]">Sesión #{item.id}</span></button>)}
      </div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col bg-[var(--app-bg)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-white px-5 py-4"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setSidebarOpen(true)} aria-label="Abrir historial" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-[var(--brand)] hover:bg-[var(--brand-soft)] sm:hidden"><MessageCircle size={20}/></button><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-white"><Bot size={20}/></span><div className="min-w-0"><h2 className="truncate font-bold">{training ? "Entrenamiento de Claudio" : (session?.title || "Nueva conversación")}</h2><p className="text-xs text-[var(--muted)]">Claudio · asesor virtual de Gaspronal</p></div></div><div className="flex items-center gap-2">{canTrain && <button type="button" aria-pressed={training} onClick={() => setTraining(value => !value)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold ${training ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--app-bg)]"}`}><GraduationCap size={17}/><span className="hidden sm:inline">Entrenamiento</span> {training ? "ON" : "OFF"}</button>}<button type="button" onClick={onClose} aria-label="Cerrar chats" className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--app-bg)]"><X size={20}/></button></div></header>
      {training && <ClaudioTrainingPanel />}
      <div className={`${training ? "hidden" : ""} min-h-0 flex-1 overflow-y-auto p-4 sm:p-6`}>
        {!session ? <div className="grid h-full place-items-center text-center"><div><Bot className="mx-auto text-[var(--brand)]" size={34}/><h3 className="mt-3 font-bold">Selecciona o crea una sesión</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">Cada sesión conserva su propio historial para continuar una conversación sin mezclar temas.</p></div></div> : <div className="mx-auto flex max-w-4xl flex-col gap-4">{session.messages.length === 0 ? <div className="py-16 text-center text-sm text-[var(--muted)]">Inicia la conversación con Claudio.</div> : null}{session.messages.map(message => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[72%] ${message.role === "user" ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] bg-white text-[var(--app-fg)]"}`}><span className={`mb-1 block text-[10px] font-black uppercase tracking-wide ${message.role === "user" ? "text-white/70" : "text-[var(--muted)]"}`}>{message.role === "user" ? "Tú" : "Claudio"}</span><p className="whitespace-pre-wrap">{message.content}</p><span className={`mt-1 block text-[10px] ${message.role === "user" ? "text-white/70" : "text-[var(--muted)]"}`}>{dateLabel(message.created_at)}</span></div></div>)}{sending ? <div className="flex justify-start"><div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--muted)]"><LoaderCircle size={16} className="animate-spin"/>Claudio está respondiendo…</div></div> : null}<div ref={bottomRef}/></div>}
      </div>
      <form onSubmit={send} className={`${training ? "hidden" : ""} border-t border-[var(--border)] bg-white p-4 sm:px-6`}><div className="mx-auto flex max-w-4xl gap-2"><textarea ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={session ? "Escribe a Claudio…" : "Crea una sesión para empezar…"} disabled={!session || sending} rows={2} className="min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm outline-none focus:border-[var(--brand)] disabled:bg-slate-100"/><button type="submit" disabled={!session || sending || !draft.trim()} className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white disabled:opacity-45" aria-label="Enviar mensaje"><Send size={18}/></button></div>{error ? <p className="mx-auto mt-2 max-w-4xl text-xs text-red-700">{error}</p> : null}</form>
    </div>
  </section>;
}
