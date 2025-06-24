import type { Game, GameInput, GameTable, User, Registration, TicketType, GameTableInput, Participant, GameResult, ManualRegistrationControls, ConventionDay, TimeSlotType, TableStatus, BilletwebAttendee } from '@/lib/types';
import { auth, db } from '@/firebase/clientApp'; // Import 'auth'
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
    Timestamp,
    type DocumentReference,
    type DocumentSnapshot,
} from 'firebase/firestore';
import { CONVENTION_DAYS, TIME_SLOT_TYPE_OPTIONS, getActualGranularSlotsForTimeSlotType, getTimeSlotTypeDisplayLabel } from '@/lib/types';
import axios from 'axios';


const GAMES_COLLECTION = 'games';
const TABLES_COLLECTION = 'gameTables';
const REGISTRATIONS_COLLECTION = 'registrations';
const PARTICIPANTS_COLLECTION = 'liste_participants';
const GAME_RESULTS_COLLECTION = 'gameResults';
const SYSTEM_SETTINGS_COLLECTION = 'system_settings';
const REGISTRATION_CONTROL_DOC_ID = 'registrationControl';


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
            const tableData = doc.data() as Omit<GameTable, 'id' | 'gameName' | 'gameImageUrl' | 'imageUrl' | 'gameDescription'>;
            const game = gamesMap.get(tableData.gameId);
            return {
                id: doc.id,
                ...tableData,
                days: tableData.days || [CONVENTION_DAYS[0]], // Ensure days is an array, default if somehow missing
                timeSlotType: tableData.timeSlotType || 'Matin', // Default if somehow missing
                status: tableData.status || 'Ouverte',
                gameName: game?.nom || 'Jeu inconnu (ID: ' + tableData.gameId + ')',
                gameDescription: game?.description || '',
                gameImageUrl: game?.imageUrl,
                imageUrl: game?.imageUrl, // For backward compatibility
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
        // Ensure days array is not empty
        if (!tableInput.days || tableInput.days.length === 0) {
            throw new Error("Au moins un jour doit être sélectionné pour la table.");
        }

        const dataToSave: Omit<GameTable, 'id' | 'gameName' | 'gameImageUrl' | 'imageUrl' | 'gameDescription'> = {
            gameId: tableInput.gameId,
            days: tableInput.days,
            timeSlotType: tableInput.timeSlotType,
            totalSeats: tableInput.totalSeats,
            tableNumber: tableInput.tableNumber,
            authorAnimator: tableInput.authorAnimator || '',
            status: 'Ouverte',
        };

        const docRef = await addDoc(collection(db, TABLES_COLLECTION), dataToSave);

        const gameDoc = await getDoc(doc(db, GAMES_COLLECTION, tableInput.gameId));
        const gameData = gameDoc.exists() ? gameDoc.data() as Game : null;

        return {
            id: docRef.id,
            ...dataToSave,
            gameName: gameData?.nom || 'Jeu inconnu',
            gameDescription: gameData?.description || '',
            gameImageUrl: gameData?.imageUrl,
            imageUrl: gameData?.imageUrl,
        };

    } catch (error) {
        console.error("Firestore - Erreur lors de l'ajout de la table de jeu:", error);
        if (error instanceof Error) throw error;
        throw new Error("Impossible d'ajouter la table de jeu à Firestore.");
    }
};

export const updateGameTable = async (tableToUpdate: GameTableInput & { id: string }): Promise<GameTable> => {
     if (!db) {
        console.error("Firestore DB instance is not initialized for updateGameTable.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour mettre à jour une table.");
    }
    try {
        // Ensure days array is not empty
        if (!tableToUpdate.days || tableToUpdate.days.length === 0) {
            throw new Error("Au moins un jour doit être sélectionné pour la table.");
        }
        const tableRef = doc(db, TABLES_COLLECTION, tableToUpdate.id);
        const { id, ...dataToUpdate } = tableToUpdate;

        const firestorePayload: Omit<GameTable, 'id' | 'gameName' | 'gameImageUrl' | 'imageUrl' | 'gameDescription'> = {
            gameId: dataToUpdate.gameId,
            days: dataToUpdate.days,
            timeSlotType: dataToUpdate.timeSlotType,
            totalSeats: dataToUpdate.totalSeats,
            tableNumber: dataToUpdate.tableNumber,
            authorAnimator: dataToUpdate.authorAnimator || '',
            status: dataToUpdate.status || 'Ouverte',
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
            gameDescription: gameData?.description || '',
            gameImageUrl: gameData?.imageUrl,
            imageUrl: gameData?.imageUrl,
        };
    } catch (error) {
        console.error("Firestore - Erreur détaillée lors de la mise à jour de la table de jeu:", error);
        let baseMessage = "Impossible de mettre à jour la table de jeu dans Firestore.";
        if (error instanceof Error && 'code' in error) {
            const firebaseError = error as { code: string; message: string };
            baseMessage = `Impossible de mettre à jour. Erreur Firebase: ${firebaseError.message} (Code: ${firebaseError.code}).`;
        } else if (error instanceof Error) {
            baseMessage = error.message;
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

/** Updates the status of a specific game table */
export const updateGameTableStatus = async (tableId: string, status: TableStatus): Promise<void> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for updateGameTableStatus.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour mettre à jour le statut de la table.");
    }
    try {
        const tableRef = doc(db, TABLES_COLLECTION, tableId);
        await updateDoc(tableRef, { status: status });
    } catch (error) {
        console.error(`Firestore - Erreur lors de la mise à jour du statut pour la table ${tableId}:`, error);
        throw new Error("Impossible de mettre à jour le statut de la table.");
    }
};

// --- Registrations Functions ---

export const getRegistrations = async (): Promise<(Registration & { id: string })[]> => {
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

export const getRegistrationsForTable = async (tableId: string): Promise<(Registration & { id: string })[]> => {
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

export const addRegistration = async (userId: string, tableId: string): Promise<Registration & { id: string }> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for addRegistration.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour ajouter une inscription.");
    }

    const registrationId = `${userId}_${tableId}`;
    const newRegistrationData: Registration = { userId, tableId, timestamp: new Date() };

    try {
        await setDoc(doc(db, REGISTRATIONS_COLLECTION, registrationId), newRegistrationData);
        return { id: registrationId, ...newRegistrationData };
    } catch (error) {
        console.error("Firestore - Erreur lors de l'ajout de l'inscription (avec setDoc):", error);
        if (error instanceof Error && 'code' in error && (error as any).code === 'permission-denied') {
             throw new Error("Permission refusée. Vos droits ne permettent pas de vous inscrire. Contactez un admin.");
        }
        throw new Error("Impossible d'ajouter l'inscription à Firestore. Une erreur technique est survenue.");
    }
};


export const removeRegistration = async (registrationId: string): Promise<void> => {
    if (!db) {
        console.error("Firestore DB instance is not initialized for removeRegistration.");
        throw new Error("La connexion à Firestore n'est pas initialisée pour supprimer une inscription.");
    }
    try {
        const registrationRef = doc(db, REGISTRATIONS_COLLECTION, registrationId);
        await deleteDoc(registrationRef);
    } catch (error) {
        console.error("Firestore - Erreur lors de la suppression de l'inscription:", error);
        throw new Error("Impossible de supprimer l'inscription de Firestore.");
    }
};


// --- Participant Functions ---
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

// --- Registration Control Functions (Admin) ---

const tryGetFirestoreDoc = async (docRef: DocumentReference, attempt = 1): Promise<DocumentSnapshot> => {
  try {
    const docSnap = await getDoc(docRef);
    return docSnap;
  } catch (error: any) {
    if (attempt < 2 && error.message?.toLowerCase().includes("client is offline")) {
      console.warn(`[getRegistrationControl] Firestore client reported offline on attempt ${attempt}. Retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return tryGetFirestoreDoc(docRef, attempt + 1);
    }
    console.error(`[getRegistrationControl] Error after attempt ${attempt}:`, error);
    throw error; 
  }
};

export const getRegistrationControl = async (): Promise<ManualRegistrationControls> => {
  if (!db) {
    console.error("Firestore DB instance is not initialized for getRegistrationControl.");
    throw new Error("La connexion à Firestore n'est pas initialisée pour récupérer les contrôles d'inscription.");
  }
  try {
    const controlRef = doc(db, SYSTEM_SETTINGS_COLLECTION, REGISTRATION_CONTROL_DOC_ID);
    const docSnap = await tryGetFirestoreDoc(controlRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        strategistManuallyOpen: data.strategistManuallyOpen || false,
        marshalManuallyOpen: data.marshalManuallyOpen || false,
        generalManuallyOpen: data.generalManuallyOpen || false,
        lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : undefined,
      };
    }
    return {
      id: REGISTRATION_CONTROL_DOC_ID,
      strategistManuallyOpen: false,
      marshalManuallyOpen: false,
      generalManuallyOpen: false,
    };
  } catch (error) {
    console.error("Firestore - Erreur lors de la récupération des contrôles d'inscription:", error);
    if (db && db.app && db.app.options) {
      console.error(`[getRegistrationControl] Diagnostic: Attempted to use Firestore project ID: ${db.app.options.projectId} when this error occurred.`);
    } else {
      console.error("[getRegistrationControl] Diagnostic: 'db' instance or its app options were not available for project ID logging when this error occurred.");
    }
    if (error instanceof Error) {
        throw new Error(`Impossible de récupérer les contrôles d'inscription. Détails: ${error.message}`);
    }
    throw new Error("Impossible de récupérer les contrôles d'inscription (erreur Firebase inconnue).");
  }
};

export const updateRegistrationControl = async (updates: Partial<ManualRegistrationControls>): Promise<void> => {
  if (!db) {
    console.error("Firestore DB instance is not initialized for updateRegistrationControl.");
    throw new Error("La connexion à Firestore n'est pas initialisée pour mettre à jour les contrôles d'inscription.");
  }
  try {
    const controlRef = doc(db, SYSTEM_SETTINGS_COLLECTION, REGISTRATION_CONTROL_DOC_ID);
    await setDoc(controlRef, { ...updates, lastUpdated: new Date() }, { merge: true });
  } catch (error) {
    console.error("Firestore - Erreur lors de la mise à jour des contrôles d'inscription:", error);
    if (error instanceof Error) {
        throw new Error(`Impossible de mettre à jour les contrôles d'inscription. Détails: ${error.message}`);
    }
    throw new Error("Impossible de mettre à jour les contrôles d'inscription (erreur Firebase inconnue).");
  }
};


// --- Billetweb Sync Function ---
export const fetchBilletwebAttendees = async (): Promise<BilletwebAttendee[]> => {
  const apiKey = process.env.BILLETWEB_KEY;
  const eventId = process.env.BILLETWEB_EVENT_ID;

  if (!apiKey || !eventId) {
    throw new Error("Les variables d'environnement BILLETWEB_KEY et BILLETWEB_EVENT_ID sont requises.");
  }

  // Corrected URL using the right domain and parameters from environment variables
  const url = `https://api.billetweb.com/v1/event/${eventId}/attendees?api_key=${apiKey}&version=2`;

  try {
    const response = await axios.get<{ attendees: BilletwebAttendee[] }>(url);
    
    if (!response.data || !Array.isArray(response.data.attendees)) {
        console.warn("Billetweb API a répondu mais le format est inattendu. Attendu: { attendees: [...] }, Reçu:", response.data);
        throw new Error("La réponse de l'API Billetweb n'a pas le format attendu.");
    }
    
    return response.data.attendees || [];

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data?.error || error.message;
      console.error(`Erreur API Billetweb (Status: ${error.response?.status}):`, apiError);
      
      if (error.code === 'ENOTFOUND') {
          throw new Error(`Erreur réseau (ENOTFOUND): Impossible de trouver l'hôte de l'API Billetweb. Vérifiez l'URL de l'API et votre connexion.`);
      }
      if (error.response?.status === 403) {
          throw new Error(`Erreur d'authentification Billetweb (403): Clé API invalide ou permissions insuffisantes pour l'événement ${eventId}.`);
      }
      if (error.response?.status === 404) {
          throw new Error(`Erreur Billetweb (404): Événement avec l'ID ${eventId} non trouvé.`);
      }

      throw new Error(`Erreur de l'API Billetweb: ${apiError}`);
    }
    
    console.error("Erreur non-axios lors de la synchronisation Billetweb:", error);
    throw new Error("Une erreur interne est survenue lors de la synchronisation avec Billetweb.");
  }
};


// --- Utility Functions ---

export const getAvailableSeats = (tableId: string, registrations: (Registration & { id: string })[], tables: GameTable[]): number => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return 0;
    const currentRegistrations = registrations.filter(r => r.tableId === tableId).length;
    return table.totalSeats - currentRegistrations;
};

export const hasTimeConflict = (
  newTableCandidate: { days: ConventionDay[]; timeSlotType: TimeSlotType },
  userRegistrations: (Registration & { id: string })[],
  allTables: GameTable[]
): boolean => {
  const newTableActualGranularSlots = getActualGranularSlotsForTimeSlotType(newTableCandidate.timeSlotType);

  for (const registration of userRegistrations) {
    const registeredTable = allTables.find(t => t.id === registration.tableId);
    if (!registeredTable) continue;

    const registeredTableActualGranularSlots = getActualGranularSlotsForTimeSlotType(registeredTable.timeSlotType);

    // Check for day overlap
    const commonDays = newTableCandidate.days.filter(day => registeredTable.days.includes(day));
    if (commonDays.length === 0) continue; 

    const granularSlotsOverlap = newTableActualGranularSlots.some(newSlot =>
      registeredTableActualGranularSlots.includes(newSlot)
    );

    if (granularSlotsOverlap) {
      const newIsOff = newTableActualGranularSlots.includes('Off_Slot');
      const registeredIsOff = registeredTableActualGranularSlots.includes('Off_Slot');

      if (newIsOff && registeredIsOff) return true; // Off conflicts with Off
      if (!newIsOff && !registeredIsOff) return true; // Regular slots (Matin/Aprem/Journée) conflict
    }
  }
  return false;
};


export const canRegisterBasedOnTicket = (
  userTicketType: TicketType,
  manualControls: ManualRegistrationControls
): boolean => {
  if (userTicketType === 'Invitation') return false;

  if (manualControls.generalManuallyOpen) {
      return true;
  }
  if (manualControls.marshalManuallyOpen) {
      return userTicketType === 'Maréchal' || userTicketType === 'Stratège';
  }
  if (manualControls.strategistManuallyOpen) {
      return userTicketType === 'Stratège';
  }

  return false;
};


// Helper for deleteGameTable toast, not exported
const toast = (options: any) => {
    if (typeof window !== 'undefined') {
        console.log('Toast-like log (server-side):', options.title, options.description);
    }
};
