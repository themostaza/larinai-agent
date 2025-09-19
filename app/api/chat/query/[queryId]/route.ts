import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database/database';

// Client Supabase server-side con tipi
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: Recupera i dati di una query specifica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ queryId: string }> }
) {
  try {
    const { queryId } = await params;
    
    // Parse queryId: messageId-partIndex
    const parts = queryId.split('-');
    if (parts.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Invalid queryId format. Expected: messageId-partIndex' },
        { status: 400 }
      );
    }
    
    const messageId = parts[0];
    const partIndex = parseInt(parts[parts.length - 1]);
    
    if (isNaN(partIndex)) {
      return NextResponse.json(
        { success: false, error: 'Invalid partIndex in queryId' },
        { status: 400 }
      );
    }

    console.log(`Loading query data for messageId: ${messageId}, partIndex: ${partIndex}`);

    // Recupera il messaggio dal database
    const { data: message, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('message_id', messageId)
      .single();

    if (error || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // Estrai il messaggio completo
    let messageData;
    if (message.message_content && typeof message.message_content === 'object') {
      messageData = message.message_content as Record<string, unknown>;
    } else {
      messageData = {
        id: message.message_id,
        role: message.role,
        parts: message.parts || [],
      };
    }

    // Verifica che parts sia un array
    const parts_array = Array.isArray(messageData.parts) ? messageData.parts : [];
    
    // Verifica che il partIndex sia valido
    if (partIndex >= parts_array.length || partIndex < 0) {
      return NextResponse.json(
        { success: false, error: `Part index ${partIndex} not found in message` },
        { status: 404 }
      );
    }

    const queryPart = parts_array[partIndex];

    // Verifica che sia effettivamente una query SQL
    if (!queryPart || queryPart.type !== 'tool-read_sql_db') {
      return NextResponse.json(
        { success: false, error: 'Selected part is not a SQL query' },
        { status: 404 }
      );
    }

    // Recupera anche info sulla sessione
    let session = null;
    if (message.session_id) {
      const { data: sessionData } = await supabase
        .from('chat_sessions')
        .select('id, title, created_at')
        .eq('id', message.session_id)
        .single();
      session = sessionData;
    }

    return NextResponse.json({
      success: true,
      data: {
        queryId,
        messageId,
        partIndex,
        part: queryPart,
        message: {
          id: messageData.id,
          role: messageData.role,
          createdAt: messageData.createdAt,
          dbId: message.id // ID della riga nella tabella chat_messages
        },
        session: session ? {
          id: session.id,
          title: session.title,
          createdAt: session.created_at
        } : null
      }
    });

  } catch (error) {
    console.error('Error loading query data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
