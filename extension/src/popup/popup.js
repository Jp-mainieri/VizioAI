// popup.js — VIZIO AI Voice Input Controller (via Offscreen Document)

// --- Elements ---
const micBtn        = document.getElementById('mic-btn');
const micRing       = document.getElementById('mic-ring');
const micLabel      = document.getElementById('mic-label');
const transcriptEl  = document.getElementById('transcript');
const transcriptBox = document.getElementById('transcript-box');
const promptInput   = document.getElementById('prompt-input');
const sendBtn       = document.getElementById('send-btn');
const statusEl      = document.getElementById('status');
const statusDot     = document.getElementById('status-dot');
const noSpeechWarn  = document.getElementById('no-speech-warn');

// --- State ---
let isListening = false;

// --- Status Helper ---
function setStatus(state, text) {
  statusEl.textContent = text;
  statusDot.className  = 'status-dot';
  if (state === 'listening') statusDot.classList.add('listening');
  else if (state === 'thinking') statusDot.classList.add('thinking');
  else if (state === 'done')  statusDot.classList.add('done');
  else if (state === 'error') statusDot.classList.add('error');
}

function setListeningUI(active) {
  isListening = active;
  micBtn.classList.toggle('recording', active);
  micRing.classList.toggle('active', active);
  micLabel.textContent = active ? 'Ouvindo\u2026' : 'Toque para falar';
  micLabel.classList.toggle('recording', active);
  transcriptBox.classList.toggle('active', active);
}

function resetSendBtn() {
  sendBtn.disabled = false;
  sendBtn.textContent = 'Enviar Comando';
}

// --- Permissao de Microfone ---
// O popup perde foco (e fecha) quando o Chrome tenta exibir o dialogo de permissao.
// A solucao e abrir uma aba dedicada e persistente que chama getUserMedia corretamente.
async function checkOrRequestMicPermission() {
  // Verifica se ja temos permissao
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    if (result.state === 'granted') {
      return true;
    }
  } catch (_) {
    // navigator.permissions.query pode nao suportar 'microphone' em alguns contextos
  }

  // Nao concedida: abre a pagina dedicada em nova aba para solicitar permissao.
  setStatus('idle', 'Abrindo pagina de permissao...');

  chrome.tabs.create(
    { url: chrome.runtime.getURL('src/permission/permission.html'), active: true }
  );

  // Retorna false: o reconhecimento so inicia apos MIC_PERMISSION_GRANTED (listener abaixo)
  return false;
}

// --- Mic Toggle ---
async function startListening() {
  if (isListening) return;

  // 1. Verifica/solicita permissao de microfone
  const granted = await checkOrRequestMicPermission();
  if (!granted) return; // aguarda permissao via pagina dedicada

  // 2. Solicita ao background que crie o offscreen document e inicie o reconhecimento
  setStatus('listening', 'Preparando microfone\u2026');
  transcriptEl.textContent = '';
  transcriptEl.classList.remove('has-text');

  chrome.runtime.sendMessage({ action: 'START_RECOGNITION' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Erro ao contatar background:', chrome.runtime.lastError.message);
      setStatus('error', 'Erro interno da extensao.');
    }
  });
}

function stopListening() {
  if (!isListening) return;
  chrome.runtime.sendMessage({ action: 'STOP_RECOGNITION' });
  setListeningUI(false);
  setStatus('idle', 'Inativo \u2014 pronto para ouvir');
}

micBtn.addEventListener('click', () => {
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
});

// --- Keyboard Shortcut (Spacebar) ---
document.addEventListener('keydown', (e) => {
  if (e.target === promptInput) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (isListening) { stopListening(); } else { startListening(); }
  }
  if (e.code === 'Enter' && e.target === promptInput) {
    e.preventDefault();
    const cmd = promptInput.value.trim();
    if (cmd) triggerManualCommand(cmd);
  }
});

// --- Manual Send ---
sendBtn.addEventListener('click', () => {
  const cmd = promptInput.value.trim();
  if (!cmd) {
    setStatus('error', 'Digite um comando antes de enviar.');
    return;
  }
  triggerManualCommand(cmd);
});

function triggerManualCommand(prompt) {
  setStatus('thinking', 'Gemini analisando\u2026');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Processando\u2026';

  chrome.runtime.sendMessage(
    { action: 'TRIGGER_VOICE_COMMAND', prompt },
    (response) => {
      if (chrome.runtime.lastError) {
        setStatus('error', 'Erro de comunicacao com a extensao.');
        resetSendBtn();
      }
    }
  );
}

// --- Listeners: Mensagens do Background ---
chrome.runtime.onMessage.addListener((request) => {

  // Reconhecimento iniciou no offscreen
  if (request.action === 'RECOGNITION_STARTED') {
    setListeningUI(true);
    setStatus('listening', 'Ouvindo voc\u00ea\u2026');
    return;
  }

  // Transcricao ao vivo (parcial ou final)
  if (request.action === 'TRANSCRIPT') {
    if (request.isFinal) {
      transcriptEl.textContent = request.text;
      transcriptEl.classList.add('has-text');
      promptInput.value = request.text;
      setListeningUI(false);
      setStatus('thinking', 'Gemini analisando\u2026');
      sendBtn.disabled = true;
      sendBtn.textContent = 'Processando\u2026';
    } else {
      transcriptEl.innerHTML = `<span class="interim">${request.text}</span>`;
    }
    return;
  }

  // Reconhecimento encerrado sem resultado
  if (request.action === 'RECOGNITION_ENDED') {
    setListeningUI(false);
    if (statusDot.classList.contains('listening')) {
      setStatus('idle', 'Inativo \u2014 pronto para ouvir');
    }
    return;
  }

  // Erro de reconhecimento
  if (request.action === 'RECOGNITION_ERROR') {
    setListeningUI(false);
    const msgs = {
      'not-allowed':   'Permissao negada. Use a pagina de permissao.',
      'no-speech':     'Nenhuma fala detectada. Tente novamente.',
      'network':       'Erro de rede no reconhecimento de voz.',
      'aborted':       'Reconhecimento cancelado.',
      'not-supported': 'SpeechRecognition nao disponivel neste navegador.',
    };
    const msg = msgs[request.error] || `Erro: ${request.error}`;
    setStatus('error', msg);
    transcriptEl.textContent = msg;
    return;
  }

  // Permissao concedida pela pagina de permissao dedicada
  if (request.action === 'MIC_PERMISSION_GRANTED') {
    setStatus('idle', 'Microfone liberado! Clique no microfone para falar.');
    // Inicia automaticamente o reconhecimento
    startListening();
    return;
  }

  // Atualizacoes de status vindas do handleVoiceCommand (Gemini)
  if (request.action === 'UPDATE_STATUS') {
    const text = request.statusText || '';
    if (text.toLowerCase().includes('conclu')) {
      setStatus('done', text); resetSendBtn();
    } else if (
      text.toLowerCase().includes('falha') ||
      text.toLowerCase().includes('erro') ||
      text.toLowerCase().includes('indisp') ||
      text.toLowerCase().includes('restrit')
    ) {
      setStatus('error', text); resetSendBtn();
    } else if (text.toLowerCase().includes('analis') || text.toLowerCase().includes('processand')) {
      setStatus('thinking', text);
    } else {
      setStatus('idle', text); resetSendBtn();
    }
  }
});
