# AI Waste Segregation

Photograph an item, find out whether it belongs in the **wet**, **dry**, or
**hazardous** bin. Classification is done by Google's Gemini API (`gemini-3.5-flash`, with
automatic fallback); the disposal rules are applied locally and
deterministically.

When it doesn't know, it says **UNCERTAIN** rather than guessing.

> **Your photos are uploaded to Google.** Every analysis sends the image to the
> Gemini API. This build has no offline mode and makes no privacy guarantee.

---

## Quick start

```bash
npm install
cp .env.example .env      # then paste a key from https://aistudio.google.com/apikey
npm run dev               # http://localhost:5173
```

Without a key the app loads and tells you exactly what to set. Nothing else works
until it is set — there is no local fallback.

### Optional: saved reports and the dashboard

To keep a record of each analysis, set `IMGBB_API_KEY`, `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, then run the migrations once:

```
supabase/001_reports.sql        →  paste into the Supabase SQL editor
supabase/002_report_delete.sql  →  then this, to allow deleting reports
```

Until you do, the **My reports** tab says exactly that and names the file. With
it in place, saving a report uploads both images, files the verdict, place and
time, and the dashboard lists everything from this device, each with a downloadable
**PDF report** carrying both photographs, the item table, the location and both
timestamps.

> **Both images are uploaded to ImgBB, which has no access control.** Every
> returned URL is viewable by anyone who has it. Street photographs can contain
> people, faces and number plates. The app says this before the first upload.

---

## Deploying to Vercel

The Gemini and image-host keys are held by serverless functions in `api/`, not
by the browser. Set these in **Settings → Environment Variables**:

| Variable | Prefix? | Notes |
|---|---|---|
| `GEMINI_API_KEY` | **no** | Required. Stays on the server. |
| `IMGBB_API_KEY` | **no** | Optional — enables saving reports. |
| `VITE_SUPABASE_URL` | yes | Public endpoint. |
| `VITE_SUPABASE_ANON_KEY` | yes | Publishable key; public by design. |

The `VITE_` prefix is the whole distinction. Vite **inlines every `VITE_`
variable into the JavaScript bundle at build time**, so a `VITE_`-prefixed key is
readable by anyone who loads the site. Vercel's *Secret* vs *Config* toggle only
controls who can read a value back in the dashboard — it does not stop a `VITE_`
variable reaching the browser. The two keys above that matter deliberately have
no prefix, so they never enter the bundle.

Verified: after `npm run build`, neither key appears anywhere in `dist/`, and the
browser makes no request to `googleapis.com` or `api.imgbb.com` — only to
`/api/*` on its own origin. The CSP no longer permits those hosts at all, so a
future change that tried to call them directly would be blocked.

`vercel.json` declares the build and the functions explicitly rather than relying
on auto-detection, which silently produced a static-only deployment where
`/api/config` 404'd. It also raises `maxDuration` to 60s: the Hobby default is
10s and Gemini calls measured 6-50s, so every analysis would otherwise be killed
mid-flight. Files beginning with `_` (like `api/_handlers.ts`) are shared code,
not routes.

**If `/api/config` still 404s**, check **Settings → General → Root Directory** in
the Vercel project. It must be the repository root (blank or `.`); if it points
at a subdirectory, `api/` is outside the deployment and no configuration file can
help.

Locally, `npm run dev` serves the same handlers through a Vite middleware, so the
proxy can be exercised without the Vercel CLI.

## What it does

- **Upload or camera** — JPG/PNG/WEBP, validated by magic bytes rather than
  extension; or a live preview with front/rear switching.
- **Multiple objects** — each item is reported separately with its own box and
  verdict. A photo holding a banana peel *and* a bottle is reported as two
  streams with a "separate these before disposal" warning, never collapsed.
- **Four outcomes** — WET, DRY, HAZARDOUS, UNCERTAIN.
- **Location stamped on camera photos** — the GPS fix is recorded, reverse
  geocoded to a real address, and stamped on the image in the format municipal
  officers are used to reading:

  ```
  Gudlavalleru, Andhra Pradesh, India
  Gudlavalleru, Krishna district, 521356
  Lat 16.353146°  Long 81.046527°
  01/09/26 02:40 PM GMT+05:30 · ±11 m
  ```

  The panel is placed on whichever edge covers *less* of the detected items —
  waste sits on the ground, so a bottom-pinned stamp buries the evidence. If no
  edge is clear it says so rather than hiding something. Gallery uploads get no
  location; the fix comes from the device at capture time, not file metadata.
- **Soiling detected directly** — the model can usually see food contamination,
  which moves paper, cardboard and plastic to wet waste. Where it cannot tell, it
  says so and the app asks you.
- **Honest caveats** — narrow confidence, wide scene, small region, unknown
  soiling are all surfaced rather than hidden.

## Architecture

```
camera / upload → validate → downscale → JPEG → base64
   → Gemini (materials, boxes, soiling, per-item confidence)
   → local rules layer → confidence gates
   → WET / DRY / HAZARDOUS / UNCERTAIN
```

**Gemini is asked for materials, not verdicts.** It reports what an item is and
what it is made of; the mapping to a disposal stream stays local, deterministic
and unit-tested in `src/ai/wasteRules`. That keeps the most consequential step
inspectable, and stops the answer drifting silently when the model updates.
Constraining `material` to a 12-class enum also means the model cannot return a
category the rules have no answer for.

AI code lives in `src/ai/` and never imports React; components talk to an
`InferenceEngine` interface and plain data. Full detail:
**[ARCHITECTURE.md](ARCHITECTURE.md)**.

## Model choice and fallback

`gemini-3.5-flash` is the primary model. It was picked by measurement, not by
version number — `gemini-3.7-flash` and `gemini-flash-latest` were both
returning HTTP 500 "experiencing high demand", and `gemini-3.6-flash` took 50
seconds. 3.5-flash answered correctly in 6–8 s across repeated runs.

Because that capacity comes and goes, a failed request automatically retries
against `gemini-3-flash-preview`, then `gemini-3.6-flash`. Only transient
failures (429/500/503) trigger it — a rejected key fails immediately instead of
being retried against every model. The result panel shows which model actually
answered.

All of this is in `GEMINI` in `src/config`.

## A note on soiling

The model is asked whether an item is visibly dirty, because soiled paper,
cardboard and plastic belong in wet waste. **Its answer is treated as a
suggestion, never applied automatically.**

That is a measured decision: a clean, empty plastic bottle was reported
`soiled: yes` at 0.95–0.98 on three consecutive runs. The model appears to
reason about what a container is *for* rather than what it currently looks like,
and that bias points one way for exactly the recyclable containers people
photograph most. Acting on it directly sent clean recyclables to the compost bin
with a confident-looking verdict. Now the material's category stands and the
suspicion is surfaced as a one-tap question.

## About the confidence number

It is the **model's own estimate of how sure it is** — a self-report, not a
calibrated probability. It has not been checked against how often the model is
actually right, and language models are known to overstate certainty. It is used
as a coarse ordering signal and labelled as self-reported wherever it appears.

This is a real regression from the previous on-device build, whose confidence
came from a probability distribution and was calibrated against measurements.
See [MODEL_COMPARISON.md](MODEL_COMPARISON.md).

## Location, addresses, and what is not uploaded

Addresses come from **OpenStreetMap's Nominatim**, which needs no API key.
Google's Geocoding API was tried first and rejected the Gemini key — it is a
separate Maps Platform product with its own billing. Nominatim's usage policy is
respected: results are cached, calls are throttled to one per second, and
`© OpenStreetMap contributors` is shown in the app.

This is a **second** third-party disclosure, and it is stated in the UI: the
*coordinates* (not the photo) are sent to OSM. The CSP allows exactly two
external hosts and no others. If the lookup fails, the stamp degrades to
coordinates alone — it never blocks a photo, and no address is ever inferred
locally.

Coordinates are drawn **over** the photo in the page, never **into** the pixels.
That distinction is the whole design: the image sent to Gemini is the plain
capture, so your location is not disclosed to Google along with it. There is a
test asserting the outgoing request body contains no coordinates, so a future
change that folded metadata into the request would fail the build rather than
quietly start leaking it.

Location is optional and never blocks a photo. A cold GPS fix can take 20
seconds; the request starts when the camera opens so it is usually ready by the
time you press the shutter, and if it is denied, times out, or the browser has
no geolocation, the capture proceeds and the photo is simply marked "No location
recorded". Like the camera, it needs HTTPS or localhost.

If you want coordinates burned into a shareable JPEG for a formal report, that
is a small addition — say the word.

## Interface

Designed for a phone held at arm's length over a bin, because that is where it
is actually used. The layout was rebuilt against a measured audit of the
previous version:

| | before | after |
|---|---|---|
| Verdict type size | 20 px | **32 px** |
| Verdict position | 986 px down — below the fold | **488 px — on the first screen** |
| Result page height | 3 965 px (4.9 phone screens) | **1 730 px (2.1)** |
| Elements at 12 px | 94 | **2** (uppercase micro-labels) |
| Tap targets under 44 px | 3 | **0** |

Specifics worth knowing:

- **The verdict leads.** Full-width, in the colour of the bin it names — green
  for wet, blue for dry, per SWM Rules 2016 — with the instruction in plain
  words ("Blue bin — recyclable").
- **Colour is never the only signal.** Every stream carries an icon and a word.
  WET and HAZARDOUS are the green/red pair that red-green colour blindness
  collapses.
- **One task per screen.** The chooser, the preview and the result do not stack;
  each state shows only what is relevant.
- **Primary action pinned to the thumb zone**, clear of the iPhone home
  indicator via `env(safe-area-inset-bottom)`.
- **Camera first** — it is the dominant intent on a phone; upload is secondary,
  and the drag-and-drop target only exists on screens where dragging is possible.
- Verified with no horizontal overflow and no undersized targets down to 320 px,
  in both light and dark, with `prefers-reduced-motion` honoured in CSS *and* in
  the JavaScript that scrolls the result into view.

## Requirements

Any current browser. The camera needs HTTPS (or localhost). An internet
connection and a Gemini API key are required for every analysis.

## Testing

```bash
npm test          # 147 tests
npm run typecheck
npm run lint
npm run build
```

Tests cover the request shape, response parsing and validation, HTTP error
mapping, coordinate conversion, the full rules layer, and the UI. The network
boundary is stubbed — **no test spends money**, and no test asserts anything
about Gemini's accuracy, because that is not something this repository has
measured.

Measure accuracy on your own images (this **does** spend money — one API call
per image):

```bash
npm run eval -- ./my-images     # WET/ DRY/ HAZARDOUS/ subfolders
```

## Limitations

1. **Every analysis uploads your photograph to Google.** No offline mode.
2. **No accuracy figure is claimed.** Gemini is a general-purpose model, not one
   trained on waste, and its accuracy on Indian household waste has not been
   measured here. Use `npm run eval` on your own images.
3. **Confidence is self-reported**, not calibrated.
4. **Answers are not reproducible.** The same photo may yield different results,
   and Google can change the model without notice.
5. **The prompt is part of the product.** Editing
   `src/ai/gemini/schema.ts` changes behaviour as much as swapping models would.
6. **Wide scenes and heaps are not what it is for.** Photograph one item. Given a
   roadside dump it will usually report UNCERTAIN — correctly, since no single
   stream describes a pile.
7. **Costs money.** Every analysis is a billed API call, and a fallback retry
   is a second one.
8. **Model availability fluctuates.** Individual models return "experiencing
   high demand" without warning; the fallback chain exists because of it.
9. **Saved reports are not private.** Images go to a public host, and with no
   sign-in the database RLS policies are open to the anonymous role — anyone
   with the publishable key, which is in the bundle, can read every row.
   `device_id` scopes what the dashboard *shows*, not what the database returns.
   Add Supabase Auth before any real deployment; the migration says how.
10. **It is a decision aid, not an authority.** For medical, chemical or
    electronic waste, follow your local rules.

## Deployment

```bash
npm run build     # → dist/ (~260 KB)
```

Any static host. Needs HTTPS for the camera. **Re-read the Security section
first** — a public deployment gives your API key away.

## Further reading

| | |
|---|---|
| [MODEL_COMPARISON.md](MODEL_COMPARISON.md) | Gemini vs the previous on-device build — what was gained and given up |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Pipeline, layering, decision logic |
| [DATASET_GUIDE.md](DATASET_GUIDE.md) | Collecting Indian household waste data for evaluation |
| [LICENSES.md](LICENSES.md) | Licensing and terms |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | SIGER tokens, component rules, accessibility criteria |
| [supabase/001_reports.sql](supabase/001_reports.sql) | Report table, indexes and RLS policies |
| [supabase/002_report_delete.sql](supabase/002_report_delete.sql) | Delete policy for the dashboard |

## Licence

MIT.
