"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiDownload,
  FiFolder,
  FiPlus,
  FiSearch,
  FiTag,
  FiTrash2,
  FiX,
} from "react-icons/fi";

type Category={
  id:number;
  name:string;
  slug:string;
  description?:string|null;
  items_count?:number;
};

type PaginationMeta={
  current_page:number;
  last_page:number;
  per_page:number;
  total:number;
  from:number|null;
  to:number|null;
};

export default function CatalogCategoriesPage(){
  const [items,setItems]=useState<Category[]>([]);
  const [search,setSearch]=useState("");
  const [appliedSearch,setAppliedSearch]=useState("");
  const [page,setPage]=useState(1);
  const [perPage,setPerPage]=useState(10);
  const [meta,setMeta]=useState<PaginationMeta>({
    current_page:1,last_page:1,per_page:10,total:0,from:null,to:null,
  });
  const [loading,setLoading]=useState(true);
  const [exporting,setExporting]=useState(false);
  const [message,setMessage]=useState("");

  async function load(targetPage=page){
    setLoading(true);
    setMessage("");

    const params=new URLSearchParams({
      page:String(targetPage),
      per_page:String(perPage),
    });
    if(appliedSearch.trim())params.set("search",appliedSearch.trim());

    const response=await fetch(`/api/admin/catalog/categories?${params.toString()}`,{cache:"no-store"});
    const json=await response.json().catch(()=>({}));
    setLoading(false);

    if(!response.ok){
      setMessage(json.message??"No fue posible cargar las categorías.");
      return;
    }

    setItems(json.data??[]);
    setMeta({
      current_page:Number(json.current_page??targetPage),
      last_page:Number(json.last_page??1),
      per_page:Number(json.per_page??perPage),
      total:Number(json.total??0),
      from:json.from??null,
      to:json.to??null,
    });
    setPage(Number(json.current_page??targetPage));
  }

  useEffect(()=>{void load(1);},[appliedSearch,perPage]);

  function submitSearch(e:React.FormEvent){
    e.preventDefault();
    setAppliedSearch(search.trim());
  }

  function clearSearch(){
    setSearch("");
    setAppliedSearch("");
  }

  async function downloadCategoryJson(){
    setExporting(true);
    setMessage("");
    try {
      const response=await fetch("/api/admin/catalog/categories/export/images",{cache:"no-store"});
      if(!response.ok){
        const body=await response.json().catch(()=>({}));
        throw new Error(body.message??"No se pudo generar el inventario.");
      }
      const data=await response.json();
      const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;
      anchor.download=`gaspronal-categorias-iconos-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }catch(error){
      setMessage(error instanceof Error?error.message:"No fue posible descargar el JSON.");
    }finally{
      setExporting(false);
    }
  }

  async function remove(item:Category){
    if(!confirm(`¿Eliminar la categoría "${item.name}"?`))return;

    const response=await fetch(`/api/admin/catalog/categories/${item.id}`,{method:"DELETE"});
    const json=await response.json().catch(()=>({}));

    if(!response.ok){
      setMessage(json.message??"No fue posible eliminar la categoría.");
      return;
    }

    const targetPage=items.length===1&&page>1?page-1:page;
    await load(targetPage);
  }

  function goToPage(nextPage:number){
    if(nextPage<1||nextPage>meta.last_page||nextPage===page)return;
    void load(nextPage);
  }

  const pageNumbers=Array.from(
    {length:Math.min(5,meta.last_page)},
    (_,index)=>{
      if(meta.last_page<=5)return index+1;
      const start=Math.min(Math.max(page-2,1),meta.last_page-4);
      return start+index;
    }
  );

  return <div className="w-full max-w-none space-y-6">
    <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <Link href="/dashboard/catalogo" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium">
          <FiArrowLeft/>Volver al catálogo
        </Link>
        <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Catálogo</span>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
          <FiTag className="text-[var(--brand)]"/>
          Categorías
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Organiza las categorías utilizadas por productos y servicios.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 self-start">
      <button type="button" disabled={exporting} onClick={()=>void downloadCategoryJson()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold disabled:opacity-50"><FiDownload/>{exporting?"Generando JSON…":"Descargar categorías JSON"}</button>
      <Link
        href="/dashboard/catalogo/categorias/nuevo"
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white"
      >
        <FiPlus/>Nueva categoría
      </Link>
      </div>
    </header>

    <form onSubmit={submitSearch} className="flex flex-col gap-2 lg:flex-row">
      <div className="relative min-w-0 flex-1">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/>
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar por nombre, slug o descripción..."
          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-10 pr-10 text-sm outline-none transition focus:border-[var(--brand)]"
        />
        {search&&(
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]"
            aria-label="Limpiar búsqueda"
            title="Limpiar búsqueda"
          >
            <FiX/>
          </button>
        )}
      </div>

      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-semibold text-white"
      >
        <FiSearch/>Buscar
      </button>
    </form>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
        Mostrar
        <select
          value={perPage}
          onChange={e=>setPerPage(Number(e.target.value))}
          className="min-h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--app-fg)] outline-none focus:border-[var(--brand)]"
          aria-label="Registros por página"
        >
          {[10,20,30,40,50].map(value=><option key={value} value={value}>{value}</option>)}
        </select>
        por página
      </label>

      <p className="text-sm text-[var(--muted)]">
        {meta.total>0?`Mostrando ${meta.from}–${meta.to} de ${meta.total}`:"0 registros"}
      </p>
    </div>

    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-left">
          <thead className="border-b border-[var(--border)] bg-[var(--app-bg)]">
            <tr className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="px-5 py-4">Categoría</th>
              <th className="px-5 py-4">Slug</th>
              <th className="px-5 py-4">Descripción</th>
              <th className="px-5 py-4">Elementos</th>
              <th className="px-5 py-4 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border)]">
            {loading&&(
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Cargando categorías…
                </td>
              </tr>
            )}

            {!loading&&items.map(item=>(
              <tr key={item.id} className="transition hover:bg-[var(--app-bg)]">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                      <FiFolder/>
                    </span>
                    <strong className="text-sm">{item.name}</strong>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-[var(--muted)]">{item.slug}</td>
                <td className="px-5 py-4">
                  <span className="block max-w-xl truncate text-sm text-[var(--muted)]">{item.description||"—"}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-bold text-[var(--brand)]">
                    {item.items_count??0}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/dashboard/catalogo/categorias/${item.id}/editar`}
                      className="grid size-10 place-items-center rounded-xl border border-[var(--border)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                      title="Editar categoría"
                      aria-label="Editar categoría"
                    >
                      <FiEdit2/>
                    </Link>
                    <button
                      type="button"
                      onClick={()=>void remove(item)}
                      className="grid size-10 place-items-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50"
                      title="Eliminar categoría"
                      aria-label="Eliminar categoría"
                    >
                      <FiTrash2/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading&&items.length===0&&(
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-[var(--muted)]">
                  No hay categorías para esta búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading&&meta.last_page>1&&(
        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">Página {meta.current_page} de {meta.last_page}</p>

          <nav className="flex flex-wrap items-center gap-2" aria-label="Paginación de categorías">
            <button
              type="button"
              onClick={()=>goToPage(page-1)}
              disabled={page<=1}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold disabled:opacity-40"
            >
              <FiChevronLeft/>Anterior
            </button>

            {pageNumbers.map(number=>(
              <button
                key={number}
                type="button"
                onClick={()=>goToPage(number)}
                aria-current={number===page?"page":undefined}
                className={`grid size-10 place-items-center rounded-xl border text-sm font-semibold ${
                  number===page
                    ?"border-[var(--brand)] bg-[var(--brand)] text-white"
                    :"border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                {number}
              </button>
            ))}

            <button
              type="button"
              onClick={()=>goToPage(page+1)}
              disabled={page>=meta.last_page}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold disabled:opacity-40"
            >
              Siguiente<FiChevronRight/>
            </button>
          </nav>
        </div>
      )}
    </section>

    {message&&<p className="text-sm font-medium text-red-700">{message}</p>}
  </div>;
}
