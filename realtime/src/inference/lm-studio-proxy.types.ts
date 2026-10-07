export type LmStudioProxyMethod = "GET" | "POST";

export type LmStudioProxyPath =
  | "/api/v1/models"
  | "/api/v1/chat"
  | "/v1/models"
  | "/v1/chat/completions";

export type LmStudioProxyRequest = {
  requestId: string;
  agentId: string;
  method: LmStudioProxyMethod;
  path: LmStudioProxyPath;
  body?: Record<string, unknown>;
  contextId?: string;
  timeoutMs?: number;
};

export type LmStudioProxyCancel = {
  requestId: string;
  agentId?: string;
};

export type LmStudioProxyAccepted = {
  requestId: string;
  agentId: string;
  acceptedAt: string;
};

export type LmStudioProxyStarted = {
  requestId: string;
  agentId: string;
  startedAt: string;
};

export type LmStudioProxyCompleted = {
  requestId: string;
  agentId: string;
  ok: true;
  statusCode: number;
  data: unknown;
  durationMs: number;
  finishedAt: string;
};

export type LmStudioProxyError = {
  requestId: string;
  agentId: string;
  ok: false;
  statusCode?: number;
  error: string;
  durationMs: number;
  finishedAt: string;
};

export type LmStudioProxyEvent =
  | LmStudioProxyAccepted
  | LmStudioProxyStarted
  | LmStudioProxyCompleted
  | LmStudioProxyError;
