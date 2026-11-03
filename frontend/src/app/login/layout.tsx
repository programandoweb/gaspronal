import type { Metadata } from "next";

const title = "Acceso a plataforma empresarial | Gaspronal";
const description =
  "Ingresa de forma segura a la plataforma de Gaspronal Industrias y Servicios S.A.S. para gestionar tus operaciones.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/login" },
  openGraph: {
    title,
    description,
    url: "https://gaspronal.programandoweb.net/login",
    siteName: "Gaspronal",
    locale: "es_CO",
    type: "website",
    images: [
      {
        url: "/login/opengraph-image",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Gaspronal Industrias y Servicios: acceso a la plataforma empresarial",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/login/opengraph-image"],
  },
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
