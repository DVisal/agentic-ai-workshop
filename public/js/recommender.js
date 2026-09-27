// ShopEasy Data Analyst Agent — Intent & Chart Recommender Agent
// Powered by Google Gemini 2.5 Flash with live interactive thumbnail previews

const ChartRecommenderAgent = {
  activeConfigs: [],

  // Request recommendations from Gemini 2.5 Flash via backend endpoint
  async getRecommendations(schema, questions, apiKey) {
    OperationsConsole.log('ChartRecommenderAgent', `Evaluating ${questions.length} business question(s) against discovered schema...`);
    OperationsConsole.log('ChartRecommenderAgent', 'Consulting Gemini 2.5 Flash (gemini-2.5-flash)...');

    const res = await fetch('/api/recommend-charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema, questions, apiKey })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to retrieve chart recommendations: HTTP ${res.status}`);
    }

    const data = await res.json();
    OperationsConsole.log('ChartRecommenderAgent', `Recommendations generated via ${data.source}. Rendering editable cards...`);
    return data.recommendations;
  },

  // Render editable cards with dynamic dropdowns and live thumbnail canvas
  renderEditableCards(containerId, recommendations, schema, rows) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const allColumns = schema.columns.map(c => c.name);
    const chartTypes = ['bar', 'line', 'donut', 'scatter', 'area'];
    const aggregations = ['sum', 'count', 'avg'];

    this.activeConfigs = recommendations.map((rec, index) => {
      // Validate initial properties
      const validX = allColumns.includes(rec.xAxis) ? rec.xAxis : allColumns[0];
      const validY = allColumns.includes(rec.yAxis) ? rec.yAxis : (allColumns[1] || allColumns[0]);
      const validChart = chartTypes.includes(rec.chartType) ? rec.chartType : 'bar';
      const validAgg = aggregations.includes(rec.aggregation) ? rec.aggregation : 'sum';

      return {
        id: `config-${index}`,
        question: rec.question,
        chartType: validChart,
        xAxis: validX,
        yAxis: validY,
        aggregation: validAgg,
        reasoning: rec.reasoning || 'Optimized mapping derived from dataset distribution.'
      };
    });

    this.activeConfigs.forEach((config, idx) => {
      const card = document.createElement('div');
      card.className = 'rec-card';
      card.id = `card-${config.id}`;

      card.innerHTML = `
        <div class="rec-header">
          <span class="rec-question">Q${idx + 1}: ${this.escapeHtml(config.question)}</span>
          <span class="badge badge-ai">Gemini 2.5 Flash</span>
        </div>

        <div class="rec-thumbnail-box">
          <canvas id="thumb-${config.id}" class="rec-thumbnail-canvas" width="360" height="140"></canvas>
        </div>

        <div class="rec-controls">
          <div class="control-item">
            <label class="control-label">Chart Style</label>
            <select class="select-input select-type" data-id="${config.id}">
              ${chartTypes.map(t => `<option value="${t}" ${t === config.chartType ? 'selected' : ''}>${t.toUpperCase()}</option>`).join('')}
            </select>
          </div>

          <div class="control-item">
            <label class="control-label">Calculation</label>
            <select class="select-input select-agg" data-id="${config.id}">
              ${aggregations.map(a => `<option value="${a}" ${a === config.aggregation ? 'selected' : ''}>${a.toUpperCase()}</option>`).join('')}
            </select>
          </div>

          <div class="control-item">
            <label class="control-label">Dimension / X-Axis</label>
            <select class="select-input select-x" data-id="${config.id}">
              ${allColumns.map(col => `<option value="${col}" ${col === config.xAxis ? 'selected' : ''}>${col}</option>`).join('')}
            </select>
          </div>

          <div class="control-item">
            <label class="control-label">Metric / Y-Axis</label>
            <select class="select-input select-y" data-id="${config.id}">
              ${allColumns.map(col => `<option value="${col}" ${col === config.yAxis ? 'selected' : ''}>${col}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="rec-reasoning">
          💡 ${this.escapeHtml(config.reasoning)}
        </div>
      `;

      container.appendChild(card);

      // Bind events for live thumbnail updates
      const typeSelect = card.querySelector('.select-type');
      const aggSelect = card.querySelector('.select-agg');
      const xSelect = card.querySelector('.select-x');
      const ySelect = card.querySelector('.select-y');

      const updateConfig = () => {
        config.chartType = typeSelect.value;
        config.aggregation = aggSelect.value;
        config.xAxis = xSelect.value;
        config.yAxis = ySelect.value;
        this.drawThumbnail(`thumb-${config.id}`, config, rows);
      };

      typeSelect.addEventListener('change', updateConfig);
      aggSelect.addEventListener('change', updateConfig);
      xSelect.addEventListener('change', updateConfig);
      ySelect.addEventListener('change', updateConfig);

      // Initial draw
      setTimeout(() => {
        this.drawThumbnail(`thumb-${config.id}`, config, rows);
      }, 50);
    });
  },

  // Draw clean mini preview thumbnail on canvas
  drawThumbnail(canvasId, config, rows) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Group sample data
    const sample = rows.slice(0, 15);
    const groups = {};
    sample.forEach(r => {
      const k = String(r[config.xAxis] || 'Other').slice(0, 10);
      const rawVal = String(r[config.yAxis] || '1').replace(/[₹$,]/g, '');
      const v = Number(rawVal) || 1;
      groups[k] = (groups[k] || 0) + v;
    });

    const labels = Object.keys(groups).slice(0, 6);
    const values = labels.map(l => groups[l]);
    const maxVal = Math.max(...values, 1);

    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

    if (config.chartType === 'donut') {
      const total = values.reduce((a, b) => a + b, 0) || 1;
      let startAngle = -Math.PI / 2;
      const centerX = width / 2;
      const centerY = height / 2;
      const outerRadius = Math.min(width, height) / 2 - 12;
      const innerRadius = outerRadius * 0.55;

      values.forEach((val, i) => {
        const sliceAngle = (val / total) * (Math.PI * 2);
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
        ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        startAngle += sliceAngle;
      });

      // Center text
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DONUT', centerX, centerY);
    } else if (config.chartType === 'line' || config.chartType === 'area') {
      const pad = 25;
      const step = (width - pad * 2) / Math.max(values.length - 1, 1);
      const points = values.map((val, i) => ({
        x: pad + i * step,
        y: height - pad - (val / maxVal) * (height - pad * 2)
      }));

      // Fill area if area chart
      if (config.chartType === 'area' && points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, height - pad);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, height - pad);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, pad, 0, height - pad);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Draw line
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.5;
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Points
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#60a5fa';
        ctx.fill();
      });
    } else {
      // Bar or Scatter
      const pad = 20;
      const count = Math.max(values.length, 1);
      const barWidth = Math.min((width - pad * 2) / count - 8, 30);
      const slotWidth = (width - pad * 2) / count;

      values.forEach((val, i) => {
        const x = pad + i * slotWidth + (slotWidth - barWidth) / 2;
        const barHeight = (val / maxVal) * (height - pad * 2 - 10);
        const y = height - pad - barHeight;

        if (config.chartType === 'scatter') {
          ctx.beginPath();
          ctx.arc(x + barWidth / 2, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = colors[i % colors.length];
          ctx.fill();
        } else {
          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
          ctx.fill();
        }
      });
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
  window.ChartRecommenderAgent = ChartRecommenderAgent;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChartRecommenderAgent;
}
