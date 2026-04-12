// popup.js — VIZIO AI (New UI/UX Logic)

// --- Elements ---
const mainUI        = document.getElementById('main-ui');
const orb           = document.querySelector('.orb');
const statusText    = document.getElementById('status');
const transcriptEl  = document.getElementById('transcript');
const orbIcons      = {
  listening: document.getElementById('icon-listening'),
  executing: document.getElementById('icon-executing'),
  talking:   document.getElementById('icon-talking')
};

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

// --- State ---
let isListening = false;
let recognition = null;
let mediaStream = null;

/**
 * Atualiza visualmente a Orbe e o Texto conforme o estado
 * Estados: 'listening' (azul), 'executing' (laranja), 'talking' (verde), 'error' (vermelho)
 */
function UI_updateState(state, text) {
  const translations = {
    listening: 'Ouvindo...',
    executing: 'Executando...',
    talking:   'Falando...',
    error:     'Erro'
  };
  
  document.body.className = `state-${state}`;
  statusText.textContent = text || translations[state] || 'Pronto';
  
  // Troca de ícones
  Object.values(orbIcons).forEach(icon => icon.classList.add('hidden'));
  if (orbIcons[state]) {
    orbIcons[state].classList.remove('hidden');
  } else if (state === 'error') {
    orbIcons.listening.classList.remove('hidden'); 
  }
}

function setListeningUI(active) {
  isListening = active;
  if (active) {
    UI_updateState('listening', 'Ouvindo...');
  }
}

// --- Voice Recognition Logic ---

async function startRecognitionInPopup() {
  if (!SpeechRecognitionAPI) {
    transcriptEl.textContent = 'Erro: Reconhecimento de voz não suportado.';
    UI_updateState('error', 'Incompatível');
    return;
  }

  stopRecognitionLocal();
  transcriptEl.textContent = 'Aguardando voz...';

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    console.error('Falha no Mic:', e);
    UI_updateState('error', 'Mic Bloqueado');
    transcriptEl.textContent = 'Por favor, libere o microfone nas configurações.';
    return;
  }

  recognition = new SpeechRecognitionAPI();
  recognition.lang            = 'pt-BR';
  recognition.continuous      = false;
  recognition.interimResults  = true;

  recognition.onstart = () => {
    setListeningUI(true);
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
      transcriptEl.textContent = `"${text}"`;
      setListeningUI(false);
      UI_updateState('executing', 'Executing...');
      
      stopRecognitionLocal();

      chrome.runtime.sendMessage({ action: 'TRIGGER_VOICE_COMMAND', prompt: text });
    } else if (interim) {
      transcriptEl.textContent = interim;
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech error:', event.error);
    UI_updateState('error', 'Erro de Voz');
    stopRecognitionLocal();
  };

  recognition.onend = () => {
    stopMediaStream();
    recognition = null;
  };

  try {
    recognition.start();
  } catch (e) {
    stopRecognitionLocal();
  }
}

function stopRecognitionLocal() {
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
    recognition = null;
  }
  stopMediaStream();
}

function stopMediaStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

// --- Interaction ---

orb.addEventListener('click', () => {
  if (isListening) {
    stopRecognitionLocal();
    UI_updateState('listening', 'Ready to listen');
    isListening = false;
  } else {
    startRecognitionInPopup();
  }
});

// Shortcut de Teclado (Espaço)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    orb.click();
  }
});

// --- Listeners: Mensagens do Background ---
chrome.runtime.onMessage.addListener((request) => {

  // Atualizações de status do Vertex AI / VIZIO AI
  if (request.action === 'UPDATE_STATUS') {
    const text = request.statusText || '';
    const lowText = text.toLowerCase();

    if (lowText.includes('pensando') || lowText.includes('processan') || lowText.includes('analisand')) {
      UI_updateState('executing', 'Executando...');
    } 
    else if (lowText.includes('conclu')) {
      UI_updateState('talking', 'Falando...');
      setTimeout(() => {
        if (document.body.className === 'state-talking') {
            UI_updateState('listening', 'Pronto para ouvir');
            transcriptEl.textContent = 'Toque no ícone para começar';
        }
      }, 5000);
    } 
    else if (lowText.includes('falha') || lowText.includes('erro') || lowText.includes('indisp')) {
      UI_updateState('error', text);
      transcriptEl.textContent = 'Houve um problema. Tente novamente.';
    }
  }

  if (request.action === 'MIC_PERMISSION_GRANTED') {
    UI_updateState('listening', 'Mic OK! Toque para falar.');
  }
});

// Estado inicial
UI_updateState('listening', 'Pronto para ouvir');
