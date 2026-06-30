export class ParseError extends Error {
  public readonly input: string;

  constructor(message: string, input: string) {
    super(message);
    this.name = 'ParseError';
    this.input = input;
  }
}

const DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function parseAmount(input: string): number {
  if (typeof input !== 'string') {
    throw new ParseError('parseAmount: expected string', String(input));
  }
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new ParseError('parseAmount: empty string', input);
  }

  let body = trimmed;
  let negativeFromParens = false;
  if (body.startsWith('(') && body.endsWith(')')) {
    negativeFromParens = true;
    body = body.slice(1, -1).trim();
  }

  body = body.replace(/[$,\s]/g, '');

  if (body === '' || body === '-' || body === '+') {
    throw new ParseError(`parseAmount: not a number: "${input}"`, input);
  }

  const n = Number(body);
  if (!Number.isFinite(n)) {
    throw new ParseError(`parseAmount: not a number: "${input}"`, input);
  }

  return negativeFromParens ? -n : n;
}

export function parseQty(input: string): number {
  if (typeof input !== 'string') {
    throw new ParseError('parseQty: expected string', String(input));
  }
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new ParseError('parseQty: empty string', input);
  }

  const body = trimmed.replace(/[Ss]$/, '').replace(/,/g, '').trim();

  if (body === '') {
    throw new ParseError(`parseQty: not a number: "${input}"`, input);
  }

  const n = Number(body);
  if (!Number.isFinite(n)) {
    throw new ParseError(`parseQty: not a number: "${input}"`, input);
  }

  return n;
}

const OEXP_DESCRIPTION_PATTERN = /^Option Expiration for\s+(\S+)\s+(.+)$/i;

// Robinhood books an option expiration as
//   "Option Expiration for TSLA Call $420.00"
// but the BTO fill that opened the position is described as
//   "TSLA 4/29/2026 Call $420.00".
// To bucket the expiration with its opening trade we rewrite the OEXP
// description into the fill format, inserting the expiration date (which is
// the OEXP row's own activity date). Descriptions that don't match the
// expected shape are returned unchanged.
export function normalizeOexpDescription(description: string, expiration: Date): string {
  const match = OEXP_DESCRIPTION_PATTERN.exec(description.trim());
  if (!match) {
    return description;
  }
  const instrument = match[1];
  const rest = match[2];
  const month = expiration.getUTCMonth() + 1;
  const day = expiration.getUTCDate();
  const year = expiration.getUTCFullYear();
  return `${instrument} ${month}/${day}/${year} ${rest}`;
}

export function parseDate(input: string): Date {
  if (typeof input !== 'string') {
    throw new ParseError('parseDate: expected string', String(input));
  }
  const trimmed = input.trim();
  const match = DATE_PATTERN.exec(trimmed);
  if (!match) {
    throw new ParseError(`parseDate: expected MM/DD/YYYY: "${input}"`, input);
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12) {
    throw new ParseError(`parseDate: invalid month: "${input}"`, input);
  }
  if (day < 1 || day > 31) {
    throw new ParseError(`parseDate: invalid day: "${input}"`, input);
  }

  const ts = Date.UTC(year, month - 1, day);
  const d = new Date(ts);

  if (
    d.getUTCFullYear() !== year
    || d.getUTCMonth() !== month - 1
    || d.getUTCDate() !== day
  ) {
    throw new ParseError(`parseDate: invalid date: "${input}"`, input);
  }

  return d;
}
