import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend";
import { ArrowRight, ShieldCheck, Handshake, Users, HeartHandshake } from "lucide-react";
import PublicHeader from "@/components/public/PublicHeader";
import { GASPRONAL_WHATSAPP_HREF } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Somos Gaspronal | Misión, visión y valores",
  description: "Conoce la misión, visión y valores empresariales de Gaspronal Industrias y Servicios S.A.S.",
  alternates: { canonical: "/somos-gaspronal" },
  openGraph: {
    title: "Somos Gaspronal | Misión, visión y valores",
    description: "Nuestro compromiso con la seguridad, la responsabilidad, el trabajo en equipo y la confianza.",
    url: "/somos-gaspronal",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

async function loadInstitutionalContent(): Promise<Record<string, string>> {
  const response = await backendFetch("/page-blocks/public?page=somos-gaspronal");
  if (!response.ok) throw new Error("No fue posible cargar el contenido institucional.");
  const result = (await response.json()) as { data?: Array<{ block_key: string; content: Record<string, string> }> };
  const block = result.data?.find((item) => item.block_key === "institutional");
  if (!block) notFound();
  return block.content;
}

export default async function SomosGaspronalPage() {
  const content = await loadInstitutionalContent();
  const values = [
    { title: content.safety_title, description: content.safety_description, icon: ShieldCheck },
    { title: content.responsibility_title, description: content.responsibility_description, icon: Handshake },
    { title: content.teamwork_title, description: content.teamwork_description, icon: Users },
    { title: content.trust_title, description: content.trust_description, icon: HeartHandshake },
  ];
  return (
    <main className="min-h-screen bg-white text-[var(--foreground)]">
      <div className="bg-[var(--brand)] text-white">
        <div className="mx-auto flex min-h-9 max-w-[1440px] items-center justify-center px-4 text-center text-[11px] font-semibold tracking-[0.12em] sm:text-xs">
          {content.bar_text}
        </div>
      </div>
      <PublicHeader whatsappHref={GASPRONAL_WHATSAPP_HREF} />
      <section className="bg-[var(--steel)] px-4 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">{content.hero_kicker}</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-6xl">{content.hero_title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
            {content.hero_description}
          </p>
        </div>
      </section>
      <section className="mx-auto grid max-w-[1200px] gap-8 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-12">
        <article className="rounded-3xl border border-slate-200 p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">{content.mission_kicker}</p>
          <h2 className="mt-3 text-3xl font-black text-[var(--steel)]">{content.mission_title}</h2>
          <p className="mt-6 leading-8 text-slate-600">
            {content.mission_description}
          </p>
        </article>
        <article className="rounded-3xl border border-slate-200 p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">{content.vision_kicker}</p>
          <h2 className="mt-3 text-3xl font-black text-[var(--steel)]">{content.vision_title}</h2>
          <p className="mt-6 leading-8 text-slate-600">
            {content.vision_description}
          </p>
        </article>
      </section>
      <section className="bg-[var(--surface-muted)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">{content.values_kicker}</p>
          <h2 className="mt-3 text-3xl font-black text-[var(--steel)] sm:text-4xl">{content.values_title}</h2>
          <p className="mt-6 max-w-4xl leading-8 text-slate-600">
            {content.values_description}
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {values.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
                <Icon className="text-[var(--brand)]" size={30} aria-hidden="true" />
                <h3 className="mt-5 text-xl font-black text-[var(--steel)]">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="px-4 py-16 text-center sm:py-20">
        <h2 className="text-3xl font-black text-[var(--steel)]">{content.cta_title}</h2>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">{content.cta_description}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/productos" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--brand)] px-6 font-bold text-[var(--brand)]">{content.cta_products} <ArrowRight size={18} /></Link>
          <a href={GASPRONAL_WHATSAPP_HREF} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--brand)] px-6 font-bold text-white">{content.cta_advice} <ArrowRight size={18} /></a>
        </div>
      </section>
    </main>
  );
}
