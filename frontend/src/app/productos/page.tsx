import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Box, Tag } from "lucide-react";
import StickyCategoryGrid from "@/components/public/StickyCategoryGrid";
import ProductCardImage from "@/components/public/ProductCardImage";

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
      cache: "no-store",
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
  const activeCategoryName = categories.find((item) => item.slug === category)?.name;

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
        <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">
            Catálogo Gaspronal
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.05em] text-[var(--steel)] sm:text-6xl">
            Equipos industriales para trabajo real.
          </h1>
        </div>
      </section>

      <StickyCategoryGrid
        categories={categories.map((item) => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          image_url: item.image_url?.startsWith("/api/catalog-media/") || item.image_url?.startsWith("/api/category-media/")
            ? item.image_url
            : item.image_url?.startsWith("/")
              ? (process.env.PUBLIC_BACKEND_URL ?? "https://backend.gaspronal.programandoweb.net").replace(/\/$/, "") + item.image_url
              : item.image_url ?? null,
        }))}
        activeCategory={category}
      />


      <section className="mx-auto max-w-[1440px] px-3 pb-20 pt-5 sm:px-6 sm:pt-[120px] lg:px-10">
        <div id="catalogo-productos" className="h-px scroll-mt-5 xl:scroll-mt-36" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between gap-3 sm:hidden">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">
              {products.total} {products.total === 1 ? "producto" : "productos"}
            </p>
            <h2
              title={activeCategoryName ?? "Todos los productos"}
              className="mt-0.5 truncate text-lg font-black tracking-[-0.035em] text-[var(--steel)]"
            >
              {activeCategoryName ?? "Todos los productos"}
            </h2>
          </div>
          <a
            href="#categorias-productos"
            aria-label="Volver al selector de categorías"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-[var(--brand)] shadow-sm"
          >
            <ArrowLeft size={14} className="rotate-90" />
            Categorías
          </a>
        </div>
        {products.data.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {products.data.map((product) => {
                const image = productImage(product);

                return (
                  <article
                    key={product.id}
                    className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white shadow-[0_6px_20px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:block sm:rounded-[1.75rem] sm:shadow-none"
                  >
                    <div className="relative aspect-square overflow-hidden bg-[var(--brand-soft)] sm:aspect-[4/3]">
                      <ProductCardImage src={image} alt={product.name} compactMobile />

                      {product.category ? (
                        <span className="absolute left-2 right-2 top-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[9px] font-black uppercase tracking-[0.02em] text-[var(--brand)] shadow-sm sm:left-4 sm:right-auto sm:top-4 sm:max-w-none sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px] sm:tracking-[0.08em]">
                          <Tag size={12} className="hidden shrink-0 sm:block" />
                          <span className="min-w-0 truncate">{product.category.name}</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-1 flex-col p-3 sm:block sm:p-5">
                      {product.reference ? (
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.08em] text-[var(--accent)] sm:text-xs sm:tracking-[0.12em]">
                          {product.reference}
                        </p>
                      ) : null}
                      <h2 title={product.name} className="mt-1.5 line-clamp-3 text-[13px] font-black leading-[1.3] tracking-[-0.025em] text-[var(--steel)] sm:mt-2 sm:line-clamp-none sm:text-xl sm:leading-tight">
                        {product.name}
                      </h2>
                      {product.short_description ? (
                        <p className="hidden text-sm leading-6 text-slate-600 sm:mt-3 sm:line-clamp-3">
                          {product.short_description}
                        </p>
                      ) : null}

                      <Link
                        href={`/productos/${product.slug}`}
                        className="mt-auto inline-flex min-h-10 items-center justify-between gap-1.5 border-t border-slate-100 pt-2 text-[11px] font-black text-[var(--brand)] transition group-hover:gap-3 sm:mt-5 sm:min-h-0 sm:justify-start sm:gap-2 sm:border-0 sm:pt-0 sm:text-sm"
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
