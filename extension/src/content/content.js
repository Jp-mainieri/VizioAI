// content.js — VIZIO AI
console.log("VIZIO AI: Content Script Injected.");

// ============================================================
// PARTE 1: Extração do DOM Semântico
// ============================================================

class SemanticParser {
  static extract() {
    console.log("Extracting Semantic DOM...");
    const elements = [];
    let idCounter = 1;

    try {
      const nodes = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, button, a, input, textarea, [role], [aria-label]');
      
      for (const node of nodes) {
        if (!node || !document.body.contains(node)) continue;

        const tagName = node.tagName ? node.tagName.toUpperCase() : 'UNKNOWN';
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH'].includes(tagName)) continue;

        const style = window.getComputedStyle(node);
        if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

        let textContent = '';
        if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
          textContent = node.value || node.placeholder || node.getAttribute('aria-label') || '';
        } else {
          textContent = node.innerText || node.getAttribute('aria-label') || '';
        }

        textContent = textContent.replace(/\s+/g, ' ').trim();

        if (textContent !== '') {
          const isInteractive = ['BUTTON', 'A', 'INPUT', 'TEXTAREA'].includes(tagName) ||
                                node.getAttribute('role') === 'button' ||
                                node.getAttribute('role') === 'link';
          
          elements.push({
            id: `vizio-id-${idCounter}`,
            tag: tagName,
            text: textContent.substring(0, 60),
            interactive: isInteractive
          });
          
          node.setAttribute('data-vizio-id', `vizio-id-${idCounter}`);
          idCounter++;
        }

        if (elements.length >= 45) break;
      }
    } catch (e) {
      console.error("Erro interno do Vizio AI durante o parse do DOM:", e);
    }
    
    return elements;
  }
}

// ============================================================
// PARTE 2: Reconhecimento de Voz (SpeechRecognition)
// O content script roda no contexto de páginas https://,
// onde o SpeechRecognition funciona com a permissão da extensão.
// ============================================================

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let voiceRecognition = null;

function startVoiceRecognition() {
  if (!SpeechRecognitionAPI) {
    chrome.runtime.sendMessage({ action: 'RECOGNITION_ERROR', source: 'content', error: 'not-supported' });
    return;
  }

  // Se já há uma sessão ativa, aborta antes de criar nova
  if (voiceRecognition) {
    try { voiceRecognition.abort(); } catch (_) {}
    voiceRecognition = null;
  }

  voiceRecognition = new SpeechRecognitionAPI();
  voiceRecognition.lang            = 'pt-BR';
  voiceRecognition.continuous      = false;
  voiceRecognition.interimResults  = true;
  voiceRecognition.maxAlternatives = 1;

  voiceRecognition.onstart = () => {
    console.log("VIZIO AI: SpeechRecognition iniciado na página.");
    chrome.runtime.sendMessage({ action: 'RECOGNITION_STARTED', source: 'content' });
  };

  voiceRecognition.onresult = (event) => {
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
      chrome.runtime.sendMessage({ action: 'TRANSCRIPT', source: 'content', text: final, isFinal: true });
    } else if (interim) {
      chrome.runtime.sendMessage({ action: 'TRANSCRIPT', source: 'content', text: interim, isFinal: false });
    }
  };

  voiceRecognition.onerror = (event) => {
    console.error("VIZIO AI: Erro no SpeechRecognition:", event.error);
    chrome.runtime.sendMessage({ action: 'RECOGNITION_ERROR', source: 'content', error: event.error });
    voiceRecognition = null;
  };

  voiceRecognition.onend = () => {
    console.log("VIZIO AI: SpeechRecognition encerrado.");
    chrome.runtime.sendMessage({ action: 'RECOGNITION_ENDED', source: 'content' });
    voiceRecognition = null;
  };

  try {
    voiceRecognition.start();
  } catch (e) {
    console.error("VIZIO AI: Falha ao iniciar SpeechRecognition:", e);
    chrome.runtime.sendMessage({ action: 'RECOGNITION_ERROR', source: 'content', error: e.message });
  }
}

function stopVoiceRecognition() {
  if (voiceRecognition) {
    try { voiceRecognition.stop(); } catch (_) {}
    voiceRecognition = null;
  }
}

// ============================================================
// PARTE 3: Message Handler
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Ping: verifica se o content script já está presente
  if (request.action === 'PING') {
    sendResponse({ status: 'alive' });
    return true;
  }

  // Extração do DOM
  if (request.action === 'EXTRACT_DOM') {
    const semanticData = SemanticParser.extract();
    sendResponse({ status: 'success', data: semanticData });
  }

  // Interação com elementos
  else if (request.action === 'INTERACT') {
    const element = document.querySelector(`[data-vizio-id="${request.targetId}"]`);
    if (element) {
      if (request.interactionType === 'click') {
        element.click();
        sendResponse({ status: 'success', message: 'Elemento clicado' });
      } else if (request.interactionType === 'focus') {
        element.focus();
        sendResponse({ status: 'success', message: 'Elemento em foco' });
      }
    } else {
      sendResponse({ status: 'error', message: 'Elemento não encontrado' });
    }
  }

  // Iniciar reconhecimento de voz
  else if (request.action === 'START_VOICE_RECOGNITION') {
    startVoiceRecognition();
    sendResponse({ status: 'ok' });
  }

  // Parar reconhecimento de voz
  else if (request.action === 'STOP_VOICE_RECOGNITION') {
    stopVoiceRecognition();
    sendResponse({ status: 'ok' });
  }

  return true;
});
