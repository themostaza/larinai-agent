import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database/database';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * API per eseguire query salvate sul database oggetto di analisi
 * Questa API NON usa i dati salvati in Supabase, ma esegue sempre la query sul DB reale
 */
export async function POST(request: NextRequest) {
  try {
    const { chatMessageId, agentId } = await request.json();

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

    // Recupera la query salvata da Supabase (solo per ottenere la query SQL, non i dati)
    const { data: savedQuery, error: queryError } = await supabase
      .from('query_saved')
      .select('query, body, title')
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
    let purpose = savedQuery.title || 'Execute saved query';

    // Se abbiamo il body, proviamo a estrarre il database e purpose
    if (savedQuery.body && typeof savedQuery.body === 'object') {
      const bodyData = savedQuery.body as Record<string, unknown>;
      if (bodyData.input && typeof bodyData.input === 'object') {
        const inputData = bodyData.input as Record<string, unknown>;
        database = inputData.database as string;
        if (inputData.purpose) {
          purpose = inputData.purpose as string;
        }
      }
    }

    if (!queryToExecute) {
      return NextResponse.json(
        { success: false, error: 'No query found in saved record' },
        { status: 400 }
      );
    }

    // Esegui la query sul database oggetto di analisi tramite l'API esistente
    // aiLimit: -1 per ottenere TUTTI i dati disponibili (per download/export)
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    const queryResponse = await fetch(`${baseUrl}/api/query_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId,
        query: queryToExecute,
        database: database,
        purpose: purpose,
        aiLimit: -1  // Nessun limite per execute/download
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

    // Ritorna i dati dal database oggetto di analisi
    return NextResponse.json({
      success: true,
      data: {
        results: queryResult.data.results,
        rowCount: queryResult.data.rowCount,
        executionTime: queryResult.data.executionTime,
        truncated: queryResult.data.truncated,
        database: queryResult.data.database,
        query: queryResult.data.query,
        purpose: purpose,
        executedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error executing query:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

