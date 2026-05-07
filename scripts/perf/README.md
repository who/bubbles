# Perf harness (PRD §8.3)

Validates the three performance targets:

| Target | Path | Status |
|---|---|---|
| 1k rows: parse + compute < 500 ms | `npm run perf` (automated) | ✅ |
| 10k rows: parse + compute < 5 s | `npm run perf` (automated) | ✅ |
| 100+ bubbles: hover @ 60 fps | manual (Chrome perf panel) | see procedure below |

## Files

- `gen-csv.ts` — deterministic synthetic Robinhood-format CSV generator. Same `(rowCount, seed)` pair always produces byte-identical output. Emits matched BTO/STC pairs of options trades on a 10-ticker universe so every contract closes (full-pipeline work for the engine).
- `perf.test.ts` — vitest suite that drives `parseCsv → computeClosedContracts → computeSummary` against generated 1k and 10k CSVs and asserts latency thresholds. The 1k/10k cases are env-gated behind `PERF=1`; the cheap `gen-csv` determinism asserts always run.

## Running the automated harness

```bash
npm run perf
```

Equivalent to `PERF=1 vitest run scripts/perf/perf.test.ts --reporter=verbose` for the human-readable latency lines:

```bash
PERF=1 npx vitest run scripts/perf/perf.test.ts --reporter=verbose
```

`npm test` skips the heavy 1k/10k describe (no `PERF` env), so the default test loop stays fast.

## Latest measured results (mid-range Linux/WSL2 laptop, Node 25, 2026-05-07)

```
[perf 1k]  parse=11.4ms  compute=1.0ms  total=12.4ms  trades=1000   closed=500
[perf 10k] parse=25.7ms  compute=5.1ms  total=30.8ms  trades=10000  closed=4998
```

Both targets pass with comfortable headroom (~40× for 1k, ~160× for 10k).

## Manual: 60 fps hover with 100+ bubbles (AC4)

The bubble chart's hover behavior is rendered by React state, not measured by automated tests. Verify in a real browser:

1. `npm run dev`
2. Generate a CSV with ≥ 100 closed contracts (200+ rows):
   ```bash
   npx tsx -e "import('./scripts/perf/gen-csv.ts').then(m=>{require('node:fs').writeFileSync('/tmp/perf-200.csv', m.generateCsv(200))})"
   ```
   (or use any real activity export with 100+ closed positions)
3. Open Chrome DevTools → **Performance** panel → **Record**.
4. Drop the CSV onto the dropzone, wait for the chart, then sweep the cursor across the bubble field for ~5 seconds, hovering many distinct bubbles.
5. Stop recording.
6. Inspect the **FPS** track. Expect ≥ 55 fps sustained, no long red frame bars.
