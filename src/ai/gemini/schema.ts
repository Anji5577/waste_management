import { WASTE_CLASSES } from '@/types';

/**
 * The JSON contract we require of the model.
 *
 * Structured output is not a nicety here. Free-form text would have to be
 * parsed with regexes that break the first time the model rephrases itself, and
 * a waste verdict is not something to derive from string matching. Constraining
 * `material` to the same 12 classes the rules layer knows means the model can
 * never hand back a category the disposal rules have no answer for.
 */
export const WASTE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      description: 'One entry per distinct discardable item. Empty if none.',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Short human-readable name, e.g. "banana peel", "PET bottle".',
          },
          material: {
            type: 'string',
            enum: [...WASTE_CLASSES],
            description: 'The material class this item is made of.',
          },
          confidence: {
            type: 'number',
            description: 'How certain you are, 0 to 1.',
          },
          soiled: {
            type: 'string',
            enum: ['yes', 'no', 'unknown'],
            description:
              'Whether the item is visibly dirty RIGHT NOW — food residue, grease, stains or liquid still on or in it. Not whether it once held food or drink. "unknown" if you cannot tell.',
          },
          box_2d: {
            type: 'array',
            description: '[ymin, xmin, ymax, xmax] normalised to 0-1000.',
            items: { type: 'integer' },
            minItems: 4,
            maxItems: 4,
          },
        },
        required: ['name', 'material', 'confidence', 'soiled', 'box_2d'],
      },
    },
    scene: {
      type: 'string',
      enum: ['single-item', 'few-items', 'pile-or-scene'],
      description:
        'pile-or-scene when the photo shows a heap, bin or wide view rather than distinct photographed items.',
    },
  },
  required: ['items', 'scene'],
} as const;

/**
 * The instruction.
 *
 * Two things it deliberately does NOT ask for: a wet/dry verdict, and disposal
 * advice. Those come from the rules layer, which is deterministic, reviewable
 * and unit-tested. Letting the model decide the stream directly would make the
 * most consequential step of the pipeline the least inspectable one, and would
 * mean the answer could drift between model versions without anyone noticing.
 */
export const WASTE_PROMPT = `You are assisting a household waste-segregation app.

Identify every distinct discardable item in this photograph.

For each item report:
- name: what it is, in two or three words.
- material: the single best match from the allowed list.
- confidence: 0 to 1, honestly reflecting how sure you are. Use low values freely.
- soiled: judge only what you can SEE right now. "yes" only if there is visible
  food residue, grease, staining or liquid on or in the item. An empty, clean
  container is "no" even though it obviously once held something — do not infer
  contamination from what the item is for. "unknown" if you cannot tell.
- box_2d: [ymin, xmin, ymax, xmax] normalised to 0-1000.

Rules:
- Report only things being discarded. Ignore people, animals, vehicles, buildings,
  furniture, and anything a person is holding or wearing.
- Use "trash" as the material only when no other class fits.
- If the photo shows a heap, an open dump, a full bin or a wide scene rather than
  individual items, set scene to "pile-or-scene" and list only items you can
  actually make out. It is correct to return few or no items in that case.
- Do not guess to be helpful. A low confidence is more useful than a wrong answer.`;
