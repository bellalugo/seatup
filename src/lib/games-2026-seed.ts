import type { GameInput } from './types';

/**
 * Jeux de l'édition 2026 (ASYNCONV 5|5), extraits de la page programme
 * https://www.asynconv.fr/programme/ et de chaque fiche jeu.
 * Le nombre de joueurs (nbre_min / nbre_max) provient des paragraphes
 * « Configuration ASYNCONV » de chaque fiche.
 *
 * imageUrl : vignette de couverture issue des cartes du programme (400x210).
 *
 * Utilisé par importGames2026() (src/lib/data.ts) pour un import en un clic
 * depuis la page admin. L'import est idempotent : un jeu déjà présent (par nom)
 * n'est pas recréé.
 */
export const GAMES_2026_SEED: GameInput[] = [
  {
    nom: "WINGED HUSSARS AND COSSACKS",
    description: "Jeu euro historique avec contrôle de zone, construction de deck et développement de personnage, ancré dans les confins de la République des Deux Nations à la fin du XVIe…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/06/Publication_17_WHC_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/winged-hussars-and-cossacks/",
    nbre_min: 2,
    nbre_max: 6,
  },
  {
    nom: "MEGA EMPIRES",
    description: "Mega Empires est le plus grand jeu de plateau au monde, une expérience de grande stratégie, parfaitement modulable de 3 à 18 joueurs, où les civilisations s’élèvent,…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/04/Publication_13_MegaEmpires_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/mega-empires-2/",
    nbre_min: 3,
    nbre_max: 18,
  },
  {
    nom: "RES PUBLICA ROMANA",
    description: "Res Publica Romana est un jeu concentrant 250 ans d’histoire politique durant la République de Rome, de la 1ère Guerre Punique (264 avant J.C.) jusqu’à l’assassinat de…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/03/Publication_11_RPR_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/res-publica-romana/",
    nbre_min: 4,
    nbre_max: 5,
  },
  {
    nom: "MARE NOSTRUM",
    description: "Dans Mare Nostrum, vous prenez la tête de l’une des civilisations qui ont bercé l’antiquité méditerranéenne. Vous démarrez avec 3 provinces et quelques bâtiments (cités,…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/03/Publication_09_MN_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/mare-nostrum-2/",
    nbre_min: 5,
    nbre_max: 5,
  },
  {
    nom: "JOHN COMPANY",
    description: "Dans JOHN COMPANY, chaque joueur incarne une famille ambitieuse qui tente d’utiliser la Compagnie britannique des Indes orientales à des fins personnelles. Le jeu…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/03/Publication_04_JohnCie_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/john-company-2/",
    nbre_min: 3,
    nbre_max: 5,
  },
  {
    nom: "COMAO",
    description: "Conçu à l’origine par un pilote militaire passionné de jeux de guerre et de stratégie, COMAO (Composite Air Operation) vous place dans le rôle d’un commandant de…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/03/Publication_03b_COMAO_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/comao/",
    nbre_min: 2,
    nbre_max: 2,
  },
  {
    nom: "WUNDERWAFFEN",
    description: "WUNDERWAFFEN, les « armes miracles », se déroule pendant la dernière année de la Seconde Guerre mondiale, lorsque le débarquement en Normandie ouvre la voie vers Berlin…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/06/Publication_16_WUNDERWAFFEN_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/wunderwaffen/",
    nbre_min: 2,
    nbre_max: 4,
  },
  {
    nom: "BRETWALDA",
    description: "L’histoire de Bretwalda se déroule à la suite de la mort du roi Offa de Mercia en 796 après J.-C., ouvrant la voie à une querelle pour le trône entre les quatre plus…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/04/Publication_14_Bretwalda_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/bretwalda/",
    nbre_min: 3,
    nbre_max: 4,
  },
  {
    nom: "HERE I STAND",
    description: "Here I Stand: Wars of the Reformation 1517-1555 est le premier jeu depuis plus de 25 ans à traiter des conflits politiques et religieux du début du XVIe siècle en…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/03/Publication_10_HiS_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/here-i-stand-2/",
    nbre_min: 4,
    nbre_max: 6,
  },
  {
    nom: "IMPERIAL ELEGY",
    description: "Imperial Elegy est un jeu piloté par des cartes (card driven) qui mêle diplomatie, guerre et politique. Les joueurs prennent le contrôle de l’une des six grandes…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/03/Publication_08_IE_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/imperial-elegy/",
    nbre_min: 5,
    nbre_max: 5,
  },
  {
    nom: "AION, LES AGES DE CONQUÊTE",
    description: "Florian sera présent avec son nouveau jeu AION, LES AGES DE CONQUÊTE. AION sera le deuxième jeu de la série CO³ après DEFCON 1, dont il reprend le moteur, mais avec un…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/03/Publication_02_Aion_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/aion-les-ages-de-conquete/",
    nbre_min: 3,
    nbre_max: 5,
  },
  {
    nom: "IMPERIAL BORDERS",
    description: "Avec l’abdication de Napoléon, les grandes puissances européennes convoquent le Congrès de Vienne en Autriche. Elles espèrent pouvoir redessiner les frontières…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/02/Publication_01b_Imperial_Borders_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/imperial-borders-the-congress-of-vienna/",
    nbre_min: 6,
    nbre_max: 6,
  },
  {
    nom: "MARCHES & BATAILLES",
    description: "Marches & Batailles ! est un wargame napoléonien au niveau opérationnel qui se joue sur une carte historique imprimée sur tissu avec des pions en bois. Comme ce jeu est…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/06/Publication_15_MB_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/marches-batailles/",
    nbre_min: 1,
    nbre_max: 3,
  },
  {
    nom: "EUROPA UNIVERSALIS",
    description: "EUROPA UNIVERSALIS est un jeu de stratégie qui offre aux joueurs une expérience de jeu 4X dans un cadre historique. Grâce à l’utilisation stratégique des cartes et à une…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/03/Publication_12_EU_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/europa-universalis-2/",
    nbre_min: 3,
    nbre_max: 5,
  },
  {
    nom: "DEFCON 1",
    description: "DEFCON 1 se déroule pendant la guerre froide, de 1950 à 1990. Toutes les cartes et technologies sont basées sur des faits historiques. Le gameplay varie en fonction du…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/03/Publication_05_D1_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/defcon-1/",
    nbre_min: 4,
    nbre_max: 5,
  },
  {
    nom: "LA GUERRE DE CENT ANS",
    description: "La guerre de Cent Ans (1337-1453) est un conflit d’une grande complexité par sa durée, les nombreux acteurs impliqués et la succession de guerres et de trêves sur une…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/03/Publication_07_G100_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/la-guerre-de-cent-ans-2/",
    nbre_min: 4,
    nbre_max: 4,
  },
  {
    nom: "FIEF FRANCE, L’UNIQUE !",
    description: "Cette année, une table de FIEF France sera proposée pour des parties à 5 ou 6 joueurs, uniquement ! FIEF™ France est la nouvelle édition du mythique FIEF™. Dans le…",
    imageUrl: "https://www.asynconv.fr/wp-content/uploads/2026/03/Publication_02_FIEF_France_ASYNCONV-400x210.jpg",
    asynconvURL: "https://www.asynconv.fr/fief-france/",
    nbre_min: 5,
    nbre_max: 6,
  },
];
