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
    console.log('[Billetweb Service] mapTicketName: Nom de billet non fourni ou vide, retour "Aucun".');
    return 'Aucun';
  }
  const trimmedName = name.trim();
  console.log(`[Billetweb Service] mapTicketName: Cartographie du nom de billet "${trimmedName}"`);
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
    id?: string; // Attendee's unique ID from Billetweb
    order_id: string; // Order ID
    firstname?: string; // Attendee's first name
    lastname?: string;  // Attendee's last name
    email?: string;     // Attendee's email
    ticket_name?: string; // Name of the ticket as defined in Billetweb (e.g., "Pass ASYNCONV - Stratège")
    ticket_id?: string; // ID of the ticket type
    rate_name?: string; // Specific rate name, could be more detailed than ticket_name
    // 'answers' field can contain custom form data collected during booking
    answers?: Array<{ 
        id?: string; // ID of the form field
        label?: string; // Label of the form field (e.g., "Nom", "Prénom", "Email", "Tarif")
        value?: string | string[] | number | boolean | null; // Value entered by the user
        type?: string; // Type of the form field
    }>;
    // Other fields that might be present in the Billetweb API response
    // barcode?: string;
    // price?: string;
    // date?: string; // Purchase date
  };

  try {
    // Use the correct endpoint as per the user's image: /api/event/:id/attendees
    const attendees = await callBilletweb<BilletwebAttendee[]>(
      `event/${BILLETWEB_EVENT}/attendees`
    );

    console.log(`[Billetweb Service] ${attendees.length} participant(s) brut(s) récupéré(s) de Billetweb.`);

    return attendees.map((a, index) => {
      // Use Billetweb's 'id' field directly if available, otherwise generate one.
      const uniqueParticipantId = a.id || `${a.order_id}_attendee_${index}`;
      if (!a.id) {
        console.warn(`[Billetweb Service] Participant avec order_id ${a.order_id} (index ${index}) n'a pas d'ID Billetweb unique. ID généré : ${uniqueParticipantId}`);
      }

      // Log the raw data for this specific attendee for better debugging
      // console.log(`[Billetweb Service] Traitement du participant brut (order_id: ${a.order_id}, billetweb_id: ${a.id || 'N/A'}) :`, JSON.stringify(a, null, 2));
      
      // Default to empty strings for names and email to avoid undefined issues
      let mappedNom = a.lastname || '';
      let mappedPrenom = a.firstname || '';
      let mappedEmail = a.email || '';
      
      // Override with answers if "Nom" or "Prénom" labels are present in custom fields
      if (a.answers && Array.isArray(a.answers)) {
        const nomAnswer = a.answers.find(ans => ans.label?.toLowerCase() === 'nom');
        if (nomAnswer && typeof nomAnswer.value === 'string' && nomAnswer.value.trim() !== '') {
            mappedNom = nomAnswer.value.trim();
            // console.log(`[Billetweb Service] Nom trouvé dans answers: "${mappedNom}" pour billetweb_id: ${uniqueParticipantId}`);
        }

        const prenomAnswer = a.answers.find(ans => ans.label?.toLowerCase() === 'prénom');
         if (prenomAnswer && typeof prenomAnswer.value === 'string' && prenomAnswer.value.trim() !== '') {
            mappedPrenom = prenomAnswer.value.trim();
            // console.log(`[Billetweb Service] Prénom trouvé dans answers: "${mappedPrenom}" pour billetweb_id: ${uniqueParticipantId}`);
        }
        
        const emailAnswer = a.answers.find(ans => ans.label?.toLowerCase() === 'email');
        if (emailAnswer && typeof emailAnswer.value === 'string' && emailAnswer.value.trim() !== '') {
            mappedEmail = emailAnswer.value.trim();
            // console.log(`[Billetweb Service] Email trouvé dans answers: "${mappedEmail}" pour billetweb_id: ${uniqueParticipantId}`);
        }
      }


      let ticketNameToMap: string | undefined = undefined;

      // Attempt 1: Look in answers for "Tarif" (user's request)
      if (a.answers && Array.isArray(a.answers)) {
        const tarifAnswer = a.answers.find(ans => ans.label?.toLowerCase().includes('tarif'));
        if (tarifAnswer && typeof tarifAnswer.value === 'string' && tarifAnswer.value.trim() !== '') {
          ticketNameToMap = tarifAnswer.value;
          // console.log(`[Billetweb Service] Type de billet trouvé dans answers.label contenant "tarif": "${ticketNameToMap}" pour billetweb_id: ${uniqueParticipantId}`);
        } else if (tarifAnswer) {
            // console.log(`[Billetweb Service] Réponse "tarif" trouvée mais valeur non chaîne ou vide:`, tarifAnswer.value, `pour billetweb_id: ${uniqueParticipantId}`);
        }
      }

      // Attempt 2: Look for a direct rate_name field (if not found in answers)
      if (!ticketNameToMap && a.rate_name && a.rate_name.trim() !== '') {
        ticketNameToMap = a.rate_name;
        // console.log(`[Billetweb Service] Type de billet trouvé dans rate_name: "${ticketNameToMap}" pour billetweb_id: ${uniqueParticipantId}`);
      }

      // Attempt 3: Fallback to ticket_name (if other methods fail)
      if (!ticketNameToMap && a.ticket_name && a.ticket_name.trim() !== '') {
        ticketNameToMap = a.ticket_name;
        // console.log(`[Billetweb Service] Type de billet utilisant ticket_name en fallback: "${ticketNameToMap}" pour billetweb_id: ${uniqueParticipantId}`);
      }
      
      // console.log(`[Billetweb Service] Valeur finale utilisée pour mapTicketName: "${ticketNameToMap || 'undefined'}" pour billetweb_id: ${uniqueParticipantId}`);
      const mappedTicketType = mapTicketName(ticketNameToMap);
      
      const participantData: Participant = {
        id        : uniqueParticipantId,
        nom       : mappedNom,
        prenom    : mappedPrenom,
        email     : mappedEmail,     
        typeBillet: mappedTicketType, 
      };

      // console.log(`[Billetweb Service] Données participant mappées (id: ${uniqueParticipantId}):`, JSON.stringify(participantData, null, 2));
      
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
  const email = userId.trim().toLowerCase(); // Assuming userId is the email for this function for now

  // If using mock data for getParticipantsFromBilletweb, this will also use mock.
  const participants = await getParticipantsFromBilletweb(); 
  const match = participants.find(p => p.email.toLowerCase() === email);

  return match
    ? { id: match.id, type: match.typeBillet }
    : null;
}

/* ------------------------------------------------------------------ */
/*  TYPES LOCAUX                                                      */
/* ------------------------------------------------------------------ */

// TicketInfo is already defined in lib/types.ts, no need to redefine unless it's specific to this service.
// For now, assume it's the same as the global one.
// export interface TicketInfo {
//   id  : string;
//   type: TicketType;
// }

