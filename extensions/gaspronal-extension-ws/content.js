(() => {
  // v0.26: inferencia remota por Socket.IO hacia el agente local de LM Studio.
  const PANEL_ID = 'migo-wa-ai-panel';
  const BUTTON_ID = 'migo-wa-ai-mini-button';
  const AUTO_LOCK_KEY = 'migo_wa_ai_auto_reply_lock_v1';
  const REPLIED_INCOMING_KEY = 'migo_wa_ai_replied_incoming_v1';
  const AWAITING_CUSTOMER_KEY = 'migo_wa_ai_awaiting_customer_v1';
  const INSTANCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const DEFAULTS = {
    hubUrl: 'https://realtime.gaspronal.programandoweb.net',
    inferenceToken: '',
    agentId: 'gaspronal-lmstudio',
    clientId: 'gaspronal-wa-extension',
    model: 'google/gemma-4-e4b',
    maxMessages: 12,
    temperature: 0.25,
    autoReplyEnabled: false,
    autoReplyUnreadEnabled: true,
    autoReplyGroupsEnabled: false,
    autoReplyDelayMs: 1800,
    systemPrompt: `Eres un asistente comercial de Migo para WhatsApp.

OBJETIVO:
Responder clientes por WhatsApp de forma breve, clara, amable y profesional.

REGLAS OBLIGATORIAS:
- No muestres razonamiento interno.
- No escribas Thinking Process.
- No escribas Analyze the Request.
- No escribas Analyze the Context.
- No escribas Determine the Goal.
- No escribas Reasoning.
- No escribas Razonamiento.
- No escribas Pensamiento.
- No escribas pasos internos.
- No expliques como llegaste a la respuesta.
- No uses markdown.
- Para consultas generales menciona máximo 6 productos; para fotos, máximo 3.
- No inventes precios, promesas, links, horarios, politicas, fechas ni informacion legal.
- Si el cliente pide algo que no sabes, responde que un asesor lo confirmara.
- Si el mensaje no esta relacionado con Migo, responde brevemente y redirige con amabilidad hacia los servicios de Migo.
- Si hay una queja, responde con empatia y sugiere que un asesor humano continue.

FORMATO DE SALIDA OBLIGATORIO:
Devuelve solamente un JSON valido con esta forma exacta:
{"answer":"texto final para enviar por WhatsApp"}

No incluyas nada antes ni despues del JSON.`,
    unreadScanCooldownMs: 3500,
    repliedIncomingTtlMs: 12 * 60 * 60 * 1000,
    // Silencio minimo por chat despues de responder. Evita rafagas si WhatsApp rehidrata el DOM
    // y muestra nuestro propio mensaje como entrante durante unos segundos.
    chatQuietAfterSendMs: 2 * 60 * 1000
  };

  let lastAnswer = '';
  let settings = { ...DEFAULTS };
  let autoTimer = null;
  let autoBusy = false;
  let lastSentAt = 0;
  let lastProcessedKey = '';
  let observer = null;
  const recentUnreadKeys = new Map();
  let activeDebugId = '';
  let debugClearedAtMs = 0;
  const debugLogLines = [];

  boot();

  async function boot() {
    settings = await loadSettings();
    waitForWhatsAppRoot().then(() => {
      ensureMiniButton();
      ensurePanel();
      updateAutoUi();
      startObserver();
      scheduleAutoCheck('inicio');
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') return;
      for (const [key, change] of Object.entries(changes)) {
        if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
          settings[key] = change.newValue;
        }
      }
      settings.maxMessages = Number(settings.maxMessages || DEFAULTS.maxMessages);
      settings.temperature = Number(settings.temperature || DEFAULTS.temperature);
      settings.autoReplyDelayMs = Number(settings.autoReplyDelayMs || DEFAULTS.autoReplyDelayMs);
      updateAutoUi();
      updateSettingsFields();
      scheduleAutoCheck('configuracion');
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !String(message.type || '').startsWith('MIGO_WA_AI_')) return false;

      if (message.type === 'MIGO_WA_AI_TOGGLE_DRAWER') {
        toggleDrawer();
        sendResponse?.({ ok: true });
        return true;
      }

      if (message.type === 'MIGO_WA_AI_OPEN_DRAWER') {
        openDrawer();
        sendResponse?.({ ok: true });
        return true;
      }

      if (message.type === 'MIGO_WA_AI_CLOSE_DRAWER') {
        closeDrawer();
        sendResponse?.({ ok: true });
        return true;
      }

      if (message.type === 'MIGO_WA_AI_DEBUG_EVENT') {
        appendDebugLog(message.event);
        sendResponse?.({ ok: true });
        return true;
      }

      return false;
    });
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, (data) => resolve({ ...DEFAULTS, ...data }));
    });
  }

  function waitForWhatsAppRoot() {
    return new Promise((resolve) => {
      const ready = () => document.querySelector('#app') || document.querySelector('div[role="application"]');
      if (ready()) return resolve();

      const rootObserver = new MutationObserver(() => {
        if (ready()) {
          rootObserver.disconnect();
          resolve();
        }
      });
      rootObserver.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  function ensureMiniButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.innerHTML = '<span>IA</span><small>Gaspro</small>';
    button.title = 'Abrir Gaspronal IA';
    button.addEventListener('click', () => {
      toggleDrawer();
    });
    document.documentElement.appendChild(button);
  }

  function ensurePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) return existing;

    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', 'Gaspronal IA para WhatsApp');
    panel.innerHTML = `
      <div class="migo-wa-ai-shell">
        <div class="migo-wa-ai-header">
          <div class="migo-wa-ai-brand">
            <div class="migo-wa-ai-logo">G</div>
            <div>
              <strong>Gaspronal IA</strong>
              <span>WhatsApp + LM Studio</span>
            </div>
          </div>
          <div class="migo-wa-ai-header-actions">
            <span class="migo-wa-ai-chip" data-role="autoChip">Manual</span>
            <button type="button" data-action="close" title="Ocultar panel">×</button>
          </div>
        </div>

        <div class="migo-wa-ai-body">
          <section class="migo-wa-ai-card migo-wa-ai-card-hero">
            <div>
              <h2>Asistente comercial</h2>
              <p>Lee el chat abierto y prepara una respuesta comercial de Gaspronal.</p>
            </div>
            <span data-role="connectionPill" class="migo-wa-ai-pill">LM Studio</span>
          </section>

          <section class="migo-wa-ai-card">
            <div class="migo-wa-ai-card-title">
              <strong>Automatización</strong>
              <span>Modo anti-ráfagas: responde cada mensaje nuevo</span>
            </div>
            <label class="migo-wa-ai-toggle">
              <input type="checkbox" data-action="autoToggle">
              <span class="migo-wa-ai-slider"></span>
              <span class="migo-wa-ai-toggle-text">Respuestas automáticas</span>
            </label>
            <label class="migo-wa-ai-toggle migo-wa-ai-toggle-secondary">
              <input type="checkbox" data-action="unreadToggle">
              <span class="migo-wa-ai-slider"></span>
              <span class="migo-wa-ai-toggle-text">Responder chats no leídos visibles</span>
            </label>
            <label class="migo-wa-ai-toggle migo-wa-ai-toggle-secondary">
              <input type="checkbox" data-action="groupsToggle">
              <span class="migo-wa-ai-slider"></span>
              <span class="migo-wa-ai-toggle-text">Responder grupos</span>
            </label>
          </section>

          <section class="migo-wa-ai-card migo-wa-ai-answer-card">
            <div class="migo-wa-ai-card-title">
              <strong>Respuesta sugerida</strong>
              <span data-role="mode">Automático apagado: no envía mensajes.</span>
            </div>
            <div class="migo-wa-ai-status" data-role="status">Abre un chat de WhatsApp. Gaspronal IA no responderá archivados ni grupos si el switch está apagado.</div>
            <textarea data-role="answer" placeholder="Aquí aparecerá la respuesta sugerida..." rows="10"></textarea>
            <div class="migo-wa-ai-actions">
              <button type="button" data-action="generate">Sugerir respuesta</button>
              <button type="button" data-action="insert">Insertar</button>
            </div>
          </section>

          <details class="migo-wa-ai-card migo-wa-ai-debug" open>
            <summary>
              <span>
                <strong>Intercambio remoto con LM Studio</strong>
                <small>WhatsApp → Hub → agente local → LM Studio</small>
              </span>
            </summary>
            <div class="migo-wa-ai-debug-tools">
              <button type="button" data-action="clearDebug">Limpiar log</button>
              <button type="button" data-action="copyDebug">Copiar log</button>
              <button type="button" data-action="testLmStudio">Probar LM Studio</button>
              <span data-role="debugStatus">Esperando consulta...</span>
            </div>
            <label class="migo-wa-ai-debug-prompt">
              Consulta de prueba
              <textarea data-role="testPrompt" rows="3">Hola, responde únicamente un JSON válido con {&quot;answer&quot;:&quot;conexión OK&quot;}.</textarea>
            </label>
            <pre data-role="debugLog">Aquí verás lo que la extensión envía al Hub y recibe del agente de LM Studio.</pre>
          </details>

          <details class="migo-wa-ai-card migo-wa-ai-config">
            <summary>
              <span>
                <strong>Configuración del modelo</strong>
                <small>Hub, agente, modelo, temperatura y prompt base</small>
              </span>
            </summary>
            <div class="migo-wa-ai-form">
              <label>
                URL del Hub Socket.IO
                <input data-setting="hubUrl" type="text" autocomplete="off">
              </label>
              <label>
                Token de inferencia
                <input data-setting="inferenceToken" type="password" autocomplete="off">
              </label>
              <div class="migo-wa-ai-grid">
                <label>
                  Agent ID
                  <input data-setting="agentId" type="text" autocomplete="off">
                </label>
                <label>
                  Client ID
                  <input data-setting="clientId" type="text" autocomplete="off">
                </label>
              </div>
              <label>
                Modelo
                <input data-setting="model" type="text" autocomplete="off">
              </label>
              <div class="migo-wa-ai-grid">
                <label>
                  Mensajes
                  <input data-setting="maxMessages" type="number" min="2" max="30">
                </label>
                <label>
                  Temperatura
                  <input data-setting="temperature" type="number" min="0" max="1.5" step="0.05">
                </label>
              </div>
              <label>
                Espera automática ms
                <input data-setting="autoReplyDelayMs" type="number" min="600" max="10000" step="100">
              </label>
              <label>
                Prompt del sistema
                <textarea data-setting="systemPrompt" rows="6"></textarea>
              </label>
              <button type="button" data-action="saveSettings">Guardar configuración</button>
              <small data-role="settingsStatus"></small>
            </div>
          </details>
        </div>
      </div>
    `;

    panel.querySelector('[data-action="close"]').addEventListener('click', closeDrawer);
    panel.querySelector('[data-action="generate"]').addEventListener('click', generateAnswer);
    panel.querySelector('[data-action="insert"]').addEventListener('click', insertLastAnswer);
    panel.querySelector('[data-action="saveSettings"]').addEventListener('click', saveDrawerSettings);
    panel.querySelector('[data-action="clearDebug"]')?.addEventListener('click', () => clearDebugLog('Log limpiado. Esperando nueva consulta...'));
    panel.querySelector('[data-action="copyDebug"]')?.addEventListener('click', copyDebugLogToClipboard);
    panel.querySelector('[data-action="testLmStudio"]')?.addEventListener('click', runLmStudioTest);
    panel.querySelector('[data-action="autoToggle"]').addEventListener('change', async (event) => {
      settings.autoReplyEnabled = Boolean(event.target.checked);
      await chrome.storage.sync.set({ autoReplyEnabled: settings.autoReplyEnabled });
      updateAutoUi();
      scheduleAutoCheck('toggle');
    });
    panel.querySelector('[data-action="unreadToggle"]').addEventListener('change', async (event) => {
      settings.autoReplyUnreadEnabled = Boolean(event.target.checked);
      await chrome.storage.sync.set({ autoReplyUnreadEnabled: settings.autoReplyUnreadEnabled });
      updateAutoUi();
      scheduleAutoCheck('unread-toggle');
    });
    panel.querySelector('[data-action="groupsToggle"]').addEventListener('change', async (event) => {
      settings.autoReplyGroupsEnabled = Boolean(event.target.checked);
      await chrome.storage.sync.set({ autoReplyGroupsEnabled: settings.autoReplyGroupsEnabled });
      updateAutoUi();
      scheduleAutoCheck('groups-toggle');
    });

    document.documentElement.appendChild(panel);
    updateSettingsFields(panel);
    return panel;
  }

  function clearDebugLog(message = 'Log limpiado.') {
    debugClearedAtMs = Date.now();
    debugLogLines.length = 0;
    const panel = ensurePanel();
    const pre = panel.querySelector('[data-role="debugLog"]');
    const status = panel.querySelector('[data-role="debugStatus"]');
    if (pre) pre.textContent = message;
    if (status) status.textContent = message;
  }


  async function copyDebugLogToClipboard() {
    const panel = ensurePanel();
    const pre = panel.querySelector('[data-role="debugLog"]');
    const status = panel.querySelector('[data-role="debugStatus"]');
    const visibleText = String(pre?.textContent || '').trim();
    const fullText = debugLogLines.length
      ? debugLogLines.join('\n\n---\n\n')
      : visibleText;
    const textToCopy = String(fullText || '').trim() || 'Log vacío.';

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      if (status) status.textContent = `Log copiado (${textToCopy.length} caracteres). Pégalo en ChatGPT para revisarlo.`;
    } catch (error) {
      if (status) status.textContent = 'No pude copiar el log. Selecciona el <pre> y copia manualmente.';
      console.warn('[Gaspronal WA IA] No pude copiar log', error);
    }
  }

  function logDebug(label, data = null, id = activeDebugId || 'local') {
    appendDebugLog({
      id,
      ts: Date.now(),
      at: new Date().toLocaleTimeString('es-CO', { hour12: false }),
      label,
      data
    });
  }

  function appendDebugLog(event = {}) {
    if (!event || !event.label) return;
    const eventTs = Number(event.ts || 0);
    if (debugClearedAtMs && eventTs && eventTs < debugClearedAtMs) return;

    const stamp = event.at || new Date().toLocaleTimeString('es-CO', { hour12: false });
    const dataText = formatDebugData(event.data);
    const block = dataText
      ? `[${stamp}] ${event.label}\n${dataText}`
      : `[${stamp}] ${event.label}`;

    debugLogLines.push(block);
    while (debugLogLines.length > 80) debugLogLines.shift();

    const panel = ensurePanel();
    const pre = panel.querySelector('[data-role="debugLog"]');
    const status = panel.querySelector('[data-role="debugStatus"]');
    if (pre) {
      const text = debugLogLines.join('\n\n---\n\n');
      pre.textContent = text.length > 140000 ? `${text.slice(-140000)}\n\n[log recortado por tamaño]` : text;
      pre.scrollTop = pre.scrollHeight;
    }
    if (status) status.textContent = event.label;
  }

  function formatDebugData(value) {
    if (value === undefined || value === null || value === '') return '';
    try {
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      if (text.length > 50000) return `${text.slice(0, 50000)}\n... [truncado ${text.length - 50000} caracteres]`;
      return text;
    } catch (error) {
      return String(value || '');
    }
  }

  function openDrawer() {
    const panel = ensurePanel();
    panel.classList.remove('migo-wa-ai-hidden');
    document.documentElement.classList.add('migo-wa-ai-drawer-open');
    const button = document.getElementById(BUTTON_ID);
    if (button) button.classList.add('migo-wa-ai-panel-open');
  }

  function closeDrawer() {
    const panel = ensurePanel();
    panel.classList.add('migo-wa-ai-hidden');
    document.documentElement.classList.remove('migo-wa-ai-drawer-open');
    const button = document.getElementById(BUTTON_ID);
    if (button) button.classList.remove('migo-wa-ai-panel-open');
  }

  function toggleDrawer() {
    const panel = ensurePanel();
    if (panel.classList.contains('migo-wa-ai-hidden')) {
      openDrawer();
    } else {
      closeDrawer();
    }
  }

  function updateSettingsFields(panel = document.getElementById(PANEL_ID)) {
    if (!panel) return;
    for (const input of Array.from(panel.querySelectorAll('[data-setting]'))) {
      const key = input.getAttribute('data-setting');
      if (!key) continue;
      const value = settings[key] ?? DEFAULTS[key] ?? '';
      input.value = value;
    }
  }

  async function saveDrawerSettings() {
    const panel = ensurePanel();
    const settingsStatus = panel.querySelector('[data-role="settingsStatus"]');
    const getValue = (key) => panel.querySelector(`[data-setting="${key}"]`)?.value ?? DEFAULTS[key];

    const payload = {
      hubUrl: String(getValue('hubUrl') || DEFAULTS.hubUrl).trim().replace(/\/+$/, ''),
      inferenceToken: String(getValue('inferenceToken') || DEFAULTS.inferenceToken).trim(),
      agentId: String(getValue('agentId') || DEFAULTS.agentId).trim(),
      clientId: String(getValue('clientId') || DEFAULTS.clientId).trim(),
      model: String(getValue('model') || DEFAULTS.model).trim(),
      maxMessages: Number(getValue('maxMessages') || DEFAULTS.maxMessages),
      temperature: Number(getValue('temperature') || DEFAULTS.temperature),
      autoReplyDelayMs: Number(getValue('autoReplyDelayMs') || DEFAULTS.autoReplyDelayMs),
      systemPrompt: String(getValue('systemPrompt') || DEFAULTS.systemPrompt).trim()
    };

    settings = { ...settings, ...payload };
    await chrome.storage.sync.set(payload);
    updateAutoUi();
    updateSettingsFields(panel);
    if (settingsStatus) {
      settingsStatus.textContent = 'Configuración guardada.';
      setTimeout(() => {
        settingsStatus.textContent = '';
      }, 2200);
    }
  }

  function updateAutoUi() {
    const panel = ensurePanel();
    const toggle = panel.querySelector('[data-action="autoToggle"]');
    const unreadToggle = panel.querySelector('[data-action="unreadToggle"]');
    const groupsToggle = panel.querySelector('[data-action="groupsToggle"]');
    const mode = panel.querySelector('[data-role="mode"]');
    const autoChip = panel.querySelector('[data-role="autoChip"]');
    const connectionPill = panel.querySelector('[data-role="connectionPill"]');
    const button = document.getElementById(BUTTON_ID);

    if (toggle) toggle.checked = Boolean(settings.autoReplyEnabled);
    if (unreadToggle) unreadToggle.checked = Boolean(settings.autoReplyUnreadEnabled);
    if (groupsToggle) groupsToggle.checked = Boolean(settings.autoReplyGroupsEnabled);
    if (mode) {
      if (!settings.autoReplyEnabled) {
        mode.textContent = 'Automático apagado: no envía mensajes.';
      } else if (settings.autoReplyUnreadEnabled) {
        mode.textContent = 'Automático encendido: responde chat abierto y no leídos visibles. Ignora archivados y grupos apagados.';
      } else {
        mode.textContent = 'Automático encendido: responde solo el chat abierto cuando el último mensaje sea entrante.';
      }
    }
    if (autoChip) {
      autoChip.textContent = settings.autoReplyEnabled ? 'Auto ON' : 'Manual';
      autoChip.classList.toggle('migo-wa-ai-chip-on', Boolean(settings.autoReplyEnabled));
    }
    if (connectionPill) {
      connectionPill.textContent = settings.agentId ? `Socket · ${settings.agentId}` : 'Socket LM';
    }
    if (button) {
      button.classList.toggle('migo-wa-ai-auto-on', Boolean(settings.autoReplyEnabled));
      button.classList.toggle('migo-wa-ai-panel-open', !panel.classList.contains('migo-wa-ai-hidden'));
    }
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((mutation) => {
        const target = mutation.target;
        if (!(target instanceof Element)) return false;
        if (target.closest?.(`#${PANEL_ID}`) || target.closest?.(`#${BUTTON_ID}`)) return false;
        return true;
      });
      if (relevant) scheduleAutoCheck('mutacion');
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  async function generateAnswer() {
    const panel = ensurePanel();
    const status = panel.querySelector('[data-role="status"]');
    const textarea = panel.querySelector('[data-role="answer"]');

    const chat = extractCurrentChat();
    if (!chat.messages.length) {
      setStatus(status, 'No pude leer mensajes visibles. Abre un chat y espera que cargue.', true);
      return;
    }

    textarea.value = '';
    lastAnswer = '';
    activeDebugId = `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    logDebug('CONSULTA MANUAL DESDE BOTON SUGERIR', { debugId: activeDebugId, contactName: chat.contactName, messages: chat.messages });
    setStatus(status, `Leyendo ${chat.messages.length} mensajes y consultando LM Studio...`, false);

    try {
      const response = await requestAnswer(chat, { source: 'manual', triggerReason: 'boton-sugerir' });
      lastAnswer = collapseRepeatedText(response.result.answer || '');
      textarea.value = lastAnswer;
      setStatus(status, `Respuesta generada por ${response.result.provider?.toUpperCase() || 'LM'} · ${response.result.model || ''}`, false);
    } catch (error) {
      setStatus(status, error.message || 'No se pudo generar la respuesta.', true);
    }
  }

  function insertLastAnswer() {
    const panel = ensurePanel();
    const status = panel.querySelector('[data-role="status"]');
    const textarea = panel.querySelector('[data-role="answer"]');
    const answer = collapseRepeatedText(textarea.value || lastAnswer || '');

    if (!answer) {
      setStatus(status, 'Primero genera o escribe una respuesta.', true);
      return;
    }

    if (isUnsafeAnswer(answer)) {
      setStatus(status, 'Respuesta bloqueada: comenzo con Thinking Process. No se inserto ni se envio.', true);
      return;
    }

    const input = findComposer();
    if (!input) {
      setStatus(status, 'No encontré el cuadro de escritura de WhatsApp.', true);
      return;
    }

    focusAndInsert(input, answer);
    setStatus(status, 'Respuesta insertada. Revísala y envíala manualmente.', false);
  }

  function scheduleAutoCheck(reason) {
    if (!settings.autoReplyEnabled) return;
    clearTimeout(autoTimer);
    const delay = Math.max(600, Number(settings.autoReplyDelayMs || DEFAULTS.autoReplyDelayMs));
    autoTimer = setTimeout(() => autoReplyIfNeeded(reason), delay);
  }

  async function autoReplyIfNeeded(reason) {
    if (!settings.autoReplyEnabled || autoBusy) return;
    if (Date.now() - lastSentAt < 1200) return;

    autoBusy = true;
    try {
      logDebug('AUTO CHECK', { reason, autoReplyUnreadEnabled: settings.autoReplyUnreadEnabled });
      const currentUnreadInfo = getCurrentSelectedUnreadInfo();
      const answeredCurrent = await autoReplyCurrentChatIfNeeded(reason, { hasVisibleUnreadBadge: Boolean(currentUnreadInfo) });
      if (answeredCurrent) return;

      if (!settings.autoReplyUnreadEnabled) {
        logDebug('AUTO OMITIDO', { reason, causa: 'recorrido de no leidos apagado' });
        return;
      }

      const opened = await openNextUnreadChat(reason);
      if (!opened) {
        logUnreadScanSnapshot(reason);
        return;
      }

      await sleep(1600);
      await autoReplyCurrentChatIfNeeded('chat-no-leido-abierto', { allowRecentSend: true, hasVisibleUnreadBadge: true });
    } finally {
      autoBusy = false;
      if (settings.autoReplyEnabled && settings.autoReplyUnreadEnabled) {
        clearTimeout(autoTimer);
        autoTimer = setTimeout(() => autoReplyIfNeeded('siguiente-no-leido'), Number(settings.unreadScanCooldownMs || DEFAULTS.unreadScanCooldownMs));
      }
    }
  }

  async function autoReplyCurrentChatIfNeeded(reason, options = {}) {
    if (!settings.autoReplyEnabled) return false;
    if (!options.allowRecentSend && Date.now() - lastSentAt < 5000) {
      logDebug('AUTO OMITIDO', { reason, causa: 'cooldown global despues de envio', msDesdeUltimoEnvio: Date.now() - lastSentAt });
      return false;
    }

    const panel = ensurePanel();
    const status = panel.querySelector('[data-role="status"]');
    const textarea = panel.querySelector('[data-role="answer"]');
    const chat = extractCurrentChat();
    const incomingInfo = getLatestIncomingInfo(chat);
    const lastMessage = incomingInfo?.message;

    if (!chat.contactName || !chat.messages.length || !incomingInfo || !lastMessage) {
      logDebug('AUTO OMITIDO', { reason, causa: 'sin chat activo, sin mensajes o sin entrante detectable', contactName: chat.contactName || null, messagesCount: chat.messages?.length || 0 });
      return false;
    }

    const incomingKey = buildIncomingReplyKey(chat, incomingInfo);

    // Regla senior: una sola respuesta por ultimo mensaje entrante.
    // Si ya respondimos a ese mensaje, esperamos a que el contacto escriba otra vez.
    if (hasOutgoingAfterIndex(chat.messages, incomingInfo.index)) {
      rememberRepliedIncoming(incomingKey, chat.contactName, lastMessage.text);
      rememberAwaitingCustomerReply(chat, incomingInfo, '', incomingKey);
      logDebug('AUTO OMITIDO', { reason, causa: 'ya existe mensaje saliente despues del ultimo entrante visible', contactName: chat.contactName, hasVisibleUnreadBadge: Boolean(options.hasVisibleUnreadBadge), incomingKey });
      return false;
    }

    if (wasIncomingAlreadyReplied(incomingKey)) {
      const msg = `Automático tranquilo: ya respondí ese mensaje de ${chat.contactName}. Espero cualquier mensaje nuevo.`;
      logDebug('AUTO OMITIDO', { reason, causa: 'mensaje entrante ya respondido', incomingKey, contactName: chat.contactName });
      setStatus(status, msg, false);
      return false;
    }

    if (lastMessage.direction !== 'in') {
      logDebug('AUTO OMITIDO', { reason, causa: 'ultimo mensaje visible no es entrante', contactName: chat.contactName, direction: lastMessage.direction });
      return false;
    }

    const lastText = String(lastMessage.text || '').replace(/\s+/g, ' ').trim();
    if (!lastText || lastText.length < 1) {
      logDebug('AUTO OMITIDO', { reason, causa: 'ultimo entrante vacio', contactName: chat.contactName, lastText });
      return false;
    }

    const waitingState = getAwaitingCustomerState(chat.contactName);
    if (waitingState?.lastIncomingKey && waitingState.lastIncomingKey === incomingKey) {
      logDebug('AUTO OMITIDO', {
        reason,
        causa: 'mismo mensaje entrante ya respondido',
        contactName: chat.contactName,
        incomingKey,
        lastIncomingPreview: waitingState.lastIncomingPreview || '',
        detalle: 'No repito la respuesta para el mismo mensaje exacto. Si el contacto escribe cualquier mensaje nuevo, aunque no sea pregunta, responderé.'
      });
      setStatus(status, `Automático tranquilo: ya respondí ese mensaje de ${chat.contactName}. Espero cualquier mensaje nuevo.`, false);
      return false;
    }

    const quietState = evaluateChatQuietState(chat, incomingInfo, lastText, incomingKey);
    if (quietState?.block) {
      logDebug('AUTO OMITIDO', {
        reason,
        causa: 'esperando nuevo mensaje real del contacto',
        contactName: chat.contactName,
        incomingKey,
        lastText,
        detalle: quietState.message || 'Ya se respondió el último mensaje; no se repite hasta que llegue otro entrante distinto.'
      });
      setStatus(status, quietState.message || `Automático tranquilo: ya respondí ese mensaje de ${chat.contactName}. Espero cualquier mensaje nuevo.`, false);
      return false;
    }

    // v24: responde cualquier mensaje entrante una sola vez.
    // Luego queda esperando un nuevo mensaje real del contacto.
    // Si WhatsApp rehidrata el DOM o muestra mi propia respuesta como entrante,
    // evaluateChatQuietState bloquea la rafaga.

    if (isArchiveViewActive() || isCurrentChatArchivedContext()) {
      const key = buildMessageKey(chat, lastMessage);
      lastProcessedKey = key;
      setStatus(status, 'Automático omitido: no respondo chats archivados.', true);
      return false;
    }

    if (!settings.autoReplyGroupsEnabled && isCurrentChatProbablyGroup(chat)) {
      const key = buildMessageKey(chat, lastMessage);
      lastProcessedKey = key;
      setStatus(status, 'Automático omitido: no respondo grupos con el switch apagado.', true);
      return false;
    }

    const input = findComposer();
    if (input && getComposerText(input)) {
      setStatus(status, 'Automático pausado: el cuadro de escritura ya tiene texto. No lo sobrescribí.', true);
      return false;
    }

    const key = incomingKey;
    if (key === lastProcessedKey) return false;
    if (!(await acquireAutoReplyLock(key))) return false;

    lastProcessedKey = key;
    activeDebugId = `auto-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    rememberIncomingProcessing(incomingKey, chat.contactName, lastMessage.text, {
      messageId: lastMessage.messageId,
      timestamp: lastMessage.timestamp
    });

    const decisionTrace = {
      source: 'auto',
      triggerReason: reason,
      incomingKey,
      contactName: chat.contactName,
      contactWhatsapp: chat.contactWhatsapp || '',
      chatId: chat.chatId || '',
      incomingMessageId: lastMessage.messageId || '',
      incomingTimestamp: lastMessage.timestamp || '',
      lastIncomingText: lastText,
      hasVisibleUnreadBadge: Boolean(options.hasVisibleUnreadBadge)
    };

    logDebug('CONSULTA AUTOMATICA A LM STUDIO', {
      debugId: activeDebugId,
      ...decisionTrace,
      messages: chat.messages
    });
    setStatus(status, `Automático: nuevo mensaje de ${chat.contactName}. Consultando LM Studio...`, false);

    let deliveryCommitted = false;
    try {
      const response = await requestAnswer(chat, decisionTrace);
      const media = normalizeMediaItemsForSend(response.result.media);
      const mediaKeys = media.map(getMediaDedupKey).filter(Boolean);
      const photoPriority = Boolean(
        response.result.photoPriority
        || response.result.decision?.photo_requested
        || media.length > 0
      );
      const answer = collapseRepeatedText(response.result.answer || '');
      const mediaCaption = buildMediaCaption(
        response.result.mediaCaption,
        media,
        answer,
      );

      if (!answer && !media.length) throw new Error('LM Studio respondió vacío.');
      if (answer && isUnsafeAnswer(answer)) {
        throw new Error('Respuesta bloqueada: comenzo con Thinking Process. No se envio.');
      }

      if (response.result.decision) {
        logDebug('DECISION DEL AGENTE', response.result.decision, activeDebugId);
      }

      // Las fotos son la respuesta principal. Primero intentamos un álbum
      // único; si WhatsApp no abre el editor, la extensión degrada de forma
      // controlada a envíos individuales. Nunca enviamos texto adicional cuando
      // ya existe al menos una foto comprometida, evitando duplicados visibles.
      if (photoPriority && media.length > 0) {
        setStatus(status, `Automático: preparando ${media.length} foto(s) para ${chat.contactName}...`, false);
        const mediaResult = await sendImageAttachments(media, mediaCaption);
        const committedMediaKeys = Array.isArray(mediaResult.sentMediaKeys) && mediaResult.sentMediaKeys.length
          ? mediaResult.sentMediaKeys
          : mediaKeys.slice(0, Math.max(0, Number(mediaResult.sentCount || 0)));

        logDebug('ENVIO PRIORITARIO DE IMAGENES', {
          incomingKey,
          requested: media.length,
          prepared: mediaResult.preparedCount,
          sent: mediaResult.sentCount,
          failed: mediaResult.failedCount,
          deliveryState: mediaResult.deliveryState,
          deliveryMethod: mediaResult.deliveryMethod || null,
          captionApplied: mediaResult.captionApplied,
          mediaKeys,
          committedMediaKeys,
          warnings: mediaResult.warnings || [],
          error: mediaResult.error || null
        }, activeDebugId);

        if (mediaResult.committed || mediaResult.sentCount > 0) {
          deliveryCommitted = true;
          rememberRepliedIncoming(incomingKey, chat.contactName, lastMessage.text, {
            answer: mediaCaption,
            mediaKeys: committedMediaKeys,
            messageId: lastMessage.messageId,
            timestamp: lastMessage.timestamp
          });
          rememberAwaitingCustomerReply(chat, incomingInfo, mediaCaption, incomingKey);
          lastSentAt = Date.now();

          const partial = mediaResult.deliveryState === 'partial';
          const ambiguous = mediaResult.deliveryState === 'ambiguous';
          const sentLabel = mediaResult.sentCount === 1 ? '1 foto enviada' : `${mediaResult.sentCount} fotos enviadas`;
          setStatus(
            status,
            partial
              ? `Automático: ${sentLabel} a ${chat.contactName}; algunas imágenes no pudieron prepararse.`
              : ambiguous
                ? `Automático: WhatsApp recibió el envío multimedia; no se repetirá aunque la confirmación visual fue ambigua.`
                : `Automático: ${sentLabel} con descripción a ${chat.contactName}.`,
            partial || ambiguous
          );
          return true;
        }

        // Únicamente llegamos al texto de respaldo cuando ninguna imagen pudo
        // abrir el editor ni se presionó el envío multimedia.
        logDebug('FALLBACK TEXTO POR IMAGEN NO ENVIADA', {
          incomingKey,
          warnings: mediaResult.warnings || [],
          error: mediaResult.error || null
        }, activeDebugId);
      }

      const finalAnswer = answer || mediaCaption;
      if (!finalAnswer) throw new Error('No existe una respuesta utilizable.');

      const composer = findComposer();
      if (!composer) throw new Error('No encontré el cuadro de escritura de WhatsApp.');
      if (getComposerText(composer)) throw new Error('El cuadro de escritura tiene texto. No lo sobrescribí.');

      lastAnswer = finalAnswer;
      textarea.value = finalAnswer;
      focusAndInsert(composer, finalAnswer);
      await sleep(350);
      const sent = await sendCurrentMessage(finalAnswer);
      if (!sent) throw new Error('No pude presionar el botón Enviar. Dejé la respuesta escrita para revisión.');
      deliveryCommitted = true;

      rememberRepliedIncoming(incomingKey, chat.contactName, lastMessage.text, {
        answer: finalAnswer,
        mediaKeys: [],
        messageId: lastMessage.messageId,
        timestamp: lastMessage.timestamp
      });
      rememberAwaitingCustomerReply(chat, incomingInfo, finalAnswer, incomingKey);
      lastSentAt = Date.now();

      setStatus(status, `Automático: respuesta enviada por ${response.result.provider?.toUpperCase() || 'LM'} a ${chat.contactName}.`, false);
      return true;
    } catch (error) {
      if (!deliveryCommitted) clearIncomingProcessing(incomingKey);
      setStatus(status, `Automático detenido: ${error.message || 'no se pudo responder.'}`, true);
      return false;
    }

  }

  async function openNextUnreadChat(reason) {
    pruneRecentUnreadKeys();
    if (isArchiveViewActive()) return false;
    const panel = ensurePanel();
    const status = panel.querySelector('[data-role="status"]');
    const candidate = findUnreadChatCandidate();

    if (!candidate) return false;

    setStatus(status, `Automático: abriendo no leído de ${candidate.contactName || 'un contacto'}...`, false);

    const beforeName = getContactName();
    const beforeSignature = getCurrentChatSignature();
    candidate.row.scrollIntoView?.({ block: 'nearest' });
    await sleep(280);

    clickChatRow(candidate.row, { strong: false });
    let opened = await waitForUnreadChatToOpen(candidate, beforeName, beforeSignature, 5200);

    // WhatsApp Web a veces ignora el primer click sintetico en la lista virtualizada.
    // Segundo intento: click directo sobre el cell-frame/gridcell + Enter.
    if (!opened) {
      candidate.row.scrollIntoView?.({ block: 'center' });
      await sleep(350);
      clickChatRow(candidate.row, { strong: true });
      opened = await waitForUnreadChatToOpen(candidate, beforeName, beforeSignature, 5200);
    }

    if (!opened) {
      rememberUnreadKey(candidate.key, 8000);
      setStatus(status, `No pude confirmar apertura del chat no leído ${candidate.contactName || ''}. Lo omito unos segundos para no insistir.`, true);
      return false;
    }

    rememberUnreadKey(candidate.key, 25000);
    return true;
  }

  async function waitForUnreadChatToOpen(candidate, beforeName, beforeSignature, timeoutMs) {
    const started = Date.now();
    const expected = normalizeComparable(candidate.contactName || '');

    while (Date.now() - started < timeoutMs) {
      await sleep(250);
      const rawName = getContactName();
      const currentName = normalizeComparable(rawName);
      const currentSignature = getCurrentChatSignature();
      const chat = extractCurrentChat();
      const messages = chat.messages || [];
      const last = messages[messages.length - 1];
      const composerReady = Boolean(findComposer());
      const messageAreaReady = messages.length > 0 || Boolean((getMainChatRoot() || document).querySelector('div.message-in, div.message-out'));
      const rowSelected = isChatRowSelected(candidate.row);

      const nameMatches = expected && currentName && (currentName.includes(expected) || expected.includes(currentName));
      const changed = currentSignature && currentSignature !== beforeSignature;
      const nameChanged = rawName && beforeName && rawName !== beforeName;
      const hasIncomingLast = last?.direction === 'in' && String(last.text || '').trim().length > 1;
      const snippetMatches = candidate.snippet && normalizeComparable(messages.map((m) => m.text).join(' ')).includes(normalizeComparable(candidate.snippet).slice(0, 60));

      // Para confirmar apertura no exigimos poder leer ya el ultimo mensaje;
      // WhatsApp a veces demora en hidratar burbujas aunque el chat ya abrio.
      if ((nameMatches || changed || nameChanged || rowSelected || snippetMatches) && (composerReady || messageAreaReady || hasIncomingLast)) return true;
    }

    return false;
  }

  function findUnreadChatCandidate() {
    if (isArchiveViewActive()) return null;

    const rows = getVisibleChatRows();
    const currentName = normalizeComparable(getContactName());

    for (const row of rows) {
      if (isArchiveRow(row)) continue;

      const info = buildUnreadRowInfo(row);
      if (!info || !info.hasUnread) continue;
      if (info.isArchived) continue;
      if (isRecentUnreadKey(info.key)) continue;
      if (!settings.autoReplyGroupsEnabled && info.isGroup) continue;

      const rowName = normalizeComparable(info.contactName);
      if (rowName && currentName && rowName === currentName && !isChatRowSelected(row)) {
        continue;
      }

      return info;
    }

    return null;
  }


  function getCurrentSelectedUnreadInfo() {
    try {
      const rows = getVisibleChatRows();
      const currentName = normalizeComparable(getContactName());
      for (const row of rows) {
        if (!isChatRowSelected(row)) continue;
        const info = buildUnreadRowInfo(row);
        if (!info || !info.hasUnread) continue;
        if (info.isArchived) return null;
        if (!settings.autoReplyGroupsEnabled && info.isGroup) return null;
        const rowName = normalizeComparable(info.contactName || '');
        if (rowName && currentName && rowName !== currentName) continue;
        return info;
      }
    } catch (error) {
      logDebug('DEBUG ERROR', { where: 'getCurrentSelectedUnreadInfo', error: error.message || String(error) });
    }
    return null;
  }

  function logUnreadScanSnapshot(reason) {
    try {
      const rows = getVisibleChatRows().slice(0, 12);
      const snapshot = rows.map((row, index) => {
        const info = buildUnreadRowInfo(row);
        return {
          index,
          selected: isChatRowSelected(row),
          title: getChatRowTitle(row),
          snippet: getChatRowSnippet(row, getChatRowTitle(row)),
          unreadCount: getUnreadCount(row),
          hasUnread: hasUnreadIndicator(row),
          isArchiveRow: isArchiveRow(row),
          isGroup: isProbablyGroupRow(row, getChatRowTitle(row)),
          skippedRecent: info?.key ? isRecentUnreadKey(info.key) : false
        };
      });
      logDebug('AUTO SCAN NO LEIDOS', { reason, visibleRows: snapshot });
    } catch (error) {
      logDebug('AUTO SCAN ERROR', { reason, error: error.message || String(error) });
    }
  }

  function getVisibleChatRows() {
    if (isArchiveViewActive()) return [];

    const side = document.querySelector('#side')
      || document.querySelector('[aria-label*="Chat" i]')?.closest('[role="application"], div')
      || document.body;

    const chatList = side.querySelector('[data-testid="chat-list"]') || document.querySelector('[data-testid="chat-list"]');

    let rawRows = [];
    if (chatList) {
      rawRows = Array.from(chatList.querySelectorAll('[role="row"]'))
        .map((row) => normalizeChatRow(row, chatList))
        .filter(Boolean);
    }

    // Fallback para builds viejos de WhatsApp Web que no expongan data-testid=chat-list.
    if (!rawRows.length) {
      const selectors = [
        'div[role="listitem"]',
        'div[role="row"]',
        '[data-testid="cell-frame-container"]',
        '[data-testid="list-item"]',
        '[aria-selected][tabindex]',
        '[data-list-scroll-container] [tabindex]'
      ];

      for (const selector of selectors) {
        for (const row of Array.from(side.querySelectorAll(selector))) {
          const normalized = normalizeChatRow(row, side);
          if (normalized) rawRows.push(normalized);
        }
      }
    }

    const seen = new Set();
    let rows = [];
    for (const row of rawRows) {
      if (seen.has(row)) continue;
      seen.add(row);
      const rect = row.getBoundingClientRect();
      if (!isVisible(row)) continue;
      if (rect.height < 40 || rect.width < 160) continue;
      if (rect.left > Math.max(420, window.innerWidth * 0.48)) continue;
      rows.push(row);
    }

    rows = rows.filter((row) => !rows.some((other) => other !== row && other.contains(row)));
    return rows.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  }

  function normalizeChatRow(row, side) {
    if (!row || !side?.contains(row)) return null;

    const selector = 'div[role="listitem"], div[role="row"], [data-testid="cell-frame-container"], [data-testid="list-item"], [aria-selected][tabindex], [data-list-scroll-container] [tabindex]';
    let current = row;
    let best = row.matches?.(selector) ? row : row.closest?.(selector);

    while (current && current !== side) {
      if (current.matches?.(selector)) {
        const rect = current.getBoundingClientRect();
        if (rect.height >= 40 && rect.width >= 160) best = current;
      }
      current = current.parentElement;
    }

    return best || null;
  }

  function buildUnreadRowInfo(row) {
    const contactName = getChatRowTitle(row);
    const snippet = getChatRowSnippet(row, contactName);
    const unreadCount = getUnreadCount(row);
    const hasUnread = unreadCount > 0 || hasUnreadIndicator(row);
    if (!hasUnread) return null;

    const isArchived = isArchiveRow(row, contactName);
    const isGroup = isProbablyGroupRow(row, contactName);
    const key = [contactName || 'sin-contacto', unreadCount || 'unread', snippet || 'sin-preview'].join('|');

    return { row, contactName, snippet, unreadCount, hasUnread, isGroup, isArchived, key };
  }

  function getUnreadCount(row) {
    const labels = Array.from(row.querySelectorAll('[aria-label]'))
      .map((node) => node.getAttribute('aria-label') || '')
      .filter(Boolean);

    for (const label of labels) {
      if (!/(?:no\s+le[ií]do|unread)/i.test(label)) continue;
      const match = label.match(/\d+/);
      return match ? Number(match[0]) : 1;
    }

    const dataNodes = Array.from(row.querySelectorAll('[data-testid*="unread" i], [data-icon*="unread" i]'));
    if (dataNodes.length) return 1;

    return 0;
  }

  function hasUnreadIndicator(row) {
    if (getUnreadCount(row) > 0) return true;

    const text = String(row.innerText || '').toLowerCase();
    if (/\b(?:mensaje|mensajes)\s+no\s+le[ií]do/.test(text)) return true;

    return Array.from(row.querySelectorAll('[aria-label], [title]')).some((node) => {
      const label = `${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''}`;
      return /(?:no\s+le[ií]do|unread)/i.test(label);
    });
  }

  function getChatRowTitle(row) {
    const titles = Array.from(row.querySelectorAll('[title]'))
      .map((node) => cleanMessageText(node.getAttribute('title') || ''))
      .filter(Boolean)
      .filter((text) => !looksLikeOnlyTime(text))
      .filter((text) => !/(?:no\s+le[ií]do|unread|silenciado|muted|archivado|archived)/i.test(text));

    if (titles.length) return titles[0];

    const lines = String(row.innerText || '')
      .split('\n')
      .map((line) => cleanMessageText(line))
      .filter(Boolean)
      .filter((line) => !looksLikeOnlyTime(line))
      .filter((line) => !/^\d+$/.test(line));

    return lines[0] || 'contacto sin nombre';
  }

  function getChatRowSnippet(row, contactName) {
    const contact = normalizeComparable(contactName || '');
    const lines = String(row.innerText || '')
      .split('\n')
      .map((line) => cleanMessageText(line))
      .filter(Boolean)
      .filter((line) => !looksLikeOnlyTime(line))
      .filter((line) => !/^\d+$/.test(line))
      .filter((line) => normalizeComparable(line) !== contact)
      .filter((line) => !/(?:no\s+le[ií]do|unread)/i.test(line));

    return lines[0] || '';
  }

  function isArchiveRow(row, contactName = '') {
    const title = normalizeComparable(contactName || getChatRowTitle(row));
    const text = normalizeComparable(row?.innerText || '');
    const attrs = Array.from(row?.querySelectorAll?.('[aria-label], [title], [data-testid], [data-icon]') || [])
      .map((node) => [
        node.getAttribute('aria-label') || '',
        node.getAttribute('title') || '',
        node.getAttribute('data-testid') || '',
        node.getAttribute('data-icon') || ''
      ].join(' '))
      .join(' ');
    const normalizedAttrs = normalizeComparable(attrs);

    if (/^(archivados|archived)$/.test(title)) return true;
    if (/\b(archivados|archived)\b/.test(normalizedAttrs)) return true;

    const lines = String(row?.innerText || '').split('\n').map((line) => normalizeComparable(line)).filter(Boolean);
    if (lines.some((line) => /^(archivados|archived)$/.test(line))) return true;

    return false;
  }

  function isArchiveViewActive() {
    const side = document.querySelector('#side');
    if (!side) return false;

    const headerText = normalizeComparable(side.querySelector('header')?.innerText || '');
    if (/^(archivados|archived)\b/.test(headerText)) return true;

    const headings = Array.from(side.querySelectorAll('[role="heading"], h1, h2, [aria-label], [title]'));
    return headings.some((node) => {
      const value = normalizeComparable(`${node.innerText || ''} ${node.getAttribute?.('aria-label') || ''} ${node.getAttribute?.('title') || ''}`);
      return /^(archivados|archived)$/.test(value);
    });
  }

  function isCurrentChatArchivedContext() {
    if (isArchiveViewActive()) return true;

    const main = document.querySelector('main');
    if (!main) return false;

    return Array.from(main.querySelectorAll('[aria-label], [title], [data-testid], [data-icon]')).some((node) => {
      const value = normalizeComparable(`${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''} ${node.getAttribute('data-testid') || ''} ${node.getAttribute('data-icon') || ''}`);
      return /\b(archivado|archivados|archived)\b/.test(value);
    });
  }

  function isCurrentChatProbablyGroup(chat) {
    const contactName = normalizeComparable(chat?.contactName || getContactName());
    const header = getMainChatHeader();
    const headerText = header?.innerText || '';
    const headerComparable = normalizeComparable(headerText);

    if (/\b(grupo|group|participantes|participants|miembros|members)\b/.test(headerComparable)) return true;
    if (/\b(familia|llamadas|grupo|team|equipo|clientes|ventas|soporte|comercial|comunidad)\b/.test(contactName)) return true;

    const headerLines = headerText.split('\n').map((line) => line.trim()).filter(Boolean);
    if (headerLines.length > 1) {
      const subtitle = normalizeComparable(headerLines.slice(1).join(' '));
      if (subtitle.includes(',') || /\b(participantes|participants|miembros|members)\b/.test(subtitle)) return true;
    }

    const senderNames = new Set();
    for (const node of Array.from(document.querySelectorAll('main [data-pre-plain-text]')).slice(-16)) {
      const raw = node.getAttribute('data-pre-plain-text') || '';
      const match = raw.match(/\]\s*([^:\]]{2,80}):\s*$/);
      const sender = normalizeComparable(match?.[1] || '');
      if (!sender) continue;
      senderNames.add(sender);
    }

    if (senderNames.size >= 2) return true;
    if (senderNames.size === 1) {
      const [sender] = Array.from(senderNames);
      if (contactName && sender && sender !== contactName && !contactName.includes(sender) && !sender.includes(contactName)) {
        const titleLooksLikeGroup = /\b(grupo|team|equipo|familia|clientes|ventas|soporte|comercial)\b/.test(contactName);
        if (titleLooksLikeGroup) return true;
      }
    }

    return false;
  }

  function isProbablyGroupRow(row, contactName) {
    const title = String(contactName || '');
    const text = String(row.innerText || '');
    const snippet = getChatRowSnippet(row, contactName);
    const attrText = Array.from(row.querySelectorAll('[aria-label], [title]'))
      .map((node) => `${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''}`)
      .join(' ');

    const comparableTitle = normalizeComparable(title);
    if (/\b(?:grupo|group|participantes|participants|miembros|members)\b/i.test(attrText)) return true;
    if (/\b(?:grupo|group|familia|llamadas|comunidad|communities|team|equipo|clientes|ventas|soporte|comercial)\b/i.test(title)) return true;
    if (/\b(familia|llamadas|grupo|team|equipo|clientes|ventas|soporte|comercial|comunidad)\b/.test(comparableTitle)) return true;
    if (/\b(?:Tú|Tu|You|Yo):\s/.test(text)) return true;
    if (/^[^\n:]{1,80}:\s/.test(snippet)) return true;
    if ((title.match(/,/g) || []).length >= 1 && title.length > 12) return true;

    const possibleParticipantPreview = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .some((line) => /^[^:]{2,50}:\s.+/.test(line));
    if (possibleParticipantPreview) return true;

    return false;
  }

  function clickChatRow(row, options = {}) {
    const rect = row.getBoundingClientRect();
    const x = Math.max(rect.left + 72, Math.min(rect.right - 90, rect.left + Math.min(280, rect.width * 0.48)));
    const y = rect.top + Math.max(28, Math.min(rect.height - 14, rect.height / 2));

    const frame = row.querySelector('[data-testid="cell-frame-container"]');
    const gridCell = row.querySelector('[role="gridcell"][tabindex], [role="gridcell"]');
    const ariaSelected = row.querySelector('[aria-selected]');
    const tabStop = row.querySelector('[tabindex="0"], [tabindex="-1"]');
    const atPoint = document.elementFromPoint(x, y);

    const candidates = [
      atPoint,
      frame,
      gridCell,
      ariaSelected,
      tabStop,
      row
    ].filter(Boolean);

    const seen = new Set();
    for (const raw of candidates) {
      const target = raw.closest?.('[data-testid="cell-frame-container"], [role="gridcell"], [aria-selected], [role="button"], a, button, [tabindex]') || raw;
      if (!target || seen.has(target)) continue;
      seen.add(target);
      fireChatActivation(target, x, y, options);
    }
  }

  function fireChatActivation(target, x, y, options = {}) {
    try {
      target.scrollIntoView?.({ block: 'nearest' });
      target.focus?.({ preventScroll: true });
    } catch (error) {
      // Continuar con los eventos.
    }

    const common = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y };
    const pointerCommon = {
      ...common,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      buttons: 1,
      button: 0
    };

    try {
      if (typeof PointerEvent === 'function') {
        target.dispatchEvent(new PointerEvent('pointerover', pointerCommon));
        target.dispatchEvent(new PointerEvent('pointerenter', pointerCommon));
        target.dispatchEvent(new PointerEvent('pointerdown', pointerCommon));
      }
      target.dispatchEvent(new MouseEvent('mouseover', common));
      target.dispatchEvent(new MouseEvent('mouseenter', common));
      target.dispatchEvent(new MouseEvent('mousedown', { ...common, buttons: 1, button: 0 }));
      if (typeof PointerEvent === 'function') target.dispatchEvent(new PointerEvent('pointerup', pointerCommon));
      target.dispatchEvent(new MouseEvent('mouseup', { ...common, button: 0 }));
      target.dispatchEvent(new MouseEvent('click', { ...common, button: 0, detail: 1 }));
      target.click?.();

      if (options.strong) {
        target.dispatchEvent(new MouseEvent('dblclick', { ...common, button: 0, detail: 2 }));
        for (const key of ['Enter', ' ']) {
          target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, composed: true, key, code: key === 'Enter' ? 'Enter' : 'Space', which: key === 'Enter' ? 13 : 32, keyCode: key === 'Enter' ? 13 : 32 }));
          target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, composed: true, key, code: key === 'Enter' ? 'Enter' : 'Space', which: key === 'Enter' ? 13 : 32, keyCode: key === 'Enter' ? 13 : 32 }));
        }
      }
    } catch (error) {
      // Probar el siguiente candidato.
    }
  }

  function isChatRowSelected(row) {
    if (!row) return false;
    if (row.getAttribute?.('aria-selected') === 'true') return true;
    return Boolean(row.querySelector?.('[aria-selected="true"]'));
  }

  function getCurrentChatSignature() {
    const chat = extractCurrentChat();
    const last = chat.messages[chat.messages.length - 1];
    return `${chat.contactName}|${chat.messages.length}|${last?.direction || ''}|${String(last?.text || '').slice(-100)}`;
  }

  function normalizeComparable(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[\s​‌‍]+/g, ' ')
      .trim();
  }

  function looksLikeOnlyTime(text) {
    return /^\d{1,2}:\d{2}(?:\s?[ap]\.?\s?m\.?)?$/i.test(String(text || '').trim())
      || /^(?:ayer|yesterday|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(String(text || '').trim());
  }

  function rememberUnreadKey(key, ttlMs) {
    recentUnreadKeys.set(key, Date.now() + ttlMs);
  }

  function isRecentUnreadKey(key) {
    pruneRecentUnreadKeys();
    return recentUnreadKeys.has(key);
  }

  function pruneRecentUnreadKeys() {
    const now = Date.now();
    for (const [key, until] of recentUnreadKeys.entries()) {
      if (!until || until <= now) recentUnreadKeys.delete(key);
    }
  }


  function getLatestIncomingInfo(chat) {
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    let incomingCount = 0;
    let latest = null;

    messages.forEach((message, index) => {
      if (message?.direction !== 'in') return;
      incomingCount += 1;
      latest = { message, index, incomingCount };
    });

    return latest;
  }

  function hasOutgoingAfterIndex(messages, index) {
    if (!Array.isArray(messages) || index < 0) return false;
    return messages.slice(index + 1).some((message) => message?.direction === 'out' && String(message.text || '').trim().length > 0);
  }

  function buildIncomingReplyKey(chat, incomingInfo) {
    const message = incomingInfo?.message || {};
    const contact = normalizeComparable(
      chat?.chatId || chat?.contactWhatsapp || chat?.contactName || 'contacto'
    );
    const text = normalizeForDuplicateCompare(message.text || '').slice(-320);
    const stableMessageId = String(message.messageId || '').trim();
    const stableTimestamp = String(message.timestamp || '').trim();

    // La cantidad de mensajes visibles NO es estable: WhatsApp virtualiza y
    // rehidrata el DOM. Por eso nunca forma parte de la clave de idempotencia.
    // Priorizamos el ID real del mensaje; luego la fecha/hora de data-pre-plain-text.
    if (stableMessageId) return `${contact}|id:${stableMessageId}`;
    if (stableTimestamp) return `${contact}|ts:${stableHash(`${stableTimestamp}|${text}`)}`;

    // Fallback para builds donde WhatsApp no expone ID ni timestamp. Se incluye
    // un pequeño contexto previo para permitir que el cliente repita el mismo
    // texto más adelante sin confundirlo con el mensaje ya respondido.
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    const index = Number(incomingInfo?.index ?? messages.length - 1);
    const context = messages
      .slice(Math.max(0, index - 2), index + 1)
      .map((item) => [
        item?.direction || '',
        item?.messageId || '',
        item?.timestamp || '',
        normalizeForDuplicateCompare(item?.text || '').slice(-180)
      ].join('|'))
      .join('||');

    return `${contact}|fallback:${stableHash(context || text)}`;
  }

  function stableHash(value) {
    const text = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function loadRepliedIncomingMap() {
    try {
      const raw = window.localStorage.getItem(REPLIED_INCOMING_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveRepliedIncomingMap(map) {
    try {
      window.localStorage.setItem(REPLIED_INCOMING_KEY, JSON.stringify(map || {}));
    } catch (error) {
      // localStorage puede estar bloqueado; en ese caso seguimos con el lock de instancia.
    }
  }

  function pruneRepliedIncomingMap(map = loadRepliedIncomingMap()) {
    const now = Date.now();
    let changed = false;

    for (const [key, value] of Object.entries(map)) {
      if (!value?.until || Number(value.until) <= now) {
        delete map[key];
        changed = true;
      }
    }

    if (changed) saveRepliedIncomingMap(map);
    return map;
  }

  function getIncomingReplyState(incomingKey) {
    if (!incomingKey) return null;
    const map = pruneRepliedIncomingMap();
    const state = map[incomingKey] || null;
    if (!state?.until || Number(state.until) <= Date.now()) return null;
    return state;
  }

  function wasIncomingAlreadyReplied(incomingKey) {
    const state = getIncomingReplyState(incomingKey);
    return Boolean(state && ['processing', 'sent'].includes(String(state.status || 'sent')));
  }

  function rememberIncomingProcessing(incomingKey, contactName, messageText, metadata = {}) {
    if (!incomingKey) return;
    const map = pruneRepliedIncomingMap();
    map[incomingKey] = {
      status: 'processing',
      contactName: String(contactName || ''),
      preview: String(messageText || '').replace(/\s+/g, ' ').trim().slice(0, 220),
      messageId: String(metadata.messageId || ''),
      timestamp: String(metadata.timestamp || ''),
      startedAt: Date.now(),
      // Evita que otra instancia/extensión vuelva a procesar el mismo mensaje
      // mientras LM Studio aún está respondiendo.
      until: Date.now() + 5 * 60 * 1000
    };
    saveRepliedIncomingMap(map);
  }

  function rememberRepliedIncoming(incomingKey, contactName, messageText, details = {}) {
    if (!incomingKey) return;
    const map = pruneRepliedIncomingMap();
    map[incomingKey] = {
      status: 'sent',
      contactName: String(contactName || ''),
      preview: String(messageText || '').replace(/\s+/g, ' ').trim().slice(0, 220),
      answerPreview: String(details.answer || '').replace(/\s+/g, ' ').trim().slice(0, 320),
      mediaKeys: Array.isArray(details.mediaKeys) ? details.mediaKeys.slice(0, 8) : [],
      messageId: String(details.messageId || ''),
      timestamp: String(details.timestamp || ''),
      repliedAt: Date.now(),
      until: Date.now() + Number(settings.repliedIncomingTtlMs || DEFAULTS.repliedIncomingTtlMs)
    };
    saveRepliedIncomingMap(map);
  }

  function clearIncomingProcessing(incomingKey) {
    if (!incomingKey) return;
    const map = pruneRepliedIncomingMap();
    if (map[incomingKey]?.status === 'processing') {
      delete map[incomingKey];
      saveRepliedIncomingMap(map);
    }
  }

  function getChatQuietKey(contactName) {
    return normalizeComparable(contactName || 'contacto').slice(0, 140);
  }

  function loadAwaitingCustomerMap() {
    try {
      const raw = window.localStorage.getItem(AWAITING_CUSTOMER_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveAwaitingCustomerMap(map) {
    try {
      window.localStorage.setItem(AWAITING_CUSTOMER_KEY, JSON.stringify(map || {}));
    } catch (error) {
      // localStorage puede estar bloqueado; seguimos con locks en memoria.
    }
  }

  function pruneAwaitingCustomerMap(map = loadAwaitingCustomerMap()) {
    const now = Date.now();
    let changed = false;

    for (const [key, value] of Object.entries(map)) {
      if (!value?.until || Number(value.until) <= now) {
        delete map[key];
        changed = true;
      }
    }

    if (changed) saveAwaitingCustomerMap(map);
    return map;
  }

  function getAwaitingCustomerState(contactName) {
    const contactKey = getChatQuietKey(contactName || '');
    if (!contactKey) return null;
    const map = pruneAwaitingCustomerMap();
    return map[contactKey] || null;
  }

  function rememberAwaitingCustomerReply(chat, incomingInfo, answer, incomingKey) {
    const contactKey = getChatQuietKey(chat?.contactName || '');
    if (!contactKey) return;

    const map = pruneAwaitingCustomerMap();
    const incomingText = String(incomingInfo?.message?.text || '').replace(/\s+/g, ' ').trim();
    const answerText = String(answer || '').replace(/\s+/g, ' ').trim();

    map[contactKey] = {
      contactName: String(chat?.contactName || ''),
      lastIncomingKey: String(incomingKey || buildIncomingReplyKey(chat, incomingInfo) || ''),
      lastIncomingNorm: normalizeForDuplicateCompare(incomingText),
      lastIncomingPreview: incomingText.slice(0, 180),
      lastIncomingCount: Number(incomingInfo?.incomingCount || 0),
      lastAnswerNorm: normalizeForDuplicateCompare(answerText),
      lastAnswerPreview: answerText.slice(0, 220),
      sentAt: Date.now(),
      // Ventana corta solo anti-rafaga DOM. No impide responder si llega un texto humano nuevo,
      // porque evaluateChatQuietState permite continuar cuando cambia el ultimo entrante.
      minQuietUntil: Date.now() + 2500,
      until: Date.now() + Number(settings.repliedIncomingTtlMs || DEFAULTS.repliedIncomingTtlMs)
    };

    saveAwaitingCustomerMap(map);
  }

  function clearAwaitingCustomerReply(contactName) {
    const contactKey = getChatQuietKey(contactName || '');
    if (!contactKey) return;
    const map = pruneAwaitingCustomerMap();
    if (map[contactKey]) {
      delete map[contactKey];
      saveAwaitingCustomerMap(map);
    }
  }

  function evaluateChatQuietState(chat, incomingInfo, lastText, incomingKey) {
    const contactKey = getChatQuietKey(chat?.contactName || '');
    if (!contactKey) return { block: false };

    const map = pruneAwaitingCustomerMap();
    const state = map[contactKey];
    if (!state) return { block: false };

    const latestNorm = normalizeForDuplicateCompare(lastText || '');
    const lastAnswerNorm = String(state.lastAnswerNorm || '');
    const lastIncomingKey = String(state.lastIncomingKey || '');

    // Regla v25:
    // - No filtramos por pregunta, saludo ni intención: cualquier mensaje entrante nuevo responde.
    // - Solo bloqueamos el mismo mensaje exacto ya respondido, usando incomingKey.
    // - Si WhatsApp rehidrata nuestra respuesta como si fuera entrante, la bloqueamos por similitud.
    // - No bloqueamos por conteo ni por texto repetido, porque el cliente puede escribir otro mensaje
    //   corto o parecido y aun así debe recibir respuesta.

    if (lastAnswerNorm && areNormalizedTextsClose(latestNorm, lastAnswerNorm)) {
      return {
        block: true,
        message: `Automático tranquilo: el último texto parece ser mi propia respuesta en ${chat.contactName}. No la repito.`
      };
    }

    if (lastIncomingKey && incomingKey && lastIncomingKey === incomingKey) {
      return {
        block: true,
        message: `Automático tranquilo: ya respondí este mismo mensaje de ${chat.contactName}. Espero cualquier mensaje nuevo.`
      };
    }

    // Llegó cualquier mensaje entrante nuevo: limpiamos el estado y permitimos responder.
    clearAwaitingCustomerReply(chat?.contactName || '');
    return { block: false };
  }

  function areNormalizedTextsClose(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (!left || !right) return false;
    if (left === right) return true;

    const min = Math.min(left.length, right.length);
    const max = Math.max(left.length, right.length);
    if (min >= 24 && (left.includes(right.slice(0, Math.min(90, right.length))) || right.includes(left.slice(0, Math.min(90, left.length))))) return true;

    // Comparacion por tokens para variaciones pequeñas del mismo saludo comercial.
    const tokenSet = (value) => new Set(String(value || '').match(/[a-záéíóúñ0-9]{4,}/gi) || []);
    const A = tokenSet(left);
    const B = tokenSet(right);
    if (A.size < 4 || B.size < 4) return false;
    let common = 0;
    for (const token of A) if (B.has(token)) common += 1;
    const ratio = common / Math.max(A.size, B.size);
    return max >= 40 && ratio >= 0.72;
  }

  function requestAnswer(chat, trace = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'MIGO_WA_AI_GENERATE',
          payload: {
            ...chat,
            trace: { ...trace },
            debugId: activeDebugId || `debug-${Date.now()}`
          }
        },
        (response) => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message || 'No se pudo conectar con la extensión.'));
            return;
          }

          if (!response?.ok) {
            reject(new Error(response?.error || 'No se pudo generar la respuesta.'));
            return;
          }

          resolve(response);
        }
      );
    });
  }


  function runLmStudioTest() {
    const panel = ensurePanel();
    const prompt = String(panel.querySelector('[data-role="testPrompt"]')?.value || '').trim()
      || 'Hola, responde únicamente un JSON válido con {"answer":"conexión OK"}.';

    activeDebugId = `manual-test-${Date.now()}`;
    logDebug('PRUEBA MANUAL: CONECTANDO CON EL HUB', { debugId: activeDebugId });
    appendDebugLog({
      id: activeDebugId,
      ts: Date.now(),
      label: 'PRUEBA MANUAL INICIADA',
      data: {
        prompt,
        nota: 'Esta prueba no lee WhatsApp ni envía mensajes. Consulta LM Studio a través del Hub y del agente local.'
      }
    });

    const status = panel.querySelector('[data-role="status"]');
    setStatus(status, 'Probando Hub, agente y LM Studio...', false);

    chrome.runtime.sendMessage(
      { type: 'MIGO_WA_AI_TEST_LM_STUDIO', payload: { debugId: activeDebugId, prompt } },
      (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          logDebug('ERROR CHROME RUNTIME', error.message || String(error), activeDebugId);
          setStatus(status, 'No se pudo comunicar con el service worker de la extensión.', true);
          return;
        }

        if (!response?.ok) {
          logDebug('PRUEBA MANUAL FALLO', response?.error || 'Error desconocido', activeDebugId);
          setStatus(status, response?.error || 'No se pudo completar la ruta Hub → agente → LM Studio.', true);
          return;
        }

        const answer = response?.result?.answer || '';
        if (answer) {
          lastAnswer = answer;
          const answerBox = panel.querySelector('[data-role="answer"]');
          if (answerBox) answerBox.value = answer;
        }
        logDebug('PRUEBA MANUAL COMPLETADA', response.result, activeDebugId);
        setStatus(status, 'Prueba completada. Revisa el <pre> de Intercambio con LM Studio.', false);
      }
    );
  }

  function getMainChatRoot() {
    const main = document.querySelector('#main') || document.querySelector('main');
    if (main && !main.closest('#side')) return main;

    const candidates = Array.from(document.querySelectorAll('[role="application"], div'))
      .filter((node) => node instanceof Element && !node.closest('#side'))
      .filter((node) => node.querySelector?.('div.message-in, div.message-out, footer [contenteditable="true"]'));

    return candidates[0] || null;
  }

  function getMainChatHeader() {
    const main = getMainChatRoot();
    if (!main) return null;

    const headers = Array.from(main.querySelectorAll('header'))
      .filter((header) => !header.closest('#side') && isVisible(header));

    return headers[0] || null;
  }

  function extractCurrentChat() {
    const contactName = getContactName();
    const main = getMainChatRoot() || document;
    const nodes = Array.from(main.querySelectorAll('div.message-in, div.message-out'));
    let messages = nodes.map((node) => {
      const direction = node.classList.contains('message-out') ? 'out' : 'in';
      const text = extractTextFromMessageNode(node);
      const metadata = extractMessageMetadata(node);
      return { direction, text, ...metadata };
    }).filter((item) => item.text && item.text.length > 0);

    if (!messages.length) messages = extractFallbackMessages();

    const identity = getCurrentChatIdentity(main);

    return {
      contactName,
      contactWhatsapp: identity.whatsapp,
      chatId: identity.chatId,
      messages: dedupeMessages(messages).slice(-24)
    };
  }

  function extractMessageMetadata(node) {
    const idCandidates = [
      node?.getAttribute?.('data-id'),
      node?.dataset?.id,
      node?.querySelector?.('[data-id]')?.getAttribute?.('data-id'),
      node?.closest?.('[data-id]')?.getAttribute?.('data-id')
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    const prePlainNode = node?.querySelector?.('[data-pre-plain-text]')
      || (node?.hasAttribute?.('data-pre-plain-text') ? node : null);
    const timestamp = String(prePlainNode?.getAttribute?.('data-pre-plain-text') || '').trim();

    // data-id suele contener el identificador real de WhatsApp. Evitamos IDs
    // de controles genéricos y tomamos el candidato más específico/largo.
    const messageId = idCandidates
      .filter((value) => {
        // Un JID puro identifica el chat, no el mensaje. Solo aceptamos IDs que
        // contienen el componente único del mensaje de WhatsApp.
        return /^(?:true|false)_/i.test(value)
          || /(?:^|_)(?:3EB|[A-F0-9]{16,})(?:_|$)/i.test(value)
          || /@(?:c\.us|s\.whatsapp\.net)_[A-F0-9-]{8,}/i.test(value);
      })
      .sort((a, b) => b.length - a.length)[0]
      || '';

    return { messageId, timestamp };
  }

  function getCurrentChatIdentity(mainRoot) {
    const main = mainRoot || getMainChatRoot() || document;
    const candidates = [];

    const collect = (value) => {
      const text = String(value || '').trim();
      if (text) candidates.push(text);
    };

    const header = getMainChatHeader();
    const scopes = [header, main].filter(Boolean);
    const attributes = ['data-id', 'data-jid', 'data-user', 'data-contact-id', 'data-testid', 'title', 'aria-label', 'href'];

    for (const scope of scopes) {
      collect(scope.getAttribute?.('data-id'));
      collect(scope.getAttribute?.('data-jid'));
      collect(scope.getAttribute?.('aria-label'));

      const nodes = Array.from(scope.querySelectorAll?.('[data-id], [data-jid], [data-user], [data-contact-id], [href], [title], [aria-label]') || []);
      for (const node of nodes.slice(0, 500)) {
        for (const attribute of attributes) collect(node.getAttribute?.(attribute));
      }
    }

    // Los IDs de mensajes de WhatsApp suelen contener el JID real, incluso
    // cuando el encabezado muestra el nombre guardado del contacto.
    for (const node of Array.from(main.querySelectorAll?.('div.message-in, div.message-out, [data-id]') || []).slice(-80)) {
      collect(node.getAttribute?.('data-id'));
      collect(node.dataset?.id);
      collect(node.closest?.('[data-id]')?.getAttribute?.('data-id'));
    }

    for (const raw of candidates) {
      const decoded = safeDecodeURIComponent(raw);
      const jidMatch = decoded.match(/(?:^|[^0-9])(\d{7,15})@(c\.us|s\.whatsapp\.net)(?:[^a-z]|$)/i);
      if (jidMatch) {
        return {
          whatsapp: jidMatch[1],
          chatId: `${jidMatch[1]}@${jidMatch[2].toLowerCase()}`
        };
      }
    }

    // Fallback para chats cuyo título visible es directamente un teléfono.
    const visible = String(getContactName() || '');
    const phone = normalizeWhatsappNumber(visible);
    return {
      whatsapp: phone,
      chatId: phone ? `${phone}@c.us` : ''
    };
  }

  function safeDecodeURIComponent(value) {
    try {
      return decodeURIComponent(String(value || ''));
    } catch (_) {
      return String(value || '');
    }
  }

  function normalizeWhatsappNumber(value) {
    const digits = String(value || '').replace(/\D+/g, '');
    return digits.length >= 7 && digits.length <= 15 ? digits : '';
  }

  function getContactName() {
    const header = getMainChatHeader();
    if (!header) return '';

    const isBadHeaderText = (text) => /(?:detalles\s+del\s+perfil|profile\s+details|informaci[oó]n\s+del\s+contacto|contact\s+info|buscar|search|llamada|call|videollamada|video|men[uú]|menu|m[aá]s\s+opciones|more\s+options|a[nñ]adir\s+a\s+la\s+lista|add\s+to\s+list)/i.test(String(text || ''));

    const preferredSelectors = [
      '[data-testid="conversation-info-header-chat-title"]',
      '[data-testid="conversation-info-header"] [dir="auto"]',
      '[data-testid="conversation-info-header"] span',
      'span[dir="auto"]'
    ];

    for (const selector of preferredSelectors) {
      const candidates = Array.from(header.querySelectorAll(selector))
        .map((node) => cleanMessageText(node.innerText || node.textContent || node.getAttribute?.('title') || ''))
        .filter(Boolean)
        .filter((text) => !isBadHeaderText(text));
      if (candidates.length) return candidates[0];
    }

    const titleCandidates = Array.from(header.querySelectorAll('[title]'))
      .map((node) => cleanMessageText(node.getAttribute('title') || ''))
      .filter(Boolean)
      .filter((text) => !isBadHeaderText(text));

    if (titleCandidates.length) return titleCandidates[0];

    const lines = String(header.innerText || '')
      .split('\n')
      .map((line) => cleanMessageText(line))
      .filter(Boolean)
      .filter((line) => !isBadHeaderText(line))
      .filter((line) => !/(?:en linea|online|escribiendo|typing|haz clic|click here)/i.test(line));

    return lines[0] || '';
  }

  function extractTextFromMessageNode(node) {
    const skipped = ['svg', 'button', 'time'];
    const candidates = Array.from(node.querySelectorAll('span.selectable-text, div.copyable-text, [data-pre-plain-text]'));
    const parts = candidates
      .map((item) => {
        const clone = item.cloneNode(true);
        for (const tag of skipped) clone.querySelectorAll?.(tag).forEach((n) => n.remove());
        return clone.innerText || clone.textContent || '';
      })
      .map(cleanMessageText)
      .filter(Boolean);

    if (parts.length) return parts.join(' ').trim();

    return cleanMessageText(node.innerText || node.textContent || '');
  }

  function extractFallbackMessages() {
    const main = getMainChatRoot() || document.body;
    return Array.from(main.querySelectorAll('[data-pre-plain-text]'))
      .map((node) => ({
        direction: node.closest('.message-out') ? 'out' : 'in',
        text: cleanMessageText(node.innerText || node.textContent || ''),
        ...extractMessageMetadata(node.closest('.message-in, .message-out') || node)
      }))
      .filter((item) => item.text);
  }

  function cleanMessageText(text) {
    const value = String(text || '')
      .split('\n')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !/^\d{1,2}:\d{2}(?:\s?[ap]\.\s?m\.)?$/i.test(part))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return collapseRepeatedText(value);
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

  function isUnsafeAnswer(text) {
    const value = String(text || '')
      .replace(/^```(?:text|markdown|json)?/i, '')
      .replace(/^[\s"'“”`*_#>-]+/, '')
      .trim();

    return /^(?:\d+[\).:-]?\s*)?(?:thinking\s+process|thought\s+process|reasoning\s+process|chain\s+of\s+thought|analysis|reasoning|thought|thinking|razonamiento|pensamiento|proceso\s+de\s+pensamiento)(?:\b|\s*:|\s*-|\s*\d)/i.test(value);
  }

  function dedupeMessages(messages) {
    const result = [];
    const seenStableIds = new Set();
    let previousFallbackKey = '';

    for (const message of messages) {
      const stableId = String(message?.messageId || '').trim();
      const timestamp = String(message?.timestamp || '').trim();
      const fallbackKey = `${message?.direction || ''}:${timestamp}:${message?.text || ''}`;

      if (stableId) {
        if (seenStableIds.has(stableId)) continue;
        seenStableIds.add(stableId);
        result.push(message);
        previousFallbackKey = fallbackKey;
        continue;
      }

      // Solo colapsamos nodos consecutivos idénticos cuando no existe ID real.
      if (fallbackKey !== previousFallbackKey) result.push(message);
      previousFallbackKey = fallbackKey;
    }

    return result;
  }

  function buildMessageKey(chat, message) {
    const text = String(message.text || '').replace(/\s+/g, ' ').trim();
    return `${chat.contactName}|${chat.messages.length}|${text.slice(-180)}`;
  }

  function findComposer() {
    const main = getMainChatRoot();
    const footer = main?.querySelector('footer') || document.querySelector('footer') || document.body;
    const selectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-tab]',
      '[contenteditable="true"]'
    ];

    for (const selector of selectors) {
      const items = Array.from(footer.querySelectorAll(selector));
      const visible = items.find((item) => isVisible(item));
      if (visible) return visible;
    }

    return null;
  }

  function focusAndInsert(input, text) {
    replaceComposerText(input, text);

    // WhatsApp Web puede duplicar el contenido si recibe varios eventos del editor
    // o si quedan dos versiones de la extension activas. Normalizamos en diferido.
    setTimeout(() => normalizeComposerText(input, text), 80);
    setTimeout(() => normalizeComposerText(input, text), 220);
  }

  function replaceComposerText(input, text) {
    input.focus();

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(input),
        'value'
      )?.set;
      if (nativeSetter) nativeSetter.call(input, text);
      else input.value = text;
    } else {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(input);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, text);
      } catch (error) {
        input.textContent = text;
      }
    }

    // No enviamos data=text porque en algunos builds de WhatsApp termina duplicando.
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: null }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function getComposerText(input) {
    return cleanMessageText(input?.innerText || input?.textContent || '');
  }

  function normalizeForDuplicateCompare(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[\s\u200b\u200c\u200d]+/g, '')
      .replace(/["'“”‘’`´]+/g, '')
      .trim();
  }

  function isDuplicatedComposerText(currentText, expectedText) {
    const current = normalizeForDuplicateCompare(currentText);
    const expected = normalizeForDuplicateCompare(expectedText);
    if (!current || !expected) return false;
    return current === `${expected}${expected}` || current === normalizeForDuplicateCompare(`${expected} ${expected}`);
  }

  function normalizeComposerText(input, expectedText) {
    if (!input || !expectedText) return;
    const currentText = getComposerText(input);
    if (isDuplicatedComposerText(currentText, expectedText)) {
      replaceComposerText(input, expectedText);
    }
  }

  function fetchMediaFromBackground(url) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'MIGO_WA_AI_FETCH_MEDIA', url }, (response) => {
        const error = chrome.runtime.lastError;
        if (error) return reject(new Error(error.message || 'No se pudo descargar la imagen.'));
        if (!response?.ok) return reject(new Error(response?.error || 'No se pudo descargar la imagen.'));
        resolve(response.result);
      });
    });
  }

  function dataUrlToFile(dataUrl, filename, mimeType) {
    const base64 = String(dataUrl || '').split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mimeType || 'image/jpeg' });
  }

  function buildMediaCaption(explicitCaption, mediaItems, fallbackAnswer = '') {
    const explicit = collapseRepeatedText(String(explicitCaption || '').trim());
    if (explicit) return explicit.slice(0, 700);

    const media = normalizeMediaItemsForSend(mediaItems);
    const labels = [];
    const seenProducts = new Set();
    for (const item of media) {
      const productName = String(item?.productName || item?.name || '').trim();
      const label = String(item?.caption || item?.description || productName || '').trim();
      const key = normalizeComparable(productName || label);
      if (!key || seenProducts.has(key)) continue;
      seenProducts.add(key);
      labels.push(label);
    }

    if (labels.length === 1) {
      const imageWord = media.length === 1 ? 'una foto' : `${media.length} fotos`;
      return `Sí 😊 Mira ${labels[0]}. Te comparto ${imageWord} del modelo.`.slice(0, 700);
    }
    if (labels.length > 1) {
      return `Sí 😊 Mira estas opciones: ${labels.slice(0, 3).join('; ')}. Te comparto una foto de cada modelo.`.slice(0, 700);
    }

    return collapseRepeatedText(String(fallbackAnswer || '').trim()).slice(0, 700);
  }

  function canonicalizeMediaUrl(url) {
    return String(url || '')
      .trim()
      .replace(/[?#].*$/, '')
      .replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, '')
      .toLowerCase();
  }

  function getMediaDedupKey(media) {
    const url = canonicalizeMediaUrl(media?.url || '');
    if (url) return `url:${url}`;

    const dataUrl = String(media?.dataUrl || '');
    if (/^data:image\//i.test(dataUrl)) {
      return `data:${stableHash(dataUrl.slice(0, 4000))}`;
    }

    return '';
  }

  function normalizeMediaItemsForSend(value) {
    const items = Array.isArray(value) ? value : [];
    const seen = new Set();
    const result = [];

    for (const media of items) {
      if (!media || media.type !== 'image') continue;
      const key = getMediaDedupKey(media);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(media);
      if (result.length >= 3) break;
    }

    return result;
  }

  async function mediaItemToFile(media, index) {
    const directDataUrl = typeof media?.dataUrl === 'string' && /^data:image\//i.test(media.dataUrl)
      ? media.dataUrl
      : '';
    if (!directDataUrl && !media?.url) return null;

    const downloaded = directDataUrl
      ? {
          dataUrl: directDataUrl,
          mimeType: String(media.mimeType || directDataUrl.match(/^data:([^;,]+)/i)?.[1] || 'image/jpeg')
        }
      : await fetchMediaFromBackground(media.url);

    const normalizedMime = String(downloaded.mimeType || '').toLowerCase();
    const extension = normalizedMime.includes('png')
      ? 'png'
      : normalizedMime.includes('webp')
        ? 'webp'
        : normalizedMime.includes('gif')
          ? 'gif'
          : normalizedMime.includes('bmp')
            ? 'bmp'
            : normalizedMime.includes('svg')
              ? 'svg'
              : 'jpg';
    const requestedFileName = String(media.fileName || '').trim();
    const safeName = String(media.name || requestedFileName.replace(/\.[^.]+$/, '') || `imagen-${index + 1}`)
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || `imagen-${index + 1}`;
    const fileName = requestedFileName || `${safeName}-${index + 1}.${extension}`;
    return dataUrlToFile(downloaded.dataUrl, fileName, downloaded.mimeType);
  }

  async function sendImageAttachments(mediaItems, captionText = '') {
    const media = normalizeMediaItemsForSend(mediaItems);
    const emptyResult = {
      ok: false,
      committed: false,
      sentCount: 0,
      preparedCount: 0,
      failedCount: 0,
      sentMediaKeys: [],
      deliveryState: 'not_sent',
      deliveryMethod: null,
      captionApplied: false,
      warnings: []
    };

    if (!media.length) return { ...emptyResult, error: 'No hay imágenes válidas.' };

    const prepared = [];
    const warnings = [];

    // Una descarga fallida no invalida las demás fotos. Este era uno de los
    // puntos frágiles del flujo anterior: el álbum completo dependía de que las
    // tres URLs respondieran correctamente.
    for (let index = 0; index < media.length; index += 1) {
      try {
        const file = await mediaItemToFile(media[index], index);
        if (!file) {
          warnings.push(`Imagen ${index + 1}: no contiene URL ni dataUrl utilizable.`);
          continue;
        }
        prepared.push({
          media: media[index],
          file,
          key: getMediaDedupKey(media[index]),
          originalIndex: index
        });
      } catch (error) {
        warnings.push(`Imagen ${index + 1}: ${error?.message || String(error || 'no se pudo descargar')}`);
      }
    }

    if (!prepared.length) {
      return {
        ...emptyResult,
        failedCount: media.length,
        warnings,
        error: 'No fue posible descargar ninguna de las imágenes.'
      };
    }

    const safeCaption = collapseRepeatedText(String(captionText || '').trim()).slice(0, 700);

    try {
      // Ruta principal: un solo álbum. Usamos primero el input nativo de
      // WhatsApp, luego drag/drop y por último paste para tolerar cambios de DOM.
      const batchResult = await sendPreparedMediaBatch(prepared, safeCaption);
      if (batchResult.committed) {
        const fullySent = batchResult.sentCount >= prepared.length && prepared.length === media.length;
        return {
          ...batchResult,
          ok: true,
          preparedCount: prepared.length,
          failedCount: Math.max(0, media.length - batchResult.sentCount),
          deliveryState: batchResult.deliveryState === 'ambiguous'
            ? 'ambiguous'
            : fullySent
              ? 'sent'
              : 'partial',
          warnings: [...warnings, ...(batchResult.warnings || [])]
        };
      }

      warnings.push(...(batchResult.warnings || []));
      if (batchResult.error) warnings.push(`Álbum: ${batchResult.error}`);
      await closeMediaEditorSafely();

      // Respaldo robusto: si el álbum ni siquiera llegó a enviarse, probamos
      // cada archivo por separado. La descripción se coloca solo en la primera
      // foto para no repetir el mismo texto varias veces.
      const individual = await sendPreparedMediaIndividually(prepared, safeCaption);
      if (individual.committed) {
        const fullySent = individual.sentCount >= prepared.length && prepared.length === media.length;
        return {
          ...individual,
          ok: true,
          preparedCount: prepared.length,
          failedCount: Math.max(0, media.length - individual.sentCount),
          deliveryState: individual.deliveryState === 'ambiguous'
            ? 'ambiguous'
            : fullySent
              ? 'sent'
              : 'partial',
          warnings: [...warnings, ...(individual.warnings || [])]
        };
      }

      return {
        ...emptyResult,
        preparedCount: prepared.length,
        failedCount: media.length,
        deliveryMethod: individual.deliveryMethod || batchResult.deliveryMethod || null,
        warnings: [...warnings, ...(individual.warnings || [])],
        error: individual.error || batchResult.error || 'WhatsApp no abrió el editor multimedia.'
      };
    } catch (error) {
      await closeMediaEditorSafely();
      return {
        ...emptyResult,
        preparedCount: prepared.length,
        failedCount: media.length,
        warnings,
        error: error?.message || String(error || 'Error enviando imágenes.')
      };
    }
  }

  async function sendPreparedMediaBatch(prepared, captionText) {
    const files = prepared.map((item) => item.file);
    const outgoingBefore = countOutgoingMessages();
    const opened = await openMediaEditorWithFiles(files);
    if (!opened.ok) {
      return {
        ok: false,
        committed: false,
        sentCount: 0,
        sentMediaKeys: [],
        deliveryState: 'not_sent',
        deliveryMethod: opened.method || null,
        captionApplied: false,
        warnings: opened.warnings || [],
        error: opened.error || 'No apareció el editor multimedia.'
      };
    }

    const captionApplied = await applyMediaCaption(captionText);
    const sendControl = opened.control || await waitForMediaSendControl(2500);
    if (!sendControl) {
      return {
        ok: false,
        committed: false,
        sentCount: 0,
        sentMediaKeys: [],
        deliveryState: 'not_sent',
        deliveryMethod: opened.method,
        captionApplied,
        warnings: opened.warnings || [],
        error: 'El editor abrió, pero no se encontró el control Enviar.'
      };
    }

    const clicked = activateMediaSendControl(sendControl);
    if (!clicked) {
      return {
        ok: false,
        committed: false,
        sentCount: 0,
        sentMediaKeys: [],
        deliveryState: 'not_sent',
        deliveryMethod: opened.method,
        captionApplied,
        warnings: opened.warnings || [],
        error: 'No fue posible activar el control Enviar.'
      };
    }

    const completion = await waitForMediaSendCompletion(sendControl, outgoingBefore, 9000);
    const keys = prepared.map((item) => item.key).filter(Boolean);
    if (completion.confirmed) {
      return {
        ok: true,
        committed: true,
        sentCount: prepared.length,
        sentMediaKeys: keys,
        deliveryState: 'sent',
        deliveryMethod: `album:${opened.method}`,
        captionApplied,
        warnings: opened.warnings || []
      };
    }

    // Desde este punto ya se produjo un click real sobre Enviar. No se intenta
    // otra ruta ni texto de respaldo porque podría duplicar el álbum.
    return {
      ok: true,
      committed: true,
      sentCount: prepared.length,
      sentMediaKeys: keys,
      deliveryState: 'ambiguous',
      deliveryMethod: `album:${opened.method}`,
      captionApplied,
      warnings: [...(opened.warnings || []), 'El click de envío se ejecutó, pero WhatsApp no confirmó visualmente el cierre del editor.'],
      error: 'Confirmación visual ambigua después de enviar el álbum.'
    };
  }

  async function sendPreparedMediaIndividually(prepared, captionText) {
    const sentMediaKeys = [];
    const warnings = [];
    let captionApplied = false;
    let committed = false;
    let ambiguous = false;
    let lastMethod = null;

    for (let index = 0; index < prepared.length; index += 1) {
      const item = prepared[index];
      const outgoingBefore = countOutgoingMessages();
      const opened = await openMediaEditorWithFiles([item.file]);
      lastMethod = opened.method || lastMethod;

      if (!opened.ok) {
        warnings.push(`Foto ${index + 1}: ${opened.error || 'no abrió el editor multimedia.'}`);
        warnings.push(...(opened.warnings || []));
        await closeMediaEditorSafely();
        continue;
      }

      const shouldApplyCaption = !captionApplied && Boolean(captionText);
      const currentCaptionApplied = shouldApplyCaption
        ? await applyMediaCaption(captionText)
        : false;

      const sendControl = opened.control || await waitForMediaSendControl(2500);
      if (!sendControl) {
        warnings.push(`Foto ${index + 1}: no apareció el control Enviar.`);
        await closeMediaEditorSafely();
        continue;
      }

      if (!activateMediaSendControl(sendControl)) {
        warnings.push(`Foto ${index + 1}: no fue posible activar Enviar.`);
        await closeMediaEditorSafely();
        continue;
      }

      committed = true;
      captionApplied = captionApplied || currentCaptionApplied;
      const completion = await waitForMediaSendCompletion(sendControl, outgoingBefore, 9000);
      if (item.key) sentMediaKeys.push(item.key);

      if (!completion.confirmed) {
        ambiguous = true;
        warnings.push(`Foto ${index + 1}: envío ejecutado con confirmación visual ambigua.`);
        // No seguimos con más archivos si el editor aún podría estar procesando
        // el envío: priorizamos no duplicar ni mezclar imágenes.
        break;
      }

      await sleep(350);
    }

    return {
      ok: committed,
      committed,
      sentCount: sentMediaKeys.length || (committed ? 1 : 0),
      sentMediaKeys,
      deliveryState: ambiguous ? 'ambiguous' : committed ? 'sent' : 'not_sent',
      deliveryMethod: lastMethod ? `individual:${lastMethod}` : 'individual',
      captionApplied,
      warnings,
      error: committed ? null : 'No se pudo enviar ninguna imagen de forma individual.'
    };
  }

  async function openMediaEditorWithFiles(files) {
    const warnings = [];
    const methods = [
      ['file-input', attachFilesUsingNativeInput],
      ['drop', attachFilesUsingDrop],
      ['paste', attachFilesUsingPaste]
    ];

    for (const [method, attach] of methods) {
      try {
        const dispatched = await attach(files);
        if (!dispatched) {
          warnings.push(`${method}: no encontró un destino compatible.`);
          continue;
        }

        const ready = await waitForMediaEditorReady(6500);
        if (ready.ready) {
          return { ok: true, method, control: ready.control || null, warnings };
        }

        warnings.push(`${method}: WhatsApp no mostró el editor dentro del tiempo esperado.`);
      } catch (error) {
        warnings.push(`${method}: ${error?.message || String(error || 'falló el adjunto')}`);
      }
    }

    return {
      ok: false,
      method: null,
      control: null,
      warnings,
      error: 'Ningún método de adjunto abrió el editor multimedia.'
    };
  }

  async function attachFilesUsingNativeInput(files) {
    let input = findImageFileInput();
    if (!input) {
      const attachControl = findAttachControl();
      if (attachControl) {
        activateSimpleControl(attachControl);
        for (let i = 0; i < 20; i += 1) {
          input = findImageFileInput();
          if (input) break;
          await sleep(100);
        }
      }
    }

    if (!input) return false;

    const transfer = createFileTransfer(files);
    try {
      input.files = transfer.files;
    } catch (error) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
      if (descriptor?.set) descriptor.set.call(input, transfer.files);
      else Object.defineProperty(input, 'files', { configurable: true, value: transfer.files });
    }

    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    return true;
  }

  function findImageFileInput() {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'))
      .filter((input) => !input.closest(`#${PANEL_ID}`) && !input.disabled)
      .map((input) => {
        const accept = String(input.getAttribute('accept') || '').toLowerCase();
        let score = 0;
        if (accept.includes('image')) score += 200;
        if (accept.includes('video')) score += 25;
        if (input.multiple) score += 40;
        if (input.closest('footer')) score += 10;
        if (accept.includes('application') && !accept.includes('image')) score -= 150;
        return { input, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    return inputs[0]?.input || null;
  }

  function findAttachControl() {
    const selectors = [
      'button[aria-label*="Adjuntar" i]',
      '[role="button"][aria-label*="Adjuntar" i]',
      'button[aria-label*="Attach" i]',
      '[role="button"][aria-label*="Attach" i]',
      '[data-testid="clip"]',
      '[data-testid*="attach" i]',
      '[data-icon="plus-rounded"]',
      '[data-icon="plus"]',
      '[data-icon="clip"]'
    ];

    const candidates = [];
    const seen = new Set();
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        const control = resolveClickableControl(node);
        if (!control || seen.has(control) || !isVisible(control) || control.closest(`#${PANEL_ID}`)) continue;
        if (control.disabled || control.getAttribute('aria-disabled') === 'true') continue;
        seen.add(control);
        const rect = control.getBoundingClientRect();
        const inFooter = Boolean(control.closest('footer'));
        const score = (inFooter ? 100 : 0) + (rect.top > window.innerHeight * 0.65 ? 40 : 0);
        candidates.push({ control, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.control || null;
  }

  async function attachFilesUsingDrop(files) {
    const composer = findComposer();
    const target = getMainChatRoot() || composer;
    if (!target) return false;

    const transfer = createFileTransfer(files);
    for (const type of ['dragenter', 'dragover', 'drop']) {
      const event = createDataTransferEvent(type, transfer);
      (type === 'drop' ? (composer || target) : target).dispatchEvent(event);
      await sleep(80);
    }
    return true;
  }

  async function attachFilesUsingPaste(files) {
    const composer = findComposer();
    if (!composer) return false;
    composer.focus();
    const transfer = createFileTransfer(files);
    composer.dispatchEvent(createDataTransferEvent('paste', transfer));
    return true;
  }

  function createFileTransfer(files) {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    return transfer;
  }

  function createDataTransferEvent(type, transfer) {
    const common = { bubbles: true, cancelable: true, composed: true };
    try {
      if (type === 'paste' && typeof ClipboardEvent === 'function') {
        return new ClipboardEvent(type, { ...common, clipboardData: transfer });
      }
      if (typeof DragEvent === 'function') {
        return new DragEvent(type, { ...common, dataTransfer: transfer });
      }
    } catch (error) {
      // Algunos builds de Chromium no aceptan dataTransfer en el constructor.
    }

    const event = new Event(type, common);
    Object.defineProperty(event, type === 'paste' ? 'clipboardData' : 'dataTransfer', {
      configurable: true,
      enumerable: true,
      value: transfer
    });
    return event;
  }

  async function waitForMediaEditorReady(timeoutMs = 6500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const control = findMediaEditorSendControl();
      if (control || hasMediaEditorOpen()) return { ready: true, control };
      await sleep(120);
    }
    return { ready: false, control: null };
  }

  async function waitForMediaSendControl(timeoutMs = 2500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const control = findMediaEditorSendControl() || findBottomRightMediaControl();
      if (control) return control;
      await sleep(100);
    }
    return null;
  }

  function hasMediaEditorOpen() {
    const explicit = [
      '[data-testid="media-editor"]',
      '[data-testid*="media-editor" i]',
      '[data-testid*="media-preview" i]',
      '[data-testid="media-caption-input"]'
    ];
    if (explicit.some((selector) => Array.from(document.querySelectorAll(selector)).some(
      (node) => isVisible(node) && !node.closest('.message-in, .message-out') && !node.closest(`#${PANEL_ID}`)
    ))) {
      return true;
    }

    const blobPreview = Array.from(document.querySelectorAll('img[src^="blob:"], video[src^="blob:"]'))
      .find((node) => isVisible(node) && !node.closest('.message-in, .message-out') && !node.closest(`#${PANEL_ID}`));
    if (blobPreview) return true;

    const caption = findMediaCaptionInput(false);
    return Boolean(caption && !caption.closest('footer'));
  }

  async function applyMediaCaption(captionText) {
    const safeCaption = collapseRepeatedText(String(captionText || '').trim()).slice(0, 700);
    if (!safeCaption) return false;

    let captionInput = null;
    for (let i = 0; i < 35; i += 1) {
      captionInput = findMediaCaptionInput();
      if (captionInput) break;
      await sleep(100);
    }
    if (!captionInput) return false;

    replaceComposerText(captionInput, safeCaption);
    await sleep(260);
    const expected = normalizeForDuplicateCompare(safeCaption).slice(0, 80);
    const actual = normalizeForDuplicateCompare(getComposerText(captionInput));
    return Boolean(expected && actual.includes(expected));
  }

  async function sendImageAttachment(media) {
    const result = await sendImageAttachments([media]);
    return result.ok;
  }

  function countOutgoingMessages() {
    const main = getMainChatRoot();
    return main?.querySelectorAll?.('.message-out')?.length || 0;
  }

  function getMediaEditorRoots() {
    const roots = [];
    const seen = new Set();
    const add = (node) => {
      if (!(node instanceof Element) || seen.has(node) || !isVisible(node)) return;
      seen.add(node);
      roots.push(node);
    };

    for (const selector of [
      '[data-testid="media-editor"]',
      '[data-testid*="media-editor" i]',
      '[data-testid*="media-preview" i]',
      '[role="dialog"]'
    ]) {
      for (const node of document.querySelectorAll(selector)) {
        const hasMedia = node.matches('[data-testid*="media" i]')
          || node.querySelector('img[src^="blob:"], video[src^="blob:"], [data-testid="media-caption-input"]');
        if (hasMedia) add(node);
      }
    }

    const preview = Array.from(document.querySelectorAll('img[src^="blob:"], video[src^="blob:"]'))
      .find((node) => isVisible(node) && !node.closest('.message-in, .message-out') && !node.closest(`#${PANEL_ID}`));
    if (preview) {
      add(preview.closest('[role="dialog"]'));
      add(preview.closest('[data-testid*="media" i]'));
      let ancestor = preview.parentElement;
      for (let i = 0; ancestor && i < 6; i += 1, ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        const rect = ancestor.getBoundingClientRect();
        if ((style.position === 'fixed' || style.position === 'absolute')
          && rect.width > window.innerWidth * 0.45
          && rect.height > window.innerHeight * 0.45) {
          add(ancestor);
          break;
        }
      }
    }

    return roots;
  }

  function findMediaEditorSendControl() {
    const selectors = [
      '[data-testid="media-editor-send"]',
      '[data-testid*="media" i][data-testid*="send" i]',
      'button[aria-label="Enviar"]',
      'button[aria-label="Send"]',
      '[role="button"][aria-label="Enviar"]',
      '[role="button"][aria-label="Send"]',
      '[aria-label*="Enviar foto" i]',
      '[aria-label*="Send photo" i]',
      '[aria-label*="Enviar archivo" i]',
      '[aria-label*="Send file" i]',
      '[title="Enviar"]',
      '[title="Send"]',
      '[data-icon="send"]',
      '[data-icon="wds-ic-send-filled"]',
      '[data-icon="send-filled"]'
    ];

    const roots = getMediaEditorRoots();
    if (!roots.length && !hasMediaEditorOpen()) return null;
    // WhatsApp puede montar el botón Enviar en un portal fuera del dialog.
    // Buscamos dentro del editor y también a nivel documento, dando mayor
    // puntaje a los controles contenidos en las raíces multimedia.
    const searchRoots = [...roots, document];
    const controls = [];
    const seen = new Set();

    for (const root of searchRoots) {
      for (const selector of selectors) {
        for (const node of root.querySelectorAll(selector)) {
          const control = resolveClickableControl(node);
          if (!control || seen.has(control) || !isUsableMediaControl(control)) continue;
          seen.add(control);
          controls.push({
            control,
            score: scoreMediaSendControl(control, node) + (roots.some((candidate) => candidate.contains(control)) ? 250 : 0)
          });
        }
      }
    }

    controls.sort((a, b) => b.score - a.score);
    return controls[0]?.control || null;
  }

  function resolveClickableControl(node) {
    if (!(node instanceof Element)) return null;
    if (node.matches('button, [role="button"]')) return node;
    return node.closest('button, [role="button"], [tabindex]') || node.parentElement;
  }

  function isUsableMediaControl(control) {
    if (!(control instanceof Element)) return false;
    if (control.closest(`#${PANEL_ID}, #${BUTTON_ID}`)) return false;
    if (!isVisible(control)) return false;
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') return false;
    const rect = control.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return false;
    return true;
  }

  function scoreMediaSendControl(control, sourceNode) {
    const rect = control.getBoundingClientRect();
    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const attrs = [
      control.getAttribute('data-testid'),
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      sourceNode?.getAttribute?.('data-icon'),
      sourceNode?.getAttribute?.('data-testid')
    ].filter(Boolean).join(' ').toLowerCase();

    let score = 0;
    if (attrs.includes('media-editor-send')) score += 400;
    if (/\b(enviar|send)\b/.test(attrs)) score += 160;
    if (attrs.includes('wds-ic-send-filled') || attrs.includes('send-filled')) score += 140;
    if (sourceNode?.getAttribute?.('data-icon')) score += 40;
    if (rect.left > viewportWidth * 0.6) score += 80;
    if (rect.top > viewportHeight * 0.5) score += 80;
    if (rect.right > viewportWidth * 0.88) score += 35;
    if (rect.bottom > viewportHeight * 0.78) score += 35;
    if (Math.abs(rect.width - rect.height) < 18) score += 10;
    if (control.closest('footer') && !hasMediaEditorOpen()) score -= 300;
    return score;
  }

  function findBottomRightMediaControl() {
    if (!hasMediaEditorOpen()) return null;

    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const points = [
      [viewportWidth - 34, viewportHeight - 34],
      [viewportWidth - 42, viewportHeight - 58],
      [viewportWidth - 52, viewportHeight - 86],
      [viewportWidth * 0.965, viewportHeight * 0.9]
    ];

    for (const [x, y] of points) {
      const node = document.elementFromPoint(Math.max(0, x), Math.max(0, y));
      const control = resolveClickableControl(node);
      if (!isUsableMediaControl(control)) continue;
      const rect = control.getBoundingClientRect();
      if (rect.left < viewportWidth * 0.62 || rect.top < viewportHeight * 0.5) continue;
      return control;
    }

    const roots = getMediaEditorRoots();
    const scope = [...roots, document];
    const generic = scope.flatMap((root) => Array.from(root.querySelectorAll('button, [role="button"]')))
      .filter(isUsableMediaControl)
      .map((control) => ({ control, rect: control.getBoundingClientRect() }))
      .filter(({ rect }) => rect.left > viewportWidth * 0.68 && rect.top > viewportHeight * 0.52)
      .sort((a, b) => (b.rect.right + b.rect.bottom) - (a.rect.right + a.rect.bottom));

    return generic[0]?.control || null;
  }

  function activateSimpleControl(control) {
    if (!control) return false;
    try {
      control.focus?.({ preventScroll: true });
      control.click?.();
      return true;
    } catch (error) {
      return false;
    }
  }

  function activateMediaSendControl(control) {
    if (!control) return false;
    const rect = control.getBoundingClientRect();
    const clientX = rect.left + Math.max(1, rect.width / 2);
    const clientY = rect.top + Math.max(1, rect.height / 2);
    const common = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      button: 0
    };

    try {
      control.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      control.focus?.({ preventScroll: true });
      if (typeof PointerEvent === 'function') {
        control.dispatchEvent(new PointerEvent('pointerdown', {
          ...common,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          buttons: 1
        }));
      }
      control.dispatchEvent(new MouseEvent('mousedown', { ...common, buttons: 1 }));
      if (typeof PointerEvent === 'function') {
        control.dispatchEvent(new PointerEvent('pointerup', {
          ...common,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          buttons: 0
        }));
      }
      control.dispatchEvent(new MouseEvent('mouseup', { ...common, buttons: 0 }));
      HTMLElement.prototype.click.call(control);
      return true;
    } catch (error) {
      try {
        control.click?.();
        return true;
      } catch (ignored) {
        return false;
      }
    }
  }

  async function waitForMediaSendCompletion(previousControl, outgoingBefore, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (countOutgoingMessages() > outgoingBefore) {
        return { confirmed: true, reason: 'outgoing-message-added' };
      }

      const previousGone = !previousControl?.isConnected || !isVisible(previousControl);
      if (previousGone && !hasMediaEditorOpen()) {
        return { confirmed: true, reason: 'editor-closed' };
      }

      await sleep(140);
    }
    return { confirmed: false, reason: 'timeout' };
  }

  async function closeMediaEditorSafely() {
    if (!hasMediaEditorOpen()) return true;

    const target = document.activeElement instanceof Element ? document.activeElement : document.body;
    const options = {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: 'Escape',
      code: 'Escape',
      which: 27,
      keyCode: 27
    };
    target.dispatchEvent(new KeyboardEvent('keydown', options));
    target.dispatchEvent(new KeyboardEvent('keyup', options));

    for (let i = 0; i < 12; i += 1) {
      if (!hasMediaEditorOpen()) return true;
      await sleep(100);
    }

    const roots = getMediaEditorRoots();
    const selectors = [
      'button[aria-label="Cerrar"]',
      'button[aria-label="Close"]',
      '[role="button"][aria-label="Cerrar"]',
      '[role="button"][aria-label="Close"]',
      '[data-icon="x"]',
      '[data-icon="close"]',
      '[data-icon="back"]'
    ];
    for (const root of roots) {
      for (const selector of selectors) {
        const node = root.querySelector(selector);
        const control = resolveClickableControl(node);
        if (control && isVisible(control)) {
          activateSimpleControl(control);
          await sleep(250);
          return !hasMediaEditorOpen();
        }
      }
    }

    return false;
  }

  function findMediaCaptionInput(allowFooterFallback = true) {
    const explicitSelectors = [
      '[data-testid="media-caption-input"] [contenteditable="true"]',
      '[data-testid="media-caption-input"]',
      '[aria-label*="Añade un comentario" i]',
      '[aria-label*="Agrega un comentario" i]',
      '[aria-label*="Add a caption" i]',
      '[placeholder*="comentario" i]',
      '[placeholder*="caption" i]'
    ];
    for (const selector of explicitSelectors) {
      const node = Array.from(document.querySelectorAll(selector)).find(
        (item) => !item.closest(`#${PANEL_ID}`) && isVisible(item)
      );
      if (node) return node;
    }

    if (!allowFooterFallback) return null;

    const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const candidates = Array.from(document.querySelectorAll('[contenteditable="true"], textarea'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && isVisible(node))
      .map((node) => ({ node, rect: node.getBoundingClientRect() }))
      .filter(({ node, rect }) => rect.top > viewportHeight * 0.5 && rect.width > 120 && !node.closest('footer'))
      .sort((a, b) => b.rect.top - a.rect.top);
    return candidates[0]?.node || null;
  }

  function dispatchEnter(target) {
    const options = {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: 'Enter',
      code: 'Enter',
      which: 13,
      keyCode: 13
    };
    target.dispatchEvent(new KeyboardEvent('keydown', options));
    target.dispatchEvent(new KeyboardEvent('keypress', options));
    target.dispatchEvent(new KeyboardEvent('keyup', options));
  }

  async function sendCurrentMessage(expectedText = '') {
    const input = findComposer();
    if (input && expectedText) {
      normalizeComposerText(input, expectedText);
      await sleep(120);
      normalizeComposerText(input, expectedText);
    }

    for (let i = 0; i < 12; i += 1) {
      const button = findSendButton();
      if (button) {
        button.click();
        return true;
      }
      await sleep(160);
    }

    const fallbackInput = findComposer();
    if (fallbackInput) {
      if (expectedText) normalizeComposerText(fallbackInput, expectedText);
      fallbackInput.focus();
      fallbackInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', which: 13, keyCode: 13 }));
      fallbackInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', which: 13, keyCode: 13 }));
      await sleep(250);
      return true;
    }

    return false;
  }

  function findSendButton() {
    const main = getMainChatRoot();
    const footer = main?.querySelector('footer') || document.querySelector('footer') || document.body;
    const selectors = [
      'button[aria-label="Enviar"]',
      'button[aria-label="Send"]',
      'button[data-testid="compose-btn-send"]',
      'span[data-icon="send"]',
      'span[data-icon="wds-ic-send-filled"]'
    ];

    for (const selector of selectors) {
      const node = footer.querySelector(selector);
      if (!node) continue;
      const button = node.tagName === 'BUTTON' ? node : node.closest('button');
      if (button && isVisible(button) && !button.disabled) return button;
    }

    const buttons = Array.from(footer.querySelectorAll('button'));
    return buttons.find((button) => {
      const label = `${button.getAttribute('aria-label') || ''} ${button.innerText || ''}`.toLowerCase();
      return isVisible(button) && !button.disabled && (label.includes('enviar') || label.includes('send'));
    }) || null;
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  async function acquireAutoReplyLock(key) {
    const now = Date.now();
    const ttlMs = 5 * 60 * 1000;
    const nonce = `${INSTANCE_ID}-${Math.random().toString(36).slice(2)}`;

    try {
      const raw = window.localStorage.getItem(AUTO_LOCK_KEY);
      const current = raw ? JSON.parse(raw) : null;
      if (current?.key === key && current?.until && Number(current.until) > now) {
        return current.instance === INSTANCE_ID;
      }

      window.localStorage.setItem(AUTO_LOCK_KEY, JSON.stringify({
        key,
        instance: INSTANCE_ID,
        nonce,
        until: now + ttlMs
      }));

      // Segunda lectura para cerrar la carrera entre dos content scripts/extensiones activas.
      await sleep(120 + Math.floor(Math.random() * 100));
      const verifiedRaw = window.localStorage.getItem(AUTO_LOCK_KEY);
      const verified = verifiedRaw ? JSON.parse(verifiedRaw) : null;
      return verified?.key === key && verified?.instance === INSTANCE_ID && verified?.nonce === nonce;
    } catch (error) {
      return !autoBusy;
    }
  }

  function setStatus(node, text, isError) {
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('migo-wa-ai-error', Boolean(isError));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
