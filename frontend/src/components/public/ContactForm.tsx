"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Send, ShieldCheck } from "lucide-react";

type ContactFormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  website: string;
  consent: boolean;
};

const topics = [
  "Cotización de equipos",
  "Servicio técnico",
  "Redes de gas",
  "Fabricación a medida",
  "Otra consulta",
];

const emptyForm: ContactFormData = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  website: "",
  consent: false,
};

const fieldClass =
  "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[var(--steel)] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10 disabled:opacity-60";

export default function ContactForm() {
  const [fields, setFields] = useState<ContactFormData>(emptyForm);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function change<K extends keyof ContactFormData>(key: K, value: ContactFormData[K]) {
    setFields((previous) => ({ ...previous, [key]: value }));
    setError("");
    setSuccess("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        errors?: Record<string, string[]>;
      };

      if (!response.ok) {
        throw new Error(Object.values(payload.errors ?? {}).flat()[0] ??
          payload.message ?? "No fue posible enviar el mensaje. Inténtalo nuevamente.");
      }
      setFields({ ...emptyForm });
      setSuccess(payload.message ?? "Recibimos tu solicitud. Pronto nos comunicaremos contigo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="gaspronal-contact-form-title" className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.07)] sm:p-7 lg:p-8">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--brand)] to-[var(--accent)]" aria-hidden="true" />
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--brand)]">
          <Send size={14} aria-hidden="true" />
          Escríbenos
        </span>
        <h3 id="gaspronal-contact-form-title" className="mt-3 text-2xl font-black tracking-[-0.045em] text-[var(--steel)] sm:text-3xl">
          Cuéntanos sobre tu proyecto.
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Completa el formulario y un asesor de Gaspronal responderá tu solicitud.
        </p>
      </div>

      {success && (
        <p role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" /> {success}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label htmlFor="contact-first-name" className="block text-sm font-bold text-[var(--steel)]">
            Nombre <span className="text-[var(--accent)]">*</span>
            <input id="contact-first-name" required autoComplete="given-name" maxLength={100}
              value={fields.first_name} onChange={(event) => change("first_name", event.target.value)}
              placeholder="Tu nombre" className={fieldClass} disabled={sending} />
          </label>
          <label htmlFor="contact-last-name" className="block text-sm font-bold text-[var(--steel)]">
            Apellido <span className="text-[var(--accent)]">*</span>
            <input id="contact-last-name" required autoComplete="family-name" maxLength={100}
              value={fields.last_name} onChange={(event) => change("last_name", event.target.value)}
              placeholder="Tu apellido" className={fieldClass} disabled={sending} />
          </label>
          <label htmlFor="contact-email" className="block text-sm font-bold text-[var(--steel)]">
            Correo electrónico <span className="text-[var(--accent)]">*</span>
            <input id="contact-email" type="email" required autoComplete="email" maxLength={190}
              value={fields.email} onChange={(event) => change("email", event.target.value)}
              placeholder="correo@empresa.com" className={fieldClass} disabled={sending} />
          </label>
          <label htmlFor="contact-phone" className="block text-sm font-bold text-[var(--steel)]">
            Teléfono <span className="text-[var(--accent)]">*</span>
            <input id="contact-phone" type="tel" required autoComplete="tel" minLength={7} maxLength={40}
              value={fields.phone} onChange={(event) => change("phone", event.target.value)}
              placeholder="Número de contacto" className={fieldClass} disabled={sending} />
          </label>
        </div>
        <label htmlFor="contact-subject" className="block text-sm font-bold text-[var(--steel)]">
          ¿En qué podemos ayudarte? <span className="text-[var(--accent)]">*</span>
          <select id="contact-subject" required value={fields.subject} disabled={sending}
            onChange={(event) => change("subject", event.target.value)} className={fieldClass}>
            <option value="">Selecciona una opción</option>
            {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
          </select>
        </label>
        <label htmlFor="contact-message" className="block text-sm font-bold text-[var(--steel)]">
          Mensaje <span className="text-[var(--accent)]">*</span>
          <textarea id="contact-message" required minLength={10} maxLength={5000} rows={5}
            value={fields.message} onChange={(event) => change("message", event.target.value)}
            disabled={sending} placeholder="Cuéntanos qué necesitas, cantidades, ubicación o detalles del equipo…"
            className={fieldClass + " resize-y py-3 leading-6"} />
        </label>

        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label htmlFor="contact-website">No completar este campo</label>
          <input id="contact-website" type="text" tabIndex={-1} autoComplete="off"
            value={fields.website} onChange={(event) => change("website", event.target.value)} />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          <input type="checkbox" required checked={fields.consent} disabled={sending}
            onChange={(event) => change("consent", event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]" />
          <span>Autorizo el tratamiento de mis datos personales para atender y responder esta solicitud. <strong className="text-[var(--steel)]">*</strong></span>
        </label>

        <button type="submit" disabled={sending}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-black text-white shadow-[0_8px_20px_rgba(0,92,153,0.2)] transition hover:bg-[var(--brand-hover)] disabled:cursor-wait disabled:opacity-65">
          {sending ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> :
            <Send size={18} aria-hidden="true" />}
          {sending ? "Enviando mensaje…" : "Enviar mensaje"}
        </button>
        <p className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
          <ShieldCheck size={14} aria-hidden="true" />
          Tu consulta se registra de forma segura para su seguimiento.
        </p>
      </form>
    </section>
  );
}
