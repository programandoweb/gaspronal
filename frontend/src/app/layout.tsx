import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import PublicWhatsAppButton from "@/components/public/PublicWhatsAppButton";
import ClaudioWebChat from "@/components/public/ClaudioWebChat";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-sans",
});

export const viewport: Viewport = {
  themeColor: "#005C99",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://gaspronal.programandoweb.net"),
  applicationName: "Gaspronal",
  authors: [{ name: "Gaspronal Industrias y Servicios S.A.S." }],
  creator: "Gaspronal Industrias y Servicios S.A.S.",
  publisher: "Gaspronal Industrias y Servicios S.A.S.",
  title: {
    default: "Gaspronal | Equipos industriales y soluciones a gas",
    template: "%s | Gaspronal",
  },
  description:
    "Fabricación de equipos industriales en acero inoxidable, redes de gas, extracción industrial, mantenimiento y soluciones especiales a medida.",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Gaspronal | Equipos industriales y soluciones a gas",
    description:
      "Fabricación, instalación y servicio técnico para cocinas profesionales, industria de alimentos, redes de gas y extracción.",
    siteName: "Gaspronal",
    locale: "es_CO",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={sourceSans.variable}>
        {children}
        <ClaudioWebChat />
        <PublicWhatsAppButton />
      </body>
    </html>
  );
}
