"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MapPinned, MessageCircle, X } from "lucide-react";

const MAP_LINK = "https://www.google.com/maps/search/?api=1&query=6.239973385551775%2C-75.57148302607125";

function normalizeColombianMobile(value: string): string | null {
  const digits = value.replace(/[\s().-]/g, "").replace(/^\+/, "");
  if (/^3\d{9}$/.test(digits)) return "57" + digits;
  if (/^573\d{9}$/.test(digits)) return digits;
  return null;
}

export default function LocationWhatsAppModal() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeColombianMobile(phone);
    if (!normalized) {
      setError("Ingresa un celular colombiano válido, por ejemplo 3115000926.");
      return;
    }
    setError("");
    const message = "Hola, te comparto la ubicación de Gaspronal, sede Medellín (Carrera 45 No. 40-61): " + MAP_LINK;
    const whatsappUrl = "https://wa.me/" + normalized + "?text=" + encodeURIComponent(message);
    // La plataforma WhatsApp requiere que el visitante confirme el envío.
    window.location.assign(whatsappUrl);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(""); }}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-[var(--brand-hover)] sm:w-auto"
      >
        <MessageCircle size={19} aria-hidden="true" /> Abre la ubicación en tu dispositivo
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 px-4 py-6"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-whatsapp-title"
            aria-describedby="location-whatsapp-description"
            className="w-full max-w-md rounded-3xl bg-white p-6 text-[var(--steel)] shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <MapPinned size={26} />
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full border border-slate-200"><X size={20} /></button>
            </div>
            <h2 id="location-whatsapp-title" className="mt-5 text-2xl font-black">Recibe nuestra ubicación por WhatsApp</h2>
            <p id="location-whatsapp-description" className="mt-3 text-sm leading-6 text-slate-600">
              Escribe el número de WhatsApp al que deseas compartir la ubicación de Gaspronal en Medellín.
            </p>
            <form onSubmit={submit} className="mt-6">
              <label htmlFor="location-phone" className="block text-sm font-bold">Número de WhatsApp (Colombia)</label>
              <input
                ref={inputRef}
                id="location-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="3115000926"
                value={phone}
                onChange={(event) => { setPhone(event.target.value); if (error) setError(""); }}
                aria-invalid={!!error}
                aria-describedby={error ? "location-phone-error" : undefined}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-[var(--brand)]"
                required
              />
              {error && <p id="location-phone-error" role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
              <p className="mt-2 text-xs leading-5 text-slate-500">Admite 3115000926, 573115000926 y +573115000926. No almacenamos el número en este formulario.</p>
              <button type="submit" className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 font-bold text-white hover:bg-[var(--brand-hover)]">
                <MessageCircle size={20} /> Continuar a WhatsApp
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-slate-500">WhatsApp abrirá el mensaje preparado para que confirmes su envío.</p>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
