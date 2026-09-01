# Collecting an Indian household waste dataset

Classification now runs on Gemini, a general-purpose model, so there is nothing
here to fine-tune. What a dataset buys you instead is **evidence**: this
repository makes no accuracy claim, and the only way to get one you can defend —
or to compare model tiers, or to tell whether a prompt edit helped or hurt — is
to measure on real Indian household waste.

Build the set, then run `npm run eval -- ./my-images`.

## Target

| Stream | Minimum | Recommended |
|---|---|---|
| WET (biodegradable) | 500 | 2 000 |
| DRY (recyclable) | 500 | 2 000 |
| HAZARDOUS (domestic) | 200 | 800 |
| Mixed / multi-object | 200 | 800 |

Counts are per *stream*, and should be spread across the item types below —
2 000 photos of plastic bottles is not 2 000 DRY images.

## What to photograph

Prioritise what the current model gets wrong or has never seen.

**Wet waste**
Vegetable peels (potato, onion, carrot, bottle gourd), fruit waste (banana peel,
mango skin and stone, watermelon rind), cooked leftovers (rice, dal, sabzi,
chapati), tea leaves and used tea bags, coffee grounds, eggshells, coconut
shell and husk, banana leaves, flowers and puja waste, garden trimmings,
bones and meat scraps.

**Dry waste**
PET bottles, milk and curd pouches, **multilayer sachets** (shampoo, ketchup,
gutkha) — extremely common in India and essentially absent from Western
datasets — tetra paks, newspaper, cardboard cartons, steel and aluminium
containers, glass bottles, thermocol packaging, cloth and footwear, blister
packs, pens, toothbrushes.

**Hazardous**
Batteries (AA, button, phone), CFL and LED bulbs, expired medicines and blister
strips, syringes, pesticide and cleaning-chemical containers, paint tins, nail
polish, sanitary napkins and diapers, e-waste (chargers, cables, earphones).

**The hard cases, which are the whole point**
Food-soiled paper plates and pattals, greasy pizza boxes, curd-coated cups,
half-eaten food in plastic containers, wet newspaper, oil-stained cardboard,
a full mixed kitchen bin.

## Variation to cover

Shoot the *same item* across these axes — variation matters more than volume.

| Axis | Cover |
|---|---|
| Lighting | daylight, overcast, tube-light, yellow bulb, phone flash, dim evening |
| Background | steel plate, newspaper, floor tile, kitchen slab, inside the bin, on soil, plastic bag |
| Angle | top-down, 45°, eye level, low angle |
| Distance | filling the frame, half the frame, small in frame |
| Condition | fresh, dried, wet, soiled, crushed, torn, partially decomposed |
| Quantity | single item, small pile, full bin |
| Brand | at least 3–5 brands per packaged category |
| Device | multiple phone models — sensors and processing differ a lot |
| Setting | kitchen, balcony, outdoor bin, community collection point |

Rules of thumb:
- **No studio shots.** If it looks like a product photograph, it will not help.
- Include deliberately bad photos — blurry, tilted, badly lit. Users take those.
- Photograph the same object clean *and* soiled, and label the pair. That
  contrast is what the model currently cannot see at all.

## Ethics and consent

- No people, faces, house numbers, or vehicle plates in frame.
- Get permission before photographing anyone else's waste, and never photograph
  waste pickers or their collection without informed consent.
- Do not photograph medical waste containing identifiable information
  (prescription labels, test reports).
- Strip GPS EXIF before sharing: `exiftool -gps:all= -overwrite_original *.jpg`.

## Folder layout

For the evaluation harness (`npm run eval -- ./my-images`):

```
my-images/
├── WET/
├── DRY/
└── HAZARDOUS/
```

Keep a held-out portion you do not look at while tuning prompts, and **split it
by household and by capture day, not at random.** A random split puts twenty
photos of the same bottle on both sides and flatters your score.

## Naming

```
<stream>_<class>_<condition>_<location>_<device>_<nnnn>.jpg
wet_banana-peel_fresh_kitchen_pixel7_0031.jpg
dry_sachet_soiled_bin_redmi9_0104.jpg
```

Redundant with the folder, and worth it: it survives being moved, and makes
"which conditions are we short of?" a `ls | cut` away.

## Using the set

```bash
npm run eval -- ./my-images
```

This spends money: one Gemini call per image. Start with 20–30 images to sanity
check, not the whole set.

Read the output as two numbers together:

- **WRONG** — confident misfiles. The number that matters. A wrong bin is worse
  than an admitted "I don't know", especially for hazardous items.
- **coverage** — how often it committed at all. A system that abstains on
  everything scores perfect accuracy and is useless.

Re-run it after any change to the prompt in `src/ai/gemini/schema.ts`, after
changing `GEMINI.MODEL`, and periodically regardless — the hosted model can
change under you without notice, which is precisely why a held-out set you
control is worth having.

## Quality checklist

- [ ] Every stream has enough images to be worth measuring (≥ 100)
- [ ] No stream exceeds 5× the smallest
- [ ] Test split is separated by household **and** day
- [ ] Duplicates and near-duplicates removed (perceptual hash)
- [ ] A second person has spot-checked ≥ 10 % of labels
- [ ] Inter-annotator agreement recorded (κ ≥ 0.7)
- [ ] EXIF GPS stripped
- [ ] Licence and consent documented for anything not self-collected
