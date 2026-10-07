"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiActivity,
  FiCheckCircle,
  FiEdit2,
  FiMonitor,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiWifi,
  FiWifiOff,
  FiX,
  FiZap,
} from "react-icons/fi";
import { connectExtensionsSocket, type ExtensionSocket } from "@/lib/extensions-socket";

type StoredExtension = {
  id: number;
  installation_id: string;
  name: string;
  type: string;
  version?: string | null;
  machine_name?: string | null;
  whatsapp_number?: string | null;
  enabled: boolean;
  settings?: Record<string, unknown> | null;
  last_seen_at?: string | null;
};

type OnlineExtension = {
  installationId: string;
  clientId: string;
  name: string;
  version: string;
  socketId: string;
  connectedAt: string;
  lastSeenAt: string;
};

type FormState = {
  id?: number;
  installation_id: string;
  name: string;
  machine_name: string;
  whatsapp_number: string;
  enabled: boolean;
};

const EMPTY_FORM: FormState = {
  installation_id: "",
  name: "",
  machine_name: "",
  whatsapp_number: "",
  enabled: true,
};

export default function ExtensionsPage() {
  const [items, setItems] = useState<StoredExtension[]>([]);
  const [online, setOnline] = useState<OnlineExtension[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [socketReady, setSocketReady] = useState(false);
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const socketRef = useRef<ExtensionSocket | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/extensions?per_page=100", { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.message ?? "No fue posible cargar las extensiones.");
      setLoading(false);
      return;
    }
    setItems(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();

    let active = true;
    let socket: ExtensionSocket | null = null;

    async function connect() {
      try {
        const tokenResponse = await fetch("/api/extensions/socket-token", { cache: "no-store" });
        const tokenJson = await tokenResponse.json();
        if (!tokenResponse.ok) throw new Error(tokenJson.message ?? "No fue posible autenticar Socket.IO.");

        socket = await connectExtensionsSocket(tokenJson.realtime_url, tokenJson.token);
        socketRef.current = socket;

        const onPresence = (payload: { data?: OnlineExtension[] }) => {
          if (!active) return;
          setOnline(Array.isArray(payload?.data) ? payload.data : []);
          setSocketReady(true);
        };

        socket.on("extension:presence", onPresence);
        socket.on("extension:error", (payload) => setMessage(payload?.message ?? "Error en realtime de extensiones."));
        socket.emit("extension:list", {}, (response) => {
          if (response?.ok) onPresence({ data: response.data });
        });
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "No fue posible conectar realtime.");
      }
    }

    void connect();

    return () => {
      active = false;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const onlineMap = useMemo(
    () => new Map(online.map((item) => [item.installationId, item])),
    [online],
  );

  const unregistered = useMemo(() => {
    const registeredIds = new Set(items.map((item) => item.installation_id));
    return online.filter((item) => !registeredIds.has(item.installationId));
  }, [items, online]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
    socketRef.current?.emit("extension:list", {}, (response) => {
      if (response?.ok) setOnline(response.data ?? []);
    });
  }

  function selectDetected(item: OnlineExtension) {
    setForm({
      installation_id: item.installationId,
      name: item.name || "Gaspronal WhatsApp IA",
      machine_name: "",
      whatsapp_number: "",
      enabled: true,
    });
  }

  function openEdit(item: StoredExtension) {
    setForm({
      id: item.id,
      installation_id: item.installation_id,
      name: item.name,
      machine_name: item.machine_name ?? "",
      whatsapp_number: item.whatsapp_number ?? "",
      enabled: item.enabled,
    });
    setDrawerOpen(true);
  }

  async function save() {
    if (!form.installation_id || !form.name.trim()) {
      setMessage("Selecciona una extensión conectada y define su nombre.");
      return;
    }

    const detected = onlineMap.get(form.installation_id);
    const url = form.id ? `/api/admin/extensions/${form.id}` : "/api/admin/extensions";
    const method = form.id ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        type: "whatsapp_web",
        version: detected?.version ?? undefined,
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.message ?? "No fue posible guardar la extensión.");
      return;
    }

    setDrawerOpen(false);
    setMessage(form.id ? "Extensión actualizada." : "Extensión registrada.");
    await load();
  }

  async function remove(item: StoredExtension) {
    if (!confirm(`¿Eliminar la extensión "${item.name}"?`)) return;
    const response = await fetch(`/api/admin/extensions/${item.id}`, { method: "DELETE" });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setMessage(json.message ?? "No fue posible eliminar la extensión.");
      return;
    }
    setMessage("Extensión eliminada.");
    await load();
  }

  async function runTest(item: StoredExtension) {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setMessage("Realtime no está conectado.");
      return;
    }

    if (!onlineMap.has(item.installation_id)) {
      setMessage("La extensión está offline; no es posible ejecutar la prueba.");
      return;
    }

    setTesting(item.installation_id);
    setMessage("");

    socket.emit("extension:test", { installationId: item.installation_id }, (response) => {
      setTesting(null);
      setMessage(response?.message ?? (response?.ok ? "Prueba completada." : "Falló la prueba."));
    });
  }

  return (
    <div className="w-full max-w-none space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Integraciones</span>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
            <FiMonitor className="text-[var(--brand)]" />
            Extensiones
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Instalaciones Chrome conectadas a Gaspronal por Socket.IO. La salud refleja la conexión realtime actual.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={() => {
              void load();
              socketRef.current?.emit("extension:list", {}, (response) => {
                if (response?.ok) setOnline(response.data ?? []);
              });
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold"
          >
            <FiRefreshCw /> Actualizar
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white"
          >
            <FiPlus /> Agregar
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Registradas</span>
          <strong className="mt-2 block text-2xl">{items.length}</strong>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Conectadas ahora</span>
          <strong className="mt-2 block text-2xl text-emerald-600">{online.length}</strong>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Socket dashboard</span>
          <strong className="mt-2 flex items-center gap-2 text-sm">
            {socketReady ? <FiWifi className="text-emerald-600" /> : <FiWifiOff className="text-rose-600" />}
            {socketReady ? "Conectado" : "Sin conexión"}
          </strong>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="border-b border-[var(--border)] bg-[var(--app-bg)]">
              <tr className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="px-5 py-4">Extensión</th>
                <th className="px-5 py-4">Instalación</th>
                <th className="px-5 py-4">Versión</th>
                <th className="px-5 py-4">Salud</th>
                <th className="px-5 py-4">Última señal</th>
                <th className="px-5 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--muted)]">Cargando extensiones…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No hay extensiones registradas. Abre Chrome con la extensión activa y pulsa Agregar.</td></tr>}
              {!loading && items.map((item) => {
                const live = onlineMap.get(item.installation_id);
                return (
                  <tr key={item.id} className="transition hover:bg-[var(--app-bg)]">
                    <td className="px-5 py-4">
                      <strong className="block text-sm">{item.name}</strong>
                      <span className="text-xs text-[var(--muted)]">{item.machine_name || "Sin alias de equipo"}</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-[var(--muted)]">{item.installation_id}</td>
                    <td className="px-5 py-4 text-sm">{live?.version || item.version || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {live ? <FiCheckCircle /> : <FiWifiOff />}
                        {live ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--muted)]">
                      {live ? new Date(live.lastSeenAt).toLocaleString("es-CO") : item.last_seen_at ? new Date(item.last_seen_at).toLocaleString("es-CO") : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={!live || testing === item.installation_id}
                          onClick={() => void runTest(item)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                          title="Abrir WhatsApp Web y validar comunicación con la extensión"
                        >
                          <FiZap /> {testing === item.installation_id ? "Probando…" : "Test"}
                        </button>
                        <button type="button" onClick={() => openEdit(item)} className="grid size-10 place-items-center rounded-xl border border-[var(--border)]" aria-label="Editar">
                          <FiEdit2 />
                        </button>
                        <button type="button" onClick={() => void remove(item)} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] text-rose-600" aria-label="Eliminar">
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {drawerOpen && (
        <>
          <button aria-label="Cerrar drawer" className="fixed inset-0 z-40 bg-black/45" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">{form.id ? "Editar" : "Descubrimiento realtime"}</span>
                <h2 className="mt-1 text-2xl font-bold">{form.id ? "Editar extensión" : "Agregar extensión"}</h2>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="grid size-10 place-items-center rounded-xl border border-[var(--border)]" aria-label="Cerrar">
                <FiX />
              </button>
            </div>

            {!form.id && (
              <section className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-bold"><FiActivity /> Disponibles ahora</h3>
                  <span className="text-xs text-[var(--muted)]">{unregistered.length} sin registrar</span>
                </div>

                <div className="space-y-2">
                  {unregistered.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                      No detecto extensiones nuevas. Mantén Chrome abierto y confirma que la extensión tenga configurado el realtime/token de Gaspronal.
                    </div>
                  )}
                  {unregistered.map((item) => (
                    <button
                      key={item.installationId}
                      type="button"
                      onClick={() => selectDetected(item)}
                      className={`w-full rounded-xl border p-4 text-left transition ${form.installation_id === item.installationId ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)] hover:border-[var(--brand)]"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong>{item.name}</strong>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><FiWifi /> Online</span>
                      </div>
                      <div className="mt-2 font-mono text-[11px] text-[var(--muted)]">{item.installationId}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">Versión {item.version || "desconocida"}</div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Nombre</span>
                <input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 outline-none focus:border-[var(--brand)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Alias del equipo</span>
                <input value={form.machine_name} onChange={(e) => setForm((v) => ({ ...v, machine_name: e.target.value }))} placeholder="Ej. PC Cristina" className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 outline-none focus:border-[var(--brand)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">WhatsApp asociado</span>
                <input value={form.whatsapp_number} onChange={(e) => setForm((v) => ({ ...v, whatsapp_number: e.target.value }))} placeholder="+57…" className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 outline-none focus:border-[var(--brand)]" />
              </label>
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((v) => ({ ...v, enabled: e.target.checked }))} />
                <span className="text-sm font-semibold">Extensión habilitada</span>
              </label>
              <div className="rounded-xl bg-[var(--app-bg)] p-3">
                <span className="block text-xs font-semibold text-[var(--muted)]">Installation ID</span>
                <span className="mt-1 block break-all font-mono text-xs">{form.installation_id || "Selecciona una extensión detectada"}</span>
              </div>
            </section>

            <div className="mt-8 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <button type="button" onClick={() => setDrawerOpen(false)} className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold">Cancelar</button>
              <button type="button" onClick={() => void save()} className="min-h-11 rounded-xl bg-[var(--brand)] px-5 text-sm font-semibold text-white">Guardar</button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
