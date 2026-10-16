"use client";

import { Bot, MessageCircle, Send, X, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Message = { id: number; direction: "inbound" | "outbound"; sender_type: "customer" | "agent" | "human" | "system"; content: string };
type Conversation = { status: string; messages: Message[] };



const DB_NAME = "gaspronal-claudio-web-v1";
const STORE = "kv";
type ChatIdentity = { browserId: string; token: string | null; conversation: Conversation | null };

async function dbValue<T>(key: string, newValue?: T): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB_NAME, 1);
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(STORE)) opening.result.createObjectStore(STORE);
    };
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction(STORE, newValue === undefined ? "readonly" : "readwrite");
      const request = newValue === undefined
        ? transaction.objectStore(STORE).get(key)
        : transaction.objectStore(STORE).put(newValue, key);
      request.onsuccess = () => resolve(newValue === undefined ? request.result as T | undefined : newValue);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    };
  });
}
async function browserIdentity(): Promise<ChatIdentity> {
  let browserId = await dbValue<string>("browserId");
  if (!browserId) {
    browserId = crypto.randomUUID();
    await dbValue("browserId", browserId);
  }
  return {
    browserId,
    token: (await dbValue<string>("token")) ?? null,
    conversation: (await dbValue<Conversation>("conversation")) ?? null,
  };
}

/** Presentación segura de Markdown ligero: nunca interpreta HTML del modelo. */
function RichMessage({ content }: { content: string }) {
  const token = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>()[\]]+)/g;
  const renderInline = (line: string) => line.split(token).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    const markdownLink = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
    const url = markdownLink?.[2] ?? (/^https?:\/\//.test(part) ? part : null);
    if (url) {
      const cleanUrl = url.replace(/[.,;!?]+$/, "");
      return <a key={index} href={cleanUrl} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2" >{markdownLink?.[1] ?? cleanUrl}</a>;
    }
    return part;
  });
  return <div className="space-y-2 break-words">
    {content.split(/\n\s*\n/).map((paragraph, index) => <p key={index} className="whitespace-pre-wrap">{renderInline(paragraph.trim())}</p>)}
  </div>;
}

export default function ClaudioWebChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); const [available, setAvailable] = useState(false); const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const tokenRef = useRef<string | null>(null); const browserRef = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null); const bottom = useRef<HTMLDivElement>(null);
  const isPublic = !pathname.startsWith("/dashboard") && !pathname.startsWith("/login");
  const requestHeaders = () => ({ "X-Claudio-Web-Session": tokenRef.current ?? "" });
  const load = async () => {
    try {
      const identity = await browserIdentity();
      browserRef.current = identity.browserId;
      tokenRef.current = identity.token;
      if (identity.conversation) setConversation(identity.conversation);
      if (!identity.token) {
        const created = await fetch("/api/public/claudio-web/session", {
          method: "POST", headers: { "Content-Type": "application/json", "X-Claudio-Browser-Id": identity.browserId },
          body: JSON.stringify({ initial_path: window.location.pathname }), cache: "no-store",
        });
        const payload = await created.json().catch(() => ({}));
        if (!created.ok || !payload.data?.token) throw new Error(payload.message ?? "No fue posible crear la sesión.");
        tokenRef.current = payload.data.token;
        await dbValue("token", payload.data.token as string);
        setConversation(payload.data.conversation);
        await dbValue("conversation", payload.data.conversation as Conversation);
        setError("");
        return;
      }
      const r = await fetch("/api/public/claudio-web/current", { headers: requestHeaders(), cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 404) {
        tokenRef.current = null;
        await dbValue("token", "");
        await dbValue("conversation", { status: "active", messages: [] } as Conversation);
        setConversation(null);
        await load();
        return;
      }
      if (!r.ok) throw new Error(j.message ?? "La atención web está temporalmente no disponible.");
      setConversation(j.data);
      await dbValue("conversation", j.data as Conversation);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo recuperar la conversación.");
    }
  };
  const newSession = async () => {
    if (busy) return;
    tokenRef.current = null;
    await dbValue("token", "");
    await dbValue("conversation", { status: "active", messages: [] } as Conversation);
    setConversation(null);
    await load();
  };
  useEffect(() => {
    if (!isPublic) return;
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/public/claudio-web/status", { cache: "no-store" });
        const json = await response.json().catch(() => ({}));
        if (active) { const enabled = response.ok && json.data?.enabled === true; setAvailable(enabled); if (!enabled) setOpen(false); }
      } catch { if (active) { setAvailable(false); setOpen(false); } }
    };
    void check();
    const timer = window.setInterval(check, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [isPublic]);
  useEffect(() => { const openChat = () => { if (available && isPublic) { setOpen(true); void load(); } }; window.addEventListener("gaspronal:open-claudio", openChat); return () => window.removeEventListener("gaspronal:open-claudio", openChat); }, [available, isPublic]);
  useEffect(() => { if (open) { void load(); setTimeout(() => input.current?.focus(), 80); } }, [open]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation?.messages.length, busy]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, []);
  if (!isPublic || !available) return null;
  async function send(event: React.FormEvent) { event.preventDefault(); const message = draft.trim(); if (!message || busy) return; setBusy(true); setError(""); setDraft(""); try { if (!tokenRef.current) await load(); if (!tokenRef.current) throw new Error("No fue posible crear la sesión."); const r = await fetch("/api/public/claudio-web/message", { method: "POST", headers: { "Content-Type": "application/json", ...requestHeaders() }, body: JSON.stringify({ message, request_id: crypto.randomUUID() }), cache: "no-store" }); const j = await r.json().catch(() => ({})); if (r.ok) { setConversation(j.data); await dbValue("conversation", j.data as Conversation); } else { setDraft(message); setError(j.message ?? "No fue posible enviar el mensaje. Intenta de nuevo."); } } catch (e) { setDraft(message); setError(e instanceof Error ? e.message : "Error de conexión."); } finally { setBusy(false); } }
  return <>
    {!open && <button type="button" onClick={() => setOpen(true)} aria-label="Hablar con Claudio, asesor virtual" className="fixed bottom-5 right-[76px] z-50 inline-flex h-14 max-w-[calc(100vw-96px)] items-center gap-2 rounded-full bg-[var(--brand)] px-3 text-sm font-bold text-white shadow-xl transition hover:scale-[1.02] sm:bottom-6 sm:right-[190px] sm:max-w-none sm:px-5"><MessageCircle size={20}/>Hablar con un asesor</button>}
    {open && <section role="dialog" aria-modal="true" aria-label="Chat con Claudio" className="fixed bottom-3 right-3 z-[70] flex h-[min(680px,calc(100dvh-24px))] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-2xl">
      <header className="flex items-center justify-between bg-[var(--brand)] px-5 py-4 text-white"><div className="flex items-center gap-3"><Bot size={24}/><div><strong className="block">Claudio</strong><span className="text-xs text-white/80">Asesor virtual de IA · Gaspronal</span></div></div><button type="button" onClick={() => void newSession()} title="Nueva conversación" aria-label="Nueva conversación" className="rounded-full p-2 hover:bg-white/15"><Plus size={20}/></button><button type="button" aria-label="Cerrar chat" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/15"><X size={20}/></button></header>
      <div className="flex-1 space-y-4 overflow-y-auto bg-[var(--app-bg)] p-4" aria-live="polite">{conversation?.messages.map(item => <div key={item.id} className={`max-w-[92%] rounded-2xl px-4 py-3 text-[13px] leading-[1.65] sm:text-sm ${item.direction === "inbound" ? "ml-auto rounded-br-md bg-[var(--brand)] text-white" : "rounded-bl-md border border-slate-200/80 bg-white text-[var(--app-fg)] shadow-sm"}`}><RichMessage content={item.content}/></div>)}{busy && <div className="w-fit rounded-2xl bg-white px-3 py-2 text-sm shadow-sm">Claudio está escribiendo…</div>}<div ref={bottom}/></div>
      <form onSubmit={send} className="border-t border-[var(--border)] bg-white p-3"><p className="mb-2 text-[11px] text-[var(--muted)]">Asistente virtual de IA. No compartas información sensible.</p>{error && <p className="mb-2 text-xs text-red-700">{error}</p>}<div className="flex gap-2"><input ref={input} value={draft} maxLength={4000} onChange={e => setDraft(e.target.value)} placeholder={conversation?.status === "active" ? "Escribe tu consulta…" : "Un asesor está atendiendo el chat"} disabled={busy || (conversation?.status !== "active" || !tokenRef.current)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--brand)] disabled:bg-slate-100"/><button disabled={busy || !draft.trim() || conversation?.status !== "active"} aria-label="Enviar mensaje" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)] text-white disabled:opacity-40"><Send size={18}/></button></div></form>
    </section>}
  </>;
}
