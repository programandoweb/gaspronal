import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ChannelsRuntimeService } from "./channels-runtime.service";
import type { Channel, ChannelMessage } from "./channel.types";

@Controller("api/channels")
export class ChannelsController {
  constructor(private readonly runtime: ChannelsRuntimeService) {}

  @Get()
  async list(@Headers("authorization") authorization?: string) {
    this.authorize(authorization);
    return { data: await this.runtime.list() };
  }

  @Post(":id/connect")
  async connect(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    this.authorize(authorization);
    return { data: await this.runtime.connect(id) };
  }

  @Post(":id/disconnect")
  async disconnect(
    @Param("id") id: string,
    @Body() payload: { logout?: boolean },
    @Headers("authorization") authorization?: string,
  ) {
    this.authorize(authorization);
    return { data: await this.runtime.disconnect(id, payload?.logout === true) };
  }

  @Post(":id/test")
  async test(
    @Param("id") id: string,
    @Body() payload: ChannelMessage,
    @Headers("authorization") authorization?: string,
  ) {
    this.authorize(authorization);
    return { data: await this.runtime.test(id, payload) };
  }

  @Post(":id/send")
  async sendWithProvider(
    @Param("id") id: string,
    @Body() payload: ChannelMessage,
    @Headers("authorization") authorization?: string,
  ) {
    this.authorize(authorization);
    return { data: await this.runtime.send(id, payload) };
  }

  @Post("send/:channel")
  async send(
    @Param("channel") channel: Channel,
    @Body() payload: ChannelMessage,
    @Headers("authorization") authorization?: string,
  ) {
    this.authorize(authorization);
    if (!["whatsapp", "email"].includes(channel)) {
      throw new Error("Canal no soportado.");
    }
    return { data: await this.runtime.routeAndSend(channel, payload) };
  }

  private authorize(authorization?: string): void {
    const secret = process.env.AGENT_SHARED_SECRET?.trim();
    if (!secret) return;

    if (authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException("No autorizado.");
    }
  }
}
