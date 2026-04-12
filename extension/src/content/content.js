// content.js — VIZIO AI (Perceção Expandida & Interação)
console.log("VIZIO AI: Content Script Injected & Ready.");

/**
 * PARTE 1: Feedback Visual (Vizio Ring)
 * Cria um anel neon pulsante ao redor do elemento alvo para feedback visual.
 */
const VIZIO_STYLE_ID = 'vizio-ai-visuals';
if (!document.getElementById(VIZIO_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = VIZIO_STYLE_ID;
  style.textContent = `
    @keyframes vizio-neon-pulse {
      0% { box-shadow: 0 0 0 0px rgba(0, 255, 255, 0.8), 0 0 10px rgba(0, 255, 255, 0.5); }
      50% { box-shadow: 0 0 0 12px rgba(0, 255, 255, 0), 0 0 20px rgba(0, 255, 255, 0.3); }
      100% { box-shadow: 0 0 0 0px rgba(0, 255, 255, 0); }
    }
    .vizio-action-target {
      outline: 4px solid #00ffff !important;
      outline-offset: 2px !important;
      animation: vizio-neon-pulse 1.2s infinite ease-out !important;
      transition: outline 0.2s ease-in-out !important;
      z-index: 2147483647 !important;
      position: relative !important;
    }
  `;
  document.head.appendChild(style);
}

function highlightElement(element) {
  if (!element) return;
  element.classList.add('vizio-action-target');
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Remove o destaque após 3 segundos
  setTimeout(() => {
    element.classList.remove('vizio-action-target');
  }, 3000);
}

/**
 * PARTE 2: Parser Semântico (Perceção)
 * Extrai uma árvore simplificada e rica do DOM para a IA.
 */
class SemanticParser {
  static extract() {
    console.log("VIZIO AI: Iniciando extração do DOM...");
    const elements = [];
    let idCounter = 1;

    // Filtros de busca abrangentes
    const selectors = [
      'h1, h2, h3, h4, h5, h6',
      'p', 'button', 'a', 'input', 'textarea', 'select', 'label',
      '[role="button"]', '[role="link"]', '[role="textbox"]', '[role="checkbox"]',
      '[aria-label]', '[title]', 'nav', 'header', 'footer', 'main'
    ].join(', ');

    try {
      const nodes = document.querySelectorAll(selectors);
      
      for (const node of nodes) {
        if (!node || !document.body.contains(node)) continue;

        // Verificar visibilidade real
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const tagName = node.tagName.toUpperCase();
        
        // Coleta de atributos ricos
        let text = (node.innerText || node.getAttribute('aria-label') || node.title || '').trim();
        const placeholder = node.placeholder || node.getAttribute('placeholder') || '';
        const name        = node.name || node.getAttribute('name') || '';
        const role        = node.getAttribute('role') || '';
        const type        = node.type || node.getAttribute('type') || '';
        const ariaDesc    = node.getAttribute('aria-description') || '';

        // Se não tem texto nem placeholder, ignorar (exceto se for estrutural)
        if (!text && !placeholder && !['INPUT', 'TEXTAREA'].includes(tagName)) continue;

        const id = `vizio-id-${idCounter}`;
        
        elements.push({
          id,
          tag: tagName,
          text: text.substring(0, 100), // Mais contexto
          placeholder: placeholder.substring(0, 50),
          name: name.substring(0, 30),
          type,
          role,
          description: ariaDesc.substring(0, 100)
        });

        // Marcar o elemento no DOM real para referência futura
        node.setAttribute('data-vizio-id', id);
        idCounter++;

        // Limite de 100 elementos para não estourar o contexto ou performance
        if (elements.length >= 100) break;
      }
    } catch (err) {
      console.error("Erro na extração semântica:", err);
    }

    return {
      title: document.title,
      url: window.location.href,
      elements
    };
  }
}

/**
 * PARTE 3: Executor de Interações
 * Realiza as ações solicitadas pelo Gemini.
 */
function simulateTyping(element, text) {
  element.focus();
  
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    element.value = ''; 
    element.value = text;
    
    // Disparar eventos de input e change
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    // 1. Simular a tecla ENTER (Código 13)
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(enterEvent);

    // 2. Tentar submeter o formulário pai se existir
    const form = element.closest('form');
    if (form) {
      // Tenta clicar no botão de submit do formulário
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        submitBtn.click();
      } else {
        // Se não achar botão de submit, tenta submeter o form diretamente
        // Alguns sites bloqueiam .submit(), então tentamos disparar o evento
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    } else {
      // 3. Se não houver form, procurar botões de pesquisa próximos (lupa, pesquisar, etc)
      const nearbyButtons = Array.from(document.querySelectorAll('button, [role="button"]')).filter(btn => {
        const btnText = btn.innerText.toLowerCase();
        const btnTitle = (btn.title || '').toLowerCase();
        const btnAria = (btn.getAttribute('aria-label') || '').toLowerCase();
        return btnText.includes('pesquisar') || btnText.includes('buscar') || btnText.includes('search') || 
               btnTitle.includes('search') || btnTitle.includes('pesquisar') ||
               btnAria.includes('search') || btnAria.includes('pesquisar');
      });

      // Se acharmos botões, clicar no mais próximo visualmente (simplificado por ordem no DOM)
      if (nearbyButtons.length > 0) {
        nearbyButtons[0].click();
      }
    }
    
    setTimeout(() => element.blur(), 300);
  }
}

// Ouvinte de mensagens vinda do Background (Gemini)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === 'EXTRACT_DOM') {
    const data = SemanticParser.extract();
    sendResponse({ status: 'success', data });
  }

  else if (request.action === 'INTERACT') {
    const { interactionType, targetId, text, direction } = request;

    // Ação de Navegação
    if (interactionType === 'navigate') {
      if (direction === 'back') window.history.back();
      else if (direction === 'forward') window.history.forward();
      else if (direction === 'reload') window.location.reload();
      sendResponse({ status: 'success' });
      return true;
    }

    // Localizar elemento por ID gerado
    const element = document.querySelector(`[data-vizio-id="${targetId}"]`);
    if (!element) {
      console.warn(`Elemento ${targetId} não foi encontrado no DOM atual.`);
      sendResponse({ status: 'error', message: 'Elemento sumiu ou não está visível.' });
      return true;
    }

    // Feedback Visual
    highlightElement(element);

    // Executar ação específica
    try {
      switch (interactionType) {
        case 'click':
          element.click();
          break;
        case 'focus':
          element.focus();
          break;
        case 'type':
          simulateTyping(element, text);
          break;
      }
      sendResponse({ status: 'success' });
    } catch (err) {
      console.error("Falha na interação:", err);
      sendResponse({ status: 'error', message: err.message });
    }
  }

  return true;
});
