import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import PublicHeader from "@/components/public/PublicHeader";

const api = process.env.LARAVEL_API_URL ?? "http://127.0.0.1:8000";
const site = "https://gaspronal.programandoweb.net";
type Post = {title:string;slug:string;excerpt?:string|null;content?:string|null;featured_image?:string|null;gallery?:string[]|null;seo_title?:string|null;seo_description?:string|null;og_image?:string|null;published_at?:string|null};
async function getPost(slug:string):Promise<Post|null>{
  try {
    const res=await fetch(`${api}/api/v1/content/public/legacy-services/${encodeURIComponent(slug)}`,{cache:"no-store"});
    if(!res.ok)return null;
    return (await res.json()).data??null;
  }catch{return null;}
}
async function getRedirect(slug:string):Promise<string|null>{
  try{
    const path=`/2019/servicios/${slug}`;
    const res=await fetch(`${api}/api/v1/seo/redirects/resolve?path=${encodeURIComponent(path)}`,{cache:"no-store"});
    if(!res.ok)return null;
    const target=(await res.json()).data?.target_path;
    return typeof target==="string" && target.startsWith("/") && !target.startsWith("//") && target!==path ? target:null;
  }catch{return null;}
}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;const post=await getPost(slug);
  if(!post)return {robots:{index:false,follow:false}};
  const canonical=`${site}/2019/servicios/${post.slug}`;
  const image=post.og_image||post.featured_image;
  return {title:post.seo_title||post.title,description:post.seo_description||post.excerpt||undefined,
    alternates:{canonical},openGraph:{type:"article",url:canonical,title:post.seo_title||post.title,description:post.seo_description||post.excerpt||undefined,images:image?[image]:undefined},
    robots:{index:true,follow:true}};
}
export default async function LegacyServicePage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const post=await getPost(slug);
  if(!post){const target=await getRedirect(slug);if(target)permanentRedirect(target);notFound();}
  const gallery=Array.from(new Set([post.featured_image||"",...(post.gallery||[])].filter(Boolean)));
  const canonical=`${site}/2019/servicios/${post.slug}`;
  const structured=JSON.stringify({"@context":"https://schema.org","@type":"Service",name:post.title,description:post.seo_description||post.excerpt,url:canonical,provider:{"@type":"Organization",name:"Gaspronal"}}).replace(/</g,"\\u003c");
  return <main className="min-h-screen bg-white text-slate-800"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:structured}}/>
    <PublicHeader whatsappHref="https://wa.me/573045527575"/>
    <article className="mx-auto max-w-5xl px-5 py-14">
      <nav className="mb-8 text-sm text-slate-500"><Link href="/">Inicio</Link> / Servicios</nav>
      <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{post.title}</h1>
      {post.excerpt&&<p className="mt-6 text-lg leading-8 text-slate-600">{post.excerpt}</p>}
      {gallery[0]&&<Image src={gallery[0]} alt={post.title} width={1400} height={800} className="mt-10 h-auto w-full rounded-2xl object-cover"/>}
      {post.content&&<div className="mt-10 whitespace-pre-wrap text-base leading-8">{post.content}</div>}
      {gallery.length>1&&<div className="mt-10 grid gap-5 sm:grid-cols-2">{gallery.slice(1).map((src,i)=><Image key={src} src={src} alt={`${post.title} ${i+2}`} width={700} height={500} className="h-auto w-full rounded-xl object-cover"/>)}</div>}
    </article>
  </main>;
}
