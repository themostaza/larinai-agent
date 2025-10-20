import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await context.params;
    const { newName } = await request.json();

    if (!newName || !newName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Nome richiesto' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // Recupera l'agent originale
    const { data: originalAgent, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (fetchError || !originalAgent) {
      return NextResponse.json(
        { success: false, error: 'Agent non trovato' },
        { status: 404 }
      );
    }

    // Se l'agent non ha organization_id, non può essere duplicato (o gestisci diversamente)
    if (!originalAgent.organization_id) {
      return NextResponse.json(
        { success: false, error: 'Agent non associato a un\'organizzazione' },
        { status: 400 }
      );
    }

    // Verifica che l'utente sia admin o owner dell'organizzazione
    const { data: userOrg } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('organization_id', originalAgent.organization_id)
      .eq('user_id', user.id)
      .single();

    if (!userOrg || (userOrg.role !== 'admin' && userOrg.role !== 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Non hai permessi per duplicare questo agent' },
        { status: 403 }
      );
    }

    // Crea il duplicato (senza id e created_at, che verranno generati automaticamente)
    const { data: duplicatedAgent, error: duplicateError } = await supabase
      .from('agents')
      .insert({
        name: newName.trim(),
        organization_id: originalAgent.organization_id,
        system_prompt: originalAgent.system_prompt,
        settings: originalAgent.settings,
      })
      .select()
      .single();

    if (duplicateError || !duplicatedAgent) {
      console.error('Error duplicating agent:', duplicateError);
      return NextResponse.json(
        { success: false, error: 'Errore nella duplicazione dell\'agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: duplicatedAgent,
    });
  } catch (error) {
    console.error('Unexpected error in duplicate agent:', error);
    return NextResponse.json(
      { success: false, error: 'Errore del server' },
      { status: 500 }
    );
  }
}

