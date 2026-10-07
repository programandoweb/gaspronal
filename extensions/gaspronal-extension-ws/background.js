importScripts('vendor/socket.io.min.js');

const DEFAULTS = {
  hubUrl: 'https://realtime.gaspronal.programandoweb.net',
  inferenceToken: '',
  agentId: 'gaspronal-lmstudio',
  clientId: 'gaspronal-wa-extension',
  contextId: 'gaspronal',
  promptVersion: 3,
  model: 'google/gemma-4-e4b',
  maxMessages: 12,
  temperature: 0.25,
  maxTokens: 650,
  timeoutMs: 60000,
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

const GEMINI_AGENT_ID = 'browser-gemini';
const GEMINI_TIMEOUT_MS = 180000;
const GEMINI_MAX_IMAGE_BYTES = 700000;

function normalizeGeminiCommandText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isEnterpriseRegistrationCommand(value) {
  const normalized = normalizeGeminiCommandText(value);
  return /\b(crea(?:r)?|registra(?:r)?|nueva)\s+(?:una\s+)?empresa\b/.test(normalized)
    || normalized.includes('cancelar registro')
    || normalized.includes('cancelar empresa');
}

async function requestEnterpriseRegistrationTurn({ config, whatsapp, message, sessionId, debug }) {
  const socket = await getInferenceSocket(config, debug);
  emitDebug(debug, 'FLUJO REGISTRO EMPRESA', { whatsapp, sessionId, message });

  return new Promise((resolve, reject) => {
    socket.timeout(25000).emit('enterprise.registration.turn', {
      whatsapp,
      message,
      session_id: sessionId || undefined
    }, (error, response) => {
      if (error) {
        reject(new Error('El Hub no respondió al flujo de registro empresarial.'));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || 'El backend rechazó el flujo de registro empresarial.'));
        return;
      }
      resolve(response.data || {});
    });
  });
}

async function renderEnterpriseRegistrationAnswer({ inference, flow, model, timeoutMs, debug }) {
  const ai = flow?.ai_context || {};
  const systemPrompt = String(ai.system_prompt || '').trim();
  const requiredMessage = String(ai.required_message || flow?.fallback_message || '').trim();
  const prompt = [
    systemPrompt,
    '',
    'Estado estructurado del backend:',
    safeStringify({
      facts: ai.facts || {},
      status: ai.status || flow?.status,
      current_field: ai.current_field || flow?.current_field,
      validation_errors: ai.validation_errors || {},
      conversation: ai.conversation || []
    }, 14000),
    '',
    'Mensaje obligatorio que debes conservar sin agregar datos:',
    requiredMessage,
    '',
    'Devuelve solo JSON válido con la forma {"answer":"texto"}.'
  ].join('\n');

  try {
    const raw = await requestLmStudio({
      config: inference,
      agentId: GEMINI_AGENT_ID,
      method: 'POST',
      path: '/v1/chat/completions',
      body: { prompt, mode: 'text', source: 'whatsapp-enterprise-registration' },
      timeoutMs: Math.max(timeoutMs, GEMINI_TIMEOUT_MS),
      debug,
      label: 'REGISTRO GEMINI',
      includeContext: false
    });
    const content = String(raw?.migo?.answer || tryExtractJsonAnswer(extractContent(raw)) || extractContent(raw) || '').trim();
    if (isUsableFinalAnswer(content)) return { provider: 'gen', answer: cleanupAnswer(content) };
  } catch (error) {
    emitDebug(debug, 'FALLO GEMINI REGISTRO', { error: error?.message || String(error) });
  }

  try {
    const result = await callChatCompletions({
      inference,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      maxTokens: 650,
      timeoutMs,
      debug
    });
    const content = String(tryExtractJsonAnswer(result.content) || result.content || '').trim();
    if (isUsableFinalAnswer(content)) return { provider: 'lm', answer: cleanupAnswer(content) };
  } catch (error) {
    emitDebug(debug, 'FALLO LM REGISTRO', { error: error?.message || String(error) });
  }

  return {
    provider: 'fal',
    answer: 'Por el momento no es posible continuar con el registro. La información ya suministrada quedó guardada para retomarla después.'
  };
}

function parseGeminiCommand(value) {
  const original = String(value || '').trim();
  if (!original) return null;

  const normalized = normalizeGeminiCommandText(original);
  const match = normalized.match(
    /^(?:\/|@|#)?\s*geminis?\b(?:\s*[-_:]\s*|\s+)?(?:(imagen|image|texto|text)\b)?\s*[:,-]?\s*/
  );

  if (!match) return null;

  const requestedMode = String(match[1] || '').toLowerCase();
  let mode = 'auto';
  if (requestedMode === 'imagen' || requestedMode === 'image') mode = 'image';
  if (requestedMode === 'texto' || requestedMode === 'text') mode = 'text';

  const prompt = original.slice(match[0].length).trim();
  return {
    provider: 'gem',
    agentId: GEMINI_AGENT_ID,
    mode,
    prompt,
    matchedPrefix: original.slice(0, match[0].length).trim()
  };
}

function safeStringify(value, maxChars = 18000) {
  let text = '';
  try {
    text = JSON.stringify(value, null, 2);
  } catch (error) {
    text = String(value || '');
  }
  if (text.length > maxChars) {
    return `${text.slice(0, maxChars)}\n... [truncado ${text.length - maxChars} caracteres]`;
  }
  return text;
}

function makeDebugContext(sender, payload = {}) {
  return {
    tabId: sender?.tab?.id || null,
    id: payload?.debugId || `debug-${Date.now()}-${Math.random().toString(36).slice(2)}`
  };
}

function emitDebug(debug, label, data = null) {
  if (!debug?.tabId) return;

  const event = {
    id: debug.id,
    ts: Date.now(),
    at: new Date().toLocaleTimeString('es-CO', { hour12: false }),
    label,
    data
  };

  chrome.tabs.sendMessage(debug.tabId, {
    type: 'MIGO_WA_AI_DEBUG_EVENT',
    event
  }, () => {
    void chrome.runtime.lastError;
  });
}

const HARD_GUARD_PROMPT = [
  'REGLA CRITICA DE SALIDA:',
  'La API usara JSON Schema y tu salida debe cumplirlo.',
  'Devuelve un objeto JSON con una unica clave: answer.',
  'answer debe ser un string con solo el mensaje final para WhatsApp.',
  'No escribas ni una sola palabra de razonamiento interno dentro de answer.',
  'No escribas Thinking Process, Analyze the Request, Analyze the Context, Determine the Goal, reasoning, analysis, pensamiento, razonamiento, pasos ni plan.',
  'No expliques que estas haciendo.',
  'No escribas texto antes ni despues del JSON.'
].join('\n');


let inferenceSocket = null;
let inferenceSocketKey = '';
let inferenceConnectPromise = null;
const pendingInferenceRequests = new Map();

function getInferenceSettings(settings) {
  return {
    hubUrl: normalizeBaseUrl(settings.hubUrl || DEFAULTS.hubUrl),
    inferenceToken: String(settings.inferenceToken || DEFAULTS.inferenceToken).trim(),
    agentId: String(settings.agentId || DEFAULTS.agentId).trim(),
    clientId: String(settings.clientId || DEFAULTS.clientId).trim(),
    contextId: String(settings.contextId || DEFAULTS.contextId).trim().toLowerCase()
  };
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `lm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getSocketKey(config) {
  return [config.hubUrl, config.inferenceToken, config.agentId, config.clientId].join('|');
}

function rejectAllPendingInference(error) {
  for (const [requestId, pending] of pendingInferenceRequests.entries()) {
    clearTimeout(pending.timer);
    pending.reject(error instanceof Error ? error : new Error(String(error || 'Socket disconnected')));
    pendingInferenceRequests.delete(requestId);
  }
}

function attachInferenceSocketListeners(socket) {
  socket.on('connect', () => {
    inferenceConnectPromise = null;
  });

  socket.on('disconnect', (reason) => {
    inferenceConnectPromise = null;
    if (reason === 'io client disconnect') return;
    rejectAllPendingInference(new Error(`El socket de inferencia se desconecto: ${reason}`));
  });

  socket.on('lm.accepted', (event) => {
    const pending = pendingInferenceRequests.get(event?.requestId);
    if (pending) emitDebug(pending.debug, 'HUB ACEPTO SOLICITUD LM', event);
  });

  socket.on('lm.started', (event) => {
    const pending = pendingInferenceRequests.get(event?.requestId);
    if (pending) emitDebug(pending.debug, 'AGENTE INICIO CONSULTA LOCAL', event);
  });

  socket.on('lm.completed', (event) => {
    const pending = pendingInferenceRequests.get(event?.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingInferenceRequests.delete(event.requestId);
    emitDebug(pending.debug, 'RESPUESTA RECIBIDA POR SOCKET', {
      requestId: event.requestId,
      agentId: event.agentId,
      statusCode: event.statusCode,
      durationMs: event.durationMs,
      data: event.data
    });
    pending.resolve(event.data);
  });

  socket.on('lm.error', (event) => {
    const pending = pendingInferenceRequests.get(event?.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingInferenceRequests.delete(event.requestId);
    emitDebug(pending.debug, 'ERROR RECIBIDO POR SOCKET', event);
    const error = new Error(event?.error || 'Error remoto consultando LM Studio');
    error.statusCode = event?.statusCode;
    pending.reject(error);
  });
}

async function getInferenceSocket(config, debug = null) {
  if (!config.hubUrl) throw new Error('Configura la URL del Hub Socket.IO.');
  if (!config.inferenceToken) throw new Error('Configura el token de inferencia.');
  if (!config.agentId) throw new Error('Configura el Agent ID de la maquina con LM Studio.');

  const key = getSocketKey(config);
  if (inferenceSocket && inferenceSocketKey === key && inferenceSocket.connected) {
    return inferenceSocket;
  }

  if (inferenceSocket && inferenceSocketKey !== key) {
    inferenceSocket.disconnect();
    inferenceSocket = null;
    inferenceConnectPromise = null;
  }

  if (!inferenceSocket) {
    inferenceSocketKey = key;
    inferenceSocket = io(config.hubUrl, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
      auth: {
        type: 'inference-client',
        token: config.inferenceToken,
        clientId: config.clientId || 'gaspronal-wa-extension'
      }
    });
    attachInferenceSocketListeners(inferenceSocket);
  }

  if (inferenceSocket.connected) return inferenceSocket;
  if (inferenceConnectPromise) return inferenceConnectPromise;

  inferenceConnectPromise = new Promise((resolve, reject) => {
    const socket = inferenceSocket;
    if (!socket) {
      reject(new Error('No fue posible crear el socket de inferencia.'));
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      inferenceConnectPromise = null;
      reject(new Error('Tiempo agotado conectando con el Hub Socket.IO.'));
    }, 12000);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
    };

    const onConnect = () => {
      cleanup();
      inferenceConnectPromise = null;
      emitDebug(debug, 'SOCKET CONECTADO AL HUB', {
        hubUrl: config.hubUrl,
        agentId: config.agentId,
        clientId: config.clientId,
        socketId: socket.id
      });
      resolve(socket);
    };

    const onError = (error) => {
      cleanup();
      inferenceConnectPromise = null;
      reject(new Error(`No fue posible conectar con el Hub: ${error?.message || error}`));
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
    socket.connect();
  });

  return inferenceConnectPromise;
}

async function requestLmStudio({ config, agentId = '', method, path, body, timeoutMs, debug, label, includeContext = true }) {
  const socket = await getInferenceSocket(config, debug);
  const requestId = createRequestId();
  const targetAgentId = String(agentId || config.agentId).trim();
  const effectiveTimeout = Math.min(Math.max(Number(timeoutMs || DEFAULTS.timeoutMs), 1000), 300000);

  if (!targetAgentId) throw new Error('No se definio el agente de inferencia de destino.');

  emitDebug(debug, `SOCKET ${label || method}`, {
    requestId,
    hubUrl: config.hubUrl,
    agentId: targetAgentId,
    contextId: includeContext ? config.contextId : null,
    method,
    path,
    body
  });

  const requestBody = method === 'POST' && body && typeof body === 'object'
    ? (includeContext ? { ...body, migo_context_id: config.contextId } : { ...body })
    : body;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingInferenceRequests.delete(requestId);
      socket.emit('lm.cancel', { requestId, agentId: targetAgentId });
      reject(new Error(`Tiempo agotado esperando la respuesta del agente ${targetAgentId}.`));
    }, effectiveTimeout + 15000);

    pendingInferenceRequests.set(requestId, { resolve, reject, timer, debug });

    socket.timeout(10000).emit('lm.request', {
      requestId,
      agentId: targetAgentId,
      method,
      path,
      body: requestBody,
      contextId: config.contextId,
      timeoutMs: effectiveTimeout
    }, (error, ack) => {
      if (!error && ack?.ok) {
        emitDebug(debug, 'HUB ENRUTO SOLICITUD', { requestId: ack.requestId, agentId: targetAgentId });
        return;
      }

      const pending = pendingInferenceRequests.get(requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingInferenceRequests.delete(requestId);
      reject(new Error(ack?.error || error?.message || `El Hub rechazo la solicitud para ${targetAgentId}.`));
    });
  });
}

chrome.runtime.onInstalled.addListener(ensureDefaults);
chrome.runtime.onStartup?.addListener(ensureDefaults);

chrome.action?.onClicked.addListener((tab) => {
  if (!tab?.id) return;

  if (!String(tab.url || '').startsWith('https://web.whatsapp.com/')) {
    chrome.tabs.create({ url: 'https://web.whatsapp.com/' });
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: 'MIGO_WA_AI_TOGGLE_DRAWER' }, () => {
    // Si WhatsApp aun no cargo el content script, Chrome deja lastError.
    // No hacemos throw para no romper el service worker.
    void chrome.runtime.lastError;
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !String(message.type || '').startsWith('MIGO_WA_AI_')) return false;

  if (message.type === 'MIGO_WA_AI_GENERATE') {
    const debug = makeDebugContext(sender, message.payload);
    emitDebug(debug, 'INICIO GENERACION', { source: 'content-script', payloadSummary: summarizeIncomingPayload(message.payload) });

    handleGenerate(message.payload, debug)
      .then((result) => {
        emitDebug(debug, 'RESULTADO FINAL PARA WHATSAPP', result);
        sendResponse({ ok: true, result });
      })
      .catch((error) => {
        emitDebug(debug, 'ERROR FINAL', { message: friendlyError(error), raw: String(error?.stack || error || '') });
        sendResponse({ ok: false, error: friendlyError(error) });
      });

    return true;
  }

  if (message.type === 'MIGO_WA_AI_FETCH_MEDIA') {
    fetchMediaAsDataUrl(message.url)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || 'No se pudo descargar la imagen.' }));
    return true;
  }

  if (message.type === 'MIGO_WA_AI_TEST_LM_STUDIO') {
    const debug = makeDebugContext(sender, message.payload);
    emitDebug(debug, 'INICIO PRUEBA MANUAL', { source: 'content-script', payload: message.payload });

    handleManualTest(message.payload, debug)
      .then((result) => {
        emitDebug(debug, 'RESULTADO PRUEBA MANUAL', result);
        sendResponse({ ok: true, result });
      })
      .catch((error) => {
        emitDebug(debug, 'ERROR PRUEBA MANUAL', { message: friendlyError(error), raw: String(error?.stack || error || '') });
        sendResponse({ ok: false, error: friendlyError(error) });
      });

    return true;
  }

  return false;
});

function summarizeIncomingPayload(payload = {}) {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  return {
    contactName: payload.contactName || '',
    isArchived: Boolean(payload.isArchived),
    isGroup: Boolean(payload.isGroup),
    messages: messages.map((message) => ({
      direction: message.direction,
      text: String(message.text || '').slice(0, 180),
      time: message.time || ''
    }))
  };
}

async function ensureDefaults() {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const missing = {};
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (current[key] === undefined || current[key] === null || current[key] === '') {
      missing[key] = value;
    }
  }
  const previousPrompt = String(current.systemPrompt || '');
  const currentPromptVersion = Number(current.promptVersion || 0);
  if (previousPrompt.includes('asistente comercial de Migo') || currentPromptVersion < DEFAULTS.promptVersion) {
    missing.systemPrompt = DEFAULTS.systemPrompt;
    missing.promptVersion = DEFAULTS.promptVersion;
    if (Number(current.maxTokens || 0) < DEFAULTS.maxTokens) {
      missing.maxTokens = DEFAULTS.maxTokens;
    }
  }

  if (Object.keys(missing).length) {
    await chrome.storage.sync.set(missing);
  }
}


async function handleManualTest(payload = {}, debug = null) {
  const settings = await chrome.storage.sync.get(DEFAULTS);
  const inference = getInferenceSettings(settings);
  const model = settings.model || DEFAULTS.model;
  const temperature = Number(settings.temperature || DEFAULTS.temperature);
  const timeoutMs = Number(settings.timeoutMs || DEFAULTS.timeoutMs);
  const prompt = String(payload.prompt || '').trim() || 'Hola. Responde solo JSON válido como {"answer":"conexión OK"}.';

  emitDebug(debug, 'CONFIGURACION ACTUAL', {
    hubUrl: inference.hubUrl,
    agentId: inference.agentId,
    clientId: inference.clientId,
    contextId: inference.contextId,
    model,
    temperature,
    timeoutMs,
    routes: [
      '/api/v1/models',
      '/api/v1/chat',
      '/v1/chat/completions'
    ]
  });

  let models = null;
  try {
    models = await getJson('/api/v1/models', timeoutMs, debug, 'GET LM Studio API v1 /models', inference);
    emitDebug(debug, 'MODELOS LM STUDIO OK', models);
  } catch (error) {
    emitDebug(debug, 'MODELOS LM STUDIO FALLÓ', { error: error?.message || String(error) });
  }

  const systemPrompt = [
    'Eres una prueba de conectividad para LM Studio.',
    'Debes devolver únicamente JSON válido con esta forma exacta: {"answer":"texto"}.',
    'No incluyas razonamiento ni texto adicional.'
  ].join('\n');

  const userContent = [
    'Consulta manual desde la extensión Chrome:',
    prompt,
    '',
    'Devuelve solo JSON válido con answer.'
  ].join('\n');

  const data = await callStructuredChat({
    inference,
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    temperature: Math.min(temperature, 0.2),
    maxTokens: 160,
    timeoutMs,
    debug,
    trace: {
      decisionId: String(payload.debugId || `manual-test-${Date.now()}`),
      source: 'manual-test',
      triggerReason: 'boton-prueba',
      lastIncomingText: prompt
    }
  });

  const rawContent = extractContent(data);
  const answer = cleanupAnswer(tryExtractJsonAnswer(rawContent) || rawContent) || safeFallbackAnswer({ lastIncomingText: prompt, contactName: 'Prueba Manual', localDateTime: new Date().toLocaleString('es-CO') });

  return {
    provider: 'lm',
    test: true,
    model,
    modelsAvailable: summarizeModels(models),
    rawContent,
    answer,
    usage: data?.usage || null
  };
}

function summarizeModels(models) {
  const list = Array.isArray(models?.data) ? models.data : Array.isArray(models) ? models : [];
  return list.slice(0, 8).map((item) => item?.id || item?.model || item?.name || String(item)).filter(Boolean);
}

async function handleGenerate(payload = {}, debug = null) {
  const settings = await chrome.storage.sync.get(DEFAULTS);
  const inference = getInferenceSettings(settings);
  const model = settings.model || DEFAULTS.model;
  const maxMessages = Number(settings.maxMessages || DEFAULTS.maxMessages);
  const temperature = Number(settings.temperature || DEFAULTS.temperature);
  const maxTokens = Number(settings.maxTokens || DEFAULTS.maxTokens);
  const timeoutMs = Number(settings.timeoutMs || DEFAULTS.timeoutMs);
  const systemPrompt = buildSystemPrompt(settings.systemPrompt || DEFAULTS.systemPrompt);

  const visibleMessages = Array.isArray(payload.messages) ? payload.messages.slice(-maxMessages) : [];
  const contactName = payload.contactName || 'contacto actual';
  const lastIncoming = [...visibleMessages].reverse().find((item) => item.direction === 'in');
  const geminiCommand = parseGeminiCommand(lastIncoming?.text);
  // TEMPORAL PARA PRUEBAS: fuerza el operador autorizado mientras se valida la obtencion real del numero/JID.
  const operatorWhatsapp = '3115000926';
  const incomingText = String(lastIncoming?.text || '').trim();
  const decisionTrace = {
    decisionId: String(payload.debugId || payload?.trace?.decisionId || `decision-${Date.now()}`),
    source: String(payload?.trace?.source || 'manual'),
    triggerReason: String(payload?.trace?.triggerReason || 'unknown'),
    incomingKey: String(payload?.trace?.incomingKey || ''),
    contactName: String(contactName || ''),
    contactWhatsapp: String(payload.contactWhatsapp || payload?.trace?.contactWhatsapp || ''),
    chatId: String(payload.chatId || payload?.trace?.chatId || ''),
    incomingMessageId: String(lastIncoming?.messageId || payload?.trace?.incomingMessageId || ''),
    incomingTimestamp: String(lastIncoming?.timestamp || payload?.trace?.incomingTimestamp || ''),
    lastIncomingText: incomingText,
    hasVisibleUnreadBadge: Boolean(payload?.trace?.hasVisibleUnreadBadge)
  };
  const registrationCommand = isEnterpriseRegistrationCommand(incomingText);
  const registrationChatKey = normalizeGeminiCommandText(contactName).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // El registro empresarial queda aislado al chat donde se inicio. Nunca debe
  // secuestrar el procesamiento automatico de otros chats no leidos.
  let activeRegistrationSessionId = '';
  let activeRegistrationChatKey = '';
  if (operatorWhatsapp && incomingText) {
    const storedRegistration = await chrome.storage.local.get({
      enterpriseRegistrationSessionId: '',
      enterpriseRegistrationChatKey: ''
    });
    activeRegistrationSessionId = String(storedRegistration.enterpriseRegistrationSessionId || '');
    activeRegistrationChatKey = String(storedRegistration.enterpriseRegistrationChatKey || '');
  }

  const isSameRegistrationChat = Boolean(
    activeRegistrationSessionId
    && activeRegistrationChatKey
    && registrationChatKey
    && activeRegistrationChatKey === registrationChatKey
  );

  if (incomingText && operatorWhatsapp && (registrationCommand || isSameRegistrationChat)) {
    // Si se inicia el comando en otro chat, se crea una sesion nueva y no se
    // reutiliza accidentalmente la sesion de una conversacion anterior.
    const sessionId = registrationCommand && !isSameRegistrationChat
      ? ''
      : activeRegistrationSessionId;

    const flow = await requestEnterpriseRegistrationTurn({
      config: inference,
      whatsapp: operatorWhatsapp,
      message: incomingText,
      sessionId,
      debug
    });

    if (flow?.status === 'completed' || flow?.status === 'cancelled') {
      await chrome.storage.local.remove([
        'enterpriseRegistrationSessionId',
        'enterpriseRegistrationChatKey'
      ]);
    } else if (flow?.session_id) {
      await chrome.storage.local.set({
        enterpriseRegistrationSessionId: String(flow.session_id),
        enterpriseRegistrationChatKey: registrationChatKey
      });
    }

    // El Hub ya orquesta Laravel -> Gemini -> LM Studio -> fallback.
    // La extension no debe volver a abrir Gemini Web ni reprocesar ai_context.
    const hubAnswer = String(flow?.answer || flow?.fallback_message || '').trim();
    const hubProvider = String(flow?.provider || 'fallback').trim().toLowerCase();

    emitDebug(debug, 'RESPUESTA REGISTRO DESDE HUB', {
      provider: hubProvider,
      sessionId: flow?.session_id || null,
      status: flow?.status || null,
      currentField: flow?.current_field || null,
      hasAnswer: Boolean(hubAnswer)
    });

    return {
      provider: hubProvider === 'gemini' ? 'gen' : hubProvider === 'lm' ? 'lm' : 'fal',
      model: hubProvider === 'gemini' ? 'gemini-api' : hubProvider === 'lm' ? model : 'fallback',
      answer: hubAnswer || 'Por el momento no es posible continuar con el registro. La informacion ya suministrada quedo guardada para retomarla despues.',
      media: [],
      usage: null,
      enterpriseRegistration: {
        sessionId: flow?.session_id || null,
        status: flow?.status || null,
        currentField: flow?.current_field || null
      }
    };
  }

  if (geminiCommand) {
    return handleGeminiGenerate({
      inference,
      command: geminiCommand,
      timeoutMs,
      debug
    });
  }

  const transcript = visibleMessages
    .map((item, index) => {
      const from = item.direction === 'out' ? 'Yo' : contactName;
      const text = String(item.text || '').replace(/\s+/g, ' ').trim();
      return text ? `${index + 1}. ${from}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');

  if (!transcript) {
    throw new Error('No pude leer mensajes visibles del chat actual. Abre una conversacion y vuelve a intentar.');
  }

  const localDateTime = new Date().toLocaleString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const userContent = [
    `Contacto: ${contactName}`,
    `Fecha y hora local del navegador: ${localDateTime}`,
    '',
    'Conversacion visible mas reciente:',
    transcript,
    '',
    lastIncoming ? `Ultimo mensaje recibido: ${String(lastIncoming.text || '').trim()}` : '',
    '',
    'Tarea: redacta una respuesta breve, amable y util para el ultimo mensaje recibido.',
    'Primero entrega la informacion disponible. No uses una pregunta generica como unica respuesta si el contexto contiene productos, nombres, precios, colores o fotos.',
    'Para consultas generales de una categoria, menciona como maximo 6 productos.',
    'PRIORIDAD DE FOTOS: si el ultimo mensaje pide foto, fotos, imagenes o pregunta "tienes fotos", no preguntes color, talla, estilo u ocasion. El agente enviara inmediatamente entre 1 y 3 imagenes reales con su descripcion.',
    'Para continuaciones como "dame los nombres", "que colores", "tienes fotos" o "mandame foto", conserva el tema de los mensajes anteriores.',
    'Formato obligatorio: devuelve solo JSON valido como {"answer":"texto final"}. Nunca escribas URLs de imagen.',
    'Prohibido incluir razonamiento, analisis, pensamiento, pasos, plan, etiquetas, encabezados o markdown.'
  ].filter(Boolean).join('\n');

  emitDebug(debug, 'MENSAJES ENVIADOS A LM STUDIO', {
    system: systemPrompt,
    user: userContent,
    model,
    hubUrl: inference.hubUrl,
    agentId: inference.agentId,
    contextId: inference.contextId,
    temperature,
    maxTokens
  });

  let raw = null;
  let cleaned = '';
  let preservedMedia = [];
  let preservedUsage = null;
  let preservedDecision = null;
  let preservedMediaCaption = '';
  let preservedPhotoPriority = false;

  try {
    const chatResult = await callChatCompletions({ inference, model, systemPrompt, userContent, temperature, maxTokens, timeoutMs, debug, trace: decisionTrace });
    raw = chatResult.raw;
    preservedMedia = normalizeMedia(raw?.migo_media);
    preservedUsage = raw?.usage || null;
    preservedDecision = raw?.migo_decision || null;
    preservedMediaCaption = String(raw?.migo_media_caption || '').trim();
    preservedPhotoPriority = raw?.migo_photo_priority === true;

    const rawContent = String(chatResult.content || '').trim();
    const rawAnswerCandidate = tryExtractJsonAnswer(rawContent) || rawContent;
    const finishReason = getFinishReason(raw);

    // Si LM Studio agota tokens o deja el JSON incompleto, no se permite que el
    // fragmento {"answer": ... llegue al cliente. Se fuerza la reparacion.
    if (finishReason === 'length' || looksLikeIncompleteJsonAnswer(rawContent)) {
      emitDebug(debug, 'RESPUESTA TRUNCADA, SE REPARARA', { finishReason, rawContent: rawContent.slice(0, 1200) });
      cleaned = '';
    } else {
      // Si LM Studio tiene Enable Thinking activo, puede devolver razonamiento antes del JSON.
      // No abortamos: limpiamos, intentamos reparar y finalmente usamos fallback seguro.
      cleaned = startsWithForbiddenReasoning(rawAnswerCandidate) ? '' : cleanupAnswer(rawAnswerCandidate);
    }
  } catch (error) {
    raw = { chat_error: error?.message || String(error) };
  }

  if (!isUsableFinalAnswer(cleaned)) {
    try {
      const repairResult = await repairWithModel({
        inference,
        model,
        debug,
        originalText: extractContent(raw) || JSON.stringify(raw || {}).slice(0, 1200),
        lastIncomingText: lastIncoming?.text || '',
        contactName,
        localDateTime,
        timeoutMs,
        trace: { ...decisionTrace, stage: 'repair' }
      });
      raw = repairResult.raw;
      preservedDecision = preservedDecision || raw?.migo_decision || null;
      preservedMedia = preservedMedia.length ? preservedMedia : normalizeMedia(raw?.migo_media);
      preservedMediaCaption = preservedMediaCaption || String(raw?.migo_media_caption || '').trim();
      preservedPhotoPriority = preservedPhotoPriority || raw?.migo_photo_priority === true;

      const repairContent = String(repairResult.content || '').trim();
      const repairAnswerCandidate = tryExtractJsonAnswer(repairContent) || repairContent;

      cleaned = startsWithForbiddenReasoning(repairAnswerCandidate) ? '' : cleanupAnswer(repairAnswerCandidate);
    } catch (error) {
      raw = { repair_error: error?.message || String(error), previous: raw };
    }
  }

  if (!isUsableFinalAnswer(cleaned)) {
    cleaned = safeFallbackAnswer({ lastIncomingText: lastIncoming?.text || '', contactName, localDateTime });
  }

  cleaned = cleanupAnswer(cleaned);
  if (!isUsableFinalAnswer(cleaned)) {
    throw new Error('La IA intento enviar razonamiento interno. Bloquee el envio para evitar respuestas incorrectas.');
  }

  return {
    provider: 'lm',
    model,
    answer: cleaned,
    media: preservedMedia.length ? preservedMedia : normalizeMedia(raw?.migo_media),
    usage: preservedUsage || raw?.usage || null,
    decision: preservedDecision || raw?.migo_decision || null,
    mediaCaption: preservedMediaCaption || String(raw?.migo_media_caption || '').trim(),
    photoPriority: preservedPhotoPriority || raw?.migo_photo_priority === true
  };
}

async function handleGeminiGenerate({ inference, command, timeoutMs, debug }) {
  if (!command?.prompt) {
    throw new Error('Escribe una instruccion despues del prefijo Gemini.');
  }

  const effectiveTimeout = Math.max(Number(timeoutMs || DEFAULTS.timeoutMs), GEMINI_TIMEOUT_MS);

  emitDebug(debug, 'COMANDO GEMINI DETECTADO', {
    matchedPrefix: command.matchedPrefix,
    agentId: command.agentId,
    mode: command.mode,
    prompt: command.prompt
  });

  const raw = await requestLmStudio({
    config: inference,
    agentId: command.agentId,
    method: 'POST',
    path: '/v1/chat/completions',
    body: {
      prompt: command.prompt,
      mode: command.mode,
      source: 'whatsapp',
      maxImageBytes: GEMINI_MAX_IMAGE_BYTES
    },
    timeoutMs: effectiveTimeout,
    debug,
    label: 'GEMINI WEB',
    includeContext: false
  });

  const migo = raw?.migo && typeof raw.migo === 'object' ? raw.migo : {};
  const rawContent = extractContent(raw);
  const answer = cleanupAnswer(
    String(migo.answer || tryExtractJsonAnswer(rawContent) || rawContent || '').trim()
  );
  const media = normalizeMedia(migo.media);

  if (!answer && !media.length) {
    throw new Error('Gemini respondio sin texto ni imagen utilizable.');
  }

  return {
    provider: 'gem',
    model: String(raw?.model || migo.model || 'gemini-web'),
    answer: answer || 'Imagen generada por Gemini.',
    media,
    usage: raw?.usage || null
  };
}

function normalizeMedia(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const result = [];
  for (const item of value) {
    if (!item || item.type !== 'image') continue;
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    const dataUrl = typeof item.dataUrl === 'string' ? item.dataUrl.trim() : '';
    if (!url && !/^data:image\//i.test(dataUrl)) continue;

    const canonicalUrl = url
      .replace(/[?#].*$/, '')
      .replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, '')
      .toLowerCase();
    const key = canonicalUrl || `data:${dataUrl.slice(0, 500)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      type: 'image',
      url,
      dataUrl,
      mimeType: String(item.mimeType || '').trim(),
      fileName: String(item.fileName || '').trim(),
      sizeBytes: Number(item.sizeBytes || 0) || null,
      name: String(item.name || item.fileName || 'imagen').trim(),
      caption: String(item.caption || item.name || '').trim(),
      description: String(item.description || '').trim(),
      productName: String(item.productName || item.name || '').trim(),
      selectionReason: String(item.selectionReason || '').trim(),
      imageIndex: Number(item.imageIndex || 0) || null
    });

    if (result.length >= 3) break;
  }

  return result;
}

async function fetchMediaAsDataUrl(url) {
  const safeUrl = String(url || '').trim();
  if (!/^https?:\/\//i.test(safeUrl)) throw new Error('URL de imagen no valida.');

  const attempts = [
    { credentials: 'omit', referrerPolicy: 'no-referrer' },
    { credentials: 'include', referrerPolicy: 'strict-origin-when-cross-origin' }
  ];
  let lastError = null;

  for (const attempt of attempts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(safeUrl, {
        cache: 'no-store',
        redirect: 'follow',
        credentials: attempt.credentials,
        referrerPolicy: attempt.referrerPolicy,
        signal: controller.signal,
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength) throw new Error('respuesta vacia');
      if (buffer.byteLength > 20 * 1024 * 1024) throw new Error('imagen superior a 20 MB');

      const headerType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const mimeType = detectImageMimeType(new Uint8Array(buffer), headerType);
      if (!mimeType) throw new Error(`contenido no reconocido como imagen (${headerType || 'sin content-type'})`);

      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }

      return {
        dataUrl: `data:${mimeType};base64,${btoa(binary)}`,
        mimeType,
        size: bytes.length,
        finalUrl: response.url || safeUrl
      };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  const detail = lastError?.name === 'AbortError'
    ? 'tiempo de espera agotado'
    : lastError?.message || 'error desconocido';
  throw new Error(`No se pudo descargar la imagen (${detail}).`);
}

function detectImageMimeType(bytes, headerType = '') {
  if (String(headerType || '').startsWith('image/')) return headerType;
  if (!bytes || bytes.length < 12) return '';

  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'image/bmp';

  const prefix = Array.from(bytes.subarray(0, Math.min(bytes.length, 256)))
    .map((value) => String.fromCharCode(value))
    .join('')
    .trimStart()
    .toLowerCase();
  if (prefix.startsWith('<svg') || (prefix.startsWith('<?xml') && prefix.includes('<svg'))) return 'image/svg+xml';

  return '';
}

function buildSystemPrompt(customPrompt) {
  return [
    customPrompt || DEFAULTS.systemPrompt,
    '',
    'El agente NestJS agregará el contexto empresarial oficial antes de enviar esta solicitud a LM Studio.',
    '',
    HARD_GUARD_PROMPT
  ].filter(Boolean).join('\n').trim();
}

async function callChatCompletions({ inference, model, systemPrompt, userContent, temperature, maxTokens, timeoutMs, debug, trace = null }) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  const data = await callStructuredChat({
    inference,
    model,
    messages,
    temperature,
    maxTokens,
    timeoutMs,
    debug,
    trace
  });

  return {
    raw: data,
    content: extractContent(data)
  };
}

async function repairWithModel({ inference, model, debug, originalText, lastIncomingText, contactName, localDateTime, timeoutMs, trace = null }) {
  const messages = [
    {
      role: 'system',
      content: [
        'Eres un limpiador de respuestas para WhatsApp.',
        'La API usara JSON Schema. Devuelve solo el objeto con answer.',
        'answer debe contener solo el mensaje final que se enviara por WhatsApp.',
        'Nunca incluyas pensamiento, analisis, pasos, plan, razonamiento ni explicaciones.',
        'Si el texto recibido es puro razonamiento, ignoraló y redacta una respuesta final breve, amable y segura usando el ultimo mensaje del cliente.'
      ].join(' ')
    },
    {
      role: 'user',
      content: [
        `Contacto: ${contactName}`,
        `Fecha y hora local: ${localDateTime}`,
        `Ultimo mensaje del cliente: ${lastIncomingText}`,
        '',
        'Texto que NO debe copiarse si contiene razonamiento:',
        String(originalText || '').slice(0, 1800),
        '',
        'Devuelve solo el JSON final con answer.'
      ].join('\n')
    }
  ];

  emitDebug(debug, 'REPARACION CON IA', { originalText: String(originalText || '').slice(0, 1800), lastIncomingText });

  const data = await callStructuredChat({
    inference,
    model,
    messages,
    temperature: 0.1,
    maxTokens: 220,
    timeoutMs,
    debug,
    trace
  });

  return {
    raw: data,
    content: extractContent(data)
  };
}

function buildAnswerResponseFormat() {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'migo_whatsapp_answer',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['answer'],
        properties: {
          answer: {
            type: 'string',
            minLength: 1,
            description: 'Solo el mensaje final que se enviara por WhatsApp. No incluir razonamiento, analisis, pasos ni etiquetas.'
          }
        }
      }
    }
  };
}

function buildJsonObjectResponseFormat() {
  return { type: 'json_object' };
}

async function callStructuredChat({ inference, model, messages, temperature, maxTokens, timeoutMs, debug, trace = null }) {
  const baseBody = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
    ...(trace && typeof trace === 'object' ? { migo_trace: trace } : {})
  };

  const bodies = [
    {
      label: 'JSON Schema + enable_thinking=false',
      body: {
        ...baseBody,
        enable_thinking: false,
        response_format: buildAnswerResponseFormat()
      }
    },
    {
      label: 'JSON Object + enable_thinking=false',
      body: {
        ...baseBody,
        enable_thinking: false,
        response_format: buildJsonObjectResponseFormat()
      }
    },
    {
      label: 'Sin Structured Output + enable_thinking=false',
      body: {
        ...baseBody,
        enable_thinking: false
      }
    },
    {
      label: 'JSON Schema',
      body: {
        ...baseBody,
        response_format: buildAnswerResponseFormat()
      }
    },
    {
      label: 'JSON Object',
      body: {
        ...baseBody,
        response_format: buildJsonObjectResponseFormat()
      }
    },
    {
      label: 'Plano',
      body: baseBody
    }
  ];

  const endpoints = [
    {
      label: 'LM Studio API v1',
      path: '/api/v1/chat',
      // Este es el endpoint que muestra LM Studio en la pestaña "LM Studio API".
      // Lo probamos primero para instalaciones nuevas.
      maxAttempts: 3
    },
    {
      label: 'OpenAI compatible',
      path: '/v1/chat/completions',
      maxAttempts: bodies.length
    }
  ];

  const errors = [];

  for (const endpoint of endpoints) {
    const endpointBodies = bodies.slice(0, endpoint.maxAttempts);
    for (const variant of endpointBodies) {
      try {
        emitDebug(debug, 'REQUEST LM STUDIO', {
          endpoint: endpoint.label,
          path: endpoint.path,
          variant: variant.label,
          body: variant.body
        });
        const response = await postJson(endpoint.path, variant.body, timeoutMs, debug, `${endpoint.label} / ${variant.label}`, inference);
        emitDebug(debug, 'RESPONSE LM STUDIO OK', {
          endpoint: endpoint.label,
          path: endpoint.path,
          variant: variant.label,
          response
        });
        return response;
      } catch (error) {
        const item = {
          endpoint: endpoint.label,
          path: endpoint.path,
          variant: variant.label,
          error: error?.message || String(error)
        };
        errors.push(item);
        emitDebug(debug, 'REQUEST FALLIDO', item);

        // Si el endpoint nativo no existe, pasamos rapido al OpenAI-compatible.
        if (endpoint.label === 'LM Studio API v1' && looksLikeMissingEndpoint(error)) {
          break;
        }
      }
    }
  }

  throw new Error(`No fue posible obtener respuesta de LM Studio. Intentos: ${safeStringify(errors, 4000)}`);
}


async function getJson(path, timeoutMs, debug = null, label = 'GET', inference) {
  return requestLmStudio({
    config: inference,
    method: 'GET',
    path,
    timeoutMs,
    debug,
    label
  });
}

async function postJson(path, body, timeoutMs, debug = null, label = 'POST', inference) {
  return requestLmStudio({
    config: inference,
    method: 'POST',
    path,
    body,
    timeoutMs,
    debug,
    label
  });
}

function looksLikeMissingEndpoint(error) {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('404')
    || text.includes('not found')
    || text.includes('cannot post')
    || text.includes('no route')
    || text.includes('unsupported endpoint');
}

function looksLikeResponseFormatError(error) {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('response_format')
    || text.includes('json_schema')
    || text.includes('schema')
    || text.includes('structured')
    || text.includes('400')
    || text.includes('422');
}

function looksLikeUnsupportedNoThinkingParam(error) {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('enable_thinking')
    || text.includes('enable thinking')
    || text.includes('unknown parameter')
    || text.includes('unknown field')
    || text.includes('unrecognized')
    || text.includes('unexpected')
    || text.includes('extra inputs')
    || text.includes('additional properties');
}

function extractContent(data) {
  const choice = data?.choices?.[0] || null;
  const candidates = [
    choice?.message?.parsed,
    choice?.message?.content,
    data?.message?.content,
    data?.message,
    choice?.text,
    data?.response,
    data?.output_text,
    data?.content
  ];

  for (const value of candidates) {
    const text = normalizeContentValue(value);
    if (text) return text;
  }

  if (Array.isArray(data?.output)) {
    const text = normalizeContentValue(data.output);
    if (text) return text;
  }

  return '';
}

function normalizeContentValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        return item?.text || item?.content || item?.output_text || '';
      })
      .join('\n')
      .trim();
  }
  if (typeof value === 'object') {
    const answer = value.answer || value.respuesta || value.message || value.mensaje;
    if (typeof answer === 'string' && answer.trim()) return answer.trim();
    return String(value.text || value.content || value.output_text || '').trim();
  }
  return String(value || '').trim();
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

async function safeText(response) {
  try {
    return await response.text();
  } catch (error) {
    return '';
  }
}

function getFinishReason(data) {
  return String(data?.choices?.[0]?.finish_reason || data?.finish_reason || '').trim().toLowerCase();
}

function looksLikeIncompleteJsonAnswer(text) {
  const value = String(text || '').trim();
  if (!value) return false;

  const resemblesAnswerJson = /^\s*\{/.test(value) || /["']answer["']\s*:/.test(value);
  if (!resemblesAnswerJson) return false;

  try {
    const parsed = JSON.parse(value);
    return !(parsed && typeof parsed.answer === 'string' && parsed.answer.trim());
  } catch (error) {
    return true;
  }
}

function cleanupAnswer(text) {
  let value = String(text || '')
    .replace(/^```(?:text|markdown|json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  const jsonAnswer = tryExtractJsonAnswer(value);
  if (jsonAnswer) value = jsonAnswer;
  else if (looksLikeIncompleteJsonAnswer(value)) return '';

  // Si el modelo puso razonamiento antes de un marcador final, intentamos rescatar
  // solo el mensaje final. Si no hay mensaje final usable, devolvemos vacio y
  // handleGenerate usara repair/fallback seguro.
  if (startsWithForbiddenReasoning(value)) {
    const finalOnly = extractAfterFinalMarker(value);
    value = finalOnly || '';
  }

  if (!value || startsWithForbiddenReasoning(value)) return '';

  value = extractFinalAnswer(value);
  value = stripThinkingBlocks(value);
  value = extractFinalAnswer(value);

  if (hasReasoningLeak(value)) {
    const finalOnly = extractAfterFinalMarker(value);
    if (finalOnly && !hasReasoningLeak(finalOnly)) {
      value = finalOnly;
    } else {
      return '';
    }
  }

  value = value
    .replace(/^\s*(?:Respuesta(?: WhatsApp| final)?|Mensaje|Salida|Final answer|Final|Answer)\s*:\s*/i, '')
    .replace(/^['"“”]+|['"“”]+$/g, '')
    .trim();

  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isThinkingLine(line));

  const result = collapseRepeatedText(lines.join('\n').trim());
  return hasReasoningLeak(result) ? '' : result;
}

function collapseRepeatedText(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length < 8) return value;

  const normalize = (input) => String(input || '')
    .toLowerCase()
    .replace(/[\s\u200b\u200c\u200d]+/g, '')
    .replace(/["'“”‘’`´]+/g, '')
    .trim();

  const mid = Math.floor(value.length / 2);
  const from = Math.max(1, mid - 30);
  const to = Math.min(value.length - 1, mid + 30);

  for (let i = from; i <= to; i += 1) {
    const left = value.slice(0, i).trim();
    const right = value.slice(i).trim();
    if (!left || !right) continue;
    if (normalize(left) === normalize(right)) return left;
  }

  return value;
}

function extractFinalAnswer(text) {
  let value = String(text || '').trim();

  const jsonAnswer = tryExtractJsonAnswer(value);
  if (jsonAnswer) return jsonAnswer;

  const tagMatch = value.match(/<\s*(?:respuesta|answer|final)\s*>\s*([\s\S]*?)\s*<\s*\/\s*(?:respuesta|answer|final)\s*>/i);
  if (tagMatch?.[1]) return tagMatch[1].trim();

  const afterMarker = extractAfterFinalMarker(value);
  if (afterMarker) return afterMarker;

  return value;
}

function extractAfterFinalMarker(text) {
  const value = String(text || '').trim();
  const markers = [
    'respuesta final:',
    'mensaje final:',
    'respuesta whatsapp:',
    'whatsapp response:',
    'final response:',
    'respuesta:',
    'final answer:',
    'answer:',
    'final:'
  ];

  const lower = value.toLowerCase();
  let bestIndex = -1;
  let bestMarker = '';
  for (const marker of markers) {
    const index = lower.lastIndexOf(marker);
    if (index > bestIndex) {
      bestIndex = index;
      bestMarker = marker;
    }
  }

  if (bestIndex >= 0) {
    return value.slice(bestIndex + bestMarker.length).trim();
  }

  return '';
}

function tryExtractJsonAnswer(text) {
  const value = String(text || '').trim();
  const candidates = [value];
  const objectMatch = value.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const answer = parsed?.answer || parsed?.respuesta || parsed?.message || parsed?.mensaje;
      if (typeof answer === 'string' && answer.trim()) return answer.trim();
    } catch (error) {
      // Ignore invalid JSON and continue with plain text cleanup.
    }
  }

  return '';
}

function stripThinkingBlocks(text) {
  let value = String(text || '');

  const pairedTags = ['think', 'thinking', 'thought', 'analysis', 'reasoning', 'razonamiento', 'pensamiento', 'analisis', 'análisis'];
  for (const tag of pairedTags) {
    const re = new RegExp(`<\\s*${tag}\\s*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`, 'gi');
    value = value.replace(re, '');
  }

  value = value.replace(/\[(?:thinking|thought|analysis|reasoning|razonamiento|pensamiento|analisis|análisis)\][\s\S]*?\[\/(?:thinking|thought|analysis|reasoning|razonamiento|pensamiento|analisis|análisis)\]/gi, '');

  const lines = value.split('\n');
  const cleaned = [];
  let skipping = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const startsThinking = /^(?:#{1,6}\s*)?(?:thought|thinking|thinking process|analysis|reasoning|reasoning process|chain of thought|razonamiento|pensamiento|análisis|analisis|proceso|plan)\s*:/i.test(line);
    const startsFinal = /^(?:#{1,6}\s*)?(?:respuesta(?:\s+final|\s+whatsapp)?|mensaje(?:\s+final)?|final answer|final response|final|answer)\s*:/i.test(line);

    if (startsFinal) {
      skipping = false;
      cleaned.push(rawLine);
      continue;
    }

    if (startsThinking) {
      skipping = true;
      continue;
    }

    if (!skipping) cleaned.push(rawLine);
  }

  value = cleaned.join('\n');

  const unclosedReasoning = /<\s*(?:think|thinking|thought|analysis|reasoning|razonamiento|pensamiento|analisis|análisis)\s*>/i.test(value);
  if (unclosedReasoning) {
    const final = extractFinalAnswer(value.replace(/<\s*(?:think|thinking|thought|analysis|reasoning|razonamiento|pensamiento|analisis|análisis)\s*>/gi, ''));
    value = final || '';
  }

  return value.trim();
}

function hasReasoningLeak(text) {
  const value = String(text || '').trim();
  if (!value) return false;

  if (startsWithForbiddenReasoning(value)) return true;

  return /(?:thinking process|analy[sz]e the request|analy[sz]e the context|determine the goal|last message received|conversation\/history|chain of thought|internal reasoning|razonamiento interno|proceso de pensamiento|pensamiento interno)/i.test(value)
    || /(?:\*\s*analy[sz]e|\*\s*determine|^\s*\d+\.\s*\*?\s*analy[sz]e)/i.test(value)
    || /(?:^|\n)\s*(?:\d+\.)?\s*(?:analy[sz]e|determine|identify|consider)\b/i.test(value)
    || /^\s*(?:thought|thinking|thinking process|analysis|reasoning|reasoning process|chain of thought|razonamiento|pensamiento|análisis|analisis|proceso|plan)\s*:/i.test(value);
}

function startsWithForbiddenReasoning(text) {
  const value = String(text || '')
    .replace(/^```(?:text|markdown|json)?/i, '')
    .replace(/^[\s"'“”`*_#>-]+/, '')
    .trim();

  if (!value) return false;

  return /^(?:\d+[\).:-]?\s*)?(?:thinking\s+process|thought\s+process|reasoning\s+process|chain\s+of\s+thought|analysis|reasoning|thought|thinking|razonamiento|pensamiento|proceso\s+de\s+pensamiento)(?:\b|\s*:|\s*-|\s*\d)/i.test(value);
}

function isThinkingLine(line) {
  const value = String(line || '').trim();
  if (!value) return true;

  return startsWithForbiddenReasoning(value)
    || /^(?:i need to|we need to|the user wants|the user is asking|i should|let me|let's|first,? i|okay,? so|ok,? so)/i.test(value)
    || /^(?:necesito|debo|el usuario quiere|el usuario pide|voy a analizar|primero debo|tengo que)/i.test(value)
    || /^<\s*\/?\s*(?:think|thinking|thought|analysis|reasoning|razonamiento|pensamiento|analisis|análisis)\s*>$/i.test(value);
}

function isUsableFinalAnswer(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  if (value.length < 2) return false;
  if (hasReasoningLeak(value)) return false;
  if (looksLikeIncompleteJsonAnswer(value)) return false;
  if (/^\s*\{?\s*["']?(?:answer|respuesta|message|mensaje)["']?\s*:/i.test(value)) return false;
  return true;
}

function safeFallbackAnswer({ lastIncomingText, contactName, localDateTime }) {
  const text = String(lastIncomingText || '').toLowerCase();

  if (/\b(hora|que hora|qué hora|fecha|dia es|día es)\b/i.test(text)) {
    return `La hora local que tengo registrada es ${localDateTime}. Con gusto te ayudo con las prendas de Delice Boutique.`;
  }

  if (/\b(hola|buenas|buenos dias|buenas tardes|buenas noches|saludos)\b/i.test(text)) {
    return '¡Hola! Soy el asistente comercial de Delice Boutique 😊 Tenemos bodys, blusas, faldas, pantalones, vestidos y promociones. ¿Qué tipo de prenda buscas?';
  }

  if (/\b(body|bodys|bodies)\b/i.test(text)) {
    if (/\b(foto|fotos|imagen|imagenes|imágenes|muestra|mandame|mándame)\b/i.test(text)) {
      return 'Sí 😊 Tenemos fotos disponibles. Te mostraré de inmediato hasta tres modelos con su nombre y precio publicado.';
    }
    return 'Sí 😊 Tenemos Body Abbi, Alina, Basic, Bonne Long, Bonnie, Bretelle, Darla, Ete, Golden, Ivvy, Kayla, Kenna, Leo, Mercy, Mila, Missy, Molly, Rond, Ruby, Sesgo y Stelle. Los precios publicados van de $40.000 a $50.000 COP y los colores cambian según el modelo.';
  }

  if (/\b(precio|cuanto|cuánto|costo|vale|valor)\b/i.test(text)) {
    return 'Con gusto te comparto el precio publicado. Dime si buscas bodys, blusas, faldas, pantalones o vestidos y te muestro opciones reales de una vez.';
  }

  if (/\b(queja|reclamo|molesto|problema|error|falla|no funciona)\b/i.test(text)) {
    return 'Lamento el inconveniente. Cuéntame brevemente qué ocurrió y una asesora de Delice podrá revisar tu caso.';
  }

  return `Con gusto te ayudo${contactName ? '' : ''}. Tenemos bodys, blusas, faldas, pantalones, vestidos y promociones. ¿Qué tipo de prenda deseas conocer?`;
}

function friendlyError(error) {
  if (error?.name === 'AbortError') {
    return 'Tiempo agotado esperando respuesta de LM Studio. Revisa que el modelo este cargado.';
  }
  return error?.message || 'Error desconocido generando la respuesta.';
}
