"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import HomeCategoryCard from "@/components/public/HomeCategoryCard";

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
  const move = (direction: number) =>
    track.current?.scrollBy({ left: direction * (track.current?.clientWidth ?? 560) * 0.8, behavior: "smooth" });

  return (
    <nav className="relative" aria-label="Categorías de productos">
      <div
        ref={track}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Link
          href="/productos"
          aria-current={!activeCategory ? "page" : undefined}
          className={`group flex min-h-[215px] w-[calc((100%-36px)/4)] min-w-[175px] max-w-[225px] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-2xl border bg-white p-5 text-center transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:min-w-[190px] lg:min-w-[200px] ${!activeCategory ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/20" : "border-slate-200 hover:border-[var(--brand)]"}`}
        >
          <LayoutGrid size={32} className="text-[var(--brand)]" aria-hidden="true" />
          <span className="text-lg font-black text-[var(--steel)]">Todos</span>
          <span className="text-xs text-slate-500">Ver catálogo completo</span>
        </Link>
        {categories.map((item, index) => (
          <div
            key={item.id}
            className={`w-[calc((100%-36px)/4)] min-w-[175px] max-w-[225px] shrink-0 snap-start rounded-2xl sm:min-w-[190px] lg:min-w-[200px] ${activeCategory === item.slug ? "ring-2 ring-[var(--brand)] ring-offset-2" : ""}`}
            aria-current={activeCategory === item.slug ? "page" : undefined}
          >
            <HomeCategoryCard
              id={item.id}
              name={item.name}
              slug={item.slug}
              imageUrl={item.image_url}
              index={index}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => move(-1)}
        aria-label="Categorías anteriores"
        className="absolute -left-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-[var(--brand)] shadow-md transition hover:scale-105"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        aria-label="Categorías siguientes"
        className="absolute -right-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-[var(--brand)] shadow-md transition hover:scale-105"
      >
        <ChevronRight size={22} />
      </button>
    </nav>
  );
}
