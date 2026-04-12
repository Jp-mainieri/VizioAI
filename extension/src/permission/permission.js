// permission.js — VIZIO AI Microphone Permission Page

const grantBtn  = document.getElementById('grant-btn');
const feedback  = document.getElementById('feedback');
const micWrap   = document.getElementById('mic-wrap');

function showFeedback(type, msg) {
  feedback.textContent = msg;
  feedback.className   = `visible ${type}`;
}

grantBtn.addEventListener('click', async () => {
  grantBtn.disabled    = true;
  grantBtn.textContent = 'Aguardando permissão…';
  micWrap.classList.add('requesting');
  showFeedback('', 'Aguardando sua resposta no Chrome…');

  try {
    // Solicita acesso ao microfone — estamos em uma aba normal,
    // então o Chrome exibe corretamente a barra de permissão.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.info('[VIZIO permission] getUserMedia OK (microfone concedido nesta página da extensão).');

    // Libera imediatamente os tracks — só precisávamos do grant
    stream.getTracks().forEach(track => track.stop());

    // UI de sucesso
    micWrap.classList.remove('requesting');
    micWrap.classList.add('success');
    grantBtn.textContent = '✅ Microfone liberado!';
    showFeedback('success', 'Permissão concedida! Fechando esta aba…');

    // Notifica o background que a permissão foi concedida
    chrome.runtime.sendMessage({ action: 'MIC_PERMISSION_GRANTED' });

    // Fecha a aba após 1.5s
    setTimeout(() => {
      window.close();
    }, 1500);

  } catch (err) {
    console.error('[VIZIO permission] getUserMedia falhou (camada microfone, não Speech API):', err?.name, err?.message, err);
    micWrap.classList.remove('requesting');
    micWrap.classList.add('error');

    if (err.name === 'NotAllowedError') {
      grantBtn.textContent = '🎤 Tentar novamente';
      grantBtn.disabled    = false;
      showFeedback(
        'error',
        'Permissão negada. Clique no ícone 🔒 na barra de endereços e permita o microfone para esta extensão.'
      );
    } else {
      grantBtn.textContent = '🎤 Tentar novamente';
      grantBtn.disabled    = false;
      showFeedback('error', `Erro: ${err.message}`);
    }
  }
});
