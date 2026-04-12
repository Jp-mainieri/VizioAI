// popup.js — VIZIO AI Voice Input (SpeechRecognition no popup — contexto visível da extensão)

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

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

// --- State ---
let isListening = false;
let recognition = null;
let mediaStream = null;

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

/** Mensagens distintas: falha do microfone (getUserMedia) vs bloqueio do serviço Web Speech. */
function messageForMicFailure(name, message) {
  const n = (name || '').toString();
  const m = (message || '').toString();
  if (n === 'NotAllowedError' || m.includes('Permission denied')) {
    return 'Microfone bloqueado para a extensão. Abra a página de permissão (ícone da extensão) ou ajuste chrome://settings/content/microphone.';
  }
  if (n === 'NotFoundError') {
    return 'Nenhum microfone encontrado. Verifique se há um microfone ligado.';
  }
  if (n === 'NotReadableError' || n === 'TrackStartError') {
    return 'O microfone está em uso por outra aplicação ou não pode ser aberto.';
  }
  return `Microfone: ${m || n || 'erro desconhecido'}`;
}

function messageForSpeechApiError(errorCode) {
  const code = (errorCode || '').toString();
  const map = {
    'not-allowed':   'Reconhecimento de voz bloqueado pelo navegador (Web Speech API). O microfone pode estar OK; tente outro perfil do Chrome ou rede.',
    'no-speech':     'Nenhuma fala detectada. Tente novamente.',
    'network':       'Erro de rede no reconhecimento de voz.',
    'aborted':       'Reconhecimento cancelado.',
    'not-supported': 'SpeechRecognition não disponível neste navegador.',
  };
  return map[code] || `Reconhecimento de voz: ${code || 'erro desconhecido'}`;
}

function showRecognitionError(kind, detail) {
  setListeningUI(false);
  let msg;
  if (kind === 'mic') msg = messageForMicFailure(detail?.name, detail?.message);
  else msg = messageForSpeechApiError(detail);
  setStatus('error', msg);
  transcriptEl.textContent = msg;
}

// --- Permissao de Microfone ---
// O popup perde foco (e fecha) quando o Chrome tenta exibir o dialogo de permissao.
// A solucao e abrir uma aba dedicada e persistente que chama getUserMedia corretamente.
async function checkOrRequestMicPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    console.info('[VIZIO mic] getUserMedia OK no popup (permissão da extensão).');
    return true;
  } catch (err) {
    console.error('[VIZIO mic] getUserMedia falhou no popup:', err?.name, err?.message);
    setStatus('idle', 'Abrindo pagina de permissao...');
    chrome.tabs.create(
      { url: chrome.runtime.getURL('src/permission/permission.html'), active: true }
    );
    return false;
  }
}

function stopMediaStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

function stopRecognitionLocal() {
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
    recognition = null;
  }
  stopMediaStream();
}

async function startRecognitionInPopup() {
  if (!SpeechRecognitionAPI) {
    noSpeechWarn.style.display = 'block';
    showRecognitionError('speech', 'not-supported');
    return;
  }

  stopRecognitionLocal();

  setStatus('listening', 'Preparando microfone\u2026');
  transcriptEl.textContent = '';
  transcriptEl.classList.remove('has-text');

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.info('[VIZIO mic] Stream ativo no popup para SpeechRecognition.');
  } catch (e) {
    console.error('[VIZIO mic] getUserMedia falhou ao iniciar reconhecimento:', e?.name, e?.message);
    showRecognitionError('mic', e);
    return;
  }

  recognition = new SpeechRecognitionAPI();
  recognition.lang            = 'pt-BR';
  recognition.continuous      = false;
  recognition.interimResults  = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    console.info('[VIZIO speech] SpeechRecognition iniciado (popup).');
    setListeningUI(true);
    setStatus('listening', 'Ouvindo voc\u00ea\u2026');
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final   = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) final += event.results[i][0].transcript;
      else interim += event.results[i][0].transcript;
    }

    if (final) {
      const text = final.trim();
      transcriptEl.textContent = text;
      transcriptEl.classList.add('has-text');
      promptInput.value = text;
      setListeningUI(false);
      setStatus('thinking', 'Gemini analisando\u2026');
      sendBtn.disabled = true;
      sendBtn.textContent = 'Processando\u2026';
      stopRecognitionLocal();

      chrome.runtime.sendMessage(
        { action: 'TRIGGER_VOICE_COMMAND', prompt: text },
        () => {
          if (chrome.runtime.lastError) {
            setStatus('error', 'Erro de comunicacao com a extensao.');
            resetSendBtn();
          }
        }
      );
    } else if (interim) {
      transcriptEl.innerHTML = `<span class="interim">${interim}</span>`;
    }
  };

  recognition.onerror = (event) => {
    console.error('[VIZIO speech] SpeechRecognition.onerror (camada Web Speech, não getUserMedia):', event.error);
    showRecognitionError('speech', event.error);
    stopRecognitionLocal();
  };

  recognition.onend = () => {
    console.info('[VIZIO speech] SpeechRecognition encerrado (popup).');
    stopMediaStream();
    recognition = null;
    if (statusDot.classList.contains('listening')) {
      setListeningUI(false);
      setStatus('idle', 'Inativo \u2014 pronto para ouvir');
    }
  };

  try {
    recognition.start();
  } catch (e) {
    console.error('[VIZIO speech] recognition.start() falhou:', e?.name, e?.message);
    showRecognitionError('mic', e);
    stopRecognitionLocal();
  }
}

// --- Mic Toggle ---
async function startListening() {
  if (isListening) return;

  const granted = await checkOrRequestMicPermission();
  if (!granted) return;

  await startRecognitionInPopup();
}

function stopListening() {
  if (!isListening && !recognition) return;
  stopRecognitionLocal();
  setListeningUI(false);
  setStatus('idle', 'Inativo \u2014 pronto para ouvir');
}

micBtn.addEventListener('click', () => {
  if (isListening || recognition) {
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
    if (isListening || recognition) { stopListening(); } else { startListening(); }
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

  // Permissao concedida pela pagina de permissao dedicada
  if (request.action === 'MIC_PERMISSION_GRANTED') {
    setStatus('idle', 'Microfone liberado! Clique no microfone para falar.');
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
