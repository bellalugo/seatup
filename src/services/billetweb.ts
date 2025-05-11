
// lib/billetweb.ts
import type { TicketType, Participant } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  CONFIGURATION                                                     */
/* ------------------------------------------------------------------ */

const BILLETWEB_USER   = process.env.BILLETWEB_USER;
const BILLETWEB_KEY    = process.env.BILLETWEB_KEY;
const BILLETWEB_EVENT  = process.env.BILLETWEB_EVENT_ID;

const useMock = !BILLETWEB_USER || !BILLETWEB_KEY || !BILLETWEB_EVENT;

if (useMock) {
  console.warn('[Billetweb Service] Variables d’environnement Billetweb (USER, KEY, ou EVENT_ID) manquantes ou incomplètes. Utilisation des données de démonstration (mock). Pour utiliser l\'API Billetweb réelle, veuillez configurer ces variables dans votre fichier .env et redémarrer le serveur.');
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                           */
/* ------------------------------------------------------------------ */
function mapTicketName(name?: string): TicketType { // name peut être undefined
  if (!name) return 'Aucun'; // Gérer le cas où name est undefined ou une chaîne vide
  if (/strat[eè]ge/i.test(name))   return 'Stratège';
  if (/mar[eé]chal/i.test(name))   return 'Maréchal';
  if (/g[eé]n[eé]ral/i.test(name)) return 'Général';
  return 'Aucun';                       // billet non reconnu
}

async function callBilletweb<T = any>(endpoint: string): Promise<T> {
  const url = `https://www.billetweb.fr/api/${endpoint}` +
              `?user=${BILLETWEB_USER}&key=${BILLETWEB_KEY}&version=1`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    throw new Error(`Billetweb API Error: ${res.status} ${res.statusText} for URL: ${url.replace(BILLETWEB_KEY || '', '***KEY***')}`);
  }
  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/*  1. RÉCUPÉRER TOUS LES PARTICIPANTS                                */
/* ------------------------------------------------------------------ */
export async function getParticipantsFromBilletweb(): Promise<Participant[]> {
  if (useMock) {
    const { mockUsers } = await import('@/lib/data');
    const mockedParticipants: Participant[] = Object.values(mockUsers).map((user, index) => {
      let prenom = `PrénomMock${index + 1}`;
      let nom = `NomMock${index + 1}`;
      
      const nameParts = user.name.split('(');
      const realNamePart = nameParts[0].trim();
      
      if (realNamePart) {
        const realNameWords = realNamePart.split(' ');
        if (realNameWords.length > 1) {
          prenom = realNameWords.slice(0, -1).join(' ');
          nom = realNameWords[realNameWords.length - 1];
        } else {
          prenom = realNameWords[0];
        }
      }

      return {
        id: user.id, 
        nom: nom,
        prenom: prenom,
        email: `${user.id.replace(/[^a-zA-Z0-9]/g, "")}mock@example.com`,
        typeBillet: user.ticketType
      };
    });
    console.log('[Billetweb Mock] Participants simulés retournés:', mockedParticipants);
    return mockedParticipants;
  }  

  console.log('[Billetweb Service] Tentative de récupération des participants depuis l\'API Billetweb réelle...');
  type BilletwebAttendee = {
    id?: string; 
    order_id: string;
    firstname?: string; // Rendre optionnel pour la vérification
    lastname?: string;  // Rendre optionnel pour la vérification
    email?: string;     // Rendre optionnel pour la vérification
    ticket?: { name?: string }; // Rendre optionnel pour la vérification
  };

  try {
    const attendees = await callBilletweb<BilletwebAttendee[]>(
      `event/${BILLETWEB_EVENT}/attendees`
    );

    return attendees.map((a, index) => {
      const uniqueParticipantId = a.id || `${a.order_id}_${index}`;
      if (!a.id) {
        console.warn(`[Billetweb Service] Participant avec order_id ${a.order_id} n'a pas d'ID unique. ID généré : ${uniqueParticipantId}`);
      }

      return {
        id        : uniqueParticipantId,
        nom       : a.lastname || '', // Valeur par défaut si undefined
        prenom    : a.firstname || '', // Valeur par défaut si undefined
        email     : a.email || '',     // Valeur par défaut si undefined
        typeBillet: mapTicketName(a.ticket?.name), // Utiliser le chaînage optionnel
      };
    });
  } catch (error) {
    console.error("[Billetweb Service] Erreur lors de l'appel à l'API Billetweb réelle:", error);
    throw new Error("Échec de la récupération des participants depuis l'API Billetweb.");
  }
}

/* ------------------------------------------------------------------ */
/*  2. OBTENIR LE TICKET D’UN UTILISATEUR PAR SON EMAIL (userId)      */
/* ------------------------------------------------------------------ */

export async function getTicketInfo(userId: string): Promise<TicketInfo | null> {
  const email = userId.trim().toLowerCase();

  const participants = await getParticipantsFromBilletweb(); 
  const match = participants.find(p => p.email.toLowerCase() === email);

  return match
    ? { id: match.id, type: match.typeBillet }
    : null;
}

/* ------------------------------------------------------------------ */
/*  TYPES LOCAUX                                                      */
/* ------------------------------------------------------------------ */

export interface TicketInfo {
  id  : string;
  type: TicketType;
}
