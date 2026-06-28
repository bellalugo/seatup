import type React from 'react'; // Ensure React is imported for ElementType

export type TicketType = 'Stratège' | 'Maréchal' | 'Général' | 'Colonel' | 'Invitation';

export interface User {
  id: string; // Firebase Auth UID or Participant ID from Firestore
  name: string;
  ticketType: TicketType;
  email?: string; // Email of the user/participant
}

// Represents a game entity from the "games" collection
export interface Game {
  id:string;
  nom: string; // Name of the game
  description: string;
  imageUrl: string; // URL for the game's image
  asynconvURL: string; // URL to AsynConv page for the game
  nbre_min: number; // Minimum number of players
  nbre_max: number; // Maximum number of players
  tableNumber?: string; // Numéro de la table physique (une table = un jeu, fixe pour la convention)
}

// Input type for creating or updating a game
export interface GameInput {
  nom: string;
  description: string;
  imageUrl: string;
  asynconvURL: string;
  nbre_min: number;
  nbre_max: number;
  tableNumber?: string;
}

export const CONVENTION_DAYS = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche', 'Lundi'] as const;
export type ConventionDay = typeof CONVENTION_DAYS[number];

export const TIME_SLOT_TYPES = ['Matin', 'Après-midi', 'Journée', 'Off'] as const;
export type TimeSlotType = typeof TIME_SLOT_TYPES[number];

// Defines the display label and the actual underlying slots for conflict checking
export interface TimeSlotOption {
  value: TimeSlotType;
  label: string; // User-facing label, e.g., "Matin (09:00-13:00)"
  // actualSlots represents the granular slots this TimeSlotType occupies.
  // Used for precise conflict detection.
  // 'Matin_Slot' could map to '09:00-13:00', 'Aprem_Slot' to '14:00-19:00'.
  // 'Journee_Slot' maps to both. 'Off_Slot' is distinct.
  actualSlots: ('Matin_Slot' | 'Aprem_Slot' | 'Off_Slot')[];
}

export const TIME_SLOT_TYPE_OPTIONS: TimeSlotOption[] = [
  { value: 'Matin', label: 'Matin (09:00-13:00)', actualSlots: ['Matin_Slot'] },
  { value: 'Après-midi', label: 'Après-midi (14:00-19:00)', actualSlots: ['Aprem_Slot'] },
  { value: 'Journée', label: 'Journée (09:00-19:00)', actualSlots: ['Matin_Slot', 'Aprem_Slot'] },
  { value: 'Off', label: 'Off (Soirée)', actualSlots: ['Off_Slot'] },
];

// Helper to get the display label for a TimeSlotType
export const getTimeSlotTypeDisplayLabel = (type: TimeSlotType): string => {
  return TIME_SLOT_TYPE_OPTIONS.find(opt => opt.value === type)?.label || type;
};

// Helper to get actual granular slots for conflict checking
export const getActualGranularSlotsForTimeSlotType = (type: TimeSlotType): string[] => {
  return TIME_SLOT_TYPE_OPTIONS.find(opt => opt.value === type)?.actualSlots || [type]; // Fallback to type itself if not found
}

export type TableStatus = "Ouverte" | "EnAttente" | "EnCours" | "Terminee";

export type TableShape = "round" | "rectangle" | "double" | "triple";

export interface GameTable {
  id: string;
  gameId: string;
  days: ConventionDay[]; // Changed from day: ConventionDay
  timeSlotType: TimeSlotType; // New: Matin, Après-midi, Journée, Off
  totalSeats: number;
  tableNumber: string;
  // Physical shape of the table: round (default) or rectangle. Drives the salon-view visual layout.
  tableShape?: TableShape;
  authorAnimator?: string;
  // When true, the animator occupies one of the seats (case 2 of the 3 animator scenarios).
  // When false or absent: animator only animates without playing (case 1), or table is free-access
  // if authorAnimator is empty (case 3). Defaults to false on existing data.
  animatorPlays?: boolean;
  status?: TableStatus;
  // Dynamic properties, not stored in Firestore directly, but populated by getGameTables
  gameName?: string;
  gameImageUrl?: string;
  gameDescription?: string;
  imageUrl?: string; // Kept for compatibility if old data has it directly
}

export interface GameTableInput {
  gameId: string;
  days: ConventionDay[]; // Changed
  timeSlotType: TimeSlotType; // New
  totalSeats: number;
  tableNumber: string;
  tableShape?: TableShape;
  authorAnimator?: string;
  animatorPlays?: boolean;
  status?: TableStatus;
}


export interface Registration {
  userId: string; // Corresponds to User.id (Participant's Firestore ID for now)
  tableId?: string; // Ancien modèle (gameTables) — conservé pour compatibilité transitoire.
  slotId?: string;  // Nouveau modèle : inscription rattachée à un slot.
  status?: RegistrationStatus; // 'confirmed' (place) | 'waiting' (file) | 'offered' (place proposée)
  timestamp?: Date; // Optional: timestamp of registration
}

// Represents an author/animator stored in the dedicated `animateurs` collection.
// `nom` (last name) is optional and may be empty when only a first name is known.
export interface Animator {
  id: string;
  prenom: string;
  nom: string;
}

export interface AnimatorInput {
  prenom: string;
  nom: string;
}

// Helper: full display name "Prénom Nom" (trimmed; handles empty nom).
export const animatorDisplayName = (a: { prenom?: string; nom?: string }): string =>
  `${a.prenom || ''} ${a.nom || ''}`.replace(/\s+/g, ' ').trim();

// =============================================================================
//  NOUVEAU MODÈLE — Configurations de tables + Grille de slots
//  - Jeu (games)            : catalogue.
//  - Configuration          : gabarit réutilisable (jeu + places + forme + animation), SANS temps ni joueurs.
//  - Slot                   : une configuration déposée sur des cellules de la grille (jour × session).
//                             Le slot porte les inscriptions et la liste d'attente.
// =============================================================================

// Sessions atomiques de la grille (slot unitaire = une demi-journée ou la soirée).
export const SESSIONS = ['Matin', 'Après-midi', 'Soir'] as const;
export type SessionType = typeof SESSIONS[number];

export const SESSION_LABELS: Record<SessionType, string> = {
  'Matin': 'Matin (09:00–13:00)',
  'Après-midi': 'Après-midi (14:00–19:00)',
  'Soir': 'Soirée',
};

// Configuration = gabarit réutilisable. Ni temps, ni joueurs.
export interface TableConfig {
  id: string;
  gameId: string;
  label?: string;            // libellé optionnel, ex. "animée par Florian" ou "accès libre"
  totalSeats: number;
  tableShape?: TableShape;
  authorAnimator?: string;   // vide => accès libre
  animatorPlays?: boolean;   // l'animateur occupe-t-il un siège
  isDefault?: boolean;       // configuration par défaut du jeu (une seule par jeu) — utilisée pour « remplir la ligne »
  // Champs hydratés à la lecture (non stockés) :
  gameName?: string;
  gameImageUrl?: string;
  gameDescription?: string;
  gameTableNumber?: string; // numéro de la table physique (depuis le jeu)
  nbreMin?: number;
  nbreMax?: number;
}

export interface TableConfigInput {
  gameId: string;
  label?: string;
  totalSeats: number;
  tableShape?: TableShape;
  authorAnimator?: string;
  animatorPlays?: boolean;
  isDefault?: boolean;
}

// Une cellule de la grille.
export interface SlotCell {
  day: ConventionDay;
  session: SessionType;
}

// Slot = configuration placée sur une ou plusieurs cellules contiguës.
export interface Slot {
  id: string;
  configId: string;
  cells: SlotCell[];         // cellules occupées (contiguës) : 1 = demi-journée, 2 = journée, etc.
  status?: TableStatus;
  // Champs hydratés à la lecture (non stockés) :
  config?: TableConfig;
}

export interface SlotInput {
  configId: string;
  cells: SlotCell[];
  status?: TableStatus;
}

// Statut d'une inscription sur un slot.
export type RegistrationStatus = 'confirmed' | 'waiting' | 'offered';

// Represents a participant fetched from Billetweb and stored in Firestore
export interface Participant {
  id: string; // Billetweb ID or unique ID from Billetweb, used as Firestore document ID
  nom: string;
  prenom: string;
  email: string;
  typeBillet: TicketType;
  // Empreinte SHA-256 du numéro de billet (ext_id). Jamais le numéro en clair.
  // Sert de second facteur à la connexion (email + numéro de billet).
  ticketHash?: string;
}

// Represents the result of a game table, including winners and number of players
export interface GameResult {
  tableId: string; // Corresponds to GameTable.id, used as document ID in 'gameResults' collection
  winnerIds: string[]; // Array of Participant.id for winners
  playersInGame: number; // Number of participants who played in this game session
  timestamp?: Date; // Optional: when the result was recorded
}

// For manual admin control
export interface ManualRegistrationControls {
  id?: string; // Firestore document ID, typically fixed like 'currentControls'
  strategistManuallyOpen: boolean;
  marshalManuallyOpen: boolean;
  generalManuallyOpen: boolean;
  colonelManuallyOpen: boolean;
  lastUpdated?: Date;
}

// Represents the structure of an attendee from the Billetweb API
export interface BilletwebAttendee {
  id: number | string;
  ext_id?: string; // Numéro de billet visible par le participant (ex. "T927-5275-E1288809")
  name: string;
  firstname: string;
  email: string;
  ticket: string;
  date?: string;
  answers?: {
    label: string;
    value: string;
  }[];
}
