"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  BookOpen,
  Boxes,
  BrainCircuit,
  CalendarDays,
  CornerDownRight,
  ExternalLink,
  FileCheck2,
  LayoutDashboard,
  PanelsTopLeft,
  LogOut,
  Menu,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  RotateCcw,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

type User = {
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true, permission: "dashboard.view" },
  { href: "/dashboard/catalogo", label: "Productos y servicios", icon: Boxes, exact: false, permission: "catalog.view" },
  { href: "/dashboard/gaspro-notas", label: "Gaspro-notas", icon: BookOpen, exact: false, permission: "content.view" },
  { href: "/dashboard/diseno", label: "Diseño", icon: PanelsTopLeft, exact: false, permission: "heroes.view" },
  { href: "/dashboard/agentes", label: "Agentes", icon: Bot, exact: false, permission: "agents.view" },
  { href: "/dashboard/ia", label: "Proveedores IA", icon: BrainCircuit, exact: false, permission: "ai.view" },
  { href: "/dashboard/canales", label: "Canales", icon: MessagesSquare, exact: false, permission: "channels.view" },
  { href: "/dashboard/extensiones", label: "Extensiones", icon: Puzzle, exact: false, permission: "extensions.view" },
  { href: "/dashboard/comercial/propuestas", label: "Propuestas", icon: FileCheck2, exact: false, permission: "commercial.quotes.view" },
  { href: "/dashboard/comercial/citas", label: "Citas", icon: CalendarDays, exact: false, permission: "commercial.appointments.view" },
  { href: "/dashboard/seo/redirecciones", label: "Redirecciones 301", icon: CornerDownRight, exact: false, permission: "seo.view" },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings, exact: false, permission: "deployments.view" },
  { href: "/dashboard/seguridad", label: "Usuarios y roles", icon: ShieldCheck, exact: false, permission: "security.users.view" },
] as const;

export function DashboardShell({ children, user, impersonating = false }: { children: React.ReactNode; user: User; impersonating?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("gaspronal-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("gaspronal-sidebar-collapsed", String(next));
      return next;
    });
  }

  async function stopImpersonation() {
    const response = await fetch("/api/auth/impersonation/stop", { method: "POST" });
    if (!response.ok) return;
    router.replace("/dashboard/seguridad");
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const visibleNavItems = navItems.filter((item) => user.permissions.includes(item.permission));

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      {open && (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-30 bg-black/45 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex max-w-[88vw] flex-col border-r border-[var(--border)] bg-[var(--sidebar)] text-white",
          "transition-[width,transform] duration-200 ease-out",
          "w-[280px]",
          collapsed ? "lg:w-[84px]" : "lg:w-[280px]",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div
          className={[
            "flex min-h-24 items-center border-b border-white/10 transition-all duration-200",
            collapsed ? "lg:px-3" : "px-4 sm:px-5",
          ].join(" ")}
        >
          <Link
            href="/dashboard"
            className={[
              "flex min-w-0 flex-1 items-center overflow-hidden",
              collapsed ? "lg:justify-center" : "",
            ].join(" ")}
            onClick={() => setOpen(false)}
            aria-label="Ir al dashboard de Gaspronal"
          >
            <img
              src={collapsed
                ? "/programandoweb/brand/isotipo-gaspronal-white.png"
                : "/programandoweb/brand/logo-gaspronal-horizontal-white.png"}
              alt="Gaspronal - Tecnología e Ingeniería Estratégica"
              className={[
                "object-contain transition-all duration-200",
                collapsed
                  ? "h-11 w-11 object-center"
                  : "h-auto max-h-14 w-full object-left",
              ].join(" ")}
            />
          </Link>

          <button
            className="ml-2 grid size-10 shrink-0 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p
            className={[
              "px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 transition-opacity",
              collapsed ? "lg:pointer-events-none lg:h-0 lg:overflow-hidden lg:pb-0 lg:opacity-0" : "opacity-100",
            ].join(" ")}
          >
            Administración
          </p>

          <div className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex min-h-12 items-center rounded-xl px-3 text-sm font-medium transition",
                    collapsed ? "lg:justify-center lg:px-0" : "gap-3",
                    active
                      ? "bg-white text-[var(--brand)] shadow-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  <Icon size={19} className="shrink-0" />
                  <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          {impersonating && (
            <button
              onClick={stopImpersonation}
              title={collapsed ? "Volver a la cuenta root" : undefined}
              className={[
                "mb-2 flex min-h-11 w-full items-center rounded-xl bg-amber-400 px-3 text-sm font-bold text-amber-950 transition hover:bg-amber-300",
                collapsed ? "lg:justify-center lg:px-0" : "gap-3",
              ].join(" ")}
            >
              <RotateCcw size={18} className="shrink-0" />
              <span className={collapsed ? "lg:hidden" : ""}>Volver a cuenta root</span>
            </button>
          )}

          <div
            className={[
              "mb-2 flex items-center rounded-xl py-3",
              collapsed ? "lg:justify-center lg:px-0" : "gap-3 px-3",
            ].join(" ")}
            title={collapsed ? user.name : undefined}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className={["min-w-0", collapsed ? "lg:hidden" : ""].join(" ")}>
              <strong className="block truncate text-sm">{user.name}</strong>
              <span className="block truncate text-xs text-white/50">{user.email}</span>
            </div>
          </div>

          <button
            onClick={logout}
            title={collapsed ? "Cerrar sesión" : undefined}
            className={[
              "flex min-h-11 w-full items-center rounded-xl px-3 text-sm text-white/65 transition hover:bg-white/10 hover:text-white",
              collapsed ? "lg:justify-center lg:px-0" : "gap-3",
            ].join(" ")}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={collapsed ? "lg:hidden" : ""}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div
        className={[
          "transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-[84px]" : "lg:pl-[280px]",
        ].join(" ")}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-[var(--border)] bg-[color:var(--surface)/0.94] px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            onClick={() => setOpen(true)}
            className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>

          <button
            onClick={toggleCollapsed}
            className="hidden size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:text-[var(--app-fg)] lg:grid"
            aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
            title={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>

          <div className="ml-3 min-w-0">
            <p className="truncate text-sm font-semibold">Gaspronal · Tecnología e Ingeniería Estratégica</p>
          </div>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--brand)] transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
            title="Abrir sitio público"
          >
            <span className="hidden sm:inline">Ver sitio</span>
            <ExternalLink size={17} />
          </a>
        </header>

        <main className="w-full max-w-none px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
