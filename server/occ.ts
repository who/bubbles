// OCC option-symbol helpers.
//
// The app identifies an option position either by its OCC option symbol
// (e.g. "AAPL260701C00290000") or by the Robinhood-style fill description it
// parses out of an export (e.g. "TSLA 4/29/2026 Call $420.00"). Unusual Whales
// keys its option-contract endpoints on the OCC symbol with no root padding,
// so this module normalises both forms onto that symbol and can recover the
// underlying ticker from it.

// UW option symbols carry no space padding on the root: <ROOT><YYMMDD><C|P><STRIKE*1000, 8 digits>.
const OCC_SYMBOL_PATTERN = /^([A-Z][A-Z.]*?)(\d{6})([CP])(\d{8})$/;

// "TSLA 4/29/2026 Call $420.00" — the Robinhood fill description shape.
const DESCRIPTION_PATTERN = /^([A-Z][A-Z.]*)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(Call|Put)\s+\$?([\d,]+(?:\.\d+)?)$/i;

export type OccContract = {
  ticker: string;
  occSymbol: string;
};

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

// True when the input is already a bare OCC option symbol.
export function isOccSymbol(input: string): boolean {
  return OCC_SYMBOL_PATTERN.test(input.trim().toUpperCase());
}

// Recover the underlying ticker from an OCC option symbol, or null if the
// input is not a well-formed symbol.
export function tickerFromOccSymbol(occSymbol: string): string | null {
  const match = OCC_SYMBOL_PATTERN.exec(occSymbol.trim().toUpperCase());
  return match?.[1] ?? null;
}

// Build the OCC option symbol from a Robinhood-style fill description, or null
// when the description does not match the expected shape.
export function occSymbolFromDescription(description: string): string | null {
  const match = DESCRIPTION_PATTERN.exec(description.trim());
  if (!match) {
    return null;
  }
  const [, root, monthStr, dayStr, yearStr, typeWord, strikeStr] = match;
  if (!root || !monthStr || !dayStr || !yearStr || !typeWord || !strikeStr) {
    return null;
  }

  const month = Number(monthStr);
  const day = Number(dayStr);
  const year = Number(yearStr);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const strike = Number(strikeStr.replace(/,/g, ''));
  if (!Number.isFinite(strike) || strike <= 0) {
    return null;
  }

  const yy = pad(year % 100, 2);
  const mm = pad(month, 2);
  const dd = pad(day, 2);
  const typeChar = typeWord.toLowerCase() === 'call' ? 'C' : 'P';
  // OCC encodes the strike in thousandths of a dollar, zero-padded to 8 digits.
  const strikeThousandths = pad(Math.round(strike * 1000), 8);

  return `${root.toUpperCase()}${yy}${mm}${dd}${typeChar}${strikeThousandths}`;
}

// Resolve any supported contract identifier (OCC symbol or fill description)
// into { ticker, occSymbol }, or null when it cannot be parsed.
export function parseContractId(id: string): OccContract | null {
  const trimmed = id.trim();
  if (trimmed === '') {
    return null;
  }

  if (isOccSymbol(trimmed)) {
    const occSymbol = trimmed.toUpperCase();
    const ticker = tickerFromOccSymbol(occSymbol);
    return ticker ? { ticker, occSymbol } : null;
  }

  const occSymbol = occSymbolFromDescription(trimmed);
  if (!occSymbol) {
    return null;
  }
  const ticker = tickerFromOccSymbol(occSymbol);
  return ticker ? { ticker, occSymbol } : null;
}
