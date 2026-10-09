"use client";

import {useCallback,useEffect,useState} from "react";
import {FiImage,FiSearch,FiX,FiCheck} from "react-icons/fi";

type Asset={name:string;url:string;collection:string};
type Props={collection?: "iconos";value?:string|null;onSelect:(url:string)=>Promise<void>|void;label?:string;disabled?:boolean};
export default function MultimediaPicker({collection="iconos",value,onSelect,label="Seleccionar multimedia",disabled=false}:Props){
 const [open,setOpen]=useState(false);
 const [items,setItems]=useState<Asset[]>([]);
 const [query,setQuery]=useState("");
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState<string|null>(null);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
   setLoading(true);setError("");
   try{
     const response=await fetch(`/api/admin/multimedia?collection=${encodeURIComponent(collection)}`,{cache:"no-store"});
     const data=await response.json();
     if(!response.ok)throw new Error(data.message??"No fue posible cargar la biblioteca.");
     setItems(data.data??[]);
   }catch(e){setError(e instanceof Error?e.message:"Error de conexión.");}
   finally{setLoading(false);}
 },[collection]);
 useEffect(()=>{if(open)void load();},[open,load]);
 useEffect(()=>{
   if(!open)return;
   const key=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!saving)setOpen(false);};
   window.addEventListener("keydown",key);
   const previous=document.body.style.overflow;document.body.style.overflow="hidden";
   return()=>{window.removeEventListener("keydown",key);document.body.style.overflow=previous;};
 },[open,saving]);
 async function select(url:string){
   setSaving(url);setError("");
   try{await onSelect(url);setOpen(false);}
   catch(e){setError(e instanceof Error?e.message:"No se pudo seleccionar la imagen.");}
   finally{setSaving(null);}
 }
 const filtered=items.filter(item=>item.name.toLowerCase().includes(query.toLowerCase().trim()));
 return <>
   <button type="button" disabled={disabled} onClick={()=>setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold transition hover:border-[var(--brand)] disabled:opacity-50"><FiImage/>{label}</button>
   {open&&<div className="fixed inset-0 z-[200] flex justify-end bg-slate-950/55" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)setOpen(false);}}>
     <section role="dialog" aria-modal="true" aria-label="Biblioteca multimedia" className="flex h-full w-full max-w-[760px] flex-col bg-[var(--surface)] text-[var(--app-fg)] shadow-2xl">
       <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5"><div><h2 className="text-xl font-bold">Biblioteca multimedia</h2><p className="mt-1 text-sm text-[var(--muted)]">Colección: {collection} · {items.length} archivos</p></div><button type="button" autoFocus onClick={()=>setOpen(false)} aria-label="Cerrar" className="grid size-10 place-items-center rounded-xl border border-[var(--border)]"><FiX/></button></header>
       <div className="relative m-5"><FiSearch className="absolute left-3 top-3.5 text-[var(--muted)]"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nombre de archivo…" className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent pl-10 pr-4 text-sm"/></div>
       {error&&<p role="alert" className="mx-5 mb-3 text-sm text-red-600">{error}</p>}
       <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
         {loading?<p className="py-10 text-center text-sm">Cargando imágenes…</p>:filtered.length===0?<p className="py-10 text-center text-sm text-[var(--muted)]">No hay imágenes disponibles.</p>:
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{filtered.map(item=><button type="button" disabled={!!saving} onClick={()=>void select(item.url)} key={item.url} aria-label={`Seleccionar ${item.name}`} className={`group overflow-hidden rounded-xl border-2 text-left transition hover:border-[var(--brand)] ${value===item.url?"border-[var(--brand)]":"border-[var(--border)]"}`}><span className="relative flex aspect-square items-center justify-center bg-white p-3"><img src={item.url} alt={item.name} loading="lazy" className="h-full w-full object-contain"/>{value===item.url&&<FiCheck className="absolute right-2 top-2 text-[var(--brand)]"/>}</span><span className="block truncate px-2 py-2 text-xs" title={item.name}>{saving===item.url?"Guardando…":item.name}</span></button>)}</div>}
       </div>
     </section>
   </div>}
 </>;
}
