# ShopEasy Data Analyst Agent — Operational Instructions (`instructions.md`)

## 1. System Intent & Philosophy

The **ShopEasy Data Analyst Agent** is a multi-agent system built for business stakeholders who need instant, live, self-serve data intelligence without engineering assistance. 

### Core Tenets
1. **Dynamic Everything:** No assumptions or hardcoded references to columns, categories, cities, or questions. All schemas are discovered at runtime from the user-provided Google Sheet CSV URL.
2. **Strict Date Parsing:** All dates in the dataset follow `DD-MM-YYYY`. Any date parsing, filtering, aggregation, and display must conform strictly to `DD-MM-YYYY`.
3. **Sequential Deterministic Progression:** Each phase of the user journey is gated by user confirmation or upstream agent completion.
4. **Single LLM Engine:** All AI capabilities are powered exclusively by **Google Gemini 2.5 Flash (`gemini-2.5-flash`)**.

---

## 2. End-to-End User Journey Workflow

```
[ Step 1: Data Input ] ──► [ Schema & Sample Preview ] ──► [ User Confirms Data ]
                                                                   │
                                                                   ▼
[ Step 2: Question Input ] ◄───────────────────────────────────────┘
  (1 to 5 questions with guided placeholders)
        │
        ▼
[ Step 3: AI Recommendations ]
  (Gemini 2.5 Flash recommends chart type, axes, reasoning)
  (User edits configs via dynamic column dropdowns + live thumbnail)
        │
        ▼
[ User Confirms Configurations ]
        │
        ▼
[ Step 4: Multi-Agent Execution ]
  (Status Panel activates ──► Console logs real-time operations)
  (KPI cards calculate ──► Charts render sequentially one-by-one)
        │
        ▼
[ Step 5: AI Strategic Insights ]
  (Triggers ONLY after all charts complete)
  (Gemini 2.5 Flash streams max 5 actionable bullets with exact metrics)
```

---

## 3. UI/UX Component Specifications

### 3.1. Dashboard Header
- **Title:** ShopEasy Data Analyst Agent
- **Dynamic Date Range Badge:** Computed directly from the minimum and maximum dates discovered in the dataset (`DD-MM-YYYY` to `DD-MM-YYYY`).
- **Source Link:** Direct clickable link opening the connected Google Sheet in a new tab.
- **Refresh Button:** Restarts the full pipeline from scratch (re-fetches live CSV, re-runs analytical agents, re-renders charts, and re-streams insights).
- **Live Status Indicator:** Pulsing green badge indicating live active connection.

### 3.2. Agent Status Panel
- Displayed as a prominent horizontal strip above operations.
- Four distinct agent stations:
  1. `IngestionAgent` (Data Ingestion & Profiling)
  2. `ChartRecommenderAgent` (AI Intent & Chart Design)
  3. `VisualizerAgent` (Aggregation & Sequential Chart Rendering)
  4. `InsightAgent` (Strategic Insight Generation)
- Status states:
  - `Waiting`: Neutral gray badge
  - `Running`: Animated pulsating blue/amber badge
  - `Complete`: Solid emerald green check
  - `Failed`: Crimson red alert badge

### 3.3. Agent Operations Console
- Sleek, dark terminal aesthetic (`#0b0f19` background, monospace typography).
- Displays real-time timestamped operations log:
  - Format: `[HH:MM:SS.mmm] [AGENT_NAME] Process detail...`
  - Auto-scrolls to bottom on new log entry.
  - Controls to pause auto-scroll, copy logs, or clear terminal.

### 3.4. KPI Summary Cards
Dynamically identifies columns matching target business metrics:
- **Total Revenue:** Aggregated sum of monetary/revenue columns, formatted with locale currency notation.
- **Total Orders:** Count of unique transaction/order identifiers or total recorded transactions.
- **Average Delivery Days:** Mean duration derived from duration/delivery columns.
- **Dynamic Secondary Metrics:** (e.g. Average Order Value, Delivery Success Rate %) discovered automatically from numeric/status distributions.

### 3.5. Chart Sections
- One responsive visual container per confirmed business question.
- Header of each card displays the exact question formulated by the stakeholder.
- Rendered sequentially with loading skeleton states and animated completions.
- Supports interactive tooltips, data point inspection, and responsive resizing.

### 3.6. AI Strategic Insights Section
- Appears below or alongside charts.
- **Activation Gate:** Strictly remains in standby until the last chart finishes rendering.
- **Model:** `gemini-2.5-flash` with streaming delivery.
- Format requirements:
  - Maximum 5 bullet points.
  - Strictly data-grounded: every bullet quotes specific numerical metrics, percentages, or anomalies from the dataset.
  - Written in clear executive language (no raw technical jargon).
  - Explicit cause-and-action format: identifies the friction point and states the specific strategic remedy.
  - Clearly tagged with an `AI-Generated Analysis (Gemini 2.5 Flash)` badge.

---

## 4. Data Processing & Date Handling Guidelines

1. **Date Parsing Standard:**
   ```javascript
   // Dates must strictly parse DD-MM-YYYY format
   function parseDDMMYYYY(dateStr) {
     if (!dateStr || typeof dateStr !== 'string') return null;
     const parts = dateStr.trim().split('-');
     if (parts.length !== 3) return null;
     const day = parseInt(parts[0], 10);
     const month = parseInt(parts[1], 10) - 1; // 0-indexed month
     const year = parseInt(parts[2], 10);
     const date = new Date(Date.UTC(year, month, day));
     return isNaN(date.getTime()) ? null : date;
   }
   ```
2. **Schema Invariant:**
   Columns are analyzed using sample row inspection:
   - Contains dates matching `\d{2}-\d{2}-\d{4}` ➔ `date`
   - Numeric values ➔ `number`
   - Low cardinality strings (< 20 unique values) ➔ `category`
   - High cardinality strings ➔ `text` / `id`

---

## 5. Error Handling & Edge Case Management

- **Network / CORS Protection:** Google Sheets CSV fetch handles CORS and invalid URLs gracefully with intuitive inline error messages.
- **Empty / Incomplete Rows:** Automatically filtered out during ingestion.
- **Missing API Key:** Clear modal/notification allowing stakeholders to enter their Gemini API key with validation against `gemini-2.5-flash`.
- **Rerun Consistency:** Refresh clears in-memory state and re-executes all agents sequentially without full page reloads.
