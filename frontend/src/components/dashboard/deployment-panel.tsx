"use client";

import { CheckCircle2, CircleAlert, Clock3, RefreshCw, Rocket, Square, Terminal, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Deployment = {
  id: number;
  status: "queued" | "running" | "cancelling" | "cancelled" | "succeeded" | "failed";
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  output: string | null;
  failure_message: string | null;
  created_at: string;
};

type Payload = {
  data: Deployment[];
  configuration: { enabled: boolean; ready: boolean; script_name: string | null };
};

const labels = { queued: "En cola", running: "Ejecutando", succeeded: "Correcto", failed: "Falló", cancelling: "Cancelando", cancelled: "Cancelado" };

function Status({ value }: { value: Deployment["status"] }) {
  const style = value === "succeeded"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : value === "failed"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}>{labels[value]}</span>;
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

export function DeploymentPanel({ autoDeploy = false, requestedRef = null }: { autoDeploy?: boolean; requestedRef?: string | null }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [mutating, setMutating] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [initializePrivateRepo, setInitializePrivateRepo] = useState(false);
  const autoDeployHandled = useRef(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/deployments", { cache: "no-store" });
    if (response.ok) setPayload(await response.json());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const active = payload?.data.find((item) => item.status === "queued" || item.status === "running" || item.status === "cancelling");

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(timer);
  }, [active, load]);

  async function mutateDeployment(item: Deployment, action: "cancel" | "delete" | "recover") {
    const cancel = action === "cancel";
    const question = action === "recover" ? `¿Recuperar el despliegue #${item.id} si ha superado el tiempo máximo? Después podrás iniciar un nuevo despliegue.` : cancel
      ? `¿Solicitar cancelar el despliegue #${item.id}? La operación actual puede terminar antes de detenerse.`
      : `¿Eliminar únicamente el registro del despliegue #${item.id}? No se eliminarán bases de datos ni archivos.`;
    if (!window.confirm(question)) return;
    setMutating(item.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/deployments/${item.id}${action === "recover" ? "/recover" : cancel ? "/cancel" : ""}`, {
        method: action === "delete" ? "DELETE" : "POST",
      });
      const result = await response.json().catch(() => ({}));
      setMessage(response.ok
        ? action === "recover" ? "Despliegue liberado. Ya puedes iniciar otro." : cancel ? "Cancelación solicitada. Se detendrá en el siguiente punto seguro." : "Registro eliminado."
        : result.message ?? "No fue posible completar la operación.");
      await load();
    } catch {
      setMessage("No fue posible conectar con el servidor.");
    } finally {
      setMutating(null);
    }
  }

  async function startDeployment(requireConfirmation = true) {
    if (requireConfirmation && !window.confirm("Se actualizará y desplegará Gaspronal usando el script configurado en el servidor. ¿Deseas continuar?")) return;
    setStarting(true);
    setMessage(null);
    const response = await fetch("/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initialize_private_repo: initializePrivateRepo }),
    });
    const result = await response.json().catch(() => ({}));
    setStarting(false);
    setMessage(response.ok ? "Despliegue iniciado correctamente." : (result.message ?? "No fue posible iniciar el despliegue."));
    await load();
  }

  useEffect(() => {
    if (!autoDeploy || loading || autoDeployHandled.current) return;

    autoDeployHandled.current = true;

    const url = new URL(window.location.href);
    url.searchParams.delete("deploy");
    url.searchParams.delete("ref");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);

    if (!payload?.configuration.ready) {
      setMessage("El enlace solicitó un despliegue, pero el servidor no está listo.");
      return;
    }

    if (active) {
      setMessage("Ya existe un despliegue en ejecución.");
      return;
    }

    setMessage(requestedRef ? `Solicitud de despliegue recibida para la revisión ${requestedRef.slice(0, 12)}…` : "Solicitud de despliegue recibida.");
    void startDeployment(false);
  }, [autoDeploy, loading, payload?.configuration.ready, active, requestedRef]);

  if (loading) return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">Cargando configuración…</div>;

  const latest = payload?.data[0] ?? null;
  const ready = Boolean(payload?.configuration.ready);

  return <div className="space-y-5">
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--brand)]"><Rocket size={20} /><span className="text-xs font-bold uppercase tracking-[0.16em]">Autodespliegue</span></div>
          <h2 className="mt-2 text-xl font-bold">Despliegue desde el servidor</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Ejecuta el script privado del VPS directamente desde Gaspronal. No utiliza GitHub Actions ni consume créditos de ejecución.</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-3">
          <button onClick={() => void startDeployment(true)} disabled={!ready || Boolean(active) || starting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-45">
            <Rocket size={18} />{starting ? "Iniciando…" : active ? "Desplegando…" : "Desplegar ahora"}
          </button>
          <label className="flex max-w-sm items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-3 text-xs leading-5 text-[var(--muted)]">
            <input type="checkbox" checked={initializePrivateRepo} onChange={e=>setInitializePrivateRepo(e.target.checked)} disabled={Boolean(active) || starting} className="mt-0.5 size-4 accent-[var(--brand)]"/>
            <span><strong className="text-[var(--foreground)]">Inicializar repositorio privado antes de desplegar</strong><br/>Opción avanzada. Está desmarcada por defecto.</span>
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full border px-3 py-1.5 font-semibold ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{ready ? "Servidor listo" : "Configuración pendiente"}</span>
        {payload?.configuration.script_name && <span className="rounded-full border border-[var(--border)] bg-[var(--app-bg)] px-3 py-1.5 font-mono text-[var(--muted)]">{payload.configuration.script_name}</span>}
      </div>

      {!payload?.configuration.enabled && <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><CircleAlert className="mt-0.5 shrink-0" size={18} /><p>Activa <code>DEPLOYMENT_ENABLED=true</code> en el backend cuando el script privado del VPS esté configurado.</p></div>}
      {message && <p className="mt-4 text-sm font-medium">{message}</p>}
    </section>

    {latest && <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] p-5"><Terminal size={18} /><strong>Último despliegue #{latest.id}</strong><Status value={latest.status} /><span className="ml-auto text-xs text-[var(--muted)]">{date(latest.created_at)}</span></div>
      <div className="grid gap-px bg-[var(--border)] sm:grid-cols-3">
        <div className="bg-[var(--surface)] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Inicio</p><p className="mt-1 text-sm">{date(latest.started_at)}</p></div>
        <div className="bg-[var(--surface)] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Fin</p><p className="mt-1 text-sm">{date(latest.finished_at)}</p></div>
        <div className="bg-[var(--surface)] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Código de salida</p><p className="mt-1 text-sm">{latest.exit_code ?? "—"}</p></div>
      </div>
      {(latest.output || latest.failure_message) && <div className="p-5">{latest.failure_message && <p className="mb-3 text-sm font-semibold text-red-700">{latest.failure_message}</p>}{latest.output && <pre className="max-h-[420px] overflow-auto rounded-xl bg-[var(--brand-strong)] p-4 text-xs leading-5 text-white/90">{latest.output}</pre>}</div>}
    </section>}

    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="flex items-center gap-2 border-b border-[var(--border)] p-5"><Clock3 size={18} /><h2 className="font-bold">Historial</h2><button onClick={() => void load()} className="ml-auto grid size-9 place-items-center rounded-lg border border-[var(--border)]" aria-label="Actualizar historial"><RefreshCw size={16} /></button></div>
      <div className="divide-y divide-[var(--border)]">
        {payload?.data.length ? payload.data.map((item) => <div key={item.id} className="grid gap-2 p-4 text-sm sm:grid-cols-[80px_1fr_auto] sm:items-center"><strong>#{item.id}</strong><div className="flex items-center gap-2">{item.status === "succeeded" ? <CheckCircle2 size={16} className="text-emerald-600" /> : item.status === "failed" ? <CircleAlert size={16} className="text-red-600" /> : <Clock3 size={16} className="text-amber-600" />}<Status value={item.status} /></div><div className="flex flex-wrap items-center gap-2 sm:justify-end"><span className="text-xs text-[var(--muted)]">{date(item.created_at)}</span>{(item.status === "queued" || item.status === "running") && <button type="button" onClick={() => void mutateDeployment(item, "cancel")} disabled={mutating !== null} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"><Square size={13} /> Cancelar</button>}{(item.status === "running" || item.status === "cancelling") && <button type="button" onClick={() => void mutateDeployment(item, "recover")} disabled={mutating !== null} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--app-bg)] disabled:opacity-50"><RefreshCw size={13} /> Recuperar</button>}{!["queued", "running", "cancelling"].includes(item.status) && <button type="button" onClick={() => void mutateDeployment(item, "delete")} disabled={mutating !== null} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={13} /> Eliminar</button>}</div></div>) : <p className="p-5 text-sm text-[var(--muted)]">Aún no existen despliegues registrados.</p>}
      </div>
    </section>
  </div>;
}
