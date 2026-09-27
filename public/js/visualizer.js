// ShopEasy Data Analyst Agent — Data Aggregator & Visualization Agent
// Sequential chart rendering, dynamic KPI calculation, zero hardcoding

const VisualizerAgent = {
  chartInstances: {},

  parseDDMMYYYY(str) {
    if (!str || typeof str !== 'string') return null;
    const match = str.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const date = new Date(Date.UTC(year, month, day));
    return (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) ? date : null;
  },

  // Dynamically compute KPI summary cards from dataset without hardcoded names
  computeKPIs(schema, rows) {
    const columns = schema.columns || [];
    const numCols = columns.filter(c => c.inferredType === 'number').map(c => c.name);
    const dateCol = columns.find(c => c.inferredType === 'date')?.name;
    const catCols = columns.filter(c => c.inferredType === 'category').map(c => c.name);

    // Dynamic heuristic detection for KPIs
    const revenueCol = numCols.find(c => /revenue|sales|amount|price|total/i.test(c)) || numCols[0];
    const deliveryCol = numCols.find(c => /delivery|duration|days|lead/i.test(c));
    const statusCol = catCols.find(c => /status|fulfillment|state/i.test(c));
    const categoryCol = catCols.find(c => /category|type|dept/i.test(c)) || catCols[0];
    const cityCol = catCols.find(c => /city|region|location|market/i.test(c));

    let totalRevenue = 0;
    let totalOrders = rows.length;
    let deliveryDaysSum = 0;
    let deliveryDaysCount = 0;
    let deliveredCount = 0;

    const categoryRevenue = {};
    const categoryDelivery = {};
    const statusCounts = {};
    const cityRevenue = {};

    rows.forEach(r => {
      // Revenue
      if (revenueCol && r[revenueCol] !== undefined) {
        const clean = String(r[revenueCol]).replace(/[₹$,]/g, '').trim();
        const v = parseFloat(clean);
        if (!isNaN(v)) totalRevenue += v;
      }

      // Delivery Days
      if (deliveryCol && r[deliveryCol] !== undefined) {
        const clean = String(r[deliveryCol]).replace(/[^\d.-]/g, '').trim();
        const days = parseFloat(clean);
        if (!isNaN(days) && days > 0) {
          deliveryDaysSum += days;
          deliveryDaysCount++;

          if (categoryCol && r[categoryCol]) {
            const cat = String(r[categoryCol]).trim();
            if (!categoryDelivery[cat]) categoryDelivery[cat] = { sum: 0, count: 0 };
            categoryDelivery[cat].sum += days;
            categoryDelivery[cat].count++;
          }
        }
      }

      // Status
      if (statusCol && r[statusCol]) {
        const st = String(r[statusCol]).trim();
        statusCounts[st] = (statusCounts[st] || 0) + 1;
        if (/deliver/i.test(st)) deliveredCount++;
      }

      // Category breakdown
      if (categoryCol && r[categoryCol]) {
        const cat = String(r[categoryCol]).trim();
        let rev = 0;
        if (revenueCol && r[revenueCol]) {
          rev = parseFloat(String(r[revenueCol]).replace(/[₹$,]/g, '')) || 0;
        }
        categoryRevenue[cat] = (categoryRevenue[cat] || 0) + rev;
      }

      // City breakdown
      if (cityCol && r[cityCol]) {
        const city = String(r[cityCol]).trim();
        let rev = 0;
        if (revenueCol && r[revenueCol]) {
          rev = parseFloat(String(r[revenueCol]).replace(/[₹$,]/g, '')) || 0;
        }
        cityRevenue[city] = (cityRevenue[city] || 0) + rev;
      }
    });

    const avgDelivery = deliveryDaysCount > 0 ? (deliveryDaysSum / deliveryDaysCount).toFixed(1) : null;
    const deliveryRate = statusCol && totalOrders > 0 ? ((deliveredCount / totalOrders) * 100).toFixed(1) : null;

    // Format top categories
    const sortedCategories = Object.entries(categoryRevenue)
      .map(([name, rev]) => ({
        name,
        revenue: rev,
        revenueFormatted: this.formatCurrency(rev)
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Format category delivery
    const sortedCatDelivery = Object.entries(categoryDelivery)
      .map(([name, data]) => ({
        name,
        avgDays: (data.sum / data.count).toFixed(1)
      }))
      .sort((a, b) => b.avgDays - a.avgDays);

    // Format status
    const statusBreakdown = Object.entries(statusCounts).map(([name, count]) => ({
      name,
      count,
      pct: ((count / totalOrders) * 100).toFixed(1)
    }));

    // Format top cities
    const sortedCities = Object.entries(cityRevenue)
      .map(([name, rev]) => ({
        name,
        revenue: rev,
        revenueFormatted: this.formatCurrency(rev)
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue,
      totalRevenueFormatted: this.formatCurrency(totalRevenue),
      totalOrders,
      avgDeliveryDays: avgDelivery,
      deliveryRate,
      dateRange: schema.dateRange,
      aggregates: {
        categories: sortedCategories,
        categoryDelivery: sortedCatDelivery,
        statusBreakdown,
        cities: sortedCities
      }
    };
  },

  formatCurrency(num) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  },

  // Aggregate data according to configuration
  aggregateData(config, rows, isDateCol) {
    const xCol = config.xAxis;
    const yCol = config.yAxis;
    const agg = config.aggregation || 'sum';

    const groupMap = new Map();

    rows.forEach(r => {
      let xVal = r[xCol];
      if (xVal === undefined || xVal === null || String(xVal).trim() === '') {
        xVal = 'Unspecified';
      } else {
        xVal = String(xVal).trim();
      }

      let yVal = 1;
      if (yCol && r[yCol] !== undefined) {
        const clean = String(r[yCol]).replace(/[₹$,]/g, '').trim();
        const parsed = parseFloat(clean);
        if (!isNaN(parsed)) yVal = parsed;
      }

      if (!groupMap.has(xVal)) {
        groupMap.set(xVal, { sum: 0, count: 0, items: [] });
      }
      const entry = groupMap.get(xVal);
      entry.sum += yVal;
      entry.count += 1;
      entry.items.push(yVal);
    });

    let keys = Array.from(groupMap.keys());

    // Chronological sorting if X-axis is DD-MM-YYYY date
    if (isDateCol) {
      keys.sort((a, b) => {
        const da = this.parseDDMMYYYY(a);
        const db = this.parseDDMMYYYY(b);
        if (!da || !db) return 0;
        return da.getTime() - db.getTime();
      });
    } else {
      // Sort categorical by value descending (top 15)
      keys.sort((a, b) => {
        const valA = agg === 'avg' ? (groupMap.get(a).sum / groupMap.get(a).count) : groupMap.get(a).sum;
        const valB = agg === 'avg' ? (groupMap.get(b).sum / groupMap.get(b).count) : groupMap.get(b).sum;
        return valB - valA;
      });
      if (keys.length > 15) keys = keys.slice(0, 15);
    }

    const labels = keys;
    const data = keys.map(k => {
      const e = groupMap.get(k);
      if (agg === 'count') return e.count;
      if (agg === 'avg') return parseFloat((e.sum / (e.count || 1)).toFixed(2));
      return Math.round(e.sum);
    });

    return { labels, data };
  },

  // Sequential chart rendering one by one
  async renderDashboard(chartConfigs, schema, rows) {
    OperationsConsole.log('VisualizerAgent', 'Initiating sequential chart rendering pipeline...');

    // Destroy existing Chart.js instances if any
    Object.values(this.chartInstances).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') chart.destroy();
    });
    this.chartInstances = {};

    const container = document.getElementById('charts-container');
    if (!container) return;
    container.innerHTML = '';

    const palette = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b',
      '#06b6d4', '#6366f1', '#14b8a6', '#f97316', '#a855f7'
    ];

    for (let i = 0; i < chartConfigs.length; i++) {
      const config = chartConfigs[i];
      OperationsConsole.log('VisualizerAgent', `Processing Chart ${i + 1}/${chartConfigs.length}: "${config.question}"...`);

      // Create chart card container
      const card = document.createElement('div');
      card.className = 'chart-card';
      const canvasId = `chart-canvas-${i}`;

      card.innerHTML = `
        <div class="chart-header">
          <h3 class="chart-title">${this.escapeHtml(config.question)}</h3>
          <span class="chart-type-tag">${config.chartType.toUpperCase()}</span>
        </div>
        <div class="chart-canvas-wrapper">
          <canvas id="${canvasId}"></canvas>
        </div>
      `;
      container.appendChild(card);

      // Check if X-axis is a date column
      const colMeta = schema.columns.find(c => c.name === config.xAxis);
      const isDateCol = colMeta?.inferredType === 'date';

      // Perform dynamic aggregation
      const { labels, data } = this.aggregateData(config, rows, isDateCol);
      OperationsConsole.log('VisualizerAgent', `Aggregated ${labels.length} data points for Chart ${i + 1}.`);

      // Render chart with Chart.js or canvas fallback
      await this.renderSingleChart(canvasId, config, labels, data, palette);
      OperationsConsole.log('VisualizerAgent', `Chart ${i + 1} rendered successfully.`);

      // Brief visual pause to emphasize sequential agent execution
      await new Promise(r => setTimeout(r, 350));
    }

    OperationsConsole.log('VisualizerAgent', 'All charts have fully rendered.');
  },

  async renderSingleChart(canvasId, config, labels, data, palette) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Use Chart.js if available
    if (typeof Chart !== 'undefined') {
      const ctx = canvas.getContext('2d');
      const isDonut = config.chartType === 'donut';
      const isLine = config.chartType === 'line' || config.chartType === 'area';
      const isArea = config.chartType === 'area';

      let bgColors;
      if (isDonut) {
        bgColors = labels.map((_, idx) => palette[idx % palette.length]);
      } else if (isArea) {
        const grad = ctx.createLinearGradient(0, 0, 0, 300);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0.02)');
        bgColors = grad;
      } else {
        bgColors = '#3b82f6';
      }

      const chartConfig = {
        type: isDonut ? 'doughnut' : (isLine ? 'line' : (config.chartType === 'scatter' ? 'scatter' : 'bar')),
        data: {
          labels: labels,
          datasets: [{
            label: `${config.yAxis} (${config.aggregation})`,
            data: data,
            backgroundColor: bgColors,
            borderColor: isLine ? '#3b82f6' : (isDonut ? '#111622' : 'transparent'),
            borderWidth: isDonut ? 2 : (isLine ? 2.5 : 1),
            fill: isArea,
            tension: 0.35,
            pointRadius: isLine ? 3.5 : 0,
            pointBackgroundColor: '#60a5fa'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600, easing: 'easeOutQuart' },
          plugins: {
            legend: {
              display: isDonut,
              position: 'right',
              labels: { color: '#94a3b8', font: { family: '-apple-system, sans-serif', size: 11 } }
            },
            tooltip: {
              backgroundColor: '#161d2d',
              borderColor: '#242f45',
              borderWidth: 1,
              titleColor: '#f8fafc',
              bodyColor: '#93c5fd',
              padding: 10
            }
          },
          scales: isDonut ? {} : {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', maxRotation: 45, font: { size: 11 } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { size: 11 } }
            }
          }
        }
      };

      this.chartInstances[canvasId] = new Chart(ctx, chartConfig);
    } else {
      // Clean fallback canvas renderer if Chart.js CDN is unavailable
      this.renderFallbackCanvas(canvas, config, labels, data, palette);
    }
  },

  renderFallbackCanvas(canvas, config, labels, data, palette) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 400;
    const height = canvas.height = canvas.parentElement.clientHeight || 300;
    ctx.clearRect(0, 0, width, height);

    const pad = 40;
    const maxVal = Math.max(...data, 1);
    const count = data.length;
    const barWidth = Math.max((width - pad * 2) / count - 10, 15);
    const slot = (width - pad * 2) / count;

    data.forEach((val, i) => {
      const x = pad + i * slot + (slot - barWidth) / 2;
      const barH = (val / maxVal) * (height - pad * 2);
      const y = height - pad - barH;

      ctx.fillStyle = palette[i % palette.length];
      ctx.fillRect(x, y, barWidth, barH);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const labelText = String(labels[i]).slice(0, 8);
      ctx.fillText(labelText, x + barWidth / 2, height - pad + 15);
    });
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
  window.VisualizerAgent = VisualizerAgent;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VisualizerAgent;
}
