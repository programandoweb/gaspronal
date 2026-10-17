"use client";

import { Bot, LoaderCircle, MessageCircle, RefreshCw, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Settings = { web_channel_enabled: boolean; web_welcome_message?: string | null };
type Item = { id: number; status: string; initial_path?: string | null; last_message_at?: string | null; messages_count: number; latest_message?: { content: string } | null };

function dateLabel(value?: string | null) {
  if (!value) return "Sin actividad";
  return new Intl.DateTimeFormat("es-CO", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function ClaudioWebConversations({ onOpenSession }: { onOpenSession: (sessionId: number) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [welcomeDrawerOpen, setWelcomeDrawerOpen] = useState(false);
  const [welcomeDraft, setWelcomeDraft] = useState("");

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const [s, c] = await Promise.all([
      fetch("/api/agents/claudio/settings", { cache: "no-store" }),
      fetch("/api/admin/agents/claudio/web-conversations?per_page=50", { cache: "no-store" }),
    ]);
    const sj = await s.json().catch(() => ({}));
    const cj = await c.json().catch(() => ({}));
    if (!silent) setLoading(false);
    if (s.ok) setSettings(sj.data);
    if (c.ok) setItems(cj.data ?? []);
    else setMessage(cj.message ?? "No fue posible cargar las sesiones web.");
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function save(next?: Partial<Settings>) {
    if (!settings) return;
    const payload = { ...settings, ...next };
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/agents/claudio/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ web_channel_enabled: payload.web_channel_enabled, web_welcome_message: payload.web_welcome_message }),
    });
    const json = await response.json().catch(() => ({}));
    if (response.ok) {
      setSettings(json.data);
      setMessage("Configuración guardada.");
    } else setMessage(json.message ?? "No fue posible guardar.");
    setBusy(false);
  }

  const activeCount = useMemo(() => items.filter((item) => item.status !== "closed").length, [items]);

  return <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
    <header className="flex flex-col gap-3 border-b border-[var(--border)] p-5 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <div className="flex items-center gap-2"><MessageCircle className="text-xl text-[var(--brand)]" aria-hidden="true" /><h2 className="font-bold">Atención Web de Claudio</h2></div>
        <p className="mt-1 text-sm text-[var(--muted)]">Selecciona una sesión para abrir su historial y gestionar la atención.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setWelcomeDraft(settings?.web_welcome_message ?? ""); setWelcomeDrawerOpen(true); }} disabled={!settings} className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] px-3 text-sm font-semibold disabled:opacity-50">Mensaje de bienvenida</button>
        {settings && <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold"><span className="text-[var(--muted)]">Activar atención web</span><input type="checkbox" checked={settings.web_channel_enabled} disabled={busy} onChange={(event) => void save({ web_channel_enabled: event.target.checked })} className="h-5 w-5 accent-[var(--brand)]" /></label>}
        <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-bold text-[var(--brand)]">{activeCount} activas</span>
        <button type="button" onClick={() => void load()} className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--border)]" aria-label="Actualizar sesiones"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
      </div>
    </header>

    {loading && items.length === 0 && <p className="p-5 text-sm text-[var(--muted)]">Cargando sesiones…</p>}
    {!loading && items.length === 0 && <div className="p-10 text-center"><MessageCircle className="mx-auto text-3xl text-[var(--brand)]" /><p className="mt-3 font-semibold">Aún no hay sesiones web.</p><p className="mt-1 text-sm text-[var(--muted)]">Aparecerán aquí cuando un visitante inicie una conversación.</p></div>}
    <div className="divide-y divide-[var(--border)]">
      {items.map((item) => <button key={item.id} type="button" onClick={() => onOpenSession(item.id)} className="grid w-full grid-cols-[minmax(0,.9fr)_minmax(0,1.5fr)_minmax(0,.8fr)] items-center gap-4 px-4 py-3 text-left transition hover:bg-[var(--app-bg)] sm:px-5">
        <div className="min-w-0"><strong className="flex items-center gap-2 truncate text-sm"><Bot size={15} />Sesión #{item.id}</strong><span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{item.messages_count} mensajes · {item.initial_path ?? "/"}</span></div>
        <p className="line-clamp-2 text-sm leading-5 text-[var(--muted)]">{item.latest_message?.content ?? "Sin mensajes"}</p>
        <div className="min-w-0 text-right"><span className="inline-flex max-w-full truncate rounded-full border border-[var(--border)] px-2 py-1 text-[11px] font-semibold">{item.status}</span><span className="mt-1 block text-[11px] text-[var(--muted)]">{dateLabel(item.last_message_at)}</span></div>
      </button>)}
    </div>
    {message && <p className="border-t border-[var(--border)] px-5 py-3 text-xs font-medium text-[var(--brand)]">{message}</p>}

    {welcomeDrawerOpen && settings && <section role="dialog" aria-modal="true" aria-label="Mensaje de bienvenida" className="fixed inset-0 z-[100] flex justify-end bg-black/30">
      <div className="flex h-full w-full max-w-xl flex-col bg-[var(--surface)] shadow-2xl"><header className="flex items-center justify-between border-b border-[var(--border)] p-5"><div><h2 className="font-bold">Mensaje de bienvenida</h2><p className="mt-1 text-sm text-[var(--muted)]">Saludo predeterminado de Claudio para la atención web.</p></div><button type="button" onClick={() => setWelcomeDrawerOpen(false)} aria-label="Cerrar" className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--app-bg)]"><X size={20} /></button></header><div className="flex-1 p-5"><textarea value={welcomeDraft} onChange={(event) => setWelcomeDraft(event.target.value)} placeholder="Saludo predeterminado de Claudio" rows={8} className="w-full resize-none rounded-xl border border-[var(--border)] p-3 text-sm" /></div><footer className="flex justify-end gap-3 border-t border-[var(--border)] p-5"><button type="button" onClick={() => setWelcomeDrawerOpen(false)} className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold">Cancelar</button><button type="button" onClick={() => { void save({ web_welcome_message: welcomeDraft }); setWelcomeDrawerOpen(false); }} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}Guardar</button></footer></div>
    </section>}
  </section>;
}
