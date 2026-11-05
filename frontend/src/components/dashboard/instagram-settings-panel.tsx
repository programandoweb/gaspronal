"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, ExternalLink, Instagram, LoaderCircle, LockKeyhole, Save } from "lucide-react";

type Configuration = {
  client_id: string;
  instagram_user_id: string;
  graph_host: "graph.facebook.com" | "graph.instagram.com";
  has_token: boolean;
  source: "database" | "environment";
};

type SettingsResponse = {
  data: Configuration;
  meta?: { can_manage: boolean };
  message?: string;
};

const inputStyle =
  "mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10 disabled:opacity-60";

export function InstagramSettingsPanel() {
  const [config, setConfig] = useState<Configuration>({
    client_id: "", instagram_user_id: "", graph_host: "graph.facebook.com", has_token: false, source: "environment",
  });
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settings/instagram", { cache: "no-store" });
      const result = (await response.json().catch(() => ({}))) as Partial<SettingsResponse> & { message?: string };
      if (!response.ok || !result.data) {
        throw new Error(result.message ?? "No fue posible obtener la configuración de Instagram.");
      }
      setConfig(result.data);
      setCanManage(Boolean(result.meta?.can_manage));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error al cargar la configuración.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/settings/instagram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: config.client_id.trim() || null,
          instagram_user_id: config.instagram_user_id.trim(),
          graph_host: config.graph_host,
          ...(token.trim() ? { access_token: token.trim() } : {}),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as Partial<SettingsResponse> & {
        errors?: Record<string, string[]>;
      };
      if (!response.ok || !result.data) {
        throw new Error(Object.values(result.errors ?? {}).flat()[0] ??
          result.message ?? "No fue posible guardar Instagram.");
      }
      setConfig(result.data);
      setToken("");
      setShowToken(false);
      setNotice("Configuración guardada. El Home utilizará estas credenciales para mostrar las seis últimas publicaciones.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible guardar Instagram.");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof Configuration>(key: K, value: Configuration[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <Instagram size={23} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--accent)]">Integraciones</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--steel)]">Instagram · Feed del Home</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Configura la conexión de @gaspronal para mostrar automáticamente las últimas seis publicaciones antes del mapa.
            </p>
          </div>
        </div>
        <a href="https://www.instagram.com/gaspronal/" target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-bold text-[var(--brand)] transition hover:border-[var(--brand)]">
          Ver Instagram <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
          <LoaderCircle size={19} className="animate-spin" aria-hidden="true" /> Cargando configuración…
        </div>
      ) : (
        <form className="space-y-5 p-5 sm:p-6" onSubmit={(event) => void save(event)}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-bold " +
              (config.has_token ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900")}>
              {config.has_token ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {config.has_token ? "Token guardado" : "Falta configurar el token"}
            </span>
            {config.source === "environment" && config.has_token && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600">
                Configuración anterior desde .env
              </span>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm font-semibold text-[var(--steel)]">
              Client ID de Meta (App ID)
              <input type="text" inputMode="numeric" autoComplete="off"
                value={config.client_id} onChange={(event) => update("client_id", event.target.value)}
                disabled={!canManage || saving} placeholder="ID de la aplicación de Meta" className={inputStyle} />
              <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Identificador de la aplicación; no es el ID de la cuenta.</span>
            </label>
            <label className="block text-sm font-semibold text-[var(--steel)]">
              Instagram User ID <span className="text-red-500">*</span>
              <input type="text" inputMode="numeric" autoComplete="off" required
                value={config.instagram_user_id} onChange={(event) => update("instagram_user_id", event.target.value)}
                disabled={!canManage || saving} placeholder="ID numérico de @gaspronal" className={inputStyle} />
              <span className="mt-1 block text-xs font-normal text-[var(--muted)]">ID de la cuenta profesional desde la que se consultan los posts.</span>
            </label>
            <label className="block text-sm font-semibold text-[var(--steel)]">
              Tipo de autenticación
              <select value={config.graph_host} onChange={(event) =>
                  update("graph_host", event.target.value as Configuration["graph_host"])}
                disabled={!canManage || saving} className={inputStyle}>
                <option value="graph.facebook.com">Facebook Login · Meta Graph</option>
                <option value="graph.instagram.com">Instagram Login · Instagram Graph</option>
              </select>
              <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Debe corresponder al tipo de token autorizado.</span>
            </label>
          </div>

          <label className="block text-sm font-semibold text-[var(--steel)]">
            Access Token {config.has_token ? "(opcional para reemplazar)" : "(obligatorio)"}
            <span className="relative mt-2 block">
              <input
                type={showToken ? "text" : "password"}
                autoComplete="new-password"
                spellCheck={false}
                value={token}
                onChange={(event) => { setToken(event.target.value); setError(""); setNotice(""); }}
                disabled={!canManage || saving}
                placeholder={config.has_token ? "Dejar vacío para conservar el token" : "Pega aquí tu token de Meta"}
                className={inputStyle + " mt-0 pr-12 font-mono"}
              />
              <button type="button" onClick={() => setShowToken((current) => !current)}
                disabled={!canManage || saving} aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-slate-500 hover:text-[var(--brand)]">
                {showToken ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </span>
            <span className="mt-2 flex items-start gap-2 text-xs font-normal leading-5 text-[var(--muted)]">
              <LockKeyhole size={15} className="mt-0.5 shrink-0 text-[var(--brand)]" />
              El token se guarda cifrado en Laravel y no se devuelve al navegador. Si cambias otros campos, puedes dejarlo vacío.
            </span>
          </label>

          {config.source === "environment" && config.has_token && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Para trasladar definitivamente la configuración anterior de .env a la base de datos, ingresa nuevamente el token al guardar por primera vez.
            </p>
          )}
          {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} className="shrink-0" />{error}</p>}
          {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="shrink-0" />{notice}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
            <p className="max-w-2xl text-xs leading-5 text-[var(--muted)]">
              Requiere una cuenta profesional y permisos vigentes en Meta. El cambio no requiere un nuevo despliegue.
            </p>
            {canManage && (
              <button type="submit" disabled={saving || !config.instagram_user_id.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white transition hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
                {saving ? "Guardando…" : "Guardar Instagram"}
              </button>
            )}
            {!canManage && <span className="text-xs font-semibold text-slate-500">Acceso de solo lectura.</span>}
          </div>
        </form>
      )}
    </section>
  );
}
