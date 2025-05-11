
import type { GameTable, User, Registration, TicketType, GameTableInput } from '@/lib/types';
import { registrationPhases as importedRegistrationPhases } from '@/lib/types';
import { db } from '@/firebase/clientApp';
import {
    collection,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    orderBy,
    Timestamp, // Not strictly needed for GameTable but good for other potential date fields
} from 'firebase/firestore';

// --- Game Icons/Images ---
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

// Mock Users (remains client-side for now, could be moved to Firestore too)
export const mockUsers: Record<string, User> = {
  'user-123': { id: 'user-123', name: 'Alice (Stratège)', ticketType: 'Stratège' },
  'user-456': { id: 'user-456', name: 'Bob (Maréchal)', ticketType: 'Maréchal' },
  'user-789': { id: 'user-789', name: 'Charlie (Général)', ticketType: 'Général' },
  'user-000': { id: 'user-000', name: 'David (Pas de billet)', ticketType: 'Aucun' },
};

// Re-export registrationPhases for use in components
export const registrationPhases = importedRegistrationPhases;

const TABLES_COLLECTION = 'gameTables';
const REGISTRATIONS_COLLECTION = 'registrations';

// --- Firestore Data Functions ---

/** Fetches all game tables from Firestore */
export const getGameTables = async (): Promise<GameTable[]> => {
    try {
        const tablesCollection = collection(db, TABLES_COLLECTION);
        // Optional: Order by gameName, then day, then timeSlot for consistency
        const q = query(tablesCollection, orderBy("gameName"), orderBy("day"), orderBy("timeSlot"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameTable));
    } catch (error) {
        console.error("Erreur lors de la récupération des tables de jeu:", error);
        throw new Error("Impossible de récupérer les tables de jeu depuis Firestore.");
    }
};

/** Adds a new table to Firestore */
export const addGameTable = async (tableInput: GameTableInput): Promise<GameTable> => {
    try {
        const newTableData = {
            ...tableInput,
            imageUrl: gameImageMap[tableInput.gameName] || tableInput.imageUrl, // Ensure imageUrl is set
        };
        const docRef = await addDoc(collection(db, TABLES_COLLECTION), newTableData);
        return { id: docRef.id, ...newTableData };
    } catch (error) {
        console.error("Erreur lors de l'ajout de la table de jeu:", error);
        throw new Error("Impossible d'ajouter la table de jeu à Firestore.");
    }
};

/** Updates an existing table in Firestore */
export const updateGameTable = async (tableToUpdate: GameTable): Promise<GameTable> => {
    try {
        const tableRef = doc(db, TABLES_COLLECTION, tableToUpdate.id);
        const updatedData = {
            ...tableToUpdate,
            imageUrl: gameImageMap[tableToUpdate.gameName] || tableToUpdate.imageUrl, // Ensure imageUrl is updated
        };
        // Firestore's updateDoc doesn't need the id in the data payload
        const { id, ...dataToSave } = updatedData;
        await updateDoc(tableRef, dataToSave);
        return updatedData;
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la table de jeu:", error);
        throw new Error("Impossible de mettre à jour la table de jeu dans Firestore.");
    }
};

/** Deletes a table from Firestore and its associated registrations */
export const deleteGameTable = async (tableId: string): Promise<void> => {
    const batch = writeBatch(db);
    try {
        // Delete the table itself
        const tableRef = doc(db, TABLES_COLLECTION, tableId);
        batch.delete(tableRef);

        // Find and delete associated registrations
        const registrationsQuery = query(collection(db, REGISTRATIONS_COLLECTION), where("tableId", "==", tableId));
        const registrationsSnapshot = await getDocs(registrationsQuery);
        registrationsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
    } catch (error) {
        console.error("Erreur lors de la suppression de la table de jeu et de ses inscriptions:", error);
        throw new Error("Impossible de supprimer la table de jeu et ses inscriptions de Firestore.");
    }
};


/** Fetches all registrations from Firestore */
export const getRegistrations = async (): Promise<Registration[]> => {
    try {
        const registrationsCollection = collection(db, REGISTRATIONS_COLLECTION);
        const querySnapshot = await getDocs(registrationsCollection);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration & { id: string }));
    } catch (error) {
        console.error("Erreur lors de la récupération des inscriptions:", error);
        throw new Error("Impossible de récupérer les inscriptions depuis Firestore.");
    }
};

/** Adds a new registration to Firestore */
export const addRegistration = async (userId: string, tableId: string): Promise<Registration> => {
    try {
        // Check if registration already exists to prevent duplicates (optional, can be handled by UI/rules)
        const q = query(collection(db, REGISTRATIONS_COLLECTION), where("userId", "==", userId), where("tableId", "==", tableId));
        const existingRegs = await getDocs(q);
        if (!existingRegs.empty) {
            console.warn("L'inscription existe déjà pour:", userId, tableId);
            // Return the existing registration or throw an error, depending on desired behavior
            return { id: existingRegs.docs[0].id, ...existingRegs.docs[0].data() } as Registration & { id: string };
        }

        const newRegistrationData = { userId, tableId };
        const docRef = await addDoc(collection(db, REGISTRATIONS_COLLECTION), newRegistrationData);
        return { id: docRef.id, ...newRegistrationData };
    } catch (error) {
        console.error("Erreur lors de l'ajout de l'inscription:", error);
        throw new Error("Impossible d'ajouter l'inscription à Firestore.");
    }
};

/** Removes a registration from Firestore */
export const removeRegistration = async (userId: string, tableId: string): Promise<void> => {
    try {
        const q = query(collection(db, REGISTRATIONS_COLLECTION), where("userId", "==", userId), where("tableId", "==", tableId));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.warn("Aucune inscription trouvée à supprimer pour l'utilisateur:", userId, "table:", tableId);
            return;
        }
        // Assuming only one registration per user/table combination
        const registrationDoc = querySnapshot.docs[0];
        await deleteDoc(doc(db, REGISTRATIONS_COLLECTION, registrationDoc.id));
    } catch (error) {
        console.error("Erreur lors de la suppression de l'inscription:", error);
        throw new Error("Impossible de supprimer l'inscription de Firestore.");
    }
};


// --- Utility Functions (mostly unchanged, operate on fetched data) ---

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
