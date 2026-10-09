"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, ChefHat, Flame, Gauge, Settings, Wind } from "lucide-react";

const fallbackLogo = "/programandoweb/brand/logo-gaspronal-horizontal-full-color.png";
const icons = [ChefHat, Gauge, Flame, Wind, Settings, Building2];

export default function HomeCategoryCard({
  id,
  name,
  slug,
  imageUrl,
  index,
}: {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  index: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  const hasPhoto = Boolean(imageUrl) && !failed;
  const Icon = icons[index % icons.length];

  return (
    <Link
      href={`/productos?categoria=${encodeURIComponent(slug)}`}
      aria-label={`Ver productos de ${name}`}
      data-category-id={id}
      className="group relative min-h-[215px] overflow-hidden rounded-2xl border border-[var(--brand)] bg-white p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      {hasPhoto ? (
        <img
          src={imageUrl!}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover grayscale transition-[filter,transform] duration-700 ease-in-out group-hover:grayscale-0 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-white px-7 pb-10" aria-hidden="true">
          <img src={fallbackLogo} alt="" className="h-auto max-h-28 w-full object-contain" />
        </div>
      )}
      <div className={`relative flex items-start justify-between gap-5 ${hasPhoto ? "text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.85))]" : "text-[var(--brand)]"}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${hasPhoto ? "bg-black/35 text-white" : "bg-[var(--brand-soft)] text-[var(--brand)]"}`}>
          <Icon size={23} />
        </div>
        <ArrowRight size={22} className="transition group-hover:translate-x-1" />
      </div>
      <div className="absolute inset-x-5 bottom-5">
        <h3 className={`text-lg font-black leading-tight tracking-[-0.03em] ${hasPhoto ? "text-white [text-shadow:0_2px_5px_rgba(0,0,0,0.95),0_0_12px_rgba(0,0,0,0.75)]" : "text-[var(--steel)]"}`}>{name}</h3>
      </div>
    </Link>
  );
}
