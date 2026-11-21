# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/huhahu221-commits/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/huhahu221-commits/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A drop-in replacement for `csv-reader` 1.0.0 that parses the same broken CSVs
about **4.3x faster**. The reference reads one character at a time and builds
every field with `value += c`, which allocates a fresh string per character.
This scans with slicing instead, so a field costs one slice rather than n
allocations, and takes a bulk path for records with no quotes in them.

The output is identical, not merely similar: all six practice cases match the
kit's `expected.json` byte for byte, and 4000 fuzzed inputs (quotes, CRLF, lone
CR, BOM, multi-byte text) produce the same `{columns, rows, errors}` as the
reference — same error codes, same order, same line and row numbers.

## Policy

Identical to `csv-reader` 1.0.0: a leading BOM is dropped; a record ends at LF
or CRLF and an empty line is no record; a lone CR outside quotes is dropped
(`stray_cr`); a quoted field runs to the next undoubled quote with `""` as one
quote and CRLF/lone CR inside becoming LF; text after the closing quote is
appended (`quote_junk` when characters were kept); an unclosed quote is a
literal character and the text after it is reread as unquoted
(`unterminated_quote`); a quote inside an unquoted field is literal; `columns`
is the first record when `header` is set; rows are padded (`short_row`) or cut
(`long_row`) to that width.

## Run it

```sh
node main.ts   # reads $MAKEFUN_INPUT_DIR/cases.json, writes $MAKEFUN_OUTPUT_DIR/answers.json
```

## Layout

- `solve.js` — the parser (`run({text, header})` → `{columns, rows, errors}`)
- `main.ts` — the driver the kit supplies
- `LICENSE` — MIT

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
