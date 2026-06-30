// Derive a compact OCC-style option symbol from a Robinhood-style fill.
// The fill Description has the form 'TICKER M/D/YYYY Call|Put $STRIKE'
// (e.g. 'AMD 5/15/2026 Call $185.00'); combined with the instrument (ticker)
// this yields the standard OCC symbol: ROOT + YYMMDD + C/P + strike×1000
// zero-padded to 8 digits — 'AMD260515C00185000'.
//
// Anything that doesn't match (already-normalized, non-option, or unexpected
// formatting) falls back to the trimmed Description so the table still shows a
// recognizable label rather than a blank cell.
const DESCRIPTION_RE = /^\s*\S+\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(Call|Put)\s+\$([\d,]+(?:\.\d+)?)\s*$/i;

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function toOccSymbol(instrument: string, description: string): string {
  const match = DESCRIPTION_RE.exec(description);
  if (!match) return description.trim();

  const [, month, day, year, right, strikeRaw] = match;
  if (
    month === undefined || day === undefined || year === undefined
    || right === undefined || strikeRaw === undefined
  ) {
    return description.trim();
  }
  const yy = year.slice(2);
  const mm = pad2(Number(month));
  const dd = pad2(Number(day));
  const rightCode = right.charAt(0).toUpperCase(); // 'C' (Call) | 'P' (Put)
  const strikeThousandths = Math.round(Number(strikeRaw.replace(/,/g, '')) * 1000);
  const strike8 = String(strikeThousandths).padStart(8, '0');
  const root = instrument.trim().toUpperCase();

  return `${root}${yy}${mm}${dd}${rightCode}${strike8}`;
}
