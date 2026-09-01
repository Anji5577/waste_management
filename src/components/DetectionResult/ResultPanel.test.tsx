import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnalysisResult, AnalyzedObject, WasteCategory } from '@/types';
import { summarize } from '@/ai/wasteRules';
import { ResultPanel } from './ResultPanel';

function obj(
  id: string,
  category: WasteCategory,
  over: Partial<AnalyzedObject> = {},
): AnalyzedObject {
  return {
    id,
    itemName: 'plastic bottle',
    material: 'plastic',
    box: null,
    alternatives: [{ label: 'white-glass', confidence: 0.15 }],
    category,
    confidence: 0.69,
    band: category === 'UNCERTAIN' ? 'low' : 'medium',
    caveats: [],
    clarification: null,
    recommendation: `dispose as ${category}`,
    ...over,
  };
}

function result(objects: AnalyzedObject[]): AnalysisResult {
  return {
    objects,
    summary: summarize(objects),
    imageSize: { width: 800, height: 600 },
    timings: { requestMs: 430, totalMs: 470 },
    scene: 'single-item',
    engineId: 'local',
  };
}

describe('ResultPanel', () => {
  it('leads with the verdict, at a size readable at arm’s length', () => {
    // The banner is the whole point of the redesign: an audit found the old
    // verdict at 20px, 986px down the page — below the fold on a phone.
    render(<ResultPanel result={result([obj('a', 'DRY')])} onAnswerClarification={vi.fn()} />);
    const banner = screen.getByRole('region', { name: /result/i });
    expect(within(banner).getByText('DRY WASTE')).toBeInTheDocument();
    expect(within(banner).getByText(/blue bin/i)).toBeInTheDocument();
  });

  it('shows the item, its confidence and the recommendation on the card', () => {
    render(<ResultPanel result={result([obj('a', 'DRY')])} onAnswerClarification={vi.fn()} />);
    const card = screen.getByRole('article');
    expect(within(card).getByText(/69%/)).toBeInTheDocument();
    expect(within(card).getByText(/dispose as DRY/)).toBeInTheDocument();
  });

  it('states the bin in words, not colour alone', () => {
    // WET and HAZARDOUS are the green/red pair red-green colour blindness
    // collapses, so the stream has to be legible without hue.
    render(<ResultPanel result={result([obj('a', 'HAZARDOUS')])} onAnswerClarification={vi.fn()} />);
    const banner = screen.getByRole('region', { name: /result/i });
    expect(within(banner).getByText('HAZARDOUS')).toBeInTheDocument();
    expect(within(banner).getByText(/hazardous collection/i)).toBeInTheDocument();
  });

  it('refuses to show a single bin colour when the photo holds two streams', () => {
    render(
      <ResultPanel
        result={result([obj('a', 'WET'), obj('b', 'DRY')])}
        onAnswerClarification={vi.fn()}
      />,
    );
    const banner = screen.getByRole('region', { name: /result/i });
    expect(within(banner).getByText(/mixed waste/i)).toBeInTheDocument();
    expect(within(banner).getByText(/separate/i)).toBeInTheDocument();
    // Counted per stream, so the user knows what they are separating.
    expect(within(banner).getByText(/1 WET WASTE/)).toBeInTheDocument();
    expect(within(banner).getByText(/1 DRY WASTE/)).toBeInTheDocument();
  });

  it('renders one card per detected object', () => {
    render(
      <ResultPanel
        result={result([obj('a', 'WET'), obj('b', 'DRY'), obj('c', 'HAZARDOUS')])}
        onAnswerClarification={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByText(/3 items found/i)).toBeInTheDocument();
  });

  it('does not present the model’s self-report as a calibrated probability', () => {
    render(<ResultPanel result={result([obj('a', 'DRY')])} onAnswerClarification={vi.fn()} />);
    expect(screen.getByText(/self-report, not a\s+calibrated probability/i)).toBeInTheDocument();
  });

  it('asks the soiling question and reports the answer back', async () => {
    const onAnswer = vi.fn();
    const withQuestion = obj('a', 'DRY', {
      clarification: {
        id: 'soiled',
        question: 'Is it soiled with food, oil, or liquid?',
        yesCategory: 'WET',
        noCategory: 'DRY',
      },
    });
    render(<ResultPanel result={result([withQuestion])} onAnswerClarification={onAnswer} />);

    await userEvent.click(screen.getByRole('button', { name: /it’s soiled/i }));
    expect(onAnswer).toHaveBeenCalledWith('a', true);

    await userEvent.click(screen.getByRole('button', { name: /it’s clean/i }));
    expect(onAnswer).toHaveBeenCalledWith('a', false);
  });

  it('surfaces caveats rather than hiding them', () => {
    const flagged = obj('a', 'UNCERTAIN', {
      caveats: [{ code: 'narrow-margin', message: 'Only narrowly beat the next class.' }],
    });
    render(<ResultPanel result={result([flagged])} onAnswerClarification={vi.fn()} />);
    expect(screen.getByText(/only narrowly beat/i)).toBeInTheDocument();
  });

  it('names the item the model reported, with the material it was ruled on', () => {
    render(<ResultPanel result={result([obj('a', 'DRY')])} onAnswerClarification={vi.fn()} />);
    const card = screen.getByRole('article');
    expect(within(card).getByText('Plastic bottle')).toBeInTheDocument();
    expect(within(card).getByText('Plastic')).toBeInTheDocument();
  });

  it('exposes the alternatives the model considered', async () => {
    render(<ResultPanel result={result([obj('a', 'DRY')])} onAnswerClarification={vi.fn()} />);
    const card = screen.getByRole('article');
    await userEvent.click(within(card).getByText(/other possibilities/i));
    expect(within(card).getByText(/Glass \(clear\)/)).toBeInTheDocument();
  });

  it('labels the confidence as self-reported on the card itself', () => {
    render(<ResultPanel result={result([obj('a', 'DRY')])} onAnswerClarification={vi.fn()} />);
    expect(screen.getByText(/self-reported/i)).toBeInTheDocument();
  });

  it('reveals timings only when asked', async () => {
    render(<ResultPanel result={result([obj('a', 'DRY')])} onAnswerClarification={vi.fn()} />);
    expect(screen.queryByText('430 ms')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /show analysis detail/i }));
    expect(screen.getByText('430 ms')).toBeInTheDocument();
  });

  it('tells the user plainly when nothing was recognised', () => {
    render(<ResultPanel result={result([])} onAnswerClarification={vi.fn()} />);
    expect(screen.getByText(/no waste item recognised/i)).toBeInTheDocument();
  });
});

describe('ResultPanel — wide scenes', () => {
  it('discloses when the photo was a heap rather than a single item', () => {
    // A pile makes every reading in it less reliable, and the user should be
    // told that rather than shown a clean-looking verdict.
    const scene = obj('a', 'WET', {
      caveats: [{ code: 'wide-scene', message: 'This photo is a heap or wide view.' }],
    });
    render(<ResultPanel result={result([scene])} onAnswerClarification={vi.fn()} />);
    expect(screen.getByText(/heap or wide view/i)).toBeInTheDocument();
  });
});
