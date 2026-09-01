# Model selection

*Revised September 2026, when the project moved from an on-device model to the
Gemini API at the owner's direction.*

## What changed, and why it matters

The first build ran a pretrained ViT classifier plus a YOLOS region proposer
entirely in the browser, chosen after surveying ~100 waste models on the Hugging
Face Hub. That architecture was replaced with hosted Gemini calls.

This is a genuine trade, not an upgrade. Both sides are recorded here so the
decision stays reviewable.

| | On-device (previous) | Gemini API (current) |
|---|---|---|
| Model | `dima806/garbage_types_image_detection` (ViT-B/16) + `Xenova/yolos-tiny` | `gemini-3.7-flash` |
| Vocabulary | 12 fixed material classes | Open — names the actual object |
| Sees soiling | **No** — had to ask the user | **Yes**, usually |
| Photograph leaves the device | **Never** | **Always** |
| Works offline | Yes | No |
| Cost per use | Zero | Billed per request |
| First load | ~90 MB of weights | ~260 KB |
| Deploy artifact | 182 MB | 260 KB |
| Confidence figure | Softmax-derived, measurable | Model's self-report, uncheckable |
| Reproducible | Byte-identical every run | Varies; model updates silently |
| Failure mode | Confidently wrong within 12 classes | Confidently wrong about anything |

**What was gained:** an open vocabulary, direct soiling detection, far better
handling of unfamiliar and Indian household items, and a build that is three
orders of magnitude smaller.

**What was given up:** the privacy guarantee, offline operation, zero marginal
cost, reproducibility, and a confidence number that meant something. The
previous build's confidence came from a probability distribution and was
calibrated against measurements. Gemini's is a self-report — a number the model
writes about itself, which nothing forces to be consistent. The UI labels it as
such, and no claim is made that 90% means nine times in ten.

## Why `gemini-3.7-flash`

Chosen from the vision-capable text models — `gemini-3.7-flash`,
`gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`.

- **Flash, not Pro.** Naming a household object is not a reasoning-hard task.
  Pro costs more and is slower for no expected gain here.
- **Newest Flash.** Best image understanding in the tier.
- **Not the `*-image` models.** `gemini-3.1-flash-image`, `gemini-3-pro-image`
  (Nano Banana) and friends *generate* images. They are the wrong tool and are
  billed per generated image.

The model ID is a single constant in `src/config` (`GEMINI.MODEL`), so switching
tiers is a one-line change.

## Why the rules layer survived

Gemini is asked for **materials, not verdicts**. It reports what an item is and
what it is made of; the mapping to WET / DRY / HAZARDOUS / UNCERTAIN stays in
`src/ai/wasteRules`, deterministic and unit-tested.

That is deliberate. Letting the model decide the disposal stream directly would
make the most consequential step of the pipeline the least inspectable one, and
the answer could drift between model versions with nobody noticing. Constraining
`material` to the same 12-class enum also means the model can never return a
category the disposal rules have no answer for.

It is also why this migration touched `src/ai/` and the data-handling notice and
essentially nothing else — no component, hook or rule changed shape.

## Known weaknesses of the current approach

1. **Self-reported confidence is not calibrated.** Language models are known to
   overstate certainty. Treated as a coarse ordering signal only.
2. **Non-determinism.** The same photo can yield different answers, and Google
   can change the model under you without notice.
3. **The prompt is now part of the product.** A wording change alters behaviour
   as much as a model swap would. It lives in `src/ai/gemini/schema.ts` and
   should be reviewed like code.
4. **Every analysis is a disclosure.** The photograph and its contents go to a
   third party.
5. **No offline path.** A dead connection means a dead app.
6. **The API key is in the bundle.** See README → Security.
