import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database/database';

// Client Supabase server-side con tipi
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Usa anon key dato che non abbiamo RLS attive
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

    console.log(`Loading chat history for session: ${sessionId}`);

    // Controlla se la sessione esiste
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({
        success: true,
        sessionExists: false,
        messages: []
      });
    }

    // Carica i messaggi della sessione
    const { data: messages, error } = await supabase
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
          savedToDb: true // Marca come già salvato nel DB
        };
      }
      
      // Fallback al formato vecchio
      return {
        id: msg.message_id,
        role: msg.role,
        parts: msg.parts || [],
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
