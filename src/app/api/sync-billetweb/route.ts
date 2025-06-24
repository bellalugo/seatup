import { NextResponse } from 'next/server';
import { fetchBilletwebAttendees } from '@/lib/data';

export async function POST() {
  try {
    const attendees = await fetchBilletwebAttendees();
    
    return NextResponse.json({ 
      success: true, 
      attendees: attendees 
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
    console.error('[API Billetweb Fetch Error]', errorMessage);
    return NextResponse.json(
      { success: false, message: `Échec de la récupération depuis Billetweb : ${errorMessage}` },
      { status: 500 }
    );
  }
}
