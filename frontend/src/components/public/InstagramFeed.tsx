import { ArrowUpRight, Images, Play } from "lucide-react";
import { FaInstagram } from "react-icons/fa";
import type { InstagramFeedPost } from "@/lib/instagram-feed";

const profileUrl = "https://www.instagram.com/gaspronal/";

export default function InstagramFeed({ posts }: { posts: InstagramFeedPost[] }) {
  return (
    <section
      id="instagram-feed"
      aria-labelledby="instagram-feed-title"
      className="mt-12 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10"
    >
      <div className="mb-7 flex flex-col justify-between gap-5 sm:mb-8 md:flex-row md:items-end">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-[var(--accent)]">
            <FaInstagram size={17} aria-hidden="true" />
            Síguenos en Instagram
          </p>
          <h2
            id="instagram-feed-title"
            className="mt-3 text-3xl font-black leading-tight tracking-[-0.045em] text-[var(--steel)] sm:text-4xl"
          >
            Lo último de Gaspronal.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Proyectos, equipos y novedades que compartimos en @gaspronal.
          </p>
        </div>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[var(--brand)] px-5 text-sm font-black text-white transition hover:bg-[var(--brand-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 md:self-auto"
        >
          <FaInstagram size={17} aria-hidden="true" />
          Ver Instagram
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>

      {posts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
          {posts.map((post, index) => (
            <a
              key={post.id}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={"Abrir publicación " + (index + 1) + " de Gaspronal en Instagram" + (post.caption ? ": " + post.caption.slice(0, 80) : "")}
              className="group relative block aspect-[4/5] min-w-0 overflow-hidden rounded-[1.2rem] bg-[var(--steel)] shadow-[0_5px_20px_rgba(15,23,42,0.1)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              {post.imageUrl ? (
                <img
                  src={post.imageUrl}
                  alt={post.caption ? post.caption.slice(0, 150) : "Publicación " + (index + 1) + " de Gaspronal"}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[var(--brand)] to-[var(--steel)] text-white">
                  <FaInstagram size={38} aria-hidden="true" />
                  <span className="text-xs font-bold">Ver en Instagram</span>
                </span>
              )}
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <span className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white backdrop-blur-sm">
                {post.mediaType === "VIDEO" ? <Play size={15} fill="currentColor" aria-hidden="true" /> :
                  post.mediaType === "CAROUSEL_ALBUM" ? <Images size={16} aria-hidden="true" /> :
                    <FaInstagram size={16} aria-hidden="true" />}
              </span>
              <span className="absolute inset-x-3 bottom-3 text-white">
                <span className="line-clamp-2 text-xs font-semibold leading-5 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
                  {post.caption || "Descubre esta publicación de Gaspronal"}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-white/90">
                  Ver publicación <ArrowUpRight size={13} aria-hidden="true" />
                </span>
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <FaInstagram size={31} aria-hidden="true" />
          </span>
          <p className="max-w-md text-sm leading-6 text-slate-600">
            Descubre nuestros trabajos y las últimas publicaciones directamente en Instagram.
          </p>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--brand)] px-5 text-sm font-black text-[var(--brand)] transition hover:bg-[var(--brand-soft)]"
          >
            Ir a @gaspronal <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
      )}
    </section>
  );
}
