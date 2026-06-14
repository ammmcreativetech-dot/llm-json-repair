# llm-json-repair

> Extract complete JSON objects from **partial, streaming, or malformed LLM output** — string-literal-aware, LaTeX-safe, with field-level recovery for truncated objects. **Zero dependencies.**

![types](https://img.shields.io/badge/types-included-blue)
![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![license](https://img.shields.io/badge/license-MIT-green)
![node](https://img.shields.io/badge/node-%E2%89%A518-339933)

LLMs that "stream JSON" don't stream *valid* JSON. While a response is in flight you get a half-written array, an object cut off mid-string, unescaped-looking LaTeX backslashes (`\frac`), or braces *inside* string values (`"the set {1,2,3}"`) that wreck a naive `text.match(/{[^}]*}/g)`. And `JSON.parse` throws until the very last byte arrives.

`llm-json-repair` walks the buffer with a **string-literal-aware brace scanner**: it returns every *complete* top-level `{…}` object the moment it closes, ignores braces inside strings, survives `\"` and `\\` escapes, and leaves a still-incomplete trailing object alone until more text arrives. For objects that never finish (the stream dropped mid-write), a field-level recovery pulls individual string values out anyway.

## Install

```bash
npm install llm-json-repair
```

## Quick start

### One-shot — a full or partial buffer

```ts
import { extractJsonObjects } from 'llm-json-repair';

const buffer = '[{"q":"the set {1,2,3}","a":"\\\\frac{1}{2}"},{"q":"x","a":"y"';
const objects = extractJsonObjects(buffer);
// → [ { q: 'the set {1,2,3}', a: '\\frac{1}{2}' } ]
//   the 2nd object is still incomplete, so it is skipped (not lost — call again later)
```

### Streaming — yield objects as they complete

```ts
import { createStreamingExtractor } from 'llm-json-repair';

const extractor = createStreamingExtractor();
for await (const chunk of llmStream) {        // OpenAI / Anthropic / Gemini token stream
  for (const obj of extractor.push(chunk)) {
    render(obj);                              // each object appears the instant it closes
  }
}
```

### Recover fields from a truncated object

```ts
import { extractStringFields } from 'llm-json-repair';

const partial = '{"front":"What is \\\\pi?","back":"3.14';   // stream died mid-write
extractStringFields(partial, ['front']);      // → { front: 'What is \\pi?' }
```

### Filter while extracting

```ts
extractJsonObjects(buffer, {
  requireKeys: ['"front"', '"back"'],   // only objects whose raw JSON contains these
  excludeKeys: ['"title"'],             // …and not these (e.g. skip source/meta blocks)
});
```

## API

| Export | Signature | Purpose |
| --- | --- | --- |
| `extractJsonObjects<T>` | `(buffer, options?) => T[]` | Every complete top-level object in the buffer. |
| `createStreamingExtractor<T>` | `(options?) => { push(chunk) => T[], buffer }` | Stateful; each `push` returns only newly-completed objects, never re-emitting earlier ones. |
| `extractStringFields` | `(slice, keys) => Record<string,string>` | Field-level recovery for an unparseable/truncated object; JSON-unescapes values. |
| `scanBalanced` | `(input, start) => number` | The low-level primitive: index of the `}` that closes the object at `start`, or `-1` if not yet complete. |

`options`: `{ requireKeys?: string[]; excludeKeys?: string[] }` — cheap substring pre-filters on the raw slice (before parsing).

## How it works

A single left-to-right pass tracks brace depth, but flips an `inString` flag on `"` and honors `\` escapes, so `{` / `}` inside string literals never change the depth. An object is emitted only when depth returns to `0`. That is the whole trick — and it's why `"\\frac{1}{2}"`, `"{not really an object}"` and `"he said \"hi\""` all parse correctly where a regex cannot. The streaming wrapper keeps a scan offset so it never re-parses what it already emitted.

## Why this exists

Extracted and generalized from the production AI-generation pipeline of **[quanta-study.de](https://quanta-study.de)**, where it turns live Gemini streams into flashcards in real time without ever losing a partial result on a dropped connection.

## Test

```bash
npm test   # builds, then runs the suite via Node's built-in test runner (no extra deps)
```

## License

MIT © [Amos Matzke](https://www.linkedin.com/in/amos-matzke-71a73139a) · [quanta-study.de](https://quanta-study.de)
