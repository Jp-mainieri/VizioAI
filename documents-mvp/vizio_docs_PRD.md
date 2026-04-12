# VIZIO AI — Product Requirements Document (PRD)

## 1. Visão Geral
O VIZIO AI transforma o DOM complexo em uma conversa fluida, permitindo que o usuário interaja com sites como se estivesse conversando com um assistente humano que "enxerga" a tela por ele.

## 2. User Story Principal
"Como um usuário cego, quero dizer 'OK, VIZIO' e pedir para pesquisar uma notícia, para que eu possa consumir conteúdo sem depender de dezenas de toques na tecla TAB."

## 3. Requisitos Funcionais
* **RF-01 (Wake Word):** Detecção local de "OK, VIZIO" via Porcupine WASM.
* **RF-02 (Auto-Mute):** Silenciar áudio da aba ativa imediatamente após a detecção da Wake Word para garantir pureza no STT.
* **RF-03 (Semantic Parsing):** Script de extração que prioriza h1-h6, p, aria-labels e elementos interativos, ignorando scripts e estilos.
* **RF-04 (Streaming TTS):** Narração simultânea ("Digitando...", "Clicando...") enquanto o agente executa a ação.
* **RF-05 (Confirmação):** Bloqueio de ações em botões de envio/pagamento até confirmação verbal "Sim".

## 4. Requisitos Não-Funcionais
* **Performance:** Resposta inicial de áudio em < 2s.
* **Privacidade:** Processamento da Wake Word 100% local (on-device).

## 5. Casos de Borda
Se houver múltiplos botões idênticos, a IA deve numerá-los e perguntar qual o usuário prefere.