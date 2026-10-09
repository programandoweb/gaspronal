"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { FiArrowLeft, FiFileText, FiLink2, FiSave, FiTag, FiType } from "react-icons/fi";

type Category={
  id:number;
  name:string;
  slug:string;
  description?:string|null;
  is_active?:boolean;
  items_count?:number;
  image_url?:string|null;
};

function slugify(v:string){
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

export default function EditCategoryPage({params}:{params:Promise<{id:string}>}){
  const {id}=use(params);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [imageUrl,setImageUrl]=useState<string|null>(null);
  const [uploading,setUploading]=useState(false);
  const [form,setForm]=useState({name:"",slug:"",description:"",is_active:true,items_count:0});

  useEffect(()=>{
    async function load(){
      const response=await fetch(`/api/admin/catalog/categories/${id}`,{cache:"no-store"});
      const json=await response.json().catch(()=>({}));
      if(!response.ok){
        setMessage(json.message??"No fue posible cargar la categoría.");
        setLoading(false);
        return;
      }

      const item:Category=json.data;
      setImageUrl(item.image_url??null);
      setForm({
        name:item.name,
        slug:item.slug,
        description:item.description??"",
        is_active:item.is_active??true,
        items_count:item.items_count??0,
      });
      setLoading(false);
    }
    void load();
  },[id]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const response=await fetch(`/api/admin/catalog/categories/${id}`,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        name:form.name.trim(),
        slug:form.slug.trim()||slugify(form.name),
        description:form.description.trim()||null,
        is_active:form.is_active,
      }),
    });
    const json=await response.json().catch(()=>({}));
    setSaving(false);

    if(!response.ok){
      setMessage(json.message??"No fue posible guardar los cambios.");
      return;
    }

    setMessage("Categoría actualizada correctamente.");
  }

  async function uploadImage(file:File|undefined){
    if(!file)return;
    setUploading(true);setMessage("");
    const formData=new FormData();formData.append("image",file);
    const response=await fetch(`/api/admin/catalog/categories/${id}/image`,{method:"POST",body:formData});
    const data=await response.json().catch(()=>({}));setUploading(false);
    if(!response.ok){setMessage(data.message??"No fue posible subir la imagen.");return;}
    setImageUrl(data.data?.image_url??null);setMessage("Imagen de categoría actualizada.");
  }
  async function removeImage(){
    if(!confirm("¿Quitar la imagen personalizada y utilizar la selección automática?"))return;
    const response=await fetch(`/api/admin/catalog/categories/${id}/image`,{method:"DELETE"});
    if(response.ok){setImageUrl(null);setMessage("Se restauró la imagen automática.");}
    else setMessage("No fue posible quitar la imagen.");
  }

  if(loading)return <div className="w-full max-w-none py-8 text-sm text-[var(--muted)]">Cargando categoría…</div>;

  return <div className="w-full max-w-none space-y-6">
    <Link href="/dashboard/catalogo/categorias" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium">
      <FiArrowLeft/>Volver a categorías
    </Link>

    <header>
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Catálogo</span>
      <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold"><FiTag className="text-[var(--brand)]"/>Editar categoría</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{form.items_count} producto(s) o servicio(s) asociados.</p>
    </header>

    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 xl:col-span-2">
          <span className="flex items-center gap-2 text-sm font-medium"><FiType className="text-[var(--brand)]"/>Nombre</span>
          <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
        </label>

        <label className="space-y-2 xl:col-span-2">
          <span className="flex items-center gap-2 text-sm font-medium"><FiLink2 className="text-[var(--brand)]"/>Slug</span>
          <input required value={form.slug} onChange={e=>setForm({...form,slug:slugify(e.target.value)})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
        </label>

        <label className="space-y-2 md:col-span-2 xl:col-span-4">
          <span className="flex items-center gap-2 text-sm font-medium"><FiFileText className="text-[var(--brand)]"/>Descripción</span>
          <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={6} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3"/>
        </label>
      </div>

      <section className="space-y-3 rounded-xl border border-[var(--border)] p-4"><h2 className="text-sm font-bold">Imagen circular de la categoría (opcional)</h2><p className="text-xs text-[var(--muted)]">Si no defines una imagen, se seleccionará automáticamente una fotografía de los productos publicados, como hasta ahora.</p><div className="flex flex-wrap items-center gap-4">{imageUrl&&<img src={imageUrl} alt="Imagen actual de la categoría" className="size-24 rounded-full border-2 border-[var(--border)] object-cover"/>}<input aria-label="Cargar imagen de categoría" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e=>{void uploadImage(e.target.files?.[0]);e.target.value="";}} className="max-w-full text-sm"/>{imageUrl&&<button type="button" onClick={()=>void removeImage()} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Quitar imagen</button>}</div>{uploading&&<p className="text-sm">Subiendo imagen…</p>}</section>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/>
        Categoría activa
      </label>

      <button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 font-semibold text-white disabled:opacity-50">
        <FiSave/>{saving?"Guardando…":"Guardar cambios"}
      </button>

      {message&&<p className="text-sm font-medium text-[var(--brand)]">{message}</p>}
    </form>
  </div>;
}
