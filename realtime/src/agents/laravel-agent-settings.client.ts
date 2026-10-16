import { Injectable } from "@nestjs/common";

export type RuntimeAiModel = {
  id: number;
  name: string;
  model_identifier: string;
  provider: {
    id: number;
    name: string;
    code: string;
    driver: "gemini" | "openai_compatible" | "anthropic";
    base_url: string;
    api_key: string | null;
    timeout_seconds: number;
    verify_tls: boolean;
  };
};

type AgentCredentials = {
  agent_id: string;
  provider: "gemini";
  model: string;
  api_key: string | null;
  primary: RuntimeAiModel | null;
  fallback: RuntimeAiModel | null;
  training_instructions?: Array<{ category: string; content: string }>;
};

@Injectable()
export class LaravelAgentSettingsClient {
  async credentials(agentId: string): Promise<AgentCredentials> {
    const base = (process.env.LARAVEL_API_URL ?? "http://backend-nginx/api/v1").replace(/\/$/, "");
    const secret = String(process.env.AGENT_SHARED_SECRET ?? "").trim();

    const response = await fetch(`${base}/internal/agents/${encodeURIComponent(agentId)}/credentials`, {
      headers: { "X-Agent-Shared-Secret": secret },
    });

    if (!response.ok) {
      throw new Error(`No fue posible obtener la configuración del agente (${response.status}).`);
    }

    const json = await response.json() as { data: AgentCredentials };
    return json.data;
  }
}
