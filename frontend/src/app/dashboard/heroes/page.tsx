"use client";

import { useEffect, useMemo, useState } from "react";
import { FiEye, FiEyeOff, FiImage, FiPlus, FiSave, FiTrash2 } from "react-icons/fi";

type CardItem = { title: string; text: string };
type HeroSlide = {
  id: number;
  section_key: string;
  option: number;
  sort_order: number;
  is_active: boolean;
  interval_ms: number;
  image_url: string;
  background_position: string;
  eyebrow: string | null;
  title: string;
  accent: string | null;
  description: string | null;
  primary_label: string | null;
  primary_href: string | null;
  secondary_label: string | null;
  secondary_href: string | null;
  cards: CardItem[] | null;
};

const options = [1, 2, 3, 4, 5] as const;
const sectionPresets = [
  { key: "home.hero", label: "Home / Hero principal" },
  { key: "productos.hero", label: "Productos / Hero" },
  { key: "servicios.hero", label: "Servicios / Hero" },
  { key: "gaspro-notas.hero", label: "Gaspro-notas / Hero" },
  { key: "contacto.hero", label: "Contacto / Hero" },
] as const;
const emptyCards: CardItem[] = [
  { title: "Bloque 1", text: "Descripción" },
  { title: "Bloque 2", text: "Descripción" },
  { title: "Bloque 3", text: "Descripción" },
];

export default function HeroesPage() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [activeOption, setActiveOption] = useState<number>(2);
  const [activeSection, setActiveSection] = useState("home.hero");
  const [sectionInput, setSectionInput] = useState("home.hero");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [activeOptions, setActiveOptions] = useState<Record<string, number>>({});
  const [savingDefault, setSavingDefault] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/heroes", { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(json.message ?? "No fue posible cargar los heroes.");
      return;
    }
    setSlides(json.data ?? []);
    setCanManage(Boolean(json.meta?.can_manage));
    setActiveOptions(json.meta?.active_options ?? {});
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleSlides = useMemo(
    () => slides
      .filter((slide) => slide.section_key === activeSection && slide.option === activeOption)
      .sort((a, b) => a.sort_order - b.sort_order),
    [slides, activeOption, activeSection]
  );

  function patch(id: number, field: keyof HeroSlide, value: HeroSlide[keyof HeroSlide]) {
    setSlides((current) => current.map((slide) => (slide.id === id ? { ...slide, [field]: value } : slide)));
  }

  function patchCard(id: number, index: number, field: keyof CardItem, value: string) {
    setSlides((current) =>
      current.map((slide) => {
        if (slide.id !== id) return slide;
        const cards = [...(slide.cards ?? emptyCards)].slice(0, 3);
        while (cards.length < 3) cards.push({ title: "", text: "" });
        cards[index] = { ...cards[index], [field]: value };
        return { ...slide, cards };
      })
    );
  }

  async function save(slide: HeroSlide) {
    setBusyId(slide.id);
    setMessage("");
    const response = await fetch(`/api/admin/heroes/${slide.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slide),
    });
    const json = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setMessage(json.message ?? "No fue posible guardar el slide.");
      return;
    }
    setMessage("Slide guardado correctamente.");
    await load();
  }

  async function setDefault(option: number) {
    setSavingDefault(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/heroes/active-option", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_key: activeSection, active_option: option }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message ?? "No fue posible establecer la propuesta.");
      setActiveOptions((current) => ({ ...current, [activeSection]: option }));
      setMessage(`Propuesta ${option} establecida como predeterminada para ${activeSection}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al actualizar la propuesta.");
    } finally {
      setSavingDefault(false);
    }
  }

  async function createSlide() {
    setMessage("");
    const current = slides.filter((slide) => slide.section_key === activeSection && slide.option === activeOption);
    const response = await fetch("/api/admin/heroes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section_key: activeSection,
        option: activeOption,
        sort_order: current.length,
        is_active: true,
        interval_ms: 3000,
        image_url: "/programandoweb/opengraph/home-opengraph.jpg",
        background_position: "center",
        eyebrow: "Gaspronal",
        title: "Nuevo mensaje",
        accent: "destacado.",
        description: "Edita el contenido de este nuevo slide.",
        primary_label: "Hablar con un asesor",
        primary_href: "https://wa.me/573045527575",
        secondary_label: "Ver productos",
        secondary_href: "#productos",
        cards: emptyCards,
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.message ?? "No fue posible crear el slide.");
      return;
    }
    setSlides((currentSlides) => [...currentSlides, json.data]);
  }

  async function remove(slide: HeroSlide) {
    if (!confirm(`¿Eliminar el slide "${slide.title}"?`)) return;
    const response = await fetch(`/api/admin/heroes/${slide.id}`, { method: "DELETE" });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setMessage(json.message ?? "No fue posible eliminar el slide.");
      return;
    }
    setSlides((current) => current.filter((item) => item.id !== slide.id));
  }

  async function uploadImage(slide: HeroSlide, file: File) {
    setBusyId(slide.id);
    const form = new FormData();
    form.append("image", file);
    const response = await fetch(`/api/admin/heroes/${slide.id}/image`, { method: "POST", body: form });
    const json = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setMessage(json.message ?? "No fue posible subir la imagen.");
      return;
    }
    setSlides((current) => current.map((item) => (item.id === slide.id ? json.data : item)));
    setMessage("Imagen actualizada.");
  }

  return (
    <div className="w-full max-w-none space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Contenido / Constructor visual</span>
          <h1 className="mt-2 text-3xl font-bold">Diseño · Héroes</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Administra héroes y carruseles por ubicación. <strong>home.hero</strong> está conectado al home actual; las demás ubicaciones quedan disponibles para reutilizar el mismo constructor en otras páginas.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => void createSlide()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white"
          >
            <FiPlus /> Nuevo slide
          </button>
        )}
      </header>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Ubicación / section key</span>
            <input
              list="hero-section-presets"
              value={sectionInput}
              onChange={(e) => setSectionInput(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
              className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              placeholder="home.hero"
            />
            <datalist id="hero-section-presets">
              {sectionPresets.map((section) => <option key={section.key} value={section.key}>{section.label}</option>)}
            </datalist>
          </label>
          <button
            type="button"
            onClick={() => {
              if (!sectionInput.trim()) return;
              setActiveSection(sectionInput.trim());
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold"
          >
            Administrar ubicación
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {sectionPresets.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => {
                setSectionInput(section.key);
                setActiveSection(section.key);
              }}
              className={
                "rounded-lg border px-3 py-2 text-xs font-semibold " +
                (activeSection === section.key
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "border-[var(--border)]")
              }
            >
              {section.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Ubicación activa: <strong>{activeSection}</strong>
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setActiveOption(option)}
            className={
              "rounded-xl border px-4 py-2 text-sm font-semibold transition " +
              (activeOption === option
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--border)] bg-[var(--surface)]")
            }
          >
            Propuesta {option}
          </button>
        ))}
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div>
          <p className="text-sm font-semibold">Propuesta publicada: {activeOptions[activeSection] ?? 1}</p>
          <p className="text-xs text-[var(--muted)]">Selecciona arriba la propuesta y publícala como predeterminada. El home siempre mostrará esta selección.</p>
        </div>
        {canManage && (
          <button type="button" disabled={savingDefault || activeOption === (activeOptions[activeSection] ?? 1)}
            onClick={() => void setDefault(activeOption)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50">
            <FiSave /> {savingDefault ? "Publicando…" : "Establecer propuesta " + activeOption + " como predeterminada"}
          </button>
        )}
      </section>

      {message && <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">{message}</p>}

      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">Cargando heroes…</div>
      ) : (
        <div className="space-y-5">
          {visibleSlides.map((slide, index) => (
            <section key={slide.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--app-bg)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <strong>Slide {index + 1}</strong>
                  <span className="ml-3 text-xs text-[var(--muted)]">ID {slide.id}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        onClick={() => patch(slide.id, "is_active", !slide.is_active)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold"
                      >
                        {slide.is_active ? <FiEye /> : <FiEyeOff />}
                        {slide.is_active ? "Activo" : "Inactivo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void save(slide)}
                        disabled={busyId === slide.id}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        <FiSave /> Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(slide)}
                        className="grid size-10 place-items-center rounded-xl border border-red-200 text-red-600"
                        title="Eliminar slide"
                      >
                        <FiTrash2 />
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)]">
                      Solo lectura
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-4">
                <label className="space-y-2 lg:col-span-2">
                  <span className="text-xs font-bold uppercase text-[var(--muted)]">Imagen de fondo / URL</span>
                  <input disabled={!canManage} value={slide.image_url} onChange={(e) => patch(slide.id, "image_url", e.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase text-[var(--muted)]">Posición</span>
                  <input disabled={!canManage} value={slide.background_position} onChange={(e) => patch(slide.id, "background_position", e.target.value)} placeholder="center 38%" className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase text-[var(--muted)]">Intervalo ms</span>
                  <input disabled={!canManage} type="number" min={1000} max={15000} step={250} value={slide.interval_ms} onChange={(e) => patch(slide.id, "interval_ms", Number(e.target.value))} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
                </label>

                <label className="space-y-2 lg:col-span-3">
                  <span className="text-xs font-bold uppercase text-[var(--muted)]">Subir nueva imagen</span>
                  <span className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-4 text-sm font-semibold">
                    <FiImage />
                    Seleccionar JPG, PNG o WebP
                    <input disabled={!canManage} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadImage(slide, file);
                      e.currentTarget.value = "";
                    }} />
                  </span>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase text-[var(--muted)]">Orden</span>
                  <input disabled={!canManage} type="number" min={0} value={slide.sort_order} onChange={(e) => patch(slide.id, "sort_order", Number(e.target.value))} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
                </label>

                <label className="space-y-2 lg:col-span-2">
                  <span className="text-xs font-bold uppercase text-[var(--muted)]">Badge</span>
                  <input disabled={!canManage} value={slide.eyebrow ?? ""} onChange={(e) => patch(slide.id, "eyebrow", e.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase text-[var(--muted)]">Título</span>
                  <input disabled={!canManage} value={slide.title} onChange={(e) => patch(slide.id, "title", e.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase text-[var(--muted)]">Texto naranja</span>
                  <input disabled={!canManage} value={slide.accent ?? ""} onChange={(e) => patch(slide.id, "accent", e.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
                </label>

                <label className="space-y-2 lg:col-span-4">
                  <span className="text-xs font-bold uppercase text-[var(--muted)]">Descripción</span>
                  <textarea disabled={!canManage} value={slide.description ?? ""} onChange={(e) => patch(slide.id, "description", e.target.value)} rows={3} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm" />
                </label>

                {[
                  ["primary_label", "Botón principal", "primary_href", "URL principal"],
                  ["secondary_label", "Botón secundario", "secondary_href", "URL secundaria"],
                ].map(([labelKey, labelTitle, hrefKey, hrefTitle]) => (
                  <div key={labelKey} className="grid gap-4 lg:col-span-2 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase text-[var(--muted)]">{labelTitle}</span>
                      <input disabled={!canManage} value={String(slide[labelKey as keyof HeroSlide] ?? "")} onChange={(e) => patch(slide.id, labelKey as keyof HeroSlide, e.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase text-[var(--muted)]">{hrefTitle}</span>
                      <input disabled={!canManage} value={String(slide[hrefKey as keyof HeroSlide] ?? "")} onChange={(e) => patch(slide.id, hrefKey as keyof HeroSlide, e.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
                    </label>
                  </div>
                ))}

                <div className="lg:col-span-4">
                  <span className="text-xs font-bold uppercase text-[var(--muted)]">Bloques derechos</span>
                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    {[0, 1, 2].map((cardIndex) => {
                      const card = (slide.cards ?? emptyCards)[cardIndex] ?? { title: "", text: "" };
                      return (
                        <div key={cardIndex} className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-4">
                          <input disabled={!canManage} value={card.title} onChange={(e) => patchCard(slide.id, cardIndex, "title", e.target.value)} placeholder="Título" className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold" />
                          <textarea disabled={!canManage} value={card.text} onChange={(e) => patchCard(slide.id, cardIndex, "text", e.target.value)} placeholder="Descripción" rows={2} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          ))}

          {visibleSlides.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--muted)]">
              Esta ubicación/propuesta todavía no tiene slides. Puedes crear el primero con “Nuevo slide”.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
