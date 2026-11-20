/**
 * llm-json-repair
 * ----------------
 * Extract complete valid JSON object slices from streamed or partial text.
 *
 * The scanner is string-literal-aware: it tracks brace depth but ignores `{`/`}`
 * that appear *inside* JSON string literals (honoring `\"` and `\\` escapes), so
 * LaTeX (`"\\frac{1}{2}"`), sets (`"{1,2,3}"`), code snippets and quoted braces
 * never corrupt the scan the way a naive `/{[^}]*}/` regex would.
 *
 * Zero dependencies. ESM. Fully typed.
 */

export interface ExtractOptions {
  /** Only keep objects whose raw JSON slice contains ALL of these substrings. */
  requireKeys?: string[];
  /** Drop objects whose raw JSON slice contains ANY of these substrings. */
  excludeKeys?: string[];
}

/**
 * Return the index of the `}` that closes the object beginning at `start`,
 * or `-1` if the object is not yet complete (e.g. the stream is still in flight).
 * String-literal aware.
 */
export function scanBalanced(input: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < input.length; i++) {
    const ch = input[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      if (--depth === 0) return i;
    }
  }
  return -1;
}

function passesFilters(slice: string, options: ExtractOptions): boolean {
  if (options.requireKeys && !options.requireKeys.every((k) => slice.includes(k))) return false;
  if (options.excludeKeys && options.excludeKeys.some((k) => slice.includes(k))) return false;
  return true;
}

/**
 * Return every COMPLETE top-level `{…}` object found in `buffer`, parsed with
 * `JSON.parse`. A trailing, still-incomplete object (common while streaming) is
 * left untouched — call again once more text has arrived.
 */
export function extractJsonObjects<T = Record<string, unknown>>(
  buffer: string,
  options: ExtractOptions = {},
): T[] {
  const out: T[] = [];
  let i = 0;
  while (i < buffer.length) {
    const start = buffer.indexOf('{', i);
    if (start === -1) break;
    const end = scanBalanced(buffer, start);
    if (end === -1) break; // incomplete trailing object — wait for more input
    const slice = buffer.slice(start, end + 1);
    i = end + 1;
    if (!passesFilters(slice, options)) continue;
    try {
      out.push(JSON.parse(slice) as T);
    } catch {
      // Balanced but not valid JSON (rare) — skip. Use extractStringFields for partials.
    }
  }
  return out;
}

/**
 * Field-level recovery for an object that was truncated mid-stream and therefore
 * cannot be `JSON.parse`d. Pulls individual string fields by key via a
 * backslash-aware regex and JSON-unescapes the value (so `\n`, `\"` and LaTeX
 * `\\frac` survive). Returns whatever fields it could find.
 */
export function extractStringFields(slice: string, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const re = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
    const m = slice.match(re);
    if (!m) continue;
    let value: string = m[1] ?? '';
    try {
      value = JSON.parse(`"${m[1]}"`) as string;
    } catch {
      // keep the raw (still-escaped) value
    }
    out[key] = value;
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface StreamingExtractor<T> {
  /** Feed the next chunk; returns only the objects that became complete with it. */
  push(chunk: string): T[];
  /** The full accumulated buffer so far (read-only). */
  readonly buffer: string;
}

/**
 * Stateful streaming wrapper. Feed token/SSE chunks as they arrive; each `push`
 * returns only the objects that newly completed, never re-emitting earlier ones.
 *
 * @example
 * const extractor = createStreamingExtractor();
 * for await (const chunk of llmStream) {
 *   for (const obj of extractor.push(chunk)) render(obj);
 * }
 */
export function createStreamingExtractor<T = Record<string, unknown>>(
  options: ExtractOptions = {},
): StreamingExtractor<T> {
  let buffer = '';
  let offset = 0; // scan position: everything before this has been fully consumed
  return {
    get buffer() {
      return buffer;
    },
    push(chunk: string): T[] {
      buffer += chunk;
      const out: T[] = [];
      while (offset < buffer.length) {
        const start = buffer.indexOf('{', offset);
        if (start === -1) {
          offset = buffer.length;
          break;
        }
        const end = scanBalanced(buffer, start);
        if (end === -1) {
          offset = start; // resume here when more text arrives
          break;
        }
        const slice = buffer.slice(start, end + 1);
        offset = end + 1;
        if (!passesFilters(slice, options)) continue;
        try {
          out.push(JSON.parse(slice) as T);
        } catch {
          // skip invalid slice
        }
      }
      return out;
    },
  };
}
