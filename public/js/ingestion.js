// ShopEasy Data Analyst Agent — Ingestion & Schema Profiler Agent
// Dynamic schema detection, zero hardcoding, strict DD-MM-YYYY date parsing

const IngestionAgent = {
  // Parse CSV text adhering to RFC-4180 (handles commas, quotes, linebreaks)
  parseCSV(text) {
    const lines = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    // Normalize line endings
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          cell += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\n' && !inQuotes) {
        row.push(cell.trim());
        if (row.length > 0 && row.some(c => c !== '')) {
          lines.push(row);
        }
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }

    if (cell || row.length > 0) {
      row.push(cell.trim());
      if (row.length > 0 && row.some(c => c !== '')) {
        lines.push(row);
      }
    }

    if (lines.length < 2) {
      throw new Error('CSV file has insufficient data rows.');
    }

    const headers = lines[0];
    const rawRows = lines.slice(1);

    const data = rawRows.map(vals => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = vals[idx] !== undefined ? vals[idx] : '';
      });
      return obj;
    });

    return { headers, rows: data };
  },

  // Parse DD-MM-YYYY strictly into a Date object
  parseDDMMYYYY(str) {
    if (!str || typeof str !== 'string') return null;
    const trimmed = str.trim();
    const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed month
    const year = parseInt(match[3], 10);

    const date = new Date(Date.UTC(year, month, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month &&
      date.getUTCDate() === day
    ) {
      return date;
    }
    return null;
  },

  // Format Date object back strictly to DD-MM-YYYY
  formatDDMMYYYY(date) {
    if (!date || isNaN(date.getTime())) return '';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  },

  // Infer column data types and profile dataset dynamically
  profileDataset(headers, rows) {
    const totalRows = rows.length;
    let primaryDateCol = null;
    let minDate = null;
    let maxDate = null;

    const columns = headers.map(header => {
      let nonNullCount = 0;
      let dateMatches = 0;
      let numericMatches = 0;
      const uniqueValues = new Set();
      const sampleValues = [];

      rows.forEach(row => {
        const val = row[header];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const strVal = String(val).trim();
          nonNullCount++;
          uniqueValues.add(strVal);

          if (sampleValues.length < 5 && !sampleValues.includes(strVal)) {
            sampleValues.push(strVal);
          }

          // Check DD-MM-YYYY date format
          const parsedDate = this.parseDDMMYYYY(strVal);
          if (parsedDate) {
            dateMatches++;
          }

          // Check numeric format (clean symbols like ₹, $, commas)
          const cleanNumStr = strVal.replace(/[₹$,]/g, '').trim();
          if (cleanNumStr !== '' && !isNaN(Number(cleanNumStr))) {
            numericMatches++;
          }
        }
      });

      // Type inference heuristic based on non-null ratio
      let inferredType = 'text';
      const dateRatio = nonNullCount > 0 ? dateMatches / nonNullCount : 0;
      const numRatio = nonNullCount > 0 ? numericMatches / nonNullCount : 0;

      if (dateRatio >= 0.85) {
        inferredType = 'date';
        if (!primaryDateCol) primaryDateCol = header;
      } else if (numRatio >= 0.85) {
        inferredType = 'number';
      } else if (uniqueValues.size > 0 && uniqueValues.size <= Math.min(25, totalRows * 0.4)) {
        inferredType = 'category';
      } else {
        inferredType = 'text';
      }

      return {
        name: header,
        inferredType,
        uniqueCount: uniqueValues.size,
        sampleValues: sampleValues.slice(0, 3),
        nonNullCount
      };
    });

    // Compute dynamic date range if a date column was discovered
    let dateRange = null;
    if (primaryDateCol) {
      rows.forEach(r => {
        const d = this.parseDDMMYYYY(r[primaryDateCol]);
        if (d) {
          if (!minDate || d < minDate) minDate = d;
          if (!maxDate || d > maxDate) maxDate = d;
        }
      });

      if (minDate && maxDate) {
        dateRange = {
          start: this.formatDDMMYYYY(minDate),
          end: this.formatDDMMYYYY(maxDate),
          column: primaryDateCol
        };
      }
    }

    return {
      columns,
      rowCount: totalRows,
      sampleRows: rows.slice(0, 3),
      dateRange,
      primaryDateCol
    };
  },

  // Ingest data from user URL
  async fetchAndProfile(csvUrl) {
    if (!csvUrl || typeof csvUrl !== 'string') {
      throw new Error('Please enter a valid Google Sheet CSV URL.');
    }

    OperationsConsole.log('IngestionAgent', `Initiating silent fetch from URL: ${csvUrl.substring(0, 60)}...`);

    let csvText = '';

    // Attempt direct fetch first (works if published sheet has CORS enabled)
    try {
      const res = await fetch(csvUrl, { headers: { 'Accept': 'text/csv,text/plain,*/*' } });
      if (res.ok) {
        csvText = await res.text();
      } else {
        throw new Error(`Direct fetch status: ${res.status}`);
      }
    } catch (directErr) {
      OperationsConsole.log('IngestionAgent', `Direct client fetch blocked or failed (${directErr.message}). Routing through server proxy...`);
      // Route through local server proxy
      const proxyUrl = `/api/fetch-csv?url=${encodeURIComponent(csvUrl)}`;
      const proxyRes = await fetch(proxyUrl);
      if (!proxyRes.ok) {
        const errorJson = await proxyRes.json().catch(() => ({}));
        throw new Error(errorJson.error || `Failed to fetch CSV data via proxy (HTTP ${proxyRes.status})`);
      }
      csvText = await proxyRes.text();
    }

    if (!csvText || csvText.trim() === '') {
      throw new Error('Retrieved CSV data is empty.');
    }

    OperationsConsole.log('IngestionAgent', `CSV text retrieved successfully (${(csvText.length / 1024).toFixed(1)} KB). Parsing rows...`);

    const { headers, rows } = this.parseCSV(csvText);
    OperationsConsole.log('IngestionAgent', `Discovered ${headers.length} columns across ${rows.length} records.`);

    OperationsConsole.log('IngestionAgent', 'Profiling dynamic column types and date boundaries (DD-MM-YYYY)...');
    const profile = this.profileDataset(headers, rows);

    OperationsConsole.log(
      'IngestionAgent',
      `Profiling complete. Detected ${profile.columns.filter(c => c.inferredType === 'date').length} date, ` +
      `${profile.columns.filter(c => c.inferredType === 'number').length} numeric, ` +
      `${profile.columns.filter(c => c.inferredType === 'category').length} category columns.`
    );

    if (profile.dateRange) {
      OperationsConsole.log('IngestionAgent', `Computed dataset date range: ${profile.dateRange.start} to ${profile.dateRange.end}`);
    }

    return {
      headers,
      rows,
      profile
    };
  }
};

if (typeof window !== 'undefined') {
  window.IngestionAgent = IngestionAgent;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IngestionAgent;
}
