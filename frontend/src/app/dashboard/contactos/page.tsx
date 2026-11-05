"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ExternalLink,
  Inbox, LoaderCircle, Mail, MailCheck, MailWarning, RefreshCw,
  Save, Search, Settings2, X,
} from "lucide-react";

type Contact = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  consent_at: string;
  read_at: string | null;
  notification_status: "pending" | "sent" | "logged" | "failed" | "not_configured";
  notification_recipients: string[] | null;
  notification_sent_at: string | null;
  notification_error: string | null;
  created_at: string;
};
type Summary = {
  total: number;
  unread_count: number;
  failed_count: number;
  current_page: number;
  last_page: number;
  can_manage: boolean;
};
type Filter = "all" | "unread" | "read" | "failed";

const statusNames: Record<Contact["notification_status"], string> = {
  pending: "Pendiente",
  sent: "Enviado",
  logged: "Modo pruebas (log)",
  failed: "Correo fallido",
  not_configured: "Sin destinatarios",
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message ?? "No fue posible completar la operación.");
  }
  return payload as T;
}

export default function ContactosPage() {
  const [tab, setTab] = useState<"messages" | "settings">("messages");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [emailsText, setEmailsText] = useState("");
  const [canManageSettings, setCanManageSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), filter });
      if (search) params.set("search", search);
      const response = await fetch("/api/admin/contacts?" + params.toString(), { cache: "no-store" });
      const payload = await parseResponse<{ data: Contact[]; meta: Summary }>(response);
      setContacts(payload.data);
      setSummary(payload.meta);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error al cargar los mensajes.");
    } finally {
      setLoading(false);
    }
  }, [filter, page, search]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    let active = true;
    async function getSettings() {
      try {
        const response = await fetch("/api/admin/contacts/settings", { cache: "no-store" });
        const payload = await parseResponse<{
          data: { notification_emails: string[] };
          meta: { can_manage: boolean };
        }>(response);
        if (!active) return;
        setEmailsText(payload.data.notification_emails.join("\n"));
        setCanManageSettings(payload.meta.can_manage);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Error al cargar los destinatarios.");
      }
    }
    void getSettings();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const canManage = summary?.can_manage ?? false;
  const recipients = emailsText.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);

  async function view(contact: Contact) {
    setSelected(contact);
    if (contact.read_at || !canManage) return;
    try {
      const response = await fetch("/api/admin/contacts/" + contact.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      const payload = await parseResponse<{ data: Contact }>(response);
      setSelected((current) => current?.id === contact.id ? payload.data : current);
      setContacts((previous) => previous.map((item) => item.id === contact.id ? payload.data : item));
      setSummary((previous) => previous ? { ...previous, unread_count: Math.max(0, previous.unread_count - 1) } : previous);
    } catch {
      // El mensaje permanece legible incluso si falla marcar como leído.
    }
  }

  async function resend(contact: Contact) {
    setBusyId(contact.id);
    setError("");
    try {
      const response = await fetch("/api/admin/contacts/" + contact.id + "/resend", { method: "POST" });
      const payload = await parseResponse<{ data: Contact }>(response);
      setSelected(payload.data);
      setContacts((previous) => previous.map((item) => item.id === contact.id ? payload.data : item));
      setFeedback(payload.data.notification_status === "sent"
        ? "Notificación reenviada correctamente."
        : "Se procesó el reintento. Consulta su estado de correo.");
      await loadMessages();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible reenviar la notificación.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageSettings || saving) return;
    setSaving(true);
    setFeedback("");
    setError("");
    try {
      const emails = [...new Set(recipients.map((item) => item.toLowerCase()))];
      const response = await fetch("/api/admin/contacts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_emails: emails }),
      });
      const payload = await parseResponse<{ data: { notification_emails: string[] } }>(response);
      setEmailsText(payload.data.notification_emails.join("\n"));
      setFeedback("Destinatarios actualizados. Los próximos mensajes usarán estos correos.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible actualizar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Comunicación comercial</span>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Mensajes de contacto</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Todas las consultas quedan guardadas, independientemente de la entrega por correo.</p>
        </div>
        <Link href="/#contacto" target="_blank"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--brand)]">
          <ExternalLink size={17} /> Ver formulario
        </Link>
      </header>

      {feedback && <p role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} />{feedback}</p>}
      {error && <p role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} />{error}</p>}

      <div role="tablist" aria-label="Administración de contactos" className="flex gap-2 border-b border-[var(--border)]">
        <button type="button" role="tab" aria-selected={tab === "messages"}
          onClick={() => { setTab("messages"); setFeedback(""); }}
          className={"inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-black transition " +
            (tab === "messages" ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-slate-500 hover:text-[var(--steel)]")}>
          <Inbox size={18} /> Mensajes
          {!!summary?.unread_count && <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs">{summary.unread_count}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "settings"}
          onClick={() => { setTab("settings"); setFeedback(""); }}
          className={"inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-black transition " +
            (tab === "settings" ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-slate-500 hover:text-[var(--steel)]")}>
          <Settings2 size={18} /> Configuración
        </button>
      </div>

      {tab === "messages" ? (
        <section role="tabpanel" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Mensajes</p>
              <p className="mt-2 text-3xl font-black text-[var(--steel)]">{summary?.total ?? "—"}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sin leer</p>
              <p className="mt-2 text-3xl font-black text-[var(--brand)]">{summary?.unread_count ?? "—"}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Correo fallido</p>
              <p className="mt-2 text-3xl font-black text-[var(--steel)]">{summary?.failed_count ?? "—"}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }} className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar nombre, correo o asunto" aria-label="Buscar contactos"
                className="min-h-11 w-full min-w-0 bg-transparent text-sm outline-none" />
              <button type="submit" className="rounded-lg px-3 py-2 text-xs font-bold text-[var(--brand)]">Buscar</button>
            </form>
            <select value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setPage(1); }}
              aria-label="Filtrar contactos" className="min-h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold">
              <option value="all">Todos</option>
              <option value="unread">Sin leer</option>
              <option value="read">Leídos</option>
              <option value="failed">Fallos de correo</option>
            </select>
            <button type="button" title="Actualizar mensajes" onClick={() => void loadMessages()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-bold text-[var(--brand)]">
              <RefreshCw size={17} /> Actualizar
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
                <LoaderCircle size={19} className="animate-spin" /> Cargando mensajes…
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-14 text-center text-sm text-slate-500">
                <Inbox size={34} className="text-slate-300" />
                No hay mensajes con estos filtros.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {contacts.map((contact) => (
                  <button key={contact.id} type="button" onClick={() => void view(contact)}
                    className="flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={"mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " +
                        (!contact.read_at ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-slate-100 text-slate-500")}>
                        <Mail size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-[var(--steel)]">{contact.first_name} {contact.last_name}</span>
                        <span className="block truncate text-xs text-slate-500">{contact.email} · {contact.subject}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500">{contact.message}</span>
                      </span>
                    </div>
                    <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-slate-500">
                      {!contact.read_at && <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 font-bold text-[var(--brand)]">Nuevo</span>}
                      <span className={"rounded-full px-2 py-1 font-semibold " +
                        (contact.notification_status === "failed" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600")}>
                        {statusNames[contact.notification_status] ?? contact.notification_status}
                      </span>
                      {formatDate(contact.created_at)}
                      <ArrowRight size={17} className="text-slate-400" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {(summary?.last_page ?? 1) > 1 && (
            <div className="flex items-center justify-between gap-3">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold disabled:opacity-40">
                <ArrowLeft size={16} /> Anterior
              </button>
              <span className="text-xs font-semibold text-slate-500">Página {page} de {summary?.last_page}</span>
              <button type="button" disabled={page >= (summary?.last_page ?? 1)} onClick={() => setPage((p) => p + 1)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold disabled:opacity-40">
                Siguiente <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
      ) : (
        <section role="tabpanel" className="max-w-4xl space-y-5 rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-[var(--brand-soft)] p-3 text-[var(--brand)]"><MailCheck size={23} /></span>
            <div>
              <h2 className="text-xl font-black text-[var(--steel)]">Correos destinatarios</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Cada consulta se guarda en la base de datos y se intenta enviar una copia a todos estos correos.
                Puedes agregar hasta 10 destinatarios. Separarlos por línea, coma o punto y coma.
              </p>
            </div>
          </div>
          <form onSubmit={(event) => void saveSettings(event)} className="space-y-5">
            <label className="block text-sm font-semibold text-[var(--steel)]">
              Destinatarios de notificación
              <textarea rows={6} value={emailsText} onChange={(event) => setEmailsText(event.target.value)}
                disabled={!canManageSettings || saving} placeholder="servicioalcliente@gaspronal.com"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-slate-50 p-4 font-mono text-sm leading-7 outline-none focus:border-[var(--brand)] disabled:opacity-60" />
            </label>
            <div className="flex flex-wrap gap-2">
              {recipients.map((email, index) => (
                <span key={index} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{email}</span>
              ))}
            </div>
            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <MailWarning size={17} className="mt-0.5 shrink-0" />
              El servidor debe tener SMTP operativo. Si el correo falla, el mensaje seguirá guardado en el listado con su estado.
            </p>
            {canManageSettings ? (
              <button type="submit" disabled={saving}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-6 text-sm font-black text-white hover:bg-[var(--brand-hover)] disabled:opacity-50">
                {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
                {saving ? "Guardando…" : "Guardar destinatarios"}
              </button>
            ) : (
              <span className="text-sm text-slate-500">Configuración de solo lectura.</span>
            )}
          </form>
        </section>
      )}

      {selected && (
        <div className="fixed inset-0 z-[90] flex justify-end" role="dialog" aria-modal="true" aria-label={"Mensaje de " + selected.first_name + " " + selected.last_name}>
          <button type="button" className="absolute inset-0 bg-slate-950/55" aria-label="Cerrar detalle"
            onClick={() => setSelected(null)} />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-7">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--brand)]">Consulta #{selected.id}</p>
                <h2 className="mt-2 text-2xl font-black text-[var(--steel)]">{selected.first_name} {selected.last_name}</h2>
                <p className="mt-1 text-xs text-slate-500">{formatDate(selected.created_at)}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Cerrar detalle"
                className="rounded-xl border border-slate-200 p-2 text-slate-600"><X size={21} /></button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
              <div className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Correo</p>
                  <a href={"mailto:" + selected.email} className="mt-1 block break-all font-semibold text-[var(--brand)]">{selected.email}</a>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Teléfono</p>
                  <a href={"tel:" + selected.phone.replace(/[^+\d]/g, "")} className="mt-1 block font-semibold text-[var(--brand)]">{selected.phone}</a>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Asunto</p>
                <p className="mt-2 font-black text-[var(--steel)]">{selected.subject}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Mensaje</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{selected.message}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-sm">
                <p className="font-black text-[var(--steel)]">Estado de notificación</p>
                <p className="mt-2 text-slate-600">{statusNames[selected.notification_status] ?? selected.notification_status}</p>
                <p className="mt-1 text-xs text-slate-500">Último envío: {formatDate(selected.notification_sent_at)}</p>
                {selected.notification_error && <p className="mt-2 text-xs text-red-700">{selected.notification_error}</p>}
                <p className="mt-3 text-xs font-bold text-slate-500">Destinatarios del intento</p>
                <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                  {selected.notification_recipients?.join(", ") || "Sin destinatarios configurados"}
                </p>
                <p className="mt-4 text-xs text-slate-500">Consentimiento recibido: {formatDate(selected.consent_at)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] p-5 sm:p-6">
              <button type="button" onClick={() => setSelected(null)}
                className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold">Cerrar</button>
              {canManage && (
                <button type="button" disabled={busyId === selected.id} onClick={() => void resend(selected)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-black text-white disabled:opacity-50">
                  {busyId === selected.id ? <LoaderCircle size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                  Reenviar correo
                </button>
              )}
              {selected.read_at && <Check size={16} className="text-emerald-600" />}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
