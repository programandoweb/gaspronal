const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseInboundWhatsAppJid, resolveWhatsAppRecipientJid } = require("../dist/channels/baileys-address");

test("LID identity never becomes a phone or PN address", () => {
  assert.deepEqual(parseInboundWhatsAppJid("156641836167212@lid"), {
    chatJid: "156641836167212@lid",
    contactPhone: null,
    addressType: "lid",
  });
  assert.equal(resolveWhatsAppRecipientJid("156641836167212@lid"), "156641836167212@lid");
});

test("PN identity retains a verified phone and original route", () => {
  assert.deepEqual(parseInboundWhatsAppJid("573115000926@s.whatsapp.net"), {
    chatJid: "573115000926@s.whatsapp.net",
    contactPhone: "+573115000926",
    addressType: "pn",
  });
  assert.equal(parseInboundWhatsAppJid("573115000926:2@c.us").chatJid, "573115000926@s.whatsapp.net");
});

test("Manual E.164 recipient sends to PN JID", () => {
  assert.equal(resolveWhatsAppRecipientJid("+573115000926"), "573115000926@s.whatsapp.net");
  assert.equal(resolveWhatsAppRecipientJid("573115000926"), "573115000926@s.whatsapp.net");
});

test("Invalid, unsupported and empty destinations are rejected", () => {
  for (const value of [undefined, "", "status@broadcast", "12@lid", "12345@newsletter", "573115000926@g.us", "123@lid", "abc", "+++573115000926"]) {
    assert.equal(resolveWhatsAppRecipientJid(value), null);
  }
  assert.equal(parseInboundWhatsAppJid("573115000926@g.us"), null);
});
