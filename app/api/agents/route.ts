import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST: Crea nuovo agent
export async function POST(request: NextRequest) {
  try {
    const { organizationId, name, system_prompt } = await request.json();

    if (!organizationId || !name) {
      return NextResponse.json(
        { success: false, error: 'organizationId e name sono obbligatori' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Verifica che l'utente sia admin o owner dell'organizzazione
    const { data: userOrg, error: orgError } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg || (userOrg.role !== 'admin' && userOrg.role !== 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Non hai permessi per creare agent in questa organizzazione' },
        { status: 403 }
      );
    }

    // Crea l'agent
    const { data: agent, error: insertError } = await supabase
      .from('agents')
      .insert({
        organization_id: organizationId,
        name,
        system_prompt: system_prompt || 'Sei un assistente AI utile e professionale.',
        settings: {},
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating agent:', insertError);
      return NextResponse.json(
        { success: false, error: 'Errore nella creazione dell\'agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent,
      message: 'Agent creato con successo',
    });

  } catch (error) {
    console.error('Error in create agent API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organizationId è obbligatorio' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Ottieni l'utente autenticato
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Verifica che l'utente appartenga all'organizzazione
    const { data: userOrg, error: orgError } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg) {
      return NextResponse.json(
        { success: false, error: 'Non hai accesso a questa organizzazione' },
        { status: 403 }
      );
    }

    // Query per ottenere tutti gli agent dell'organizzazione
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, name, created_at, settings')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching agents:', error);
      return NextResponse.json(
        { success: false, error: 'Errore nel recupero degli agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agents: agents || [],
      total: agents?.length || 0,
      userRole: userOrg.role,
    });

  } catch (error) {
    console.error('Error in agents API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}


