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

    console.log(`📋 [AGENT-SESSIONS] Fetching ALL sessions for agent ${agentId}`);

    // Query per recuperare TUTTE le sessioni dell'agent
    const { data: sessions, error } = await supabaseService
      .from('chat_sessions')
      .select('id, title, created_at, updated_at, metadata, user_id')
      .eq('agent_id', agentId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching agent sessions:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch agent sessions',
        details: error.message
      }, { status: 500 });
    }

    // Recupera email per gli utenti specifici usando auth admin API
    // Filtra i null e assicura che siano stringhe
    const userIds = [...new Set(
      sessions?.map(s => s.user_id).filter((id): id is string => id !== null && id !== undefined) || []
    )];
    const userEmailMap = new Map<string, string>();

    // Recupera gli utenti uno per uno
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

    // Formatta le sessioni includendo l'email dell'utente
    const formattedSessions = sessions?.map(session => ({
      id: session.id,
      title: session.title || 'Chat senza titolo',
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      metadata: session.metadata,
      userId: session.user_id,
      userEmail: session.user_id ? userEmailMap.get(session.user_id) || 'Utente sconosciuto' : 'Utente sconosciuto'
    })) || [];

    console.log(`📋 [AGENT-SESSIONS] Returning ${formattedSessions.length} sessions`);

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
      total: formattedSessions.length
    });

  } catch (error) {
    console.error('Unexpected error in agent sessions API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

