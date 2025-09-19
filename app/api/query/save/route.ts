import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database/database';

// Client Supabase server-side con tipi
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SaveQueryRequest {
  chatMessageId: string;
  query: string;
  title: string;
  body: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveQueryRequest = await request.json();
    const { chatMessageId, query, title, body: queryBody } = body;

    // Validazione input
    if (!chatMessageId || !query || !title) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Campi richiesti: chatMessageId, query, title' 
        },
        { status: 400 }
      );
    }

    console.log('Saving query:', { chatMessageId, title, queryLength: query.length });

    // Verifica che il messaggio esista
    const { data: messageExists } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('id', chatMessageId)
      .single();

    if (!messageExists) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Messaggio non trovato' 
        },
        { status: 404 }
      );
    }

    // Salva la query
    const { data, error } = await supabase
      .from('query_saved')
      .insert({
        chat_message_id: chatMessageId,
        query: query.trim(),
        title: title.trim(),
        body: queryBody as never
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving query:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: `Errore nel salvataggio: ${error.message}` 
        },
        { status: 500 }
      );
    }

    console.log('Query saved successfully:', data.id);

    return NextResponse.json({
      success: true,
      message: 'Query salvata tra i preferiti',
      data: {
        id: data.id,
        title: data.title,
        createdAt: data.created_at
      }
    });

  } catch (error) {
    console.error('Error in save query API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

// GET: Recupera le query salvate o controlla se una query specifica è salvata
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatMessageId = searchParams.get('chatMessageId');
    
    // Se viene fornito chatMessageId, controlla se quella query è già salvata
    if (chatMessageId) {
      const { data, error } = await supabase
        .from('query_saved')
        .select('id, title, created_at')
        .eq('chat_message_id', chatMessageId);

      if (error) {
        throw new Error(`Failed to check saved query: ${error.message}`);
      }

      return NextResponse.json({
        success: true,
        data: data || [],
        isSaved: (data && data.length > 0)
      });
    }
    
    // Altrimenti recupera tutte le query salvate
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data, error, count } = await supabase
      .from('query_saved')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch saved queries: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error in get saved queries API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}
