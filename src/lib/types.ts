import type React from 'react'; // Ensure React is imported for ElementType

export type TicketType = 'Stratège' | 'Maréchal' | 'Général' | 'Invitation';

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
}

// Input type for creating or updating a game
export interface GameInput {
  nom: string;
  description: string;
  imageUrl: string;
  asynconvURL: string;
  nbre_min: number;
  nbre_max: number;
}

export const CONVENTION_DAYS = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
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

export interface GameTable {
  id: string;
  gameId: string;
  days: ConventionDay[]; // Changed from day: ConventionDay
  timeSlotType: TimeSlotType; // New: Matin, Après-midi, Journée, Off
  totalSeats: number;
  tableNumber: string;
  authorAnimator?: string;
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
  authorAnimator?: string;
  status?: TableStatus;
}


export interface Registration {
  userId: string; // Corresponds to User.id (Participant's Firestore ID for now)
  tableId: string;
  timestamp?: Date; // Optional: timestamp of registration
}

// Represents a participant fetched from Billetweb and stored in Firestore
export interface Participant {
  id: string; // Billetweb ID or unique ID from Billetweb, used as Firestore document ID
  nom: string;
  prenom: string;
  email: string;
  typeBillet: TicketType;
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
  lastUpdated?: Date;
}
