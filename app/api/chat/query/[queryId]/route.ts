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

    console.log(`🔍 [QUERY-API] Loading query data for messageId: ${messageId}, partIndex: ${partIndex}`);

    // Recupera il messaggio dal database
    const { data: message, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('message_id', messageId)
      .single();

    console.log(`📥 [QUERY-API] Database query result:`, {
      found: !!message,
      error: error?.message,
      messageData: message ? {
        id: message.id,
        message_id: message.message_id,
        role: message.role,
        parts_type: typeof message.parts,
        parts_length: Array.isArray(message.parts) ? message.parts.length : 'not_array',
        message_content_type: typeof message.message_content
      } : null
    });

    if (error || !message) {
      console.error(`❌ [QUERY-API] Message not found:`, { messageId, error: error?.message });
      return NextResponse.json(
        { success: false, error: `Message not found: ${error?.message || 'Unknown error'}` },
        { status: 404 }
      );
    }

    // Estrai il messaggio completo
    let messageData;
    if (message.message_content && typeof message.message_content === 'object') {
      messageData = message.message_content as Record<string, unknown>;
      console.log(`📋 [QUERY-API] Using message_content structure`);
    } else {
      messageData = {
        id: message.message_id,
        role: message.role,
        parts: message.parts || [],
      };
      console.log(`📋 [QUERY-API] Using fallback structure`);
    }

    // Verifica che parts sia un array
    const parts_array = Array.isArray(messageData.parts) ? messageData.parts : [];
    
    console.log(`🔢 [QUERY-API] Parts analysis:`, {
      parts_array_length: parts_array.length,
      partIndex,
      isValidIndex: partIndex >= 0 && partIndex < parts_array.length,
      parts_types: parts_array.slice(Math.max(0, partIndex - 2), partIndex + 3).map((part, idx) => ({
        index: Math.max(0, partIndex - 2) + idx,
        type: part?.type || 'unknown',
        isTarget: (Math.max(0, partIndex - 2) + idx) === partIndex
      }))
    });
    
    // Verifica che il partIndex sia valido
    if (partIndex >= parts_array.length || partIndex < 0) {
      console.error(`❌ [QUERY-API] Invalid part index:`, {
        partIndex,
        parts_length: parts_array.length,
        available_indices: `0-${parts_array.length - 1}`
      });
      return NextResponse.json(
        { success: false, error: `Part index ${partIndex} not found in message (available: 0-${parts_array.length - 1})` },
        { status: 404 }
      );
    }

    const queryPart = parts_array[partIndex];

    console.log(`🎯 [QUERY-API] Target part analysis:`, {
      partIndex,
      part_exists: !!queryPart,
      part_type: queryPart?.type,
      expected_type: 'tool-read_sql_db',
      is_correct_type: queryPart?.type === 'tool-read_sql_db'
    });

    // Verifica che sia effettivamente una query SQL
    if (!queryPart || queryPart.type !== 'tool-read_sql_db') {
      console.error(`❌ [QUERY-API] Invalid part type:`, {
        partIndex,
        found_type: queryPart?.type,
        expected_type: 'tool-read_sql_db'
      });
      return NextResponse.json(
        { success: false, error: `Selected part is not a SQL query (found: ${queryPart?.type || 'undefined'})` },
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

    console.log(`✅ [QUERY-API] Successfully loaded query data:`, {
      queryId,
      messageId,
      partIndex,
      part_type: queryPart.type,
      has_session: !!session
    });

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
