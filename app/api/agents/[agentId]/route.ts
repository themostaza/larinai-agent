import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Ottieni dettagli agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Ottieni l'agent con i dati dell'organizzazione
    const { data: agent, error } = await supabase
      .from('agents')
      .select(`
        *,
        organization:organization_id (
          id,
          name
        )
      `)
      .eq('id', agentId)
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent non trovato' },
        { status: 404 }
      );
    }

    // Se l'agent non ha organization_id, permettiamo l'accesso (agent pubblico/personale)
    if (!agent.organization_id) {
      return NextResponse.json({
        success: true,
        agent,
        organization: null,
        userRole: null,
      });
    }

    // Verifica che l'utente abbia accesso all'organizzazione dell'agent
    const { data: userOrg } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', agent.organization_id)
      .single();

    if (!userOrg) {
      return NextResponse.json(
        { success: false, error: 'Non hai accesso a questo agent' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      agent,
      organization: agent.organization,
      userRole: userOrg.role,
    });

  } catch (error) {
    console.error('Error in get agent API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

// PUT: Aggiorna agent
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const { name, system_prompt, settings } = await request.json();

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Ottieni l'agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('organization_id')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent non trovato' },
        { status: 404 }
      );
    }

    // Se l'agent non ha organization_id, solo il proprietario può modificarlo
    // Per ora permettiamo la modifica (da implementare ownership check)
    if (!agent.organization_id) {
      // TODO: Implementare check del proprietario
      // Per ora permettiamo la modifica
    } else {
      // Verifica che l'utente sia admin o owner dell'organizzazione
      const { data: userOrg } = await supabase
        .from('link_organization_user')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', agent.organization_id)
        .single();

      if (!userOrg || (userOrg.role !== 'admin' && userOrg.role !== 'owner')) {
        return NextResponse.json(
          { success: false, error: 'Non hai permessi per modificare questo agent' },
          { status: 403 }
        );
      }
    }

    // Aggiorna l'agent
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        name,
        system_prompt,
        settings,
      })
      .eq('id', agentId);

    if (updateError) {
      console.error('Error updating agent:', updateError);
      return NextResponse.json(
        { success: false, error: 'Errore nell\'aggiornamento dell\'agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agent aggiornato con successo',
    });

  } catch (error) {
    console.error('Error in update agent API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

// DELETE: Elimina agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Ottieni l'agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('organization_id')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent non trovato' },
        { status: 404 }
      );
    }

    // Se l'agent non ha organization_id, solo il proprietario può eliminarlo
    // Per ora permettiamo l'eliminazione (da implementare ownership check)
    if (!agent.organization_id) {
      // TODO: Implementare check del proprietario
      // Per ora permettiamo l'eliminazione
    } else {
      // Verifica che l'utente sia admin o owner dell'organizzazione
      const { data: userOrg } = await supabase
        .from('link_organization_user')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', agent.organization_id)
        .single();

      if (!userOrg || (userOrg.role !== 'admin' && userOrg.role !== 'owner')) {
        return NextResponse.json(
          { success: false, error: 'Non hai permessi per eliminare questo agent' },
          { status: 403 }
        );
      }
    }

    // Elimina l'agent (CASCADE eliminerà anche i tool e le sessioni)
    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .eq('id', agentId);

    if (deleteError) {
      console.error('Error deleting agent:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Errore nell\'eliminazione dell\'agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agent eliminato con successo',
    });

  } catch (error) {
    console.error('Error in delete agent API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}
