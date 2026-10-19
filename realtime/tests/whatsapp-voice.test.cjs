require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkVoiceAudio, voiceErrorMessage } = require("../dist/channels/whatsapp-voice.service");

test("accepts a short incoming voice note", () => {
  assert.deepEqual(checkVoiceAudio({ seconds: 12, fileLength: 5000 }), {
    allowed: true, seconds: 12,
  });
});

test("rejects long and large notes before downloading media", () => {
  assert.deepEqual(checkVoiceAudio({ seconds: 61, fileLength: 100 }), {
    allowed: false, reason: "too_long",
  });
  assert.deepEqual(checkVoiceAudio({ seconds: 10, fileLength: 4_194_305 }), {
    allowed: false, reason: "too_large",
  });
});

test("supports protobuf Long fields and missing metadata", () => {
  assert.deepEqual(checkVoiceAudio({
    seconds: { toString: () => "15" },
    fileLength: { toString: () => "2000" },
  }), { allowed: true, seconds: 15 });
  assert.deepEqual(checkVoiceAudio({}), { allowed: true, seconds: null });
});

test("turns off voice without affecting existing text handling", () => {
  const old = process.env.WHATSAPP_VOICE_ENABLED;
  process.env.WHATSAPP_VOICE_ENABLED = "false";
  try {
    assert.deepEqual(checkVoiceAudio({ seconds: 5 }), {
      allowed: false, reason: "disabled",
    });
  } finally {
    if (old === undefined) delete process.env.WHATSAPP_VOICE_ENABLED;
    else process.env.WHATSAPP_VOICE_ENABLED = old;
  }
  assert.match(voiceErrorMessage("no_speech"), /nota de voz/);
});
