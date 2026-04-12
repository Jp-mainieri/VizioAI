/**
 * VIZIO AI - Arquivo de Configuração
 * Preencha os valores abaixo com suas credenciais do Google Cloud Vertex AI.
 * 
 * DICA: Se você usa git, adicione este arquivo ao seu .gitignore para manter suas chaves seguras.
 */

export const VIZIO_CONFIG = {
  // O ID do seu projeto no Google Cloud
  PROJECT_ID: 'vizio-ai-493019',

  // A região onde o modelo está implantado (ex: us-central1)
  LOCATION: 'us-central1',

  // Sua API Key gerada no Google Cloud (com restrição para Vertex AI API)
  API_KEY: '',

  // Modelo do Gemini para usar no Vertex (ex: gemini-1.5-flash)
  MODEL_NAME: 'gemini-2.5-flash'
};
