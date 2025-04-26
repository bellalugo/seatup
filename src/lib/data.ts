

import type { GameTable, User, Registration, TicketType, GameTableInput } from '@/lib/types';
// Correctly import registrationPhases from types.ts
import { registrationPhases as importedRegistrationPhases } from '@/lib/types';
import { Swords, Castle, Flag } from 'lucide-react';
import type React from 'react'; // Import React for ElementType
import Image from 'next/image';

// Map icon names to components
const iconMap: Record<string, React.ElementType> = {
  Swords: Swords,
  Castle: Castle,
  Flag: Flag,
};

// --- Game Icons/Images ---
// We'll store image URLs directly in the table data instead of mapping components
const gameImageMap: Record<string, string> = {
    "Fields of Fire 3": "/game-icons/fields_of_fire_3.webp",
    "Conquest & Consequence": "/game-icons/conquest_and_consequence.webp",
    "Next War: Taiwan": "/game-icons/next_war_taiwan.webp",
    "Empire of the Sun": "/game-icons/empire_of_the_sun.webp",
    "Salerno '43": "/game-icons/salerno_43.webp",
    "Littoral Commander: Indo-Pacific": "/game-icons/littoral_commander.webp",
    "Downfall: Conquest of the Third Reich, 1944-1945": "/game-icons/downfall.webp",
    "A Gest of Robin Hood": "/game-icons/a_gest_of_robin_hood.webp",
    "Here I Stand: Wars of the Reformation 1517-1555 (500th Anniversary Edition)": "/game-icons/here_i_stand.webp",
    "Red Strike: The Soviet Plan for Nuclear War in 1979": "/game-icons/red_strike.webp",
    "Commands & Colors: Napoleonics": "/game-icons/cc_napoleonics.webp",
    "Plantagenet: Cousin's War for England, 1459 - 1485": "/game-icons/plantagenet.webp",
    "Vietnam: Rumor of War": "/game-icons/vietnam_rumor_of_war.webp",
    "Banish the Snakes": "/game-icons/banish_the_snakes.webp",
    "Pendragon: The Fall of Roman Britain": "/game-icons/pendragon.webp",
    "Atlantic Chase": "/game-icons/atlantic_chase.webp",
    "Imperial Struggle": "/game-icons/imperial_struggle.webp",
    "Vijayanagara: The Deccan Empires of Medieval India, 1290-1398": "/game-icons/vijayanagara.webp",
    "Wolfe Tone & The United Irishmen Rebellion of 1798": "/game-icons/wolfe_tone.webp",
    "Flying Colors (Fleet Actions in the Age of Sail)": "/game-icons/flying_colors.webp",
    "Bayonets & Tomahawks": "/game-icons/bayonets_and_tomahawks.webp",
    "Almoravid: Reconquista and Riposte in Spain, 1085-1086": "/game-icons/almoravid.webp",
    "Twilight Struggle: Red Sea – Conflict in the Horn of Africa": "/game-icons/ts_red_sea.webp",
    "Fire in the Lake: Insurgency in Vietnam": "/game-icons/fire_in_the_lake.webp"
};


// Helper to get icon component from name - NO LONGER USED FOR GAME ICONS
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

// --- Generate Mock Game Tables based on ASYNCONV programme ---
const gameNamesFromSite = [
    "Fields of Fire 3",
    "Conquest & Consequence",
    "Next War: Taiwan",
    "Empire of the Sun",
    "Salerno '43",
    "Littoral Commander: Indo-Pacific",
    "Downfall: Conquest of the Third Reich, 1944-1945",
    "A Gest of Robin Hood",
    "Here I Stand: Wars of the Reformation 1517-1555 (500th Anniversary Edition)",
    "Red Strike: The Soviet Plan for Nuclear War in 1979",
    "Commands & Colors: Napoleonics",
    "Plantagenet: Cousin's War for England, 1459 - 1485",
    "Vietnam: Rumor of War",
    "Banish the Snakes",
    "Pendragon: The Fall of Roman Britain",
    "Atlantic Chase",
    "Imperial Struggle",
    "Vijayanagara: The Deccan Empires of Medieval India, 1290-1398",
    "Wolfe Tone & The United Irishmen Rebellion of 1798",
    "Flying Colors (Fleet Actions in the Age of Sail)",
    "Bayonets & Tomahawks",
    "Almoravid: Reconquista and Riposte in Spain, 1085-1086",
    "Twilight Struggle: Red Sea – Conflict in the Horn of Africa",
    "Fire in the Lake: Insurgency in Vietnam"
];

const days: GameTable['day'][] = ['Thursday', 'Friday', 'Saturday', 'Sunday'];
const timeSlots = [
    { name: 'AM', slot: '09:00 - 13:00' },
    { name: 'PM', slot: '14:00 - 19:00' }
];
const defaultSeats = 4; // Default seats per table

const generatedTables: GameTable[] = [];
// let tableCounter = 1;

// gameNamesFromSite.forEach(gameName => {
//     days.forEach(day => {
//         timeSlots.forEach(timeSlotInfo => {
//             const tableId = `table-${gameName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${day.toLowerCase()}-${timeSlotInfo.name.toLowerCase()}`;
//             generatedTables.push({
//                 id: tableId,
//                 gameName: gameName,
//                 day: day,
//                 timeSlot: timeSlotInfo.slot,
//                 totalSeats: defaultSeats,
//                 imageUrl: gameImageMap[gameName] || undefined // Use the image URL map
//             });
//         });
//     });
// });

// Mock Game Tables Data - Initialize with an empty array
export let mockGameTables: GameTable[] = []; // REMOVED ALL TABLES

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
        gameName: tableInput.gameName,
        day: tableInput.day,
        timeSlot: tableInput.timeSlot,
        totalSeats: tableInput.totalSeats,
        // Resolve imageUrl from input (assuming input might have imageUrl directly or a name to lookup)
        // For simplicity now, let's assume imageUrl comes directly if needed or is manually set later.
        // Or lookup based on gameName:
        imageUrl: gameImageMap[tableInput.gameName] || tableInput.imageUrl,
        // Removed gameTypeIcon/gameTypeIconName as we use imageUrl now
    };
    mockGameTables.push(newTable);
    console.log("Added table:", newTable);
    console.log("Current tables:", mockGameTables);
    return newTable;
};

/** Updates an existing table in the mock data */
export const updateMockTable = (updatedTableData: GameTableInput & { id: string }): GameTable => {
    const index = mockGameTables.findIndex(t => t.id === updatedTableData.id);
    if (index === -1) {
        throw new Error(`Table with ID ${updatedTableData.id} not found.`);
    }

    // Create the updated table object
    const updatedTable: GameTable = {
        id: updatedTableData.id,
        gameName: updatedTableData.gameName,
        day: updatedTableData.day,
        timeSlot: updatedTableData.timeSlot,
        totalSeats: updatedTableData.totalSeats,
        imageUrl: gameImageMap[updatedTableData.gameName] || updatedTableData.imageUrl, // Update image URL based on name or direct input
    };

    mockGameTables[index] = updatedTable;
    console.log("Updated table:", updatedTable);
    console.log("Current tables:", mockGameTables);
    return updatedTable;
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
            // Simple numeric representation (minutes from midnight)
            return { start: startHour * 60 + startMinute, end: endHour * 60 + endMinute };
        };

        const registeredSlot = parseTimeSlot(registeredTable.timeSlot);
        const newSlot = parseTimeSlot(newTable.timeSlot);

        if (!registeredSlot || !newSlot) {
             console.warn("Could not parse time slot for conflict check:", registeredTable.timeSlot, newTable.timeSlot);
            // Fallback to exact string match if parsing fails, though less reliable for overlapping times
            return registeredTable.timeSlot === newTable.timeSlot;
        }

        // Check for overlap: !(endA <= startB || startA >= endB)
        const overlaps = !(newSlot.end <= registeredSlot.start || newSlot.start >= registeredSlot.end);
        // console.log(`Conflict Check: ${newTable.gameName} (${newSlot.start}-${newSlot.end}) vs ${registeredTable.gameName} (${registeredSlot.start}-${registeredSlot.end}) = ${overlaps}`);
        return overlaps;
    });
};


// Helper function to check registration eligibility based on ticket type and current phase
export const canRegisterBasedOnTicket = (userTicketType: TicketType, currentPhaseIndex: number): boolean => {
    if (userTicketType === 'None') return false;
    // Use the exported registrationPhases constant
    const userPhaseIndex = registrationPhases.indexOf(userTicketType);
    // Check if the user's ticket type is found in the phases array AND if their phase index is less than or equal to the current phase index
    return userPhaseIndex !== -1 && userPhaseIndex <= currentPhaseIndex;
};

// Function to fetch the current state of tables (useful if data could change)
export const getCurrentTables = (): GameTable[] => {
    // Return a deep copy to prevent accidental modification of the original mock data
    // No need to re-assign icons after JSON parse/stringify as we are using URLs
    return JSON.parse(JSON.stringify(mockGameTables));
};

// Function to fetch the current state of registrations
export const getCurrentRegistrations = (): Registration[] => {
     // Return a deep copy
    return JSON.parse(JSON.stringify(mockRegistrations));
}

// Function to add a registration (simulates backend update)
export const addRegistration = (userId: string, tableId: string): Registration => {
    const newRegistration = { userId, tableId };
    // Prevent duplicate registrations (basic check)
    if (!mockRegistrations.some(r => r.userId === userId && r.tableId === tableId)) {
        mockRegistrations.push(newRegistration);
        console.log("Added registration:", newRegistration);
        console.log("Current registrations:", mockRegistrations);
    } else {
        console.log("Registration already exists for:", userId, tableId);
    }
    // Return a copy of the new/existing registration
    return { ...newRegistration };
}

// Function to remove a registration (simulates backend update)
export const removeRegistration = (userId: string, tableId: string): void => {
    const initialLength = mockRegistrations.length;
    mockRegistrations = mockRegistrations.filter(r => !(r.userId === userId && r.tableId === tableId));
    if (mockRegistrations.length < initialLength) {
        console.log("Removed registration for user:", userId, "table:", tableId);
        console.log("Current registrations:", mockRegistrations);
    } else {
         console.log("No registration found to remove for user:", userId, "table:", tableId);
    }
}

// --- Utility to find icon name from component ---
// This might be needed if the component itself is stored and you need the name back
// For now, we primarily work from name -> component in add/update
// THIS IS NO LONGER USED FOR GAME ICONS
export const getIconNameFromComponent = (component?: React.ElementType): string | undefined => {
    if (!component) return undefined;
    return Object.keys(iconMap).find(key => iconMap[key] === component);
};
