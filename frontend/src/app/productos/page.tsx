import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Box, Search, Tag } from "lucide-react";
import CategoryCircleCarousel from "@/components/public/CategoryCircleCarousel";

export const metadata: Metadata = {
  title: "Productos industriales",
  description:
    "Catálogo público de equipos industriales Gaspronal para cocinas profesionales, industria de alimentos y soluciones fabricadas en acero inoxidable.",
  alternates:{canonical:"/productos"},
  robots:{index:true,follow:true},
};

type Category = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  products_count: number;
  image_url?: string | null;
};

type Product = {
  id: number;
  name: string;
  slug: string;
  reference?: string | null;
  short_description?: string | null;
  og_image?: string | null;
  gallery?: string[] | null;
  category?: {
    id: number;
    name: string;
    slug: string;
  } | null;
};

type PaginatedProducts = {
  data: Product[];
  current_page: number;
  last_page: number;
  total: number;
};

const backendUrl = process.env.LARAVEL_API_URL ?? "http://127.0.0.1:8000";

async function getCatalog(category?: string, search?: string, page = 1) {
  const productParams = new URLSearchParams({
    per_page: "24",
    page: String(page),
  });

  if (category) productParams.set("category", category);
  if (search) productParams.set("search", search);

  const [productsResponse, categoriesResponse] = await Promise.all([
    fetch(`${backendUrl}/api/v1/catalog/public/items?${productParams.toString()}`, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
    }),
    fetch(`${backendUrl}/api/v1/catalog/public/home-category-images`, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
    }),
  ]);

  const products: PaginatedProducts = productsResponse.ok
    ? await productsResponse.json()
    : { data: [], current_page: 1, last_page: 1, total: 0 };

  const categoriesPayload = categoriesResponse.ok
    ? await categoriesResponse.json()
    : { data: [] };

  return {
    products,
    categories: (categoriesPayload.data ?? []) as Category[],
  };
}

function productImage(product: Product) {
  return product.og_image || product.gallery?.[0] || null;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; buscar?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const category = params.categoria?.trim() || undefined;
  const search = params.buscar?.trim() || undefined;
  const page = Math.max(Number(params.pagina || "1") || 1, 1);
  const { products, categories } = await getCatalog(category, search, page);

  return (
    <main className="min-h-screen bg-[var(--surface-muted)] text-[var(--foreground)]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[84px] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
          <Link href="/" aria-label="Volver al inicio">
            <Image
              src="/programandoweb/brand/logo-gaspronal-horizontal-full-color.png"
              alt="Gaspronal"
              width={220}
              height={78}
              priority
              className="h-auto w-[180px] sm:w-[210px]"
            />
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            <ArrowLeft size={17} />
            Inicio
          </Link>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 sm:py-20 lg:px-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">
            Catálogo Gaspronal
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-black tracking-[-0.05em] text-[var(--steel)] sm:text-6xl">
                Equipos industriales para trabajo real.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Explora productos Gaspronal por categoría, referencia o aplicación.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--brand-soft)] px-4 py-2 text-sm font-bold text-[var(--brand)]">
              <Box size={17} />
              {products.total} productos publicados
            </div>
          </div>

          <form action="/productos" className="mt-9 flex max-w-3xl flex-col gap-3 sm:flex-row">
            {category ? <input type="hidden" name="categoria" value={category} /> : null}
            <label className="relative min-w-0 flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                name="buscar"
                defaultValue={search}
                placeholder="Buscar por nombre, referencia o categoría..."
                className="min-h-13 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-[var(--brand)]"
              />
            </label>
            <button
              type="submit"
              className="min-h-13 rounded-2xl bg-[var(--brand)] px-6 text-sm font-bold text-white transition hover:bg-[var(--brand-hover)]"
            >
              Buscar
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10">
        <CategoryCircleCarousel
          categories={categories.map((item) => ({
            ...item,
            products_count: item.products_count ?? 0,
            image_url: item.image_url?.startsWith("/api/catalog-media/")
              ? item.image_url
              : item.image_url?.startsWith("/")
                ? (process.env.PUBLIC_BACKEND_URL ?? "https://backend.gaspronal.programandoweb.net").replace(/\\/$/, "") + item.image_url
                : item.image_url ?? null,
          }))}
          activeCategory={category}
        />
      </section>

      <section className="mx-auto max-w-[1440px] px-4 pb-20 sm:px-6 lg:px-10">
        {products.data.length > 0 ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.data.map((product) => {
                const image = productImage(product);

                return (
                  <article
                    key={product.id}
                    className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--brand-soft)]">
                      {image ? (
                        <img
                          src={image}
                          alt={product.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[var(--brand)]/35">
                          <Box size={58} strokeWidth={1.4} />
                        </div>
                      )}

                      {product.category ? (
                        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--brand)] shadow-sm">
                          <Tag size={12} />
                          {product.category.name}
                        </span>
                      ) : null}
                    </div>

                    <div className="p-5">
                      {product.reference ? (
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--accent)]">
                          {product.reference}
                        </p>
                      ) : null}
                      <h2 className="mt-2 text-xl font-black leading-tight tracking-[-0.025em] text-[var(--steel)]">
                        {product.name}
                      </h2>
                      {product.short_description ? (
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                          {product.short_description}
                        </p>
                      ) : null}

                      <Link
                        href={`/productos/${product.slug}`}
                        className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[var(--brand)] transition group-hover:gap-3"
                      >
                        Ver producto
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            {products.last_page > 1 ? (
              <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Paginación">
                {products.current_page > 1 ? (
                  <Link
                    href={`/productos?${new URLSearchParams({
                      ...(category ? { categoria: category } : {}),
                      ...(search ? { buscar: search } : {}),
                      pagina: String(products.current_page - 1),
                    }).toString()}`}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
                  >
                    Anterior
                  </Link>
                ) : null}
                <span className="text-sm font-semibold text-slate-500">
                  Página {products.current_page} de {products.last_page}
                </span>
                {products.current_page < products.last_page ? (
                  <Link
                    href={`/productos?${new URLSearchParams({
                      ...(category ? { categoria: category } : {}),
                      ...(search ? { buscar: search } : {}),
                      pagina: String(products.current_page + 1),
                    }).toString()}`}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
                  >
                    Siguiente
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        ) : (
          <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-16 text-center">
            <Box size={46} className="mx-auto text-[var(--brand)]/40" />
            <h2 className="mt-5 text-2xl font-black text-[var(--steel)]">No encontramos productos</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
              Prueba otra búsqueda o elimina el filtro de categoría.
            </p>
            <Link
              href="/productos"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--brand)] px-5 text-sm font-bold text-white"
            >
              Ver todo el catálogo
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
