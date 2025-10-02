import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../../../database/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const agentId = searchParams.get('agentId');

    // Query per recuperare tutte le chat sessions ordinate per updated_at DESC
    let query = supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at, metadata')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    // Se viene fornito un userId, filtra per quello
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Se viene fornito un agentId, filtra per quello
    if (agentId) {
      query = query.eq('agent_id', agentId);
      console.log(`Filtering sessions for agentId: ${agentId}`);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching chat sessions:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch chat sessions',
        details: error.message
      }, { status: 500 });
    }

    // Formatta le sessioni per l'uso nel frontend
    const formattedSessions = sessions?.map(session => ({
      id: session.id,
      title: session.title || 'Chat senza titolo',
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      metadata: session.metadata
    })) || [];

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
      total: formattedSessions.length
    });

  } catch (error) {
    console.error('Unexpected error in chat sessions API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST: Crea o verifica una sessione
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, agentId } = body;

    if (!sessionId || !agentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: sessionId, agentId' },
        { status: 400 }
      );
    }

    // Verifica se la sessione esiste già
    const { data: existingSession } = await supabase
      .from('chat_sessions')
      .select('id, agent_id')
      .eq('id', sessionId)
      .single();

    if (existingSession) {
      return NextResponse.json({
        success: true,
        sessionId: existingSession.id,
        action: 'existing',
        message: 'Session already exists'
      });
    }

    // Crea la nuova sessione
    const { data: newSession, error } = await supabase
      .from('chat_sessions')
      .insert({
        id: sessionId,
        agent_id: agentId,
        title: 'Nuova Conversazione',
        user_id: null, // Per ora senza autenticazione
      })
      .select()
      .single();

    if (error) {
      // Se è un errore di duplicato (race condition), va bene
      if (error.code === '23505') {
        return NextResponse.json({
          success: true,
          sessionId,
          action: 'existing',
          message: 'Session created by another request'
        });
      }
      
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      sessionId: newSession.id,
      action: 'created',
      message: 'Session created successfully',
      data: newSession
    });

  } catch (error) {
    console.error('Error in create session API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}