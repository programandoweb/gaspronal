"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FiArrowLeft,
  FiBookOpen,
  FiFileText,
  FiLink2,
  FiSave,
  FiSearch,
  FiTag,
  FiType,
} from "react-icons/fi";

type Category={id:number;name:string;slug:string};

type Form={
  title:string;
  slug:string;
  excerpt:string;
  content:string;
  category_id:string;
  status:"draft"|"published"|"archived";
  seo_title:string;
  seo_description:string;
};

function slugify(v:string){
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

export default function NewGasproNotaPage(){
  const router=useRouter();
  const [categories,setCategories]=useState<Category[]>([]);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [form,setForm]=useState<Form>({
    title:"",
    slug:"",
    excerpt:"",
    content:"",
    category_id:"",
    status:"draft",
    seo_title:"",
    seo_description:"",
  });

  useEffect(()=>{
    void fetch("/api/admin/content/post-categories")
      .then(r=>r.json())
      .then(j=>{
        const items=j.data??[];
        setCategories(items);
        setForm(current=>({...current,category_id:String(items[0]?.id??"")}));
      });
  },[]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const response=await fetch("/api/admin/content/posts",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        ...form,
        category_id:Number(form.category_id),
        excerpt:form.excerpt||null,
        content:form.content||null,
        seo_title:form.seo_title||null,
        seo_description:form.seo_description||null,
      }),
    });
    const json=await response.json().catch(()=>({}));
    setSaving(false);

    if(!response.ok){
      setMessage(json.message??"No fue posible crear la Gaspro-nota.");
      return;
    }

    router.push(`/dashboard/gaspro-notas/${json.data.id}/editar`);
  }

  return <div className="w-full max-w-none space-y-6">
    <Link
      href="/dashboard/gaspro-notas"
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium"
    >
      <FiArrowLeft/>Volver a Gaspro CMS
    </Link>

    <header>
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Contenido</span>
      <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
        <FiBookOpen className="text-[var(--brand)]"/>
        Nueva publicación
      </h1>
    </header>

    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="grid content-start gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiType className="text-[var(--brand)]"/>Título</span>
            <input required value={form.title} onChange={e=>setForm({...form,title:e.target.value,slug:slugify(e.target.value)})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiLink2 className="text-[var(--brand)]"/>Slug</span>
            <input required value={form.slug} onChange={e=>setForm({...form,slug:slugify(e.target.value)})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiTag className="text-[var(--brand)]"/>Categoría</span>
            <select required value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3">
              {categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Estado</span>
            <select value={form.status} onChange={e=>setForm({...form,status:e.target.value as Form["status"]})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3">
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiSearch className="text-[var(--brand)]"/>SEO title</span>
            <input value={form.seo_title} onChange={e=>setForm({...form,seo_title:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>
        </div>

        <div className="grid content-start gap-4">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiFileText className="text-[var(--brand)]"/>Resumen</span>
            <textarea value={form.excerpt} onChange={e=>setForm({...form,excerpt:e.target.value})} rows={4} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiFileText className="text-[var(--brand)]"/>Contenido</span>
            <textarea value={form.content} onChange={e=>setForm({...form,content:e.target.value})} rows={14} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiSearch className="text-[var(--brand)]"/>SEO description</span>
            <textarea value={form.seo_description} onChange={e=>setForm({...form,seo_description:e.target.value})} rows={4} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3"/>
          </label>
        </div>
      </div>

      <button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 font-semibold text-white disabled:opacity-50">
        <FiSave/>{saving?"Guardando…":"Crear Gaspro-nota"}
      </button>

      {message&&<p className="text-sm font-medium text-red-700">{message}</p>}
    </form>
  </div>;
}
