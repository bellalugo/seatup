
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

export interface GameTable {
  id: string;
  gameId: string; // Foreign key to the "games" collection
  day: 'Jeudi' | 'Vendredi' | 'Samedi' | 'Dimanche';
  timeSlot: string; // e.g., "09:00 - 13:00"
  totalSeats: number;
  tableNumber: string; // Added field for table number
  authorAnimator?: string; // Optional field for Author/Animator
  gameName?: string; // Populated at runtime
  gameImageUrl?: string; // Populated at runtime
  imageUrl?: string;
}

/**
 * Type definition for the data collected from the add/edit table form.
 */
export interface GameTableInput {
    gameId: string;
    day: 'Jeudi' | 'Vendredi' | 'Samedi' | 'Dimanche';
    timeSlot: string;
    totalSeats: number;
    tableNumber: string;
    authorAnimator?: string;
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

// Define registration phases with specific start dates
export interface RegistrationPhase {
  ticketType: TicketType;
  name: string; // User-friendly name of the phase/ticket
  startDate: Date; // The date and time when this phase opens (UTC)
  description: string; // Description for display on the page
}

// Corrected dates to 2024
export const REGISTRATION_SCHEDULE: RegistrationPhase[] = [
  { ticketType: 'Stratège', name: 'Stratège', startDate: new Date('2024-06-20T00:00:00Z'), description: "Ouverture pour billets Stratège" },
  { ticketType: 'Maréchal', name: 'Maréchal', startDate: new Date('2024-06-22T00:00:00Z'), description: "Ouverture pour billets Maréchal et Stratège" },
  { ticketType: 'Général', name: 'Général', startDate: new Date('2024-06-24T00:00:00Z'), description: "Ouverture pour billets Général, Maréchal et Stratège" },
  // Invitation n'a pas de phase d'ouverture d'inscription car ils ne peuvent pas s'inscrire
];

// For manual admin control
export interface ManualRegistrationControls {
  id?: string; // Firestore document ID, typically fixed like 'currentControls'
  strategistManuallyOpen: boolean;
  marshalManuallyOpen: boolean;
  generalManuallyOpen: boolean;
  lastUpdated?: Date;
}
