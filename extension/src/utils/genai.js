// src/utils/genai.js
// Polyfill customizado para Vertex AI (Google Cloud) REST API
// Compatível com Vanilla JS (Sem Build/Vite)
import { VIZIO_CONFIG } from './config.js';

export class GoogleGenAI {
  constructor() {
    this.projectId = VIZIO_CONFIG.PROJECT_ID;
    this.location  = VIZIO_CONFIG.LOCATION || 'us-central1';
    this.apiKey    = VIZIO_CONFIG.API_KEY;
    
    console.log(`VIZIO AI: Conectando ao Vertex AI (${this.location}/${this.projectId})`);
  }

  get models() {
    return {
      generateContent: async (params) => {
        const { model, contents, config: requestConfig } = params;
        
        // Endpoint REST do Vertex AI para o Gemini
        const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${model}:generateContent?key=${this.apiKey}`;
        
        const payload = {
          contents: Array.isArray(contents) ? contents : [{ role: "user", parts: [{ text: contents }] }]
        };

        if (requestConfig) {
          if (requestConfig.systemInstruction) {
            payload.system_instruction = { parts: [{ text: requestConfig.systemInstruction }] };
          }
          if (requestConfig.responseMimeType) {
            payload.generationConfig = { responseMimeType: requestConfig.responseMimeType };
          }
          if (requestConfig.temperature !== undefined) {
            payload.generationConfig = { ...payload.generationConfig, temperature: requestConfig.temperature };
          }
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Erro Vertex AI:", errorData);
          throw new Error(errorData[0]?.error?.message || errorData.error?.message || "Erro na API Vertex AI. Verifique se o Project ID e a API Key no seu config.js estão corretos.");
        }

        const data = await response.json();
        return {
          text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
          raw: data
        };
      }
    };
  }
}
