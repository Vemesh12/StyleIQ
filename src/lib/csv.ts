// Small RFC 4180 CSV parser for admin bulk import: quoted fields, "" escaped
// quotes, commas and line breaks inside quotes, CRLF or LF line endings, and
// a UTF-8 byte-order mark (Excel adds one). No dependencies.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const BOM = String.fromCharCode(0xfeff);
  const input = text.startsWith(BOM) ? text.slice(1) : text;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (inQuotes) throw new Error('CSV has an unclosed quoted field.');
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Ignore blank lines.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Parses a CSV with a header row into records keyed by lower-cased,
 * trimmed column names. `line` is the 1-based line number in the file
 * (header = line 1), for error messages.
 */
export function parseCsvRecords(text: string): { headers: string[]; records: { line: number; values: Record<string, string> }[] } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const records = rows.slice(1).map((cells, i) => ({
    line: i + 2,
    values: Object.fromEntries(headers.map((h, j) => [h, (cells[j] ?? '').trim()])),
  }));
  return { headers, records };
}
