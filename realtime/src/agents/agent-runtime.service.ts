import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AgentRegistryService } from "./agent-registry.service";
import { GeminiService, type GeminiContent, type GeminiFunctionDeclaration } from "./gemini.service";
import { OpenAiCompatibleService, type OpenAiMessage } from "./openai-compatible.service";
import type { RuntimeAiModel } from "./laravel-agent-settings.client";
import { LaravelAgentSettingsClient } from "./laravel-agent-settings.client";
import { LaravelCommercialClient } from "./laravel-commercial.client";
import { LaravelKnowledgeClient } from "./laravel-knowledge.client";
import { LaravelAgentAnalyticsClient } from "./laravel-agent-analytics.client";
import { ContentCreatorService } from "./content-creator.service";
import type { AgentMessageInput, AgentResponse } from "./agent.types";

const CLAUDIO_FUNCTIONS: GeminiFunctionDeclaration[] = [
  {
    name: "knowledge_search",
    description: "Consulta la base de conocimiento verificada de Gaspronal. Debes usarla antes de responder ubicación, horarios, políticas, empresa, procesos o información institucional.",
    parameters: {
      type: "OBJECT",
      required: ["query"],
      properties: { query: { type: "STRING", description: "Pregunta o tema que necesitas verificar." } },
    },
  },
  {
    name: "register_unanswered_question",
    description: "Registra una pregunta de Gaspronal que no pudiste responder con evidencia suficiente. Úsala antes de decir que no tienes la información.",
    parameters: {
      type: "OBJECT",
      required: ["question"],
      properties: { question: { type: "STRING" } },
    },
  },
  {
    name: "catalog_search",
    description: "Busca productos o servicios publicados con precio comercial privado. Úsala antes de hablar de productos o precios.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "Nombre, referencia o necesidad del cliente." } },
    },
  },
  {
    name: "create_quote",
    description: "Crea una propuesta comercial en borrador para revisión y aprobación de un administrador. Requiere nombre, email y WhatsApp.",
    parameters: {
      type: "OBJECT",
      required: ["name", "email", "whatsapp", "items"],
      properties: {
        name: { type: "STRING" },
        email: { type: "STRING" },
        whatsapp: { type: "STRING" },
        notes: { type: "STRING" },
        items: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            required: ["catalog_item_id", "quantity"],
            properties: {
              catalog_item_id: { type: "INTEGER" },
              quantity: { type: "NUMBER" },
            },
          },
        },
      },
    },
  },
  {
    name: "create_appointment",
    description: "Agenda una cita comercial asociada a un cliente. Requiere nombre, email y WhatsApp.",
    parameters: {
      type: "OBJECT",
      required: ["name", "email", "whatsapp", "scheduled_at"],
      properties: {
        name: { type: "STRING" },
        email: { type: "STRING" },
        whatsapp: { type: "STRING" },
        scheduled_at: { type: "STRING", description: "Fecha ISO 8601." },
        channel: { type: "STRING" },
        notes: { type: "STRING" },
      },
    },
  },
  {
    name: "handoff_to_human",
    description: "Escala la conversación a un asesor humano y deja el lead preparado para seguimiento.",
    parameters: {
      type: "OBJECT",
      required: ["name", "email", "whatsapp"],
      properties: {
        name: { type: "STRING" },
        email: { type: "STRING" },
        whatsapp: { type: "STRING" },
        notes: { type: "STRING" },
      },
    },
  },
  {
    name: "register_customer",
    description: "Registra o actualiza al cliente en users con rol cliente únicamente después de que haya entregado nombre, correo, WhatsApp y haya aceptado expresamente el tratamiento de datos.",
    parameters: {
      type: "OBJECT",
      required: ["name", "email", "whatsapp", "accepts_data_processing"],
      properties: {
        name: { type: "STRING" },
        email: { type: "STRING" },
        whatsapp: { type: "STRING", description: "Formato internacional E.164, por ejemplo +573115000926." },
        accepts_data_processing: { type: "BOOLEAN" },
        policy_version: { type: "STRING" },
      },
    },
  },
];

const SOFIA_FUNCTIONS: GeminiFunctionDeclaration[] = [
  {
    name: "unresolved_questions",
    description: "Lista las preguntas que Claudio no pudo responder y que necesitan investigación o curaduría.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "knowledge_search",
    description: "Consulta el conocimiento ya publicado para Claudio y evita duplicados.",
    parameters: {
      type: "OBJECT",
      required: ["query"],
      properties: { query: { type: "STRING" } },
    },
  },
  {
    name: "knowledge_upsert",
    description: "Publica conocimiento verificado para el RAG de Claudio. Usa una fuente verificable y no publiques datos dudosos.",
    parameters: {
      type: "OBJECT",
      required: ["title", "answer"],
      properties: {
        title: { type: "STRING" },
        question: { type: "STRING" },
        answer: { type: "STRING" },
        category: { type: "STRING" },
        keywords: { type: "STRING" },
        source_url: { type: "STRING" },
        confidence: { type: "INTEGER" },
        question_id: { type: "INTEGER" },
      },
    },
  },
];

@Injectable()
export class AgentRuntimeService {
  constructor(
    private readonly registry: AgentRegistryService,
    private readonly settings: LaravelAgentSettingsClient,
    private readonly gemini: GeminiService,
    private readonly openAiCompatible: OpenAiCompatibleService,
    private readonly commercial: LaravelCommercialClient,
    private readonly knowledge: LaravelKnowledgeClient,
    private readonly analytics: LaravelAgentAnalyticsClient,
    private readonly contentCreator: ContentCreatorService,
  ) {}

  async execute(agentId: string, input: AgentMessageInput): Promise<AgentResponse> {
    const agent = this.registry.get(agentId);
    if (!agent) throw new NotFoundException("Agente no encontrado.");

    const message = String(input?.message ?? "").trim();
    if (!message) throw new Error("El mensaje es obligatorio.");

    const startedAt = Date.now();
    const requestId = input.requestId?.trim() || randomUUID();
    const credentials = await this.settings.credentials(agent.id);

    if (agent.id === "lucia") {
      const geminiModel = [credentials.primary, credentials.fallback].find(item => item?.provider.driver === "gemini" && item.provider.api_key);
      const apiKey = geminiModel?.provider.api_key || credentials.api_key;
      const textModel = geminiModel?.model_identifier || credentials.model || "gemini-3.8-flash";
      if (!apiKey) {
        return { requestId, agent: { id: agent.id, name: agent.name, role: agent.role }, message: "Lucía necesita un modelo Gemini configurado con API key.", status: "configuration_required" };
      }
      const answer = await this.contentCreator.execute({ topic: message, apiKey, textModel });
      return this.finish(requestId, agent, message, answer, startedAt, input.sessionId);
    }

    const system = [
      agent.prompt,
      agent.memory ? "\n## Memoria\n" + agent.memory : "",
      agent.tools ? "\n## Herramientas\n" + agent.tools : "",
      "\nResponde siempre en español salvo que el usuario solicite otro idioma.",
    ].join("\n").trim();

    const routedModels = [credentials.primary, credentials.fallback].filter(
      (item): item is RuntimeAiModel => Boolean(item),
    );

    if (routedModels.length) {
      let lastError: unknown = null;

      for (const routedModel of routedModels) {
        try {
          const answer = this.isToolAgent(agent.id)
            ? await this.generateWithTools(
                agent.id,
                routedModel,
                system,
                message,
                input.history ?? [],
              )
            : await this.generateWithRoutedModel(routedModel, system, message);

          return this.finish(requestId, agent, message, answer, startedAt, input.sessionId);
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error("No fue posible obtener respuesta de los modelos configurados.");
    }

    if (!credentials.api_key) {
      return {
        requestId,
        agent: { id: agent.id, name: agent.name, role: agent.role },
        message: `${agent.name} no tiene un modelo principal configurado.`,
        status: "configuration_required",
      };
    }

    const answer = this.isToolAgent(agent.id)
      ? await this.generateLegacyGeminiWithTools(
          agent.id,
          credentials.api_key,
          credentials.model,
          system,
          message,
          input.history ?? [],
        )
      : await this.gemini.generate({
          apiKey: credentials.api_key,
          model: credentials.model,
          system,
          message,
        });

    return this.finish(requestId, agent, message, answer, startedAt, input.sessionId);
  }

  private isToolAgent(agentId: string): agentId is "claudio" | "sofia" {
    return agentId === "claudio" || agentId === "sofia";
  }

  private async generateWithTools(
    agentId: "claudio" | "sofia",
    model: RuntimeAiModel,
    system: string,
    message: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<string> {
    const functions = agentId === "claudio" ? CLAUDIO_FUNCTIONS : SOFIA_FUNCTIONS;

    if (model.provider.driver === "gemini") {
      if (!model.provider.api_key) {
        throw new Error(`El proveedor ${model.provider.name} no tiene API key configurada.`);
      }

      return this.runGeminiToolLoop(
        agentId,
        model.provider.api_key,
        model.model_identifier,
        system,
        message,
        history,
        functions,
      );
    }

    if (model.provider.driver === "openai_compatible") {
      const messages: OpenAiMessage[] = [
        ...history.slice(-20).map(item => ({
          role: item.role,
          content: item.content,
        } as OpenAiMessage)),
        { role: "user", content: message },
      ];

      for (let attempt = 0; attempt < 8; attempt++) {
        const turn = await this.openAiCompatible.generateTurn({
          model,
          system,
          messages,
          functions,
        });

        messages.push(turn.message);

        if (turn.type === "text") {
          return turn.text;
        }

        const result = await this.executeTool(agentId, turn.name, turn.args);
        messages.push({
          role: "tool",
          tool_call_id: turn.toolCallId,
          content: JSON.stringify(result),
        });
      }

      throw new Error(`${agentId} excedió el límite de operaciones de herramienta para este mensaje.`);
    }

    throw new Error(`El driver ${model.provider.driver} no soporta herramientas de agentes.`);
  }

  private async generateLegacyGeminiWithTools(
    agentId: "claudio" | "sofia",
    apiKey: string,
    model: string,
    system: string,
    message: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<string> {
    const functions = agentId === "claudio" ? CLAUDIO_FUNCTIONS : SOFIA_FUNCTIONS;

    return this.runGeminiToolLoop(
      agentId,
      apiKey,
      model,
      system,
      message,
      history,
      functions,
    );
  }

  private async runGeminiToolLoop(
    agentId: "claudio" | "sofia",
    apiKey: string,
    model: string,
    system: string,
    message: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
    functions: GeminiFunctionDeclaration[],
  ): Promise<string> {
    const contents: GeminiContent[] = [
      ...history.slice(-20).map(item => ({
        role: item.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: item.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    for (let attempt = 0; attempt < 8; attempt++) {
      const turn = await this.gemini.generateTurn({
        apiKey,
        model,
        system,
        contents,
        functions,
        googleSearch: agentId === "sofia",
      });

      contents.push(turn.content);

      if (turn.type === "text") {
        return turn.text;
      }

      const result = await this.executeTool(agentId, turn.name, turn.args);
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: turn.name, response: result } }],
      });
    }

    throw new Error(`${agentId} excedió el límite de operaciones de herramienta para este mensaje.`);
  }

  private async executeTool(
    agentId: string,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (
      agentId === "claudio"
      && ["catalog_search", "create_quote", "create_appointment", "handoff_to_human", "register_customer"].includes(name)
    ) {
      return this.commercial.execute(agentId, name, args);
    }

    return this.knowledge.execute(agentId, name, args);
  }

  private async generateWithRoutedModel(
    model: RuntimeAiModel,
    system: string,
    message: string,
  ): Promise<string> {
    if (model.provider.driver === "gemini") {
      if (!model.provider.api_key) {
        throw new Error(`El proveedor ${model.provider.name} no tiene API key configurada.`);
      }

      return this.gemini.generate({
        apiKey: model.provider.api_key,
        model: model.model_identifier,
        system,
        message,
      });
    }

    if (model.provider.driver === "openai_compatible") {
      return this.openAiCompatible.generate({ model, system, message });
    }

    throw new Error(`El driver ${model.provider.driver} todavía no está habilitado para agentes conversacionales.`);
  }

  private async finish(
    requestId:string,
    agent:{id:string;name:string;role:string},
    question:string,
    answer:string,
    startedAt:number,
    sessionId?:number,
  ):Promise<AgentResponse>{
    await this.analytics.log(agent.id,{
      request_id:requestId,
      session_id:sessionId,
      question,
      answer,
      status:"completed",
      duration_ms:Date.now()-startedAt,
    });

    return {
      requestId,
      agent:{id:agent.id,name:agent.name,role:agent.role},
      message:answer,
      status:"completed",
    };
  }
}
