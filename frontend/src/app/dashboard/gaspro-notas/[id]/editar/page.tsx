"use client";

import Link from "next/link";
import { FiArrowLeft, FiExternalLink, FiSave, FiType, FiLink2, FiTag, FiActivity, FiSearch, FiFileText, FiImage, FiUploadCloud, FiStar, FiTrash2 } from "react-icons/fi";
import { use, useEffect, useState } from "react";

type Category = { id:number; name:string; slug:string };
type PostForm = {
  title:string;
  slug:string;
  excerpt:string;
  content:string;
  category_id:string;
  service_topic_id:string;
  status:"draft"|"published"|"archived";
  seo_title:string;
  seo_description:string;
};
type Post = {
  id:number;
  title:string;
  slug:string;
  excerpt?:string|null;
  content?:string|null;
  category_id:number;
  service_topic_id?:number|null;
  status:"draft"|"published"|"archived";
  seo_title?:string|null;
  seo_description?:string|null;
  public_url:string;
  gallery?:unknown[]|null;
  featured_image?:string|null;
  og_image?:string|null;
};

function slugify(v:string){
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

export default function EditGasproNotaPage({ params }:{ params:Promise<{id:string}> }){
  const { id } = use(params);
  const [categories,setCategories]=useState<Category[]>([]);
  const [serviceTopics,setServiceTopics]=useState<Array<{id:number;name:string;image_url?:string|null}>>([]);
  const [publicUrl,setPublicUrl]=useState("");
  const [form,setForm]=useState<PostForm>({
    title:"",slug:"",excerpt:"",content:"",category_id:"",service_topic_id:"",status:"draft",seo_title:"",seo_description:""
  });
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);
  const [activeTab,setActiveTab]=useState<"form"|"gallery">("form");
  const [gallery,setGallery]=useState<string[]>([]);
  const [primaryImage,setPrimaryImage]=useState("");
  const [galleryMessage,setGalleryMessage]=useState("");
  const [uploading,setUploading]=useState(false);
  const [leonardoJobs,setLeonardoJobs]=useState<Array<{id:number;status:string;variant:number;error?:string|null;generated_image?:string|null}>>([]);
  const [leonardoPending,setLeonardoPending]=useState(0);
  const [requestingLeonardo,setRequestingLeonardo]=useState(false);
  const isService=categories.some(c=>c.slug==="servicios"&&String(c.id)===form.category_id);
  async function refreshLeonardo(){
    const response=await fetch(`/api/admin/content/posts/${id}/leonardo/status`,{cache:"no-store"});
    if(!response.ok)return;
    const body=await response.json();const data=body.data;
    setLeonardoJobs(data.jobs??[]);setLeonardoPending(data.pending??0);
    setGallery(old=>Array.from(new Set([...(data.gallery??[]),...old])));
    setPrimaryImage(data.featured_image??data.og_image??"");
  }
  async function generateLeonardo(){
    setRequestingLeonardo(true);setGalleryMessage("");
    const response=await fetch(`/api/admin/content/posts/${id}/leonardo/generate`,{method:"POST"});
    const data=await response.json().catch(()=>({}));setRequestingLeonardo(false);
    if(!response.ok){setGalleryMessage(data.message??"No fue posible enviar las imágenes a Leonardo.");return;}
    setGalleryMessage("Se añadieron 2 imágenes a la cola de Leonardo.");await refreshLeonardo();
  }
  useEffect(()=>{
    if(loading||!isService||activeTab!=="gallery")return;
    void refreshLeonardo();
    const timer=setInterval(()=>{void refreshLeonardo();},5000);
    return()=>clearInterval(timer);
  },[loading,isService,activeTab,id]);

  useEffect(()=>{
    async function load(){
      const [postResponse,categoriesResponse]=await Promise.all([
        fetch(`/api/admin/content/posts/${id}`),
        fetch("/api/admin/content/post-categories")
      ]);
      const postJson=await postResponse.json();
      const categoriesJson=await categoriesResponse.json();

      if(!postResponse.ok){
        setMessage(postJson.message??"No fue posible cargar la publicación.");
        setLoading(false);
        return;
      }

      const post:Post=postJson.data;
      setCategories(categoriesJson.data??[]);
      fetch("/api/v1/content/public/service-topics").then(r=>r.json()).then(j=>setServiceTopics(j.data??[])).catch(()=>{});
      setPublicUrl(post.public_url);
      const normalizedGallery=Array.from(new Set([
        post.featured_image??"",
        post.og_image??"",
        ...(post.gallery??[])
          .map(image=>typeof image==="string"?image:(typeof image==="object"&&image&&"url" in image?String((image as {url?:unknown}).url??""):"")),
      ].filter(Boolean)));
      setGallery(normalizedGallery);
      setPrimaryImage(post.featured_image??post.og_image??normalizedGallery[0]??"");
      setForm({
        title:post.title,
        slug:post.slug,
        excerpt:post.excerpt??"",
        content:post.content??"",
        category_id:String(post.category_id),
        service_topic_id:String(post.service_topic_id??""),
        status:post.status,
        seo_title:post.seo_title??"",
        seo_description:post.seo_description??""
      });
      setLoading(false);
    }
    void load();
  },[id]);

  async function save(e:React.FormEvent){
    e.preventDefault();
    setMessage("");
    setSaving(true);

    try {
    const response=await fetch(`/api/admin/content/posts/${id}`,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        ...form,
        category_id:Number(form.category_id),
        service_topic_id:isService&&form.service_topic_id?Number(form.service_topic_id):null,
        excerpt:form.excerpt||null,
        content:form.content||null,
        seo_title:form.seo_title||null,
        seo_description:form.seo_description||null
      })
    });

    const json=await response.json();
    if(!response.ok){
      setMessage(json.message??"No fue posible guardar los cambios.");
      return;
    }

    setPublicUrl(json.data.public_url??publicUrl);
    setMessage("Publicación actualizada correctamente.");
    } catch {
      setMessage("No fue posible conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadGallery(files:FileList|null){
    if(!files?.length)return;
    setUploading(true);
    setGalleryMessage("");

    const data=new FormData();
    Array.from(files).forEach(file=>data.append("images[]",file));

    const response=await fetch(`/api/admin/content/posts/${id}/gallery`,{
      method:"POST",
      body:data,
    });
    const json=await response.json().catch(()=>({}));
    setUploading(false);

    if(!response.ok){
      setGalleryMessage(json.message??"No fue posible subir las imágenes.");
      return;
    }

    setGallery(json.data?.gallery??[]);
    setPrimaryImage(json.data?.featured_image??json.data?.og_image??"");
    setGalleryMessage("Galería actualizada correctamente.");
  }

  async function makePrimary(image:string){
    setGalleryMessage("");
    const response=await fetch(`/api/admin/content/posts/${id}/gallery/primary`,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({image}),
    });
    const json=await response.json().catch(()=>({}));

    if(!response.ok){
      setGalleryMessage(json.message??"No fue posible establecer la imagen principal.");
      return;
    }

    setPrimaryImage(json.data?.featured_image??json.data?.og_image??image);
    setGalleryMessage("Imagen principal actualizada.");
  }

  async function removeGalleryImage(image:string){
    if(!confirm("¿Eliminar esta imagen de la galería?"))return;
    setGalleryMessage("");

    const response=await fetch(`/api/admin/content/posts/${id}/gallery`,{
      method:"DELETE",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({image}),
    });
    const json=await response.json().catch(()=>({}));

    if(!response.ok){
      setGalleryMessage(json.message??"No fue posible eliminar la imagen.");
      return;
    }

    setGallery(json.data?.gallery??[]);
    setPrimaryImage(json.data?.featured_image??json.data?.og_image??"");
    setGalleryMessage("Imagen eliminada.");
  }

  if(loading) return <div className="w-full max-w-none py-8 text-sm text-[var(--muted)]">Cargando publicación…</div>;

  return <div className="w-full max-w-none space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/dashboard/gaspro-notas" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium"><FiArrowLeft size={16}/>Volver</Link>
      <div className="flex flex-wrap items-center gap-3">
        {publicUrl&&<a href={publicUrl.startsWith("http")?publicUrl:`https://gaspronal.programandoweb.net${publicUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium"><FiExternalLink size={16}/>Ver original</a>}
        <button type="button" disabled={saving} onClick={()=>void save({preventDefault:()=>{}} as React.FormEvent)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 font-semibold text-white disabled:opacity-50"><FiSave size={17}/>{saving?"Guardando…":"Guardar cambios"}</button>
      </div>
    </div>

    <header>
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Contenido</span>
      <h1 className="mt-2 text-3xl font-bold">Editar publicación</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Edita el contenido manteniendo el slug histórico cuando tenga valor SEO.</p>
    </header>

    <div className="flex gap-2 border-b border-[var(--border)]">
      <button
        type="button"
        onClick={()=>setActiveTab("form")}
        className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition ${activeTab==="form"?"border-[var(--brand)] text-[var(--brand)]":"border-transparent text-[var(--muted)] hover:text-[var(--app-fg)]"}`}
      >
        <FiFileText size={16}/>Formulario
      </button>
      <button
        type="button"
        onClick={()=>setActiveTab("gallery")}
        className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition ${activeTab==="gallery"?"border-[var(--brand)] text-[var(--brand)]":"border-transparent text-[var(--muted)] hover:text-[var(--app-fg)]"}`}
      >
        <FiImage size={16}/>Galería
        {gallery.length>0&&<span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand)]">{gallery.length}</span>}
      </button>
      {publicUrl&&(
        <a
          href={publicUrl.startsWith("http")?publicUrl:`https://gaspronal.programandoweb.net${publicUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-4 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
        >
          <FiExternalLink size={16}/>Ver noticia
        </a>
      )}
    </div>

    {activeTab==="form"&&<form id="cms-post-form" onSubmit={save} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="grid content-start gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiType className="text-[var(--brand)]"/>Título</span>
            <input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiLink2 className="text-[var(--brand)]"/>Slug</span>
            <input required value={form.slug} onChange={e=>setForm({...form,slug:slugify(e.target.value)})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiTag className="text-[var(--brand)]"/>Categoría</span>
            <select required value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3">{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select>
          </label>
          {isService&&<label className="space-y-2"><span className="text-sm font-medium">Clasificación de servicio</span><select value={form.service_topic_id} onChange={e=>setForm({...form,service_topic_id:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"><option value="">Sin clasificación</option>{serviceTopics.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiActivity className="text-[var(--brand)]"/>Estado</span>
            <select value={form.status} onChange={e=>setForm({...form,status:e.target.value as PostForm["status"]})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select>
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

    </form>}

    {activeTab==="gallery"&&<section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      {isService&&<div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] p-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-bold">Leonardo · Imágenes del servicio</h3><p className="mt-1 text-sm">Genera dos imágenes profesionales con el contenido guardado de esta publicación. Cada nueva solicitud conserva las anteriores.</p><p className="mt-2 text-xs">{leonardoPending} en cola o procesando · {leonardoJobs.filter(j=>j.status==="completed").length} completadas · {leonardoJobs.filter(j=>j.status==="failed").length} fallidas</p></div><button type="button" disabled={requestingLeonardo} onClick={()=>void generateLeonardo()} className="min-h-11 rounded-xl bg-[var(--brand)] px-5 font-semibold text-white disabled:opacity-50">{requestingLeonardo?"Enviando…":"Generar 2 imágenes con Leonardo"}</button></div>{leonardoJobs.filter(j=>j.status==="failed").slice(0,2).map(j=><p key={j.id} className="mt-2 text-xs text-red-700">Trabajo {j.id}: {j.error}</p>)}</div>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><FiImage className="text-[var(--brand)]"/>Galería de imágenes</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Aquí aparecen también las 5 imágenes generadas por Lucía. Puedes subir más imágenes y elegir la principal/OG.</p>
        </div>

        <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-semibold text-white ${uploading?"pointer-events-none opacity-60":""}`}>
          <FiUploadCloud size={18}/>
          {uploading?"Subiendo…":"Subir imágenes"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={e=>{void uploadGallery(e.target.files);e.currentTarget.value="";}}
          />
        </label>
      </div>

      {gallery.length===0?(
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
          <FiImage className="mx-auto text-[var(--muted)]" size={34}/>
          <p className="mt-3 text-sm font-medium">Esta Gaspro-nota todavía no tiene imágenes en la galería.</p>
        </div>
      ):(
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {gallery.map((image,index)=>{
            const isPrimary=image===primaryImage;
            return <article key={image} className={`overflow-hidden rounded-xl border bg-[var(--surface)] ${isPrimary?"border-[var(--brand)] ring-2 ring-[var(--brand-soft)]":"border-[var(--border)]"}`}>
              <div className="aspect-[4/3] bg-[var(--app-bg)]">
                <img src={image} alt={`${form.title} - imagen ${index+1}`} className="h-full w-full object-contain"/>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] p-3">
                <button
                  type="button"
                  onClick={()=>void makePrimary(image)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold ${isPrimary?"bg-[var(--brand-soft)] text-[var(--brand)]":"border border-[var(--border)]"}`}
                  aria-pressed={isPrimary}
                >
                  <FiStar className={isPrimary?"fill-current":""}/>{isPrimary?"Principal":"Hacer principal"}
                </button>
                <button
                  type="button"
                  onClick={()=>void removeGalleryImage(image)}
                  className="grid size-9 place-items-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50"
                  aria-label="Eliminar imagen"
                  title="Eliminar imagen"
                >
                  <FiTrash2/>
                </button>
              </div>
            </article>;
          })}
        </div>
      )}

      {galleryMessage&&<p className="text-sm font-medium text-[var(--brand)]">{galleryMessage}</p>}
    </section>}

    {message&&<p role="status" className="text-sm font-medium text-[var(--brand)]">{message}</p>}
  </div>;
}
