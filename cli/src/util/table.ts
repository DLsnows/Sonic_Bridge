/**
 * Minimal ASCII table renderer. Auto-fits column widths to the widest cell
 * (clamped to MAX_CELL_WIDTH). Cells longer than MAX_CELL_WIDTH are truncated
 * with an ellipsis.
 */

const MAX_CELL_WIDTH = 60;
const ELLIPSIS = "…";

export interface TableColumn {
  header: string;
  /** Cell key in row object */
  key: string;
  /** Optional max width override */
  maxWidth?: number;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  if (max <= 1) return s.slice(0, max);
  return s.slice(0, max - 1) + ELLIPSIS;
}

function toCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return String(v);
}

/**
 * Renders rows as an aligned ASCII table.
 *
 * Output format:
 *   header1  header2  header3
 *   -------  -------  -------
 *   row1     row2     row3
 */
export function renderTable(
  columns: TableColumn[],
  rows: Array<Record<string, unknown>>,
): string {
  const widths = columns.map((col) => {
    const max = col.maxWidth ?? MAX_CELL_WIDTH;
    const headerLen = col.header.length;
    let widest = headerLen;
    for (const row of rows) {
      const cell = truncate(toCell(row[col.key]), max);
      if (cell.length > widest) widest = cell.length;
    }
    return Math.min(widest, max);
  });

  const lines: string[] = [];

  // Header
  lines.push(
    columns.map((col, i) => col.header.padEnd(widths[i]!, " ")).join("  "),
  );
  // Separator
  lines.push(columns.map((_, i) => "-".repeat(widths[i]!)).join("  "));
  // Rows
  for (const row of rows) {
    lines.push(
      columns
        .map((col, i) => {
          const max = col.maxWidth ?? MAX_CELL_WIDTH;
          const cell = truncate(toCell(row[col.key]), max);
          return cell.padEnd(widths[i]!, " ");
        })
        .join("  "),
    );
  }

  return lines.join("\n");
}
