import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/database/database';

// Client Supabase server-side con service role
const supabaseService = createServiceClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Carica la cronologia dei messaggi di una sessione
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

    // Ottieni l'utente autenticato
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    console.log(`Loading chat history for session: ${sessionId}, user: ${user.id}`);

    // Controlla se la sessione esiste e appartiene all'utente
    const { data: session } = await supabaseService
      .from('chat_sessions')
      .select('id, title, created_at, user_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({
        success: true,
        sessionExists: false,
        messages: []
      });
    }

    // Verifica che la sessione appartenga all'utente corrente
    if (session.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Non hai accesso a questa sessione' },
        { status: 403 }
      );
    }

    // Carica i messaggi della sessione
    const { data: messages, error } = await supabaseService
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load messages: ${error.message}`);
    }

    // Converti i messaggi nel formato useChat
    const chatMessages = messages?.map(msg => {
      // Se abbiamo il message_content completo, usalo
      if (msg.message_content && typeof msg.message_content === 'object') {
        return {
          ...(msg.message_content as Record<string, unknown>),
          thumb_up: msg.thumb_up,
          thumb_down: msg.thumb_down,
          savedToDb: true // Marca come già salvato nel DB
        };
      }
      
      // Fallback al formato vecchio
      return {
        id: msg.message_id,
        role: msg.role,
        parts: msg.parts || [],
        thumb_up: msg.thumb_up,
        thumb_down: msg.thumb_down,
        savedToDb: true // Marca come già salvato nel DB
      };
    }) || [];

    console.log(`Loaded ${chatMessages.length} messages for session ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionExists: true,
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.created_at
      },
      messages: chatMessages,
      messageCount: chatMessages.length
    });

  } catch (error) {
    console.error('Error loading chat history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
