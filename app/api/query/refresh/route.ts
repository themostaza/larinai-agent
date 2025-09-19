import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database/database';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { chatMessageId } = await request.json();

    if (!chatMessageId) {
      return NextResponse.json(
        { success: false, error: 'chatMessageId is required' },
        { status: 400 }
      );
    }

    // Recupera la query salvata
    const { data: savedQuery, error: queryError } = await supabase
      .from('query_saved')
      .select('query, body')
      .eq('chat_message_id', chatMessageId)
      .single();

    if (queryError || !savedQuery) {
      return NextResponse.json(
        { success: false, error: 'Saved query not found' },
        { status: 404 }
      );
    }

    // Estrai la query SQL e il database dalla configurazione salvata
    const queryToExecute = savedQuery.query;
    let database = null;

    // Se abbiamo il body, proviamo a estrarre il database
    if (savedQuery.body && typeof savedQuery.body === 'object') {
      const bodyData = savedQuery.body as Record<string, unknown>;
      if (bodyData.input && typeof bodyData.input === 'object') {
        const inputData = bodyData.input as Record<string, unknown>;
        database = inputData.database as string;
      }
    }

    if (!queryToExecute) {
      return NextResponse.json(
        { success: false, error: 'No query found in saved record' },
        { status: 400 }
      );
    }

    // Esegui la query tramite l'API esistente
    const queryResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/query_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: queryToExecute,
        database: database,
        purpose: 'Refresh data for saved query'
      })
    });

    const queryResult = await queryResponse.json();

    if (!queryResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to execute query: ' + queryResult.error 
        },
        { status: 500 }
      );
    }

    // Ritorna i nuovi dati
    return NextResponse.json({
      success: true,
      data: {
        results: queryResult.results,
        rowCount: queryResult.rowCount,
        executionTime: queryResult.executionTime,
        truncated: queryResult.truncated,
        refreshedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error refreshing query:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
