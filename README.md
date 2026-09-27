# ShopEasy Data Analyst Agent

A production-grade, multi-agent AI data analytics system designed for direct-to-consumer (D2C) e-commerce brands.

## 🚀 Overview

The **ShopEasy Data Analyst Agent** enables business stakeholders to connect their own live Google Sheet CSV datasets dynamically, formulate plain-English questions, curate visualization recommendations with live previews, and receive streamed executive insights powered exclusively by **Google Gemini 2.5 Flash (`gemini-2.5-flash`)**.

### Key Principles
- **100% Dynamic Schema Discovery:** Zero hardcoded column names, categories, cities, or metrics.
- **Strict Date Standard:** All dates are parsed, aggregated, and displayed in `DD-MM-YYYY` format.
- **Exclusively Gemini 2.5 Flash:** All AI reasoning and insight generation uses `gemini-2.5-flash`.
- **Progressive Disclosure:** Gated 5-step user journey with real-time operations logging.

---

## 🤖 Multi-Agent Architecture

The system coordinates 5 specialized agents:

1. **Orchestrator Agent (Master Engine):** Coordinates the sequential pipeline, manages state transitions (`Waiting`, `Running`, `Complete`, `Failed`), and streams telemetry to the dark terminal console.
2. **Ingestion & Profiler Agent (`IngestionAgent`):** Fetches runtime Google Sheet CSV data silently, infers dynamic data types (`date`, `number`, `category`, `text`), and computes dataset bounds.
3. **Intent & Chart Recommender Agent (`ChartRecommenderAgent`):** Powered by Gemini 2.5 Flash. Translates business questions into chart configurations with live interactive thumbnail previews.
4. **Data Aggregator & Visualization Agent (`VisualizerAgent`):** Groups and aggregates data, computes dynamic KPI summary cards, and renders charts sequentially.
5. **Strategic Insight Generator Agent (`InsightAgent`):** Powered by Gemini 2.5 Flash. Triggers only after all charts are rendered to stream up to 5 sharp, metric-tied, executive action points in real time.

---

## 📚 Documentation

- [agents.md](agents.md) — Comprehensive specification of the multi-agent system, state machine, and communication protocol.
- [instructions.md](instructions.md) — Step-by-step user journey, UI component specs, date parsing rules, and error handling.

---

## 🛠️ Repository Setup

```bash
# Clone the repository
git clone https://github.com/DVisal/agentic-ai-workshop.git

# Navigate into project directory
cd agentic-ai-workshop

# Start local server
npm start
```
