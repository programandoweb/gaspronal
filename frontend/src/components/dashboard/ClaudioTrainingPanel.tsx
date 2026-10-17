"use client";

import { BookOpen, Check, ChevronDown, ChevronUp, LoaderCircle, Plus, RotateCcw, Send, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type TrainingSession = { id: number; created_at: string };
type TrainingMessage = { id: number; role: "user" | "assistant"; content: string; created_at: string };
type Proposal = { id: number; category: string; title: string; content: string; operation: "append" | "replace"; status: "pending" | "approved" | "rejected" };
type Rule = { id: number; category: string; title: string; content: string; version: number };
type Version = { id: number; version: number; title: string; content: string; created_at: string };
type TrainingState = { can_approve: boolean; sessions: TrainingSession[]; rules: Rule[] };
type Thread = { id: number; messages: TrainingMessage[]; proposals: Proposal[] };

const api = "/api/admin/agents/claudio/training";

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(api + path, {
    method, cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.message || "No fue posible completar la operación.");
  return json;
}

export default function ClaudioTrainingPanel() {
  const [state, setState] = useState<TrainingState | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expandedRule, setExpandedRule] = useState<number | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  const refreshState = useCallback(async () => {
    const json = await request("");
    const data = json.data as TrainingState;
    setState(data);
    return data;
  }, []);

  const openSession = useCallback(async (id: number) => {
    const json = await request("/sessions/" + id);
    setThread(json.data as Thread);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void request("").then(async json => {
      if (cancelled) return;
      const data = json.data as TrainingState;
      setState(data);
      if (data.sessions.length) {
        const item = await request("/sessions/" + data.sessions[0].id);
        if (!cancelled) setThread(item.data as Thread);
      }
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [thread?.messages.length, busy]);

  async function createSession() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const json = await request("/sessions", "POST");
      setThread(json.data as Thread);
      await refreshState();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!thread || !draft.trim() || busy) return;
    const value = draft.trim();
    setBusy(true); setError(""); setDraft("");
    try {
      const json = await request("/sessions/" + thread.id + "/messages", "POST", {
        content: value, request_id: crypto.randomUUID(),
      });
      setThread(json.data as Thread);
      await refreshState();
    } catch (e) { setDraft(value); setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function review(proposal: Proposal, action: "approve" | "reject") {
    if (!thread || busy) return;
    if (action === "approve" && !window.confirm("¿Confirmas que deseas aplicar esta instrucción a las próximas conversaciones de Claudio?")) return;
    setBusy(true); setError("");
    try {
      await request("/proposals/" + proposal.id + "/" + action, "POST");
      await Promise.all([openSession(thread.id), refreshState()]);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function toggleVersions(rule: Rule) {
    if (expandedRule === rule.id) { setExpandedRule(null); return; }
    setError("");
    try {
      const json = await request("/rules/" + rule.id + "/versions");
      setVersions(json.data as Version[]);
      setExpandedRule(rule.id);
    } catch (e) { setError((e as Error).message); }
  }

  async function restore(rule: Rule, version: Version) {
    if (!state?.can_approve || busy) return;
    if (!window.confirm(`¿Restaurar la versión ${version.version} de "${rule.title}"? Se guardará una nueva versión.`)) return;
    setBusy(true); setError("");
    try {
      await request("/rules/" + rule.id + "/rollback", "POST", { version_id: version.id });
      await refreshState();
      const json = await request("/rules/" + rule.id + "/versions");
      setVersions(json.data as Version[]);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="flex min-h-0 flex-1 flex-col bg-white">
    <div className="border-b border-orange-200 bg-orange-50 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-orange-800"><ShieldCheck size={18}/> Modo entrenamiento activo</span>
        <button type="button" onClick={() => void createSession()} disabled={busy} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[var(--brand)] px-3 text-xs font-bold text-white disabled:opacity-50"><Plus size={15}/> Nuevo entrenamiento</button>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">Claudio propondrá cambios, pero no los aplicará hasta que los apruebes.</p>
      {!!state?.sessions.length && <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1">
        {state.sessions.map(item => <button key={item.id} type="button" onClick={() => void openSession(item.id)} className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs ${thread?.id === item.id ? "border-[var(--brand)] bg-[var(--brand-soft)] font-bold text-[var(--brand)]" : "border-[var(--border)]"}`}>Entrenamiento #{item.id}</button>)}
      </div>}
    </div>
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
          {!thread && <p className="mx-auto max-w-lg py-10 text-center text-sm text-[var(--muted)]">Crea un entrenamiento para explicarle a Claudio cómo debe atender a tus clientes.</p>}
          {thread?.messages.map(message => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] px-4 py-2 text-sm leading-7 sm:max-w-[75%] ${message.role === "user" ? "rounded-3xl bg-[var(--brand)] text-white" : "text-[var(--app-fg)]"}`}>
              <span className="mb-1 block text-[10px] font-bold uppercase opacity-70">{message.role === "user" ? "Entrenador" : "Claudio"}</span>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>)}
          {thread?.proposals.map(proposal => <div key={proposal.id} className="mx-auto max-w-2xl rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2"><strong className="text-sm">{proposal.title}</strong><span className="text-xs font-medium text-[var(--muted)]">{proposal.status === "pending" ? "Pendiente de aprobación" : proposal.status === "approved" ? "Aprobada" : "Rechazada"}</span></div>
            <p className="mb-1 text-[11px] uppercase tracking-wider text-[var(--muted)]">{proposal.category} · {proposal.operation === "replace" ? "Reemplazar reglas de esta categoría" : "Añadir regla"}</p>
            <p className="whitespace-pre-wrap text-sm leading-6">{proposal.content}</p>
            {proposal.status === "pending" && state?.can_approve && <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} onClick={() => void review(proposal, "approve")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-50"><Check size={16}/> Aprobar y aplicar</button>
              <button type="button" disabled={busy} onClick={() => void review(proposal, "reject")} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"><X size={16}/> Rechazar</button>
            </div>}
          </div>)}
          {busy && <p className="flex items-center gap-2 text-sm text-[var(--muted)]"><LoaderCircle size={16} className="animate-spin"/> Procesando…</p>}
          <div ref={bottom}/>
        </div></div>
        <form onSubmit={send} className="shrink-0 bg-white px-4 pb-4 pt-2 sm:px-6"><div className="mx-auto max-w-3xl"><div className="flex items-end gap-2 rounded-3xl border border-[var(--border)] bg-white px-4 py-2 shadow-sm focus-within:border-[var(--brand)]"><textarea rows={1} maxLength={5000} value={draft} onChange={event => { setDraft(event.target.value); event.currentTarget.style.height="auto"; event.currentTarget.style.height=`${Math.min(event.currentTarget.scrollHeight,160)}px`; }} disabled={!thread || busy} placeholder="Escribe la instrucción que Claudio debe aprender…" className="max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed"/><button type="submit" aria-label="Enviar instrucción" disabled={!draft.trim() || !thread || busy} className="mb-1 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-white disabled:opacity-40"><Send size={17}/></button></div>{error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : <p className="mt-1 text-center text-[11px] text-[var(--muted)]">Cada instrucción genera una propuesta para tu aprobación.</p>}</div></form>
      </div>
      <aside className="max-h-72 overflow-y-auto border-t border-[var(--border)] bg-white p-4 lg:max-h-none lg:border-l lg:border-t-0">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><BookOpen size={17}/> Instrucciones activas</h3>
        {!state?.rules.length && <p className="text-xs text-[var(--muted)]">Todavía no hay reglas aprobadas.</p>}
        {state?.rules.map(rule => <div key={rule.id} className="mb-3 rounded-lg border border-[var(--border)] p-3">
          <p className="text-[10px] uppercase text-[var(--muted)]">{rule.category} · Versión {rule.version}</p>
          <strong className="mt-1 block text-sm">{rule.title}</strong>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5">{rule.content}</p>
          <button type="button" onClick={() => void toggleVersions(rule)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)]">{expandedRule === rule.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} Historial</button>
          {expandedRule === rule.id && <div className="mt-2 space-y-2 border-t border-[var(--border)] pt-2">{versions.map(version => <div key={version.id} className="text-xs">
            <strong>v{version.version}</strong><p className="mt-1 whitespace-pre-wrap text-[var(--muted)]">{version.content}</p>
            {state?.can_approve && version.version !== rule.version && <button type="button" disabled={busy} onClick={() => void restore(rule, version)} className="mt-1 inline-flex items-center gap-1 font-bold text-[var(--brand)] disabled:opacity-50"><RotateCcw size={12}/> Restaurar</button>}
          </div>)}</div>}
        </div>)}
      </aside>
    </div>
  </div>;
}
