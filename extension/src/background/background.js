import { GoogleGenAI } from "../utils/genai.js";
import { VIZIO_CONFIG } from "../utils/config.js";

console.log("VIZIO AI: Background Service Worker Loaded.");

// Configurar o Side Panel para abrir ao clicar no ícone da extensão
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

// Instancia a IA usando o arquivo de configuração manual
const ai = new GoogleGenAI();
const MODEL_NAME = VIZIO_CONFIG.MODEL_NAME || "gemini-1.5-flash";

const SYSTEM_PROMPT = `Você é um Assistente de Acessibilidade (VIZIO AI).
Seu objetivo é interagir com a página Chrome enviada como uma Árvore Semântica DOM.

CONTEXTO DE INTERAÇÃO:
O usuário não vê a tela. Ele depende inteiramente da sua descrição para entender onde está, o que pode fazer e o que está acontecendo.

DIRETRIZES DE RESPOSTA:

1. PRIORIZAÇÃO SEMÂNTICA:
   - Ignore o layout visual (cores, posições). Foque na hierarquia (Títulos H1-H6), regiões (Header, Main, Footer) e elementos interativos.
   - Sempre informe o estado da página: "A página carregou", "Há um pop-up bloqueando a leitura", "Estamos no formulário de login".

2. DESCRIÇÕES DE AÇÃO:
   - Antes de executar, narre: "Vou clicar no botão de pesquisa".
   - Durante a execução, dê feedback: "Processando...", "Aguardando o site responder".
   - Após a execução, confirme: "Pronto, agora estamos na página de resultados".

3. GERENCIAMENTO DE AMBIGUIDADE:
   - Se houver múltiplos elementos iguais, numere-os: "Encontrei 3 botões de compra. O primeiro é para o modelo azul, o segundo para o preto. Qual você prefere?".

4. TOM DE VOZ:
   - Seja conciso. Evite termos visuais como "veja" ou "botão verde". Use "Selecione a opção X" ou "O campo de texto está pronto".
   - Use referências de áudio se necessário.

5. SEGURANÇA:
   - Para ações críticas (pagar, deletar, enviar), você DEVE pedir confirmação: "Esta é uma ação importante. Posso prosseguir?".

Regras de Resposta:
1. Retorne APENAS um JSON válido.
2. Campos obrigatórios:
   - "action": "speak" (apenas falar), "click" (clicar), "type" (digitar em input), "navigate" (navegar).
   - "targetId": O ID do elemento (vizio-id-X) para click/type.
   - "text": O texto para digitar (obrigatório se action="type").
   - "direction": "back", "forward" ou "reload" (obrigatório se action="navigate").
   - "ttsMessage": Feedback falado para o usuário sobre o que você está fazendo.

Exemplos:
- Digitar: {"action": "type", "targetId": "vizio-id-5", "text": "bola", "ttsMessage": "Pesquisando por bola."}
  (Dica: Ao digitar em campos de busca, o sistema apertará Enter automaticamente para você.)
- Navegar: {"action": "navigate", "direction": "back", "ttsMessage": "Voltando para a página anterior."}`;

function broadcastStatus(statusText) {
  chrome.runtime.sendMessage({ action: 'UPDATE_STATUS', statusText }).catch(() => { });
}

// ─── Comando Principal (Vertex AI) ──────────────────────────
async function handleVoiceCommand(prompt) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
    chrome.tts.speak("Desculpe, não atuo nessa página de sistema.", { rate: 1.2, lang: 'pt-BR' });
    broadcastStatus('Página Restrita');
    return;
  }

  // Silenciar a aba temporariamente para evitar echo/feedback
  await chrome.tabs.update(tab.id, { muted: true });

  let domResponse;
  try {
    domResponse = await chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_DOM" });
  } catch (err) {
    console.warn("Content Script ausente, injetando...");
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content/content.js'] });
      await new Promise(r => setTimeout(r, 200));
      domResponse = await chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_DOM" });
    } catch (injectErr) {
      console.error("Falha ao injetar content script:", injectErr);
    }
  }

  if (!domResponse || domResponse.status !== 'success') {
    chrome.tts.speak("Não foi possível alcançar o corpo desse site.", { rate: 1.2, lang: 'pt-BR' });
    broadcastStatus('DOM indisponível');
    chrome.tabs.update(tab.id, { muted: false });
    return;
  }

  try {
    broadcastStatus('VIZIO AI Pensando...');
    chrome.tts.speak("Pensando.", { rate: 1.4, lang: 'pt-BR' });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Comando: "${prompt}"\n[DOM]:\n${JSON.stringify(domResponse.data)}`,
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.1 }
    });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("IA não retornou JSON: " + response.text);

    const aiResponse = JSON.parse(jsonMatch[0]);
    console.log("VIZIO AI Vertex resposta:", aiResponse);

    const { action, targetId, text, direction, ttsMessage } = aiResponse;
    if (ttsMessage) chrome.tts.speak(ttsMessage, { rate: 1.2, lang: 'pt-BR' });

    // Executa a interação baseada na ação decidida pela IA
    if (action === 'click' || action === 'focus' || action === 'type' || action === 'navigate') {
      chrome.tabs.sendMessage(tab.id, {
        action: "INTERACT",
        interactionType: action,
        targetId,
        text,
        direction
      });
    }

    broadcastStatus('Concluído!');
  } catch (err) {
    console.error("VIZIO AI: Erro na chamada da IA:", err);
    chrome.tts.speak("Houve uma falha na interpretação.", { rate: 1.2, lang: 'pt-BR' });
    broadcastStatus('Falha na API');
  } finally {
    // Reativar áudio da aba após processamento
    setTimeout(() => chrome.tabs.update(tab.id, { muted: false }), 2000);
  }
}

// ─── Message Router ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Roteamento de comandos de voz para o Content Script da TAB ativa
  if (request.action === 'START_RECOGNITION' || request.action === 'STOP_RECOGNITION') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab) return;

      try {
        await chrome.tabs.sendMessage(tab.id, request);
      } catch (err) {
        console.warn("Content Script desconectado, re-injetando...");
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content/content.js'] });
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, request).catch(e => console.error("Falha após injeção:", e));
          }, 200);
        } catch (injectErr) {
          console.error("Erro ao injetar script:", injectErr);
        }
      }
    });
    sendResponse({ status: 'ok' });
    return true;
  }

  // Trigger manual do comando (via input de texto ou reconhecimento finalizado)
  if (request.action === 'TRIGGER_VOICE_COMMAND') {
    handleVoiceCommand(request.prompt);
    sendResponse({ status: 'started' });
    return true;
  }

  // Encaminhamento de mensagens do Content Script -> Popup
  if (request.action === 'TRANSCRIPT') {
    chrome.runtime.sendMessage({ action: 'TRANSCRIPT', text: request.text, isFinal: request.isFinal }).catch(() => { });
    if (request.isFinal && request.text.trim()) {
      handleVoiceCommand(request.text.trim());
    }
  } else if (['RECOGNITION_STARTED', 'RECOGNITION_ENDED', 'RECOGNITION_ERROR'].includes(request.action)) {
    chrome.runtime.sendMessage(request).catch(() => { });
  }

  return true;
});
