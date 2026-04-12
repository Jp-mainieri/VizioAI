import { GoogleGenAI } from "../utils/genai.js";

console.log("VIZIO AI: Background Service Worker Loaded com Motor SDK Local.");

// O Client pega a key da variavel, exatamente igual ao NPM q vc mostrou
const ai = new GoogleGenAI({ apiKey: "AIzaSyAcl2o8GEy-AvwGFC3vc3lxH-s2bl8P0KY" });

const SYSTEM_PROMPT = `Você é um Assistente de Acessibilidade Visual (VIZIO AI) para usuários totalmente cegos usando o Chrome.
Seu objetivo é extrair ou interagir com informações em uma página enviada como uma Árvore Semântica DOM e processar de acordo com a ordem do usuário.

Regras Absolutas:
1. Responda ESTRITAMENTE em JSON limpo e estruturado.
2. Formato exigido: {"action": "speak|click|focus", "targetId": "vizio-id-...", "ttsMessage": "Um texto amigável."}
3. "action": "speak" é só para ler texto.
4. "action": "click" caso a intenção do usuário no DOM necessite apertar algo. "targetId" obrigatório.`;

async function handleVoiceCommand(prompt) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab || activeTab.url.startsWith("chrome://") || activeTab.url.startsWith("edge://")) {
    chrome.tts.speak("Desculpe, não atuo em páginas de sistema.", { rate: 1.2 });
    chrome.runtime.sendMessage({ action: 'UPDATE_STATUS', statusText: 'Página Restrita' });
    return;
  }

  await chrome.tabs.update(activeTab.id, { muted: true });

  let domResponse;

  try {
    domResponse = await chrome.tabs.sendMessage(activeTab.id, { action: "EXTRACT_DOM" });
  } catch (err) {
    console.warn("Content Script ausente, injetando...");
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['src/content/content.js']
      });
      domResponse = await chrome.tabs.sendMessage(activeTab.id, { action: "EXTRACT_DOM" });
    } catch (injectErr) {
    }
  }

  if (!domResponse || domResponse.status !== 'success') {
    chrome.tts.speak("Não foi possível alcançar o corpo desse site.", { rate: 1.2 });
    chrome.runtime.sendMessage({ action: 'UPDATE_STATUS', statusText: 'DOM indisponível' });
    chrome.tabs.update(activeTab.id, { muted: false });
    return;
  }

  try {
    const domTree = domResponse.data;
    chrome.runtime.sendMessage({ action: 'UPDATE_STATUS', statusText: 'Gemini Analisando...' });
    chrome.tts.speak("Pensando.", { rate: 1.4 });

    // Utilizando o seu acesso exclusivo ao Gemini 2.5 Flash Lite via rota alpha!
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `Comando: "${prompt}"\n[DOM]:\n${JSON.stringify(domTree)}\n\n(Retorne as respostas estritamente neste formato JSON: {"action": "speak|click", "targetId": "vizio-id-X", "ttsMessage": "fala"})\nNão escreva nenhum texto fora as chaves do JSON!`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1
      }
    });

    // Extração agressiva usando Expressão Regular para o Gemini 3 (Que gosta de adicionar "Aqui está o JSON:")
    const textResp = response.text;
    const jsonMatch = textResp.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("O Gemini não cuspiu JSON algum: " + textResp);
    }
    const aiResponse = JSON.parse(jsonMatch[0]);
    console.log("Decisão oficial do Gemini JSON:", aiResponse);

    const { action, targetId, ttsMessage } = aiResponse;

    if (ttsMessage) {
      chrome.tts.speak(ttsMessage, { rate: 1.2 });
    }

    if ((action === 'click' || action === 'focus') && targetId) {
      chrome.tabs.sendMessage(activeTab.id, { action: "INTERACT", interactionType: action, targetId });
    }

    chrome.runtime.sendMessage({ action: 'UPDATE_STATUS', statusText: 'Concluído!' });

  } catch (err) {
    console.error("Falha ao usar Gemini Native SDK:", err);
    chrome.tts.speak("Houve uma falha na interpretação da inteligência.", { rate: 1.2 });
    chrome.runtime.sendMessage({ action: 'UPDATE_STATUS', statusText: 'Falha API' });
  } finally {
    setTimeout(() => chrome.tabs.update(activeTab.id, { muted: false }), 2000);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TRIGGER_VOICE_COMMAND') {
    handleVoiceCommand(request.prompt);
    sendResponse({ status: 'started' });
  }
  return true;
});
