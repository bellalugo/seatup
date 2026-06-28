'use client';

import type React from 'react';
import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Trash2 } from 'lucide-react';
import type { GameTable, Registration } from '@/lib/types';
import { cn } from '@/lib/utils';

type SeatKind = 'empty' | 'other' | 'you' | 'animator';
interface SeatLayout { cx: number; cy: number; kind: SeatKind; }

function roundPositions(totalSeats: number): { cx: number; cy: number }[] {
  const RADIUS = 30, CENTER = 50;
  const positions: { cx: number; cy: number }[] = [];
  for (let i = 0; i < totalSeats; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / totalSeats;
    positions.push({ cx: CENTER + RADIUS * Math.cos(angle), cy: CENTER + RADIUS * Math.sin(angle) });
  }
  return positions;
}

function rectanglePositions(totalSeats: number): { cx: number; cy: number }[] {
  const TABLE_TOP_Y = 40, TABLE_BOTTOM_Y = 60, CHAIR_TOP_Y = 30, CHAIR_BOTTOM_Y = 70;
  const TABLE_LEFT_X = 27.5, TABLE_RIGHT_X = 72.5, CHAIR_LEFT_X = 17.5, CHAIR_RIGHT_X = 82.5;
  const MID_Y = (TABLE_TOP_Y + TABLE_BOTTOM_Y) / 2;
  const CENTER_X = (TABLE_LEFT_X + TABLE_RIGHT_X) / 2;
  const positions: { cx: number; cy: number }[] = [];
  if (totalSeats <= 0) return positions;
  if (totalSeats === 1) { positions.push({ cx: CENTER_X, cy: CHAIR_TOP_Y }); return positions; }
  const remaining = totalSeats - 2;
  const topCount = Math.ceil(remaining / 2);
  const bottomCount = Math.floor(remaining / 2);
  const topXs: number[] = [];
  for (let i = 0; i < topCount; i++) topXs.push(TABLE_LEFT_X + ((TABLE_RIGHT_X - TABLE_LEFT_X) * (i + 1)) / (topCount + 1));
  if (topXs.length > 0) {
    const mid = Math.floor(topXs.length / 2);
    [topXs[mid], ...topXs.slice(0, mid), ...topXs.slice(mid + 1)].forEach(x => positions.push({ cx: x, cy: CHAIR_TOP_Y }));
  }
  positions.push({ cx: CHAIR_RIGHT_X, cy: MID_Y });
  positions.push({ cx: CHAIR_LEFT_X, cy: MID_Y });
  for (let i = 0; i < bottomCount; i++) positions.push({ cx: TABLE_RIGHT_X - ((TABLE_RIGHT_X - TABLE_LEFT_X) * (i + 1)) / (bottomCount + 1), cy: CHAIR_BOTTOM_Y });
  return positions;
}

// Double table : deux rectangles superposés (bloc plus haut). Sièges sur les longs côtés extérieurs + 4 bouts.
function doublePositions(totalSeats: number): { cx: number; cy: number }[] {
  const LEFT = 27.5, RIGHT = 72.5;
  const CHAIR_TOP = 22, CHAIR_BOT = 78, CHAIR_LEFT = 18, CHAIR_RIGHT = 82;
  const MID_TOP = 41, MID_BOT = 59; // milieux des deux sous-rectangles
  const positions: { cx: number; cy: number }[] = [];
  if (totalSeats <= 0) return positions;
  const ends = [
    { cx: CHAIR_RIGHT, cy: MID_TOP },
    { cx: CHAIR_LEFT, cy: MID_TOP },
    { cx: CHAIR_RIGHT, cy: MID_BOT },
    { cx: CHAIR_LEFT, cy: MID_BOT },
  ];
  const endsCount = Math.min(4, totalSeats);
  const remaining = totalSeats - endsCount;
  const topCount = Math.ceil(remaining / 2);
  const bottomCount = remaining - topCount;
  const topXs: number[] = [];
  for (let i = 0; i < topCount; i++) topXs.push(LEFT + ((RIGHT - LEFT) * (i + 1)) / (topCount + 1));
  if (topXs.length > 0) {
    const mid = Math.floor(topXs.length / 2);
    [topXs[mid], ...topXs.slice(0, mid), ...topXs.slice(mid + 1)].forEach(x => positions.push({ cx: x, cy: CHAIR_TOP }));
  }
  for (let i = 0; i < endsCount; i++) positions.push(ends[i]);
  for (let i = 0; i < bottomCount; i++) positions.push({ cx: RIGHT - ((RIGHT - LEFT) * (i + 1)) / (bottomCount + 1), cy: CHAIR_BOT });
  return positions;
}

// Triple table : 3 rectangles verticaux côte à côte. Sièges répartis RÉGULIÈREMENT sur tout le périmètre.
function triplePositions(totalSeats: number): { cx: number; cy: number }[] {
  const L = 16, R = 84, T = 18, B = 82; // anneau des chaises autour du bloc
  const w = R - L, h = B - T;
  const per = 2 * (w + h);
  const positions: { cx: number; cy: number }[] = [];
  if (totalSeats <= 0) return positions;
  const step = per / totalSeats;
  for (let i = 0; i < totalSeats; i++) {
    let d = (i + 0.5) * step; // décalage d'un demi-pas pour éviter les coins
    if (d < w) positions.push({ cx: L + d, cy: T });
    else if (d < w + h) positions.push({ cx: R, cy: T + (d - w) });
    else if (d < 2 * w + h) positions.push({ cx: R - (d - w - h), cy: B });
    else positions.push({ cx: L, cy: B - (d - 2 * w - h) });
  }
  return positions;
}

function buildSeatLayout(totalSeats: number, animatorPlays: boolean, otherRegisteredCount: number, isUserHere: boolean, shape: 'round' | 'rectangle' | 'double' | 'triple'): SeatLayout[] {
  const positions = shape === 'rectangle' ? rectanglePositions(totalSeats)
    : shape === 'double' ? doublePositions(totalSeats)
    : shape === 'triple' ? triplePositions(totalSeats)
    : roundPositions(totalSeats);
  const layout: SeatLayout[] = [];
  let idx = 0;
  if (animatorPlays) { layout.push({ ...positions[idx], kind: 'animator' }); idx++; }
  if (isUserHere) { layout.push({ ...positions[idx], kind: 'you' }); idx++; }
  for (let i = 0; i < otherRegisteredCount; i++) { if (idx >= totalSeats) break; layout.push({ ...positions[idx], kind: 'other' }); idx++; }
  while (idx < totalSeats) { layout.push({ ...positions[idx], kind: 'empty' }); idx++; }
  return layout;
}

const SEAT_STYLES: Record<SeatKind, { fill: string; stroke: string; label: string }> = {
  empty:    { fill: '#c0dd97', stroke: '#639922', label: 'Place libre · cliquez pour vous inscrire' },
  other:    { fill: '#888888', stroke: '#444444', label: 'Place prise par un autre joueur' },
  you:      { fill: '#fec107', stroke: '#a07a00', label: 'Votre place · cliquez pour annuler' },
  animator: { fill: '#8b6914', stroke: '#5a4408', label: "Place de l'animateur" },
};

interface TableSeatsProps {
  table: GameTable;
  registrationsForTable: (Registration & { id: string })[];
  currentUserId: string | null;
  isAdmin: boolean;
  isSubmitting: boolean;
  onSeatClick: (table: GameTable, seatKind: 'empty' | 'you' | 'animator') => void;
  onDelete?: (table: GameTable) => void;
  size?: number; // px (default 104)
  showStatus?: boolean; // afficher « X places libres » sous le schéma (défaut true)
}

/** Rend uniquement le schéma de table (sièges cliquables) + le statut. Réutilisable en cartouche ou en grille. */
export function TableSeats({ table, registrationsForTable, currentUserId, isAdmin, isSubmitting, onSeatClick, onDelete, size = 104, showStatus = true }: TableSeatsProps) {
  const isUserHere = !!(currentUserId && registrationsForTable.some(r => r.userId === currentUserId));
  const otherRegisteredCount = registrationsForTable.filter(r => r.userId !== currentUserId).length;
  const animatorPlays = !!table.animatorPlays;
  const totalSeats = Math.max(1, table.totalSeats || 1);
  const shape: 'round' | 'rectangle' | 'double' | 'triple' =
    table.tableShape === 'rectangle' ? 'rectangle'
    : table.tableShape === 'double' ? 'double'
    : table.tableShape === 'triple' ? 'triple'
    : 'round';

  const layout = useMemo(() => buildSeatLayout(totalSeats, animatorPlays, otherRegisteredCount, isUserHere, shape), [totalSeats, animatorPlays, otherRegisteredCount, isUserHere, shape]);

  const playerCount = (animatorPlays ? 1 : 0) + (isUserHere ? 1 : 0) + otherRegisteredCount;
  const availableSeats = totalSeats - playerCount;
  const isFull = availableSeats <= 0;

  const handleSeatClick = (kind: SeatKind) => {
    if (isSubmitting) return;
    if (kind === 'other') return;
    if (kind === 'animator' && !isAdmin) return;
    if (kind === 'empty' && !currentUserId) return;
    onSeatClick(table, kind as 'empty' | 'you' | 'animator');
  };

  const statusText = isFull ? 'Complète' : `${availableSeats} place${availableSeats > 1 ? 's' : ''} libre${availableSeats > 1 ? 's' : ''}`;
  const statusColorClass = isFull ? 'text-destructive font-semibold' : availableSeats <= 1 ? 'text-amber-700 font-semibold' : 'text-green-700 font-semibold';

  return (
    <div className="relative flex flex-col items-center">
      {isAdmin && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(table)}
          disabled={registrationsForTable.length > 0}
          title={registrationsForTable.length > 0 ? 'Inscrits présents : suppression bloquée' : 'Retirer ce slot'}
          className={cn('absolute top-0 right-0 rounded p-0.5', registrationsForTable.length > 0 ? 'text-red-300 cursor-not-allowed' : 'text-red-600 hover:text-red-700')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      <svg viewBox="0 0 100 100" style={{ width: size, height: size }} className="block" aria-label={`Table de ${totalSeats} places, ${playerCount} occupées`}>
        {shape === 'rectangle' ? (
          <rect x="27.5" y="40" width="45" height="20" rx="2" fill="#d4a259" stroke="#8b6914" strokeWidth="1.5" />
        ) : shape === 'double' ? (
          <>
            <rect x="27.5" y="32" width="45" height="18" rx="2" fill="#d4a259" stroke="#8b6914" strokeWidth="1.5" />
            <rect x="27.5" y="50" width="45" height="18" rx="2" fill="#d4a259" stroke="#8b6914" strokeWidth="1.5" />
          </>
        ) : shape === 'triple' ? (
          <>
            <rect x="25" y="30" width="15" height="40" rx="2" fill="#d4a259" stroke="#8b6914" strokeWidth="1.5" />
            <rect x="42.5" y="30" width="15" height="40" rx="2" fill="#d4a259" stroke="#8b6914" strokeWidth="1.5" />
            <rect x="60" y="30" width="15" height="40" rx="2" fill="#d4a259" stroke="#8b6914" strokeWidth="1.5" />
          </>
        ) : (
          <circle cx="50" cy="50" r="20" fill="#d4a259" stroke="#8b6914" strokeWidth="1.5" />
        )}
        {layout.map((seat, i) => {
          const style = SEAT_STYLES[seat.kind];
          const interactive = seat.kind === 'empty' || seat.kind === 'you' || (seat.kind === 'animator' && isAdmin);
          // Oriente la chaise vers le centre de la table (50,50) : le dossier reste à l'extérieur.
          const rot = (Math.atan2(50 - seat.cy, 50 - seat.cx) * 180) / Math.PI - 90;
          return (
            <Tooltip key={i} delayDuration={300}>
              <TooltipTrigger asChild>
                <g onClick={() => handleSeatClick(seat.kind)} style={{ cursor: interactive ? 'pointer' : 'default' }} className={interactive ? 'hover:opacity-80' : undefined}>
                  {interactive && <circle cx={seat.cx} cy={seat.cy} r="11" fill="transparent" stroke="transparent" />}
                  <g transform={`translate(${seat.cx} ${seat.cy}) rotate(${rot})`}>
                    {/* dossier (extérieur) */}
                    <rect x="-4.5" y="-5.5" width="9" height="3" rx="1.5" fill={style.stroke} />
                    {/* assise */}
                    <rect x="-5" y="-2.5" width="10" height="7" rx="2" fill={style.fill} stroke={style.stroke} strokeWidth="1" />
                  </g>
                  {seat.kind === 'animator' && <text x={seat.cx} y={seat.cy + 1.8} textAnchor="middle" fontSize="5.5" fill="#fec107" fontWeight="bold" pointerEvents="none">★</text>}
                </g>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">{style.label}</p></TooltipContent>
            </Tooltip>
          );
        })}
      </svg>
      {showStatus && <p className={cn('text-xs text-center mt-0.5', statusColorClass)}>{statusText}</p>}
    </div>
  );
}
