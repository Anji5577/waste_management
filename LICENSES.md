# Licences

## This project

MIT — see `package.json`.

## Inference

Classification uses the **Google Gemini API** (`gemini-3.7-flash`). No model
weights are distributed with this project; the model is accessed as a hosted
service and is subject to Google's terms, not to an open-source licence:

- [Gemini API Terms of Service](https://ai.google.dev/gemini-api/terms)
- [Google APIs Terms of Service](https://developers.google.com/terms)

Two consequences worth stating plainly, because they were not true of the
previous on-device build:

1. **Photographs are sent to Google.** How they may be used, retained or
   reviewed is governed by the terms above and by whether you are on a free or
   paid tier. Check them before pointing this at anything sensitive.
2. **Use is metered.** Each analysis is a billed API call.

## Previously bundled models — removed

Earlier versions ran `dima806/garbage_types_image_detection` and
`Xenova/yolos-tiny` locally, both Apache-2.0. Those weights and the ONNX export
tooling have been removed. Nothing Apache-licensed remains to attribute; the
record of that architecture is kept in `MODEL_COMPARISON.md`.

## Test fixtures

Nine photographs from Wikimedia Commons under Public Domain, CC0, CC BY 2.0/4.0,
or CC BY-SA 4.0, retained for the evaluation harness. Per-image attribution is in
[`tests/fixtures/ATTRIBUTION.md`](tests/fixtures/ATTRIBUTION.md).

The CC BY-SA 4.0 items carry a share-alike condition on the images themselves if
you redistribute or adapt them. They are used here unmodified, as test data.

## Runtime dependencies

React (MIT), Vite (MIT), Tailwind CSS (MIT), Vitest (MIT).

Run `npx license-checker --summary` for the full resolved tree.
