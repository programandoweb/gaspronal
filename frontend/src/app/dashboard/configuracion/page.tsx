import { DeploymentPanel } from "@/components/dashboard/deployment-panel";
import { InstagramSettingsPanel } from "@/components/dashboard/instagram-settings-panel";

type Props = {
  searchParams: Promise<{ deploy?: string; ref?: string }>;
};

export default async function ConfigurationPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="w-full space-y-7">
      <section>
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Administración</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Configuración</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">Herramientas técnicas y configuración operativa de la plataforma.</p>
      </section>
      <InstagramSettingsPanel />
      <DeploymentPanel
        autoDeploy={params.deploy === "1"}
        requestedRef={params.ref ?? null}
      />
    </div>
  );
}
