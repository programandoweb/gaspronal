"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Settings,
  ShieldCheck,
} from "lucide-react";

const whatsappHref =
  "https://wa.me/573045527575?text=Hola%20Gaspronal,%20quiero%20recibir%20asesor%C3%ADa%20para%20mi%20proyecto.";

const heroBackgroundOne =
  "https://www.gaspronal.com/2019/fotos/Image/cabezotesjq/Cabezote-Gaspronal-Web.jpg?1791214773376";
const heroBackgroundTwo =
  "https://www.gaspronal.com/2019/fotos/Image/cabezotesjq/Cabezote-Gaspronal-Web-2.jpg?1791214773955";

export type FullHeroSlide = {
  src: string;
  position?: string;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  cards: Array<[string, string]>;
  intervalMs?: number;
};

function HeroBackground({
  src,
  overlay = "bg-[var(--steel)]/75",
  position = "center",
}: {
  src: string;
  overlay?: string;
  position?: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{ backgroundImage: `url("${src}")`, backgroundPosition: position }}
      />
      <div className={"absolute inset-0 " + overlay} />
    </div>
  );
}

function FullHeroCarousel({
  slides,
}: {
  slides: FullHeroSlide[];
}) {
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || slides.length < 2) return;

    const timer = window.setTimeout(() => {
      setActive((current) => (current + 1) % slides.length);
    }, slides[active]?.intervalMs ?? 3000);

    return () => window.clearTimeout(timer);
  }, [active, reduceMotion, slides]);

  const slide = slides[active];

  return (
    <section className="relative h-[1040px] overflow-hidden bg-[var(--steel)] text-white sm:h-[960px] lg:h-[760px] xl:h-[780px]">
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={"bg-" + active}
          className="absolute inset-0 h-full w-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url("${slide.src}")`,
            backgroundPosition: slide.position ?? "center",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
          }}
          initial={reduceMotion ? false : { opacity: 0, scale: 1.045 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        />
      </AnimatePresence>

      <div className="absolute inset-0 bg-[var(--steel)]/76" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--steel)]/70 via-[var(--steel)]/34 to-[var(--steel)]/58" />
      <div className="absolute right-[-8%] top-[-18%] size-[620px] rounded-full border-[120px] border-white/[0.035]" />
      <div className="absolute bottom-[-28%] left-[18%] size-[520px] rounded-full border-[100px] border-white/[0.03]" />


      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={"content-" + active}
          className="relative mx-auto grid h-full min-h-0 max-w-[1440px] content-center gap-10 overflow-hidden px-4 pb-20 pt-24 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-10"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -18 }}
          transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/80 backdrop-blur">
              <ShieldCheck size={15} className="text-[var(--accent)]" />
              {slide.eyebrow}
            </div>

            <h1 className="mt-7 text-[clamp(3.4rem,8vw,8rem)] font-black leading-[0.84] tracking-[-0.075em]">
              {slide.title} <span className="text-[var(--accent)]">{slide.accent}</span>
            </h1>

            <p className="mt-8 max-w-2xl text-base leading-7 text-slate-200 sm:text-xl sm:leading-8">
              {slide.description}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a
                href={slide.primaryHref}
                target={slide.primaryHref.startsWith("http") ? "_blank" : undefined}
                rel={slide.primaryHref.startsWith("http") ? "noreferrer" : undefined}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 text-sm font-black text-white transition hover:bg-[var(--accent-hover)]"
              >
                {slide.primaryLabel} <ArrowRight size={18} />
              </a>
              <a
                href={slide.secondaryHref}
                target={slide.secondaryHref.startsWith("http") ? "_blank" : undefined}
                rel={slide.secondaryHref.startsWith("http") ? "noreferrer" : undefined}
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/25 bg-white/5 px-7 text-sm font-black text-white backdrop-blur transition hover:bg-white/10"
              >
                {slide.secondaryLabel}
              </a>
            </div>
          </div>

          <div className="grid gap-3 self-end lg:self-center">
            {slide.cards.map(([title, text], index) => (
              <motion.div
                key={title}
                className={
                  "rounded-[1.75rem] border p-6 backdrop-blur-md " +
                  (index === 0
                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/10"
                    : "border-white/15 bg-white/[0.08]")
                }
                initial={reduceMotion ? false : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.08 + index * 0.08, duration: 0.45 }}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                  0{index + 1}
                </span>
                <strong className="mt-3 block text-2xl font-black">{title}</strong>
                <span className="mt-2 block text-sm leading-6 text-slate-200">{text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[var(--steel)]/60 px-3 py-2 backdrop-blur-md">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setActive(index)}
            className={
              "h-2 rounded-full transition-all duration-300 " +
              (active === index ? "w-8 bg-[var(--accent)]" : "w-2 bg-white/50 hover:bg-white")
            }
            aria-label={"Mostrar slide " + (index + 1)}
            aria-current={active === index ? "true" : undefined}
          />
        ))}
      </div>
    </section>
  );
}

export default function HomeHeroVariants({
  option,
  publicBackendUrl,
  managedSlides,
}: {
  option: number;
  publicBackendUrl: string;
  managedSlides?: Record<number, FullHeroSlide[]>;
}) {
  const industrialImage =
    publicBackendUrl.replace(/\/$/, "") + "/programandoweb/opengraph/home-opengraph.jpg";

  const option2Slides: FullHeroSlide[] = [
    {
      src: heroBackgroundOne,
      position: "center 38%",
      eyebrow: "Industria alimentaria · Gas · Extracción",
      title: "Ingeniería que",
      accent: "mueve tu negocio.",
      description:
        "Diseñamos y fabricamos equipos industriales en acero inoxidable, instalamos redes de gas y desarrollamos soluciones de extracción para operaciones que exigen rendimiento.",
      primaryLabel: "Cotizar mi proyecto",
      primaryHref: whatsappHref,
      secondaryLabel: "Ver productos",
      secondaryHref: "#productos",
      cards: [
        ["Fabricamos", "Equipos industriales en acero inoxidable"],
        ["Instalamos", "Gas natural, propano y extracción"],
        ["Respondemos", "Servicio técnico y mantenimiento"],
      ],
    },
    {
      src: heroBackgroundTwo,
      position: "center",
      eyebrow: "Cocinas profesionales · Producción",
      title: "Equipos hechos para",
      accent: "trabajar de verdad.",
      description:
        "Soluciones robustas para restaurantes, panaderías y procesos de alimentos que necesitan continuidad, seguridad y alto rendimiento.",
      primaryLabel: "Hablar con un asesor",
      primaryHref: whatsappHref,
      secondaryLabel: "Conocer servicios",
      secondaryHref: "#servicios",
      cards: [
        ["Diseñamos", "Según capacidad, espacio y proceso"],
        ["Construimos", "Acero inoxidable para trabajo continuo"],
        ["Acompañamos", "Instalación, puesta en marcha y soporte"],
      ],
    },
    {
      src: industrialImage,
      position: "center",
      eyebrow: "Fabricación · Precisión · Experiencia",
      title: "Acero, técnica y",
      accent: "precisión industrial.",
      description:
        "Convertimos requerimientos técnicos en equipos y soluciones listas para integrarse a tu operación diaria.",
      primaryLabel: "Diseñar mi solución",
      primaryHref: whatsappHref,
      secondaryLabel: "Ver ingeniería",
      secondaryHref: "#ingenieria",
      cards: [
        ["A medida", "Desarrollo según tu necesidad"],
        ["AISI 304", "Material para aplicaciones de alimentos"],
        ["Integración", "Equipos, gas, extracción y soporte"],
      ],
    },
  ];

  const option3Slides: FullHeroSlide[] = [
    {
      src: industrialImage,
      position: "center",
      eyebrow: "Catálogo industrial Gaspronal",
      title: "El equipo correcto para",
      accent: "cada operación.",
      description:
        "Encuentra soluciones para cocción, preparación, producción y extracción, con fabricación especial cuando el proceso lo requiere.",
      primaryLabel: "Explorar catálogo",
      primaryHref: "#productos",
      secondaryLabel: "Pedir recomendación",
      secondaryHref: whatsappHref,
      cards: [
        ["Cocción", "Estufas, hornos y planchas"],
        ["Producción", "Marmitas, freidoras y equipos especiales"],
        ["Preparación", "Mesas, mesones y estaciones de trabajo"],
      ],
    },
    {
      src: heroBackgroundOne,
      position: "center 38%",
      eyebrow: "Equipamiento para producción real",
      title: "Más rendimiento en",
      accent: "menos espacio.",
      description:
        "Configuramos estaciones y equipos pensando en flujo de trabajo, capacidad, consumo energético y facilidad de mantenimiento.",
      primaryLabel: "Ver productos",
      primaryHref: "#productos",
      secondaryLabel: "Cotizar proyecto",
      secondaryHref: whatsappHref,
      cards: [
        ["Rendimiento", "Equipos pensados para operación continua"],
        ["Distribución", "Soluciones adaptadas al espacio disponible"],
        ["Soporte", "Instalación y mantenimiento técnico"],
      ],
    },
    {
      src: heroBackgroundTwo,
      position: "center",
      eyebrow: "Soluciones estándar y especiales",
      title: "Tu proceso define",
      accent: "el equipo.",
      description:
        "Si el catálogo no resuelve exactamente tu necesidad, diseñamos una solución especial con las dimensiones y prestaciones que necesitas.",
      primaryLabel: "Solicitar asesoría",
      primaryHref: whatsappHref,
      secondaryLabel: "Ver capacidades",
      secondaryHref: "#servicios",
      cards: [
        ["Diagnóstico", "Revisamos necesidad y capacidad"],
        ["Diseño", "Definimos configuración y dimensiones"],
        ["Fabricación", "Construimos e instalamos la solución"],
      ],
    },
  ];

  const option5Slides: FullHeroSlide[] = [
    {
      src: heroBackgroundTwo,
      position: "center",
      eyebrow: "Gaspronal Industrias y Servicios",
      title: "Una empresa para resolver",
      accent: "toda tu operación.",
      description:
        "Fabricación de equipos, redes de gas, extracción, instalación y soporte técnico con un mismo equipo especializado.",
      primaryLabel: "Hablar con un asesor",
      primaryHref: whatsappHref,
      secondaryLabel: "Ver servicios",
      secondaryHref: "#servicios",
      cards: [
        ["Equipos", "Fabricación industrial en acero inoxidable"],
        ["Infraestructura", "Gas y sistemas de extracción"],
        ["Postventa", "Servicio técnico y mantenimiento"],
      ],
    },
    {
      src: industrialImage,
      position: "center",
      eyebrow: "Ingeniería aplicada a tu negocio",
      title: "De la necesidad a",
      accent: "la operación.",
      description:
        "Integramos diseño, fabricación e instalación para que cada solución llegue lista para aportar productividad a tu negocio.",
      primaryLabel: "Contar mi proyecto",
      primaryHref: whatsappHref,
      secondaryLabel: "Conocer Gaspronal",
      secondaryHref: "#nosotros",
      cards: [
        ["Planeamos", "Necesidad, espacio y requerimientos"],
        ["Ejecutamos", "Fabricación e instalación coordinadas"],
        ["Soportamos", "Acompañamiento después de la entrega"],
      ],
    },
    {
      src: heroBackgroundOne,
      position: "center 38%",
      eyebrow: "Soluciones que trabajan juntas",
      title: "Menos proveedores.",
      accent: "Más control.",
      description:
        "Centraliza fabricación, instalación de gas, extracción y mantenimiento con un único aliado técnico para tu operación.",
      primaryLabel: "Solicitar asesoría",
      primaryHref: whatsappHref,
      secondaryLabel: "Ver productos",
      secondaryHref: "#productos",
      cards: [
        ["Un solo equipo", "Coordinación técnica de principio a fin"],
        ["Más trazabilidad", "Responsabilidad clara sobre la solución"],
        ["Más continuidad", "Soporte para mantener la operación activa"],
      ],
    },
  ];

  if (option === 2) {
    return <FullHeroCarousel slides={managedSlides?.[2]?.length ? managedSlides[2] : option2Slides} />;
  }

  if (option === 3) {
    return <FullHeroCarousel slides={managedSlides?.[3]?.length ? managedSlides[3] : option3Slides} />;
  }

  if (option === 4) {
    return (
      <section className="relative overflow-hidden bg-[var(--steel)] text-white">
        <HeroBackground src={heroBackgroundTwo} overlay="bg-[var(--steel)]/80" position="center" />
        <div className="absolute inset-y-0 right-0 hidden w-[42%] bg-[var(--brand)]/70 lg:block" />
        <div className="absolute -left-24 top-32 size-72 rounded-full border-[70px] border-white/[0.035]" />

        <div className="relative mx-auto grid min-h-[720px] max-w-[1440px] items-center gap-10 px-4 pb-14 pt-24 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-10">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/70">
              <Settings size={15} /> Desarrollo especial
            </div>
            <h1 className="mt-7 text-[clamp(3.2rem,7vw,7.2rem)] font-black leading-[0.88] tracking-[-0.07em]">
              Tu proceso primero. <span className="text-[var(--accent)]">El equipo después.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Partimos de lo que necesitas producir, del espacio disponible y de tu operación para diseñar una solución industrial que realmente encaje.
            </p>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="mt-9 inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 text-sm font-black text-white"
            >
              Diseñar mi solución <ArrowRight size={18} />
            </a>
          </div>

          <div className="relative lg:pl-10">
            <div className="grid gap-3">
              {[
                ["01", "Entendemos tu proceso", "Producción, capacidad, energía y espacio."],
                ["02", "Diseñamos contigo", "Equipo, distribución y requerimientos técnicos."],
                ["03", "Fabricamos e instalamos", "Una solución lista para trabajar."],
              ].map(([number, title, text]) => (
                <div key={number} className="rounded-[1.75rem] border border-white/15 bg-white/[0.08] p-6 backdrop-blur">
                  <span className="text-xs font-black tracking-[0.18em] text-[var(--accent)]">{number}</span>
                  <strong className="mt-3 block text-xl font-black">{title}</strong>
                  <span className="mt-2 block text-sm leading-6 text-white/65">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (option === 5) {
    return <FullHeroCarousel slides={managedSlides?.[5]?.length ? managedSlides[5] : option5Slides} />;
  }

  return (
    <section className="relative overflow-hidden bg-[var(--steel)] text-white">
      <HeroBackground src={heroBackgroundOne} overlay="bg-[var(--steel)]/78" position="center" />
      <div className="absolute inset-0">
        <div className="absolute right-[-8%] top-[-18%] size-[620px] rounded-full border-[120px] border-white/[0.035]" />
        <div className="absolute bottom-[-28%] left-[18%] size-[520px] rounded-full border-[100px] border-white/[0.03]" />
      </div>

      <div className="relative mx-auto grid min-h-[760px] max-w-[1440px] gap-10 px-4 pb-16 pt-24 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-10">
        <div className="max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/70">
            <ShieldCheck size={15} className="text-[var(--accent)]" />
            Industria alimentaria · Gas · Extracción
          </div>
          <h1 className="mt-7 text-[clamp(3.4rem,8vw,8rem)] font-black leading-[0.84] tracking-[-0.075em]">
            Ingeniería que <span className="text-[var(--accent)]">mueve tu negocio.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-base leading-7 text-slate-300 sm:text-xl sm:leading-8">
            Diseñamos y fabricamos equipos industriales en acero inoxidable, instalamos redes de gas y desarrollamos soluciones de extracción para operaciones que exigen rendimiento.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 text-sm font-black text-white transition hover:bg-[var(--accent-hover)]"
            >
              Cotizar mi proyecto <ArrowRight size={18} />
            </a>
            <a
              href="#productos"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 text-sm font-black text-white transition hover:bg-white/10"
            >
              Ver productos
            </a>
          </div>
        </div>

        <div className="grid gap-3 self-end lg:self-center">
          {[
            ["Fabricamos", "Equipos industriales en acero inoxidable"],
            ["Instalamos", "Gas natural, propano y extracción"],
            ["Respondemos", "Servicio técnico y mantenimiento"],
          ].map(([title, text], index) => (
            <div
              key={title}
              className={
                "rounded-[1.75rem] border p-6 backdrop-blur " +
                (index === 0
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
                  : "border-white/10 bg-white/[0.05]")
              }
            >
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">0{index + 1}</span>
              <strong className="mt-3 block text-2xl font-black">{title}</strong>
              <span className="mt-2 block text-sm leading-6 text-slate-300">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
