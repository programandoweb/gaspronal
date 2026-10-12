"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MultimediaPicker from "@/components/dashboard/MultimediaPicker";

const TARGET_SLUG = "instalacion-reparacion-y-mantenimiento-de-equipos-a-gas-domesticos-e-industriales";

export default function ServiceImageLibraryPicker({ slug }: { slug: string }) {
  const router = useRouter();
  const [isRoot, setIsRoot] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/auth/me", { cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(json => { if (active) setIsRoot(Array.isArray(json?.data?.roles) && json.data.roles.includes("root")); })
      .catch(() => { if (active) setIsRoot(false); });
    return () => { active = false; };
  }, []);

  if (!isRoot || slug !== TARGET_SLUG) return null;

  async function selectImage(image_url: string) {
    setMessage("");
    const response = await fetch("/api/services/" + encodeURIComponent(slug) + "/gallery/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message ?? "No fue posible añadir la imagen.");
    setMessage("Imagen añadida a la galería de este servicio.");
    router.refresh();
  }

  return (
    <aside className="mt-4 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Biblioteca de imágenes del servicio">
      <p className="mb-3 text-sm font-semibold text-slate-700">Galería del servicio · Administración root</p>
      <MultimediaPicker collection="galeria" label="Elegir imagen de biblioteca" onSelect={selectImage} />
      {message && <p role="status" className="mt-3 text-sm text-green-700">{message}</p>}
    </aside>
  );
}
