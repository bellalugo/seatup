
import type { Game, GameInput, GameTable, User, Registration, TicketType, GameTableInput, Participant, GameResult } from '@/lib/types';
import { REGISTRATION_SCHEDULE } from '@/lib/types'; // Import new schedule
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
    setDoc,
} from 'firebase/firestore';

export const mockUsers: Record<string, User> = {
  'user-123': { id: 'user-123', name: 'Alice (Stratège)', ticketType: 'Stratège', email: 'alice@example.com' },
  'user-456': { id: 'user-456', name: 'Bob (Maréchal)', ticketType: 'Maréchal', email: 'bob@example.com' },
  'user-789': { id: 'user-789', name: 'Charlie (Général)', ticketType: 'Général', email: 'charlie@example.com' },
  'user-000': { id: 'user-000', name: 'David (Invitation)', ticketType: 'Invitation', email: 'david@example.com' },
};

// Removed old registrationPhases export, REGISTRATION_SCHEDULE from types.ts is now used.

const GAMES_COLLECTION = 'games';
const TABLES_COLLECTION = 'gameTables';
const REGISTRATIONS_COLLECTION = 'registrations';
const PARTICIPANTS_COLLECTION = 'liste_participants';
const GAME_RESULTS_COLLECTION = 'gameResults';


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
        const { id, ...gameData } = game;
        await updateDoc(gameRef, gameData as any);
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
          throw error;
        }
        throw new Error("Impossible de supprimer le jeu de Firestore.");
    }
};


// --- GameTables CRUD Functions ---

export const getGameTables = async (): Promise<GameTable[]> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized. Check Firebase setup and .env.local.");
        throw new Error("La connexion à Firestore n'est pas initialisée. Vérifiez la configuration Firebase et les variables d'environnement.");
    }
    try {
        const [rawTablesSnapshot, gamesList] = await Promise.all([
            getDocs(query(collection(db, TABLES_COLLECTION))),
            getGames()
        ]);

        const gamesMap = new Map(gamesList.map(game => [game.id, game]));

        return rawTablesSnapshot.docs.map(doc => {
            const tableData = doc.data() as Omit<GameTable, 'id' | 'gameName' | 'gameImageUrl' | 'imageUrl'>;
            const game = gamesMap.get(tableData.gameId);
            return {
                id: doc.id,
                ...tableData,
                gameName: game?.nom || 'Jeu inconnu (ID: ' + tableData.gameId + ')',
                gameImageUrl: game?.imageUrl,
                imageUrl: game?.imageUrl,
                authorAnimator: tableData.authorAnimator || '',
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
            tableNumber: tableInput.tableNumber,
            authorAnimator: tableInput.authorAnimator || '',
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
            tableNumber: dataToUpdate.tableNumber,
            authorAnimator: dataToUpdate.authorAnimator || '',
        };

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
            ...firestorePayload,
            gameName: gameData?.nom || 'Jeu inconnu',
            gameImageUrl: gameData?.imageUrl,
            imageUrl: gameData?.imageUrl,
        };
    } catch (error) {
        console.error("Firestore - Erreur détaillée lors de la mise à jour de la table de jeu:", error);
        let baseMessage = "Impossible de mettre à jour la table de jeu dans Firestore.";
        if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            baseMessage = `Impossible de mettre à jour. Erreur Firebase: ${firebaseError.message} (Code: ${firebaseError.code}).`;
        }
        throw new Error(`${baseMessage}`);
    }
};

export const deleteGameTable = async (tableId: string): Promise<void> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for deleteGameTable.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour supprimer une table.");
    }
    const batch = writeBatch(db);
    try {
        const tableRef = doc(db, TABLES_COLLECTION, tableId);

        // Check for associated game results and delete them
        const gameResultRef = doc(db, GAME_RESULTS_COLLECTION, tableId);
        const gameResultSnap = await getDoc(gameResultRef);
        if (gameResultSnap.exists()) {
            batch.delete(gameResultRef);
        }

        const registrationsQuery = query(collection(db, REGISTRATIONS_COLLECTION), where("tableId", "==", tableId));
        const registrationsSnapshot = await getDocs(registrationsQuery);

        if (registrationsSnapshot.docs.length > 0) {
            throw new Error(`La table a ${registrationsSnapshot.docs.length} joueur(s) inscrit(s) et ne peut pas être supprimée (ou les inscriptions doivent être supprimées manuellement/automatiquement).`);
        }

        batch.delete(tableRef);
        await batch.commit();
    } catch (error) {
        if (error instanceof Error && error.message.includes("joueur(s) inscrit(s)")) {
            throw error;
        }
        console.error("Firestore - Erreur lors de la suppression de la table de jeu et/ou de ses résultats:", error);
        throw new Error("Impossible de supprimer la table de jeu de Firestore. Vérifiez les logs pour plus de détails.");
    }
};

// --- Registrations Functions ---

export const getRegistrations = async (): Promise<Registration[]> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for getRegistrations.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour récupérer les inscriptions.");
    }
    try {
        const registrationsCollectionRef = collection(db, REGISTRATIONS_COLLECTION);
        const querySnapshot = await getDocs(registrationsCollectionRef);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration & { id: string }));
    } catch (error) {
        console.error("Firestore - Erreur détaillée lors de la récupération des inscriptions:", error);
        let advice = "Veuillez vérifier la console du navigateur pour l'erreur Firebase détaillée. ";
        if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            switch (firebaseError.code) {
                case 'permission-denied':
                    advice += "ERREUR DE PERMISSION: Firestore a refusé l'accès à la collection 'registrations'. Vérifiez vos règles de sécurité Firestore. Assurez-vous que les utilisateurs authentifiés (ou le public, selon vos besoins) ont la permission de lire cette collection.";
                    break;
                case 'unimplemented':
                case 'failed-precondition':
                     advice += `ERREUR D'INDEX Firestore (${firebaseError.code}): La requête sur 'registrations' nécessite probablement un index. Vérifiez la console du navigateur pour un lien permettant de créer l'index manquant.`;
                    break;
                case 'unavailable':
                    advice += `SERVICE FIRESTORE INDISPONIBLE (${firebaseError.code}). Vérifiez l'état de Firebase et votre connexion internet.`;
                    break;
                default:
                    advice += `Erreur Firebase (${firebaseError.code}): ${firebaseError.message}.`;
                    break;
            }
        } else if (error instanceof Error) {
            advice += `Message d'erreur: ${error.message}.`;
        }
        throw new Error(`Impossible de récupérer les inscriptions depuis Firestore. ${advice}`);
    }
};

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

        const newRegistrationData = { userId, tableId, timestamp: new Date() }; // Add timestamp
        const docRef = await addDoc(collection(db, REGISTRATIONS_COLLECTION), newRegistrationData);
        return { id: docRef.id, ...newRegistrationData };
    } catch (error) {
        console.error("Firestore - Erreur lors de l'ajout de l'inscription:", error);
        throw new Error("Impossible d'ajouter l'inscription à Firestore.");
    }
};

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


// --- Participant Functions ---
export const saveParticipants = async (participants: Participant[]): Promise<void> => {
  if (!db) {
    console.error("Firestore DB instance is not initialized for saveParticipants.");
    throw new Error("La connexion à Firestore n'est pas initialisée pour sauvegarder les participants.");
  }
  try {
    const batch = writeBatch(db);
    const participantsCollectionRef = collection(db, PARTICIPANTS_COLLECTION);

    for (const participant of participants) {
      if (!participant.id || typeof participant.id !== 'string' || participant.id.trim() === '') {
        console.warn("Participant avec ID invalide ignoré:", participant);
        continue;
      }

      const participantDataToSave = {
        nom: participant.nom || '',
        prenom: participant.prenom || '',
        email: participant.email || '',
        typeBillet: participant.typeBillet || 'Invitation',
      };

      const participantRef = doc(participantsCollectionRef, participant.id);
      batch.set(participantRef, participantDataToSave, { merge: true });
    }
    await batch.commit();
    console.log(`${participants.length} participant(s) traité(s) pour sauvegarde dans Firestore.`);
  } catch (error) {
    console.error("Firestore - Erreur détaillée lors de la sauvegarde des participants:", error);
    let detailedMessage = "Impossible de sauvegarder les participants dans Firestore.";
    if (error instanceof Error) {
        detailedMessage += ` Message original: ${error.message}`;
        // @ts-ignore
        if (error.code) {
            // @ts-ignore
            detailedMessage += ` Code Firebase: ${error.code}`;
        }
    }
    throw new Error(detailedMessage);
  }
};

/** Fetches all participants from Firestore */
export const getParticipants = async (): Promise<Participant[]> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for getParticipants.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour récupérer les participants.");
    }
    try {
        const participantsCollectionRef = collection(db, PARTICIPANTS_COLLECTION);
        const querySnapshot = await getDocs(participantsCollectionRef);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant));
    } catch (error) {
        console.error("Firestore - Erreur détaillée lors de la récupération des participants:", error);
        let advice = "Veuillez vérifier la console du navigateur pour l'erreur Firebase détaillée. ";
        if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            if (firebaseError.code === 'permission-denied') {
                advice += "ERREUR DE PERMISSION: Firestore a refusé l'accès. Vérifiez vos règles de sécurité. ";
            } else if (firebaseError.code === 'unimplemented' || firebaseError.code === 'failed-precondition') {
                 advice += `ERREUR D'INDEX Firestore (${firebaseError.code}): La requête nécessite probablement un index. Vérifiez la console du navigateur pour un lien permettant de créer l'index manquant. `;
            } else if (firebaseError.code === 'unavailable') {
                advice += "SERVICE FIRESTORE INDISPONIBLE. Vérifiez l'état de Firebase. ";
            } else {
                advice += `Erreur Firebase (${firebaseError.code}): ${firebaseError.message}. `;
            }
        } else if (error instanceof Error) {
            advice += `Message d'erreur: ${error.message}. `;
        }
        throw new Error(`Impossible de récupérer les participants depuis Firestore. ${advice}`);
    }
};

/** Fetches a single participant by their email from Firestore */
export const getParticipantByEmail = async (email: string): Promise<Participant | null> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for getParticipantByEmail.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour récupérer un participant par email.");
    }
    if (!email || typeof email !== 'string' || email.trim() === '') {
        console.warn("getParticipantByEmail: Email non fourni ou invalide.");
        return null;
    }
    try {
        const participantsCollectionRef = collection(db, PARTICIPANTS_COLLECTION);
        const q = query(participantsCollectionRef, where("email", "==", email.trim()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn(`Aucun participant trouvé pour l'email (sensible à la casse): ${email}. Tentative de recherche insensible à la casse (moins performant)...`);
            const allParticipants = await getParticipants();
            const foundParticipant = allParticipants.find(p => p.email.toLowerCase() === email.trim().toLowerCase());
            if (foundParticipant) {
                 console.log("Participant trouvé avec recherche insensible à la casse:", foundParticipant);
                 return foundParticipant;
            }
            console.log(`Aucun participant trouvé, même avec une recherche insensible à la casse pour : ${email}`);
            return null;
        }

        const docData = querySnapshot.docs[0];
        return { id: docData.id, ...docData.data() } as Participant;
    } catch (error) {
        console.error("Firestore - Erreur lors de la récupération du participant par email:", email, error);
        throw new Error(`Impossible de récupérer le participant pour l'email ${email} depuis Firestore.`);
    }
};


// --- Game Results Functions ---

/** Saves or updates a game result in Firestore. Uses tableId as document ID. */
export const saveGameResult = async (tableId: string, winnerIds: string[], playersInGame: number): Promise<GameResult> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for saveGameResult.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour sauvegarder le résultat du jeu.");
    }
    try {
        const gameResultRef = doc(db, GAME_RESULTS_COLLECTION, tableId);
        const resultData: GameResult = {
            tableId, 
            winnerIds,
            playersInGame,
            timestamp: new Date(),
        };
        await setDoc(gameResultRef, resultData, { merge: true }); 
        return resultData;
    } catch (error) {
        console.error("Firestore - Erreur lors de la sauvegarde du résultat du jeu:", error);
        throw new Error("Impossible de sauvegarder le résultat du jeu dans Firestore.");
    }
};

/** Fetches a single game result by tableId from Firestore */
export const getGameResultByTableId = async (tableId: string): Promise<GameResult | null> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for getGameResultByTableId.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour récupérer un résultat de jeu.");
    }
    try {
        const gameResultRef = doc(db, GAME_RESULTS_COLLECTION, tableId);
        const docSnap = await getDoc(gameResultRef);
        if (docSnap.exists()) {
            return { tableId: docSnap.id, ...docSnap.data() } as GameResult;
        }
        return null;
    } catch (error) {
        console.error(`Firestore - Erreur lors de la récupération du résultat pour la table ${tableId}:`, error);
        throw new Error(`Impossible de récupérer le résultat du jeu pour la table ${tableId}.`);
    }
};

/** Fetches all game results from Firestore */
export const getAllGameResults = async (): Promise<GameResult[]> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for getAllGameResults.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour récupérer tous les résultats des jeux.");
    }
    try {
        const resultsCollection = collection(db, GAME_RESULTS_COLLECTION);
        const querySnapshot = await getDocs(resultsCollection);
        return querySnapshot.docs.map(doc => ({ tableId: doc.id, ...doc.data() } as GameResult));
    } catch (error) {
        console.error("Firestore - Erreur lors de la récupération de tous les résultats des jeux:", error);
        throw new Error("Impossible de récupérer tous les résultats des jeux depuis Firestore.");
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
            return registeredTable.timeSlot === newTable.timeSlot;
        }
        return !(newSlot.end <= registeredSlot.start || newSlot.start >= registeredSlot.end);
    });
};

export const canRegisterBasedOnTicket = (userTicketType: TicketType, currentDate: Date = new Date()): boolean => {
  if (userTicketType === 'Invitation') return false;

  const userPhaseDefinition = REGISTRATION_SCHEDULE.find(phase => phase.ticketType === userTicketType);

  if (!userPhaseDefinition) {
    console.warn(`Aucune phase d'inscription définie pour le type de billet : ${userTicketType}`);
    return false;
  }
  return currentDate >= userPhaseDefinition.startDate;
};


// Helper for deleteGameTable toast, not exported
const toast = (options: any) => {
    if (typeof window !== 'undefined') {
        console.log('Toast:', options.title, options.description);
    }
};
