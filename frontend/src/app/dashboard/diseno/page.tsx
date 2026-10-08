"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiExternalLink, FiPlus, FiSave, FiTrash2 } from "react-icons/fi";

type PageBlock = {
  id: number; page_key: string; block_key: string; label: string;
  content: Record<string, unknown>; is_active: boolean; sort_order: number;
};
const pages = [
  { key: "home", name: "Inicio", href: "/" },
  { key: "productos", name: "Productos", href: "/productos" },
  { key: "servicios", name: "Servicios", href: "/servicios" },
  { key: "gaspro-notas", name: "Gaspro-notas", href: "/gaspro-notas" },
];
const blockLabels: Record<string, string> = {
  services: "Servicios", products: "Catálogo de productos", advantages: "Ventajas",
  application: "Tecnología aplicada / Caso de aplicación",
};
const knownBlocks = [
  { block_key: "services", label: "Servicios", content: { eyebrow: "Qué hacemos", title: "Una solución completa, no solo un equipo.", description: "Gaspronal integra fabricación, gas, extracción y soporte técnico para resolver necesidades reales de operación." } },
  { block_key: "products", label: "Catálogo", content: { eyebrow: "Catálogo Gaspronal", title: "Equipamiento pensado para producción real." } },
  { block_key: "application", label: "Tecnología aplicada", content: { eyebrow: "Gaspronal", title: "Tecnología aplicada a la operación.", description: "La experiencia de Gaspronal conecta diseño, fabricación, instalación y mantenimiento para entregar soluciones integrales relacionadas con gas propano, gas natural y equipos industriales.", case_title: "Diseño de cocina, fabricación y extracción trabajando como un solo proyecto.", case_description: "El sitio histórico documenta proyectos donde Gaspronal ha integrado diseño de cocina, equipos industriales en acero inoxidable y sistemas de extracción." } },
];
export default function DesignPage() {
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [page, setPage] = useState("home");
  const [editing, setEditing] = useState<PageBlock | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/page-blocks", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "No fue posible consultar los bloques.");
      setBlocks(json.data ?? []);
      setCanManage(Boolean(json.meta?.can_manage));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error de conexión"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const current = useMemo(() => blocks.filter(item => item.page_key === page).sort((a,b) => a.sort_order-b.sort_order), [blocks,page]);
  function newBlock(key?: string) {
    const preset = knownBlocks.find(b => b.block_key === key);
    setEditing({ id: 0, page_key: page, block_key: preset?.block_key ?? "", label: preset?.label ?? "", content: preset?.content ?? { title: "", description: "" }, is_active: true, sort_order: current.length * 10 });
  }
  async function save() {
    if (!editing || !canManage) return;
    setMessage("");
    try {
      const response = await fetch(editing.id ? `/api/admin/page-blocks/${editing.id}` : "/api/admin/page-blocks", {
        method: editing.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? JSON.stringify(json.errors ?? "Error al guardar"));
      setEditing(null); await load(); setMessage("Bloque guardado.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Error al guardar"); }
  }
  async function remove(item: PageBlock) {
    if (!canManage || !window.confirm(`¿Eliminar ${item.label}?`)) return;
    const response = await fetch(`/api/admin/page-blocks/${item.id}`, { method: "DELETE" });
    if (response.ok) { setEditing(null); await load(); } else setMessage("No fue posible eliminar el bloque.");
  }
  return <div className="w-full space-y-6">
    <header className="flex flex-wrap justify-between gap-4 border-b border-[var(--border)] pb-5">
      <div><span className="text-xs font-bold uppercase tracking-widest text-[var(--brand)]">Contenido / Diseño</span>
        <h1 className="mt-2 text-3xl font-bold">Diseño de páginas</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Gestiona los textos y bloques de cada página sin cambiar su diseño actual.</p></div>
      <Link href="/dashboard/heroes" className="inline-flex h-11 items-center rounded-xl border border-[var(--border)] px-4 font-semibold">Administrar héroes →</Link>
    </header>
    <div className="flex flex-wrap gap-2">{pages.map(item => <button key={item.key} onClick={() => {setPage(item.key);setEditing(null);}} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${page===item.key?"bg-[var(--brand)] text-white":"border-[var(--border)]"}`}>{item.name}</button>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="text-xl font-bold">Bloques: {pages.find(item=>item.key===page)?.name}</h2>
      <div className="flex gap-2"><Link href={pages.find(item=>item.key===page)?.href ?? "/"} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><FiExternalLink/> Ver página</Link>
      {canManage && <button onClick={()=>newBlock()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-3 py-2 text-sm font-bold text-white"><FiPlus/> Nuevo bloque</button>}</div>
    </div>
    {message && <p role="status" className="rounded-xl border border-[var(--border)] p-3 text-sm">{message}</p>}
    {loading ? <p>Cargando bloques…</p> : <div className="space-y-2">
      {page==="home" && knownBlocks.filter(p=>!current.some(b=>b.block_key===p.block_key)).map(p=><div key={p.block_key} className="flex items-center justify-between border-b border-[var(--border)] py-4">
        <div><strong>{p.label}</strong><p className="text-sm text-[var(--muted)]">Contenido actual del sitio · Aún sin personalizar</p></div>
        {canManage && <button onClick={()=>newBlock(p.block_key)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Personalizar</button>}
      </div>)}
      {current.map(block=><div key={block.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] py-4">
        <div><strong>{block.label}</strong><p className="text-xs text-[var(--muted)]">{block.block_key} · Orden {block.sort_order} · {block.is_active?"Visible":"Desactivado"}</p></div>
        <div className="flex gap-2"><button onClick={()=>setEditing({...block})} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"><FiEdit2/> Editar</button>
        {canManage && <button onClick={()=>void remove(block)} aria-label="Eliminar" className="rounded-lg border border-red-200 px-3 py-2 text-red-600"><FiTrash2/></button>}</div>
      </div>)}
      {current.length===0 && page!=="home" && <p className="text-sm text-[var(--muted)]">Todavía no hay bloques configurados para esta página.</p>}
    </div>}
    {editing && <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-bold">{editing.id?"Editar bloque":"Nuevo bloque"}</h2>
      <div className="grid gap-4 md:grid-cols-4">
      {(["page_key","block_key","label","sort_order"] as const).map(field=><label key={field} className="space-y-1 text-xs font-semibold">{field}<input className="w-full rounded-lg border border-[var(--border)] p-3 text-sm" type={field==="sort_order"?"number":"text"} value={editing[field]} disabled={field==="page_key" || field==="block_key" && !!editing.id} onChange={e=>setEditing({...editing,[field]:field==="sort_order"?Number(e.target.value):e.target.value})}/></label>)}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_active} onChange={e=>setEditing({...editing,is_active:e.target.checked})}/> Activo</label>
      <p className="text-sm font-semibold">Campos del bloque</p>
      <div className="grid gap-4 md:grid-cols-2">{Object.entries(editing.content).map(([key,value])=><label key={key} className="space-y-1 text-xs font-semibold">{key}
      <textarea rows={3} className="w-full rounded-lg border border-[var(--border)] p-3 text-sm" value={typeof value==="string"?value:JSON.stringify(value)} onChange={e=>setEditing({...editing,content:{...editing.content,[key]:e.target.value}})}/></label>)}</div>
      {canManage && <button className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" onClick={()=>{const key=window.prompt("Nombre técnico del campo (ej. subtitle)");if(key&&/^[a-z_]+$/.test(key))setEditing({...editing,content:{...editing.content,[key]:""}})}}>+ Campo</button>}
      <div className="flex justify-end gap-2"><button onClick={()=>setEditing(null)} className="rounded-lg border border-[var(--border)] px-4 py-2">Cancelar</button>{canManage && <button onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 font-semibold text-white"><FiSave/> Guardar</button>}</div>
    </section>}
  </div>;
}
