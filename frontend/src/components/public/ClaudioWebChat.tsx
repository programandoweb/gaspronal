"use client";

import { Bot, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Message = { id: number; direction: "inbound" | "outbound"; sender_type: "customer" | "agent" | "human" | "system"; content: string };
type Conversation = { status: string; messages: Message[] };

export default function ClaudioWebChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null); const bottom = useRef<HTMLDivElement>(null);
  const isPublic = !pathname.startsWith("/dashboard") && !pathname.startsWith("/login");
  const load = async () => { const r = await fetch("/api/public/claudio-web/current", { cache: "no-store" }); const j = await r.json().catch(() => ({})); if (r.ok) { setConversation(j.data); setError(""); } else setError(j.message ?? "La atención web está temporalmente no disponible."); };
  useEffect(() => { const openChat = () => { setOpen(true); void load(); }; window.addEventListener("gaspronal:open-claudio", openChat); return () => window.removeEventListener("gaspronal:open-claudio", openChat); }, []);
  useEffect(() => { if (open) { void load(); setTimeout(() => input.current?.focus(), 80); } }, [open]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation?.messages.length, busy]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, []);
  if (!isPublic) return null;
  async function send(event: React.FormEvent) { event.preventDefault(); const message = draft.trim(); if (!message || busy) return; setBusy(true); setError(""); setDraft(""); const r = await fetch("/api/public/claudio-web/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, request_id: crypto.randomUUID() }) }); const j = await r.json().catch(() => ({})); if (r.ok) setConversation(j.data); else { setDraft(message); setError(j.message ?? "No fue posible enviar el mensaje. Intenta de nuevo."); } setBusy(false); }
  return <>
    {!open && <button type="button" onClick={() => setOpen(true)} aria-label="Hablar con Claudio, asesor virtual" className="fixed bottom-5 right-[76px] z-50 inline-flex h-14 max-w-[calc(100vw-96px)] items-center gap-2 rounded-full bg-[var(--brand)] px-3 text-sm font-bold text-white shadow-xl transition hover:scale-[1.02] sm:bottom-6 sm:right-[190px] sm:max-w-none sm:px-5"><MessageCircle size={20}/>Hablar con un asesor</button>}
    {open && <section role="dialog" aria-modal="true" aria-label="Chat con Claudio" className="fixed bottom-3 right-3 z-[70] flex h-[min(680px,calc(100dvh-24px))] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-2xl">
      <header className="flex items-center justify-between bg-[var(--brand)] px-5 py-4 text-white"><div className="flex items-center gap-3"><Bot size={24}/><div><strong className="block">Claudio</strong><span className="text-xs text-white/80">Asesor virtual de IA · Gaspronal</span></div></div><button type="button" aria-label="Cerrar chat" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/15"><X size={20}/></button></header>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--app-bg)] p-4" aria-live="polite">{conversation?.messages.map(item => <div key={item.id} className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-6 ${item.direction === "inbound" ? "ml-auto bg-[var(--brand)] text-white" : "bg-white text-[var(--app-fg)] shadow-sm"}`}>{item.content}</div>)}{busy && <div className="w-fit rounded-2xl bg-white px-3 py-2 text-sm shadow-sm">Claudio está escribiendo…</div>}<div ref={bottom}/></div>
      <form onSubmit={send} className="border-t border-[var(--border)] bg-white p-3"><p className="mb-2 text-[11px] text-[var(--muted)]">Asistente virtual de IA. No compartas información sensible.</p>{error && <p className="mb-2 text-xs text-red-700">{error}</p>}<div className="flex gap-2"><input ref={input} value={draft} maxLength={4000} onChange={e => setDraft(e.target.value)} placeholder={conversation?.status === "active" ? "Escribe tu consulta…" : "Un asesor está atendiendo el chat"} disabled={busy || conversation?.status !== "active"} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--brand)] disabled:bg-slate-100"/><button disabled={busy || !draft.trim() || conversation?.status !== "active"} aria-label="Enviar mensaje" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)] text-white disabled:opacity-40"><Send size={18}/></button></div></form>
    </section>}
  </>;
}
