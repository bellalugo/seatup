'use client';

import type React from 'react';
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Mic, Star, Trash2 } from 'lucide-react';
import type { GameTable, Registration } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SalonTableCardProps {
  table: GameTable;
  registrationsForTable: (Registration & { id: string })[];
  currentUserId: string | null;
  isAdmin: boolean;
  isSubmitting: boolean;
  onSeatClick: (table: GameTable, seatKind: 'empty' | 'you' | 'animator') => void;
  /** Admin uniquement : suppression du slot. Si absent, aucun bouton de suppression. */
  onDelete?: (table: GameTable) => void;
}

type SeatKind = 'empty' | 'other' | 'you' | 'animator';

interface SeatLayout {
  cx: number;
  cy: number;
  kind: SeatKind;
}

// Compute chair positions around a ROUND table. Chairs are equally spaced on a circle of radius 30
// starting from the top (angle -π/2).
function roundPositions(totalSeats: number): { cx: number; cy: number }[] {
  const RADIUS = 30;
  const CENTER = 50;
  const positions: { cx: number; cy: number }[] = [];
  for (let i = 0; i < totalSeats; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / totalSeats;
    positions.push({
      cx: CENTER + RADIUS * Math.cos(angle),
      cy: CENTER + RADIUS * Math.sin(angle),
    });
  }
  return positions;
}

// Compute chair positions around a RECTANGULAR table.
// One seat is always placed at each short end (the two "heads"); remaining seats fill the long
// sides (top then bottom). Position 0 is the host/animator seat (top-center, or a head for 2 seats).
function rectanglePositions(totalSeats: number): { cx: number; cy: number }[] {
  // Échelle commune : 4 cm / unité. Table rectangulaire réelle 180 x 80 cm => 45 x 20 unités,
  // centrée dans le viewBox 100x100 (x: 27.5->72.5, y: 40->60). À comparer avec la ronde Ø160 cm (r=20).
  const TABLE_TOP_Y = 40;
  const TABLE_BOTTOM_Y = 60;
  const CHAIR_TOP_Y = 30;      // ~10 au-dessus de la table
  const CHAIR_BOTTOM_Y = 70;   // ~10 en dessous de la table
  const TABLE_LEFT_X = 27.5;
  const TABLE_RIGHT_X = 72.5;
  const CHAIR_LEFT_X = 17.5;   // ~10 à gauche de la table
  const CHAIR_RIGHT_X = 82.5;  // ~10 à droite de la table

  const MID_Y = (TABLE_TOP_Y + TABLE_BOTTOM_Y) / 2;
  const CENTER_X = (TABLE_LEFT_X + TABLE_RIGHT_X) / 2;

  const positions: { cx: number; cy: number }[] = [];
  if (totalSeats <= 0) return positions;
  // Single-seat table: just one chair at the top.
  if (totalSeats === 1) {
    positions.push({ cx: CENTER_X, cy: CHAIR_TOP_Y });
    return positions;
  }

  // Always reserve one seat at each short end (the two "heads"); split the rest between long sides.
  const remaining = totalSeats - 2;
  const topCount = Math.ceil(remaining / 2);
  const bottomCount = Math.floor(remaining / 2);

  // Top row, with the middle seat first (host/animator position).
  const topXs: number[] = [];
  for (let i = 0; i < topCount; i++) {
    topXs.push(TABLE_LEFT_X + ((TABLE_RIGHT_X - TABLE_LEFT_X) * (i + 1)) / (topCount + 1));
  }
  if (topXs.length > 0) {
    const mid = Math.floor(topXs.length / 2);
    [topXs[mid], ...topXs.slice(0, mid), ...topXs.slice(mid + 1)].forEach(x =>
      positions.push({ cx: x, cy: CHAIR_TOP_Y })
    );
  }

  // The two heads (short ends), centered vertically on the table.
  positions.push({ cx: CHAIR_RIGHT_X, cy: MID_Y });
  positions.push({ cx: CHAIR_LEFT_X, cy: MID_Y });

  // Bottom row.
  for (let i = 0; i < bottomCount; i++) {
    positions.push({ cx: TABLE_RIGHT_X - ((TABLE_RIGHT_X - TABLE_LEFT_X) * (i + 1)) / (bottomCount + 1), cy: CHAIR_BOTTOM_Y });
  }

  return positions;
}

// Build the chair layout around the table.
//  - Chair 0 (top) is the animator's seat when animatorPlays is true.
//  - Otherwise chairs are filled in clockwise order: user's seat first (if registered), then other registered players, then empty seats.
function buildSeatLayout(
  totalSeats: number,
  animatorPlays: boolean,
  otherRegisteredCount: number,
  isUserHere: boolean,
  shape: 'round' | 'rectangle' = 'round'
): SeatLayout[] {
  const positions = shape === 'rectangle' ? rectanglePositions(totalSeats) : roundPositions(totalSeats);

  // Determine the kind of each seat by sequential assignment.
  const layout: SeatLayout[] = [];
  let idx = 0;
  if (animatorPlays) {
    layout.push({ ...positions[idx], kind: 'animator' });
    idx++;
  }
  if (isUserHere) {
    layout.push({ ...positions[idx], kind: 'you' });
    idx++;
  }
  for (let i = 0; i < otherRegisteredCount; i++) {
    if (idx >= totalSeats) break;
    layout.push({ ...positions[idx], kind: 'other' });
    idx++;
  }
  while (idx < totalSeats) {
    layout.push({ ...positions[idx], kind: 'empty' });
    idx++;
  }
  return layout;
}

const SEAT_STYLES: Record<SeatKind, { fill: string; stroke: string; label: string }> = {
  empty:    { fill: '#c0dd97', stroke: '#639922', label: 'Place libre · cliquez pour vous inscrire' },
  other:    { fill: '#888888', stroke: '#444444', label: 'Place prise par un autre joueur' },
  you:      { fill: '#fec107', stroke: '#a07a00', label: 'Votre place · cliquez pour annuler' },
  animator: { fill: '#8b6914', stroke: '#5a4408', label: "Place de l'animateur" },
};

export function SalonTableCard({
  table,
  registrationsForTable,
  currentUserId,
  isAdmin,
  isSubmitting,
  onSeatClick,
  onDelete,
}: SalonTableCardProps) {
  // Derive registration counts excluding the current user.
  const isUserHere = !!(currentUserId && registrationsForTable.some(r => r.userId === currentUserId));
  const otherRegisteredCount = registrationsForTable.filter(r => r.userId !== currentUserId).length;
  const animatorPlays = !!table.animatorPlays;
  const totalSeats = Math.max(1, table.totalSeats || 1);
  const shape: 'round' | 'rectangle' = table.tableShape === 'rectangle' ? 'rectangle' : 'round';

  const layout = useMemo(
    () => buildSeatLayout(totalSeats, animatorPlays, otherRegisteredCount, isUserHere, shape),
    [totalSeats, animatorPlays, otherRegisteredCount, isUserHere, shape]
  );

  // Player count includes animator when they play, per the product decision.
  const playerCount = (animatorPlays ? 1 : 0) + (isUserHere ? 1 : 0) + otherRegisteredCount;
  const availableSeats = totalSeats - playerCount;
  const isFull = availableSeats <= 0;

  // Animator metadata for the header line.
  const hasAnimator = !!(table.authorAnimator && table.authorAnimator.trim().length > 0);
  let animatorLine: React.ReactNode;
  if (!hasAnimator) {
    animatorLine = (
      <span className="italic flex items-center gap-1">
        <Users className="h-3 w-3" /> Table en accès libre
      </span>
    );
  } else if (animatorPlays) {
    animatorLine = (
      <span className="flex items-center gap-1">
        <span className="font-medium text-amber-800">Anim.+joueur</span> {table.authorAnimator}
      </span>
    );
  } else {
    animatorLine = (
      <span className="flex items-center gap-1">
        <Mic className="h-3 w-3" /> <span className="font-medium">Anim.</span> {table.authorAnimator}
      </span>
    );
  }

  const handleSeatClick = (kind: SeatKind) => {
    if (isSubmitting) return;
    if (kind === 'other') return; // Cannot click someone else's seat
    if (kind === 'animator' && !isAdmin) return; // Only admins toggle animator seat
    if (kind === 'empty' && !currentUserId) return; // Need to be logged in to register
    onSeatClick(table, kind);
  };

  const statusText = isFull
    ? 'Complète'
    : `${availableSeats} place${availableSeats > 1 ? 's' : ''} libre${availableSeats > 1 ? 's' : ''}`;

  const statusColorClass = isFull
    ? 'text-destructive font-semibold'
    : availableSeats <= 1
      ? 'text-amber-700 font-semibold'
      : 'text-green-700 font-semibold';

  // Visuel du jeu (à gauche de la cartouche).
  const imgUrl = table.gameImageUrl || table.imageUrl || '';

  // Couleur du bandeau = état de la table.
  // Terminée → gris ; en cours → ambre ; complète → rouge ; ouverte (≥1 place libre) → vert.
  const bannerClass =
    table.status === 'Terminee' ? 'bg-stone-400'
    : table.status === 'EnCours' ? 'bg-amber-400'
    : isFull ? 'bg-red-500'
    : 'bg-green-500';

  return (
    <Card className={cn('overflow-hidden transition-opacity', isFull && 'opacity-70')}>
      {/* Bandeau d'état : la couleur indique l'état de la table */}
      <div className={cn('flex items-center justify-between gap-2 px-3 py-1.5', bannerClass)}>
        <div className="min-w-0 flex items-center gap-2 flex-1">
          <span className="bg-stone-900 text-white px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0">{table.tableNumber}</span>
          <span className="text-sm font-bold leading-tight truncate text-stone-900">{table.gameName}</span>
          <span className="text-xs text-stone-800/90 truncate flex-shrink-0">{animatorLine}</span>
        </div>
        {isAdmin && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(table)}
            disabled={registrationsForTable.length > 0}
            title={registrationsForTable.length > 0 ? "Impossible : des joueurs sont inscrits sur ce slot" : "Supprimer ce slot"}
            aria-label="Supprimer ce slot"
            className={cn(
              "rounded p-1 shadow-sm flex-shrink-0",
              registrationsForTable.length > 0
                ? "bg-white/40 text-red-300 cursor-not-allowed"
                : "bg-white/85 text-red-600 hover:bg-white hover:text-red-700"
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Corps horizontal : visuel à gauche, table à droite */}
      <div className="flex gap-3 p-3">
        <div className="w-1/2 flex-shrink-0">
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl} alt={table.gameName} className="w-full h-24 object-cover rounded-md border border-border" loading="lazy" />
          ) : (
            <div className="w-full h-24 rounded-md border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
              Pas de visuel
            </div>
          )}
        </div>

        <div className="w-1/2 flex flex-col items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-[124px] h-[124px] block" aria-label={`Table de ${totalSeats} places, ${playerCount} occupées`}>
            {/* Table (round or rectangle) */}
            {shape === 'rectangle' ? (
              <rect x="27.5" y="40" width="45" height="20" rx="2" fill="#d4a259" stroke="#8b6914" strokeWidth="1.5" />
            ) : (
              <circle cx="50" cy="50" r="20" fill="#d4a259" stroke="#8b6914" strokeWidth="1.5" />
            )}
            {/* Chairs */}
            {layout.map((seat, i) => {
              const style = SEAT_STYLES[seat.kind];
              const interactive =
                seat.kind === 'empty' ||
                seat.kind === 'you' ||
                (seat.kind === 'animator' && isAdmin);
              return (
                <Tooltip key={i} delayDuration={300}>
                  <TooltipTrigger asChild>
                    <g
                      onClick={() => handleSeatClick(seat.kind)}
                      style={{ cursor: interactive ? 'pointer' : 'default' }}
                      className={interactive ? 'hover:opacity-80' : undefined}
                    >
                      {/* Zone tactile élargie (invisible) pour faciliter le clic sur les sièges interactifs */}
                      {interactive && (
                        <circle cx={seat.cx} cy={seat.cy} r="12" fill="transparent" stroke="transparent" />
                      )}
                      <circle
                        cx={seat.cx}
                        cy={seat.cy}
                        r="7.5"
                        fill={style.fill}
                        stroke={style.stroke}
                        strokeWidth="1.5"
                      />
                      {seat.kind === 'animator' && (
                        <text
                          x={seat.cx}
                          y={seat.cy + 1.5}
                          textAnchor="middle"
                          fontSize="6"
                          fill="#fec107"
                          fontWeight="bold"
                          pointerEvents="none"
                        >
                          ★
                        </text>
                      )}
                    </g>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">{style.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </svg>

          <p className={cn('text-xs text-center mt-1', statusColorClass)}>
            {statusText}
            {playerCount > 0 && <span className="text-muted-foreground font-normal"> · {playerCount} joueur{playerCount > 1 ? 's' : ''}</span>}
          </p>
          {animatorPlays && (
            <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
              <Star className="h-2.5 w-2.5" /> Animateur à table
            </p>
          )}
          {hasAnimator && !animatorPlays && (
            <p className="text-[10px] text-center text-muted-foreground">N&apos;occupe pas de siège</p>
          )}
        </div>
      </div>
    </Card>
  );
}
