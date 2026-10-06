import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ProductUseCasesCarousel, { type UseCaseProduct } from "@/components/public/ProductUseCasesCarousel";
import HomeHeroVariants, { type FullHeroSlide } from "@/components/public/HomeHeroVariants";
import PublicHeader from "@/components/public/PublicHeader";
import { GASPRONAL_WHATSAPP_HREF } from "@/lib/public-contact";
import {
  ArrowRight,
  Building2,
  Check,
  ChefHat,
  Flame,
  Gauge,
  Hammer,
  Settings,
  Wrench,
  Wind,
} from "lucide-react";

const whatsappHref = GASPRONAL_WHATSAPP_HREF;

const backendUrl = process.env.LARAVEL_API_URL ?? "http://127.0.0.1:8000";
const publicBackendUrl = (
  process.env.PUBLIC_BACKEND_URL ?? "https://backend.gaspronal.programandoweb.net"
).replace(/\/$/, "");
const homeOpenGraphImage = `${publicBackendUrl}/programandoweb/opengraph/home-opengraph.jpg`;

export const metadata: Metadata = {
  title: "Gaspronal | Equipos industriales y soluciones a gas",
  description:
    "Fabricación de equipos industriales en acero inoxidable, redes de gas, extracción industrial, mantenimiento y soluciones especiales a medida.",
  openGraph: {
    title: "Gaspronal | Equipos industriales y soluciones a gas",
    description:
      "Fabricación, instalación y servicio técnico para cocinas profesionales, industria de alimentos, redes de gas y extracción.",
    url: "https://gaspronal.programandoweb.net/",
    siteName: "Gaspronal",
    locale: "es_CO",
    type: "website",
    images: [
      {
        url: homeOpenGraphImage,
        width: 1200,
        height: 630,
        alt: "Fabricación industrial en acero inoxidable Gaspronal",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gaspronal | Equipos industriales y soluciones a gas",
    description:
      "Fabricación, instalación y servicio técnico para cocinas profesionales, industria de alimentos, redes de gas y extracción.",
    images: [homeOpenGraphImage],
  },
};

async function getManagedHeroes(): Promise<Record<number, FullHeroSlide[]>> {
  try {
    const response = await fetch(`${backendUrl}/api/v1/heroes/public?section=home.hero`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return {};

    const payload = await response.json();
    const result: Record<number, FullHeroSlide[]> = {};

    for (const [option, slides] of Object.entries(payload.data ?? {})) {
      result[Number(option)] = (slides as Array<Record<string, unknown>>).map((slide) => {
        const rawUrl = String(slide.image_url ?? "");
        const src = rawUrl.startsWith("/") ? publicBackendUrl + rawUrl : rawUrl;
        const cards = Array.isArray(slide.cards)
          ? slide.cards.map((card) => {
              const item = card as { title?: string; text?: string };
              return [String(item.title ?? ""), String(item.text ?? "")] as [string, string];
            })
          : [];

        return {
          src,
          position: String(slide.background_position ?? "center"),
          eyebrow: String(slide.eyebrow ?? ""),
          title: String(slide.title ?? ""),
          accent: String(slide.accent ?? ""),
          description: String(slide.description ?? ""),
          primaryLabel: String(slide.primary_label ?? ""),
          primaryHref: String(slide.primary_href ?? "#"),
          secondaryLabel: String(slide.secondary_label ?? ""),
          secondaryHref: String(slide.secondary_href ?? "#"),
          cards,
          intervalMs: Number(slide.interval_ms ?? 3000),
        };
      });
    }

    return result;
  } catch {
    return {};
  }
}

async function getUseCases(): Promise<UseCaseProduct[]> {
  try {
    const response = await fetch(`${backendUrl}/api/v1/catalog/public/use-cases`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return [];

    const payload = await response.json();
    return payload.data ?? [];
  } catch {
    return [];
  }
}

const services = [
  {
    icon: Hammer,
    title: "Fabricación industrial",
    description:
      "Equipos en acero inoxidable diseñados para restaurantes, panaderías, comidas rápidas y procesos de alimentos.",
  },
  {
    icon: Flame,
    title: "Redes de gas",
    description:
      "Instalación de redes de gas propano y natural para aplicaciones comerciales, industriales y residenciales.",
  },
  {
    icon: Wind,
    title: "Extracción industrial",
    description:
      "Montaje de sistemas de extracción para cocinas y espacios que exigen evacuación eficiente de humos.",
  },
  {
    icon: Wrench,
    title: "Servicio técnico",
    description:
      "Mantenimiento, reparación e instalación de equipos a gas domésticos e industriales.",
  },
];

const categories = [
  { icon: ChefHat, name: "Estufas industriales", detail: "Alto rendimiento para operación continua" },
  { icon: Gauge, name: "Freidoras", detail: "Control térmico y recuperación rápida" },
  { icon: Flame, name: "Hornos industriales", detail: "Soluciones para producción y cocción" },
  { icon: Wind, name: "Campanas extractoras", detail: "Extracción para cocinas profesionales" },
  { icon: Settings, name: "Equipos mixtos", detail: "Múltiples procesos en una sola estación" },
  { icon: Building2, name: "Mesas y mesones", detail: "Superficies robustas en acero inoxidable" },
];

const advantages = [
  "Desarrollo de equipos especiales a medida",
  "Acero inoxidable para aplicaciones de alimentos",
  "Soluciones para gas natural y propano",
  "Asesoría técnica desde la necesidad hasta la operación",
];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ option?: string }> }) {
  const [useCases, managedHeroes] = await Promise.all([getUseCases(), getManagedHeroes()]);
  const params = await searchParams;
  const requestedOption = Number(params.option ?? "1");
  const heroOption = Number.isInteger(requestedOption) && requestedOption >= 1 && requestedOption <= 5 ? requestedOption : 1;
  return (
    <main className="min-h-screen overflow-hidden bg-white text-[var(--foreground)]">
      <div className="bg-[var(--brand)] text-white">
        <div className="mx-auto flex min-h-9 max-w-[1440px] items-center justify-center px-4 text-center text-[11px] font-semibold tracking-[0.12em] sm:text-xs">
          FABRICACIÓN · SERVICIO TÉCNICO · GAS · EXTRACCIÓN INDUSTRIAL
        </div>
      </div>

      <PublicHeader whatsappHref={whatsappHref} />

      <HomeHeroVariants option={heroOption} publicBackendUrl={publicBackendUrl} managedSlides={managedHeroes} />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-y divide-slate-200 border-x border-slate-200 sm:grid-cols-4 sm:divide-y-0">
          {[
            ["Fabricación", "Equipos industriales"],
            ["Ingeniería", "Soluciones a medida"],
            ["Instalación", "Redes y extracción"],
            ["Soporte", "Mantenimiento técnico"],
          ].map(([title, text]) => (
            <div key={title} className="px-5 py-7 sm:px-7">
              <strong className="block text-sm font-black text-[#102d42]">{title}</strong>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="servicios" className="scroll-mt-28 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Qué hacemos</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.045em] text-[#102d42] sm:text-5xl">
                Una solución completa, no solo un equipo.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
                Gaspronal integra fabricación, gas, extracción y soporte técnico para resolver necesidades
                reales de operación.
              </p>
            </div>

            <div className="grid gap-px overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 sm:grid-cols-2">
              {services.map((service) => {
                const Icon = service.icon;
                return (
                  <article key={service.title} className="bg-white p-7 sm:p-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                      <Icon size={23} />
                    </div>
                    <h3 className="mt-6 text-xl font-black tracking-[-0.02em] text-[#102d42]">{service.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{service.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="productos" className="scroll-mt-28 bg-[#f4f8fb] py-20 sm:py-28">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Catálogo Gaspronal</p>
              <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.045em] text-[#102d42] sm:text-5xl">
                Equipamiento pensado para producción real.
              </h2>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <Link
                href="/productos"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-sm font-black text-white shadow-lg shadow-[var(--brand)]/15 transition hover:-translate-y-0.5 hover:bg-[var(--brand-hover)] hover:shadow-xl"
              >
                Ver catálogo completo
                <ArrowRight size={18} />
              </Link>
              <span className="inline-flex w-fit items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600">
                Explora todos los productos disponibles
              </span>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category, index) => {
              const Icon = category.icon;
              return (
                <article
                  key={category.name}
                  className={"group relative min-h-[260px] overflow-hidden rounded-[2rem] border p-7 transition duration-300 hover:-translate-y-1 hover:shadow-xl " +
                    (index === 0
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-slate-200 bg-white text-[#102d42]")}
                >
                  <div className="flex items-start justify-between gap-5">
                    <div
                      className={"flex h-12 w-12 items-center justify-center rounded-2xl " +
                        (index === 0 ? "bg-white/10 text-white" : "bg-[var(--brand-soft)] text-[var(--brand)]")}
                    >
                      <Icon size={23} />
                    </div>
                    <ArrowRight
                      size={22}
                      className={"transition group-hover:translate-x-1 " + (index === 0 ? "text-white/70" : "text-slate-400")}
                    />
                  </div>
                  <div className="absolute inset-x-7 bottom-7">
                    <p className={"text-xs font-bold uppercase tracking-[0.14em] " + (index === 0 ? "text-white/60" : "text-slate-400")}>
                      Línea de producto
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.03em]">{category.name}</h3>
                    <p className={"mt-2 text-sm leading-6 " + (index === 0 ? "text-white/75" : "text-slate-500")}>
                      {category.detail}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mt-7 text-sm leading-6 text-slate-500">
            El catálogo histórico incluye además carros para comidas y bebidas, baño maría, marmitas,
            fábricas de arepas, asadores, planchas y equipos para panadería.
          </p>
        </div>
      </section>

      <ProductUseCasesCarousel products={useCases} />

      <section id="ingenieria" className="scroll-mt-28 bg-[#0d2b40] py-20 text-white sm:py-28">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff9a5b]">Desarrollo especial</p>
            <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.05em] sm:text-6xl">
              Si el equipo que necesitas no existe, lo desarrollamos contigo.
            </h2>
          </div>
          <div className="lg:pt-10">
            <p className="text-base leading-7 text-slate-300 sm:text-lg">
              Gaspronal desarrolla equipos especiales en acero inoxidable a partir de las necesidades de
              operación de cada negocio: arepas, panadería, restaurantes, comidas rápidas y otros procesos
              de la industria de alimentos.
            </p>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)]"
            >
              Hablemos de tu proyecto
              <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </section>

      <section id="nosotros" className="scroll-mt-28 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="grid overflow-hidden rounded-[2.25rem] border border-slate-200 lg:grid-cols-2">
            <div className="p-7 sm:p-10 lg:p-14">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Gaspronal</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.045em] text-[#102d42] sm:text-5xl">
                Tecnología aplicada a la operación.
              </h2>
              <p className="mt-6 text-base leading-7 text-slate-600">
                La experiencia de Gaspronal conecta diseño, fabricación, instalación y mantenimiento para
                entregar soluciones integrales relacionadas con gas propano, gas natural y equipos
                industriales.
              </p>
              <div className="mt-8 grid gap-3">
                {advantages.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm font-semibold text-slate-700">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex min-h-[420px] flex-col justify-between bg-[#f4f8fb] p-7 sm:p-10 lg:p-14">
              <div>
                <span className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-[var(--brand)] shadow-sm">
                  Caso de aplicación
                </span>
                <h3 className="mt-6 text-3xl font-black tracking-[-0.035em] text-[#102d42] sm:text-4xl">
                  Diseño de cocina, fabricación y extracción trabajando como un solo proyecto.
                </h3>
              </div>
              <div className="mt-10 border-l-4 border-[var(--accent)] pl-5">
                <p className="text-sm leading-6 text-slate-600">
                  El sitio histórico documenta proyectos donde Gaspronal ha integrado diseño de cocina,
                  equipos industriales en acero inoxidable y sistemas de extracción.
                </p>
                <p className="mt-4 text-sm font-black text-[#102d42]">Gaspro-notas · Casos de éxito</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contacto" className="scroll-mt-28 border-t border-slate-200 bg-[#f7fafc] py-20 sm:py-24">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Contacto</p>
              <h2 className="mt-4 max-w-xl text-4xl font-black tracking-[-0.045em] text-[#102d42] sm:text-5xl">
                Empecemos por entender qué necesitas producir.
              </h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
                Un asesor puede orientarte sobre equipos, fabricación especial, redes de gas, instalación o
                servicio técnico.
              </p>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)]"
              >
                Solicitar asesoría
                <ArrowRight size={18} />
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-[2rem] border border-slate-200 bg-white p-7">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand)]">Medellín, Antioquia</p>
                <h3 className="mt-4 text-xl font-black text-[#102d42]">Sede Gaspronal</h3>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Carrera 45 No. 40-61<br />
                  Sector El Palo con Los Huesos
                </p>
                <div className="mt-6 space-y-2 text-sm font-semibold text-slate-700">
                  <a className="block hover:text-[var(--brand)]" href="tel:+573045527575">Ventas: 304 552 7575</a>
                  <a className="block hover:text-[var(--brand)]" href="tel:+573165251351">Servicio técnico: 316 525 1351</a>
                  <a className="block break-all hover:text-[var(--brand)]" href="mailto:servicioalcliente@gaspronal.com">
                    servicioalcliente@gaspronal.com
                  </a>
                </div>
              </article>

              <article className="rounded-[2rem] border border-slate-200 bg-white p-7">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand)]">Caucasia, Antioquia</p>
                <h3 className="mt-4 text-xl font-black text-[#102d42]">Almacén industrial</h3>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Carrera 9 No. 22-40<br />
                  Barrio Kennedy
                </p>
                <p className="mt-6 text-sm leading-6 text-slate-500">
                  Atención de lunes a sábado. Consulta disponibilidad y horario antes de desplazarte.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#092235] text-white">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-10">
          <div>
            <Image
              src="/programandoweb/brand/logo-gaspronal-2026-transparente.png"
              alt="Gaspronal"
              width={220}
              height={78}
              className="h-auto w-[180px] brightness-0 invert"
            />
            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300">
              Soluciones industriales en fabricación de equipos, gas, extracción y servicio técnico.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm font-semibold text-slate-300">
            <a className="hover:text-white" href="#productos">Productos</a>
            <a className="hover:text-white" href="#servicios">Servicios</a>
            <a className="hover:text-white" href="#ingenieria">A medida</a>
            <Link className="hover:text-white" href="/gaspro-notas">Gaspro-notas</Link>
            <a className="hover:text-white" href="#contacto">Contacto</a>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
            <span>© {new Date().getFullYear()} Gaspronal Industrias y Servicios S.A.S.</span>
            <span>Medellín · Colombia</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
