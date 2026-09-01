import type { WasteCategory } from '@/types';

/**
 * A distinct glyph per stream.
 *
 * Not decoration: WET and HAZARDOUS are green and red, the exact pair that
 * red-green colour blindness collapses. The icon and the label are what make
 * the verdict readable without relying on hue.
 */
export function CategoryIcon({ category, className }: { category: WasteCategory; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  };

  switch (category) {
    case 'WET': // leaf — compostable
      return (
        <svg {...common}>
          <path d="M11 20A7 7 0 0 1 11 6h9v6a8 8 0 0 1-8 8Z" />
          <path d="M4 21c2-6 6-9 11-10" />
        </svg>
      );
    case 'DRY': // recycling triangle
      return (
        <svg {...common}>
          <path d="m7 19-3-5 2.5-4M17 19l3-5-4.5-7.5h-3M12 3 9 8h6" />
          <path d="M7 19h8" />
        </svg>
      );
    case 'HAZARDOUS': // warning
      return (
        <svg {...common}>
          <path d="M10.3 3.9 2.4 17.1A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4.5M12 17h.01" />
        </svg>
      );
    default: // question — genuinely unknown
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.2 9.3a3 3 0 0 1 5.6 1.2c0 2-2.8 2.5-2.8 4M12 17h.01" />
        </svg>
      );
  }
}
