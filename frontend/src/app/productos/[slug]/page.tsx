import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, MessageCircle, Tag } from "lucide-react";
import ProductGallery from "@/components/public/ProductGallery";
import { notFound } from "next/navigation";

type Product = {
  id: number;
  name: string;
  slug: string;
  reference?: string | null;
  short_description?: string | null;
  description?: string | null;
  specifications?: Record<string, unknown> | unknown[] | null;
  gallery?: string[] | null;
  applications?: string | string[] | null;
  og_image?: string | null;
  whatsapp_message?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  category?: { id: number; name: string; slug: string } | null;
};

const backendUrl = process.env.LARAVEL_API_URL ?? "http://127.0.0.1:8000";

async function getProduct(slug: string): Promise<Product | null> {
  const response = await fetch(
    `${backendUrl}/api/v1/catalog/public/items/${encodeURIComponent(slug)}`,
    {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) return null;

  const payload = await response.json();
  return payload.data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: "Producto no encontrado" };
  }

  return {
    title: product.seo_title || product.name,
    description:
      product.seo_description ||
      product.short_description ||
      `Conoce ${product.name} de Gaspronal.`,
    alternates:{canonical:`/productos/${product.slug}`},
    robots:{index:true,follow:true},
    openGraph: {
      title: product.seo_title || product.name,
      description:
        product.seo_description ||
        product.short_description ||
        `Conoce ${product.name} de Gaspronal.`,
      images: product.og_image ? [product.og_image] : undefined,
      type: "website",
    },
  };
}

function normalizeApplications(value: Product["applications"]) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") {
    return value
      .split(/\r?\n|•|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeSpecs(value: Product["specifications"]) {
  if (!value) return [] as Array<[string, string]>;
  if (Array.isArray(value)) {
    return value.map((item, index) => [`Especificación ${index + 1}`, String(item)] as [string, string]);
  }
  return Object.entries(value).map(([key, val]) => [
    key,
    typeof val === "string" || typeof val === "number" ? String(val) : JSON.stringify(val),
  ] as [string, string]);
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const gallery = Array.from(
    new Set([product.og_image, ...(product.gallery ?? [])].filter(Boolean) as string[]),
  );
  const applications = normalizeApplications(product.applications);
  const specs = normalizeSpecs(product.specifications);
  const whatsappText =
    product.whatsapp_message ||
    `Hola Gaspronal, quiero información sobre ${product.name}${product.reference ? ` (${product.reference})` : ""}.`;
  const whatsappHref = `https://wa.me/573045527575?text=${encodeURIComponent(whatsappText)}`;

  return (
    <main className="min-h-screen bg-white text-[var(--foreground)]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[84px] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
          <Link href="/">
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
            href="/productos"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            <ArrowLeft size={17} />
            Catálogo
          </Link>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-[var(--surface-muted)]">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/" className="hover:text-[var(--brand)]">Inicio</Link>
            <span>/</span>
            <Link href="/productos" className="hover:text-[var(--brand)]">Productos</Link>
            {product.category ? (
              <>
                <span>/</span>
                <Link
                  href={`/productos/categoria/${product.category.slug}`}
                  className="hover:text-[var(--brand)]"
                >
                  {product.category.name}
                </Link>
              </>
            ) : null}
          </nav>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <ProductGallery images={gallery} productName={product.name} />

        <div className="lg:py-4">
          {product.category ? (
            <Link
              href={`/productos/categoria/${product.category.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand)]"
            >
              <Tag size={14} />
              {product.category.name}
            </Link>
          ) : null}

          {product.reference ? (
            <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">
              {product.reference}
            </p>
          ) : null}

          <h1 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.05em] text-[var(--steel)] sm:text-6xl">
            {product.name}
          </h1>

          {product.short_description ? (
            <p className="mt-6 text-lg leading-8 text-slate-600">{product.short_description}</p>
          ) : null}

          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-black text-white transition hover:bg-[var(--accent-hover)]"
          >
            <MessageCircle size={18} />
            Cotizar este producto
            <ArrowRight size={17} />
          </a>

          {applications.length > 0 ? (
            <div className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-lg font-black text-[var(--steel)]">Aplicaciones</h2>
              <div className="mt-4 grid gap-3">
                {applications.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {product.description ? (
        <section className="border-t border-slate-200 bg-[var(--surface-muted)]">
          <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10">
            <div className="max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Descripción</p>
              <div className="mt-5 whitespace-pre-line text-base leading-8 text-slate-700">
                {product.description}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {specs.length > 0 ? (
        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10">
            <h2 className="text-3xl font-black tracking-[-0.04em] text-[var(--steel)]">
              Especificaciones técnicas
            </h2>
            <div className="mt-7 overflow-hidden rounded-[2rem] border border-slate-200">
              {specs.map(([label, value], index) => (
                <div
                  key={`${label}-${index}`}
                  className="grid gap-2 border-b border-slate-200 px-5 py-4 last:border-b-0 sm:grid-cols-[0.4fr_0.6fr] sm:px-7"
                >
                  <strong className="text-sm text-[var(--steel)]">{label}</strong>
                  <span className="text-sm leading-6 text-slate-600">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
