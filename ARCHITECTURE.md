# Architecture

## Pipeline

```
                ┌─────────────┐   ┌──────────────┐
                │ Upload file │   │ Live camera  │
                └──────┬──────┘   └──────┬───────┘
                       │ magic-byte      │ capture frame
                       │ validation      │
                       └────────┬────────┘
                                ▼
                 ┌──────────────────────────────┐
                 │ Preprocessing (local)        │
                 │  decode + EXIF orientation   │
                 │  downscale to ≤1024 px       │
                 │  JPEG encode → base64        │
                 └──────────────┬───────────────┘
                                ▼
                 ┌──────────────────────────────┐
                 │ Gemini API  ── NETWORK ──▶    │
                 │  gemini-3.7-flash            │
                 │  structured JSON out         │
                 │  → name, material, soiled,   │
                 │    confidence, box_2d, scene │
                 └──────────────┬───────────────┘
                                ▼
                 ┌──────────────────────────────┐
                 │ Validation (local)           │
                 │  drop unknown materials      │
                 │  clamp confidence to 0..1    │
                 │  discard malformed boxes     │
                 └──────────────┬───────────────┘
                                ▼
                 ┌──────────────────────────────┐
                 │ Waste rules (local)          │
                 │  material → stream table     │
                 │  soiling handling            │
                 │  confidence gates            │
                 └──────────────┬───────────────┘
                                ▼
            WET · DRY · HAZARDOUS · UNCERTAIN  (+ caveats)
                                ▼
                 ┌──────────────────────────────┐
                 │ Summary + UI                 │
                 │  per-item cards + boxes      │
                 │  mixed-waste warning         │
                 └──────────────────────────────┘
```

Only one step crosses the network. Everything before and after it is local.

## Layout

```
src/
├── ai/                        no React, no DOM chrome
│   ├── engine/
│   │   ├── types.ts           InferenceEngine interface
│   │   ├── geminiEngine.ts    the only production implementation
│   │   └── registry.ts        swap point (this is how the ONNX build was replaced)
│   ├── gemini/
│   │   ├── apiKey.ts          build-time key, with a loud warning
│   │   ├── schema.ts          the prompt and the JSON contract
│   │   └── client.ts          REST call, response parsing, error mapping
│   ├── preprocessing/
│   │   ├── image.ts           decode, EXIF, resize, canvas helpers
│   │   └── validateFile.ts    magic-byte sniffing, size limits
│   ├── postprocessing/boxes.ts  geometry: area, IoU, clamp
│   └── wasteRules/
│       ├── categories.ts      the 12-class → stream table
│       ├── classify.ts        the decision function
│       └── summarize.ts       per-image aggregation
├── components/                presentational; talk only to hooks + types
├── hooks/                     useModel · useAnalysis · useCamera
├── config/index.ts            every threshold and the model ID
├── types/index.ts             shared types + AppError
└── pages/HomePage.tsx
```

Nothing in `src/components` imports from `src/ai/gemini`. Components see the
`InferenceEngine` interface and plain data.

## The engine seam

```ts
interface InferenceEngine {
  readonly id: string;
  readonly isLocal: boolean;           // drives the data-handling notice
  prepare(onStatus?): Promise<void>;
  analyze(image, options?): Promise<AnalysisResult>;
}
```

This seam earned its keep: swapping an on-device ONNX pipeline for a hosted API
changed `src/ai/` and one notice component, and left every hook, rule and
component intact.

`isLocal` is `false` here, and the UI reads it to decide what to tell the user
about where their photograph goes. An engine that uploads images must never
report `true` — that is the mechanism that stopped the old "analyzed locally on
this device" badge from surviving the migration as a lie.

## Why the model is not asked for the verdict

Gemini reports **materials**; the rules layer decides **bins**.

Asking the model directly for "WET or DRY" would be simpler and worse. It would
put the most consequential step of the pipeline outside version control: no unit
tests, no review, and silent drift whenever Google updates the model. Keeping the
mapping local means the disposal logic is a table you can read, diff and test —
and the same table survived a complete change of inference backend untouched.

Constraining `material` to the 12-class enum in the response schema also means
the model cannot hand back a category the rules have no entry for.

## Decision logic

Applied in order. Any gate that fails yields **UNCERTAIN**; nothing is forced
into WET or DRY.

1. **Validation.** Items with an unknown material, a non-numeric confidence, or
   confidence below `MIN_ITEM_CONFIDENCE` are dropped before they reach the
   rules. The schema is a request, not a guarantee.
2. **Material → stream.** `biological` → WET; `battery` → HAZARDOUS; `trash` →
   UNCERTAIN (the residual bucket, never evidence of a stream, however confident
   the model is); everything else → DRY.
3. **Confidence gate.** ≥0.85 high · ≥0.70 medium · below → UNCERTAIN.
4. **Soiling.** `yes` moves paper/cardboard/plastic to WET outright. `no` keeps
   them DRY. `unknown` keeps DRY but asks the user — the fallback that used to be
   the only option when the on-device model could not see contamination at all.

## Coordinates

Gemini returns `box_2d` as `[ymin, xmin, ymax, xmax]` normalised to a fixed
0-1000 grid regardless of the real image size. Both the y-first ordering and the
fixed scale have to be undone explicitly; getting either wrong yields boxes that
look plausible and sit in the wrong place. `toBox` in `geminiEngine.ts` does the
conversion and is unit-tested on non-square images for exactly that reason.

## Data handling

| Mechanism | Where | Effect |
|---|---|---|
| `connect-src 'self' https://generativelanguage.googleapis.com` | `index.html` | the browser blocks any upload to any *other* host |
| Inline base64 in the request | `gemini/client.ts` | the image is not staged on a third service first |
| Downscale to ≤1024 px | `preprocessing/image.ts` | less data sent, and billed |
| `engine.isLocal === false` | `components/common/DataNotice.tsx` | the UI states plainly that photos are uploaded |

This is a materially weaker guarantee than the previous local-only build, and the
app says so rather than implying otherwise.
