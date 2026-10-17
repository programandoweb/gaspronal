"use client";

import { Bot, LoaderCircle, MessageCircle, Save } from "lucide-react";
import { useEffect, useState } from "react";

type Settings = { web_channel_enabled: boolean; web_welcome_message?: string | null };
type Item = { id: number; status: string; initial_path?: string | null; last_message_at?: string | null; messages_count: number; latest_message?: { content: string } | null };

function dateLabel(value?:string|null){
  if(!value)return "Sin actividad";
  return new Intl.DateTimeFormat("es-CO",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value));
}

export default function ClaudioWebConversations() {
  const [settings, setSettings] = useState<Settings | null>(null); const [items, setItems] = useState<Item[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const load = async () => { const [s, c] = await Promise.all([fetch("/api/agents/claudio/settings", { cache: "no-store" }), fetch("/api/admin/agents/claudio/web-conversations?per_page=50", { cache: "no-store" })]); const sj = await s.json().catch(() => ({})); const cj = await c.json().catch(() => ({})); if (s.ok) setSettings(sj.data); if (c.ok) setItems(cj.data ?? []); };
  useEffect(() => { void load(); }, []);
  async function save() { if (!settings) return; setBusy(true); setMessage(""); const r = await fetch("/api/agents/claudio/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ web_channel_enabled: settings.web_channel_enabled, web_welcome_message: settings.web_welcome_message }) }); const j = await r.json().catch(() => ({})); if (r.ok) { setSettings(j.data); setMessage("Configuración guardada."); } else setMessage(j.message ?? "No fue posible guardar."); setBusy(false); }
  return <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
    <div className="flex items-start gap-3"><MessageCircle className="mt-0.5 text-[var(--brand)]"/><div><h2 className="font-bold">Atención Web</h2><p className="mt-1 text-sm text-[var(--muted)]">Canal público aislado de WhatsApp. Las conversaciones se almacenan por sesión web.</p></div></div>
    {!settings ? <p className="text-sm text-[var(--muted)]">Cargando configuración…</p> : <><label className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4"><span><strong className="block text-sm">Activar atención web</strong><span className="text-xs text-[var(--muted)]">Si está desactivada, no se ejecutan consultas IA desde el sitio público.</span></span><input type="checkbox" checked={settings.web_channel_enabled} onChange={e => setSettings({ ...settings, web_channel_enabled: e.target.checked })} className="h-5 w-5 accent-[var(--brand)]"/></label><label className="block space-y-2"><span className="text-sm font-semibold">Mensaje de bienvenida</span><textarea value={settings.web_welcome_message ?? ""} onChange={e => setSettings({ ...settings, web_welcome_message: e.target.value })} placeholder="Saludo predeterminado de Claudio" rows={3} className="w-full rounded-xl border border-[var(--border)] p-3 text-sm"/></label><button type="button" onClick={() => void save()} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Save size={16}/>}Guardar</button>{message && <p className="text-xs text-[var(--muted)]">{message}</p>}</>}
    <div className="border-t border-[var(--border)] pt-5"><h3 className="mb-3 font-bold">Sesiones web recientes</h3>{items.length === 0 ? <p className="text-sm text-[var(--muted)]">No hay conversaciones web todavía.</p> : <div className="space-y-2">{items.map(item => <article key={item.id} className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.5fr)_minmax(0,.8fr)] items-center gap-4 rounded-xl border border-[var(--border)] px-3 py-2.5"><div className="min-w-0"><span className="inline-flex items-center gap-2 text-sm font-semibold"><Bot size={15}/>Sesión #{item.id}</span><span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{item.messages_count} mensajes · {item.initial_path ?? "/"}</span></div><p className="line-clamp-2 text-sm leading-5 text-[var(--muted)]">{item.latest_message?.content ?? "Sin mensajes"}</p><div className="min-w-0 text-right"><span className="inline-flex max-w-full truncate rounded-full bg-[var(--app-bg)] px-2 py-1 text-xs">{item.status}</span><span className="mt-1 block text-[11px] text-[var(--muted)]">{dateLabel(item.last_message_at)}</span></div></article>)}</div>}</div>
  </section>;
}
