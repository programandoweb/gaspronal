export type AgentDefinition = {
  id: string;
  name: string;
  role: string;
  prompt: string;
  memory: string;
  tools: string;
};

export type AgentSummary = Pick<AgentDefinition, "id" | "name" | "role">;

export type AgentConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentExecutionContext = {
  channel?: "dashboard" | "whatsapp";
  communicationConversationId?: number;
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  hasDataProcessingConsent?: boolean;
};

export type AgentMessageInput = {
  message: string;
  requestId?: string;
  sessionId?: number;
  history?: AgentConversationMessage[];
  context?: AgentExecutionContext;
};

export type AgentResponse = {
  requestId: string;
  agent: AgentSummary;
  message: string;
  status: "completed" | "configuration_required";
};
