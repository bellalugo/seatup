import type { TableShape } from '@/lib/types';

// Petit pictogramme de la forme d'une table (sans chaises).
// round = cercle, rectangle = 1 rectangle, double = 2 rectangles empilés, triple = 3 rectangles verticaux.
export function TableShapeIcon({ shape, className, width = 30, height = 20 }: { shape?: TableShape; className?: string; width?: number; height?: number; }) {
  const common = { fill: '#c8a45a', stroke: '#8a6d2f', strokeWidth: 1 } as const;
  return (
    <svg viewBox="0 0 24 16" width={width} height={height} className={className} aria-hidden="true">
      {shape === 'rectangle' && <rect x="3" y="4.5" width="18" height="7" rx="1.5" {...common} />}
      {shape === 'double' && (
        <>
          <rect x="4" y="2" width="16" height="5" rx="1.5" {...common} />
          <rect x="4" y="9" width="16" height="5" rx="1.5" {...common} />
        </>
      )}
      {shape === 'triple' && (
        <>
          <rect x="2.5" y="3" width="5" height="10" rx="1.5" {...common} />
          <rect x="9.5" y="3" width="5" height="10" rx="1.5" {...common} />
          <rect x="16.5" y="3" width="5" height="10" rx="1.5" {...common} />
        </>
      )}
      {(!shape || shape === 'round') && <circle cx="12" cy="8" r="6" {...common} />}
    </svg>
  );
}
