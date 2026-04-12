// src/utils/genai.js
// Um Polyfill Customizado 100% Vanilla JS desenhado para recriar 
// com exatidão matemática o funcionamento do pacote NPM @google/genai

export class GoogleGenAI {
  constructor(config = {}) {
    this.apiKey = config.apiKey;
    
    this.models = {
      generateContent: async (params) => {
        const { model, contents, config: requestConfig } = params;
        
        // Resolve versões betas antigas vs o novo alpha do Gemini 2 e 3 instantaneamente
        const apiVersion = model.startsWith("gemini-3") || model.startsWith("gemini-2") ? "v1alpha" : "v1beta";
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${this.apiKey}`;
        
        // Empacota o texto igual a biblioteca real do Node.js
        const payload = {
          contents: Array.isArray(contents) ? contents : [{ parts: [{ text: contents }] }]
        };

        if (requestConfig) {
            if (requestConfig.systemInstruction) {
                payload.system_instruction = { parts: { text: requestConfig.systemInstruction } };
            }
            if (requestConfig.responseMimeType) {
                payload.generationConfig = { responseMimeType: requestConfig.responseMimeType };
            }
            if (requestConfig.temperature !== undefined) {
                payload.generationConfig = { ...payload.generationConfig, temperature: requestConfig.temperature };
            }
            if (requestConfig.maxOutputTokens !== undefined) {
                payload.generationConfig = { ...payload.generationConfig, maxOutputTokens: requestConfig.maxOutputTokens };
            }
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Erro na API Gemini Core");
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
