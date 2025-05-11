
import type { GameTable, User, Registration, TicketType, GameTableInput } from '@/lib/types';
import { registrationPhases as importedRegistrationPhases } from '@/lib/types';
import { db } from '@/firebase/clientApp'; // Ensure db is imported from your Firebase setup
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
    // Timestamp, // Not strictly needed for GameTable but good for other potential date fields
    // deleteField, // Import if you need to explicitly delete fields
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
    if (!db) {
        console.error("Firestore DB instance is not initialized. Check your Firebase setup in src/firebase/clientApp.ts and ensure .env.local variables are correctly loaded.");
        throw new Error("La connexion à Firestore n'est pas initialisée. Vérifiez la configuration Firebase et les variables d'environnement.");
    }
    try {
        console.log("Attempting to fetch game tables from Firestore...");
        const tablesCollection = collection(db, TABLES_COLLECTION);
        const q = query(tablesCollection, orderBy("gameName")); // Simplified query
        const querySnapshot = await getDocs(q);
        console.log(`Fetched ${querySnapshot.docs.length} game tables successfully.`);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), imageUrl: doc.data().imageUrl || gameImageMap[doc.data().gameName] || undefined } as GameTable));
    } catch (error) {
        console.error("<<< IMPORTANT: Detailed Firebase Error (getGameTables) >>>", error);
        let advice = "Veuillez vérifier la console du navigateur pour l'erreur Firebase détaillée ci-dessus. Causes courantes : \n1. Configuration Firebase incorrecte dans .env.local (NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_API_KEY, etc. Assurez-vous que le serveur de développement a été redémarré après modification de .env.local).\n2. Règles de sécurité Firestore bloquant l'accès à la collection 'gameTables'. Accédez à la console Firebase > Firestore Database > Règles.\n3. Index Firestore manquants (si la requête est complexe - l'erreur Firebase ci-dessus peut inclure un lien pour créer l'index requis).";
        
        if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            if (firebaseError.code === 'permission-denied') {
                advice = `ERREUR DE PERMISSION (${firebaseError.code}): Firestore a refusé l'accès à la collection 'gameTables'. Vérifiez vos règles de sécurité Firestore. ` + advice;
            } else if (firebaseError.code === 'unimplemented' || firebaseError.code === 'failed-precondition') {
                 advice = `ERREUR D'INDEX Firestore (${firebaseError.code}): La requête nécessite probablement un index composite. L'erreur Firebase détaillée ci-dessus devrait inclure un lien pour créer cet index. ` + advice;
            } else if (firebaseError.code === 'unavailable') {
                advice = `SERVICE FIRESTORE INDISPONIBLE (${firebaseError.code}): Le service Firestore est peut-être temporairement indisponible ou il y a un problème de réseau. ` + advice;
            }
        }
        throw new Error(`Impossible de récupérer les tables de jeu depuis Firestore. ${advice}`);
    }
};

/** Adds a new table to Firestore */
export const addGameTable = async (tableInput: GameTableInput): Promise<GameTable> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for addGameTable.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour ajouter une table.");
    }
    try {
        const dataToSave: Omit<GameTable, 'id'> = {
            gameName: tableInput.gameName,
            day: tableInput.day,
            timeSlot: tableInput.timeSlot,
            totalSeats: tableInput.totalSeats,
            imageUrl: tableInput.imageUrl || gameImageMap[tableInput.gameName] || undefined,
        };

        const docRef = await addDoc(collection(db, TABLES_COLLECTION), dataToSave);
        
        const resultTable: GameTable = {
            id: docRef.id,
            ...dataToSave,
        };
        return resultTable;

    } catch (error) {
        console.error("<<< IMPORTANT: Detailed Firebase Error (addGameTable) >>>", error);
        let advice = "Veuillez vérifier la console du navigateur pour l'erreur Firebase détaillée ci-dessus. Causes courantes : \n1. Configuration Firebase incorrecte dans .env.local.\n2. Règles de sécurité Firestore bloquant l'écriture dans la collection 'gameTables'.";
         if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            if (firebaseError.code === 'permission-denied') {
                advice = `ERREUR DE PERMISSION (${firebaseError.code}): Firestore a refusé l'écriture dans 'gameTables'. Vérifiez vos règles de sécurité. ` + advice;
            }
        }
        throw new Error(`Impossible d'ajouter la table de jeu à Firestore. ${advice}`);
    }
};

/** Updates an existing table in Firestore */
export const updateGameTable = async (tableToUpdate: GameTable): Promise<GameTable> => {
     if (!db) {
        console.error("Firestore DB instance is not initialized for updateGameTable.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour mettre à jour une table.");
    }
    try {
        const tableRef = doc(db, TABLES_COLLECTION, tableToUpdate.id);
        
        const dataToUpdate: Omit<GameTable, 'id'> = {
            gameName: tableToUpdate.gameName,
            day: tableToUpdate.day,
            timeSlot: tableToUpdate.timeSlot,
            totalSeats: tableToUpdate.totalSeats,
            imageUrl: tableToUpdate.imageUrl || gameImageMap[tableToUpdate.gameName] || undefined,
        };

        await updateDoc(tableRef, dataToUpdate);
        
        const returnedTable: GameTable = { id: tableToUpdate.id, ...dataToUpdate };
        return returnedTable;

    } catch (error) {
        console.error("<<< IMPORTANT: Detailed Firebase Error (updateGameTable) >>>", error);
         let advice = "Veuillez vérifier la console du navigateur pour l'erreur Firebase détaillée ci-dessus. Causes courantes : \n1. Configuration Firebase incorrecte dans .env.local.\n2. Règles de sécurité Firestore bloquant la mise à jour de la collection 'gameTables'.";
         if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            if (firebaseError.code === 'permission-denied') {
                advice = `ERREUR DE PERMISSION (${firebaseError.code}): Firestore a refusé la mise à jour de 'gameTables'. Vérifiez vos règles de sécurité. ` + advice;
            }
        }
        throw new Error(`Impossible de mettre à jour la table de jeu dans Firestore. ${advice}`);
    }
};

/** Deletes a table from Firestore and its associated registrations */
export const deleteGameTable = async (tableId: string): Promise<void> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for deleteGameTable.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour supprimer une table.");
    }
    const batch = writeBatch(db);
    try {
        // Note: The check for existing registrations is now done in the component before calling this.
        // This function will delete the table and any associated registrations if it's called.
        const tableRef = doc(db, TABLES_COLLECTION, tableId);
        batch.delete(tableRef);

        const registrationsQuery = query(collection(db, REGISTRATIONS_COLLECTION), where("tableId", "==", tableId));
        const registrationsSnapshot = await getDocs(registrationsQuery);
        registrationsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
    } catch (error) {
        console.error("<<< IMPORTANT: Detailed Firebase Error (deleteGameTable) >>>", error);
        let advice = "Veuillez vérifier la console du navigateur pour l'erreur Firebase détaillée ci-dessus. Causes courantes : \n1. Configuration Firebase incorrecte.\n2. Règles de sécurité Firestore bloquant la suppression.";
         if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            if (firebaseError.code === 'permission-denied') {
                advice = `ERREUR DE PERMISSION (${firebaseError.code}): Firestore a refusé la suppression. Vérifiez vos règles de sécurité. ` + advice;
            }
        }
        throw new Error(`Impossible de supprimer la table de jeu et ses inscriptions de Firestore. ${advice}`);
    }
};


/** Fetches all registrations from Firestore */
export const getRegistrations = async (): Promise<Registration[]> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for getRegistrations.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour récupérer les inscriptions.");
    }
    try {
        console.log("Attempting to fetch registrations from Firestore...");
        const registrationsCollection = collection(db, REGISTRATIONS_COLLECTION);
        const querySnapshot = await getDocs(registrationsCollection);
         console.log(`Fetched ${querySnapshot.docs.length} registrations successfully.`);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration & { id: string }));
    } catch (error) {
        console.error("<<< IMPORTANT: Detailed Firebase Error (getRegistrations) >>>", error);
        let advice = "Veuillez vérifier la console du navigateur pour l'erreur Firebase détaillée ci-dessus. Causes courantes : \n1. Configuration Firebase incorrecte.\n2. Règles de sécurité Firestore bloquant l'accès à la collection 'registrations'.";
         if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            if (firebaseError.code === 'permission-denied') {
                advice = `ERREUR DE PERMISSION (${firebaseError.code}): Firestore a refusé l'accès à 'registrations'. Vérifiez vos règles de sécurité. ` + advice;
            }
        }
        throw new Error(`Impossible de récupérer les inscriptions depuis Firestore. ${advice}`);
    }
};


/** Fetches registrations for a specific table from Firestore */
export const getRegistrationsForTable = async (tableId: string): Promise<Registration[]> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for getRegistrationsForTable.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour récupérer les inscriptions de la table.");
    }
    try {
        console.log(`Attempting to fetch registrations for table ${tableId} from Firestore...`);
        const q = query(collection(db, REGISTRATIONS_COLLECTION), where("tableId", "==", tableId));
        const querySnapshot = await getDocs(q);
        console.log(`Fetched ${querySnapshot.docs.length} registrations for table ${tableId} successfully.`);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration & { id: string }));
    } catch (error) {
        console.error(`<<< IMPORTANT: Detailed Firebase Error (getRegistrationsForTable for table ${tableId}) >>>`, error);
        let advice = "Veuillez vérifier la console du navigateur pour l'erreur Firebase détaillée ci-dessus. Causes courantes : \n1. Configuration Firebase incorrecte.\n2. Règles de sécurité Firestore bloquant l'accès à la collection 'registrations'.";
        if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            if (firebaseError.code === 'permission-denied') {
                advice = `ERREUR DE PERMISSION (${firebaseError.code}): Firestore a refusé l'accès aux inscriptions. Vérifiez vos règles de sécurité. ` + advice;
            }
        }
        throw new Error(`Impossible de récupérer les inscriptions pour la table ${tableId} depuis Firestore. ${advice}`);
    }
};


/** Adds a new registration to Firestore */
export const addRegistration = async (userId: string, tableId: string): Promise<Registration> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for addRegistration.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour ajouter une inscription.");
    }
    try {
        const q = query(collection(db, REGISTRATIONS_COLLECTION), where("userId", "==", userId), where("tableId", "==", tableId));
        const existingRegs = await getDocs(q);
        if (!existingRegs.empty) {
            console.warn("L'inscription existe déjà pour:", userId, tableId);
            return { id: existingRegs.docs[0].id, ...existingRegs.docs[0].data() } as Registration & { id: string };
        }

        const newRegistrationData = { userId, tableId };
        const docRef = await addDoc(collection(db, REGISTRATIONS_COLLECTION), newRegistrationData);
        return { id: docRef.id, ...newRegistrationData };
    } catch (error) {
        console.error("<<< IMPORTANT: Detailed Firebase Error (addRegistration) >>>", error);
        let advice = "Veuillez vérifier la console du navigateur pour l'erreur Firebase détaillée ci-dessus. Causes courantes : \n1. Configuration Firebase incorrecte.\n2. Règles de sécurité Firestore bloquant l'écriture dans 'registrations'.";
         if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            if (firebaseError.code === 'permission-denied') {
                advice = `ERREUR DE PERMISSION (${firebaseError.code}): Firestore a refusé l'écriture dans 'registrations'. Vérifiez vos règles de sécurité. ` + advice;
            }
        }
        throw new Error(`Impossible d'ajouter l'inscription à Firestore. ${advice}`);
    }
};

/** Removes a registration from Firestore */
export const removeRegistration = async (userId: string, tableId: string): Promise<void> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for removeRegistration.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour supprimer une inscription.");
    }
    try {
        const q = query(collection(db, REGISTRATIONS_COLLECTION), where("userId", "==", userId), where("tableId", "==", tableId));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.warn("Aucune inscription trouvée à supprimer pour l'utilisateur:", userId, "table:", tableId);
            return;
        }
        const registrationDoc = querySnapshot.docs[0];
        await deleteDoc(doc(db, REGISTRATIONS_COLLECTION, registrationDoc.id));
    } catch (error) {
        console.error("<<< IMPORTANT: Detailed Firebase Error (removeRegistration) >>>", error);
         let advice = "Veuillez vérifier la console du navigateur pour l'erreur Firebase détaillée ci-dessus. Causes courantes : \n1. Configuration Firebase incorrecte.\n2. Règles de sécurité Firestore bloquant la suppression.";
         if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            if (firebaseError.code === 'permission-denied') {
                advice = `ERREUR DE PERMISSION (${firebaseError.code}): Firestore a refusé la suppression. Vérifiez vos règles de sécurité. ` + advice;
            }
        }
        throw new Error(`Impossible de supprimer l'inscription de Firestore. ${advice}`);
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
