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
function mapTicketName(name?: string): TicketType { // name can be undefined
  if (!name || name.trim() === '') { // Handle empty or whitespace-only strings as well
    // console.log('[Billetweb Service] mapTicketName: Nom de billet non fourni ou vide, retour "Aucun".');
    return 'Aucun';
  }
  const trimmedName = name.trim();
  // console.log(`[Billetweb Service] mapTicketName: Cartographie du nom de billet "${trimmedName}"`);
  if (/strat[eè]ge/i.test(trimmedName))   return 'Stratège';
  if (/mar[eé]chal/i.test(trimmedName))   return 'Maréchal';
  if (/g[eé]n[eé]ral/i.test(trimmedName)) return 'Général';
  
  console.warn(`[Billetweb Service] mapTicketName: Nom de billet non reconnu "${trimmedName}", retour "Aucun".`);
  return 'Aucun';                       // unrecognized ticket
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
          // nom remains NomMockX+1, which is intended for mock.
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
    name?: string;  // Billetweb API often uses 'name' for last name.
    email?: string;     
    ticket?: string; // Name of the ticket as defined in Billetweb (e.g., "Pass ASYNCONV - Stratège")
    ticket_id?: string; 
    rate_name?: string; 
    answers?: Array<{ 
        id?: string; 
        label?: string; 
        value?: string | string[] | number | boolean | null; 
        type?: string; 
    }>;
  };

  try {
    const attendees = await callBilletweb<BilletwebAttendee[]>(
      `event/${BILLETWEB_EVENT}/attendees`
    );

    console.log(`[Billetweb Service] ${attendees.length} participant(s) brut(s) récupéré(s) de Billetweb.`);

    return attendees.map((a, index) => {
      const uniqueParticipantId = a.id || `${a.order_id}_attendee_${index}`;
      
      if (index < 2 && !useMock) { // Log details for the first two non-mock participants
        console.log(`[Billetweb Service] Raw data for attendee ${index + 1} (ID: ${uniqueParticipantId}):`, JSON.stringify(a, null, 2));
        if (a.answers) {
          console.log(`[Billetweb Service] Answers for attendee ${index + 1} (ID: ${uniqueParticipantId}):`, JSON.stringify(a.answers, null, 2));
        }
      }
      
      let mappedNom = a.name || ''; // Default to Billetweb's 'name' field (likely last name)
      let mappedPrenom = a.firstname || '';
      let mappedEmail = a.email || '';
      
      if (a.answers && Array.isArray(a.answers)) {
        const nomAnswer = a.answers.find(ans => ans.label?.toLowerCase().includes('nom'));
        if (nomAnswer && typeof nomAnswer.value === 'string' && nomAnswer.value.trim() !== '') {
            mappedNom = nomAnswer.value.trim();
        }

        const prenomAnswer = a.answers.find(ans => ans.label?.toLowerCase().includes('prénom')); // Using 'prénom' with é
         if (prenomAnswer && typeof prenomAnswer.value === 'string' && prenomAnswer.value.trim() !== '') {
            mappedPrenom = prenomAnswer.value.trim();
        }
        
        const emailAnswer = a.answers.find(ans => ans.label?.toLowerCase().includes('email'));
        if (emailAnswer && typeof emailAnswer.value === 'string' && emailAnswer.value.trim() !== '') {
            mappedEmail = emailAnswer.value.trim();
        }
      }

      let ticketNameToMap: string | undefined = undefined;

      // Attempt 1: Look in answers for "Tarif"
      if (a.answers && Array.isArray(a.answers)) {
        const tarifAnswer = a.answers.find(ans => ans.label?.toLowerCase().includes('tarif'));
        if (tarifAnswer && typeof tarifAnswer.value === 'string' && tarifAnswer.value.trim() !== '') {
          ticketNameToMap = tarifAnswer.value.trim();
        }
      }

      // Attempt 2: Use direct 'ticket' field if not found in answers
      if (!ticketNameToMap && a.ticket && typeof a.ticket === 'string' && a.ticket.trim() !== '') {
        ticketNameToMap = a.ticket.trim();
      }

      // Attempt 3: Fallback to 'rate_name'
      if (!ticketNameToMap && a.rate_name && typeof a.rate_name === 'string' && a.rate_name.trim() !== '') {
        ticketNameToMap = a.rate_name.trim();
      }
      
      const mappedTicketType = mapTicketName(ticketNameToMap);
      
      const participantData: Participant = {
        id        : uniqueParticipantId,
        nom       : mappedNom,
        prenom    : mappedPrenom,
        email     : mappedEmail,     
        typeBillet: mappedTicketType, 
      };
      
      if (index < 5 || mappedTicketType === 'Aucun' || !mappedNom) { // Log more for problematic cases
        console.log(`[Billetweb Service DEBUG] For ID=${uniqueParticipantId}: API_Name='${a.name}', API_FirstName='${a.firstname}', API_Ticket='${a.ticket}', API_RateName='${a.rate_name}'`);
        console.log(`[Billetweb Service DEBUG] Mapped: nom='${mappedNom}', prenom='${mappedPrenom}', ticketToMap='${ticketNameToMap}', typeBillet='${mappedTicketType}'`);
      }
      
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
// This interface is defined in Billetweb context, could be different from global TicketInfo if needed
export interface BilletwebTicketInfo {
  id  : string;
  type: TicketType;
}


export async function getTicketInfo(userId: string): Promise<BilletwebTicketInfo | null> {
  const email = userId.trim().toLowerCase(); 

  const participants = await getParticipantsFromBilletweb(); 
  const match = participants.find(p => p.email.toLowerCase() === email);

  return match
    ? { id: match.id, type: match.typeBillet }
    : null;
}
