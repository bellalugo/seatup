
import type { GameTable, User, Registration, TicketType, GameTableInput } from '@/lib/types';
// Correctly import registrationPhases from types.ts
import { registrationPhases as importedRegistrationPhases } from '@/lib/types';
import { Swords, Castle, Flag } from 'lucide-react';
import React from 'react'; // Import React for createElement


// Map icon names to components
const iconMap: Record<string, React.ElementType> = {
  Swords: Swords,
  Castle: Castle,
  Flag: Flag,
};

// Helper to get icon component from name
export const getIconComponent = (iconName?: string): React.ElementType | undefined => {
  return iconName ? iconMap[iconName] : undefined;
};


// Mock Users
export const mockUsers: Record<string, User> = {
  'user-123': { id: 'user-123', name: 'Alice (Strategist)', ticketType: 'Strategist' },
  'user-456': { id: 'user-456', name: 'Bob (Marshal)', ticketType: 'Marshal' },
  'user-789': { id: 'user-789', name: 'Charlie (General)', ticketType: 'General' },
  'user-000': { id: 'user-000', name: 'David (No Ticket)', ticketType: 'None' },
};

// Mock Game Tables Data - Make this mutable for the admin panel demo
export let mockGameTables: GameTable[] = [
  { id: 'table-1', gameName: 'Twilight Imperium 4', day: 'Thursday', timeSlot: '09:00 - 17:00', totalSeats: 6, gameTypeIcon: Castle },
  { id: 'table-2', gameName: 'Advanced Squad Leader', day: 'Thursday', timeSlot: '09:00 - 13:00', totalSeats: 2, gameTypeIcon: Swords },
  { id: 'table-3', gameName: 'Axis & Allies: Global 1940', day: 'Thursday', timeSlot: '14:00 - 18:00', totalSeats: 5, gameTypeIcon: Flag },
  { id: 'table-4', gameName: 'Star Wars: Rebellion', day: 'Friday', timeSlot: '10:00 - 14:00', totalSeats: 2, gameTypeIcon: Castle },
  { id: 'table-5', gameName: 'Memoir \'44 Overlord', day: 'Friday', timeSlot: '15:00 - 18:00', totalSeats: 8, gameTypeIcon: Swords },
  { id: 'table-6', gameName: 'Paths of Glory', day: 'Saturday', timeSlot: '09:00 - 15:00', totalSeats: 2, gameTypeIcon: Flag },
  { id: 'table-7', gameName: 'Here I Stand', day: 'Saturday', timeSlot: '10:00 - 18:00', totalSeats: 6, gameTypeIcon: Castle },
  { id: 'table-8', gameName: 'Commands & Colors: Ancients', day: 'Sunday', timeSlot: '10:00 - 13:00', totalSeats: 2, gameTypeIcon: Swords },
];

// Mock initial registrations (can be empty) - Make this mutable
export let mockRegistrations: Registration[] = [
  // Example: { userId: 'user-123', tableId: 'table-2' }
];

// Re-export registrationPhases for use in components
export const registrationPhases = importedRegistrationPhases;


// --- Data Mutation Functions (Mock Backend) ---

/** Adds a new table to the mock data */
export const addMockTable = (tableInput: GameTableInput): GameTable => {
    const newId = `table-${Date.now()}-${Math.random().toString(16).substring(2, 8)}`;
    const newTable: GameTable = {
        id: newId,
        ...tableInput,
        gameTypeIcon: getIconComponent(tableInput.gameTypeIconName),
    };
    mockGameTables.push(newTable);
    console.log("Added table:", newTable);
    console.log("Current tables:", mockGameTables);
    return newTable;
};

/** Updates an existing table in the mock data */
export const updateMockTable = (updatedTable: GameTable): GameTable => {
    const index = mockGameTables.findIndex(t => t.id === updatedTable.id);
    if (index === -1) {
        throw new Error(`Table with ID ${updatedTable.id} not found.`);
    }
    // Ensure the icon component is correctly resolved if the name changed
    const tableWithResolvedIcon = {
        ...updatedTable,
        gameTypeIcon: getIconComponent( // Assuming the icon name might be passed indirectly or needs re-resolution
             Object.keys(iconMap).find(key => iconMap[key] === updatedTable.gameTypeIcon) || undefined
        ) ?? getIconComponent((updatedTable as any).gameTypeIconName) // Fallback if name passed directly
    };

    mockGameTables[index] = tableWithResolvedIcon;
    console.log("Updated table:", tableWithResolvedIcon);
    console.log("Current tables:", mockGameTables);
    return tableWithResolvedIcon;
};


/** Deletes a table from the mock data */
export const deleteMockTable = (tableId: string): void => {
    const initialLength = mockGameTables.length;
    mockGameTables = mockGameTables.filter(t => t.id !== tableId);
    if (mockGameTables.length === initialLength) {
         throw new Error(`Table with ID ${tableId} not found for deletion.`);
    }
    // Also remove any registrations associated with this table
    mockRegistrations = mockRegistrations.filter(r => r.tableId !== tableId);
    console.log("Deleted table:", tableId);
    console.log("Current tables:", mockGameTables);
    console.log("Current registrations:", mockRegistrations);
};

// --- Read Functions (Remain mostly the same) ---

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
        if (registeredTable.id === newTable.id) {
            return false; // Don't conflict with the table itself if editing/re-registering
        }
        if (registeredTable.day !== newTable.day) {
          return false; // Different days, no conflict
        }

        const parseTimeSlot = (slot: string): { start: number; end: number } | null => {
            const match = slot.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
            if (!match) return null;
            const startHour = parseInt(match[1], 10);
            const startMinute = parseInt(match[2], 10);
            const endHour = parseInt(match[3], 10);
            const endMinute = parseInt(match[4], 10);
            return { start: startHour * 60 + startMinute, end: endHour * 60 + endMinute };
        };

        const registeredSlot = parseTimeSlot(registeredTable.timeSlot);
        const newSlot = parseTimeSlot(newTable.timeSlot);

        if (!registeredSlot || !newSlot) {
            // Fallback to exact string match if parsing fails
            return registeredTable.timeSlot === newTable.timeSlot;
        }

        // Check for overlap: !(endA <= startB || startA >= endB)
        const overlaps = !(newSlot.end <= registeredSlot.start || newSlot.start >= registeredSlot.end);
        return overlaps;
    });
};


// Helper function to check registration eligibility based on ticket type and current phase
export const canRegisterBasedOnTicket = (userTicketType: TicketType, currentPhaseIndex: number): boolean => {
    if (userTicketType === 'None') return false;
    // Use the exported registrationPhases constant
    const userPhaseIndex = registrationPhases.indexOf(userTicketType);
    return userPhaseIndex !== -1 && userPhaseIndex <= currentPhaseIndex;
};

// Function to fetch the current state of tables (useful if data could change)
export const getCurrentTables = (): GameTable[] => {
    return [...mockGameTables]; // Return a copy to prevent direct mutation elsewhere
};

// Function to fetch the current state of registrations
export const getCurrentRegistrations = (): Registration[] => {
    return [...mockRegistrations]; // Return a copy
}

// Function to add a registration (simulates backend update)
export const addRegistration = (userId: string, tableId: string): Registration => {
    const newRegistration = { userId, tableId };
    // Prevent duplicate registrations (basic check)
    if (!mockRegistrations.some(r => r.userId === userId && r.tableId === tableId)) {
        mockRegistrations.push(newRegistration);
        console.log("Added registration:", newRegistration);
        console.log("Current registrations:", mockRegistrations);
    }
    return newRegistration;
}

// Function to remove a registration (simulates backend update)
export const removeRegistration = (userId: string, tableId: string): void => {
    mockRegistrations = mockRegistrations.filter(r => !(r.userId === userId && r.tableId === tableId));
    console.log("Removed registration for user:", userId, "table:", tableId);
    console.log("Current registrations:", mockRegistrations);
}
