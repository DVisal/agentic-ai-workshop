# ShopEasy Data Analyst Agent — Multi-Agent Architecture (`agents.md`)

## 1. System Overview

The **ShopEasy Data Analyst Agent** is a production-grade, multi-agent AI system designed for direct-to-consumer (D2C) e-commerce analytics. It enables business stakeholders to connect Google Sheet CSV datasets dynamically, formulate plain-English questions, curate visualization recommendations with live previews, and receive streamed executive insights powered exclusively by **Google Gemini 2.5 Flash (`gemini-2.5-flash`)**.

The system strictly adheres to dynamic schema discovery: **zero hardcoded column names, categories, cities, or metrics**. All dates follow the **DD-MM-YYYY** format standard across all parsing, calculations, and visual representations.

---

## 2. Multi-Agent Ecosystem

```
                                 ┌─────────────────────────────────┐
                                 │   Orchestrator Agent (Master)   │
                                 └───────────────┬─────────────────┘
                                                 │
            ┌────────────────────────────────────┼────────────────────────────────────┐
            │                                    │                                    │
            ▼                                    ▼                                    ▼
┌───────────────────────┐            ┌───────────────────────┐            ┌───────────────────────┐
│     Agent 1:          │            │       Agent 2:        │            │       Agent 3:        │
│ Ingestion & Profiler  ├───────────►│ Chart Recommender     ├───────────►│ Data Aggregator &     │
│                       │            │ (Gemini 2.5 Flash)    │            │ Visualization Engine  │
└───────────────────────┘            └───────────────────────┘            └───────────┬───────────┘
                                                                                      │
                                                                                      ▼
                                                                          ┌───────────────────────┐
                                                                          │       Agent 4:        │
                                                                          │ Strategic Insight     │
                                                                          │ Generator (Streaming) │
                                                                          └───────────────────────┘
```

---

## 3. Agent Specifications & Roles

### 3.1. Ingestion & Schema Profiler Agent (`IngestionAgent`)
- **Primary Responsibility:** Fetch runtime Google Sheet CSV data silently, parse rows, detect column types, compute dataset boundary metadata, and generate a schema profile.
- **Inputs:** Google Sheet published CSV URL.
- **Outputs:**
  - `columns`: Array of column metadata (`name`, `inferredType`: `date` | `number` | `category` | `text`, `uniqueCount`, `sampleValues`).
  - `sampleRows`: First 3 rows formatted for user preview.
  - `rowCount`: Total count of parsed data rows.
  - `dateRange`: Dynamic date bounds (`startDate`, `endDate`) formatted as `DD-MM-YYYY`.
- **Parsing Rules:**
  - Date detection regex: `^(\d{2})-(\d{2})-(\d{4})$` (DD-MM-YYYY).
  - Strict type inference without preconceived schemas.
  - Calculation of summary boundaries (e.g. non-empty values, null checks).

### 3.2. Intent & Chart Recommender Agent (`ChartRecommenderAgent`)
- **Primary Responsibility:** Translate user business questions (1 to 5) into optimized visual chart specifications using Gemini 2.5 Flash.
- **Model:** `gemini-2.5-flash`
- **Inputs:**
  - Dataset schema profile (`columns`, types, sample values).
  - Array of business questions in natural English.
- **Outputs:**
  - Recommended `chartType`: `bar` | `line` | `donut` | `scatter` | `area`.
  - `xAxis`: Column name suitable for dimension/category/date.
  - `yAxis`: Column name suitable for metric/value.
  - `aggregation`: `sum` | `count` | `avg` | `none`.
  - `reasoning`: Single-line non-technical explanation.
- **Interactive Handoff:** Serves recommendations to the UI as editable cards with dynamic dropdowns populated strictly from available schema columns, enabling instant thumbnail updates.

### 3.3. Data Aggregator & Visualization Agent (`VisualizerAgent`)
- **Primary Responsibility:** Execute data transformation, grouping, and aggregation based on confirmed chart configurations and render charts sequentially.
- **Trigger:** Initiated only after stakeholder explicitly confirms chart configurations.
- **Outputs:**
  - Processed time-series, categorical aggregations, or distribution vectors.
  - Standardized Chart.js / ECharts visual definitions.
  - Dynamic KPI Summary Cards:
    - Dynamic revenue metric (sum of any numeric column matching revenue/sales/amount).
    - Dynamic order/transaction count (row count or distinct ID count).
    - Dynamic fulfillment metric (average delivery days / duration where present).
- **Execution Mode:** Charts render one by one in sequence, dispatching progress events to the Agent Operations Console.

### 3.4. Strategic Insight Generator Agent (`InsightAgent`)
- **Primary Responsibility:** Perform multi-dimensional analysis on aggregated data and generate sharp, non-jargon business insights.
- **Trigger:** Activates **strictly after all charts have fully rendered**.
- **Model:** `gemini-2.5-flash` (Streaming Mode via SSE).
- **Outputs:**
  - Maximum 5 crisp actionable bullet points.
  - Each insight is tied to exact quantitative figures from the dataset (percentages, averages, revenue figures).
  - Format: Identifies specific problem and states immediate operational recommendation.
  - Bullet-by-bullet real-time streaming display.

### 3.5. Operations Supervisor & Orchestrator (`Orchestrator`)
- **Primary Responsibility:** Coordinate sequential pipeline progression, manage lifecycle states across all agents (`Waiting`, `Running`, `Complete`, `Failed`), and log timestamped telemetry into the Agent Operations Console.
- **Lifecycle Events:**
  - `AGENT_STATE_CHANGE`: Updates Agent Status Panel horizontally.
  - `AGENT_LOG`: Emits timestamped terminal outputs: `[HH:MM:SS] [AgentName] Message`.
  - `PIPELINE_RESET`: Triggered by Header Refresh button to rerun pipeline from scratch.

---

## 4. Agent State Machine & Status Protocol

| Agent | Initial State | Transition 1 | Transition 2 | Terminal State |
| :--- | :--- | :--- | :--- | :--- |
| **IngestionAgent** | `Waiting` | `Running` (URL submitted) | `Complete` (Schema preview ready) | `Complete` / `Failed` |
| **ChartRecommenderAgent** | `Waiting` | `Running` (Questions submitted) | `Complete` (Configs generated) | `Complete` / `Failed` |
| **VisualizerAgent** | `Waiting` | `Running` (Configs confirmed) | Iterative per-chart completion | `Complete` / `Failed` |
| **InsightAgent** | `Waiting` | `Running` (All charts rendered) | Streaming tokens/bullets | `Complete` / `Failed` |

---

## 5. Security & Constraint Guardrails

1. **Zero Hardcoding Guarantee:**
   - Any column, category, or city name is discovered at runtime.
   - Fallback strategies dynamically map the best candidates based on statistical profiling rather than string heuristics.
2. **Date Format Invariance:**
   - Parsing: `parseDDMMYYYY(str)` maps standard `DD-MM-YYYY` dates into ISO UTC timestamps for aggregation while preserving `DD-MM-YYYY` formatting in all user-facing views.
3. **LLM Exclusivity:**
   - Only `gemini-2.5-flash` is invoked. System prompts strictly restrict hallucinatory metrics by supplying computed aggregate summaries in context.
