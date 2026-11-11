/**
 * VIZIO AI - Arquivo de Configuração (modelo)
 *
 * Copie este arquivo para `config.js` (na mesma pasta) e preencha com as credenciais
 * do seu projeto no Google Cloud Vertex AI. O `config.js` está no .gitignore e NÃO
 * deve ser commitado: ele guarda a sua API key.
 */

export const VIZIO_CONFIG = {
  // O ID do seu projeto no Google Cloud
  PROJECT_ID: 'seu-projeto-no-google-cloud',

  // A região onde o modelo está implantado (ex: us-central1)
  LOCATION: 'us-central1',

  // Sua API Key gerada no Google Cloud (com restrição para Vertex AI API)
  API_KEY: '',

  // Modelo do Gemini para usar no Vertex (ex: gemini-2.5-flash)
  MODEL_NAME: 'gemini-2.5-flash'
};
