# ANTIGRAVITY-INSTRUCTIONS.md — Guia do Desenvolvedor IA

## 1\. Contexto do Projeto

O **VIZIO AI** é uma extensão para Chrome voltada para acessibilidade (cegueira total). O objetivo é substituir a navegação por teclado (TAB) por uma interface 100% de voz.

## 2. Stack Técnica
- **Linguagens:** HTML5, CSS3, JavaScript (Vanilla ES6).
- **Manifest:** Chrome Extension Manifest V3.
- **IA:** Google Gemini API (model: gemini-1.5-flash para baixa latência).
- **Storage:** chrome.storage.local (sem banco de dados externo para o MVP).

## 3. Estrutura de Arquivos
/vizio-ai
├── manifest.json
├── /icons
├── /popup
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── /scripts
│   ├── background.js   # Service Worker: Gerencia abas, áudio e chamadas ao Gemini
│   ├── content.js      # DOM Parser: Extrai árvore de acessibilidade
│   └── sidepanel.js    # Interface lateral (opcional)
└── /lib
    └── google-ai-sdk.js

## 4\. Regras de Implementação para a IA

1. **DOM Parsing Semântico:** Não envie o HTML bruto para a LLM. O `content.ts` deve extrair uma árvore de acessibilidade simplificada contendo apenas: `h1-h6`, `p`, `button`, `a`, `input` e elementos com `aria-label`.  
2. **Mecanismo de Auto-Mute:** Ao sinalizar o estado `LISTENING` (via background.ts), use `chrome.tabs.update(tabId, {muted: true})` para garantir que o ruído do site não interfira no comando do usuário.  
3. **Feedback de Voz (TTS):** Use a API `chrome.tts` ou uma integração de streaming para que a IA narre suas ações *enquanto* as executa (Ex: "Entendido, abrindo o formulário de contato...").  
4. **Ações Críticas:** Implemente um flag de segurança para botões de "Submit", "Pay" ou "Delete", exigindo uma confirmação verbal secundária.

## 5\. Referências de Arquivos

Consulte os arquivos na pasta `documentos-mvp`:

* `PRD.md`: Regras de negócio e requisitos funcionais.  
* `MVP-SCOPE.md`: Prioridades do que deve ser construído agora.  
* `DESIGN-GUIDELINES.md`: Especificações de cores e espaçamento.

