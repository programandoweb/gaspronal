import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ChannelProvider } from "./channel.types";

export type InboundConversationResult = {
  conversation: {
    id: number;
    provider_id?: number | null;
    contact_phone?: string | null;
    contact_name?: string | null;
    status: "active" | "waiting_human" | "human_active" | "closed";
  };
  history: Array<{ role: "user" | "assistant"; content: string }>;
  customer?: {
    id: number;
    name: string;
    email?: string | null;
    whatsapp?: string | null;
    has_data_processing_consent: boolean;
  } | null;
  duplicate: boolean;
  should_automate: boolean;
};

@Injectable()
export class LaravelChannelsClient {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>("LARAVEL_API_URL", "http://backend-nginx/api/v1").replace(/\/$/, "");
    this.secret = config.get<string>("AGENT_SHARED_SECRET", "");
  }

  async providers(): Promise<ChannelProvider[]> {
    const payload = await this.request<{data: ChannelProvider[]}>("/internal/communications/providers");
    return payload.data ?? [];
  }

  async log(payload: Record<string, unknown>): Promise<void> {
    await this.request("/internal/communications/outbound-log", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async receiveInbound(payload: Record<string, unknown>): Promise<InboundConversationResult> {
    const response = await this.request<{data: InboundConversationResult}>("/internal/communications/inbound", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async recordOutbound(conversationId: number, payload: Record<string, unknown>): Promise<void> {
    await this.request(`/internal/communications/conversations/${conversationId}/outbound`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async conversationStatus(
    conversationId: number,
  ): Promise<"active" | "waiting_human" | "human_active" | "closed"> {
    const response = await this.request<{data: {status: "active" | "waiting_human" | "human_active" | "closed"}}>(
      `/internal/communications/conversations/${conversationId}/state`,
    );
    return response.data.status;
  }

  async updateConversation(
    conversationId: number,
    status: "active" | "waiting_human" | "human_active" | "closed",
  ): Promise<void> {
    await this.request(`/internal/communications/conversations/${conversationId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.secret) throw new InternalServerErrorException("AGENT_SHARED_SECRET no configurado.");

    const response = await fetch(this.baseUrl + path, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Agent-Shared-Secret": this.secret,
        ...(init.headers ?? {}),
      },
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new InternalServerErrorException(
        (json as {message?: string}).message ?? `Laravel respondió ${response.status}.`,
      );
    }

    return json as T;
  }
}
