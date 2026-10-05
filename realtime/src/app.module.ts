import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AgentController } from "./agents/agent.controller";
import { AgentGateway } from "./agents/agent.gateway";
import { AgentRegistryService } from "./agents/agent-registry.service";
import { AgentRuntimeService } from "./agents/agent-runtime.service";
import { GeminiService } from "./agents/gemini.service";
import { OpenAiCompatibleService } from "./agents/openai-compatible.service";
import { LaravelAgentSettingsClient } from "./agents/laravel-agent-settings.client";
import { LaravelCommercialClient } from "./agents/laravel-commercial.client";
import { LaravelKnowledgeClient } from "./agents/laravel-knowledge.client";
import { LaravelAgentAnalyticsClient } from "./agents/laravel-agent-analytics.client";
import { HealthController } from "./health.controller";
import { ChannelsController } from "./channels/channels.controller";
import { ChannelsRuntimeService } from "./channels/channels-runtime.service";
import { LaravelChannelsClient } from "./channels/laravel-channels.client";
import { BrowserBridgeService } from "./browser/browser-bridge.service";
import { ContentCreatorService } from "./agents/content-creator.service";
import { LaravelContentTraceClient } from "./agents/laravel-content-trace.client";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, AgentController, ChannelsController],
  providers: [
    AgentGateway,
    AgentRegistryService,
    AgentRuntimeService,
    GeminiService,
    OpenAiCompatibleService,
    LaravelAgentSettingsClient,
    LaravelCommercialClient,
    LaravelKnowledgeClient,
    LaravelAgentAnalyticsClient,
    LaravelChannelsClient,
    ChannelsRuntimeService,
    BrowserBridgeService,
    ContentCreatorService,
    LaravelContentTraceClient,
  ],
})
export class AppModule {}
