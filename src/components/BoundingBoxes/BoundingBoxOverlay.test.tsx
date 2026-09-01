import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { AnalyzedObject, BoundingBox, WasteCategory } from '@/types';
import { BoundingBoxOverlay } from './BoundingBoxOverlay';

const obj = (id: string, category: WasteCategory, box: BoundingBox | null): AnalyzedObject => ({
  id,
  box,
  itemName: 'test item',
  material: 'plastic',
  alternatives: [],
  category,
  confidence: 0.8,
  band: 'medium',
  caveats: [],
  clarification: null,
  recommendation: '',
});

describe('BoundingBoxOverlay', () => {
  it('renders nothing when no object has a box', () => {
    const { container } = render(
      <BoundingBoxOverlay objects={[obj('a', 'DRY', null)]} imageWidth={800} imageHeight={600} />,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('draws in the image coordinate system so boxes scale with the element', () => {
    const { container } = render(
      <BoundingBoxOverlay
        objects={[obj('a', 'WET', { x: 10, y: 20, width: 100, height: 50 })]}
        imageWidth={800}
        imageHeight={600}
      />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('viewBox', '0 0 800 600');
    const rect = svg.querySelector('rect')!;
    expect(rect).toHaveAttribute('x', '10');
    expect(rect).toHaveAttribute('width', '100');
  });

  it('colours each box by its own stream', () => {
    const { container } = render(
      <BoundingBoxOverlay
        objects={[
          obj('a', 'WET', { x: 0, y: 0, width: 10, height: 10 }),
          obj('b', 'HAZARDOUS', { x: 20, y: 0, width: 10, height: 10 }),
        ]}
        imageWidth={100}
        imageHeight={100}
      />,
    );
    const strokes = [...container.querySelectorAll('rect[stroke]')].map((r) =>
      r.getAttribute('stroke'),
    );
    expect(new Set(strokes).size).toBe(2);
  });

  it('numbers boxes to match the result cards', () => {
    const { container } = render(
      <BoundingBoxOverlay
        objects={[
          obj('a', 'WET', { x: 0, y: 40, width: 10, height: 10 }),
          obj('b', 'DRY', { x: 20, y: 40, width: 10, height: 10 }),
        ]}
        imageWidth={100}
        imageHeight={100}
      />,
    );
    expect([...container.querySelectorAll('text')].map((t) => t.textContent)).toEqual(['1', '2']);
  });

  it('dims the boxes that are not the hovered one', () => {
    const { container } = render(
      <BoundingBoxOverlay
        objects={[
          obj('a', 'WET', { x: 0, y: 0, width: 10, height: 10 }),
          obj('b', 'DRY', { x: 20, y: 0, width: 10, height: 10 }),
        ]}
        imageWidth={100}
        imageHeight={100}
        activeId="a"
      />,
    );
    const opacities = [...container.querySelectorAll('g')].map((g) => g.getAttribute('opacity'));
    expect(opacities).toEqual(['1', '0.35']);
  });
});
