// content.js
console.log("VIZIO AI: Content Script Injected.");

class SemanticParser {
  static extract() {
    console.log("Extracting Semantic DOM...");
    const elements = [];
    let idCounter = 1;

    try {
      // Capturamos em lote todos os elementos úteis sem usar TreeWalker, que costuma bugar em SVGs e inputs escondidos
      const nodes = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, button, a, input, textarea, [role], [aria-label]');
      
      for (const node of nodes) {
        if (!node || !document.body.contains(node)) continue;

        // Evita ler tags inúteis que o query selector pode puxar por acidente via [aria-label]
        const tagName = node.tagName ? node.tagName.toUpperCase() : 'UNKNOWN';
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH'].includes(tagName)) continue;

        // Verifica renderização visual
        const style = window.getComputedStyle(node);
        if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

        let textContent = '';
        if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
          textContent = node.value || node.placeholder || node.getAttribute('aria-label') || '';
        } else {
          // O innerText é muito mais seguro que textContent, pois não pega texto escondido pelo CSS
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
            text: textContent.substring(0, 60), // Poda severa para não trafegar descrições absurdas à rede
            interactive: isInteractive
          });
          
          node.setAttribute('data-vizio-id', `vizio-id-${idCounter}`);
          idCounter++;
        }

        // A velocidade da IA depende brutalmente de quanto texto enviamos de input (Reading Speed)
        // Reduzi para 45 elementos máximos da página (o topo principal), cortando tempo pela metade.
        if (elements.length >= 45) break;
      }
    } catch (e) {
      console.error("Erro interno do Vizio AI durante o parse do DOM:", e);
    }
    
    return elements;
  }
}

// Escuta mensagens do background.js (ex: quando o usuário ativa o comando)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_DOM') {
    const semanticData = SemanticParser.extract();
    sendResponse({ status: 'success', data: semanticData });
  } else if (request.action === 'INTERACT') {
    // Para clicar num elemento retornado na árvore
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
  return true; // Keep message channel open for async response se precisar
});
