import type { Metadata } from "next";
import Link from "next/link";
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

const values = [
  { title: "Seguridad", description: "Cuidando su vida y su inversión como si fuera la nuestra.", icon: ShieldCheck },
  { title: "Responsabilidad", description: "Siendo coherentes con el pensar, el decir y el actuar, gracias a la transparencia, el respeto y el respaldo en la gestión.", icon: Handshake },
  { title: "Trabajo en equipo", description: 'Comprometidos con un propósito común, "El servicio al cliente".', icon: Users },
  { title: "Confianza", description: "Reconociendo la importancia de satisfacer su necesidad a tiempo con un serio compromiso.", icon: HeartHandshake },
];

export default function SomosGaspronalPage() {
  return (
    <main className="min-h-screen bg-white text-[var(--foreground)]">
      <div className="bg-[var(--brand)] text-white">
        <div className="mx-auto flex min-h-9 max-w-[1440px] items-center justify-center px-4 text-center text-[11px] font-semibold tracking-[0.12em] sm:text-xs">
          FABRICACIÓN · SERVICIO TÉCNICO · GAS · EXTRACCIÓN INDUSTRIAL
        </div>
      </div>
      <PublicHeader whatsappHref={GASPRONAL_WHATSAPP_HREF} />
      <section className="bg-[var(--steel)] px-4 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Nuestra identidad</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-6xl">Somos Gaspronal</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
            Gaspronal Industrias y Servicios S.A.S. Soluciones integrales en productos y servicios relacionados con gas propano y natural.
          </p>
        </div>
      </section>
      <section className="mx-auto grid max-w-[1200px] gap-8 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-12">
        <article className="rounded-3xl border border-slate-200 p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Nuestro propósito</p>
          <h2 className="mt-3 text-3xl font-black text-[var(--steel)]">Misión</h2>
          <p className="mt-6 leading-8 text-slate-600">
            Brindar al mercado industrial, comercial y residencial, soluciones integrales a tiempo en servicios y productos relacionados con gas propano y natural, gracias al compromiso en equipo y a la responsabilidad en los procesos con seguridad y respaldo permanente.
          </p>
        </article>
        <article className="rounded-3xl border border-slate-200 p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Nuestra proyección</p>
          <h2 className="mt-3 text-3xl font-black text-[var(--steel)]">Visión</h2>
          <p className="mt-6 leading-8 text-slate-600">
            GASPRONAL INDUSTRIAS Y SERVICIOS S.A.S. Para el año 2025, será una empresa líder a nivel regional en soluciones integrales en servicios y productos relacionados con gas propano y natural con proyección a mercados internacionales, gracias a la investigación permanente de aplicaciones que permitan el desarrollo sostenible garantizando una mejor calidad de vida a todos.
          </p>
        </article>
      </section>
      <section className="bg-[var(--surface-muted)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Lo que nos define</p>
          <h2 className="mt-3 text-3xl font-black text-[var(--steel)] sm:text-4xl">Valores empresariales</h2>
          <p className="mt-6 max-w-4xl leading-8 text-slate-600">
            Los valores son los crecimientos de la cultura humana y por tanto de la estrategia organización, éstos conforman los principios éticos y el soporte filosófico del ser y el que hacer de la empresa que permiten el logro de los objetivos gracias a la productividad, la calidad y el compromiso de satisfacción de sus clientes y del equipo de trabajo.
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
        <h2 className="text-3xl font-black text-[var(--steel)]">¿Cómo podemos ayudarte?</h2>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">Conoce nuestras soluciones o conversa con un asesor.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/productos" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--brand)] px-6 font-bold text-[var(--brand)]">Ver productos <ArrowRight size={18} /></Link>
          <a href={GASPRONAL_WHATSAPP_HREF} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--brand)] px-6 font-bold text-white">Solicitar asesoría <ArrowRight size={18} /></a>
        </div>
      </section>
    </main>
  );
}
