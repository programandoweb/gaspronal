"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowUpRight,
  FiBookOpen,
  FiCpu,
  FiCheckCircle,
  FiChevronRight,
  FiHelpCircle,
  FiMessageCircle,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";

type Agent={id:string;name:string;role:string};

const HIDDEN_AGENT_IDS=new Set(["leonardo","sofia","lucia"]);

type AgentMetric={
  id:string;
  interactions_30d:number;
  last_activity?:string|null;
  has_api_key:boolean;
  model:string;
  knowledge_count:number;
  pending_questions:number;
};

type DashboardData={
  kpis:{
    interactions_30d:number;
    knowledge_total:number;
    unanswered_pending:number;
    configured_agents:number;
  };
  agents:AgentMetric[];
  activity_7d:Array<{date:string;label:string;interactions:number}>;
  recent_questions:Array<{
    id:number;
    agent_id:string;
    question:string;
    status:string;
    created_at:string;
  }>;
  top_unanswered:Array<{
    id:number;
    agent_id:string;
    question:string;
    times_asked:number;
    last_asked_at?:string|null;
  }>;
  recent_knowledge:Array<{
    id:number;
    agent_id:string;
    category?:string|null;
    title:string;
    confidence:number;
    source_type:string;
    updated_at:string;
  }>;
  research?:{
    status:string;
    processed_items:number;
    total_items:number;
    successful_items:number;
    failed_items:number;
    last_heartbeat_at?:string|null;
  }|null;
  generated_at:string;
};

function dateTime(value?:string|null){
  if(!value)return "Sin actividad";
  return new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
}

export default function AgentsPage(){
  const [agents,setAgents]=useState<Agent[]>([]);
  const [data,setData]=useState<DashboardData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    setError("");

    const [agentsResponse,metricsResponse]=await Promise.all([
      fetch("/api/agents",{cache:"no-store"}),
      fetch("/api/admin/agents/dashboard",{cache:"no-store"}),
    ]);

    const agentsJson=await agentsResponse.json().catch(()=>({}));
    const metricsJson=await metricsResponse.json().catch(()=>({}));

    if(!agentsResponse.ok||!metricsResponse.ok){
      setError(
        metricsJson.message??
        agentsJson.message??
        "No fue posible cargar el dashboard de agentes."
      );
      setLoading(false);
      return;
    }

    setAgents(agentsJson.data??[]);
    setData(metricsJson.data??null);
    setLoading(false);
  },[]);

  useEffect(()=>{void load();},[load]);

  const metricsMap=useMemo(
    ()=>new Map((data?.agents??[]).map(item=>[item.id,item])),
    [data]
  );

  const visibleAgents=useMemo(
    ()=>agents.filter(agent=>!HIDDEN_AGENT_IDS.has(agent.id)),
    [agents]
  );

  const visibleRecentQuestions=useMemo(
    ()=> (data?.recent_questions??[]).filter(item=>!HIDDEN_AGENT_IDS.has(item.agent_id)),
    [data]
  );

  const visibleRecentKnowledge=useMemo(
    ()=> (data?.recent_knowledge??[]).filter(item=>!HIDDEN_AGENT_IDS.has(item.agent_id)),
    [data]
  );

  const activityMax=useMemo(
    ()=>Math.max(1,...(data?.activity_7d??[]).map(item=>item.interactions)),
    [data]
  );

  if(loading){
    return <div className="w-full max-w-none py-10 text-sm text-[var(--muted)]">Cargando inteligencia operativa de agentes…</div>;
  }

  if(!data){
    return <div className="w-full max-w-none rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error||"No hay datos disponibles."}</div>;
  }

  const kpis=[
    {
      label:"Interacciones · 30 días",
      value:data.kpis.interactions_30d,
      detail:"preguntas procesadas por agentes",
      icon:FiMessageCircle,
    },
    {
      label:"Conocimiento RAG",
      value:data.kpis.knowledge_total,
      detail:"entradas publicadas y reutilizables",
      icon:FiBookOpen,
    },
    {
      label:"Preguntas pendientes",
      value:data.kpis.unanswered_pending,
      detail:"vacíos de conocimiento por resolver",
      icon:FiHelpCircle,
    },
    {
      label:"Agentes configurados",
      value:`${visibleAgents.filter(agent=>metricsMap.get(agent.id)?.model).length}/${visibleAgents.length}`,
      detail:"con API key disponible",
      icon:FiShield,
    },
  ];

  return <div className="w-full max-w-none space-y-7">
    <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Inteligencia artificial</span>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <FiCpu className="text-[var(--brand)]"/>
          Centro de agentes
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Uso real, conocimiento, preguntas, configuración y salud operativa de los agentes de Gaspronal.
        </p>
      </div>

      <button
        onClick={()=>void load()}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold"
      >
        <FiRefreshCw/>Actualizar
      </button>
    </header>

    {error&&(
      <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <FiAlertCircle className="mt-0.5 shrink-0"/>
        <p>{error}</p>
      </div>
    )}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map(({label,value,detail,icon:Icon})=>(
        <article key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="grid size-11 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <Icon size={20}/>
            </div>
            <FiTrendingUp className="text-[var(--muted)]"/>
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
          <strong className="mt-2 block text-3xl font-bold">{value}</strong>
          <span className="mt-1 block text-xs text-[var(--muted)]">{detail}</span>
        </article>
      ))}
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <FiActivity className="text-[var(--brand)]"/>
              Actividad de agentes · 7 días
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Interacciones registradas diariamente.</p>
          </div>
          <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">Telemetría real</span>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-3">
          {data.activity_7d.map(item=>(
            <div key={item.date} className="min-w-0">
              <div className="flex h-44 items-end justify-center rounded-xl bg-[var(--app-bg)] px-3 py-3">
                <div
                  className="w-full rounded-t-lg bg-[var(--brand)] transition-all"
                  style={{height:`${Math.max(6,(item.interactions/activityMax)*100)}%`}}
                  title={`${item.interactions} interacciones`}
                />
              </div>
              <p className="mt-2 truncate text-center text-xs font-semibold">{item.label}</p>
              <p className="mt-1 text-center text-[11px] text-[var(--muted)]">{item.interactions}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <FiSearch className="text-[var(--brand)]"/>
          Investigación de Jorge
        </h2>

        {data.research?(
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="Estado" value={data.research.status}/>
              <MiniMetric label="Procesados" value={`${data.research.processed_items}/${data.research.total_items}`}/>
              <MiniMetric label="Exitosos" value={data.research.successful_items}/>
              <MiniMetric label="Fallidos" value={data.research.failed_items}/>
            </div>

            {data.research.total_items>0&&(
              <div>
                <div className="mb-2 flex justify-between text-xs text-[var(--muted)]">
                  <span>Progreso</span>
                  <span>{Math.round((data.research.processed_items/data.research.total_items)*100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--app-bg)]">
                  <div
                    className="h-full bg-[var(--brand)]"
                    style={{width:`${Math.min(100,Math.round((data.research.processed_items/data.research.total_items)*100))}%`}}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-[var(--muted)]">
              Último heartbeat: {dateTime(data.research.last_heartbeat_at)}
            </p>
          </div>
        ):(
          <p className="mt-5 text-sm text-[var(--muted)]">Aún no hay ejecuciones de investigación registradas.</p>
        )}
      </article>
    </section>

    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Agentes disponibles</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Estado, uso, conocimiento y configuración de cada agente.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleAgents.map(agent=>{
          const metric=metricsMap.get(agent.id);
          return <Link
            key={agent.id}
            href={`/dashboard/agentes/${agent.id}`}
            className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <FiCpu size={23}/>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                metric?.model
                  ?"bg-emerald-50 text-emerald-700"
                  :"bg-amber-50 text-amber-800"
              }`}>
                {metric?.model||"Sin modelo"}
              </span>
            </div>

            <h3 className="mt-4 text-lg font-bold">{agent.name}</h3>
            <p className="mt-1 min-h-12 text-sm leading-6 text-[var(--muted)]">{agent.role}</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Interacciones 30d" value={metric?.interactions_30d??0}/>
              <MiniMetric label="Conocimiento" value={metric?.knowledge_count??0}/>
            </div>

            {metric?.pending_questions?(
              <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-700">
                <FiHelpCircle/>{metric.pending_questions} pregunta(s) pendiente(s)
              </p>
            ):(
              <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <FiCheckCircle/>Sin vacíos pendientes
              </p>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4 text-sm font-semibold text-[var(--brand)]">
              <span>Abrir agente</span>
              <FiChevronRight className="transition group-hover:translate-x-1"/>
            </div>
          </Link>;
        })}
      </div>
    </section>

    <section className="grid gap-6 xl:grid-cols-2">
      <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="flex items-center gap-2 font-bold">
            <FiMessageCircle className="text-[var(--brand)]"/>
            Preguntas recientes
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Últimas consultas enviadas a los agentes.</p>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {visibleRecentQuestions.length===0&&(
            <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
              La telemetría empieza a registrar preguntas desde este despliegue.
            </p>
          )}
          {visibleRecentQuestions.map(item=>(
            <div key={item.id} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <strong className="block truncate text-sm">{item.question}</strong>
                <span className="mt-1 block text-xs capitalize text-[var(--muted)]">
                  {item.agent_id} · {dateTime(item.created_at)}
                </span>
              </div>
              <Link
                href={`/dashboard/agentes/${item.agent_id}`}
                className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] text-[var(--brand)]"
                aria-label={`Abrir ${item.agent_id}`}
              >
                <FiArrowUpRight/>
              </Link>
            </div>
          ))}
        </div>
      </article>

      <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="flex items-center gap-2 font-bold">
            <FiHelpCircle className="text-[var(--brand)]"/>
            Vacíos de conocimiento
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Preguntas que Claudio todavía no puede responder con evidencia.</p>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {data.top_unanswered.length===0&&(
            <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">No hay preguntas pendientes.</p>
          )}
          {data.top_unanswered.map(item=>(
            <Link
              key={item.id}
              href="/dashboard/agentes/claudio"
              className="flex items-start justify-between gap-4 px-5 py-4 transition hover:bg-[var(--app-bg)]"
            >
              <div className="min-w-0">
                <strong className="block text-sm leading-6">{item.question}</strong>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  Última vez: {dateTime(item.last_asked_at)}
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                {item.times_asked}×
              </span>
            </Link>
          ))}
        </div>
      </article>
    </section>

    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <h2 className="flex items-center gap-2 font-bold">
          <FiBookOpen className="text-[var(--brand)]"/>
          Conocimiento reciente
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Últimas entradas publicadas en la base RAG.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead className="bg-[var(--app-bg)]">
            <tr className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="px-5 py-4">Conocimiento</th>
              <th className="px-5 py-4">Categoría</th>
              <th className="px-5 py-4">Fuente</th>
              <th className="px-5 py-4">Confianza</th>
              <th className="px-5 py-4">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {visibleRecentKnowledge.map(item=>(
              <tr key={item.id}>
                <td className="px-5 py-4">
                  <strong className="block text-sm">{item.title}</strong>
                  <span className="mt-1 block text-xs capitalize text-[var(--muted)]">{item.agent_id}</span>
                </td>
                <td className="px-5 py-4 text-sm">{item.category||"—"}</td>
                <td className="px-5 py-4 text-sm capitalize">{item.source_type}</td>
                <td className="px-5 py-4">
                  <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-bold text-[var(--brand)]">
                    {item.confidence}%
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-[var(--muted)]">{dateTime(item.updated_at)}</td>
              </tr>
            ))}
            {visibleRecentKnowledge.length===0&&(
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[var(--muted)]">Aún no hay conocimiento RAG publicado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>

    <p className="text-right text-xs text-[var(--muted)]">
      Última lectura: {dateTime(data.generated_at)}
    </p>
  </div>;
}

function MiniMetric({label,value}:{label:string;value:string|number}){
  return <div className="rounded-xl bg-[var(--app-bg)] p-3">
    <span className="block text-[11px] font-medium text-[var(--muted)]">{label}</span>
    <strong className="mt-1 block truncate text-sm">{value}</strong>
  </div>;
}
