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
