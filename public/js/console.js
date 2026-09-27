// ShopEasy Data Analyst Agent — Operations Console Logger
const OperationsConsole = {
  container: null,
  autoScroll: true,

  init() {
    this.container = document.getElementById('terminal-logs');
    const autoScrollBtn = document.getElementById('btn-autoscroll');
    const copyBtn = document.getElementById('btn-copy-logs');
    const clearBtn = document.getElementById('btn-clear-logs');

    if (autoScrollBtn) {
      autoScrollBtn.addEventListener('click', () => {
        this.autoScroll = !this.autoScroll;
        autoScrollBtn.textContent = `Auto-scroll: ${this.autoScroll ? 'ON' : 'OFF'}`;
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!this.container) return;
        const text = this.container.innerText;
        navigator.clipboard.writeText(text).then(() => {
          const original = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = original; }, 1500);
        });
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (this.container) {
          this.container.innerHTML = '';
          this.log('Orchestrator', 'Console buffer cleared.');
        }
      });
    }

    this.log('Orchestrator', 'Operations Console initialized. Waiting for pipeline trigger.');
  },

  log(agentName, message) {
    if (!this.container) {
      this.container = document.getElementById('terminal-logs');
    }
    if (!this.container) return;

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const safeAgent = (agentName || 'System').replace(/[^a-zA-Z0-9]/g, '');

    entry.innerHTML = `
      <span class="log-time">[${timeStr}]</span>
      <span class="log-agent log-agent-${safeAgent}">[${agentName}]</span>
      <span class="log-msg">${this.escapeHtml(message)}</span>
    `;

    this.container.appendChild(entry);

    if (this.autoScroll) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  },

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

if (typeof window !== 'undefined') {
  window.OperationsConsole = OperationsConsole;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OperationsConsole;
}
