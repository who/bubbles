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
