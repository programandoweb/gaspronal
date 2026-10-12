"use client";

import { useEffect, useState } from "react";
import { Bot, LoaderCircle, Sparkles } from "lucide-react";

export default function RequestLuciaServiceImprovement({ slug }: { slug: string }) {
  const [permitted, setPermitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/auth/me", { cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(result => {
        if (!active) return;
        const roles: string[] = result?.data?.roles ?? [];
        const permissions: string[] = result?.data?.permissions ?? [];
        setPermitted(roles.includes("root") || (permissions.includes("agents.manage") && permissions.includes("content.manage")));
      }).catch(() => { if (active) setPermitted(false); });
    return () => { active = false; };
  }, []);

  async function requestImprovement() {
    if (busy || requested) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/services/" + encodeURIComponent(slug) + "/request-lucia", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message ?? "No fue posible enviar la solicitud.");
      setRequested(true);
      setMessage(result.message ?? "Solicitud enviada a Lucía.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrió un error.");
    } finally {
      setBusy(false);
    }
  }

  if (!permitted || slug !== "instalacion-reparacion-y-mantenimiento-de-equipos-a-gas-domesticos-e-industriales") return null;
  return (
    <aside className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6" aria-label="Herramientas editoriales autorizadas">
      <div className="flex items-center gap-2 text-sm font-bold text-[var(--brand)]"><Bot size={19} /> Herramienta editorial · Lucía</div>
      <p className="mt-2 text-sm leading-6 text-slate-700">Solicita a Lucía mejoras exclusivamente para esta ficha y propuestas de imágenes para su galería. La publicación requiere revisión administrativa.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void requestImprovement()} disabled={busy || requested} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 font-bold text-white disabled:opacity-60">
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {busy ? "Enviando…" : requested ? "Solicitud enviada" : "Solicitar mejora a Lucía"}
        </button>
      </div>
      {message && <p role="status" className="mt-3 text-sm text-slate-700">{message}</p>}
    </aside>
  );
}
