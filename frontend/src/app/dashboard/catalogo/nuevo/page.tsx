"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiBox, FiHash, FiLink2, FiSave, FiTag, FiType, FiActivity, FiFileText } from "react-icons/fi";

type Category={id:number;name:string;slug:string};
type CatalogForm={
  type:"product";
  name:string;
  reference:string;
  slug:string;
  category_id:string;
  short_description:string;
  description:string;
  status:"draft"|"published"|"archived";
};

function slugify(v:string){
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

export default function NewCatalogItemPage(){
  const router=useRouter();
  const [categories,setCategories]=useState<Category[]>([]);
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState<CatalogForm>({
    type:"product",name:"",reference:"",slug:"",category_id:"",short_description:"",description:"",status:"draft",
  });

  useEffect(()=>{
    void fetch("/api/admin/catalog/categories")
      .then(r=>r.json())
      .then(j=>setCategories(j.data??[]));
  },[]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const response=await fetch("/api/admin/catalog/items",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        ...form,
        category_id:form.category_id?Number(form.category_id):null,
        reference:form.reference||null,
        short_description:form.short_description||null,
        description:form.description||null,
      }),
    });
    const json=await response.json().catch(()=>({}));
    setSaving(false);

    if(!response.ok){
      setMessage(json.message??"No fue posible guardar.");
      return;
    }

    router.push(`/dashboard/catalogo/${json.data.id}/editar`);
  }

  return <div className="w-full max-w-none space-y-6">
    <div>
      <Link href="/dashboard/catalogo" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium">
        <FiArrowLeft/>Volver al catálogo
      </Link>
    </div>

    <header>
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Catálogo</span>
      <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold"><FiBox className="text-[var(--brand)]"/>Nuevo producto</h1>
    </header>

    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="grid content-start gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiTag className="text-[var(--brand)]"/>Categoría</span>
            <select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3">
              <option value="">Sin categoría</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiType className="text-[var(--brand)]"/>Nombre</span>
            <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value,slug:slugify(e.target.value)})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiHash className="text-[var(--brand)]"/>Referencia</span>
            <input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiLink2 className="text-[var(--brand)]"/>Slug</span>
            <input required value={form.slug} onChange={e=>setForm({...form,slug:slugify(e.target.value)})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiActivity className="text-[var(--brand)]"/>Estado</span>
            <select value={form.status} onChange={e=>setForm({...form,status:e.target.value as CatalogForm["status"]})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3">
              <option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option>
            </select>
          </label>
        </div>

        <div className="grid content-start gap-4">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiFileText className="text-[var(--brand)]"/>Descripción corta</span>
            <textarea value={form.short_description} onChange={e=>setForm({...form,short_description:e.target.value})} rows={5} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiFileText className="text-[var(--brand)]"/>Descripción</span>
            <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={12} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3"/>
          </label>
        </div>
      </div>

      <button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 font-semibold text-white disabled:opacity-50">
        <FiSave/>{saving?"Guardando…":"Crear y continuar"}
      </button>
      {message&&<p className="text-sm font-medium text-red-700">{message}</p>}
    </form>
  </div>;
}
