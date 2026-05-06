# PRD — Realized Gain/Loss Bubble Chart (MVP)

**Product name (working):** PnL Bubbles
**Document status:** Draft v1.0
**Owner:** TBD
**Last updated:** May 6, 2026
**Target release:** MVP — single-user, browser-only

---

## 1. Summary

A single-page web app that lets an individual options trader upload a brokerage activity CSV (Robinhood format for MVP) and instantly see a Schwab-style **Realized Gain/Loss Details** bubble chart of every closed position, plus a strip of headline trading metrics. The chart's timeline auto-fits to the date range in the file. No login, no server-side storage, no account linking.

The MVP exists to answer one question fast: *"How did my closed trades actually perform, visually, across the period in this file?"*

---

## 2. Goals & non-goals

### 2.1 Goals (MVP)

1. Let a user drag-and-drop or file-pick a CSV and see a rendered bubble chart in **under 5 seconds** for files up to 10,000 rows.
2. Match the Schwab "Realized Gain/Loss Details" visual language: date on X, % return on Y, translucent bubbles sized by |P/L|, green/red by sign.
3. Compute realized P/L using a defensible **matched-closes** methodology (see §6.2) and surface it in a stats strip.
4. Allow toggling the chart between two grouping modes: **By Contract** (unique strike + expiry) and **By Ticker**.
5. Run **100% client-side** — no upload to a server, no PII leaves the browser.

### 2.2 Non-goals (MVP)

- Multi-broker support beyond Robinhood. (Schwab, Fidelity, IBKR exports are post-MVP.)
- Stock/equity P/L. Options only for v1.
- Tax-lot accounting (FIFO/LIFO/specific-ID). MVP uses average cost on matched closes.
- Multi-currency, futures, crypto.
- User accounts, saved sessions, sharing.
- Mobile-first design (desktop-first; mobile is best-effort responsive).
- Real-time prices, open-position MTM.

---

## 3. Target user & primary use case

**Persona:** Self-directed retail options trader using Robinhood. Comfortable with spreadsheets but not a developer. Has dozens to a few thousand fills per month.

**Primary scenario:**
> "I exported my Robinhood activity CSV for last month. I want to drop it into something and immediately see which trades worked and which didn't, on one chart, the way Schwab shows it."

**Success looks like:** They drop the file, see the chart, hover three bubbles, screenshot it, close the tab. No friction in between.

---

## 4. User stories

| ID | As a... | I want... | So that... |
|----|---------|-----------|------------|
| U1 | trader | to drop a CSV onto the page | I can analyze it without filling out forms |
| U2 | trader | to see a bubble chart with date-axis | I can spot patterns over time |
| U3 | trader | to toggle between contract-level and ticker-level views | I can zoom out from individual trades to symbol-level performance |
| U4 | trader | to hover a bubble and see P/L, % return, qty, dates | I can identify the trade without re-opening my broker |
| U5 | trader | to see headline stats (gain/loss ratio, win rate, total P/L) | I can quickly judge the period |
| U6 | trader | to know my data isn't being uploaded anywhere | I'm comfortable using it |
| U7 | trader | to get a clear error if my CSV is malformed | I'm not stuck guessing why nothing rendered |

---

## 5. Scope — what's in the MVP

### 5.1 Pages & flows

A **single screen** with three states:

1. **Empty state** — drop zone + "Choose file" button + a "Use sample data" link + privacy note.
2. **Processing state** — drop zone collapses; a brief spinner with row-count progress.
3. **Results state** — stats strip on top, bubble chart below, view toggle, methodology footnote, "Upload another" affordance.

No additional routes. Refreshing the page returns to the empty state.

### 5.2 Components (logical breakdown)

- `<FileDropzone />` — drag/drop + click-to-browse, accepts `.csv` only
- `<CsvParser />` — pure function module, returns parsed rows or structured errors
- `<PnLEngine />` — pure function module, takes parsed rows and emits `Contract[]`, `Ticker[]`, `Summary`
- `<StatsStrip />` — five stat tiles (gain/loss ratio, total P/L, win rate, avg W/L, avg % return)
- `<BubbleChart />` — D3-scaled SVG, identical visual spec to the prototype (see §7)
- `<ViewToggle />` — switches grouping mode (Contract / Ticker)
- `<HoverTooltip />` — floating card on bubble hover
- `<ErrorBanner />` — top-of-page banner for unrecoverable parse errors

---

## 6. Data spec

### 6.1 Input CSV (Robinhood activity export)

The MVP targets the Robinhood activity export with these columns, in any order:

| Column | Type | Required | Notes |
|---|---|---|---|
| `Activity Date` | string `MM/DD/YYYY` | yes | Used as trade date |
| `Process Date` | string | no | Ignored by MVP |
| `Settle Date` | string | no | Ignored by MVP |
| `Instrument` | string | yes | Ticker symbol, e.g. `INTC` |
| `Description` | string | yes | e.g. `INTC 4/24/2026 Call $75.00` — used as contract key |
| `Trans Code` | enum | yes | `BTO`, `STC`, `BTC`, `STO`, `OEXP`, `CDIV`, others |
| `Quantity` | string/number | yes | May contain trailing `S` or commas |
| `Price` | string | no | Per-contract price; not used by P/L engine |
| `Amount` | string | yes | Currency string; negative values may be wrapped in parentheses, e.g. `($1,234.56)` |

**Edge cases the parser MUST handle:**

1. **Currency formatting** — strip `$`, commas, surrounding parentheses (which indicate negative).
2. **Quantity formatting** — strip trailing `S`, commas.
3. **Malformed rows** — Robinhood occasionally emits a row with an extra field. Skip such rows and emit a warning ("3 rows skipped: malformed"), do not abort the parse.
4. **Empty trailing rows** — drop rows where all fields are empty.
5. **Mixed-case column headers** — normalize headers to a known set; reject if required columns are missing.
6. **Date parsing** — `MM/DD/YYYY`. Reject the file with a clear error if any required date is unparseable.

### 6.2 P/L engine — matched-closes algorithm

For each unique `(Instrument, Description)` pair:

```
let bto_qty   = sum(Quantity where Trans Code = 'BTO')
let stc_qty   = sum(Quantity where Trans Code = 'STC')
let bto_amt   = sum(Amount   where Trans Code = 'BTO')   // negative numbers
let stc_amt   = sum(Amount   where Trans Code = 'STC')   // positive numbers

if stc_qty == 0 or bto_qty == 0:
    skip   // position is still open or only-sold (treat as out-of-scope)

let closed_qty    = min(bto_qty, stc_qty)
let cost_used     = bto_amt * (closed_qty / bto_qty)     // proportional, still negative
let proceeds_used = stc_amt * (closed_qty / stc_qty)     // proportional, positive
let pl            = cost_used + proceeds_used            // signed
let cost_basis    = abs(cost_used)
let pct_return    = (pl / cost_basis) * 100              // signed %
let close_date    = max(Activity Date) where Trans Code = 'STC'
let open_date     = min(Activity Date) where Trans Code = 'BTO'
```

For each unique `Instrument` (the ticker view), aggregate over all that ticker's contracts: sum `pl`, sum `cost_basis`, sum `closed_qty`, count contracts; `pct_return = sum(pl) / sum(cost_basis) * 100`; `close_date = max(close_date)` across contracts.

**Excluded from MVP:**
- `BTC` and `STO` (short-side opens/closes). Add in v1.1.
- `OEXP` (expirations). Treated as zero-proceeds closes is post-MVP.
- `CDIV` (dividends). Not P/L-relevant for options.

### 6.3 Output data shapes (TypeScript)

```ts
type RawTrade = {
  activityDate: Date;
  instrument: string;
  description: string;
  transCode: 'BTO' | 'STC' | 'BTC' | 'STO' | 'OEXP' | 'CDIV' | string;
  quantity: number;
  amount: number;  // signed
};

type ClosedContract = {
  instrument: string;
  description: string;
  pl: number;             // signed USD
  pctReturn: number;      // signed %
  closedQty: number;
  costBasis: number;      // positive USD
  proceeds: number;       // positive USD
  grossVolume: number;    // |bto_amt| + |stc_amt|
  closeDate: Date;
  openDate: Date;
  tradeCount: number;     // number of fills
};

type ClosedTicker = {
  instrument: string;
  pl: number;
  pctReturn: number;
  closedQty: number;
  costBasis: number;
  grossVolume: number;
  contracts: number;      // number of unique contracts under this ticker
  closeDate: Date;        // most recent close
  openDate: Date;         // earliest open
};

type Summary = {
  totalPl: number;
  totalGain: number;       // sum over winners
  totalLoss: number;       // abs sum over losers
  glRatio: number | null;  // totalGain / totalLoss; null if no losses
  winnersCount: number;
  losersCount: number;
  totalClosed: number;
  winRate: number;         // 0–100
  avgWin: number;
  avgLoss: number;         // signed (negative)
  avgPctWin: number;
  avgPctLoss: number;
  uniqueTickers: number;
  parseWarnings: string[]; // e.g. "3 rows skipped: malformed"
};
```

---

## 7. UI / visual specification

### 7.1 Layout

- Page max-width 1280px, centered, light gray (`#F5F6F8`) page background.
- Stats strip: 5 white cards in a horizontal flex row, each with a tiny uppercase label, a 22px primary value, and a small secondary line.
- Chart card: white, 1px border (`#DDE2E8`), 24-28px internal padding.
- Title: "Realized Gain/Loss Details" + "Chart based on N records." subtitle (matches the Schwab screenshot).
- View toggle: top-right of the chart card, two-button segment ("By Contract · N" / "By Ticker · N").

### 7.2 Bubble chart

| Property | Spec |
|---|---|
| X axis | Time (close date). Domain = data extent ± 2 days. Weekly tick labels formatted as `MMM D` (e.g. `Apr 9`). No axis line, no vertical gridlines. |
| Y axis | Linear, % return. Domain rounded to nearest 250% above/below the data's extent. Horizontal gridlines at every 250%. Solid darker line (`#3D4651`) at y=0. Tick labels formatted as `N%`. |
| Bubble color (gain) | Stroke `#2E7D32`, fill `rgba(76, 175, 80, 0.22)` |
| Bubble color (loss) | Stroke `#C62828`, fill `rgba(229, 57, 53, 0.22)` |
| Bubble stroke width | 1.5px default, 2.5px on hover |
| Bubble radius | `d3.scaleSqrt()` over `|pl|`, range `[4, 42]` px (so **area** is proportional to dollar P/L) |
| Render order | Largest bubbles first, so smaller ones are clickable on top |
| Background | White, no grid pattern |
| Font | System sans-serif (`-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial`) |
| Chart height | 540px desktop, min 380px |
| Tooltip | White card, top border colored by gain/loss, lists: contract/ticker name, close date, realized P/L (signed), % return (signed), cost basis, closed qty, plus contract count (ticker view) or trade fill count (contract view) |

### 7.3 States & micro-interactions

- **Empty:** Drop zone occupies the chart area. Subtitle: *"Drag your Robinhood activity CSV here, or click to browse. Your data never leaves this browser."*
- **Drag-over:** Drop zone border thickens; background tints to a faint blue.
- **Parsing:** Inline status `"Parsing 1,029 rows…"`. If parse takes >2s, show a determinate progress bar.
- **Render:** Bubbles fade in with a 200ms staggered animation (optional polish; not required for v1.0).
- **Hover:** Bubble's stroke thickens; tooltip card appears positioned just above the bubble; if near the right edge, tooltip flips to the left.
- **Empty result (no closed trades):** Replace chart with a friendly empty state: *"This file has no matched closes. All positions appear to still be open."*

### 7.4 Stats strip — precise contents

| Tile | Primary value | Sub-text |
|---|---|---|
| Gain/Loss Ratio | `totalGain / totalLoss` to 2 decimals | `${gainCompact} ÷ ${lossCompact}` |
| Total Realized P/L | `±$N,NNN.NN` | `${totalClosed} closed positions` |
| Win Rate | `N.N%` | `${W} W · ${L} L` |
| Avg Win / Avg Loss | `$X.XK / -$Y.YK` | `Reward:risk N.NN×` |
| Avg % Return | `+W.W% / -L.L%` | `winners / losers` |

---

## 8. Technical architecture

### 8.1 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | **TypeScript** (strict mode) | Required by user; gives us safety on the data model |
| Framework | **React 18** + **Vite** | Fast dev loop, simple SPA |
| CSV parsing | **PapaParse** | Battle-tested, handles streaming, tolerates malformed rows |
| Charting / scales | **D3** (`d3-scale`, `d3-time`, `d3-array`) for math, hand-rolled SVG for render | The prototype already uses this approach; gives precise visual control matching the Schwab screenshot |
| Date handling | `date-fns` | Lightweight, tree-shakable |
| Styling | Plain CSS or Tailwind (TBD) | No design system needed for MVP |
| Build/host | Vite static build, deploy to any static host (Vercel, Netlify, S3+CloudFront) | No backend |
| Testing | Vitest + React Testing Library | Standard with Vite |

### 8.2 Module boundaries

```
src/
├── parsing/
│   ├── parseCsv.ts           // PapaParse wrapper; returns RawTrade[] + warnings
│   ├── normalizers.ts        // parseAmount, parseQty, parseDate
│   └── parseCsv.test.ts
├── pnl/
│   ├── computePnl.ts         // RawTrade[] → { contracts, tickers, summary }
│   ├── computePnl.test.ts
│   └── types.ts
├── components/
│   ├── FileDropzone.tsx
│   ├── BubbleChart.tsx
│   ├── HoverTooltip.tsx
│   ├── StatsStrip.tsx
│   └── ViewToggle.tsx
├── App.tsx
└── main.tsx
```

The parsing and PnL modules are **pure functions** — no React, no DOM — so they can be unit-tested independently and reused later (e.g. a CLI variant).

### 8.3 Performance targets

- 1,000 rows → render in **<500ms** end-to-end on a mid-range laptop.
- 10,000 rows → render in **<5s**.
- Bubble chart should remain interactive (60fps hover) up to ~500 bubbles. Above that, consider virtualization or canvas (not in MVP scope).

### 8.4 Privacy & security

- **No network requests** are made with user data. Parsing and computation happen in-browser. State this prominently in the empty state.
- File contents are held only in memory; refreshing the page discards them.
- No analytics on file contents. If product analytics are added (Plausible, etc.), only aggregate events are sent (e.g. `file_uploaded`, `chart_rendered`, with row count bucketed) — never any field values.

---

## 9. Error handling

| Condition | Behavior |
|---|---|
| File is not `.csv` | Reject at dropzone with "Only .csv files are supported." |
| File is empty | Banner: "This file is empty." |
| Required column missing | Banner: "Couldn't find required column: `Trans Code`. Is this a Robinhood activity export?" |
| All rows malformed | Banner: "We couldn't parse any rows. Please check the file format." |
| Some rows malformed | Render normally; show a small warning chip: "3 rows were skipped." Clicking it expands details. |
| No closed positions | Render stats strip with "—" placeholders + chart empty state copy from §7.3 |
| File >50MB | Reject: "File is unusually large for an activity export. Max 50MB." |

---

## 10. Acceptance criteria (Definition of Done for MVP)

The MVP ships when **all** of these are true:

1. ✅ A user can drag a Robinhood CSV with at least 100 BTO/STC fills and see a rendered chart in under 5 seconds.
2. ✅ The headline numbers (total P/L, gain/loss ratio, win rate) match a hand-computed reference within ±$0.01 / ±0.1%.
3. ✅ The chart's X-axis auto-fits to the close-date range in the file, with weekly tick labels.
4. ✅ The chart's Y-axis auto-rounds to 250% increments and includes a darker zero line.
5. ✅ Bubbles are colored, sized, and positioned per §7.2.
6. ✅ Hovering a bubble shows the tooltip with all listed fields.
7. ✅ The view toggle correctly switches between contract-level and ticker-level groupings.
8. ✅ Unit tests cover the parser (≥80% line coverage) and the P/L engine (≥90% line coverage), including the malformed-row edge case from §6.1.
9. ✅ The build is a single static bundle deployable to any static host.
10. ✅ No outbound network requests carry user file content (verified with the network tab).

---

## 11. Out-of-scope / post-MVP backlog

These are deliberately deferred:

- **Schwab CSV**, **Fidelity CSV**, **IBKR Flex Query** support
- Equities and crypto P/L
- Open-position MTM with live prices
- Tax-lot accounting (FIFO/LIFO/specific-ID) and Schedule D export
- Time-window filter (last 30 days, YTD, custom)
- Search/filter by ticker
- Click-to-zoom and brushing on the chart
- Export chart as PNG/SVG
- Saved sessions / accounts
- Mobile-optimized layout
- Comparison mode (this period vs. last period)

---

## 12. Open questions

1. Should `OEXP` (expired worthless) count as a $0-proceeds close? *Default for MVP: exclude. Revisit when first user complains.*
2. Should we support short-side trades (`STO` → `BTC`) in MVP? *Default: no, defer to v1.1.*
3. Do we want the "By Ticker" view's bubble to be sized by `|sum(pl)|` or by `sum(|pl|)`? *Default: `|sum(pl)|` for consistency with Schwab; revisit.*
4. Should the empty state include a sample CSV link so users can play without their own file? *Recommended: yes.*

---

## 13. Appendix — reference numbers from the validation dataset

For regression testing, the engine should reproduce these numbers from the canonical Robinhood test CSV (April 2026, 1,029 rows after dropping 1 malformed line):

| Metric | Expected value |
|---|---|
| Closed contracts | 102 |
| Unique tickers (with closes) | 64 |
| Total Realized P/L | +$368,113.15 |
| Total gains | $409,307.91 |
| Total losses (abs) | $41,194.76 |
| Gain/Loss Ratio | 9.94 |
| Win rate | 83.3% |
| Avg win | $4,815.39 |
| Avg loss | -$2,423.22 |
| Best contract | INTC 4/24/2026 Call $75.00 → +$122,565.66 (+949.96%) |
| Worst contract | LITE 5/1/2026 Call $900.00 → -$10,643.14 (-47.95%) |
| Date range of closes | 2026-04-02 to 2026-04-30 |
| % return range | -78.9% to +950.5% |

These numbers should appear unchanged across builds; deviation is a regression.

---

*End of document.*
