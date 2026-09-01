import type { AnalyzedObject } from '@/types';
import { CATEGORY_STYLE } from '@/utils/format';

interface Props {
  objects: readonly AnalyzedObject[];
  imageWidth: number;
  imageHeight: number;
  activeId?: string | null;
}

/**
 * Boxes are drawn as an SVG in the image's own coordinate system with
 * `preserveAspectRatio` matching the <img>, so they stay aligned at any
 * container size without a resize listener or manual scaling maths.
 */
export function BoundingBoxOverlay({ objects, imageWidth, imageHeight, activeId }: Props) {
  const boxed = objects.filter((o) => o.box !== null);
  if (boxed.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden
    >
      {boxed.map((o, i) => {
        const box = o.box!;
        const colour = CATEGORY_STYLE[o.category].box;
        const dim = activeId != null && activeId !== o.id;
        const stroke = Math.max(2, imageWidth * 0.004);
        const fontSize = Math.max(12, imageWidth * 0.028);
        return (
          <g key={o.id} opacity={dim ? 0.35 : 1}>
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              fill={colour}
              fillOpacity={0.12}
              stroke={colour}
              strokeWidth={stroke}
              rx={stroke * 2}
            />
            <rect
              x={box.x}
              y={Math.max(0, box.y - fontSize * 1.5)}
              width={fontSize * (String(i + 1).length + 0.9)}
              height={fontSize * 1.4}
              fill={colour}
              rx={stroke}
            />
            <text
              x={box.x + fontSize * 0.35}
              y={Math.max(fontSize, box.y - fontSize * 0.35)}
              fill="#fff"
              fontSize={fontSize}
              fontWeight="700"
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
