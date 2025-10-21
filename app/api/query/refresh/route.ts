import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database/database';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { chatMessageId, agentId, partIndex } = await request.json();

    console.log('🔄 [REFRESH] Request received:', { chatMessageId, agentId, partIndex });

    if (!chatMessageId) {
      return NextResponse.json(
        { success: false, error: 'chatMessageId is required' },
        { status: 400 }
      );
    }

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'agentId is required' },
        { status: 400 }
      );
    }

    // Prova prima dalla tabella query_saved (query salvate tra i preferiti)
    console.log('🔍 [REFRESH] Searching in query_saved for chatMessageId:', chatMessageId);
    const { data: savedQuery, error: savedQueryError } = await supabase
      .from('query_saved')
      .select('query, body')
      .eq('chat_message_id', chatMessageId)
      .single();

    console.log('📊 [REFRESH] query_saved result:', { 
      found: !!savedQuery, 
      error: savedQueryError?.message,
      query: savedQuery?.query 
    });

    let queryToExecute = null;
    let database = null;

    if (savedQuery) {
      // Query trovata tra i preferiti
      console.log('✅ [REFRESH] Query found in saved queries');
      queryToExecute = savedQuery.query;
      
      if (savedQuery.body && typeof savedQuery.body === 'object') {
        const bodyData = savedQuery.body as Record<string, unknown>;
        if (bodyData.input && typeof bodyData.input === 'object') {
          const inputData = bodyData.input as Record<string, unknown>;
          database = inputData.database as string;
        }
      }
    } else {
      // Query NON salvata, prendi dalla tabella chat_messages
      console.log('⚠️ [REFRESH] Not in saved queries, searching in chat_messages for message_id:', chatMessageId);
      const { data: chatMessage, error: chatMessageError } = await supabase
        .from('chat_messages')
        .select('parts')
        .eq('message_id', chatMessageId)
        .single();

      console.log('📨 [REFRESH] chat_messages result:', { 
        found: !!chatMessage,
        error: chatMessageError?.message,
        hasParts: !!(chatMessage?.parts)
      });

      if (chatMessage && chatMessage.parts) {
        // Cerca la part di tipo tool-read_sql_db
        const parts = chatMessage.parts as Array<{
          type: string;
          input?: { query?: string; database?: string };
          output?: { query?: string; database?: string };
        }>;
        
        console.log('🔍 [REFRESH] Parts found:', parts.length);
        console.log('📋 [REFRESH] Part types:', parts.map(p => p.type));
        
        // Se partIndex è fornito, usa quello specifico, altrimenti cerca il primo tool SQL
        let toolPart;
        if (typeof partIndex === 'number' && partIndex >= 0 && partIndex < parts.length) {
          console.log('🎯 [REFRESH] Using specific partIndex:', partIndex);
          toolPart = parts[partIndex];
        } else {
          console.log('🔍 [REFRESH] Searching for first SQL tool');
          toolPart = parts.find(p => p.type === 'tool-read_sql_db');
        }
        
        console.log('🔧 [REFRESH] SQL Tool part found:', { 
          found: !!toolPart, 
          type: toolPart?.type,
          partIndex: typeof partIndex === 'number' ? partIndex : 'auto',
          hasQuery: !!(toolPart?.input?.query || toolPart?.output?.query),
          hasDatabase: !!(toolPart?.input?.database || toolPart?.output?.database)
        });
        
        if (toolPart) {
          queryToExecute = toolPart.input?.query || toolPart.output?.query || null;
          database = toolPart.input?.database || toolPart.output?.database || null;
          console.log('✅ [REFRESH] Extracted from tool part:', { 
            queryLength: queryToExecute?.length, 
            database 
          });
        }
      } else {
        console.log('❌ [REFRESH] No chat message found or no parts available');
      }
    }

    if (!queryToExecute) {
      console.log('❌ [REFRESH] No query to execute - returning 404');
      return NextResponse.json(
        { success: false, error: 'Query not found in saved queries or chat messages' },
        { status: 404 }
      );
    }

    console.log('🚀 [REFRESH] Executing query:', { 
      queryLength: queryToExecute.length, 
      database,
      agentId 
    });

    // Esegui la query tramite l'API esistente
    // aiLimit: -1 per ottenere TUTTI i dati disponibili (per refresh completo)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      process.env.NEXTAUTH_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const queryResponse = await fetch(`${baseUrl}/api/query_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId,
        query: queryToExecute,
        database: database,
        purpose: 'Refresh data for saved query',
        aiLimit: -1  // Nessun limite per refresh
      })
    });

    const queryResult = await queryResponse.json();

    console.log('📊 [REFRESH] Query execution result:', { 
      success: queryResult.success,
      rowCount: queryResult.data?.rowCount,
      error: queryResult.error
    });

    if (!queryResult.success) {
      console.log('❌ [REFRESH] Query execution failed:', queryResult.error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to execute query: ' + queryResult.error 
        },
        { status: 500 }
      );
    }

    console.log('✅ [REFRESH] Successfully refreshed data, returning results');
    
    // Ritorna i nuovi dati
    return NextResponse.json({
      success: true,
      data: {
        results: queryResult.data.results,
        rowCount: queryResult.data.rowCount,
        executionTime: queryResult.data.executionTime,
        truncated: queryResult.data.truncated,
        refreshedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('💥 [REFRESH] Error refreshing query:', error);
    console.error('💥 [REFRESH] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
