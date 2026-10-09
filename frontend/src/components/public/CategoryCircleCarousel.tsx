"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";

export type CatalogCircleCategory = {
  id: number;
  name: string;
  slug: string;
  products_count: number;
  image_url: string | null;
};

export default function CategoryCircleCarousel({
  categories,
  activeCategory,
}: {
  categories: CatalogCircleCategory[];
  activeCategory?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const move = (direction: number) => track.current?.scrollBy({ left: direction * 560, behavior: "smooth" });

  return (
    <nav className="relative" aria-label="Categorías de productos">
      <div ref={track} className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link href="/productos" className="group flex w-28 shrink-0 snap-start flex-col items-center gap-3 text-center">
          <span className={`flex size-24 items-center justify-center rounded-full border-2 bg-white shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-lg ${!activeCategory ? "border-[var(--brand)] text-[var(--brand)]" : "border-slate-200 text-slate-500"}`}>
            <LayoutGrid size={32} />
          </span>
          <span className="text-xs font-bold leading-4 text-[var(--steel)]">Todos</span>
        </Link>
        {categories.map((item) => (
          <Link key={item.id} href={`/productos/categoria/${encodeURIComponent(item.slug)}`} className="group flex w-28 shrink-0 snap-start flex-col items-center gap-3 text-center" aria-current={activeCategory === item.slug ? "page" : undefined}>
            <span className={`relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2 bg-white shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg ${activeCategory === item.slug ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/20" : "border-slate-200 group-hover:border-[var(--brand)]"}`}>
              <img
                src={item.image_url || "/programandoweb/brand/logo-gaspronal-horizontal-full-color.png"}
                alt=""
                loading="lazy"
                onError={(event) => {
                  const fallback = "/programandoweb/brand/logo-gaspronal-horizontal-full-color.png";
                  if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback;
                }}
                className={item.image_url ? "h-full w-full object-cover" : "h-auto w-4/5 object-contain"}
              />
            </span>
            <span className="line-clamp-2 min-h-8 text-xs font-bold leading-4 text-[var(--steel)]">{item.name}</span>
            <span className="-mt-3 text-[11px] text-slate-500">{item.products_count} productos</span>
          </Link>
        ))}
      </div>
      <button type="button" onClick={() => move(-1)} aria-label="Categorías anteriores" className="absolute -left-3 top-10 z-10 grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-[var(--brand)] shadow-md transition hover:scale-105"><ChevronLeft size={22} /></button>
      <button type="button" onClick={() => move(1)} aria-label="Categorías siguientes" className="absolute -right-3 top-10 z-10 grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-[var(--brand)] shadow-md transition hover:scale-105"><ChevronRight size={22} /></button>
    </nav>
  );
}
