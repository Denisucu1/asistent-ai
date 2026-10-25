(function() {
  // Detect script config
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const API_BASE = (currentScript && currentScript.getAttribute('data-api')) || 'http://127.0.0.1:8000';
  const CLINIC_ID = (currentScript && currentScript.getAttribute('data-clinic')) || 'stomatologie';

  // Inject CSS if needed
  if (!document.getElementById('ai-widget-css')) {
    const link = document.createElement('link');
    link.id = 'ai-widget-css';
    link.rel = 'stylesheet';
    link.href = `${API_BASE}/widget/widget.css`;
    document.head.appendChild(link);
  }

  let conversationHistory = [];
  let isOpen = false;

  // Create Root DOM
  const root = document.createElement('div');
  root.id = 'ai-chat-root';
  root.innerHTML = `
    <!-- Launcher Button -->
    <button class="ai-launcher-btn" id="aiLauncherBtn" title="Discută cu Asistentul AI">
      <span class="ai-launcher-badge">1</span>
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
    </button>

    <!-- Chat Window -->
    <div class="ai-chat-window" id="aiChatWindow">
      <div class="ai-header" id="aiHeader">
        <div class="ai-header-info">
          <div class="ai-header-avatar" id="aiAvatar">Z</div>
          <div>
            <div class="ai-header-title" id="aiTitle">Clinica Zâmbet</div>
            <div class="ai-header-status">
              <span class="ai-status-dot"></span> Răspunde în &lt;5 secunde
            </div>
          </div>
        </div>
        <button class="ai-close-btn" id="aiCloseBtn">✕</button>
      </div>

      <div class="ai-messages-body" id="aiMessages">
        <!-- Initial Bot Message -->
        <div class="ai-msg bot">
          Bună! Te ajut cu drag cu orice informație despre tarife, orar sau o <b>programare rapidă</b>. Spune-mi ce te-ar interesa! ✨
        </div>

        <!-- Quick Chips -->
        <div class="ai-chips-wrap" id="aiChips">
          <div class="ai-chip" onclick="window.sendAiChip('Cât costă un detartraj?')">🦷 Cât costă un detartraj?</div>
          <div class="ai-chip" onclick="window.sendAiChip('Vreau o programare')">📅 Vreau o programare</div>
          <div class="ai-chip" onclick="window.sendAiChip('Unde aveți clinica?')">📍 Unde vă găsesc?</div>
          <div class="ai-chip" onclick="window.sendAiChip('Am o urgență dentară')">🚨 Am o urgență</div>
        </div>
      </div>

      <div class="ai-input-wrap">
        <input type="text" id="aiInput" placeholder="Scrieți un mesaj..." />
        <button class="ai-send-btn" id="aiSendBtn">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // References
  const launcherBtn = document.getElementById('aiLauncherBtn');
  const chatWindow = document.getElementById('aiChatWindow');
  const closeBtn = document.getElementById('aiCloseBtn');
  const inputEl = document.getElementById('aiInput');
  const sendBtn = document.getElementById('aiSendBtn');
  const messagesEl = document.getElementById('aiMessages');
  const badgeEl = root.querySelector('.ai-launcher-badge');

  function toggleChat(forceOpen) {
    isOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
    if (isOpen) {
      chatWindow.classList.add('open');
      if (badgeEl) badgeEl.style.display = 'none';
      inputEl.focus();
    } else {
      chatWindow.classList.remove('open');
    }
  }

  launcherBtn.addEventListener('click', () => toggleChat());
  closeBtn.addEventListener('click', () => toggleChat(false));

  function appendMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `ai-msg ${sender}`;
    // Simple bold markdown support
    div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>');
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'ai-typing';
    div.id = 'aiTypingIndicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('aiTypingIndicator');
    if (el) el.remove();
  }

  window.sendAiChip = function(text) {
    inputEl.value = text;
    sendMessage();
  };

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    conversationHistory.push({ role: 'user', text: text });
    inputEl.value = '';
    sendBtn.disabled = true;
    showTyping();

    // Hide chips after first user action
    const chips = document.getElementById('aiChips');
    if (chips) chips.style.display = 'none';

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          clinic_id: CLINIC_ID,
          history: conversationHistory
        })
      });

      const data = await res.json();
      hideTyping();
      appendMessage(data.reply || 'Vă rugăm să ne contactați telefonic.', 'bot');
      conversationHistory.push({ role: 'assistant', text: data.reply });

      // If phone was detected, show celebratory toast!
      if (data.lead_captured) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'ai-lead-alert';
        alertDiv.innerHTML = `✅ <b>Număr înregistrat (${data.phone_detected})!</b> Recepția a fost notificată pentru confirmare.`;
        messagesEl.appendChild(alertDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

    } catch (err) {
      hideTyping();
      appendMessage('Ne cerem scuze, conexiunea a fost întreruptă. Vă rugăm să încercați din nou.', 'bot');
      console.error('AI Chat Error:', err);
    }

    sendBtn.disabled = false;
    inputEl.focus();
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

})();
