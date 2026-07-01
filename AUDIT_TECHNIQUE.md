# SEATUP — Audit technique

*Application de réservation des tables de jeu — Convention ASYNCONV (édition 5|5, 8–13 juillet 2026).*
*Projet : `C:\dev\app_SIT`. Audit réalisé sur l'état courant du code.*

---

## 1. Synthèse

SEATUP est une application web **Next.js 15 / React 18** adossée à **Firebase Firestore**, déployée sur **Vercel** (`seatup.asynconv.fr`). Elle gère, pour une convention de jeux de société sur 5 jours, la réservation des places aux tables par les participants (authentifiés via leur billet Billetweb), ainsi qu'un back-office d'organisation et un classement « Hall of Fame ».

Chiffres clés :

| Indicateur | Valeur |
|---|---|
| Lignes de code TS/TSX (total) | **≈ 12 500** |
| dont code applicatif (hors UI shadcn) | **≈ 9 050** |
| dont bibliothèque UI (shadcn/ui) | ≈ 3 460 |
| Couche données `data.ts` | 1 633 lignes, **63 fonctions** exportées |
| Page salon `page.tsx` | 907 lignes |
| Collections Firestore | **10** |
| Types/interfaces métier | 26 |
| Routes (pages) | 7 · Layouts : 2 · Routes API : 3 |
| Composants métier | 9 · Composants UI (shadcn) | 33 |
| Dépendances applicatives | 41 |

Maturité : **application complète et fonctionnelle**, prête pour la mise en production. Le cœur (chaîne configurations → slots → inscriptions) est abouti. Principale dette : un ancien modèle de tables (`gameTables`) encore présent en code mort.

---

## 2. Architecture & stack

- **Framework** : Next.js 15.2.8 (App Router), React 18.3, TypeScript.
- **Base de données** : Firebase Firestore (SDK client uniquement, **pas d'Admin SDK**). Sécurité par règles Firestore.
- **Authentification** :
  - *Participants* : connexion anonyme Firebase + identité métier (email + n° de billet).
  - *Admin* : compte email/mot de passe Firebase (`isAdmin = utilisateur non anonyme`).
- **UI** : Tailwind CSS + shadcn/ui (33 composants), icônes lucide-react.
- **PDF** : jsPDF (export du planning joueur, côté navigateur).
- **Billetweb** : API REST appelée côté serveur (clé secrète), écriture des participants côté client admin.
- **Hébergement** : Vercel (déploiement auto sur `git push`), domaine `seatup.asynconv.fr`.

---

## 3. Inventaire des routes

**Pages publiques / participant**

| Route | Fichier | Rôle |
|---|---|---|
| `/` | `app/page.tsx` (907 l.) | Salon : connexion, grille des tables par jour, inscription/désinscription, jauges, Mon Planning |
| `/hall-of-fame` | `app/hall-of-fame/page.tsx` (324 l.) | Classements par victoires et par points |
| `/login` | `app/login/page.tsx` | Connexion admin (back-office) |

**Back-office (groupe `(admin)`, protégé)**

| Route | Rôle |
|---|---|
| `/admin` | Tableau de bord (917 l.) : contrôle des phases, stats, repas, tension de la salle, import/simulation, archivage |
| `/admin/plannings` | Plannings de chaque participant inscrit |
| `/admin/billetweb` | Aperçu Billetweb + synchronisation des participants |
| `/admin/archives-2025` | Consultation figée de l'édition 2025 |

**Routes API (serveur)**

| Route | Rôle |
|---|---|
| `/api/sync-billetweb` | Récupère les participants depuis Billetweb (clé secrète) |
| `/api/sync-participants` | (héritée — écriture désormais faite côté client) |
| `/api/archive-2025` | (héritée — archivage désormais côté client) |

**Layouts** : `app/layout.tsx` (global) ; `app/(admin)/layout.tsx` (garde d'accès admin : redirige si utilisateur absent ou anonyme).

---

## 4. Inventaire des composants

**Composants métier (9)**

| Composant | Rôle |
|---|---|
| `admin/table-manager.tsx` (1 140 l.) | Conteneur d'onglets Configurations / Grille / Jeux *(contient du code hérité `gameTables` mort)* |
| `admin/config-manager.tsx` (356 l.) | CRUD des configurations (gabarits) |
| `admin/grille-manager.tsx` (401 l.) | Grille jeu × créneau, dépôt de configurations, remplissage journée/demi-journées |
| `admin/game-manager.tsx` (353 l.) | CRUD des jeux (catalogue) |
| `salon/table-seats.tsx` (211 l.) | Rendu SVG d'une table + sièges orientés (ronde/rectangle/double/triple) |
| `salon/slot-players-dialog.tsx` (217 l.) | Dialogue admin/animateur : joueurs + classement glisser-déposer |
| `salon/table-shape-icon.tsx` | Pictogramme de forme de table |
| `salon/salon-table-card.tsx` | Carte de table (variante héritée) |
| `layout/header.tsx` | En-tête (logo, lien Hall of Fame, connexion admin) |

**Composants UI** : 33 composants shadcn/ui (button, card, dialog, select, table, badge, etc.).

**Contextes / hooks / utilitaires** : `context/AuthContext.tsx` (auth Firebase + anonyme), `firebase/clientApp.ts`, `hooks/use-toast.ts`, `hooks/use-mobile.tsx`, `lib/utils.ts`, `lib/planning-pdf.ts`, `lib/games-2026-seed.ts`.

---

## 5. Modèle de données Firestore

10 collections :

| Collection | Contenu | Écriture |
|---|---|---|
| `games` | Catalogue des jeux (nom, description, image, min/max joueurs, n° de table) | admin |
| `configurations` | **Gabarits** réutilisables (jeu + places + forme + animation), sans date ni joueurs | admin |
| `slots` | Une configuration **posée** sur une ou plusieurs cellules (jour × session) ; statut ; « sous réserve » | création/suppression admin, **mise à jour authentifié** |
| `registrations` | Inscriptions (userId + slotId + statut) | tout utilisateur authentifié |
| `liste_participants` | Participants importés de Billetweb (nom, prénom, email, type de billet, empreinte du n° de billet) | admin |
| `gameResults` | Résultats de partie (classement ordonné, vainqueurs, nb joueurs) | authentifié |
| `system_settings` | Contrôle des phases d'inscription | admin |
| `animateurs` | Liste d'animateurs *(désormais peu utilisée — les configs pointent vers les billets)* | admin |
| `gameTables` | **Ancien modèle** de tables *(hérité, en voie de disparition)* | admin |
| `archives` | Édition 2025 figée (sous-collections) | admin |

**Principaux types** (26 au total) : `Game`, `TableConfig` (+ `animatorParticipantId`), `Slot` (`cells[]`, `status`, `conditional`), `Registration`, `Participant` (`ticketHash`), `GameResult` (`ranking[]`), `ManualRegistrationControls`, `BilletwebAttendee`.

Énumérations notables :
- `TicketType` : Stratège · Maréchal · Général · Colonel · Animateur · Staff · Invitation.
- `TableStatus` : Ouverte · EnAttente · EnCours · Terminee · Annulee.
- `SessionType` : Matin · Après-midi · Soir.
- `TableShape` : round · rectangle · double · triple.

---

## 6. Couche de données (`data.ts`)

63 fonctions, regroupables par domaine :

- **Jeux** : get/add/update/delete, `importGames2026`, `assignTableNumbersByPublicationOrder`.
- **Configurations** : get/add/update/delete (avec gestion du défaut unique).
- **Slots** : get/add/update/delete, `fillSlotsForCells`, `createSlotsFromGroups`, `setSlotStatus`, `confirmConditionalSlot`, `cancelSlot`.
- **Inscriptions** : `addSlotRegistration` (avec garde anti-conflit horaire), `removeRegistration`, `updateRegistrationStatus`.
- **Participants & connexion** : `getParticipants`, `getParticipantsByEmail`, `verifyParticipantCredentials`, `normalizeTicket`, `hashTicket` (SHA-256).
- **Billetweb** : `fetchBilletwebAttendees`, `syncParticipantsFromAttendees` (indexé par n° de billet), `mapBilletwebTicketToType`.
- **Résultats / classement** : `saveGameResult`, `getAllGameResults`, `clearAllGameResults`.
- **Phases d'inscription** : `getRegistrationControl`, `updateRegistrationControl`, `canRegisterBasedOnTicket`.
- **Outils admin** : `simulateTestRegistrations` (par grade), `clearAllRegistrations`, `wipePlanningData`, `migrate2025DataToArchives` + getters d'archives.

---

## 7. Fonctionnalités implémentées

**Côté participant**
- Connexion par email Billetweb + numéro de billet (empreinte SHA-256, jamais en clair).
- Grille par jour, par table, avec 3 créneaux ; sièges cliquables (vert/jaune/gris/marron + ★ animateur).
- Inscription/désinscription en un clic ; règle « pas deux tables au même créneau ».
- Ouverture des inscriptions par **vague de grade**.
- Parties « sous réserve » (conditionnelles), fusion visuelle des parties à la journée.
- Le soir = OFF (message dédié), jauges d'occupation Matin/Après-midi en temps réel.
- Mon Planning + export PDF ; notice PDF téléchargeable.
- Hall of Fame : classement par victoires et par points.

**Côté organisation (admin)**
- CRUD jeux / configurations / grille ; numérotation des tables par ordre du programme.
- Synchronisation Billetweb ; aperçu + diagnostic.
- Contrôle des phases d'inscription par grade.
- Statistiques d'inscription, décompte des repas, **tension de la salle** (demande théorique vs capacité).
- Gestion des joueurs par table + saisie du résultat (classement glisser-déposer, points par position).
- Droits délégués : un animateur gère **sa** table.
- Plannings par participant ; simulation de remplissage réaliste par grade ; remises à zéro ciblées ; archivage de l'édition précédente.

---

## 8. Complexité du système de réservation

C'est le cœur du logiciel. Sa complexité tient à plusieurs mécanismes imbriqués :

1. **Chaîne de modélisation à 4 niveaux** : Jeu → Configuration (gabarit) → Slot (gabarit posé sur des cellules jour×session) → Inscription. Découplage qui permet de réutiliser une config sur plusieurs créneaux.
2. **Granularité temporelle variable** : un slot peut couvrir 1 cellule (demi-journée), 2 (journée) ou plusieurs jours ; rendu fusionné (`colSpan`) côté grille et salon.
3. **Cycle de vie d'une partie** : Ouverte → En cours → Terminée, plus Annulée et le drapeau « sous réserve » (confirmer/annuler).
4. **Garde-fou d'enchaînement** : impossible de démarrer/confirmer une partie tant que la précédente sur la même table n'est pas terminée (`previousGameUnfinished`).
5. **Anti-conflit** : un joueur ne peut occuper deux tables sur la même demi-journée (vérifié à l'inscription, côté UI **et** couche données).
6. **Phases d'inscription par grade** : `canRegisterBasedOnTicket` ouvre les vagues (Stratège → Colonel), les invités/animateurs entrant en dernière vague.
7. **Animateur-joueur** : inscrit d'office via le lien config↔participant, compté au classement, avec droits de gestion sur sa table.
8. **Scoring** : classement complet par glisser-déposer → points par position (1er = N, puis −1), d'où deux classements (victoires / régularité).
9. **Jauges & tension** : calculs temps réel de capacité/occupation par demi-journée, et modèle de demande par grade (10/8/6/4 demi-journées).

Cette densité fonctionnelle se concentre logiquement dans `page.tsx` (907 l.) et `data.ts` (1 633 l.).

---

## 9. Sécurité

- **Séparation des rôles** : participants anonymes vs admin (compte réel). Garde d'accès sur `(admin)`.
- **Règles Firestore** via `isAdmin()` (`sign_in_provider != 'anonymous'`) : contenu d'administration en écriture admin uniquement ; `registrations` et la mise à jour de statut de slot / résultats ouverts aux authentifiés (pour l'auto-inscription et la délégation animateur) — compromis assumé pour une convention.
- **Secrets** : clés Billetweb dans `.env.local` (non versionné) ; `.env` sorti du suivi git ; clé Gemini inutilisée révoquée.
- **Connexion participant** : email + n° de billet haché (SHA-256), jamais stocké en clair.

---

## 10. Points d'attention / dette technique

- **Code hérité `gameTables`** : ancien modèle de tables encore présent (gros bloc mort dans `table-manager.tsx`, fonctions `*GameTable*`, composant `salon-table-card.tsx`). Candidat à suppression.
- **Collection `animateurs`** : devenue marginale (les configs pointent vers les billets Billetweb) ; le bouton « Importer les animateurs » est sans effet utile.
- **Une seule base Firestore** (pas de séparation dev/prod) : les actions de test impactent les données réelles.
- **Email = acheteur** : la connexion d'un participant dont le billet a été acheté par un tiers se fait avec l'email de la commande (limite Billetweb, gérée par le couple email + n° de billet).
- **Règles assouplies** sur `slots`(update) et `gameResults` : un utilisateur authentifié averti pourrait techniquement écrire hors interface (risque faible, réparable).
- **Absence de tests automatisés**.
- **Routes API héritées** (`sync-participants`, `archive-2025`) non utilisées mais conservées.

---

*Fin de l'audit.*
