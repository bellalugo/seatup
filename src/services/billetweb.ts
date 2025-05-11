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
  if (!name || name.trim() === '') { // Gérer aussi les chaînes vides ou composées uniquement d'espaces
    console.log('[Billetweb Service] mapTicketName: Nom de billet non fourni ou vide, retour "Aucun".');
    return 'Aucun';
  }
  console.log(`[Billetweb Service] mapTicketName: Cartographie du nom de billet "${name}"`);
  if (/strat[eè]ge/i.test(name))   return 'Stratège';
  if (/mar[eé]chal/i.test(name))   return 'Maréchal';
  if (/g[eé]n[eé]ral/i.test(name)) return 'Général';
  
  console.warn(`[Billetweb Service] mapTicketName: Nom de billet non reconnu "${name}", retour "Aucun".`);
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
    firstname?: string; 
    lastname?: string;  
    email?: string;     
    ticket?: { name?: string }; 
    // Ajoutez d'autres champs que vous pourriez attendre de Billetweb ici
    // par exemple, si le nom du billet est sous un autre champ:
    // ticket_name?: string; 
  };

  try {
    const attendees = await callBilletweb<BilletwebAttendee[]>(
      `event/${BILLETWEB_EVENT}/attendees`
    );

    console.log(`[Billetweb Service] ${attendees.length} participant(s) brut(s) récupéré(s) de Billetweb.`);

    return attendees.map((a, index) => {
      const uniqueParticipantId = a.id || `${a.order_id}_${index}`;
      if (!a.id) {
        console.warn(`[Billetweb Service] Participant avec order_id ${a.order_id} n'a pas d'ID unique. ID généré : ${uniqueParticipantId}`);
      }

      // Logging des données brutes pour ce participant
      console.log(`[Billetweb Service] Traitement du participant brut (order_id: ${a.order_id}, id API: ${a.id || 'N/A'}) :`, JSON.stringify(a, null, 2));
      console.log(`  -> Nom de billet brut depuis API: ${a.ticket?.name}`);
      console.log(`  -> Nom de famille brut depuis API: ${a.lastname}`);
      console.log(`  -> Prénom brut depuis API: ${a.firstname}`);

      const mappedTicketType = mapTicketName(a.ticket?.name);
      const mappedNom = a.lastname || '';
      const mappedPrenom = a.firstname || '';
      const mappedEmail = a.email || '';
      
      const participantData: Participant = {
        id        : uniqueParticipantId,
        nom       : mappedNom,
        prenom    : mappedPrenom,
        email     : mappedEmail,     
        typeBillet: mappedTicketType, 
      };

      console.log(`[Billetweb Service] Données participant mappées (id: ${uniqueParticipantId}):`, JSON.stringify(participantData, null, 2));
      
      // Commentaire de l'ancien log spécifique
      // if (participantData.email && participantData.email.toLowerCase() === "jean-jacques.sonzini@orange.fr") {
      //   console.log(`[Billetweb Service] Données BRUTES pour jean-jacques.sonzini@orange.fr:`, JSON.stringify(a));
      //   console.log(`[Billetweb Service] Données MAPPEES pour jean-jacques.sonzini@orange.fr:`, JSON.stringify(participantData));
      // }
      
      return participantData;
    });
  } catch (error) {
    console.error("[Billetweb Service] Erreur lors de l'appel à l'API Billetweb réelle ou du mappage:", error);
    return []; 
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
