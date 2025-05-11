
import type React from 'react'; // Ensure React is imported for ElementType

export type TicketType = 'Stratège' | 'Maréchal' | 'Général' | 'Aucun';

export interface User {
  id: string;
  name: string; // Added for display
  ticketType: TicketType;
}

// Represents a game entity from the "games" collection
export interface Game {
  id: string;
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
  // gameName and gameImageUrl will be populated by joining with the "games" collection
  gameName?: string; // Populated at runtime
  gameImageUrl?: string; // Populated at runtime
  imageUrl?: string; // This seems to be a duplicate or legacy field, gameImageUrl is preferred.
}

/**
 * Type definition for the data collected from the add/edit table form.
 * GameTable will now link to a Game entity via gameId.
 */
export interface GameTableInput {
    gameId: string; // User selects a game from the "games" collection
    day: 'Jeudi' | 'Vendredi' | 'Samedi' | 'Dimanche';
    timeSlot: string;
    totalSeats: number;
    tableNumber: string; // Added field for table number
}


export interface Registration {
  userId: string;
  tableId: string;
}

// Define registration phases based on ticket priority
export const registrationPhases: TicketType[] = ['Stratège', 'Maréchal', 'Général'];

