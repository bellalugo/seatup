import type { GameTable, User, Registration, TicketType } from '@/lib/types';
import { Swords, Castle, Flag } from 'lucide-react';

// Mock Users
export const mockUsers: Record<string, User> = {
  'user-123': { id: 'user-123', name: 'Alice (Strategist)', ticketType: 'Strategist' },
  'user-456': { id: 'user-456', name: 'Bob (Marshal)', ticketType: 'Marshal' },
  'user-789': { id: 'user-789', name: 'Charlie (General)', ticketType: 'General' },
  'user-000': { id: 'user-000', name: 'David (No Ticket)', ticketType: 'None' },
};

// Mock Game Tables Data
export const mockGameTables: GameTable[] = [
  { id: 'table-1', gameName: 'Twilight Imperium 4', day: 'Thursday', timeSlot: '09:00 - 17:00', totalSeats: 6, gameTypeIcon: Castle },
  { id: 'table-2', gameName: 'Advanced Squad Leader', day: 'Thursday', timeSlot: '09:00 - 13:00', totalSeats: 2, gameTypeIcon: Swords },
  { id: 'table-3', gameName: 'Axis & Allies: Global 1940', day: 'Thursday', timeSlot: '14:00 - 18:00', totalSeats: 5, gameTypeIcon: Flag },
  { id: 'table-4', gameName: 'Star Wars: Rebellion', day: 'Friday', timeSlot: '10:00 - 14:00', totalSeats: 2, gameTypeIcon: Castle },
  { id: 'table-5', gameName: 'Memoir \'44 Overlord', day: 'Friday', timeSlot: '15:00 - 18:00', totalSeats: 8, gameTypeIcon: Swords },
  { id: 'table-6', gameName: 'Paths of Glory', day: 'Saturday', timeSlot: '09:00 - 15:00', totalSeats: 2, gameTypeIcon: Flag },
  { id: 'table-7', gameName: 'Here I Stand', day: 'Saturday', timeSlot: '10:00 - 18:00', totalSeats: 6, gameTypeIcon: Castle },
  { id: 'table-8', gameName: 'Commands & Colors: Ancients', day: 'Sunday', timeSlot: '10:00 - 13:00', totalSeats: 2, gameTypeIcon: Swords },
];

// Mock initial registrations (can be empty)
export const mockRegistrations: Registration[] = [
  // Example: { userId: 'user-123', tableId: 'table-2' }
];

// Helper function to get available seats
export const getAvailableSeats = (tableId: string, registrations: Registration[], tables: GameTable[]): number => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return 0;
    const currentRegistrations = registrations.filter(r => r.tableId === tableId).length;
    return table.totalSeats - currentRegistrations;
};

// Helper to check time slot conflict
export const hasTimeConflict = (newTable: GameTable, userRegistrations: Registration[], allTables: GameTable[]): boolean => {
    const userTableIds = userRegistrations.map(r => r.tableId);
    const userTables = allTables.filter(t => userTableIds.includes(t.id));

    return userTables.some(registeredTable => {
        // Basic conflict check: same day and overlapping time (simplistic check)
        // A more robust check would parse times and compare ranges.
        return registeredTable.day === newTable.day && registeredTable.timeSlot === newTable.timeSlot;
        // Add more complex overlap logic if needed based on start/end times
    });
};

// Helper function to check registration eligibility based on ticket type and current phase
export const canRegisterBasedOnTicket = (userTicketType: TicketType, currentPhaseIndex: number): boolean => {
    if (userTicketType === 'None') return false;
    const userPhaseIndex = registrationPhases.indexOf(userTicketType);
    return userPhaseIndex !== -1 && userPhaseIndex <= currentPhaseIndex;
};
