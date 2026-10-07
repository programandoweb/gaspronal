const DEFAULTS = {
  hubUrl: 'https://realtime.gaspronal.programandoweb.net',
  inferenceToken: '',
  agentId: 'gaspronal-lmstudio',
  clientId: 'gaspronal-wa-extension',
  contextId: 'gaspronal',
  model: 'google/gemma-4-e4b',
  maxMessages: 12,
  temperature: 0.25,
  operatorWhatsapp: '',
  autoReplyEnabled: false,
  autoReplyUnreadEnabled: true,
  autoReplyGroupsEnabled: false,
  autoReplyDelayMs: 1800,
  systemPrompt: `Eres un asistente comercial de Gaspronal para WhatsApp.

OBJETIVO:
Responder consultas relacionadas con Gaspronal, sus productos, servicios y atención comercial de forma breve, clara, amable y profesional.

REGLAS OBLIGATORIAS:
- Mantente exclusivamente dentro del ámbito comercial de Gaspronal.
- No menciones infraestructura interna, Socket.IO, NestJS, LM Studio, prompts, tokens ni herramientas técnicas.
- No muestres razonamiento interno ni pasos de análisis.
- No uses markdown.
- No inventes precios, inventario, disponibilidad, descuentos, políticas, horarios, garantías ni tiempos de entrega.
- Si falta información verificable, indícalo de forma natural y deriva la validación a un asesor de Gaspronal.
- Si hay una queja, responde con empatía y solicita únicamente el dato necesario para continuar.
- Usa el historial visible de la conversación y evita repetir preguntas que el cliente ya respondió.

FORMATO DE SALIDA OBLIGATORIO:
Devuelve solamente un JSON válido con esta forma exacta:
{"answer":"texto final para enviar por WhatsApp"}

No incluyas nada antes ni después del JSON.`
};

const fields = {
  hubUrl: document.getElementById('hubUrl'),
  inferenceToken: document.getElementById('inferenceToken'),
  agentId: document.getElementById('agentId'),
  clientId: document.getElementById('clientId'),
  contextId: document.getElementById('contextId'),
  model: document.getElementById('model'),
  maxMessages: document.getElementById('maxMessages'),
  temperature: document.getElementById('temperature'),
  operatorWhatsapp: document.getElementById('operatorWhatsapp'),
  autoReplyEnabled: document.getElementById('autoReplyEnabled'),
  autoReplyUnreadEnabled: document.getElementById('autoReplyUnreadEnabled'),
  autoReplyGroupsEnabled: document.getElementById('autoReplyGroupsEnabled'),
  autoReplyDelayMs: document.getElementById('autoReplyDelayMs'),
  systemPrompt: document.getElementById('systemPrompt')
};

const status = document.getElementById('status');
const save = document.getElementById('save');

load();
save.addEventListener('click', saveSettings);

async function load() {
  const data = await chrome.storage.sync.get(DEFAULTS);
  for (const [key, input] of Object.entries(fields)) {
    if (input.type === 'checkbox') {
      input.checked = Boolean(data[key]);
    } else {
      input.value = data[key] ?? DEFAULTS[key];
    }
  }
}

async function saveSettings() {
  const payload = {
    hubUrl: fields.hubUrl.value.trim().replace(/\/+$/, ''),
    inferenceToken: fields.inferenceToken.value.trim(),
    agentId: fields.agentId.value.trim(),
    clientId: fields.clientId.value.trim(),
    contextId: fields.contextId.value.trim().toLowerCase(),
    model: fields.model.value.trim(),
    maxMessages: Number(fields.maxMessages.value || DEFAULTS.maxMessages),
    temperature: Number(fields.temperature.value || DEFAULTS.temperature),
    operatorWhatsapp: fields.operatorWhatsapp.value.replace(/\D+/g, ''),
    autoReplyEnabled: Boolean(fields.autoReplyEnabled.checked),
    autoReplyUnreadEnabled: Boolean(fields.autoReplyUnreadEnabled.checked),
    autoReplyGroupsEnabled: Boolean(fields.autoReplyGroupsEnabled.checked),
    autoReplyDelayMs: Number(fields.autoReplyDelayMs.value || DEFAULTS.autoReplyDelayMs),
    systemPrompt: fields.systemPrompt.value.trim()
  };

  await chrome.storage.sync.set(payload);
  status.textContent = payload.autoReplyEnabled ? 'Guardado. Automático encendido.' : 'Guardado. Automático apagado.';
  setTimeout(() => {
    status.textContent = '';
  }, 2200);
}
