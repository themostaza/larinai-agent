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

    console.log(`📊 [MY-QUERIES] Fetching queries for agent ${agentId} and user ${user.id}`);

    // Query per recuperare SOLO le query salvate dall'utente corrente per questo agent
    // JOIN: query_saved -> chat_messages -> chat_sessions -> agents
    // Filtro: chat_sessions.agent_id = agentId AND chat_sessions.user_id = user.id
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
      .eq('chat_messages.chat_sessions.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user queries:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch user queries',
        details: error.message
      }, { status: 500 });
    }

    // Recupera l'email dell'utente corrente
    const { data: userData } = await supabaseService.auth.admin.getUserById(user.id);
    const userEmail = userData?.user?.email || 'Utente sconosciuto';

    // Formatta le query
    const formattedQueries = queries?.map(query => {
      const chatMessages = query.chat_messages as unknown as {
        session_id: string | null;
        chat_sessions: {
          user_id: string | null;
          title: string | null;
        }
      };
      
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
        userId: user.id,
        userEmail: userEmail
      };
    }) || [];

    console.log(`📊 [MY-QUERIES] Returning ${formattedQueries.length} queries for user`);

    return NextResponse.json({
      success: true,
      queries: formattedQueries,
      total: formattedQueries.length
    });

  } catch (error) {
    console.error('Unexpected error in user queries API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

