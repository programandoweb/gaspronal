/**
 * A WhatsApp LID is an opaque account identifier, not an E.164 phone number.
 * Never turn the digits of an @lid JID into contact_phone or an @s.whatsapp.net JID.
 */
export type WhatsAppInboundAddress = {
  chatJid: string;
  contactPhone: string | null;
  addressType: "lid" | "pn";
};

export function parseInboundWhatsAppJid(rawJid: string): WhatsAppInboundAddress | null {
  const jid = typeof rawJid === "string" ? rawJid.trim() : "";
  const match = /^([1-9]\d{5,19})(?::\d+)?@(lid|s\.whatsapp\.net|c\.us)$/.exec(jid);
  if (!match) return null;

  const [, digits, domain] = match;
  if (domain === "lid") {
    return { chatJid: `${digits}@lid`, contactPhone: null, addressType: "lid" };
  }

  // E.164 national/global length rules only apply to real PN JIDs.
  if (digits.length < 8 || digits.length > 15) return null;
  return {
    chatJid: `${digits}@s.whatsapp.net`,
    contactPhone: `+${digits}`,
    addressType: "pn",
  };
}

/** Preserves an incoming chat JID, or converts a manually entered phone to PN JID. */
export function resolveWhatsAppRecipientJid(recipient: unknown): string | null {
  if (typeof recipient !== "string") return null;
  const address = parseInboundWhatsAppJid(recipient);
  if (address) return address.chatJid;

  const phone = recipient.trim();
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) return null;
  return `${phone.replace(/^\+/, "")}@s.whatsapp.net`;
}
