// popup.js


document.getElementById('simulate-btn').addEventListener('click', () => {
const statusEl = document.getElementById('status');
const customPrompt = document.getElementById('prompt-input').value.trim();

if (!customPrompt) {
    statusEl.innerText = 'Digite um comando!';
    return;
}

statusEl.innerText = 'Iniciando IA...';

chrome.runtime.sendMessage({ action: 'TRIGGER_VOICE_COMMAND', prompt: customPrompt }, (response) => {
    if (response && response.status === 'started') {
        statusEl.innerText = 'Processando DOM...';
    }
});
});

// Escuta atualizações de status que vêm do background.js
chrome.runtime.onMessage.addListener((request) => {
if (request.action === 'UPDATE_STATUS') {
    document.getElementById('status').innerText = request.statusText;
}
});
