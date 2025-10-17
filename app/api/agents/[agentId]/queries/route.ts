import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { Database } from '../../../../../database/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseService = createServiceClient<Database>(supabaseUrl, supabaseKey);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    // Ottieni l'utente autenticato
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    console.log(`📊 [AGENT-QUERIES] Fetching ALL queries for agent ${agentId}`);

    // Query per recuperare TUTTE le query salvate dell'agent
    // JOIN: query_saved -> chat_messages -> chat_sessions -> agents
    const { data: queries, error } = await supabaseService
      .from('query_saved')
      .select(`
        id,
        title,
        query,
        created_at,
        body,
        chart_kpi,
        chat_message_id,
        chat_messages!inner (
          session_id,
          chat_sessions!inner (
            agent_id,
            user_id,
            title
          )
        )
      `)
      .eq('chat_messages.chat_sessions.agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching agent queries:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch agent queries',
        details: error.message
      }, { status: 500 });
    }

    // Estrai gli user_id unici
    const userIds = [...new Set(
      queries?.map(q => {
        const chatMessages = q.chat_messages as unknown as {
          chat_sessions: { user_id: string | null }
        };
        return chatMessages?.chat_sessions?.user_id;
      }).filter((id): id is string => id !== null && id !== undefined) || []
    )];

    const userEmailMap = new Map<string, string>();

    // Recupera le email degli utenti
    for (const userId of userIds) {
      try {
        const { data: userData } = await supabaseService.auth.admin.getUserById(userId);
        if (userData?.user?.email) {
          userEmailMap.set(userId, userData.user.email);
        }
      } catch (err) {
        console.error(`Error fetching user ${userId}:`, err);
      }
    }

    // Formatta le query
    const formattedQueries = queries?.map(query => {
      const chatMessages = query.chat_messages as unknown as {
        session_id: string | null;
        chat_sessions: {
          user_id: string | null;
          title: string | null;
        }
      };
      
      const userId = chatMessages?.chat_sessions?.user_id;
      const sessionTitle = chatMessages?.chat_sessions?.title;

      return {
        id: query.id,
        title: query.title || 'Query senza titolo',
        query: query.query,
        createdAt: query.created_at,
        body: query.body,
        chartKpi: query.chart_kpi,
        chatMessageId: query.chat_message_id,
        sessionId: chatMessages?.session_id,
        sessionTitle: sessionTitle,
        userId: userId,
        userEmail: userId ? userEmailMap.get(userId) || 'Utente sconosciuto' : 'Utente sconosciuto'
      };
    }) || [];

    console.log(`📊 [AGENT-QUERIES] Returning ${formattedQueries.length} queries`);

    return NextResponse.json({
      success: true,
      queries: formattedQueries,
      total: formattedQueries.length
    });

  } catch (error) {
    console.error('Unexpected error in agent queries API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

