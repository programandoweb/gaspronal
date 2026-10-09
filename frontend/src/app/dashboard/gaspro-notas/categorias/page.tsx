"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {FiArrowLeft,FiEdit2,FiPlus,FiSave} from "react-icons/fi";

type Category={id:number;name:string;slug:string;description?:string|null;is_active:boolean;posts_count:number};
function slugify(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
export default function CmsCategoriesPage(){
  const [items,setItems]=useState<Category[]>([]);
  const [editing,setEditing]=useState<number|null>(null);
  const [name,setName]=useState("");const [slug,setSlug]=useState("");const [description,setDescription]=useState("");
  const [active,setActive]=useState(true);const [message,setMessage]=useState("");const [saving,setSaving]=useState(false);
  async function load(){
    const response=await fetch("/api/admin/content/post-categories",{cache:"no-store"});
    const json=await response.json().catch(()=>({}));
    if(response.ok)setItems(json.data??[]);else setMessage(json.message??"No fue posible cargar categorías.");
  }
  useEffect(()=>{void load();},[]);
  function reset(){setEditing(null);setName("");setSlug("");setDescription("");setActive(true);setMessage("");}
  function edit(item:Category){setEditing(item.id);setName(item.name);setSlug(item.slug);setDescription(item.description??"");setActive(item.is_active);setMessage("");}
  async function submit(event:React.FormEvent){
    event.preventDefault();setSaving(true);setMessage("");
    const response=await fetch(editing?`/api/admin/content/post-categories/${editing}`:"/api/admin/content/post-categories",{
      method:editing?"PUT":"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name,slug:slugify(slug||name),description,is_active:active})
    });
    const json=await response.json().catch(()=>({}));setSaving(false);
    if(!response.ok){setMessage(json.message??"No fue posible guardar la categoría.");return;}
    reset();await load();setMessage("Categoría guardada correctamente.");
  }
  return <div className="w-full space-y-6">
    <Link href="/dashboard/gaspro-notas" className="inline-flex items-center gap-2 text-sm font-semibold"><FiArrowLeft/>Volver a Gaspro CMS</Link>
    <header><h1 className="text-3xl font-bold">Categorías de Gaspro CMS</h1><p className="mt-2 text-sm text-[var(--muted)]">Organiza secciones editoriales. Las rutas existentes se conservan.</p></header>
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-4">
      <label className="text-sm">Nombre<input required value={name} onChange={e=>{setName(e.target.value);if(editing===null)setSlug(slugify(e.target.value));}} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-transparent px-3"/></label>
      <label className="text-sm">Slug<input required value={slug} onChange={e=>setSlug(slugify(e.target.value))} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-transparent px-3"/></label>
      <label className="text-sm">Descripción<input value={description} onChange={e=>setDescription(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-transparent px-3"/></label>
      <div className="flex flex-wrap items-end gap-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Activa</label><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 font-semibold text-white disabled:opacity-50">{editing?<FiSave/>:<FiPlus/>}{editing?"Guardar":"Crear"}</button>{editing&&<button type="button" onClick={reset} className="text-sm underline">Cancelar</button>}</div>
    </form>
    {message&&<p role="status" className="text-sm">{message}</p>}
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]"><table className="w-full text-left text-sm"><thead className="bg-[var(--surface)]"><tr><th className="p-4">Categoría</th><th className="p-4">Slug</th><th className="p-4">Publicaciones</th><th className="p-4">Estado</th><th className="p-4 text-right">Acción</th></tr></thead><tbody>{items.map(item=><tr key={item.id} className="border-t border-[var(--border)]"><td className="p-4 font-semibold">{item.name}</td><td className="p-4">{item.slug}</td><td className="p-4">{item.posts_count}</td><td className="p-4">{item.is_active?"Activa":"Inactiva"}</td><td className="p-4 text-right"><button type="button" aria-label={`Editar ${item.name}`} onClick={()=>edit(item)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3"><FiEdit2/>Editar</button></td></tr>)}</tbody></table></div>
  </div>;
}
