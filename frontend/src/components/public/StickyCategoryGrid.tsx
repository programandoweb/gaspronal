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
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const check = () => {
      const desktop = window.matchMedia("(min-width: 1280px)").matches;
      setCompact(desktop && (sentinel.current?.getBoundingClientRect().top ?? 1) <= 0);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <nav
        aria-label="Categorías de productos"
        className={`relative z-40 mx-auto max-w-[1440px] px-4 py-3 sm:px-6 lg:px-10 xl:sticky xl:top-0 ${compact ? "xl:rounded-b-2xl xl:border-b xl:border-slate-200 xl:bg-white/95 xl:shadow-lg xl:backdrop-blur" : ""}`}
      >
        <div className={`grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${compact ? "xl:grid-cols-12 xl:gap-2" : "xl:grid-cols-6"}`}>
          {categories.map((item, index) => (
            <div
              key={item.id}
              className={`relative min-w-0 rounded-2xl ${activeCategory === item.slug ? "ring-2 ring-[var(--brand)] ring-offset-2" : ""}`}
            >
              {compact ? (
                <Link
                  href={`/productos?categoria=${encodeURIComponent(item.slug)}`}
                  title={item.name}
                  aria-label={`Ver productos de ${item.name}`}
                  aria-current={activeCategory === item.slug ? "page" : undefined}
                  className="group relative block h-[104px] w-full overflow-hidden rounded-xl border border-[var(--brand)] bg-white shadow-sm"
                >
                  <img
                    src={item.image_url || "/programandoweb/brand/logo-gaspronal-horizontal-full-color.png"}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover grayscale transition duration-300 group-hover:grayscale-0"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <span className="absolute inset-x-1 bottom-2 text-center text-xs font-black text-white [text-shadow:0_1px_3px_#000]">{initials(item.name)}</span>
                  <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 hidden w-max max-w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white shadow-xl group-hover:block group-focus-visible:block">{item.name}</span>
                </Link>
              ) : (
                <HomeCategoryCard id={item.id} name={item.name} slug={item.slug} imageUrl={item.image_url} index={index} />
              )}
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
