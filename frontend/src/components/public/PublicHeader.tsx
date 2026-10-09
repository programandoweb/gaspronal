"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, Phone } from "lucide-react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";

type PublicHeaderProps = {
  whatsappHref: string;
};

const navigation = [
  { label: "Productos", href: "/productos" },
  { label: "Servicios", href: "/#servicios" },
  { label: "A medida", href: "/#ingenieria" },
  { label: "Gaspro-notas", href: "/gaspro-notas" },
  { label: "Gaspronal", href: "/#nosotros" },
  { label: "Contacto", href: "/#contacto" },
];

export default function PublicHeader({ whatsappHref }: PublicHeaderProps) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (value) => {
    setScrolled(value > 28);
  });

  return (
    <div className="h-[78px]">
      <motion.header
        initial={false}
        animate={{
          boxShadow: scrolled
            ? "0 16px 36px rgba(15, 45, 66, 0.14)"
            : "0 0 0 rgba(15, 45, 66, 0)",
          backgroundColor: scrolled
            ? "rgba(255,255,255,0.985)"
            : "rgba(255,255,255,0.95)",
          y: 0,
        }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={`${scrolled ? "fixed left-0 right-0 top-0" : "relative"} z-50 border-b border-black/5 backdrop-blur-xl`}
      >
      <motion.div
        initial={false}
        animate={{ height: scrolled ? 66 : 78 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex max-w-[1440px] items-center justify-between gap-5 px-4 sm:px-6 lg:px-10"
      >
        <motion.div
          initial={false}
          animate={{ scale: scrolled ? 0.92 : 1 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="origin-left shrink-0"
        >
          <Link href="/" aria-label="Gaspronal - Inicio" className="block">
            <Image
              src="/programandoweb/brand/logo-gaspronal-horizontal-full-color.png"
              alt="Gaspronal - Tecnología e Ingeniería Estratégica"
              width={220}
              height={78}
              priority
              className="h-auto w-[190px] sm:w-[240px]"
            />
          </Link>
        </motion.div>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-[var(--steel)] lg:flex">
          {navigation.map((item) => (
            <Link
              key={item.label}
              className="relative py-2 transition-colors hover:text-[var(--brand)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-[var(--brand)] after:transition-transform hover:after:scale-x-100"
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <motion.div
          initial={false}
          animate={{ opacity: 1, scale: scrolled ? 0.96 : 1 }}
          transition={{ duration: 0.24 }}
          className="hidden items-center gap-3 lg:flex"
        >
          <a
            href="tel:+573045527575"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-sm font-bold text-[var(--steel)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            <Phone size={17} />
            304 552 7575
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)]"
          >
            Hablar con un asesor
            <ArrowRight size={17} />
          </a>
        </motion.div>

        <details className="group relative lg:hidden">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--border)] text-[var(--steel)] transition hover:border-[var(--brand)] hover:text-[var(--brand)] [&::-webkit-details-marker]:hidden">
            <Menu size={22} />
            <span className="sr-only">Abrir navegación</span>
          </summary>
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-14 w-[min(88vw,340px)] rounded-3xl border border-[var(--border)] bg-white p-3 shadow-2xl"
          >
            <nav className="grid gap-1 text-sm font-semibold">
              {navigation.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-2xl px-4 py-3 transition hover:bg-[var(--surface-muted)] hover:text-[var(--brand)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-bold text-white"
            >
              Solicitar asesoría <ArrowRight size={17} />
            </a>
          </motion.div>
        </details>
      </motion.div>
      </motion.header>
    </div>
  );
}
