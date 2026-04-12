import { GoogleGenAI } from "../utils/genai.js";

console.log("VIZIO AI: Background Service Worker Loaded.");

const ai = new GoogleGenAI({ apiKey: "AIzaSyCm2rTDT1w4ITgGOWQJs4Sf7oWT-lMKQZA" });

const SYSTEM_PROMPT = `Você é um Assistente de Acessibilidade Visual (VIZIO AI) para usuários totalmente cegos usando o Chrome.
Seu objetivo é extrair ou interagir com informações em uma página enviada como uma Árvore Semântica DOM e processar de acordo com a ordem do usuário.

Regras Absolutas:
1. Responda ESTRITAMENTE em JSON limpo e estruturado.
2. Formato exigido: {"action": "speak|click|focus", "targetId": "vizio-id-...", "ttsMessage": "Um texto amigável."}
3. "action": "speak" é só para ler texto.
4. "action": "click" caso a intenção do usuário no DOM necessite apertar algo. "targetId" obrigatório.`;

function broadcastStatus(statusText) {
  chrome.runtime.sendMessage({ action: 'UPDATE_STATUS', statusText }).catch(() => {});
}

// ─── Comando Principal (Gemini) ──────────────────────────────
async function handleVoiceCommand(prompt) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
    chrome.tts.speak("Desculpe, não atuo nessa página de sistema.", { rate: 1.2, lang: 'pt-BR' });
    broadcastStatus('Página Restrita');
    return;
  }

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
    broadcastStatus('Gemini Analisando...');
    chrome.tts.speak("Pensando.", { rate: 1.4, lang: 'pt-BR' });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Comando: "${prompt}"\n[DOM]:\n${JSON.stringify(domResponse.data)}\n\n(Retorne as respostas estritamente neste formato JSON: {"action": "speak|click", "targetId": "vizio-id-X", "ttsMessage": "fala"})\nNão escreva nenhum texto fora as chaves do JSON!`,
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.1 }
    });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Gemini não retornou JSON: " + response.text);

    const aiResponse = JSON.parse(jsonMatch[0]);
    console.log("VIZIO AI Gemini resposta:", aiResponse);

    const { action, targetId, ttsMessage } = aiResponse;
    if (ttsMessage) chrome.tts.speak(ttsMessage, { rate: 1.2, lang: 'pt-BR' });
    if ((action === 'click' || action === 'focus') && targetId) {
      chrome.tabs.sendMessage(tab.id, { action: "INTERACT", interactionType: action, targetId });
    }

    broadcastStatus('Concluído!');
  } catch (err) {
    console.error("VIZIO AI: Falha na API Gemini:", err);
    chrome.tts.speak("Houve uma falha na interpretação.", { rate: 1.2, lang: 'pt-BR' });
    broadcastStatus('Falha API');
  } finally {
    setTimeout(() => chrome.tabs.update(tab.id, { muted: false }), 2000);
  }
}

// ─── Message Router ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === 'TRIGGER_VOICE_COMMAND') {
    handleVoiceCommand(request.prompt);
    sendResponse({ status: 'started' });
    return true;
  }

  if (request.action === 'MIC_PERMISSION_GRANTED') {
    chrome.runtime.sendMessage({ action: 'MIC_PERMISSION_GRANTED' }).catch(() => {});
    sendResponse({ status: 'ok' });
    return true;
  }

  return true;
});
