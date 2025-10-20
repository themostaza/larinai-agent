import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const supabase = await createClient();
    const { orgId } = await params;

    // Ottieni l'utente autenticato
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Verifica che l'utente sia owner dell'organizzazione
    const { data: userLink, error: linkError } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (linkError || !userLink || userLink.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Non hai i permessi per accedere a questa organizzazione' },
        { status: 403 }
      );
    }

    // Ottieni i dettagli dell'organizzazione
    const { data: organization, error: orgError } = await supabase
      .from('organization')
      .select('*')
      .eq('id', orgId)
      .single();

    if (orgError || !organization) {
      return NextResponse.json(
        { success: false, error: 'Organizzazione non trovata' },
        { status: 404 }
      );
    }

    // Ottieni tutti gli utenti dell'organizzazione
    const { data: users, error: usersError } = await supabase
      .from('link_organization_user')
      .select(`
        role,
        user_id
      `)
      .eq('organization_id', orgId);

    if (usersError) {
      console.error('Error fetching organization users:', usersError);
    }

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        createdAt: organization.created_at,
        settings: organization.settings,
        usersCount: users?.length || 0,
      },
    });

  } catch (error) {
    console.error('Error in organization GET API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const supabase = await createClient();
    const { orgId } = await params;

    // Ottieni l'utente autenticato
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Verifica che l'utente sia owner dell'organizzazione
    const { data: userLink, error: linkError } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (linkError || !userLink || userLink.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Non hai i permessi per modificare questa organizzazione' },
        { status: 403 }
      );
    }

    // Leggi il body della richiesta
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Il nome dell\'organizzazione è obbligatorio' },
        { status: 400 }
      );
    }

    if (name.trim().length > 50) {
      return NextResponse.json(
        { success: false, error: 'Il nome non può superare i 50 caratteri' },
        { status: 400 }
      );
    }

    // Aggiorna l'organizzazione
    const { data: updatedOrganization, error: updateError } = await supabase
      .from('organization')
      .update({ name: name.trim() })
      .eq('id', orgId)
      .select()
      .single();

    if (updateError || !updatedOrganization) {
      console.error('Error updating organization:', updateError);
      return NextResponse.json(
        { success: false, error: 'Errore nell\'aggiornamento dell\'organizzazione' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organization: {
        id: updatedOrganization.id,
        name: updatedOrganization.name,
        createdAt: updatedOrganization.created_at,
        settings: updatedOrganization.settings,
      },
    });

  } catch (error) {
    console.error('Error in organization PATCH API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const supabase = await createClient();
    const { orgId } = await params;

    // Ottieni l'utente autenticato
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Verifica che l'utente sia owner dell'organizzazione
    const { data: userLink, error: linkError } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (linkError || !userLink || userLink.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Non hai i permessi per eliminare questa organizzazione' },
        { status: 403 }
      );
    }

    // Elimina l'organizzazione (il database gestirà le foreign keys)
    const { error: deleteError } = await supabase
      .from('organization')
      .delete()
      .eq('id', orgId);

    if (deleteError) {
      console.error('Error deleting organization:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Errore nell\'eliminazione dell\'organizzazione' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Organizzazione eliminata con successo',
    });

  } catch (error) {
    console.error('Error in organization DELETE API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

