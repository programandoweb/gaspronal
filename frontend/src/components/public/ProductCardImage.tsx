"use client";

import { useState } from "react";

const LOGO = "/programandoweb/brand/logo-gaspronal-horizontal-full-color.png";

type Props = { src: string | null; alt: string; compactMobile?: boolean };

export default function ProductCardImage({ src, alt, compactMobile = false }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const validSrc = src?.trim() || null;
  const showImage = Boolean(validSrc && validSrc !== failedSrc);

  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-50">
      {showImage ? (
        <img
          src={validSrc!}
          alt={alt}
          loading="lazy"
          onError={() => setFailedSrc(validSrc)}
          className={`h-full w-full transition duration-500 group-hover:scale-[1.03] ${compactMobile ? "object-contain p-2 sm:object-cover sm:p-0" : "object-cover"}`}
        />
      ) : (
        <img
          src={LOGO}
          alt="Gaspronal · imagen de producto no disponible"
          loading="lazy"
          className="max-h-[65%] w-[70%] max-w-[240px] object-contain"
        />
      )}
    </div>
  );
}
