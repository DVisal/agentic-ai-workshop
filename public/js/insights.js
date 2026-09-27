// ShopEasy Data Analyst Agent — Strategic Insight Generator Agent
// Powered exclusively by Google Gemini 2.5 Flash (gemini-2.5-flash) in Streaming Mode

const InsightAgent = {
  // Generate insights via SSE stream
  async streamInsights(containerId, summary, questions, charts, apiKey) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="streaming-status">
        <span class="pulse-dot"></span>
        <span style="color: #f472b6; font-size: 0.9rem; font-weight: 600;">
          Gemini 2.5 Flash is analyzing metrics and formulating strategic recommendations...
        </span>
      </div>
      <div id="insights-stream-text" class="insights-content" style="margin-top: 1rem;"></div>
    `;

    const streamTextEl = document.getElementById('insights-stream-text');

    OperationsConsole.log('InsightAgent', 'Initializing real-time stream connection with Gemini 2.5 Flash...');
    OperationsConsole.log('InsightAgent', 'Grounding prompt with dynamic summary metrics and category distributions...');

    try {
      const response = await fetch('/api/stream-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, questions, charts, apiKey })
      });

      if (!response.ok) {
        throw new Error(`Insights streaming failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let rawText = '';

      OperationsConsole.log('InsightAgent', 'Stream connected. Receiving real-time tokens...');

      // Temporary element to hold streaming tokens
      streamTextEl.innerHTML = `<span id="current-stream"></span><span class="streaming-cursor"></span>`;
      const currentStream = document.getElementById('current-stream');

      let bulletCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.token) {
                  rawText += parsed.token;
                  currentStream.innerText = rawText;

                  // Log whenever a new bullet is completed
                  const bullets = rawText.split(/\n(?=•|\d+\.|\-)/);
                  if (bullets.length > bulletCount) {
                    bulletCount = bullets.length;
                    OperationsConsole.log('InsightAgent', `Streamed insight bullet ${bulletCount}...`);
                  }
                }
              } catch (_) {}
            }
          }
        }
      }

      // Format final bullets cleanly into cards
      OperationsConsole.log('InsightAgent', 'Stream complete. Finalizing executive insight bullets.');
      this.formatFinalBullets(container, rawText);

    } catch (err) {
      OperationsConsole.log('InsightAgent', `Insight streaming encountered an issue: ${err.message}. Rendering synthesized analysis.`);
      container.innerHTML = `
        <div style="color: #f87171; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">
          Error generating insights: ${this.escapeHtml(err.message)}
        </div>
      `;
    }
  },

  formatFinalBullets(container, fullText) {
    const rawLines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const bullets = [];

    rawLines.forEach(line => {
      // Clean leading bullet markers like "•", "*", "1.", etc.
      const cleaned = line.replace(/^[•*\-\d\.]+\s*/, '').trim();
      if (cleaned.length > 10) {
        bullets.push(cleaned);
      }
    });

    const finalBullets = bullets.slice(0, 5);

    if (finalBullets.length === 0) {
      finalBullets.push(fullText.trim());
    }

    let html = `<div class="insights-list">`;
    finalBullets.forEach((bullet) => {
      html += `
        <div class="insight-bullet">
          <span class="bullet-icon">⚡</span>
          <div class="bullet-text">${this.highlightMetrics(this.escapeHtml(bullet))}</div>
        </div>
      `;
    });
    html += `</div>`;

    container.innerHTML = html;
  },

  // Highlight percentages and currency metrics in insight text for visual punch
  highlightMetrics(text) {
    return text
      .replace(/(\d+(?:\.\d+)?%)/g, '<strong style="color: #38bdf8; font-weight: 700;">$1</strong>')
      .replace(/(₹[\d,]+(?:\.\d+)?)/g, '<strong style="color: #34d399; font-weight: 700;">$1</strong>')
      .replace(/(\d+(?:\.\d+)?\s*(?:days|day|orders|hours))/gi, '<strong style="color: #fbbf24; font-weight: 700;">$1</strong>');
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
  window.InsightAgent = InsightAgent;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InsightAgent;
}
