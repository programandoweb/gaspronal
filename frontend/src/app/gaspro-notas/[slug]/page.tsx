import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import PublicHeader from "@/components/public/PublicHeader";

const backendUrl = process.env.LARAVEL_API_URL ?? "http://127.0.0.1:8000";
const fallbackWhatsappNumber = "573045527575";
const whatsappMessage = "Hola Gaspronal, quiero recibir asesoría para mi proyecto.";

type Post = {
  title:string;
  slug:string;
  excerpt?:string|null;
  content?:string|null;
  featured_image?:string|null;
  og_image?:string|null;
  gallery?:string[]|null;
  seo_title?:string|null;
  seo_description?:string|null;
  published_at?:string|null;
  updated_at?:string|null;
};


async function getWhatsappNumber():Promise<string>{
  try{
    const response=await fetch(`${backendUrl}/api/v1/communications/public/whatsapp-link`,{
      cache:"no-store",
      headers:{Accept:"application/json"},
    });
    if(!response.ok)return fallbackWhatsappNumber;
    const payload=await response.json();
    const raw=String(payload.data?.whatsapp??"");
    const digits=raw.replace(/\D/g,"");
    return digits||fallbackWhatsappNumber;
  }catch{
    return fallbackWhatsappNumber;
  }
}

function buildWhatsappHref(number:string):string{
  return `https://wa.me/${number}?text=${encodeURIComponent(whatsappMessage)}`;
}

async function requestSiteUrl():Promise<string>{
  const requestHeaders=await headers();
  const host=(requestHeaders.get("x-forwarded-host")||requestHeaders.get("host")||"gaspronal.programandoweb.net")
    .split(",")[0]
    .trim();
  const proto=(requestHeaders.get("x-forwarded-proto")||"https")
    .split(",")[0]
    .trim();
  return `${proto}://${host}`.replace(/\/$/,"");
}

async function getPost(slug:string):Promise<Post|null>{
  const response=await fetch(`${backendUrl}/api/v1/content/public/posts/${encodeURIComponent(slug)}`,{
    cache:"no-store",
    headers:{Accept:"application/json"},
  });
  if(response.status===404)return null;
  if(!response.ok)return null;
  const payload=await response.json();
  return payload.data??null;
}

async function getRedirectTarget(slug:string):Promise<string|null>{
  const sourcePath=`/gaspro-notas/${slug}`;
  const response=await fetch(
    `${backendUrl}/api/v1/seo/redirects/resolve?path=${encodeURIComponent(sourcePath)}`,
    {cache:"no-store",headers:{Accept:"application/json"}},
  );
  if(!response.ok)return null;
  const payload=await response.json();
  return payload.data?.target_path??null;
}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const post=await getPost(slug);
  if(!post)return{robots:{index:false,follow:false}};
  const siteUrl=await requestSiteUrl();

  const title=post.seo_title||post.title;
  const description=post.seo_description||post.excerpt||"Contenido técnico y soluciones industriales de Gaspronal.";
  const canonical=`${siteUrl}/gaspro-notas/${post.slug}`;
  const imageVersion=encodeURIComponent(post.updated_at||post.published_at||"1");
  const socialImage=`${siteUrl}/api/og/gaspro-notas/${encodeURIComponent(post.slug)}?v=${imageVersion}`;

  return{
    title,
    description,
    alternates:{canonical},
    authors:[{name:"Gaspronal Industrias y Servicios S.A.S."}],
    creator:"Gaspronal Industrias y Servicios S.A.S.",
    publisher:"Gaspronal Industrias y Servicios S.A.S.",
    category:"Industria, gastronomía y soluciones a gas",
    keywords:[
      "Gaspronal",
      "equipos industriales",
      "gas natural",
      "gas propano",
      "acero inoxidable",
      "cocinas industriales",
      "servicio técnico",
      "extracción industrial",
    ],
    robots:{
      index:true,
      follow:true,
      googleBot:{
        index:true,
        follow:true,
        "max-image-preview":"large",
        "max-snippet":-1,
        "max-video-preview":-1,
      },
    },
    openGraph:{
      title,
      description,
      url:canonical,
      siteName:"Gaspronal",
      locale:"es_CO",
      type:"article",
      publishedTime:post.published_at||undefined,
      modifiedTime:post.updated_at||post.published_at||undefined,
      authors:["Gaspronal Industrias y Servicios S.A.S."],
      section:"Gaspro-notas",
      tags:["equipos industriales","gas","acero inoxidable","gastronomía","Gaspronal"],
      images:[{
        url:socialImage,
        width:1200,
        height:630,
        alt:`${post.title} · Gaspro-notas Gaspronal`,
        type:"image/png",
      }],
    },
    twitter:{
      card:"summary_large_image",
      title,
      description,
      images:[socialImage],
    },
  };
}

export default async function GasproNotaDetailPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const post=await getPost(slug);
  if(!post){
    const redirectTarget=await getRedirectTarget(slug);
    if(redirectTarget)permanentRedirect(redirectTarget);
    notFound();
  }
  const [siteUrl,whatsappNumber]=await Promise.all([
    requestSiteUrl(),
    getWhatsappNumber(),
  ]);
  const whatsappHref=buildWhatsappHref(whatsappNumber);

  const gallery=Array.from(new Set([post.featured_image||"",...(post.gallery||[])].filter(Boolean)));
  const canonical=`${siteUrl}/gaspro-notas/${post.slug}`;
  const socialImage=`${siteUrl}/api/og/gaspro-notas/${encodeURIComponent(post.slug)}?v=${encodeURIComponent(post.updated_at||post.published_at||"1")}`;
  const structuredData={
    "@context":"https://schema.org",
    "@type":"Article",
    headline:post.title,
    description:post.seo_description||post.excerpt||undefined,
    image:[socialImage,...gallery.map(image=>/^https?:\/\//i.test(image)?image:`${siteUrl}${image.startsWith("/")?image:`/${image}`}`)],
    datePublished:post.published_at||undefined,
    dateModified:post.updated_at||post.published_at||undefined,
    mainEntityOfPage:{"@type":"WebPage","@id":canonical},
    author:{"@type":"Organization",name:"Gaspronal Industrias y Servicios S.A.S.",url:siteUrl},
    publisher:{
      "@type":"Organization",
      name:"Gaspronal Industrias y Servicios S.A.S.",
      url:siteUrl,
      logo:{"@type":"ImageObject",url:`${siteUrl}/programandoweb/brand/logo-gaspronal-horizontal-full-color.png`},
    },
  };
  const breadcrumbs={
    "@context":"https://schema.org",
    "@type":"BreadcrumbList",
    itemListElement:[
      {"@type":"ListItem",position:1,name:"Inicio",item:siteUrl},
      {"@type":"ListItem",position:2,name:"Gaspro-notas",item:`${siteUrl}/gaspro-notas`},
      {"@type":"ListItem",position:3,name:post.title,item:canonical},
    ],
  };

  const safeStructuredData=JSON.stringify(structuredData).replace(/</g,"\\u003c");
  const safeBreadcrumbs=JSON.stringify(breadcrumbs).replace(/</g,"\\u003c");

  return <main className="min-h-screen bg-white text-[var(--foreground)]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeStructuredData}}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeBreadcrumbs}}/>
    <PublicHeader whatsappHref={whatsappHref}/>

    <article className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Gaspro-notas</p>
      <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-[var(--steel)] sm:text-6xl">{post.title}</h1>
      {post.excerpt&&<p className="mt-6 text-lg leading-8 text-slate-600">{post.excerpt}</p>}
      {post.published_at&&<p className="mt-4 text-sm font-semibold text-slate-400">{new Date(post.published_at).toLocaleDateString("es-CO")}</p>}

      {gallery[0]&&<div className="mt-10 overflow-hidden rounded-[2rem] bg-slate-100"><Image src={gallery[0]} alt={post.title} width={1400} height={875} className="h-auto w-full object-cover"/></div>}

      {post.content&&<div className="mt-10 whitespace-pre-wrap text-base leading-8 text-slate-700">{post.content}</div>}

      {gallery.length>1&&<div className="mt-12 grid gap-4 sm:grid-cols-2">
        {gallery.slice(1).map((image,index)=><div key={image} className="overflow-hidden rounded-[1.5rem] bg-slate-100"><Image src={image} alt={`${post.title} - imagen ${index+2}`} width={900} height={675} className="h-full w-full object-cover"/></div>)}
      </div>}
      <div className="mt-12 border-t border-slate-200 pt-8">
        <Link href="/gaspro-notas" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--brand)] px-6 text-sm font-black text-white transition hover:bg-[var(--brand-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"><ArrowLeft size={18} aria-hidden="true" /> Ver todas las Gaspro-Notas <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </article>
  </main>;
}
