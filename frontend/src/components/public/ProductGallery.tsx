"use client";

import {useCallback,useEffect,useState} from "react";
import {ChevronLeft,ChevronRight,Expand,ImageOff,X} from "lucide-react";

type Props={images:string[];productName:string};
export default function ProductGallery({images,productName}:Props){
  const [selected,setSelected]=useState(0);
  const [expanded,setExpanded]=useState(false);
  const [failed,setFailed]=useState<string[]>([]);
  const current=images[selected];
  const next=useCallback((step:number)=>setSelected(index=>(index+step+images.length)%images.length),[images.length]);
  useEffect(()=>{
    if(!expanded)return;
    function onKey(event:KeyboardEvent){
      if(event.key==="Escape")setExpanded(false);
      if(event.key==="ArrowRight"&&images.length>1)next(1);
      if(event.key==="ArrowLeft"&&images.length>1)next(-1);
    }
    window.addEventListener("keydown",onKey);
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{window.removeEventListener("keydown",onKey);document.body.style.overflow=previous;};
  },[expanded,images.length,next]);
  function picture(src:string,large=false){
    return failed.includes(src)?<div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400"><ImageOff size={large?56:26}/><span className="text-xs">Imagen no disponible</span></div>:
      <img src={src} alt={`${productName} · fotografía ${selected+1} de ${images.length}`} loading={large?"eager":"lazy"} onError={()=>setFailed(old=>old.includes(src)?old:[...old,src])} className="h-full w-full object-contain"/>;
  }
  if(!images.length)return <div className="flex aspect-[4/3] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-slate-400"><ImageOff size={64}/></div>;
  return <div className="min-w-0">
    <div className="group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[1.75rem] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-sm">
      <div className="h-full w-full p-3 sm:p-6">{picture(current)}</div>
      <span className="absolute left-4 top-4 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm backdrop-blur">{selected+1} / {images.length}</span>
      <button type="button" onClick={()=>setExpanded(true)} aria-label="Ampliar imagen" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/95 text-slate-700 shadow-md transition hover:scale-105"><Expand size={19}/></button>
      {images.length>1&&<><button type="button" onClick={()=>next(-1)} aria-label="Imagen anterior" className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white bg-white/90 text-slate-800 shadow-lg transition hover:bg-white sm:left-5"><ChevronLeft size={24}/></button><button type="button" onClick={()=>next(1)} aria-label="Imagen siguiente" className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white bg-white/90 text-slate-800 shadow-lg transition hover:bg-white sm:right-5"><ChevronRight size={24}/></button></>}
    </div>
    {images.length>1&&<div className="mt-4 flex items-center gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]" aria-label="Miniaturas del producto">
      {images.map((src,index)=><button type="button" key={src} onClick={()=>setSelected(index)} aria-label={`Ver fotografía ${index+1}`} aria-pressed={selected===index} className={`relative size-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-slate-50 p-1 transition sm:size-24 ${selected===index?"border-[var(--brand)] shadow-md ring-2 ring-[var(--brand)]/20":"border-slate-200 opacity-75 hover:border-slate-400 hover:opacity-100"}`}>
        {failed.includes(src)?<ImageOff className="m-auto text-slate-300"/>:<img src={src} alt={`Miniatura ${index+1}`} loading="lazy" onError={()=>setFailed(old=>old.includes(src)?old:[...old,src])} className="h-full w-full rounded-xl object-cover"/>}
      </button>)}
    </div>}
    <p className="mt-1 text-xs text-slate-500">Selecciona una miniatura para explorar las fotografías. Pulsa ampliar para verlas en detalle.</p>
    {expanded&&<div role="dialog" aria-modal="true" aria-label={`Galería ampliada de ${productName}`} className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 p-4 text-white sm:p-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 pb-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{productName}</p><p className="text-xs text-slate-400">Fotografía {selected+1} de {images.length}</p></div><button type="button" onClick={()=>setExpanded(false)} autoFocus aria-label="Cerrar galería" className="grid size-12 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25"><X size={24}/></button></div>
      <div className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center"><div className="h-full w-full">{picture(current,true)}</div>{images.length>1&&<><button type="button" onClick={()=>next(-1)} aria-label="Anterior" className="absolute left-0 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25"><ChevronLeft/></button><button type="button" onClick={()=>next(1)} aria-label="Siguiente" className="absolute right-0 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25"><ChevronRight/></button></>}</div>
      {images.length>1&&<div className="mx-auto mt-4 flex max-w-full gap-2 overflow-x-auto py-2">{images.map((src,i)=><button type="button" key={src} aria-label={`Ver imagen ${i+1}`} onClick={()=>setSelected(i)} className={`size-14 shrink-0 overflow-hidden rounded-lg border-2 ${selected===i?"border-white":"border-transparent opacity-60"}`}><img src={src} alt="" className="h-full w-full object-cover"/></button>)}</div>}
    </div>}
  </div>;
}
