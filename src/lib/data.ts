import type { Game, GameInput, GameTable, User, Registration, TicketType, GameTableInput, Participant, GameResult, ManualRegistrationControls, ConventionDay, TimeSlotType, TableStatus, BilletwebAttendee, Animator, AnimatorInput, TableConfig, TableConfigInput, Slot, SlotInput } from '@/lib/types';
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
import { GAMES_2026_SEED } from '@/lib/games-2026-seed';
import axios from 'axios';


const GAMES_COLLECTION = 'games';
const ANIMATORS_COLLECTION = 'animateurs';
const TABLES_COLLECTION = 'gameTables';
const CONFIGS_COLLECTION = 'configurations'; // gabarits réutilisables (nouveau modèle)
const SLOTS_COLLECTION = 'slots';            // configurations placées sur la grille (nouveau modèle)
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

// --- Animators (auteurs / animateurs) CRUD ---

/** Liste des animateurs/auteurs, triée par prénom puis nom. */
export const getAnimators = async (): Promise<Animator[]> => {
    const firestore = getFirestoreOrThrow();
    const snap = await getDocs(collection(firestore, ANIMATORS_COLLECTION));
    return snap.docs
        .map(d => ({ id: d.id, prenom: '', nom: '', ...(d.data() as Partial<Animator>) } as Animator))
        .sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr'));
};

/** Ajoute un animateur. */
export const addAnimator = async (input: AnimatorInput): Promise<Animator> => {
    const firestore = getFirestoreOrThrow();
    const data = { prenom: (input.prenom || '').trim(), nom: (input.nom || '').trim() };
    const ref = await addDoc(collection(firestore, ANIMATORS_COLLECTION), data);
    return { id: ref.id, ...data };
};

/** Met à jour un animateur. */
export const updateAnimator = async (animator: Animator): Promise<void> => {
    const firestore = getFirestoreOrThrow();
    await updateDoc(doc(firestore, ANIMATORS_COLLECTION, animator.id), {
        prenom: (animator.prenom || '').trim(),
        nom: (animator.nom || '').trim(),
    });
};

/** Supprime un animateur. */
export const deleteAnimator = async (animatorId: string): Promise<void> => {
    const firestore = getFirestoreOrThrow();
    await deleteDoc(doc(firestore, ANIMATORS_COLLECTION, animatorId));
};

// Animateurs/auteurs 2026 issus des paragraphes « Configuration ASYNCONV » du programme.
// nom laissé vide quand seul le prénom est connu (conforme au programme public).
const ANIMATORS_2026_SEED: AnimatorInput[] = [
    { prenom: 'Sébastien', nom: '' },
    { prenom: 'Patrick', nom: '' },
    { prenom: 'Cyril', nom: '' },
    { prenom: 'Sacha', nom: '' },
    { prenom: 'Éric', nom: 'Goffinon' },
    { prenom: 'Morgane', nom: '' },
    { prenom: 'Florian', nom: 'Dumont' },
    { prenom: 'Olivier', nom: '' },
    { prenom: 'Simon', nom: '' },
    { prenom: 'Hervé', nom: '' },
    { prenom: 'Lucas', nom: '' },
    { prenom: 'Arnaud', nom: '' },
];

/** Importe les animateurs 2026 (idempotent : un animateur déjà présent, même prénom+nom, est ignoré).
 *  À appeler CÔTÉ CLIENT (admin authentifié). */
export const importAnimators2026 = async (): Promise<{ added: number; skipped: number }> => {
    const firestore = getFirestoreOrThrow();
    const snap = await getDocs(collection(firestore, ANIMATORS_COLLECTION));
    const existing = new Set(
        snap.docs.map(d => {
            const a = d.data() as Partial<Animator>;
            return `${(a.prenom || '').trim().toLowerCase()}|${(a.nom || '').trim().toLowerCase()}`;
        })
    );
    const batch = writeBatch(firestore);
    let added = 0;
    let skipped = 0;
    for (const a of ANIMATORS_2026_SEED) {
        const key = `${a.prenom.trim().toLowerCase()}|${a.nom.trim().toLowerCase()}`;
        if (existing.has(key)) { skipped++; continue; }
        batch.set(doc(collection(firestore, ANIMATORS_COLLECTION)), { prenom: a.prenom.trim(), nom: a.nom.trim() });
        existing.add(key);
        added++;
    }
    if (added > 0) await batch.commit();
    return { added, skipped };
};

/** Numérote les tables des jeux selon l'ordre chronologique de publication au programme.
 *  L'ordre est lu depuis le numéro encodé dans le visuel (".../Publication_NN_..."), trié
 *  croissant (tie-break par nom). Attribue tableNumber = 1..N. À exécuter côté client (admin). */
export const assignTableNumbersByPublicationOrder = async (): Promise<{ nom: string; tableNumber: string }[]> => {
    const firestore = getFirestoreOrThrow();
    const snap = await getDocs(collection(firestore, GAMES_COLLECTION));
    const games = snap.docs.map(d => ({ id: d.id, ...d.data() } as Game));
    const pubNum = (g: Game): number => {
        const m = (g.imageUrl || '').match(/Publication_0*(\d+)/i);
        return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
    };
    const ordered = [...games].sort((a, b) => {
        const pa = pubNum(a);
        const pb = pubNum(b);
        if (pa !== pb) return pa - pb;
        return (a.nom || '').localeCompare(b.nom || '');
    });
    const batch = writeBatch(firestore);
    ordered.forEach((g, i) => {
        batch.update(doc(firestore, GAMES_COLLECTION, g.id), { tableNumber: String(i + 1) });
    });
    await batch.commit();
    return ordered.map((g, i) => ({ nom: g.nom, tableNumber: String(i + 1) }));
};

// =============================================================================
//  NOUVEAU MODÈLE — Configurations (gabarits) & Slots (grille)
// =============================================================================

/** Configurations (gabarits) hydratées avec les infos du jeu, triées par jeu puis libellé. */
export const getTableConfigs = async (): Promise<TableConfig[]> => {
    const firestore = getFirestoreOrThrow();
    const [configsSnap, gamesSnap] = await Promise.all([
        getDocs(collection(firestore, CONFIGS_COLLECTION)),
        getDocs(collection(firestore, GAMES_COLLECTION)),
    ]);
    const gamesMap = new Map<string, Game>();
    gamesSnap.docs.forEach(d => gamesMap.set(d.id, { id: d.id, ...d.data() } as Game));
    return configsSnap.docs
        .map(d => {
            const data = d.data() as Omit<TableConfig, 'id'>;
            const game = gamesMap.get(data.gameId);
            return {
                id: d.id,
                ...data,
                gameName: game?.nom || 'Jeu inconnu',
                gameImageUrl: game?.imageUrl || '',
                gameDescription: game?.description || '',
                gameTableNumber: game?.tableNumber || '',
                nbreMin: game?.nbre_min,
                nbreMax: game?.nbre_max,
            } as TableConfig;
        })
        .sort((a, b) => (a.gameName || '').localeCompare(b.gameName || '') || (a.label || '').localeCompare(b.label || ''));
};

// Garantit qu'un seul gabarit est « par défaut » pour un jeu : désactive isDefault sur les autres.
async function ensureSingleDefaultConfig(firestore: ReturnType<typeof getFirestoreOrThrow>, gameId: string, keepConfigId: string): Promise<void> {
    const snap = await getDocs(query(collection(firestore, CONFIGS_COLLECTION), where('gameId', '==', gameId)));
    const batch = writeBatch(firestore);
    let changed = false;
    snap.docs.forEach(d => {
        if (d.id !== keepConfigId && (d.data() as { isDefault?: boolean }).isDefault) {
            batch.update(d.ref, { isDefault: false });
            changed = true;
        }
    });
    if (changed) await batch.commit();
}

export const addTableConfig = async (input: TableConfigInput): Promise<TableConfig> => {
    const firestore = getFirestoreOrThrow();
    const data = {
        gameId: input.gameId,
        label: (input.label || '').trim(),
        totalSeats: Math.max(1, input.totalSeats || 1),
        tableShape: input.tableShape || 'round',
        authorAnimator: (input.authorAnimator || '').trim(),
        animatorPlays: !!input.animatorPlays,
        isDefault: !!input.isDefault,
    };
    const ref = await addDoc(collection(firestore, CONFIGS_COLLECTION), data);
    if (data.isDefault) await ensureSingleDefaultConfig(firestore, data.gameId, ref.id);
    return { id: ref.id, ...data };
};

export const updateTableConfig = async (config: TableConfig): Promise<void> => {
    const firestore = getFirestoreOrThrow();
    await updateDoc(doc(firestore, CONFIGS_COLLECTION, config.id), {
        gameId: config.gameId,
        label: (config.label || '').trim(),
        totalSeats: Math.max(1, config.totalSeats || 1),
        tableShape: config.tableShape || 'round',
        authorAnimator: (config.authorAnimator || '').trim(),
        animatorPlays: !!config.animatorPlays,
        isDefault: !!config.isDefault,
    });
    if (config.isDefault) await ensureSingleDefaultConfig(firestore, config.gameId, config.id);
};

/** Supprime une configuration. Refuse si elle est encore utilisée par un slot. */
export const deleteTableConfig = async (configId: string): Promise<void> => {
    const firestore = getFirestoreOrThrow();
    const usedSnap = await getDocs(query(collection(firestore, SLOTS_COLLECTION), where('configId', '==', configId)));
    if (!usedSnap.empty) {
        throw new Error(`Cette configuration est utilisée par ${usedSnap.size} slot(s). Retirez-la de la grille avant de la supprimer.`);
    }
    await deleteDoc(doc(firestore, CONFIGS_COLLECTION, configId));
};

/** Slots (configurations placées sur la grille), hydratés avec leur configuration (+ infos jeu). */
export const getSlots = async (): Promise<Slot[]> => {
    const firestore = getFirestoreOrThrow();
    const [slotsSnap, configs] = await Promise.all([
        getDocs(collection(firestore, SLOTS_COLLECTION)),
        getTableConfigs(),
    ]);
    const configMap = new Map(configs.map(c => [c.id, c]));
    return slotsSnap.docs.map(d => {
        const data = d.data() as Omit<Slot, 'id' | 'config'>;
        return {
            id: d.id,
            ...data,
            cells: data.cells || [],
            status: data.status || 'Ouverte',
            config: configMap.get(data.configId),
        } as Slot;
    });
};

export const addSlot = async (input: SlotInput): Promise<Slot> => {
    const firestore = getFirestoreOrThrow();
    const data = {
        configId: input.configId,
        cells: input.cells || [],
        status: (input.status || 'Ouverte') as TableStatus,
    };
    const ref = await addDoc(collection(firestore, SLOTS_COLLECTION), data);
    return { id: ref.id, ...data };
};

/** Crée en lot un slot par cellule (un slot = une case), tous avec la même configuration.
 *  Sert au remplissage « demi-journées » de la grille. */
export const fillSlotsForCells = async (configId: string, cells: SlotCell[]): Promise<number> => {
    return createSlotsFromGroups(configId, cells.map(c => [c]));
};

/** Crée un slot par groupe de cellules (chaque groupe = les cellules d'UN slot), même configuration.
 *  Permet « journée » (groupe [Matin, Après-midi]) ou « plusieurs jours » (groupe multi-jours). */
export const createSlotsFromGroups = async (configId: string, groups: SlotCell[][]): Promise<number> => {
    const firestore = getFirestoreOrThrow();
    const valid = groups.filter(g => g.length > 0);
    if (valid.length === 0) return 0;
    const batch = writeBatch(firestore);
    valid.forEach(cells => {
        batch.set(doc(collection(firestore, SLOTS_COLLECTION)), {
            configId,
            cells,
            status: 'Ouverte' as TableStatus,
        });
    });
    await batch.commit();
    return valid.length;
};

export const updateSlot = async (slot: SlotInput & { id: string }): Promise<void> => {
    const firestore = getFirestoreOrThrow();
    await updateDoc(doc(firestore, SLOTS_COLLECTION, slot.id), {
        configId: slot.configId,
        cells: slot.cells || [],
        status: slot.status || 'Ouverte',
    });
};

/** Change uniquement le statut d'un slot (Ouverte / EnCours / Terminee), piloté par l'animateur. */
export const setSlotStatus = async (slotId: string, status: TableStatus): Promise<void> => {
    const firestore = getFirestoreOrThrow();
    await updateDoc(doc(firestore, SLOTS_COLLECTION, slotId), { status });
};

/** Supprime un slot. Refuse s'il a des inscriptions confirmées ; sinon retire aussi ses entrées de file d'attente. */
export const deleteSlot = async (slotId: string): Promise<void> => {
    const firestore = getFirestoreOrThrow();
    const regsSnap = await getDocs(query(collection(firestore, REGISTRATIONS_COLLECTION), where('slotId', '==', slotId)));
    const confirmed = regsSnap.docs.filter(d => (d.data() as Registration).status === 'confirmed');
    if (confirmed.length > 0) {
        throw new Error(`Ce slot a ${confirmed.length} joueur(s) inscrit(s) : désinscrivez-les avant de le supprimer.`);
    }
    const batch = writeBatch(firestore);
    regsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(firestore, SLOTS_COLLECTION, slotId));
    await batch.commit();
};

/** Outil de TEST : remet à zéro les inscriptions puis remplit aléatoirement les slots avec de vrais
 *  participants (places confirmées + quelques files d'attente sur les tables pleines). À exécuter côté
 *  client (admin). Réversible via la remise à zéro des inscriptions. */
export const simulateTestRegistrations = async (): Promise<{ slots: number; confirmed: number }> => {
    const firestore = getFirestoreOrThrow();
    const [slotsSnap, partsSnap, regsSnap, configs] = await Promise.all([
        getDocs(collection(firestore, SLOTS_COLLECTION)),
        getDocs(collection(firestore, PARTICIPANTS_COLLECTION)),
        getDocs(collection(firestore, REGISTRATIONS_COLLECTION)),
        getTableConfigs(),
    ]);
    const participantIds = partsSnap.docs.map(d => d.id);
    if (participantIds.length === 0) throw new Error("Aucun participant : lance d'abord la synchro Billetweb.");
    if (slotsSnap.empty) throw new Error('Aucun slot : remplis d’abord la grille.');

    // 1) Efface les inscriptions existantes (repart propre).
    for (let i = 0; i < regsSnap.docs.length; i += 450) {
        const batch = writeBatch(firestore);
        regsSnap.docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }

    const configById = new Map(configs.map(c => [c.id, c]));

    // Un joueur ne peut pas se dédoubler : on suit les créneaux déjà pris (place OU file) par chacun.
    const busyCells = new Map<string, Set<string>>();
    const conflicts = (uid: string, keys: string[]) => {
        const s = busyCells.get(uid);
        return !!s && keys.some(k => s.has(k));
    };
    const markBusy = (uid: string, keys: string[]) => {
        let s = busyCells.get(uid);
        if (!s) { s = new Set(); busyCells.set(uid, s); }
        keys.forEach(k => s!.add(k));
    };
    const pick = (n: number, exclude: Set<string>, keys: string[]): string[] => {
        const pool = participantIds.filter(p => !exclude.has(p) && !conflicts(p, keys));
        const res: string[] = [];
        while (res.length < n && pool.length > 0) res.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        return res;
    };

    const writes: { id: string; data: Registration }[] = [];
    let confirmed = 0, slotsFilled = 0;
    slotsSnap.docs.forEach(d => {
        const slot = d.data() as Slot;
        const cfg = configById.get(slot.configId);
        if (!cfg) return;
        const keys = (slot.cells || []).map(c => `${c.day}|${c.session}`);
        const capacity = Math.max(1, (cfg.totalSeats || 1) - (cfg.animatorPlays ? 1 : 0));
        const full = Math.random() < 0.4;
        const confN = full ? capacity : Math.floor(Math.random() * (capacity + 1));
        const used = new Set<string>();
        pick(confN, used, keys).forEach(uid => { used.add(uid); markBusy(uid, keys); writes.push({ id: `${uid}_${d.id}`, data: { userId: uid, slotId: d.id, status: 'confirmed', timestamp: new Date() } }); confirmed++; });
        if (used.size > 0) slotsFilled++;
    });

    for (let i = 0; i < writes.length; i += 450) {
        const batch = writeBatch(firestore);
        writes.slice(i, i + 450).forEach(w => batch.set(doc(firestore, REGISTRATIONS_COLLECTION, w.id), w.data));
        await batch.commit();
    }
    return { slots: slotsFilled, confirmed };
};

/** Efface UNIQUEMENT les inscriptions (places + files). Conserve la grille (slots), les
 *  configurations, les jeux et les participants. À exécuter côté client (admin). */
export const clearAllRegistrations = async (): Promise<{ registrations: number }> => {
    const firestore = getFirestoreOrThrow();
    const regsSnap = await getDocs(collection(firestore, REGISTRATIONS_COLLECTION));
    for (let i = 0; i < regsSnap.docs.length; i += 450) {
        const batch = writeBatch(firestore);
        regsSnap.docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
    return { registrations: regsSnap.size };
};

/** Remet à zéro les données de planning : gameTables (ancien modèle), slots et TOUTES les inscriptions.
 *  Conserve games, configurations, animateurs et participants. À exécuter côté client (admin). */
export const wipePlanningData = async (): Promise<{ gameTables: number; slots: number; registrations: number }> => {
    const firestore = getFirestoreOrThrow();
    const [tablesSnap, slotsSnap, regsSnap] = await Promise.all([
        getDocs(collection(firestore, TABLES_COLLECTION)),
        getDocs(collection(firestore, SLOTS_COLLECTION)),
        getDocs(collection(firestore, REGISTRATIONS_COLLECTION)),
    ]);
    const allDocs = [...tablesSnap.docs, ...slotsSnap.docs, ...regsSnap.docs];
    for (let i = 0; i < allDocs.length; i += 450) {
        const batch = writeBatch(firestore);
        allDocs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
    return { gameTables: tablesSnap.size, slots: slotsSnap.size, registrations: regsSnap.size };
};

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
                animatorPlays: tableData.animatorPlays ?? false,
                tableShape: tableData.tableShape ?? 'round',
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
            tableShape: tableInput.tableShape || 'round',
            authorAnimator: tableInput.authorAnimator || '',
            // animatorPlays only makes sense if there IS an animator; force false otherwise.
            animatorPlays: (tableInput.authorAnimator && tableInput.animatorPlays) ? true : false,
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
            tableShape: dataToUpdate.tableShape || 'round',
            authorAnimator: dataToUpdate.authorAnimator || '',
            // animatorPlays only makes sense if there IS an animator; force false otherwise.
            animatorPlays: (dataToUpdate.authorAnimator && dataToUpdate.animatorPlays) ? true : false,
            status: dataToUpdate.status || 'Ouverte',
        };

        const cleanedPayload = Object.entries(firestorePayload).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                (acc as Record<string, unknown>)[key] = value;
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

        // Garde-fou : on refuse la suppression d'un slot ayant des joueurs inscrits.
        const registrationsQuery = query(collection(db, REGISTRATIONS_COLLECTION), where("tableId", "==", tableId));
        const registrationsSnapshot = await getDocs(registrationsQuery);
        if (registrationsSnapshot.docs.length > 0) {
            throw new Error(`Ce slot a ${registrationsSnapshot.docs.length} joueur(s) inscrit(s) : désinscrivez-les avant de le supprimer.`);
        }

        batch.delete(tableRef);
        await batch.commit();
    } catch (error) {
        if (error instanceof Error && error.message.includes("inscrit(s)")) {
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

/** Inscrit un participant sur un SLOT (nouveau modèle). Statut par défaut : 'confirmed' (place).
 *  Id déterministe `${userId}_${slotId}` => idempotent (pas de doublon). */
/** Cellule occupée = `${jour}|${session}`. Un joueur ne peut pas se dédoubler :
 *  une seule inscription (place OU file) par créneau, toutes tables confondues.
 *  Lève une erreur si l'inscription au slot cible créerait un conflit horaire. */
const assertNoSlotTimeConflict = async (userId: string, targetSlotId: string): Promise<void> => {
    if (!db) return;
    const slotsSnap = await getDocs(collection(db, SLOTS_COLLECTION));
    const slotsById = new Map(slotsSnap.docs.map(d => [d.id, d.data() as Slot]));
    const target = slotsById.get(targetSlotId);
    const targetKeys = new Set((target?.cells || []).map(c => `${c.day}|${c.session}`));
    if (targetKeys.size === 0) return;

    const regSnap = await getDocs(query(collection(db, REGISTRATIONS_COLLECTION), where('userId', '==', userId)));
    for (const d of regSnap.docs) {
        const r = d.data() as Registration;
        if (!r.slotId || r.slotId === targetSlotId) continue; // même slot : simple mise à jour, pas un doublon
        const other = slotsById.get(r.slotId);
        const clash = (other?.cells || []).some(c => targetKeys.has(`${c.day}|${c.session}`));
        if (clash) {
            throw new Error("Conflit de créneau : ce joueur a déjà une partie prévue sur ce créneau (un joueur ne peut pas être à deux tables en même temps).");
        }
    }
};

export const addSlotRegistration = async (
    userId: string,
    slotId: string,
    status: 'confirmed' | 'waiting' | 'offered' = 'confirmed',
): Promise<Registration & { id: string }> => {
    if (!db) throw new Error("La connexion à Firestore n'est pas initialisée.");
    await assertNoSlotTimeConflict(userId, slotId);
    const registrationId = `${userId}_${slotId}`;
    const data: Registration = { userId, slotId, status, timestamp: new Date() };
    try {
        await setDoc(doc(db, REGISTRATIONS_COLLECTION, registrationId), data);
        return { id: registrationId, ...data };
    } catch (error) {
        console.error("Firestore - Erreur lors de l'inscription au slot:", error);
        if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'permission-denied') {
            throw new Error("Permission refusée. Vos droits ne permettent pas de vous inscrire. Contactez un admin.");
        }
        throw new Error("Impossible de vous inscrire à ce slot. Une erreur technique est survenue.");
    }
};

/** Met à jour le statut d'une inscription (file d'attente : waiting -> offered -> confirmed). */
export const updateRegistrationStatus = async (registrationId: string, status: 'confirmed' | 'waiting' | 'offered'): Promise<void> => {
    if (!db) throw new Error("La connexion à Firestore n'est pas initialisée.");
    await updateDoc(doc(db, REGISTRATIONS_COLLECTION, registrationId), { status });
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

// --- Vérification par numéro de billet (ext_id) ---
// Le numéro de billet n'est JAMAIS stocké en clair (la liste des participants est lisible
// publiquement) : on ne conserve qu'une empreinte SHA-256, comparée à la connexion.

/** Normalise un numéro de billet : majuscules + suppression de tout sauf lettres/chiffres
 *  (tolère espaces, tirets, casse différents lors de la saisie). */
export const normalizeTicket = (s: string): string => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Empreinte SHA-256 (hex) du numéro de billet normalisé. Fonctionne côté navigateur et côté serveur (Node 18+). */
export const hashTicket = async (s: string): Promise<string> => {
    const norm = normalizeTicket(s);
    if (!norm) return '';
    const data = new TextEncoder().encode(norm);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};

/** Récupère TOUS les participants liés à un email (une même personne peut avoir acheté
 *  plusieurs billets pour ses amis : même email, numéros différents). Insensible à la casse. */
export const getParticipantsByEmail = async (email: string): Promise<Participant[]> => {
    if (!email || email.trim() === '') return [];
    const target = email.trim().toLowerCase();
    const all = await getParticipants();
    return all.filter(p => (p.email || '').trim().toLowerCase() === target);
};

/** Vérifie un participant via email + numéro de billet. Parmi tous les billets liés à cet email,
 *  retourne celui dont l'empreinte du numéro correspond (permet à un acheteur de réserver pour
 *  chacun de ses billets/amis), sinon null. */
export const verifyParticipantCredentials = async (email: string, ticketNumber: string): Promise<Participant | null> => {
    const provided = await hashTicket(ticketNumber);
    if (!provided) return null;

    const candidates = await getParticipantsByEmail(email);
    if (candidates.length === 0) return null;

    const match = candidates.find(p => (p.ticketHash || '') === provided);
    if (match) return match;

    // Aucun numéro ne correspond : si aucun billet de cet email n'a d'empreinte, c'est un défaut de synchro.
    if (candidates.every(p => !p.ticketHash)) {
        throw new Error("Aucun numéro de billet enregistré pour cet email. L'administrateur doit relancer la synchronisation Billetweb.");
    }
    return null;
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
        colonelManuallyOpen: data.colonelManuallyOpen || false,
        lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : undefined,
      };
    }
    return {
      id: REGISTRATION_CONTROL_DOC_ID,
      strategistManuallyOpen: false,
      marshalManuallyOpen: false,
      generalManuallyOpen: false,
      colonelManuallyOpen: false,
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

// --- Participant Sync Function ---

const mapBilletwebTicketToType = (ticketName: string): TicketType => {
    if (!ticketName) return 'Invitation';
    const lowerCaseTicket = ticketName.toLowerCase();
    // Order matters: most specific grades first to avoid mis-matches on composite labels.
    if (lowerCaseTicket.includes('stratège')) return 'Stratège';
    if (lowerCaseTicket.includes('maréchal')) return 'Maréchal';
    if (lowerCaseTicket.includes('général')) return 'Général';
    if (lowerCaseTicket.includes('colonel')) return 'Colonel';
    // Any other ticket name like "Animateur" will be considered an 'Invitation' for registration purposes.
    return 'Invitation';
};

/**
 * Fetches attendees from Billetweb and syncs them with the Firestore 'liste_participants' collection.
 * Adds new participants and updates existing ones based on email.
 * @returns {Promise<{ added: number; updated: number;}>} A summary of the sync operation.
 */
export const syncParticipantsWithBilletweb = async (): Promise<{ added: number; updated: number;}> => {
    if (!db) {
        throw new Error("La connexion à Firestore n'est pas initialisée.");
    }
    
    const billetwebAttendees = await fetchBilletwebAttendees();
    if (!billetwebAttendees || billetwebAttendees.length === 0) {
        // If Billetweb returns nothing, we don't proceed to avoid accidental deletions or empty states.
        return { added: 0, updated: 0 };
    }

    const existingParticipantsSnapshot = await getDocs(collection(db, PARTICIPANTS_COLLECTION));
    const existingParticipantsMapByEmail = new Map<string, Participant & { id: string }>();
    existingParticipantsSnapshot.docs.forEach(doc => {
        const participant = { id: doc.id, ...doc.data() } as Participant & { id: string };
        if (participant.email) {
            existingParticipantsMapByEmail.set(participant.email.toLowerCase(), participant);
        }
    });

    const batch = writeBatch(db);
    let addedCount = 0;
    let updatedCount = 0;

    for (const attendee of billetwebAttendees) {
        // Skip entries without a valid email, as it's our primary key
        if (!attendee.email || attendee.email.trim() === '') continue;

        const normalizedEmail = attendee.email.toLowerCase();
        const existingParticipant = existingParticipantsMapByEmail.get(normalizedEmail);
        
        // Empreinte du numéro de billet (ext_id) — jamais stockée en clair.
        const ticketHash = await hashTicket(attendee.ext_id || '');

        const participantDataFromBilletweb = {
            nom: attendee.name.trim(),
            prenom: attendee.firstname.trim(),
            email: attendee.email, // Store the original-cased email
            typeBillet: mapBilletwebTicketToType(attendee.ticket),
            ticketHash,
        };

        if (existingParticipant) {
            // Update existing participant only if data has changed
            const hasChanged =
                existingParticipant.nom !== participantDataFromBilletweb.nom ||
                existingParticipant.prenom !== participantDataFromBilletweb.prenom ||
                existingParticipant.typeBillet !== participantDataFromBilletweb.typeBillet ||
                (existingParticipant.ticketHash || '') !== ticketHash;

            if (hasChanged) {
                const participantRef = doc(db, PARTICIPANTS_COLLECTION, existingParticipant.id);
                batch.update(participantRef, participantDataFromBilletweb);
                updatedCount++;
            }
        } else {
            // Add new participant, using their Billetweb ID as the Firestore document ID for idempotency.
            const participantRef = doc(db, PARTICIPANTS_COLLECTION, String(attendee.id));
            batch.set(participantRef, participantDataFromBilletweb);
            addedCount++;
        }
    }

    // Only commit if there are changes to be made
    if (addedCount > 0 || updatedCount > 0) {
        await batch.commit();
    }

    return { added: addedCount, updated: updatedCount };
};


// --- Billetweb Sync Function ---
export const fetchBilletwebAttendees = async (): Promise<BilletwebAttendee[]> => {
  const apiKey = process.env.BILLETWEB_KEY;
  const eventId = process.env.BILLETWEB_EVENT_ID;
  const userId = process.env.BILLETWEB_USER; // Getting user ID from env

  if (!apiKey || !eventId || !userId) { // Checking all required variables
    throw new Error("Les variables d'environnement BILLETWEB_KEY, BILLETWEB_EVENT_ID et BILLETWEB_USER_ID sont requises.");
  }

  // Updated URL with all required elements: Event ID, User ID, and Key.
  // Using the www.billetweb.fr domain and version 1 API structure.
  const url = `https://www.billetweb.fr/api/event/${eventId}/attendees?user=${userId}&key=${apiKey}&version=1`;

  try {
    // API v1 returns an array of attendees directly.
    const response = await axios.get<BilletwebAttendee[]>(url);
    
    // The API should return an array. If not, it's an error.
    if (!Array.isArray(response.data)) {
        console.warn("Billetweb API a répondu mais le format est inattendu. Attendu: un tableau `[...]`, Reçu:", response.data);
        // Handle cases where Billetweb returns an error object like { error: 'message' }
        if (typeof response.data === 'object' && response.data !== null && 'error' in response.data) {
          throw new Error(`Erreur de l'API Billetweb: ${(response.data as {error: string}).error}`);
        }
        throw new Error("La réponse de l'API Billetweb n'a pas le format attendu.");
    }
    
    return response.data || [];

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data?.error || (typeof error.response?.data === 'string' ? error.response.data : error.message);
      const urlForLogs = url.replace(apiKey, '***'); // Hide key from logs
      console.error(`Erreur API Billetweb (Status: ${error.response?.status}) pour URL: ${urlForLogs}`, apiError);
      
      if (error.code === 'ENOTFOUND') {
          throw new Error(`Erreur réseau (ENOTFOUND): Impossible de trouver l'hôte de l'API Billetweb. Vérifiez l'URL (${urlForLogs}) et votre connexion.`);
      }
      if (error.response?.status === 403) {
          throw new Error(`Erreur d'authentification Billetweb (403): Clé API ou User ID invalide, ou permissions insuffisantes pour l'événement ${eventId}.`);
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
    // If the animator plays, they occupy one of the seats — players have one less seat to register for.
    const animatorSeatOffset = table.animatorPlays ? 1 : 0;
    return table.totalSeats - currentRegistrations - animatorSeatOffset;
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

  // Cascade: Stratège (highest priority) -> Maréchal -> Général -> Colonel (lowest).
  // Each phase opens registration for its own grade AND all higher-priority grades.
  if (manualControls.colonelManuallyOpen) {
      return true; // Every grade can register
  }
  if (manualControls.generalManuallyOpen) {
      return userTicketType === 'Stratège'
          || userTicketType === 'Maréchal'
          || userTicketType === 'Général';
  }
  if (manualControls.marshalManuallyOpen) {
      return userTicketType === 'Maréchal' || userTicketType === 'Stratège';
  }
  if (manualControls.strategistManuallyOpen) {
      return userTicketType === 'Stratège';
  }

  return false;
};


// --- Archives 2025 (read-only access to historical data) ---
// Once the migration endpoint has moved data under archives/2025/*, these helpers
// allow the admin archive page to display the previous edition's data in a frozen state.

const ARCHIVES_COLLECTION = 'archives';
const ARCHIVE_2025_DOC = '2025';

/** Fetches all archived participants (2025 edition) from Firestore */
export const getArchivedParticipants = async (): Promise<Participant[]> => {
    if (!db) {
        throw new Error("La connexion à Firestore n'est pas initialisée.");
    }
    try {
        const ref = collection(db, ARCHIVES_COLLECTION, ARCHIVE_2025_DOC, PARTICIPANTS_COLLECTION);
        const snap = await getDocs(ref);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant));
    } catch (error) {
        console.error("Firestore - Erreur récupération participants archivés 2025:", error);
        throw new Error("Impossible de récupérer les participants archivés 2025.");
    }
};

/** Imports the 2026 games (from GAMES_2026_SEED) into the root `games` collection.
 *  Idempotent: a game whose name already exists (case-insensitive) is skipped, so the
 *  import can safely be re-run. Must be called CLIENT-SIDE (authenticated admin) because
 *  the `games` collection requires `request.auth != null` to write. */
export const importGames2026 = async (): Promise<{ added: number; updated: number; skipped: number; addedNames: string[] }> => {
    const firestore = getFirestoreOrThrow();
    const existingSnap = await getDocs(collection(firestore, GAMES_COLLECTION));
    // Map nom (normalisé) -> { id, imageUrl } pour les jeux déjà présents.
    const existingByName = new Map<string, { id: string; imageUrl: string }>();
    existingSnap.docs.forEach(d => {
        const data = d.data() as { nom?: string; imageUrl?: string };
        const key = String(data.nom || '').trim().toLowerCase();
        if (key) existingByName.set(key, { id: d.id, imageUrl: String(data.imageUrl || '') });
    });

    const batch = writeBatch(firestore);
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const addedNames: string[] = [];

    for (const game of GAMES_2026_SEED) {
        const key = game.nom.trim().toLowerCase();
        const existing = existingByName.get(key);
        if (existing) {
            // Jeu déjà présent : on complète seulement l'image si elle est vide côté Firestore
            // et que le seed en fournit une (backfill non destructif).
            if (!existing.imageUrl && game.imageUrl) {
                batch.update(doc(firestore, GAMES_COLLECTION, existing.id), { imageUrl: game.imageUrl });
                updated++;
            } else {
                skipped++;
            }
            continue;
        }
        const ref = doc(collection(firestore, GAMES_COLLECTION));
        batch.set(ref, {
            nom: game.nom,
            description: game.description,
            imageUrl: game.imageUrl || '',
            asynconvURL: game.asynconvURL || '',
            nbre_min: game.nbre_min,
            nbre_max: game.nbre_max,
        });
        existingByName.set(key, { id: ref.id, imageUrl: game.imageUrl || '' }); // garde-fou doublons internes
        added++;
        addedNames.push(game.nom);
    }

    if (added > 0 || updated > 0) {
        await batch.commit();
    }
    return { added, updated, skipped, addedNames };
};

/** Fetches all archived games (2025 edition) from Firestore, sorted by name */
export const getArchivedGames = async (): Promise<Game[]> => {
    if (!db) {
        throw new Error("La connexion à Firestore n'est pas initialisée.");
    }
    try {
        const ref = collection(db, ARCHIVES_COLLECTION, ARCHIVE_2025_DOC, GAMES_COLLECTION);
        const snap = await getDocs(ref);
        return snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Game))
            .sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    } catch (error) {
        console.error("Firestore - Erreur récupération jeux archivés 2025:", error);
        throw new Error("Impossible de récupérer les jeux archivés 2025.");
    }
};

/** Fetches all archived game tables (2025 edition) with hydrated game info */
export const getArchivedGameTables = async (): Promise<GameTable[]> => {
    if (!db) {
        throw new Error("La connexion à Firestore n'est pas initialisée.");
    }
    try {
        const [tablesSnap, gamesSnap] = await Promise.all([
            getDocs(collection(db, ARCHIVES_COLLECTION, ARCHIVE_2025_DOC, TABLES_COLLECTION)),
            getDocs(collection(db, ARCHIVES_COLLECTION, ARCHIVE_2025_DOC, GAMES_COLLECTION)),
        ]);

        const gamesMap = new Map<string, Game>();
        gamesSnap.docs.forEach(d => gamesMap.set(d.id, { id: d.id, ...d.data() } as Game));

        return tablesSnap.docs.map(doc => {
            const tableData = doc.data() as Omit<GameTable, 'id' | 'gameName' | 'gameImageUrl' | 'imageUrl' | 'gameDescription'>;
            const game = gamesMap.get(tableData.gameId);
            return {
                id: doc.id,
                ...tableData,
                days: tableData.days || [CONVENTION_DAYS[0]],
                timeSlotType: tableData.timeSlotType || 'Matin',
                status: tableData.status || 'Ouverte',
                gameName: game?.nom || 'Jeu inconnu (ID: ' + tableData.gameId + ')',
                gameDescription: game?.description || '',
                gameImageUrl: game?.imageUrl,
                imageUrl: game?.imageUrl,
                authorAnimator: tableData.authorAnimator || '',
            } as GameTable;
        });
    } catch (error) {
        console.error("Firestore - Erreur récupération tables archivées 2025:", error);
        throw new Error("Impossible de récupérer les tables archivées 2025.");
    }
};

/** Fetches all archived game results (2025 edition) */
export const getArchivedGameResults = async (): Promise<GameResult[]> => {
    if (!db) {
        throw new Error("La connexion à Firestore n'est pas initialisée.");
    }
    try {
        const ref = collection(db, ARCHIVES_COLLECTION, ARCHIVE_2025_DOC, GAME_RESULTS_COLLECTION);
        const snap = await getDocs(ref);
        return snap.docs.map(doc => ({ tableId: doc.id, ...doc.data() } as GameResult));
    } catch (error) {
        console.error("Firestore - Erreur récupération résultats archivés 2025:", error);
        throw new Error("Impossible de récupérer les résultats archivés 2025.");
    }
};

/** Fetches all archived registrations (2025 edition) */
export const getArchivedRegistrations = async (): Promise<(Registration & { id: string })[]> => {
    if (!db) {
        throw new Error("La connexion à Firestore n'est pas initialisée.");
    }
    try {
        const ref = collection(db, ARCHIVES_COLLECTION, ARCHIVE_2025_DOC, REGISTRATIONS_COLLECTION);
        const snap = await getDocs(ref);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration & { id: string }));
    } catch (error) {
        console.error("Firestore - Erreur récupération inscriptions archivées 2025:", error);
        throw new Error("Impossible de récupérer les inscriptions archivées 2025.");
    }
};

const ARCHIVABLE_COLLECTIONS = [
    GAMES_COLLECTION,
    TABLES_COLLECTION,
    REGISTRATIONS_COLLECTION,
    PARTICIPANTS_COLLECTION,
    GAME_RESULTS_COLLECTION,
    SYSTEM_SETTINGS_COLLECTION,
] as const;

// Some collections (typically settings) have Firestore rules that authorize `get` on a known
// document ID but deny `list` on the collection. For those, we cannot call getDocs — we must
// fetch each known document individually via getDoc. The map below lists, per collection,
// the known doc IDs to probe in that scenario.
const KNOWN_DOC_IDS_FALLBACK: Record<string, string[]> = {
    [SYSTEM_SETTINGS_COLLECTION]: [REGISTRATION_CONTROL_DOC_ID],
};

/** Lists documents from a root collection, with a fallback path for collections whose
 *  security rules deny `list` (like system_settings). Returns id+data pairs. */
async function listDocsForCollectionSafe(firestore: ReturnType<typeof getFirestoreOrThrow>, colName: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
    try {
        const snap = await getDocs(collection(firestore, colName));
        return snap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, unknown> }));
    } catch (listError) {
        const fallbackIds = KNOWN_DOC_IDS_FALLBACK[colName];
        if (!fallbackIds || fallbackIds.length === 0) {
            // No fallback strategy for this collection — re-throw.
            throw listError;
        }
        // Fallback: try each known document individually.
        const results = await Promise.all(
            fallbackIds.map(async (docId) => {
                try {
                    const snap = await getDoc(doc(firestore, colName, docId));
                    return snap.exists() ? { id: snap.id, data: snap.data() as Record<string, unknown> } : null;
                } catch (e) {
                    console.warn(`[listDocsForCollectionSafe] Could not read ${colName}/${docId}:`, e);
                    return null;
                }
            })
        );
        return results.filter((r): r is { id: string; data: Record<string, unknown> } => r !== null);
    }
}

function getFirestoreOrThrow() {
    if (!db) {
        throw new Error("La connexion à Firestore n'est pas initialisée.");
    }
    return db;
}

/** Migrates all root-level data into archives/2025/{collection}/* and clears the root collections.
 *  Idempotent : a collection that is already empty at root is simply skipped.
 *  Firestore batches are capped at 500 operations, so we chunk both the copy and the delete passes.
 *  Returns a per-collection summary (number of documents archived). */
export const migrate2025DataToArchives = async (): Promise<{ summary: Record<string, number>; archivedAt: string; }> => {
    const firestore = getFirestoreOrThrow();

    const summary: Record<string, number> = {};

    // Ensure the parent archive document exists so it shows up in the Firestore console.
    const archiveDocRef = doc(firestore, ARCHIVES_COLLECTION, ARCHIVE_2025_DOC);
    const archivedAt = new Date().toISOString();
    await setDoc(archiveDocRef, { archivedAt, edition: '2025' }, { merge: true });

    for (const colName of ARCHIVABLE_COLLECTIONS) {
        // Uses the safe lister so system_settings (no list permission) still works via known IDs.
        const docs = await listDocsForCollectionSafe(firestore, colName);
        if (docs.length === 0) {
            summary[colName] = 0;
            continue;
        }

        // Pass 1: copy in chunks of 500.
        const COPY_CHUNK = 500;
        for (let i = 0; i < docs.length; i += COPY_CHUNK) {
            const batch = writeBatch(firestore);
            const slice = docs.slice(i, i + COPY_CHUNK);
            for (const d of slice) {
                const target = doc(firestore, ARCHIVES_COLLECTION, ARCHIVE_2025_DOC, colName, d.id);
                batch.set(target, d.data);
            }
            await batch.commit();
        }

        // Pass 2: delete originals in chunks of 500 (only after copy is committed).
        const DELETE_CHUNK = 500;
        for (let i = 0; i < docs.length; i += DELETE_CHUNK) {
            const batch = writeBatch(firestore);
            const slice = docs.slice(i, i + DELETE_CHUNK);
            for (const d of slice) {
                batch.delete(doc(firestore, colName, d.id));
            }
            await batch.commit();
        }

        summary[colName] = docs.length;
    }

    return { summary, archivedAt };
};

/** Counts root-level documents per collection to estimate the migration scope.
 *  Returns a record { collection: count }. Used by the admin UI to display a pre-migration summary.
 *  Uses listDocsForCollectionSafe so collections without list permission (e.g. system_settings)
 *  still get a sensible count via getDoc on known document IDs. */
export const getRootCollectionCounts = async (): Promise<Record<string, number>> => {
    const firestore = getFirestoreOrThrow();
    const counts: Record<string, number> = {};
    await Promise.all(ARCHIVABLE_COLLECTIONS.map(async (name) => {
        try {
            const docs = await listDocsForCollectionSafe(firestore, name);
            counts[name] = docs.length;
        } catch (e) {
            console.warn(`Could not count ${name}:`, e);
            counts[name] = -1;
        }
    }));
    return counts;
};


// Helper for deleteGameTable toast, not exported
const toast = (options: any) => {
    if (typeof window !== 'undefined') {
        console.log('Toast-like log (server-side):', options.title, options.description);
    }
};
