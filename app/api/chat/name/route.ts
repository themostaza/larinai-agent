import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database/database';

// Client Supabase server-side con tipi
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Usa anon key dato che non abbiamo RLS attive
);

interface UpdateChatNameRequest {
  title: string;
  sessionId?: string; // Opzionale, se non fornito dovremo prenderlo dal contesto
}

// POST: Aggiorna il titolo della chat corrente
export async function POST(request: NextRequest) {
  try {
    const body: UpdateChatNameRequest = await request.json();
    
    if (!body.title || body.title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or empty title' },
        { status: 400 }
      );
    }

    // Pulisci e limita il titolo
    const cleanTitle = body.title.trim().slice(0, 100); // Limite di sicurezza più ampio

    // Per ora, prendiamo l'ultima sessione creata se non viene fornito sessionId
    // In futuro potremmo passare il sessionId dal contesto della chat
    let sessionId = body.sessionId;
    
    if (!sessionId) {
      // Trova l'ultima sessione creata (presumibilmente quella corrente)
      const { data: latestSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionError || !latestSession) {
        return NextResponse.json(
          { success: false, error: 'No active session found' },
          { status: 404 }
        );
      }

      sessionId = latestSession.id;
    }

    console.log(`🏷️ [NAME-API] Updating title for session ${sessionId} to: "${cleanTitle}"`);

    // Aggiorna il titolo della sessione
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ 
        title: cleanTitle,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select();

    if (error) {
      console.error('🏷️ [NAME-API] Error updating session title:', error);
      return NextResponse.json(
        { success: false, error: `Failed to update title: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    console.log(`🏷️ [NAME-API] Title updated successfully for session ${sessionId}`);

    return NextResponse.json({
      success: true,
      title: cleanTitle,
      sessionId: sessionId,
      message: 'Chat title updated successfully'
    });

  } catch (error) {
    console.error('🏷️ [NAME-API] Error in update chat name API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// GET: Ottieni il titolo corrente di una sessione
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    const { data: session, error } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      title: session.title,
      createdAt: session.created_at,
      updatedAt: session.updated_at
    });

  } catch (error) {
    console.error('🏷️ [NAME-API] Error in get session title API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
