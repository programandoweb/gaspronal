"use client";

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
  return (
    <nav aria-label="Categorías de productos">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {categories.map((item, index) => (
          <div
            key={item.id}
            className={`min-w-0 rounded-2xl ${activeCategory === item.slug ? "ring-2 ring-[var(--brand)] ring-offset-2" : ""}`}
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
    </nav>
  );
}
