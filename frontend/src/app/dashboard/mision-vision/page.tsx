"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Save } from "lucide-react";

type Field = { key: string; label: string; long?: boolean };
type Section = { key: string; label: string; description: string; fields: Field[] };

const sections: Section[] = [
  {
    key: "identidad", label: "Presentación", description: "Encabezado e introducción de la página institucional.",
    fields: [
      { key: "bar_text", label: "Franja superior" },
      { key: "hero_kicker", label: "Antetítulo" },
      { key: "hero_title", label: "Título principal" },
      { key: "hero_description", label: "Descripción", long: true },
    ],
  },
  {
    key: "mision", label: "Misión", description: "Propósito institucional y compromiso de Gaspronal.",
    fields: [
      { key: "mission_kicker", label: "Antetítulo" },
      { key: "mission_title", label: "Título" },
      { key: "mission_description", label: "Texto de la misión", long: true },
    ],
  },
  {
    key: "vision", label: "Visión", description: "Proyección y objetivos de la organización.",
    fields: [
      { key: "vision_kicker", label: "Antetítulo" },
      { key: "vision_title", label: "Título" },
      { key: "vision_description", label: "Texto de la visión", long: true },
    ],
  },
  {
    key: "valores", label: "Valores", description: "Introducción y descripciones de los cuatro valores empresariales.",
    fields: [
      { key: "values_kicker", label: "Antetítulo" },
      { key: "values_title", label: "Título" },
      { key: "values_description", label: "Introducción", long: true },
      { key: "safety_title", label: "Valor 1: título" },
      { key: "safety_description", label: "Valor 1: descripción", long: true },
      { key: "responsibility_title", label: "Valor 2: título" },
      { key: "responsibility_description", label: "Valor 2: descripción", long: true },
      { key: "teamwork_title", label: "Valor 3: título" },
      { key: "teamwork_description", label: "Valor 3: descripción", long: true },
      { key: "trust_title", label: "Valor 4: título" },
      { key: "trust_description", label: "Valor 4: descripción", long: true },
    ],
  },
  {
    key: "contacto", label: "Cierre", description: "Texto final y botones de la página. Los enlaces conservan sus destinos actuales.",
    fields: [
      { key: "cta_title", label: "Título" },
      { key: "cta_description", label: "Descripción", long: true },
      { key: "cta_products", label: "Botón de productos" },
      { key: "cta_advice", label: "Botón de asesoría" },
    ],
  },
];

export default function MisionVisionPage() {
  const [tab, setTab] = useState("mision");
  const [content, setContent] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await fetch("/api/admin/institutional", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "No fue posible cargar el contenido.");
        if (!mounted) return;
        setContent(payload.data ?? {});
        setSaved(payload.data ?? {});
        setCanManage(Boolean(payload.meta?.can_manage));
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : "Error de conexión.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const currentSection = useMemo(() => sections.find((item) => item.key === tab) ?? sections[0], [tab]);
  const changed = JSON.stringify(content) !== JSON.stringify(saved);

  function edit(key: string, value: string) {
    setContent((previous) => ({ ...previous, [key]: value }));
    setMessage("");
    setError("");
  }

  async function save() {
    if (!canManage || !changed || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/institutional", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "No fue posible guardar los cambios.");
      setSaved(payload.data);
      setContent(payload.data);
      setMessage("Cambios guardados. La página pública muestra ahora el contenido actualizado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--brand)]">Contenido institucional</span>
          <h1 className="mt-2 text-3xl font-bold">Misión y visión</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Administra los textos de «Somos Gaspronal» sin modificar el diseño del sitio.</p>
        </div>
        <Link href="/somos-gaspronal" target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--brand)]">
          <ExternalLink size={17} /> Ver página
        </Link>
      </header>

      {loading ? (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm">Cargando contenido institucional…</p>
      ) : Object.keys(content).length === 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          No se encontró el contenido institucional. Ejecuta el seeder InstitutionalContentSeeder en Laravel.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones institucionales">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                role="tab"
                aria-selected={tab === section.key}
                onClick={() => { setTab(section.key); setMessage(""); }}
                className={
                  "rounded-xl border px-4 py-2.5 text-sm font-semibold transition " +
                  (tab === section.key
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)]")
                }
              >{section.label}</button>
            ))}
          </div>

          <section role="tabpanel" className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
            <div>
              <h2 className="text-xl font-bold">{currentSection.label}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{currentSection.description}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {currentSection.fields.map((field) => (
                <label key={field.key} className={"block space-y-2 " + (field.long ? "md:col-span-2" : "")}>
                  <span className="text-sm font-semibold">{field.label}</span>
                  {field.long ? (
                    <textarea
                      rows={5}
                      value={content[field.key] ?? ""}
                      disabled={!canManage || saving}
                      onChange={(event) => edit(field.key, event.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-[var(--brand)] disabled:opacity-60"
                    />
                  ) : (
                    <input
                      type="text"
                      value={content[field.key] ?? ""}
                      disabled={!canManage || saving}
                      onChange={(event) => edit(field.key, event.target.value)}
                      className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--brand)] disabled:opacity-60"
                    />
                  )}
                </label>
              ))}
            </div>
          </section>

          {message && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} /> {message}</p>}
          {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} /> {error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[var(--muted)]">{changed ? "Hay modificaciones sin guardar." : "Contenido sincronizado."}</p>
            {canManage ? (
              <button type="button" onClick={() => void save()} disabled={!changed || saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-50">
                <Save size={18} /> {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            ) : <span className="text-sm text-[var(--muted)]">Acceso de solo lectura.</span>}
          </div>
        </>
      )}
      {!loading && error && Object.keys(content).length === 0 && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
