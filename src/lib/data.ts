

import type { GameTable, User, Registration, TicketType, GameTableInput } from '@/lib/types';
// Correctly import registrationPhases from types.ts
import { registrationPhases as importedRegistrationPhases } from '@/lib/types';


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


// Mock Users
export const mockUsers: Record<string, User> = {
  'user-123': { id: 'user-123', name: 'Alice (Stratège)', ticketType: 'Stratège' },
  'user-456': { id: 'user-456', name: 'Bob (Maréchal)', ticketType: 'Maréchal' },
  'user-789': { id: 'user-789', name: 'Charlie (Général)', ticketType: 'Général' },
  'user-000': { id: 'user-000', name: 'David (Pas de billet)', ticketType: 'Aucun' },
};


// Mock Game Tables Data - Initialize with an empty array
export let mockGameTables: GameTable[] = [];

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
        imageUrl: gameImageMap[tableInput.gameName] || tableInput.imageUrl,
    };
    mockGameTables.push(newTable);
    console.log("Table ajoutée:", newTable);
    console.log("Tables actuelles:", mockGameTables);
    return newTable;
};

/** Updates an existing table in the mock data */
export const updateMockTable = (updatedTableData: GameTableInput & { id: string }): GameTable => {
    const index = mockGameTables.findIndex(t => t.id === updatedTableData.id);
    if (index === -1) {
        throw new Error(`Table avec ID ${updatedTableData.id} non trouvée.`);
    }

    const updatedTable: GameTable = {
        id: updatedTableData.id,
        gameName: updatedTableData.gameName,
        day: updatedTableData.day,
        timeSlot: updatedTableData.timeSlot,
        totalSeats: updatedTableData.totalSeats,
        imageUrl: gameImageMap[updatedTableData.gameName] || updatedTableData.imageUrl,
    };

    mockGameTables[index] = updatedTable;
    console.log("Table mise à jour:", updatedTable);
    console.log("Tables actuelles:", mockGameTables);
    return updatedTable;
};


/** Deletes a table from the mock data */
export const deleteMockTable = (tableId: string): void => {
    const initialLength = mockGameTables.length;
    mockGameTables = mockGameTables.filter(t => t.id !== tableId);
    if (mockGameTables.length === initialLength) {
         throw new Error(`Table avec ID ${tableId} non trouvée pour suppression.`);
    }
    mockRegistrations = mockRegistrations.filter(r => r.tableId !== tableId);
    console.log("Table supprimée:", tableId);
    console.log("Tables actuelles:", mockGameTables);
    console.log("Inscriptions actuelles:", mockRegistrations);
};

// --- Read Functions (Remain mostly the same) ---

export const getAvailableSeats = (tableId: string, registrations: Registration[], tables: GameTable[]): number => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return 0;
    const currentRegistrations = registrations.filter(r => r.tableId === tableId).length;
    return table.totalSeats - currentRegistrations;
};

export const hasTimeConflict = (newTable: GameTable, userRegistrations: Registration[], allTables: GameTable[]): boolean => {
    const userTableIds = userRegistrations.map(r => r.tableId);
    const userTables = allTables.filter(t => userTableIds.includes(t.id));

    return userTables.some(registeredTable => {
        if (registeredTable.id === newTable.id) {
            return false; 
        }
        if (registeredTable.day !== newTable.day) {
          return false; 
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
            console.warn("Impossible d'analyser le créneau horaire pour la vérification des conflits:", registeredTable.timeSlot, newTable.timeSlot);
            return registeredTable.timeSlot === newTable.timeSlot;
        }
        const overlaps = !(newSlot.end <= registeredSlot.start || newSlot.start >= registeredSlot.end);
        return overlaps;
    });
};


export const canRegisterBasedOnTicket = (userTicketType: TicketType, currentPhaseIndex: number): boolean => {
    if (userTicketType === 'Aucun') return false;
    const userPhaseIndex = registrationPhases.indexOf(userTicketType);
    return userPhaseIndex !== -1 && userPhaseIndex <= currentPhaseIndex;
};

export const getCurrentTables = (): GameTable[] => {
    return JSON.parse(JSON.stringify(mockGameTables));
};

export const getCurrentRegistrations = (): Registration[] => {
    return JSON.parse(JSON.stringify(mockRegistrations));
}

export const addRegistration = (userId: string, tableId: string): Registration => {
    const newRegistration = { userId, tableId };
    if (!mockRegistrations.some(r => r.userId === userId && r.tableId === tableId)) {
        mockRegistrations.push(newRegistration);
        console.log("Inscription ajoutée:", newRegistration);
        console.log("Inscriptions actuelles:", mockRegistrations);
    } else {
        console.log("L'inscription existe déjà pour:", userId, tableId);
    }
    return { ...newRegistration };
}

export const removeRegistration = (userId: string, tableId: string): void => {
    const initialLength = mockRegistrations.length;
    mockRegistrations = mockRegistrations.filter(r => !(r.userId === userId && r.tableId === tableId));
    if (mockRegistrations.length < initialLength) {
        console.log("Inscription supprimée pour l'utilisateur:", userId, "table:", tableId);
        console.log("Inscriptions actuelles:", mockRegistrations);
    } else {
         console.log("Aucune inscription trouvée à supprimer pour l'utilisateur:", userId, "table:", tableId);
    }
}

// THIS IS NO LONGER USED FOR GAME ICONS
export const getIconNameFromComponent = (component?: React.ElementType): string | undefined => {
    if (!component) return undefined;
    // This part needs adjustment if iconMap is removed or changed
    // For now, assuming iconMap might be used for other purposes or was meant to be removed.
    // If iconMap is truly gone for game icons, this function is less relevant for them.
    // const iconMap: Record<string, React.ElementType> = { Swords: Swords, Castle: Castle, Flag: Flag };
    // return Object.keys(iconMap).find(key => iconMap[key] === component);
    return undefined; // Placeholder if iconMap is fully deprecated for game icons
};

