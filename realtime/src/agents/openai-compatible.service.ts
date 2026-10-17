import { Injectable } from "@nestjs/common";
import type { GeminiFunctionDeclaration } from "./gemini.service";
import type { RuntimeAiModel } from "./laravel-agent-settings.client";

export type OpenAiMessage = {
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export type OpenAiTurn =
  | { type: "text"; text: string; message: OpenAiMessage }
  | {
      type: "function_call";
      name: string;
      args: Record<string, unknown>;
      toolCallId: string;
      message: OpenAiMessage;
    };

@Injectable()
export class OpenAiCompatibleService {
  async generate(input: { model: RuntimeAiModel; system: string; message: string; temperature?: number }): Promise<string> {
    const turn = await this.generateTurn({
      model: input.model,
      system: input.system,
      messages: [{ role: "user", content: input.message }],
      temperature: input.temperature,
    });

    if (turn.type !== "text") {
      throw new Error("El modelo solicitó una herramienta no disponible.");
    }

    return turn.text;
  }

  async generateTurn(input: {
    model: RuntimeAiModel;
    system: string;
    messages: OpenAiMessage[];
    functions?: GeminiFunctionDeclaration[];
    temperature?: number;
  }): Promise<OpenAiTurn> {
    const provider = input.model.provider;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1, provider.timeout_seconds || 30) * 1000,
    );

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (provider.api_key) {
        headers.Authorization = `Bearer ${provider.api_key}`;
      }

      const baseUrl = provider.base_url.replace(/\/$/, "");
      const modelIdentifier = input.model.model_identifier === "__auto__"
        ? await this.resolveAutomaticModel(baseUrl, headers, controller.signal)
        : input.model.model_identifier;

      const tools = (input.functions ?? []).map(fn => ({
        type: "function",
        function: {
          name: fn.name,
          description: fn.description,
          parameters: this.normalizeSchema(fn.parameters),
        },
      }));

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: modelIdentifier,
          messages: [
            { role: "system", content: input.system },
            ...input.messages,
          ],
          ...(tools.length ? { tools, tool_choice: "auto" } : {}),
          ...(typeof input.temperature === "number" ? { temperature: input.temperature } : {}),
          stream: false,
        }),
      });

      const json = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string | Array<{ text?: string }> | null;
            tool_calls?: Array<{
              id?: string;
              type?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(json.error?.message ?? `Proveedor respondió HTTP ${response.status}.`);
      }

      const raw = json.choices?.[0]?.message;
      if (!raw) throw new Error("El proveedor respondió sin mensaje.");

      const toolCall = raw.tool_calls?.find(call => call.function?.name);
      if (toolCall?.function?.name) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          throw new Error(`El modelo devolvió argumentos inválidos para ${toolCall.function.name}.`);
        }

        const message: OpenAiMessage = {
          role: "assistant",
          content: typeof raw.content === "string" ? raw.content : null,
          tool_calls: [{
            id: toolCall.id ?? `tool-${Date.now()}`,
            type: "function",
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments || "{}",
            },
          }],
        };

        return {
          type: "function_call",
          name: toolCall.function.name,
          args,
          toolCallId: message.tool_calls![0].id,
          message,
        };
      }

      const content = raw.content;
      const text = Array.isArray(content)
        ? content.map(part => part?.text ?? "").join("").trim()
        : String(content ?? "").trim();

      if (!text) throw new Error("El proveedor respondió sin contenido.");

      return {
        type: "text",
        text,
        message: { role: "assistant", content: text },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeSchema(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(item => this.normalizeSchema(item));
    if (!value || typeof value !== "object") return value;

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = key === "type" && typeof item === "string"
        ? item.toLowerCase()
        : this.normalizeSchema(item);
    }
    return result;
  }

  private async resolveAutomaticModel(
    baseUrl: string,
    headers: Record<string, string>,
    signal: AbortSignal,
  ): Promise<string> {
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers,
      signal,
    });

    const json = await response.json() as unknown;

    if (!response.ok) {
      throw new Error(`No fue posible consultar los modelos del proveedor (HTTP ${response.status}).`);
    }

    const identifiers = this.extractModelIdentifiers(json);
    const model = identifiers[0];

    if (!model) {
      throw new Error("El proveedor no reportó ningún modelo cargado en /models.");
    }

    return model;
  }

  private extractModelIdentifiers(payload: unknown): string[] {
    const candidates: unknown[] = [];

    if (Array.isArray(payload)) {
      candidates.push(...payload);
    } else if (payload && typeof payload === "object") {
      const object = payload as Record<string, unknown>;
      if (Array.isArray(object.data)) candidates.push(...object.data);
      if (Array.isArray(object.models)) candidates.push(...object.models);
    }

    return candidates
      .map(item => {
        if (typeof item === "string") return item.trim();
        if (!item || typeof item !== "object") return "";

        const object = item as Record<string, unknown>;
        const value = object.id ?? object.model ?? object.name;
        return typeof value === "string" ? value.trim() : "";
      })
      .filter((value, index, all) => value !== "" && all.indexOf(value) === index);
  }
}
