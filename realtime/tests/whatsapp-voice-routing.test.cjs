require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ChannelsRuntimeService } = require("../dist/channels/channels-runtime.service");

const provider = {
  id: "2", channel: "whatsapp", driver: "baileys", enabled: true,
  settings: { agent_id: "claudio" },
};

function setup(transcription = "Necesito una freidora industrial") {
  const records = [];
  const sends = [];
  const executions = [];
  const outbound = [];
  const client = {
    receiveInbound: async payload => {
      records.push(payload);
      return {
        conversation: { id: 17, status: "active", contact_name: null },
        history: [],
        customer: null,
        duplicate: false,
        should_automate: true,
      };
    },
    conversationStatus: async () => "active",
    recordOutbound: async (...args) => outbound.push(args),
  };
  const agents = {
    execute: async (agentId, args) => {
      executions.push({ agentId, args });
      return { status: "completed", message: "Con mucho gusto le ayudo a revisar nuestras freidoras." };
    },
  };
  const voice = {
    transcribe: async () => transcription,
  };
  const config = { get: (_name, fallback) => fallback };
  const service = new ChannelsRuntimeService(client, agents, voice, config);
  service.send = async (providerId, payload) => {
    sends.push({ providerId, ...payload });
    return { message_id: "SENT-VOICE-1" };
  };
  return { service, records, executions, outbound, sends };
}

test("a WhatsApp voice note is transcribed, persisted and answered ONLY as text on its LID chat", async () => {
  const ctx = setup();
  await ctx.service.handleIncomingMessage(provider, {
    key: { remoteJid: "156641836167212@lid", id: "VOICE-TEST-1", fromMe: false },
    message: { audioMessage: { ptt: true, seconds: 9, fileLength: 12000 } },
  });
  assert.equal(ctx.records.length, 1);
  assert.equal(ctx.records[0].contact_phone, null);
  assert.equal(ctx.records[0].text, "Necesito una freidora industrial");
  assert.equal(ctx.records[0].metadata.input_mode, "voice");
  assert.equal(ctx.records[0].metadata.audio_duration_seconds, 9);
  assert.equal(ctx.executions.length, 1);
  assert.equal(ctx.executions[0].args.context.voiceInput, true);
  assert.equal(ctx.executions[0].args.context.customerPhone, undefined);
  assert.deepEqual(ctx.sends[0], {
    providerId: "2", recipient: "156641836167212@lid",
    text: "Con mucho gusto le ayudo a revisar nuestras freidoras.",
  });
  assert.equal(ctx.outbound.length, 1);
});

test("repeated same voice message is not sent to STT twice", async () => {
  const ctx = setup();
  const msg = {
    key: { remoteJid: "573115000926@s.whatsapp.net", id: "VOICE-TEST-2", fromMe: false },
    message: { audioMessage: { ptt: true, seconds: 12, fileLength: 45000 } },
  };
  await ctx.service.handleIncomingMessage(provider, msg);
  await ctx.service.handleIncomingMessage(provider, msg);
  assert.equal(ctx.records.length, 1);
  assert.equal(ctx.records[0].contact_phone, "+573115000926");
  assert.equal(ctx.sends[0].recipient, "573115000926@s.whatsapp.net");
});

test("group voice messages and self messages are ignored", async () => {
  const ctx = setup();
  await ctx.service.handleIncomingMessage(provider, {
    key: { remoteJid: "1234567890@g.us", id: "GROUP-VOICE", fromMe: false },
    message: { audioMessage: { ptt: true, seconds: 3 } },
  });
  await ctx.service.handleIncomingMessage(provider, {
    key: { remoteJid: "573115000926@s.whatsapp.net", id: "SELF-VOICE", fromMe: true },
    message: { audioMessage: { ptt: true, seconds: 3 } },
  });
  assert.equal(ctx.records.length, 0);
  assert.equal(ctx.executions.length, 0);
  assert.equal(ctx.sends.length, 0);
});

test("a normal text message remains in the same existing pipeline", async () => {
  const ctx = setup();
  await ctx.service.handleIncomingMessage(provider, {
    key: { remoteJid: "573115000926@s.whatsapp.net", id: "TEXT-TEST-1", fromMe: false },
    message: { conversation: "Hola Claudio" },
  });
  assert.equal(ctx.records[0].text, "Hola Claudio");
  assert.equal(ctx.records[0].metadata.input_mode, undefined);
  assert.equal(ctx.executions[0].args.context.voiceInput, false);
  assert.equal(ctx.sends.length, 1);
});
