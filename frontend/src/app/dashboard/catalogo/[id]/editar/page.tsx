"use client";

import Link from "next/link";
import { FiArrowLeft, FiExternalLink, FiSave, FiBox, FiTag, FiType, FiHash, FiLink2, FiFileText, FiActivity, FiDollarSign, FiCreditCard, FiPackage, FiSearch, FiMessageCircle, FiImage, FiUploadCloud, FiStar, FiTrash2 } from "react-icons/fi";
import { use, useEffect, useState } from "react";

type Category = { id:number; name:string; slug:string };

type CatalogForm = {
  type:"product"|"service";
  name:string;
  reference:string;
  slug:string;
  category_id:string;
  short_description:string;
  description:string;
  applications:string;
  status:"draft"|"published"|"archived";
  commercial_price:string;
  price_currency:string;
  price_unit:string;
  seo_title:string;
  seo_description:string;
  whatsapp_message:string;
};

type CatalogItem = {
  id:number;
  type:"product"|"service";
  name:string;
  reference?:string|null;
  slug:string;
  category_id?:number|null;
  short_description?:string|null;
  description?:string|null;
  applications?:string|null;
  status:"draft"|"published"|"archived";
  commercial_price?:string|null;
  price_currency?:string|null;
  price_unit?:string|null;
  seo_title?:string|null;
  seo_description?:string|null;
  whatsapp_message?:string|null;
  gallery?:unknown[]|null;
  og_image?:string|null;
  public_url:string;
};

function slugify(value:string){
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

export default function EditCatalogItemPage({ params }:{ params:Promise<{id:string}> }){
  const { id } = use(params);
  const [categories,setCategories]=useState<Category[]>([]);
  const [publicUrl,setPublicUrl]=useState("");
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [gallery,setGallery]=useState<string[]>([]);
  const [primaryImage,setPrimaryImage]=useState("");
  const [galleryMessage,setGalleryMessage]=useState("");
  const [uploading,setUploading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [activeTab,setActiveTab]=useState<"form"|"gallery">("form");
  const [form,setForm]=useState<CatalogForm>({
    type:"product",
    name:"",
    reference:"",
    slug:"",
    category_id:"",
    short_description:"",
    description:"",
    applications:"",
    status:"draft",
    commercial_price:"",
    price_currency:"COP",
    price_unit:"",
    seo_title:"",
    seo_description:"",
    whatsapp_message:"",
  });

  useEffect(()=>{
    async function load(){
      const [itemResponse,categoriesResponse]=await Promise.all([
        fetch(`/api/admin/catalog/items/${id}`),
        fetch("/api/admin/catalog/categories"),
      ]);
      const itemJson=await itemResponse.json();
      const categoriesJson=await categoriesResponse.json();

      if(!itemResponse.ok){
        setMessage(itemJson.message??"No fue posible cargar el producto.");
        setLoading(false);
        return;
      }

      const item:CatalogItem=itemJson.data;
      setCategories(categoriesJson.data??[]);
      setPublicUrl(item.public_url);
      const normalizedGallery=Array.from(new Set([
        item.og_image??"",
        ...(item.gallery??[])
          .map(image=>typeof image==="string"?image:(typeof image==="object"&&image&&"url" in image?String((image as {url?:unknown}).url??""):"")),
      ].filter(Boolean)));
      setGallery(normalizedGallery);
      setPrimaryImage(item.og_image??normalizedGallery[0]??"");
      setForm({
        type:item.type,
        name:item.name,
        reference:item.reference??"",
        slug:item.slug,
        category_id:item.category_id ? String(item.category_id) : "",
        short_description:item.short_description??"",
        description:item.description??"",
        applications:item.applications??"",
        status:item.status,
        commercial_price:item.commercial_price??"",
        price_currency:item.price_currency??"COP",
        price_unit:item.price_unit??"",
        seo_title:item.seo_title??"",
        seo_description:item.seo_description??"",
        whatsapp_message:item.whatsapp_message??"",
      });
      setLoading(false);
    }

    void load();
  },[id]);

  async function save(){
    if(saving||uploading)return;
    setMessage("");
    if(!form.name.trim()||!form.slug.trim()){
      setMessage("El nombre y el slug son obligatorios.");
      return;
    }
    setSaving(true);

    try {
    const response=await fetch(`/api/admin/catalog/items/${id}`,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        ...form,
        category_id:form.category_id ? Number(form.category_id) : null,
        reference:form.reference||null,
        short_description:form.short_description||null,
        description:form.description||null,
        applications:form.applications||null,
        seo_title:form.seo_title||null,
        seo_description:form.seo_description||null,
        whatsapp_message:form.whatsapp_message||null,
        commercial_price:form.commercial_price ? Number(form.commercial_price) : null,
        price_currency:form.price_currency||"COP",
        price_unit:form.price_unit||null,
      }),
    });

    const json=await response.json();
    if(!response.ok){
      setMessage(json.message??"No fue posible guardar los cambios.");
      return;
    }

    setPublicUrl(json.data.public_url??publicUrl);
    setMessage("Cambios guardados correctamente.");
    } catch {
      setMessage("No fue posible guardar los cambios. Intenta nuevamente.");
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

    const response=await fetch(`/api/admin/catalog/items/${id}/gallery`,{
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
    setPrimaryImage(json.data?.og_image??"");
    setGalleryMessage("Galería actualizada correctamente.");
  }

  async function makePrimary(image:string){
    setGalleryMessage("");
    const response=await fetch(`/api/admin/catalog/items/${id}/gallery/primary`,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({image}),
    });
    const json=await response.json().catch(()=>({}));

    if(!response.ok){
      setGalleryMessage(json.message??"No fue posible establecer la imagen principal.");
      return;
    }

    setPrimaryImage(json.data?.og_image??image);
    setGalleryMessage("Imagen principal actualizada.");
  }

  async function removeGalleryImage(image:string){
    if(!confirm("¿Eliminar esta imagen de la galería?"))return;
    setGalleryMessage("");

    const response=await fetch(`/api/admin/catalog/items/${id}/gallery`,{
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
    setPrimaryImage(json.data?.og_image??"");
    setGalleryMessage("Imagen eliminada.");
  }

  if(loading){
    return <div className="w-full max-w-none py-8 text-sm text-[var(--muted)]">Cargando producto…</div>;
  }

  return <div className="w-full max-w-none space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/dashboard/catalogo" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium">
        <FiArrowLeft size={16}/>Volver
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        {publicUrl&&<a href={`https://www.gaspronal.com${publicUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium">
          <FiExternalLink size={16}/>Ver original
        </a>}
        <button type="button" onClick={()=>void save()} disabled={saving||uploading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          <FiSave size={17}/>{saving?"Guardando…":"Guardar cambios"}
        </button>
      </div>
    </div>

    {message&&<p role="status" className="text-sm font-medium text-[var(--brand)]">{message}</p>}

    <header>
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Catálogo</span>
      <h1 className="mt-2 text-3xl font-bold">Editar producto o servicio</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Compara con la publicación histórica antes de modificar slug, contenido o SEO.</p>
    </header>

    <div className="flex gap-2 border-b border-[var(--border)]">
      <button
        type="button"
        onClick={()=>setActiveTab("form")}
        className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition ${
          activeTab==="form"
            ?"border-[var(--brand)] text-[var(--brand)]"
            :"border-transparent text-[var(--muted)] hover:text-[var(--app-fg)]"
        }`}
      >
        <FiFileText size={16}/>
        Formulario
      </button>
      <button
        type="button"
        onClick={()=>setActiveTab("gallery")}
        className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition ${
          activeTab==="gallery"
            ?"border-[var(--brand)] text-[var(--brand)]"
            :"border-transparent text-[var(--muted)] hover:text-[var(--app-fg)]"
        }`}
      >
        <FiImage size={16}/>
        Galería
        {gallery.length>0&&(
          <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand)]">
            {gallery.length}
          </span>
        )}
      </button>
    </div>

    {activeTab==="form"&&<form onSubmit={e=>{e.preventDefault();void save();}} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="grid content-start gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiBox className="text-[var(--brand)]"/>Tipo</span>
            <select value={form.type} onChange={e=>setForm({...form,type:e.target.value as CatalogForm["type"]})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3">
              <option value="product">Producto</option>
              <option value="service">Servicio</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiTag className="text-[var(--brand)]"/>Categoría</span>
            <select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3">
              <option value="">Sin categoría</option>
              {categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiType className="text-[var(--brand)]"/>Nombre</span>
            <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiHash className="text-[var(--brand)]"/>Referencia / tipo</span>
            <input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiLink2 className="text-[var(--brand)]"/>Slug</span>
            <input required value={form.slug} onChange={e=>setForm({...form,slug:slugify(e.target.value)})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiActivity className="text-[var(--brand)]"/>Estado</span>
            <select value={form.status} onChange={e=>setForm({...form,status:e.target.value as CatalogForm["status"]})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3">
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiDollarSign className="text-[var(--brand)]"/>Precio comercial privado</span>
            <input type="number" min="0" step="0.01" value={form.commercial_price} onChange={e=>setForm({...form,commercial_price:e.target.value})} placeholder="No visible en la web pública" className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
            <span className="block text-xs text-[var(--muted)]">Sólo dashboard y Claudio pueden consultar este valor.</span>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiCreditCard className="text-[var(--brand)]"/>Moneda</span>
            <input value={form.price_currency} maxLength={3} onChange={e=>setForm({...form,price_currency:e.target.value.toUpperCase()})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiPackage className="text-[var(--brand)]"/>Unidad del precio</span>
            <input value={form.price_unit} onChange={e=>setForm({...form,price_unit:e.target.value})} placeholder="Ej. unidad, metro, servicio" className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiSearch className="text-[var(--brand)]"/>SEO title</span>
            <input value={form.seo_title} onChange={e=>setForm({...form,seo_title:e.target.value})} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"/>
          </label>
        </div>

        <div className="grid content-start gap-4">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiFileText className="text-[var(--brand)]"/>Descripción corta</span>
            <textarea value={form.short_description} onChange={e=>setForm({...form,short_description:e.target.value})} rows={4} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiFileText className="text-[var(--brand)]"/>Descripción</span>
            <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={10} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiActivity className="text-[var(--brand)]"/>Aplicaciones</span>
            <textarea value={form.applications} onChange={e=>setForm({...form,applications:e.target.value})} rows={5} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiSearch className="text-[var(--brand)]"/>SEO description</span>
            <textarea value={form.seo_description} onChange={e=>setForm({...form,seo_description:e.target.value})} rows={4} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3"/>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium"><FiMessageCircle className="text-[var(--brand)]"/>Mensaje de WhatsApp</span>
            <textarea value={form.whatsapp_message} onChange={e=>setForm({...form,whatsapp_message:e.target.value})} rows={4} className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3"/>
          </label>
        </div>
      </div>

    </form>}

    {activeTab==="gallery"&&<section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><FiImage className="text-[var(--brand)]"/>Galería de imágenes</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Puedes subir varias imágenes y elegir cuál será la principal del producto.</p>
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
          <p className="mt-3 text-sm font-medium">Este producto todavía no tiene imágenes en la galería.</p>
        </div>
      ):(
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {gallery.map((image,index)=>{
            const isPrimary=image===primaryImage;
            return <article key={image} className={`overflow-hidden rounded-xl border bg-[var(--surface)] ${isPrimary?"border-[var(--brand)] ring-2 ring-[var(--brand-soft)]":"border-[var(--border)]"}`}>
              <div className="aspect-[4/3] bg-[var(--app-bg)]">
                <img src={image} alt={`${form.name} - imagen ${index+1}`} className="h-full w-full object-contain"/>
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
  </div>;
}
