import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Condiciones contractuales de venta y fabricación | Gaspronal",
  description: "Condiciones generales de venta, fabricación, plazo de entrega de 30 días calendario, recepción y garantías de Gaspronal Industrias y Servicios S.A.S.",
  alternates: { canonical: "/contratos-de-venta" },
  robots: { index: true, follow: true },
};

const clauses = [
  {
    title: "1. Partes y alcance",
    text: "Las presentes condiciones generales son propuestas por Gaspronal Industrias y Servicios S.A.S. (en adelante, «Gaspronal») para la venta y, cuando corresponda, fabricación de equipos industriales y soluciones relacionadas. Cada operación se individualiza mediante la cotización, orden de compra, factura y demás documentos aceptados por las partes. Este texto no sustituye la identificación del comprador ni la descripción particular del pedido.",
  },
  {
    title: "2. Objeto y especificaciones del pedido",
    text: "Gaspronal suministrará o fabricará los bienes descritos en la cotización u orden aceptada, con las cantidades, dimensiones, materiales, características técnicas, acabados, accesorios y servicios expresamente convenidos. Cualquier plano, medida, instalación o adecuación especial deberá constar por escrito. En caso de discrepancia, prevalecerán las condiciones particulares expresamente aceptadas, siempre dentro de la legislación aplicable.",
  },
  {
    title: "3. Precio y condiciones de pago",
    text: "El valor, impuestos, anticipos, saldo y medios de pago serán los indicados en la cotización o acuerdo comercial aceptado. No se presume un porcentaje de anticipo ni un cobro adicional que no haya sido comunicado y aceptado previamente. Gaspronal entregará los soportes de pago y facturación que correspondan.",
  },
  {
    title: "4. Plazo de fabricación y entrega: 30 días calendario",
    text: "Salvo que las partes hayan acordado expresamente una fecha o plazo diferente, Gaspronal se compromete a entregar los bienes dentro de los treinta (30) días calendario siguientes a la aceptación y confirmación del pedido. Cuando la fabricación requiera medidas, diseños, planos o especificaciones que deba aprobar o suministrar el comprador, las partes dejarán constancia escrita de la fecha en que el pedido quedó completo y confirmado para fijar la fecha de entrega. Los retrasos, modificaciones o circunstancias que afecten el cumplimiento deberán comunicarse oportunamente al comprador, informando una nueva fecha propuesta; ninguna prórroga unilateral limita los derechos del comprador previstos por la ley.",
  },
  {
    title: "5. Lugar, transporte e instalación",
    text: "La dirección de entrega, el transporte, descargue, maniobras, montaje, conexión e instalación deberán señalarse en la cotización u orden aceptada, indicando cuáles están incluidos y cuáles se cobran por separado. Cuando no se incluya instalación, la entrega del equipo no implica que Gaspronal haya asumido la adecuación de redes, espacios o servicios del establecimiento.",
  },
  {
    title: "6. Cambios solicitados por el comprador",
    text: "Toda modificación de dimensiones, materiales, funcionalidades, cantidades o acabados posterior a la aceptación del pedido deberá documentarse y acordarse por escrito, incluyendo su eventual efecto sobre el precio y la fecha de entrega. Gaspronal no podrá sustituir unilateralmente las especificaciones esenciales acordadas.",
  },
  {
    title: "7. Recepción y observaciones",
    text: "Al recibir los bienes, el comprador podrá verificar cantidades, integridad exterior, accesorios y correspondencia con el pedido. Las novedades visibles podrán quedar registradas en el comprobante o acta de entrega y notificarse a Gaspronal. La firma de recibido no supone renuncia a reclamar defectos ocultos, incumplimientos o garantías legales.",
  },
  {
    title: "8. Garantía y atención posventa",
    text: "Gaspronal responderá por la calidad, idoneidad, seguridad y funcionamiento de los productos conforme a la garantía legal aplicable y a las garantías adicionales expresamente ofrecidas. La garantía legal se cuenta desde la entrega; su duración y efectividad se rigen por la normativa colombiana vigente. Los canales de contacto suministrados en la cotización, factura y sitio web podrán utilizarse para presentar solicitudes y reclamaciones.",
  },
  {
    title: "9. Incumplimiento, cancelación y derechos del comprador",
    text: "Ante falta de entrega, demora, producto no conforme o cualquier otro incumplimiento, las partes procurarán una solución documentada sin perjuicio de los derechos de reclamación, devolución de dinero, resolución contractual, retracto o reversión del pago cuando legalmente procedan. Las condiciones sobre pedidos personalizados se aplicarán respetando las excepciones y protecciones previstas en la legislación de consumo.",
  },
  {
    title: "10. Ley aplicable y solución de controversias",
    text: "Estas condiciones se interpretan conforme a las leyes de la República de Colombia. Las partes podrán acudir a mecanismos de arreglo directo y a las autoridades o jurisdicciones competentes, incluida la Superintendencia de Industria y Comercio cuando corresponda. No se entenderá pactada una renuncia a derechos irrenunciables del consumidor.",
  },
];

export default function ContratosDeVentaPage() {
  return (
    <main className="min-h-screen bg-[var(--surface-muted)] text-[var(--foreground)]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[84px] max-w-[1180px] items-center justify-between gap-5 px-4 sm:px-6 lg:px-10">
          <Link href="/" aria-label="Ir al inicio de Gaspronal">
            <Image src="/programandoweb/brand/logo-gaspronal-horizontal-full-color.png" alt="Gaspronal" width={220} height={78} className="h-auto w-[170px] sm:w-[200px]" priority />
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-bold text-[var(--brand)] hover:border-[var(--brand)]">
            <ArrowLeft size={16} /> Volver al inicio
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
        <div className="max-w-4xl">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand)]"><FileText size={17} /> Información contractual</p>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--steel)] sm:text-5xl">Condiciones contractuales de venta y fabricación</h1>
          <p className="mt-5 text-base leading-7 text-slate-600">Gaspronal Industrias y Servicios S.A.S. · Colombia</p>
          <div className="mt-8 rounded-2xl border border-[var(--brand)]/25 bg-white p-6">
            <p className="text-sm font-black uppercase tracking-widest text-[var(--brand)]">Compromiso de entrega</p>
            <p className="mt-2 text-3xl font-black text-[var(--steel)]">30 días calendario</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">Plazo general contado desde la aceptación y confirmación del pedido, salvo condiciones particulares expresamente acordadas. Los detalles de fabricación, lugar de entrega y pago se precisan en cada cotización u orden.</p>
          </div>
          <p className="mt-6 text-sm leading-6 text-slate-600">Estas condiciones deben leerse junto con la cotización u orden de compra aceptada. La sola publicación de esta página no formaliza una venta ni reemplaza el acuerdo particular entre Gaspronal y el comprador.</p>
        </div>

        <div className="mt-10 max-w-4xl space-y-4">
          {clauses.map((clause) => (
            <section key={clause.title} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-lg font-black text-[var(--steel)]">{clause.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base">{clause.text}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 max-w-4xl rounded-2xl bg-[var(--steel)] p-6 text-white sm:p-8">
          <h2 className="text-xl font-black">¿Necesitas aclarar las condiciones de tu pedido?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-200">Solicita a nuestro equipo comercial la cotización, las especificaciones y la fecha de entrega acordada antes de confirmar tu compra.</p>
          <Link href="/#contacto" className="mt-5 inline-flex items-center gap-2 font-bold text-white underline underline-offset-4">Contactar a Gaspronal <ArrowRight size={16} /></Link>
        </div>
      </section>
      <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Gaspronal Industrias y Servicios S.A.S. · <Link href="/" className="font-semibold text-[var(--brand)] hover:underline">Inicio</Link>
      </footer>
    </main>
  );
}
