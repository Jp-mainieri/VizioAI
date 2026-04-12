// offscreen.js — legado (não usado): o reconhecimento de voz corre no popup para evitar
// not-allowed da Web Speech API em documentos offscreen. Mantido só como referência.
console.log("VIZIO AI: Offscreen Document Loaded (unused).");

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let mediaStream = null;

// ─── Router ─────────────────────────────────────────────────
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

// ─── Reconhecimento de voz ──────────────────────────────────
async function startRecognition() {
  if (!SpeechRecognitionAPI) {
    notify('RECOGNITION_ERROR', { error: 'not-supported' });
    return;
  }

  stopRecognition(); // Limpa estado anterior

  try {
    // 🔥 O SEGREDO PARA OFFSCREEN: 
    // Em documentos offscreen, o Chrome bloqueia o SpeechRecognition (not-allowed) 
    // a menos que haja um stream de microfone ativamente aberto pelo getUserMedia!
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    recognition = new SpeechRecognitionAPI();
    recognition.lang            = 'pt-BR';
    recognition.continuous      = false;
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("VIZIO AI: SpeechRecognition iniciado.");
      notify('RECOGNITION_STARTED', {});
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final   = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }

      if (final) notify('TRANSCRIPT', { text: final, isFinal: true });
      else if (interim) notify('TRANSCRIPT', { text: interim, isFinal: false });
    };

    recognition.onerror = (event) => {
      console.error("VIZIO AI: Erro no reconhecimento:", event.error);
      notify('RECOGNITION_ERROR', { error: event.error });
      stopStream();
    };

    recognition.onend = () => {
      console.log("VIZIO AI: Reconhecimento encerrado.");
      notify('RECOGNITION_ENDED', {});
      stopStream();
    };

    recognition.start();

  } catch (e) {
    console.error("VIZIO AI: Falha profunda ao iniciar:", e);
    notify('RECOGNITION_ERROR', { error: e.message || e.name });
    stopStream();
  }
}

function stopRecognition() {
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
    recognition = null;
  }
  stopStream();
}

function stopStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

// ─── Event Emitter ──────────────────────────────────────────
function notify(action, payload) {
  chrome.runtime.sendMessage({ action, source: 'offscreen', ...payload }).catch(() => {});
}
