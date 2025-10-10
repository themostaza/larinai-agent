import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const supabase = await createClient();
    const { agentId } = await params;

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // Get agent info to verify access
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, organization_id')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent non trovato' },
        { status: 404 }
      );
    }

    // Verify user is admin of this organization
    if (!agent.organization_id) {
      return NextResponse.json(
        { success: false, error: 'Agent non associato a un\'organizzazione' },
        { status: 403 }
      );
    }

    const { data: userOrg } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', agent.organization_id)
      .single();

    if (!userOrg || userOrg.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Accesso negato - solo admin' },
        { status: 403 }
      );
    }

    // Get total sessions for this agent
    const { count: totalSessions } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId);

    // Get total messages for this agent (through sessions)
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('agent_id', agentId);

    const sessionIds = sessions?.map(s => s.id) || [];
    
    let totalMessages = 0;
    let lastActivityAt: string | null = null;
    
    if (sessionIds.length > 0) {
      const { count: messagesCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .in('session_id', sessionIds);
      
      totalMessages = messagesCount || 0;

      // Get last activity
      const { data: lastMessage } = await supabase
        .from('chat_messages')
        .select('created_at')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      lastActivityAt = lastMessage?.created_at || null;
    }

    // Get tool executions statistics
    const { data: messageIds } = await supabase
      .from('chat_messages')
      .select('id')
      .in('session_id', sessionIds);

    const messageIdsList = messageIds?.map(m => m.id) || [];
    
    let toolExecutions = {
      total: 0,
      successful: 0,
      failed: 0,
    };

    if (messageIdsList.length > 0) {
      const { count: totalExecs } = await supabase
        .from('tool_executions')
        .select('*', { count: 'exact', head: true })
        .in('message_id', messageIdsList);

      const { count: successfulExecs } = await supabase
        .from('tool_executions')
        .select('*', { count: 'exact', head: true })
        .in('message_id', messageIdsList)
        .eq('success', true);

      toolExecutions = {
        total: totalExecs || 0,
        successful: successfulExecs || 0,
        failed: (totalExecs || 0) - (successfulExecs || 0),
      };
    }

    // Calculate average messages per session
    const averageMessagesPerSession = totalSessions && totalSessions > 0
      ? totalMessages / totalSessions
      : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalSessions: totalSessions || 0,
        totalMessages,
        lastActivityAt,
        toolExecutions,
        averageMessagesPerSession,
      },
    });
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    return NextResponse.json(
      { success: false, error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

