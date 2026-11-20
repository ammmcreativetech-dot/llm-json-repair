# llm-json-repair

TypeScript utilities for extracting complete JSON objects from streamed text and recovering selected completed string fields from an incomplete object. The source has no runtime dependencies.

## What does it do?

A string-aware brace scanner finds complete object slices. Those slices are parsed with `JSON.parse`, so braces inside JSON strings do not end an object. The streaming wrapper retains an offset and returns newly completed objects as chunks arrive.

## Build and use this repository

The npm name `llm-json-repair` currently identifies an unrelated publisher's package. This repository is distributed as source; its private manifest prevents accidental publication under that name. Use this checkout rather than an unverified npm installation command.

```sh
git clone https://github.com/ammmcreativetech-dot/llm-json-repair.git
cd llm-json-repair
npm install --ignore-scripts
npm test
```

`npm test` builds `dist/` with the declared TypeScript development dependency and runs the existing Node tests. From the built checkout:

```js
import {extractJsonObjects, createStreamingExtractor, extractStringFields} from './dist/index.js';

extractJsonObjects('prefix {"question":"Set {1, 2}","answer":"A set"} trailing');
// [{ question: 'Set {1, 2}', answer: 'A set' }]

const stream = createStreamingExtractor();
stream.push('[{"value":1},'); // [{ value: 1 }]
stream.push('{"value":2}]');  // [{ value: 2 }]

extractStringFields('{"front":"Complete","back":"still', ['front']);
// { front: 'Complete' }
```

## API and data handling

| Export | Purpose |
| --- | --- |
| `extractJsonObjects(buffer, options?)` | Parse complete object slices from text. |
| `createStreamingExtractor(options?)` | Accumulate chunks and emit newly completed objects. |
| `extractStringFields(slice, keys)` | Recover matching completed string fields. |
| `scanBalanced(input, start)` | Locate an object's closing brace, or return `-1`. |

`requireKeys` and `excludeKeys` are substring filters on raw slices, not schema validation. Balanced but invalid JSON is skipped; JSON escaping, including escaped LaTeX backslashes, still applies. Field recovery does not reconstruct an unfinished value or validate its meaning. The streaming buffer is retained, so consumers should bound input size for their workload.

## Quanta Study and maintenance

Maintained by Amos Matzke at [AM Creative Tech UG (haftungsbeschränkt)](https://quanta-study.de/am-creative-tech), the developer of **[Quanta Study — learning from your own materials](https://quanta-study.de/en)**. Quanta Study connects study materials with flashcards, self-tests and learning podcasts. This repository documents the reusable JSON utilities and their own API contract.

Report reproducible issues with a small non-sensitive input through this repository's Issues page. See `CITATION.cff` for attribution metadata.

## License

MIT, as provided in [LICENSE](./LICENSE). The repository's software license applies to the files provided here; it does not license Quanta Study's application or online learning articles.
