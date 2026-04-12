# ANTIGRAVITY-INSTRUCTIONS.md — Guia do Desenvolvedor IA

## 1\. Contexto do Projeto

O **VIZIO AI** é uma extensão para Chrome voltada para acessibilidade (cegueira total). O objetivo é substituir a navegação por teclado (TAB) por uma interface 100% de voz.

## 2\. Stack Técnica Obrigatória

* **Framework:** Next.js (para o Dashboard/Popup)  
* **Autenticação/Banco:** Supabase  
* **UI:** shadcn/ui \+ Tailwind CSS  
* **Estilo:** Clean, Light Mode (Estética Vercel/Linear)  
* **Wake Word:** Picovoice Porcupine (WASM/Local)  
* **LLM:** Gemini 1.5 Pro ou GPT-4o para interpretação do DOM.

## 3\. Arquitetura de Arquivos Recomendada

/vizio-ai-extension

├── /public              \# Ativos estáticos e modelos WASM

├── /src

│   ├── /components      \# Componentes shadcn/ui

│   ├── /extension       \# Scripts específicos da extensão

│   │   ├── background.ts \# Gerencia estado, Wake Word e Mute

│   │   ├── content.ts    \# DOM Parser e execução de ações

│   │   └── inject.ts     \# Injeção de scripts na página

│   ├── /lib             \# Utilitários (Supabase client, AI logic)

│   └── /popup           \# Interface Next.js da extensão

├── manifest.json        \# Configuração da extensão Chrome v3

└── tailwind.config.js

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

