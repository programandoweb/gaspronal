"use client";

import { usePathname } from "next/navigation";
import { FaWhatsapp } from "react-icons/fa";
import { GASPRONAL_WHATSAPP_HREF } from "@/lib/public-contact";

const privatePrefixes = ["/dashboard", "/login", "/forgot-password", "/reset-password"];

export default function PublicWhatsAppButton() {
  const pathname = usePathname();

  if (privatePrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <a
      href={GASPRONAL_WHATSAPP_HREF}
      target="_blank"
      rel="noreferrer"
      aria-label="Hablar con Gaspronal por WhatsApp"
      className="fixed bottom-5 right-4 z-[60] inline-flex min-h-14 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-sm font-black text-white shadow-[0_14px_40px_rgba(15,45,66,.28)] transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] sm:bottom-6 sm:right-6"
    >
      <FaWhatsapp className="text-2xl" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
