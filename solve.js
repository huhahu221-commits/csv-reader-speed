// solve.js — a faster drop-in for csv-reader 1.0.0.
//
// Same policy, different machinery. The reference reads one character at a time
// and builds every field with `value += c`, which allocates a new string per
// character. This version scans with indexOf-free slicing (one slice per field)
// and keeps a reused accumulator, so a field costs one slice instead of n.
//
// Policy (identical to csv-reader 1.0.0):
//   - a leading U+FEFF is dropped;
//   - a record ends at LF or CRLF; a line with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a quoted field runs to the next undoubled quote; "" inside is one quote;
//     CRLF and lone CR inside become LF; text after the closing quote up to the
//     next comma or line break is appended (quote_junk when characters were
//     actually kept); an unclosed quote is a literal character and the text
//     after it is reread as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character;
//   - columns is the first record when header, else null; rows are padded
//     (short_row, fields) or cut (long_row, extra) to the first record's width;
//   - each error is {code, line, row} in the order met; line is the 1-based line
//     the record starts on, counting every LF, CRLF and lone CR inside quotes.

const COMMA = 1;
const LINE_BREAK = 2;
const END = 3;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  // Written by the readers below.
  let field = '';
  let ended = END;
  let added = 0;

  while (true) {
    // Skip empty lines. A line holding only stray CRs leaves no characters.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos++; line++; }
      else if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; }
      else break;
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    const fields = [];
    let quoted;
    do {
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        readQuoted();
      } else {
        quoted = false;
        readUnquoted('');
      }
      fields.push(field);
    } while (ended === COMMA);

    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };

  // --- readers, closing over the state above ---

  function pushError(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Unquoted run from pos up to the next comma / line break / end.
  // Sets field, ended and added (the characters kept, stray CRs excluded).
  function readUnquoted(prefix) {
    let start = pos;
    let out = prefix;
    let kept = 0;
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 44) { // ,
        out += text.slice(start, pos);
        kept += pos - start;
        pos++;
        field = out;
        added = kept;
        ended = COMMA;
        return;
      }
      if (c === 10) { // \n
        out += text.slice(start, pos);
        kept += pos - start;
        pos++;
        line++;
        field = out;
        added = kept;
        ended = LINE_BREAK;
        return;
      }
      if (c === 13) { // \r
        out += text.slice(start, pos);
        kept += pos - start;
        if (text.charCodeAt(pos + 1) === 10) {
          pos += 2;
          line++;
          field = out;
          added = kept;
          ended = LINE_BREAK;
          return;
        }
        // A lone CR outside quotes is dropped and never counts as kept.
        pushError('stray_cr');
        pos++;
        start = pos;
        continue;
      }
      pos++;
    }
    out += text.slice(start, n);
    kept += n - start;
    field = out;
    added = kept;
    ended = END;
  }

  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos++; // opening quote
    let start = pos;
    let out = '';
    let closed = false;

    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 34) { // "
        if (text.charCodeAt(pos + 1) === 34) {
          out += text.slice(start, pos) + '"';
          pos += 2;
          start = pos;
          continue;
        }
        out += text.slice(start, pos);
        pos++;
        closed = true;
        break;
      }
      if (c === 13) { // \r inside quotes -> one LF
        out += text.slice(start, pos) + '\n';
        line++;
        pos += text.charCodeAt(pos + 1) === 10 ? 2 : 1;
        start = pos;
        continue;
      }
      if (c === 10) { // \n inside quotes
        out += text.slice(start, pos) + '\n';
        line++;
        pos++;
        start = pos;
        continue;
      }
      pos++;
    }

    if (!closed) {
      // Unclosed quote: it is literal; reread the text after it as unquoted.
      pos = open + 1;
      line = openLine;
      pushError('unterminated_quote');
      readUnquoted('"');
      return;
    }

    if (pos >= n) { field = out; added = out.length; ended = END; return; }

    const c = text.charCodeAt(pos);
    if (c === 44) { pos++; field = out; added = out.length; ended = COMMA; return; }
    if (c === 10) { pos++; line++; field = out; added = out.length; ended = LINE_BREAK; return; }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; field = out; added = out.length; ended = LINE_BREAK; return; }

    // Junk after the closing quote: appended as it stands. quote_junk only when
    // characters were actually kept (a dropped stray CR does not count).
    readUnquoted(out);
    if (added > 0) pushError('quote_junk');
  }
}
