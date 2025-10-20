import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface OrganizationLink {
  organization_id: string;
  role: string | null;
  organization: {
    id: string;
    name: string | null;
  };
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Ottieni le organizzazioni dell'utente
    const { data: organizationsData, error: orgsError } = await supabase
      .from('link_organization_user')
      .select(`
        organization_id,
        role,
        organization:organization_id (
          id,
          name
        )
      `)
      .eq('user_id', user.id);

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError);
      return NextResponse.json(
        { success: false, error: 'Errore nel caricamento delle organizzazioni' },
        { status: 500 }
      );
    }

    // Formatta le organizzazioni
    const organizations = (organizationsData as OrganizationLink[] || []).map((item) => ({
      id: item.organization.id,
      name: item.organization.name || 'Organizzazione senza nome',
      role: item.role || 'member',
    }));

    return NextResponse.json({
      success: true,
      profile: {
        id: user.id,
        email: user.email,
        organizations,
      },
    });

  } catch (error) {
    console.error('Error in profile API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Prima rimuovi l'utente da tutte le organizzazioni
    const { error: unlinkError } = await supabase
      .from('link_organization_user')
      .delete()
      .eq('user_id', user.id);

    if (unlinkError) {
      console.error('Error unlinking user from organizations:', unlinkError);
      // Continua comunque con l'eliminazione dell'utente
    }

    // Elimina l'utente dall'autenticazione
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Errore nell\'eliminazione dell\'account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Account eliminato con successo',
    });

  } catch (error) {
    console.error('Error in delete account API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

