# SIGER — UI guidance for AI Waste Segregation

## 1. Context and goals

**Design intent:** a token-driven interface that delivers a bin decision, on a
phone, at arm's length, without ever overstating what the model knows.

Surface: content site. Audience: consumers acting on the result in the physical
world — standing over a bin or a dump. That posture, not a desk, sets the type
scale, the tap targets, and the placement of the primary action.

> **Extraction caveat.** The supplied brand context lists the audience as
> "online shoppers and consumers" with low inference confidence. This app has no
> commerce surface, so the guidance below is written for the consumer-decision
> case only. Verify before reusing these rules on a storefront.

Component density on the current surface: **links 31, lists 9, inputs 8,
buttons 4**. Buttons are scarce and therefore load-bearing: each must map to
exactly one user intent.

## 2. Design tokens and foundations

All values are declared in `src/index.css`. Components **must** consume semantic
tokens; raw hex in component code is prohibited.

> **Namespacing is mandatory.** SIGER scales are exposed as `--siger-text-*` and
> `--siger-space-*`, never as `--text-*` or `--spacing-*`. In Tailwind 4 the
> latter names inside `@theme` *redefine the utility scales*: declaring
> `--spacing-4: 8px` silently rewrote every `p-4` in the app from 16px to 8px,
> and `--text-2xl: 17.34px` collapsed the page `h1` from 24px to 17.34px. The
> entire layout shrank without a single component changing. Any future token
> import **must** be namespaced and verified against computed styles, not
> assumed.

### 2.1 Typography

| Token | Value | Use |
|---|---|---|
| `font.family.primary` | Source Sans Pro | Self-hosted via `@fontsource`; **must not** be fetched from a font CDN |
| `font.family.stack` | `Source Sans Pro, sans-serif` | |
| `font.size.base` / `weight` / `lineHeight` | 14px / 400 / 20px | Metadata and dense lists only |
| `font.size.xs` – `4xl` | 9px – 20px | Scale below |

**Body copy must be ≥ 16px on the primary surface.** The supplied
`font.size.base` of 14px is retained as a *metadata* size, not a body size:
audit of the pre-token build found 94 elements at 12px, which was unreadable at
the distance this app is used from.

SIGER's scale tops out at 20px, which cannot carry the verdict — the one element
that must be legible at arm's length. The verdict therefore uses 32px (40px from
`sm`), a documented deviation. Applying the SIGER scale wholesale is prohibited
for the same reason its spacing scale is: it is built for a dense content site,
and this is a touch-first camera app where controls must clear 44px.

`font.size.xs` (9px) and `font.size.sm` (10.67px) are **prohibited** for body
copy, form labels, and any interactive control. They are permitted only for
uppercase, letter-spaced micro-labels (eyebrows, badges) where the string is a
single word or a count.

### 2.2 Colour

| Token | Value | Contrast vs `surface.base` | Verdict |
|---|---|---|---|
| `color.text.primary` | `#ffffff` | **21.00:1** | Pass |
| `color.text.inverse` | `#a6d5ba` | **12.85:1** | Pass |
| `color.text.secondary` | `#28256b` | **1.57:1** | **Fail — must never be text on base** |
| `color.text.tertiary` | `#008639` | **4.47:1** | **Fail for body**; passes large text and non-text UI |

Two supplied tokens cannot be used as their names suggest. `#28256b` on
`#000000` is 1.57:1 — effectively invisible. `#008639` misses AA body text by
0.03.

**Resolution:** both are carried as *surface* tokens, which is what they measure
well as — white on `#28256b` is 13.40:1 and on `#008639` is 4.70:1.

```
color.brand.ink            #ffffff   text on brand surfaces
color.brand.surface        #28256b   brand fill; white text only
color.brand.accent         #008639   accent fill; white text only, or large text
color.brand.accent.soft    #a6d5ba   text on dark surfaces
```

Components **must not** apply `brand.surface` or `brand.accent` as a text colour
on `surface.base`.

### 2.3 Stream colours — a documented exception

The four waste streams use their own palette (`color.wet`, `color.dry`,
`color.hazard`, `color.unsure`) rather than brand colours.

This is **not** a local visual exception. The colours name physical objects: the
green and blue bins defined by India's SWM Rules 2016. Recolouring them to brand
would make the interface say "blue bin" while showing brand indigo. Semantic
accuracy outranks brand consistency here, and this exception **must** be
preserved in any migration.

Colour is never the sole carrier of meaning: every stream **must** render an
icon and a text label alongside its colour. WET and HAZARDOUS are the green/red
pair that red–green colour blindness collapses.

### 2.4 Spacing, radius, elevation, motion

`--siger-space-1=2px` … `--siger-space-8=25px`, available for dense content
regions. Layout and touch targets use Tailwind's 4px-based scale, because
SIGER's steps (2, 5, 7, 8px) cannot express the padding a 44px control needs.
Components **must not** introduce values outside whichever scale they are on,
and **must not** mix the two within one component.

`shadow.1` (inset) is for recessed surfaces; `shadow.2` for raised. Motion:
`instant=200ms` for state feedback, `fast=300ms` for local transitions,
`normal=600ms` for entrances. All motion **must** be suppressed under
`prefers-reduced-motion: reduce` — in CSS *and* in any JavaScript-driven scroll.

## 3. Component-level rules

Universal state matrix — every interactive component **must** define all seven:
`default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error`.

Universal interaction rules:
- Minimum target **44 × 44 px** for every control, pointer and touch alike.
- `focus-visible` **must** render a 2px outline at 2px offset. Suppressing focus
  indicators is prohibited.
- Hover styling **must not** be the only affordance; touch has no hover.
- `disabled` **must** convey the reason in adjacent text, not by dimming alone.

### 3.1 Action bar (`ActionBar`, `PrimaryButton`, `SecondaryButton`)

**Anatomy:** sticky container, safe-area padded → primary action (flex-1) →
optional secondary (fixed max-width).

**Variants:** primary (filled), secondary (outline).

| State | Rule |
|---|---|
| default | Primary filled; label states the outcome ("Analyze", "New photo") |
| hover | Darken one step; `motion.duration.instant` |
| focus-visible | 2px outline, 2px offset, never clipped by the sticky container |
| active | Darken two steps; no transform that shifts the hit area |
| disabled | 45% opacity **and** a visible reason nearby |
| loading | Label becomes present-progressive ("Analysing…"); control stays disabled and keeps its width to avoid layout shift |
| error | The bar does not render errors; errors belong to `ErrorNotice` |

**Responsive:** full width below `sm`; capped at `max-w-2xl` and centred above.
Bottom padding **must** use `env(safe-area-inset-bottom)`.

**Keyboard:** natural tab order, `Enter`/`Space` activate. The bar **must not**
be a focus trap.

**Long content:** labels **must not** wrap; shorten the label rather than
allowing two lines.

**Empty state:** the bar is absent until a photo exists.

### 3.2 Verdict banner (`VerdictBanner`)

**Anatomy:** eyebrow ("RESULT") → icon + stream name → one-line instruction →
supporting recommendation.

**Variants:** single-stream (filled with the stream colour); mixed/none (neutral
surface with per-stream count chips).

Rules:
- The stream name **must** be ≥ `font.size.4xl` and appear within the first
  viewport on a 375 × 812 device.
- A single bin colour **must not** be shown when more than one stream is present.
- The instruction **must** name the physical bin in words.

**Responsive:** 32px stream name below `sm`, 40px above. Chips wrap; they
**must not** scroll horizontally.

**Long content:** the recommendation may wrap freely; it **must not** be
truncated or clamped — losing the tail of disposal advice is a correctness bug.

**Empty state:** "No waste item recognised" on the neutral surface, with a
concrete retry instruction.

### 3.3 Result card (`ObjectCard`)

**Anatomy:** index chip → item name → material → stream badge → recommendation →
confidence bar → optional clarification → caveats → alternatives disclosure.

Rules:
- Confidence **must** be labelled "self-reported" wherever it appears. It is a
  model self-estimate, not a calibrated probability, and **must not** be
  presented as accuracy.
- The confidence bar **must** carry an `aria-label` with the value; it is
  decorative to a screen reader otherwise.
- Caveats **must** render in full. Collapsing them behind a disclosure is
  prohibited — they are the honesty mechanism.
- Alternatives render in a disclosure and **must** be omitted entirely when empty
  rather than shown as an empty list.

**Clarification sub-component:** two equal-width buttons, both ≥ 44px, both
naming their outcome ("Yes — it's soiled" / "No — it's clean"). Ambiguous labels
such as "OK"/"Cancel" are prohibited.

### 3.4 Photo stamp (`PhotoStamp`) and location (`LocationBadge`)

**Anatomy:** pin icon → coordinates (mono, tabular) → timestamp and accuracy
radius. Optional occlusion warning strip.

Rules:
- Placement **must** be computed, not fixed. The panel occupies the edge that
  covers less detected-item area (`chooseStampPlacement`).
- When the panel still covers >15% of detected area, an occlusion warning
  **must** be shown.
- Coordinates **must** wrap rather than truncate. A clipped coordinate is a
  wrong coordinate.
- Coordinates **must not** be composited into the uploaded image.
- A place name or map thumbnail **must not** be rendered without a real
  geocoding source. Deriving a street name locally would be fabricated evidence.

**States:** `idle` renders nothing; `locating` announces via `aria-live`;
`ready` shows the fix; `error`/`unsupported` state "No location recorded" and
**must not** block capture.

### 3.5 Inputs (`ImageUpload`) — 8 inputs on surface

- The file input is visually hidden but **must** remain reachable via its
  `<label>`; `display:none` is prohibited.
- Type validation **must** read magic bytes, not the extension or MIME string.
- The drag target **must not** render below `sm`, where dragging is impossible.
- Accepted formats and the size cap **must** be stated before selection.
- On rejection, the error **must** name the limit that was breached.

### 3.6 Links — 31 links on surface

- Link text **must** describe its destination. "Click here" and "Read more" are
  prohibited.
- External links **must** carry `rel="noreferrer noopener"`.
- Underlines **must** persist; colour alone is not a link affordance.

### 3.7 Lists — 9 lists on surface

- Semantic `<ul>`/`<ol>` **must** be used; styled `<div>` stacks are prohibited.
- Every list **must** define an empty state.

## 4. Accessibility acceptance criteria

Target: **WCAG 2.2 AA**. Each is testable.

| # | Criterion | Pass | Fail |
|---|---|---|---|
| A1 | Body text contrast | ≥ 4.5:1 measured | Any body text < 4.5:1 |
| A2 | Large text / UI contrast | ≥ 3:1 | Below 3:1 |
| A3 | Target size (2.5.8) | Every control ≥ 24×24; this system requires ≥ 44×44 | Any control under 44px high |
| A4 | Focus visible (2.4.11) | 2px outline, 2px offset, never clipped | Any `outline:none` without replacement |
| A5 | Keyboard operability | Every action reachable and operable by keyboard | Pointer-only affordance |
| A6 | Non-colour meaning (1.4.1) | Every stream has icon + label | Colour-only distinction |
| A7 | Status messages (4.1.3) | Loading/location announce via `aria-live`; errors via `role="alert"` | Silent state change |
| A8 | Reduced motion | No animation or smooth scroll when reduce is set | JS `behavior:'smooth'` ignoring the preference |
| A9 | Reflow (1.4.10) | No horizontal scroll at 320px | Any element exceeding viewport width |
| A10 | Labels (2.5.3) | Accessible name contains the visible label | Icon-only control with no `aria-label` |

Measured on the current build: 0 controls under 44px, 0 elements overflowing at
320px, verdict at 32px within the first viewport.

## 5. Content and tone standards

Concise, confident, implementation-focused. Second person. No hedging that
obscures uncertainty, and no confidence the model has not earned.

| Do | Don't |
|---|---|
| "Blue bin — recyclable" | "This might possibly be recyclable" |
| "No location recorded" | "Location error 2" |
| "Yes — it's soiled" | "OK" |
| "The camera is already in use." | "NotReadableError" |
| "Model confidence (self-reported)" | "Accuracy: 94%" |

Uncertainty **must** be stated plainly: "Not sure" beats a confident wrong bin.

## 6. Anti-patterns and prohibited implementations

1. Using `text.secondary` or `text.tertiary` as text on `surface.base` — 1.57:1
   and 4.47:1.
2. Body copy at `font.size.xs`/`sm`.
3. Removing focus outlines.
4. Communicating a stream by colour alone.
5. Presenting self-reported confidence as accuracy.
6. Truncating coordinates, caveats, or disposal advice.
7. Pinning the location stamp to a fixed edge regardless of detected content.
8. Compositing location into an uploaded image.
9. Fetching fonts from a third-party CDN.
10. Introducing spacing outside `space.1`–`space.8`.
11. A single bin colour for a mixed-stream result.
12. `behavior:'smooth'` from JavaScript without checking `prefers-reduced-motion`.

## 7. QA checklist

- [ ] No raw hex in component code; all values resolve to tokens
- [ ] All seven states defined for every interactive component
- [ ] Every control ≥ 44 × 44 px
- [ ] `focus-visible` present and unclipped, including inside sticky containers
- [ ] Body text ≥ 16px; `xs`/`sm` only on uppercase micro-labels
- [ ] Contrast measured, not estimated, for every text/background pairing
- [ ] Every stream shows icon + label as well as colour
- [ ] No horizontal scroll at 320px; verified in light and dark
- [ ] Reduced motion honoured in CSS and JavaScript
- [ ] Loading and location announce via `aria-live`; errors via `role="alert"`
- [ ] Empty states defined for every list and result surface
- [ ] Long content wraps rather than truncating
- [ ] Confidence labelled self-reported everywhere it appears
- [ ] Location absent from the uploaded payload (asserted by test)
