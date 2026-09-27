// ShopEasy Data Analyst Agent — Main Application Orchestrator
// Coordinates the sequential pipeline, agent state transitions, and user interactions

const App = {
  state: {
    step: 1,
    csvUrl: '',
    sourceSheetUrl: '',
    headers: [],
    rows: [],
    profile: null,
    questions: [],
    recommendations: [],
    confirmedConfigs: [],
    kpis: null,
    apiKey: localStorage.getItem('gemini_api_key') || ''
  },

  init() {
    OperationsConsole.init();
    this.bindHeaderEvents();
    this.bindStep1Events();
    this.bindStep2Events();
    this.bindStep3Events();
    this.bindApiKeyModal();

    // Check server status
    this.checkServerStatus();

    OperationsConsole.log('Orchestrator', 'ShopEasy Data Analyst Multi-Agent Pipeline ready.');
    this.updateAgentState('IngestionAgent', 'Waiting');
    this.updateAgentState('ChartRecommenderAgent', 'Waiting');
    this.updateAgentState('VisualizerAgent', 'Waiting');
    this.updateAgentState('InsightAgent', 'Waiting');
  },

  async checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.hasApiKey && !this.state.apiKey) {
        OperationsConsole.log('Orchestrator', 'Server-side GEMINI_API_KEY detected.');
      }
    } catch (_) {}
  },

  // State Management for Agent Status Strip
  updateAgentState(agentName, state) {
    const card = document.getElementById(`agent-card-${agentName}`);
    if (!card) return;

    const badge = card.querySelector('.state-badge');
    if (!badge) return;

    badge.className = `state-badge state-${state.toLowerCase()}`;
    badge.textContent = state;

    OperationsConsole.log('Orchestrator', `State Transition: [${agentName}] ➔ ${state}`);
  },

  // Header Bindings
  bindHeaderEvents() {
    const refreshBtn = document.getElementById('btn-refresh-pipeline');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.resetAndRerun();
      });
    }

    const keyBtn = document.getElementById('btn-config-key');
    if (keyBtn) {
      keyBtn.addEventListener('click', () => {
        document.getElementById('api-key-modal').classList.remove('hidden');
      });
    }
  },

  bindApiKeyModal() {
    const modal = document.getElementById('api-key-modal');
    const closeBtn = document.getElementById('btn-close-modal');
    const saveBtn = document.getElementById('btn-save-key');
    const input = document.getElementById('input-gemini-key');

    if (input && this.state.apiKey) {
      input.value = this.state.apiKey;
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const val = input.value.trim();
        this.state.apiKey = val;
        localStorage.setItem('gemini_api_key', val);
        modal.classList.add('hidden');
        OperationsConsole.log('Orchestrator', val ? 'Gemini API Key updated in local storage.' : 'Gemini API Key cleared.');
      });
    }
  },

  // STEP 1: Data Source Ingestion
  bindStep1Events() {
    const fetchBtn = document.getElementById('btn-fetch-csv');
    const confirmBtn = document.getElementById('btn-confirm-schema');
    const urlInput = document.getElementById('input-csv-url');

    // Quick-load buttons
    document.querySelectorAll('.btn-load-sample').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = e.currentTarget.dataset.url;
        const sheet = e.currentTarget.dataset.sheet;
        urlInput.value = url;
        this.state.sourceSheetUrl = sheet;
        this.fetchData(url);
      });
    });

    if (fetchBtn) {
      fetchBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) {
          alert('Please paste a Google Sheet CSV URL');
          return;
        }
        this.fetchData(url);
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.goToStep(2);
      });
    }
  },

  async fetchData(csvUrl) {
    this.state.csvUrl = csvUrl;
    this.updateAgentState('IngestionAgent', 'Running');
    const btn = document.getElementById('btn-fetch-csv');
    btn.disabled = true;
    btn.textContent = 'Fetching Data...';

    try {
      const result = await IngestionAgent.fetchAndProfile(csvUrl);
      this.state.headers = result.headers;
      this.state.rows = result.rows;
      this.state.profile = result.profile;

      this.updateAgentState('IngestionAgent', 'Complete');
      this.renderSchemaPreview(result.profile);

      // Update Header with dynamic date range and source link
      if (result.profile.dateRange) {
        const dateBadge = document.getElementById('header-date-range');
        dateBadge.textContent = `📅 ${result.profile.dateRange.start} to ${result.profile.dateRange.end}`;
        dateBadge.classList.remove('hidden');
      }

      const sourceLink = document.getElementById('header-source-link');
      if (this.state.sourceSheetUrl) {
        sourceLink.href = this.state.sourceSheetUrl;
        sourceLink.classList.remove('hidden');
      } else if (csvUrl.includes('docs.google.com/spreadsheets')) {
        sourceLink.href = csvUrl;
        sourceLink.classList.remove('hidden');
      }

      document.getElementById('schema-preview-container').classList.remove('hidden');
      document.getElementById('btn-confirm-schema').scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
      this.updateAgentState('IngestionAgent', 'Failed');
      OperationsConsole.log('IngestionAgent', `ERROR: ${err.message}`);
      alert(`Error fetching data: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Fetch & Profile Data';
    }
  },

  renderSchemaPreview(profile) {
    const summaryEl = document.getElementById('preview-summary');
    const colsEl = document.getElementById('preview-columns');
    const tableEl = document.getElementById('preview-table');

    // Summary stats
    summaryEl.innerHTML = `
      <div class="stat-pill"><span class="stat-label">Total Rows:</span> <span class="stat-value">${profile.rowCount}</span></div>
      <div class="stat-pill"><span class="stat-label">Columns:</span> <span class="stat-value">${profile.columns.length}</span></div>
      ${profile.dateRange ? `<div class="stat-pill"><span class="stat-label">Date Range:</span> <span class="stat-value">${profile.dateRange.start} to ${profile.dateRange.end}</span></div>` : ''}
    `;

    // Columns pill strip
    colsEl.innerHTML = profile.columns.map(col => `
      <div class="column-pill">
        <span>${this.escapeHtml(col.name)}</span>
        <span class="type-badge type-${col.inferredType}">${col.inferredType}</span>
      </div>
    `).join('');

    // Sample 3 rows table
    let tableHtml = `<thead><tr>`;
    profile.columns.forEach(col => {
      tableHtml += `<th>${this.escapeHtml(col.name)}</th>`;
    });
    tableHtml += `</tr></thead><tbody>`;

    profile.sampleRows.forEach(row => {
      tableHtml += `<tr>`;
      profile.columns.forEach(col => {
        tableHtml += `<td>${this.escapeHtml(row[col.name] !== undefined ? row[col.name] : '')}</td>`;
      });
      tableHtml += `</tr>`;
    });
    tableHtml += `</tbody>`;
    tableEl.innerHTML = tableHtml;
  },

  // STEP 2: Business Questions
  bindStep2Events() {
    const addBtn = document.getElementById('btn-add-question');
    const quickLoadBtn = document.getElementById('btn-load-sample-questions');
    const submitBtn = document.getElementById('btn-submit-questions');
    const listEl = document.getElementById('questions-list');

    const sampleQuestions = [
      "Revenue Trend: How is revenue trending week over week this month — are we growing or slipping?",
      "Category Performance: Which product categories are driving the most revenue and which are underperforming?",
      "Top Markets: Which cities are our strongest markets by order volume and revenue?",
      "Fulfillment Rates: What percentage of orders are successfully delivered versus cancelled or returned?",
      "Delivery Efficiency: What is the average delivery time and are certain categories or cities taking significantly longer?"
    ];

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const count = listEl.querySelectorAll('.question-row').length;
        if (count >= 5) {
          alert('Maximum 5 questions allowed.');
          return;
        }
        this.addQuestionField(count + 1);
      });
    }

    if (quickLoadBtn) {
      quickLoadBtn.addEventListener('click', () => {
        listEl.innerHTML = '';
        sampleQuestions.forEach((q, idx) => {
          this.addQuestionField(idx + 1, q);
        });
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const inputs = listEl.querySelectorAll('.text-input');
        const questions = Array.from(inputs).map(i => i.value.trim()).filter(q => q.length > 0);

        if (questions.length === 0) {
          alert('Please enter at least 1 business question.');
          return;
        }

        this.state.questions = questions;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Generating AI Recommendations...';

        this.updateAgentState('ChartRecommenderAgent', 'Running');

        try {
          const recs = await ChartRecommenderAgent.getRecommendations(
            this.state.profile,
            this.state.questions,
            this.state.apiKey
          );
          this.state.recommendations = recs;
          this.updateAgentState('ChartRecommenderAgent', 'Complete');

          this.goToStep(3);
          ChartRecommenderAgent.renderEditableCards(
            'recommendations-container',
            recs,
            this.state.profile,
            this.state.rows
          );
        } catch (err) {
          this.updateAgentState('ChartRecommenderAgent', 'Failed');
          OperationsConsole.log('ChartRecommenderAgent', `Error: ${err.message}`);
          alert(`Recommendation error: ${err.message}`);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Questions & Generate AI Recommendations';
        }
      });
    }
  },

  addQuestionField(index, defaultVal = '') {
    const listEl = document.getElementById('questions-list');
    const row = document.createElement('div');
    row.className = 'question-row';

    const placeholders = [
      "e.g. How is total revenue trending week over week?",
      "e.g. Which product categories drive the highest sales?",
      "e.g. Which customer cities generate the most order volume?",
      "e.g. What percentage of orders are delivered vs returned?",
      "e.g. What is the average delivery duration by category?"
    ];

    row.innerHTML = `
      <div class="question-index">${index}</div>
      <input type="text" class="text-input" placeholder="${placeholders[(index - 1) % placeholders.length]}" value="${this.escapeHtml(defaultVal)}" />
      ${index > 1 ? '<button class="btn-remove-q" title="Remove question">&times;</button>' : '<div style="width: 28px;"></div>'}
    `;

    const removeBtn = row.querySelector('.btn-remove-q');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        row.remove();
        this.reindexQuestions();
      });
    }

    listEl.appendChild(row);
  },

  reindexQuestions() {
    const listEl = document.getElementById('questions-list');
    const rows = listEl.querySelectorAll('.question-row');
    rows.forEach((r, idx) => {
      r.querySelector('.question-index').textContent = idx + 1;
    });
  },

  // STEP 3: Confirm Chart Configurations
  bindStep3Events() {
    const confirmBtn = document.getElementById('btn-confirm-configs');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.state.confirmedConfigs = ChartRecommenderAgent.activeConfigs;
        OperationsConsole.log('Orchestrator', `User confirmed ${this.state.confirmedConfigs.length} chart configurations.`);
        this.goToStep(4);
        this.executeDashboardPipeline();
      });
    }
  },

  // STEP 4 & 5: Execute Dashboard & Stream Insights
  async executeDashboardPipeline() {
    // Phase 1: Compute dynamic KPIs
    this.updateAgentState('VisualizerAgent', 'Running');
    OperationsConsole.log('VisualizerAgent', 'Analyzing dataset distributions for KPI cards...');

    const kpiSummary = VisualizerAgent.computeKPIs(this.state.profile, this.state.rows);
    this.state.kpis = kpiSummary;

    this.renderKPICards(kpiSummary);
    OperationsConsole.log('VisualizerAgent', `KPIs Computed: Revenue = ${kpiSummary.totalRevenueFormatted}, Orders = ${kpiSummary.totalOrders}, Avg Delivery = ${kpiSummary.avgDeliveryDays || 'N/A'} days.`);

    // Phase 2: Render charts sequentially one by one
    await VisualizerAgent.renderDashboard(
      this.state.confirmedConfigs,
      this.state.profile,
      this.state.rows
    );

    this.updateAgentState('VisualizerAgent', 'Complete');

    // Phase 3: Trigger InsightAgent STRICTLY AFTER all charts have fully rendered
    this.updateAgentState('InsightAgent', 'Running');
    OperationsConsole.log('InsightAgent', 'Charts fully rendered. Activating Strategic Insight Generator (Gemini 2.5 Flash)...');

    await InsightAgent.streamInsights(
      'insights-container',
      kpiSummary,
      this.state.questions,
      this.state.confirmedConfigs,
      this.state.apiKey
    );

    this.updateAgentState('InsightAgent', 'Complete');
    OperationsConsole.log('Orchestrator', 'Full multi-agent analytics pipeline completed successfully.');
  },

  renderKPICards(kpis) {
    document.getElementById('kpi-revenue-val').textContent = kpis.totalRevenueFormatted;
    document.getElementById('kpi-orders-val').textContent = kpis.totalOrders.toLocaleString();
    document.getElementById('kpi-delivery-val').textContent = kpis.avgDeliveryDays ? `${kpis.avgDeliveryDays} Days` : 'N/A';
    
    const rateEl = document.getElementById('kpi-rate-val');
    if (rateEl) {
      rateEl.textContent = kpis.deliveryRate ? `${kpis.deliveryRate}%` : '100%';
    }
  },

  // Refresh pipeline from scratch
  resetAndRerun() {
    if (!this.state.csvUrl) {
      alert('No data source connected yet.');
      return;
    }

    OperationsConsole.log('Orchestrator', 'Pipeline Refresh triggered. Resetting agents and re-running pipeline from scratch...');

    this.updateAgentState('IngestionAgent', 'Waiting');
    this.updateAgentState('ChartRecommenderAgent', 'Waiting');
    this.updateAgentState('VisualizerAgent', 'Waiting');
    this.updateAgentState('InsightAgent', 'Waiting');

    // Jump to step 4 directly if questions are already confirmed, or rerun from step 1
    this.fetchData(this.state.csvUrl).then(() => {
      if (this.state.confirmedConfigs && this.state.confirmedConfigs.length > 0) {
        this.goToStep(4);
        this.executeDashboardPipeline();
      }
    });
  },

  goToStep(stepNum) {
    this.state.step = stepNum;

    // Toggle steps visibility
    for (let i = 1; i <= 4; i++) {
      const stepEl = document.getElementById(`step-${i}-container`);
      if (stepEl) {
        if (i === stepNum) {
          stepEl.classList.remove('hidden');
        } else {
          stepEl.classList.add('hidden');
        }
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    OperationsConsole.log('Orchestrator', `Transitioned to Step ${stepNum}`);
  },

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
