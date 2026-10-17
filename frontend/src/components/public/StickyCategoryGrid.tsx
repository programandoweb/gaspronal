"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import HomeCategoryCard from "@/components/public/HomeCategoryCard";

type Category = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
};

function initials(name: string) {
  return name.trim().split(/\s+/).map(word => word[0]).filter(Boolean).slice(0, 3).join("").toUpperCase();
}

export default function StickyCategoryGrid({
  categories,
  activeCategory,
}: {
  categories: Category[];
  activeCategory?: string;
}) {
  const gridEnd = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const desktop = window.matchMedia("(min-width: 1280px)").matches;
        // The marker never changes height or position when the fixed menu appears.
        setCompact(desktop && (gridEnd.current?.getBoundingClientRect().bottom ?? 1) <= 0);
      });
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <>
      <nav aria-label="Categorías de productos" className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 lg:px-10">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {categories.map((item, index) => (
            <div
              key={item.id}
              className={`min-w-0 rounded-2xl ${activeCategory === item.slug ? "ring-2 ring-[var(--brand)] ring-offset-2" : ""}`}
            >
              <HomeCategoryCard id={item.id} name={item.name} slug={item.slug} imageUrl={item.image_url} index={index} />
            </div>
          ))}
        </div>
      </nav>
      <div ref={gridEnd} className="h-px" aria-hidden="true" />
      {compact && (
        <nav aria-label="Categorías rápidas" className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 py-3 shadow-xl backdrop-blur">
          <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-2 px-4 sm:px-6 lg:px-10">
            {categories.map((item) => (
              <Link
                key={item.id}
                href={`/productos?categoria=${encodeURIComponent(item.slug)}`}
                title={item.name}
                aria-label={`Ver productos de ${item.name}`}
                aria-current={activeCategory === item.slug ? "page" : undefined}
                className={`group relative block h-[104px] min-w-0 overflow-hidden rounded-xl border bg-white shadow-sm ${activeCategory === item.slug ? "border-[var(--brand)] ring-2 ring-[var(--brand)]" : "border-slate-200 hover:border-[var(--brand)]"}`}
              >
                <img src={item.image_url || "/programandoweb/brand/logo-gaspronal-horizontal-full-color.png"} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover grayscale transition duration-300 group-hover:grayscale-0" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                <span className="absolute inset-x-1 bottom-2 text-center text-xs font-black text-white [text-shadow:0_1px_3px_#000]">{initials(item.name)}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
