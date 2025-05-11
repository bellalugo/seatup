
import type { Game, GameInput, GameTable, User, Registration, TicketType, GameTableInput } from '@/lib/types';
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
    getDoc,
} from 'firebase/firestore';

export const mockUsers: Record<string, User> = {
  'user-123': { id: 'user-123', name: 'Alice (Stratège)', ticketType: 'Stratège' },
  'user-456': { id: 'user-456', name: 'Bob (Maréchal)', ticketType: 'Maréchal' },
  'user-789': { id: 'user-789', name: 'Charlie (Général)', ticketType: 'Général' },
  'user-000': { id: 'user-000', name: 'David (Pas de billet)', ticketType: 'Aucun' },
};

export const registrationPhases = importedRegistrationPhases;

const GAMES_COLLECTION = 'games';
const TABLES_COLLECTION = 'gameTables';
const REGISTRATIONS_COLLECTION = 'registrations';

// --- Games CRUD Functions ---

/** Fetches all games from Firestore */
export const getGames = async (): Promise<Game[]> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for getGames.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour récupérer les jeux.");
    }
    try {
        const gamesCollection = collection(db, GAMES_COLLECTION);
        const q = query(gamesCollection, orderBy("nom"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
    } catch (error) {
        console.error("Firestore - Erreur lors de la récupération des jeux:", error);
        throw new Error("Impossible de récupérer les jeux depuis Firestore.");
    }
};

/** Adds a new game to Firestore */
export const addGame = async (gameInput: GameInput): Promise<Game> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for addGame.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour ajouter un jeu.");
    }
    try {
        const docRef = await addDoc(collection(db, GAMES_COLLECTION), gameInput);
        return { id: docRef.id, ...gameInput };
    } catch (error) {
        console.error("Firestore - Erreur lors de l'ajout du jeu:", error);
        throw new Error("Impossible d'ajouter le jeu à Firestore.");
    }
};

/** Updates an existing game in Firestore */
export const updateGame = async (game: Game): Promise<Game> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for updateGame.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour mettre à jour un jeu.");
    }
    try {
        const gameRef = doc(db, GAMES_COLLECTION, game.id);
        // Make sure we don't try to write the id back into the document data
        const { id, ...gameData } = game;
        await updateDoc(gameRef, gameData as any); // Use 'as any' to bypass strict type checking if needed for Firestore
        return game;
    } catch (error) {
        console.error("Firestore - Erreur lors de la mise à jour du jeu:", error);
        throw new Error("Impossible de mettre à jour le jeu dans Firestore.");
    }
};

/** Deletes a game from Firestore */
export const deleteGame = async (gameId: string): Promise<void> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for deleteGame.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour supprimer un jeu.");
    }
    try {
        // Before deleting a game, check if any game tables are using it.
        const tablesQuery = query(collection(db, TABLES_COLLECTION), where("gameId", "==", gameId));
        const tablesSnapshot = await getDocs(tablesQuery);
        if (!tablesSnapshot.empty) {
            throw new Error(`Impossible de supprimer le jeu. Il est utilisé par ${tablesSnapshot.size} table(s) de jeu.`);
        }

        const gameRef = doc(db, GAMES_COLLECTION, gameId);
        await deleteDoc(gameRef);
    } catch (error) {
        console.error("Firestore - Erreur lors de la suppression du jeu:", error);
        if (error instanceof Error) {
          throw error; // Re-throw specific error
        }
        throw new Error("Impossible de supprimer le jeu de Firestore.");
    }
};


// --- GameTables CRUD Functions (Modified) ---

/** Fetches all game tables from Firestore and populates gameName and gameImageUrl */
export const getGameTables = async (): Promise<GameTable[]> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized. Check Firebase setup and .env.local.");
        throw new Error("La connexion à Firestore n'est pas initialisée. Vérifiez la configuration Firebase et les variables d'environnement.");
    }
    try {
        const [rawTablesSnapshot, gamesList] = await Promise.all([
            getDocs(query(collection(db, TABLES_COLLECTION))),
            getGames() // Fetch all games to perform the join
        ]);

        const gamesMap = new Map(gamesList.map(game => [game.id, game]));

        return rawTablesSnapshot.docs.map(doc => {
            const tableData = doc.data() as Omit<GameTable, 'id' | 'gameName' | 'gameImageUrl' | 'imageUrl'>; // gameId is in tableData
            const game = gamesMap.get(tableData.gameId);
            return {
                id: doc.id,
                ...tableData,
                gameName: game?.nom || 'Jeu inconnu (ID: ' + tableData.gameId + ')',
                gameImageUrl: game?.imageUrl, // For display consistency
                imageUrl: game?.imageUrl, // Keep if used elsewhere, prefer gameImageUrl
            } as GameTable;
        });
    } catch (error) {
        console.error("Firestore - Erreur lors de la récupération des tables de jeu:", error);
        let advice = "Veuillez vérifier la console du navigateur pour l'erreur Firebase détaillée. Causes courantes : \n1. Configuration Firebase incorrecte dans .env.local.\n2. Règles de sécurité Firestore bloquant l'accès.\n3. Index Firestore manquants.";
         if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            if (firebaseError.code === 'permission-denied') {
                advice = `ERREUR DE PERMISSION (${firebaseError.code}): Firestore a refusé l'accès. Vérifiez vos règles de sécurité. ` + advice;
            } else if (firebaseError.code === 'unimplemented' || firebaseError.code === 'failed-precondition') {
                 advice = `ERREUR D'INDEX Firestore (${firebaseError.code}): La requête nécessite probablement un index. ` + advice;
            } else if (firebaseError.code === 'unavailable') {
                advice = `SERVICE FIRESTORE INDISPONIBLE (${firebaseError.code}). ` + advice;
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
        const dataToSave: Omit<GameTable, 'id' | 'gameName' | 'gameImageUrl' | 'imageUrl'> = {
            gameId: tableInput.gameId,
            day: tableInput.day,
            timeSlot: tableInput.timeSlot,
            totalSeats: tableInput.totalSeats,
            tableNumber: tableInput.tableNumber, // Added tableNumber
        };

        const docRef = await addDoc(collection(db, TABLES_COLLECTION), dataToSave);

        const gameDoc = await getDoc(doc(db, GAMES_COLLECTION, tableInput.gameId));
        const gameData = gameDoc.exists() ? gameDoc.data() as Game : null;

        return {
            id: docRef.id,
            ...dataToSave,
            gameName: gameData?.nom || 'Jeu inconnu',
            gameImageUrl: gameData?.imageUrl,
            imageUrl: gameData?.imageUrl,
        };

    } catch (error) {
        console.error("Firestore - Erreur lors de l'ajout de la table de jeu:", error);
        throw new Error("Impossible d'ajouter la table de jeu à Firestore.");
    }
};

/** Updates an existing table in Firestore */
export const updateGameTable = async (tableToUpdate: GameTableInput & { id: string }): Promise<GameTable> => {
     if (!db) {
        console.error("Firestore DB instance is not initialized for updateGameTable.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour mettre à jour une table.");
    }
    try {
        const tableRef = doc(db, TABLES_COLLECTION, tableToUpdate.id);
        const { id, ...dataToUpdate } = tableToUpdate;

        const firestorePayload: Omit<GameTable, 'id' | 'gameName' | 'gameImageUrl' | 'imageUrl'> = {
            gameId: dataToUpdate.gameId,
            day: dataToUpdate.day,
            timeSlot: dataToUpdate.timeSlot,
            totalSeats: dataToUpdate.totalSeats,
            tableNumber: dataToUpdate.tableNumber, // Added tableNumber
        };
        // Firestore does not allow undefined values. Ensure they are handled or removed.
        const cleanedPayload = Object.entries(firestorePayload).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                acc[key as keyof typeof firestorePayload] = value;
            }
            return acc;
        }, {} as Partial<typeof firestorePayload>);


        await updateDoc(tableRef, cleanedPayload);

        const gameDoc = await getDoc(doc(db, GAMES_COLLECTION, dataToUpdate.gameId));
        const gameData = gameDoc.exists() ? gameDoc.data() as Game : null;

        return {
            id: tableToUpdate.id,
            ...firestorePayload, // use original payload structure for return type consistency
            gameName: gameData?.nom || 'Jeu inconnu',
            gameImageUrl: gameData?.imageUrl,
            imageUrl: gameData?.imageUrl,
        };
    } catch (error) {
        console.error("Firestore - Erreur lors de la mise à jour de la table de jeu:", error);
        let baseMessage = "Impossible de mettre à jour la table de jeu dans Firestore.";
        if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            baseMessage = `Impossible de mettre à jour. Erreur Firebase: ${firebaseError.message} (Code: ${firebaseError.code}).`;
        }
        throw new Error(`${baseMessage}`);
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
        const tableRef = doc(db, TABLES_COLLECTION, tableId);
        const registrationsQuery = query(collection(db, REGISTRATIONS_COLLECTION), where("tableId", "==", tableId));
        const registrationsSnapshot = await getDocs(registrationsQuery);

        if (registrationsSnapshot.docs.length > 0) {
            throw new Error(`La table a ${registrationsSnapshot.docs.length} joueur(s) inscrit(s) et ne peut pas être supprimée.`);
        }
        
        batch.delete(tableRef);
        await batch.commit();
    } catch (error) {
        if (error instanceof Error && error.message.includes("joueur(s) inscrit(s)")) {
            throw error; 
        }
        console.error("Firestore - Erreur lors de la suppression de la table de jeu:", error);
        throw new Error("Impossible de supprimer la table de jeu de Firestore.");
    }
};

// --- Registrations Functions ---

/** Fetches all registrations from Firestore */
export const getRegistrations = async (): Promise<Registration[]> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for getRegistrations.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour récupérer les inscriptions.");
    }
    try {
        const registrationsCollection = collection(db, REGISTRATIONS_COLLECTION);
        const querySnapshot = await getDocs(registrationsCollection);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration & { id: string }));
    } catch (error) {
        console.error("Firestore - Erreur lors de la récupération des inscriptions:", error);
        throw new Error("Impossible de récupérer les inscriptions depuis Firestore.");
    }
};

/** Fetches registrations for a specific table from Firestore */
export const getRegistrationsForTable = async (tableId: string): Promise<Registration[]> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for getRegistrationsForTable.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour récupérer les inscriptions de la table.");
    }
    try {
        const q = query(collection(db, REGISTRATIONS_COLLECTION), where("tableId", "==", tableId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration & { id: string }));
    } catch (error) {
        console.error("Firestore - Erreur lors de la récupération des inscriptions pour la table:", error);
        throw new Error(`Impossible de récupérer les inscriptions pour la table ${tableId} depuis Firestore.`);
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
            return { id: existingRegs.docs[0].id, ...existingRegs.docs[0].data() } as Registration & { id: string };
        }

        const newRegistrationData = { userId, tableId };
        const docRef = await addDoc(collection(db, REGISTRATIONS_COLLECTION), newRegistrationData);
        return { id: docRef.id, ...newRegistrationData };
    } catch (error) {
        console.error("Firestore - Erreur lors de l'ajout de l'inscription:", error);
        throw new Error("Impossible d'ajouter l'inscription à Firestore.");
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
            return;
        }
        const registrationDoc = querySnapshot.docs[0];
        await deleteDoc(doc(db, REGISTRATIONS_COLLECTION, registrationDoc.id));
    } catch (error) {
        console.error("Firestore - Erreur lors de la suppression de l'inscription:", error);
        throw new Error("Impossible de supprimer l'inscription de Firestore.");
    }
};

// --- Utility Functions ---

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
        if (registeredTable.id === newTable.id) return false;
        if (registeredTable.day !== newTable.day) return false;

        const parseTimeSlot = (slot: string): { start: number; end: number } | null => {
            const match = slot.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
            if (!match) return null;
            return { start: parseInt(match[1],10) * 60 + parseInt(match[2],10), end: parseInt(match[3],10) * 60 + parseInt(match[4],10) };
        };

        const registeredSlot = parseTimeSlot(registeredTable.timeSlot);
        const newSlot = parseTimeSlot(newTable.timeSlot);

        if (!registeredSlot || !newSlot) {
            return registeredTable.timeSlot === newTable.timeSlot; // Fallback to exact match if parsing fails
        }
        return !(newSlot.end <= registeredSlot.start || newSlot.start >= registeredSlot.end);
    });
};

export const canRegisterBasedOnTicket = (userTicketType: TicketType, currentPhaseIndex: number): boolean => {
    if (userTicketType === 'Aucun') return false; // Changed 'None' to 'Aucun' to match TicketType
    const userPhaseIndex = importedRegistrationPhases.indexOf(userTicketType); // Use importedRegistrationPhases
    return userPhaseIndex !== -1 && userPhaseIndex <= currentPhaseIndex;
};

