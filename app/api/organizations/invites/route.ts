import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DELETE: Rimuovi invito
export async function DELETE(request: NextRequest) {
  try {
    const { inviteId } = await request.json();

    if (!inviteId) {
      return NextResponse.json(
        { success: false, error: 'inviteId è obbligatorio' },
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

    // Ottieni l'organization_id dell'invito
    const { data: invite, error: inviteError } = await supabase
      .from('invited_users')
      .select('organization_id')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { success: false, error: 'Invito non trovato' },
        { status: 404 }
      );
    }

    // Verifica che l'invito abbia un organization_id
    if (!invite.organization_id) {
      return NextResponse.json(
        { success: false, error: 'Invito non associato a un\'organizzazione' },
        { status: 400 }
      );
    }

    // Verifica che l'utente sia admin dell'organizzazione
    const { data: userOrg, error: orgError } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', invite.organization_id)
      .single();

    if (orgError || !userOrg || userOrg.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Non hai permessi di admin per questa organizzazione' },
        { status: 403 }
      );
    }

    // Elimina l'invito
    const { error: deleteError } = await supabase
      .from('invited_users')
      .delete()
      .eq('id', inviteId);

    if (deleteError) {
      console.error('Error deleting invite:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Errore nell\'eliminazione dell\'invito' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invito eliminato con successo',
    });

  } catch (error) {
    console.error('Error in delete invite API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}
