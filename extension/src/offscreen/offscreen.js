// offscreen.js — VIZIO AI Offscreen Document
// Roda em background com DOM completo, podendo acessar getUserMedia e SpeechRecognition.
// Ref: https://developer.chrome.com/docs/extensions/reference/api/offscreen

console.log("VIZIO AI: Offscreen Document Loaded.");

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;

// ─── Message Router ─────────────────────────────────────────
// Só processa mensagens direcionadas a 'offscreen'
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen') return;

  if (request.action === 'START_RECOGNITION') {
    startRecognition();
    sendResponse({ status: 'ok' });
  } else if (request.action === 'STOP_RECOGNITION') {
    stopRecognition();
    sendResponse({ status: 'ok' });
  }

  return true;
});

// ─── SpeechRecognition ──────────────────────────────────────
function startRecognition() {
  if (!SpeechRecognitionAPI) {
    notify('RECOGNITION_ERROR', { error: 'not-supported' });
    return;
  }

  // Garante que não há sessão ativa
  if (recognition) {
    try { recognition.abort(); } catch (_) {}
    recognition = null;
  }

  recognition = new SpeechRecognitionAPI();
  recognition.lang            = 'pt-BR';
  recognition.continuous      = false;
  recognition.interimResults  = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    console.log("VIZIO AI Offscreen: Reconhecimento iniciado.");
    notify('RECOGNITION_STARTED', {});
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final   = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += text;
      } else {
        interim += text;
      }
    }

    if (final) {
      notify('TRANSCRIPT', { text: final, isFinal: true });
    } else if (interim) {
      notify('TRANSCRIPT', { text: interim, isFinal: false });
    }
  };

  recognition.onerror = (event) => {
    console.error("VIZIO AI Offscreen: Erro no reconhecimento:", event.error);
    notify('RECOGNITION_ERROR', { error: event.error });
  };

  recognition.onend = () => {
    console.log("VIZIO AI Offscreen: Reconhecimento encerrado.");
    recognition = null;
    notify('RECOGNITION_ENDED', {});
  };

  try {
    recognition.start();
  } catch (e) {
    console.error("VIZIO AI Offscreen: Falha ao iniciar:", e);
    notify('RECOGNITION_ERROR', { error: e.message });
  }
}

function stopRecognition() {
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
    recognition = null;
  }
}

// ─── Notificador para o Background ──────────────────────────
function notify(action, payload) {
  chrome.runtime.sendMessage({ action, source: 'offscreen', ...payload });
}
