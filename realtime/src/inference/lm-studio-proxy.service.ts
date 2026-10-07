import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  LmStudioProxyAccepted,
  LmStudioProxyCompleted,
  LmStudioProxyError,
  LmStudioProxyRequest,
  LmStudioProxyStarted,
} from "./lm-studio-proxy.types";

const ALLOWED_PATHS = new Set([
  "/api/v1/models",
  "/api/v1/chat",
  "/v1/models",
  "/v1/chat/completions",
]);

type EmitInferenceEvent = (
  event:
    | "lm.accepted"
    | "lm.started"
    | "lm.completed"
    | "lm.error",
  payload:
    | LmStudioProxyAccepted
    | LmStudioProxyStarted
    | LmStudioProxyCompleted
    | LmStudioProxyError,
) => void;

@Injectable()
export class LmStudioProxyService {
  private readonly logger = new Logger(LmStudioProxyService.name);
  private readonly activeRequests = new Map<string, AbortController>();

  constructor(private readonly config: ConfigService) {}

  start(
    ownerId: string,
    request: LmStudioProxyRequest,
    emit: EmitInferenceEvent,
  ): { ok: boolean; requestId: string; error?: string } {
    try {
      this.validateRequest(request);
      const key = this.requestKey(ownerId, request.requestId);
      if (this.activeRequests.has(key)) {
        throw new Error(`LM Studio request ${request.requestId} is already running`);
      }

      const controller = new AbortController();
      this.activeRequests.set(key, controller);

      emit("lm.accepted", {
        requestId: request.requestId,
        agentId: request.agentId,
        acceptedAt: new Date().toISOString(),
      });

      void this.execute(ownerId, request, controller, emit);
      return { ok: true, requestId: request.requestId };
    } catch (error) {
      return {
        ok: false,
        requestId: String(request?.requestId || ""),
        error: this.formatError(error),
      };
    }
  }

  cancel(ownerId: string, requestId: string): boolean {
    const key = this.requestKey(ownerId, requestId);
    const controller = this.activeRequests.get(key);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  private async execute(
    ownerId: string,
    request: LmStudioProxyRequest,
    controller: AbortController,
    emit: EmitInferenceEvent,
  ): Promise<void> {
    const startedAt = Date.now();
    const key = this.requestKey(ownerId, request.requestId);

    emit("lm.started", {
      requestId: request.requestId,
      agentId: request.agentId,
      startedAt: new Date().toISOString(),
    });

    const timeoutMs = this.resolveTimeout(request.timeoutMs);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    timeout.unref?.();

    try {
      const baseUrl = this.config
        .get<string>("LM_STUDIO_BASE_URL", "http://10.8.0.2:1234")
        .trim()
        .replace(/\/+$/, "");

      const response = await fetch(`${baseUrl}${request.path}`, {
        method: request.method,
        headers: {
          Accept: "application/json",
          ...(request.method === "POST"
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body:
          request.method === "POST"
            ? JSON.stringify(this.sanitizeBody(request.body))
            : undefined,
        signal: controller.signal,
      });

      const raw = await response.text();
      const data = this.parseResponse(raw);
      const durationMs = Date.now() - startedAt;

      if (!response.ok) {
        emit("lm.error", {
          requestId: request.requestId,
          agentId: request.agentId,
          ok: false,
          statusCode: response.status,
          error: this.formatHttpError(response.status, data),
          durationMs,
          finishedAt: new Date().toISOString(),
        });
        return;
      }

      emit("lm.completed", {
        requestId: request.requestId,
        agentId: request.agentId,
        ok: true,
        statusCode: response.status,
        data,
        durationMs,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      emit("lm.error", {
        requestId: request.requestId,
        agentId: request.agentId,
        ok: false,
        error: this.formatError(error),
        durationMs: Date.now() - startedAt,
        finishedAt: new Date().toISOString(),
      });
    } finally {
      clearTimeout(timeout);
      this.activeRequests.delete(key);
    }
  }

  private validateRequest(request: LmStudioProxyRequest): void {
    if (!request || typeof request !== "object") {
      throw new Error("Invalid LM Studio request");
    }
    if (!String(request.requestId || "").trim()) {
      throw new Error("requestId is required");
    }
    if (!String(request.agentId || "").trim()) {
      throw new Error("agentId is required");
    }
    if (request.method !== "GET" && request.method !== "POST") {
      throw new Error("Only GET and POST are allowed");
    }
    if (!ALLOWED_PATHS.has(String(request.path || ""))) {
      throw new Error(`LM Studio path is not allowed: ${String(request.path || "")}`);
    }
    if (request.method === "GET" && request.body !== undefined) {
      throw new Error("GET requests cannot include a body");
    }

    if (request.body !== undefined) {
      const maxBytes = Math.max(
        1024,
        Number(
          this.config.get<string>(
            "LM_STUDIO_MAX_BODY_BYTES",
            "2097152",
          ),
        ) || 2097152,
      );
      const bytes = Buffer.byteLength(JSON.stringify(request.body), "utf8");
      if (bytes > maxBytes) {
        throw new Error(`LM Studio request body exceeds ${maxBytes} bytes`);
      }
    }
  }

  private sanitizeBody(
    body?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!body) return undefined;

    // La extensión conserva exactamente su contrato actual y continúa enviando
    // migo_context_id/contextId. Gaspronal acepta esos campos de transporte,
    // pero no los reenvía a LM Studio porque no forman parte de su API.
    const sanitized = { ...body };
    delete sanitized.migo_context_id;
    return sanitized;
  }

  private resolveTimeout(requested?: number): number {
    const configured =
      Number(
        this.config.get<string>(
          "LM_STUDIO_REQUEST_TIMEOUT_MS",
          "120000",
        ),
      ) || 120000;

    const value =
      Number.isFinite(requested) && Number(requested) > 0
        ? Number(requested)
        : configured;

    return Math.min(Math.max(value, 1000), 300000);
  }

  private parseResponse(text: string): unknown {
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private formatHttpError(statusCode: number, data: unknown): string {
    const detail =
      typeof data === "string" ? data : JSON.stringify(data);
    return `LM Studio responded HTTP ${statusCode}${
      detail ? `: ${detail.slice(0, 2000)}` : ""
    }`;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error && error.name === "AbortError") {
      return "LM Studio request was cancelled or exceeded its timeout";
    }
    return error instanceof Error
      ? error.message
      : String(error || "Unknown LM Studio proxy error");
  }

  private requestKey(ownerId: string, requestId: string): string {
    return `${ownerId}:${requestId}`;
  }
}
