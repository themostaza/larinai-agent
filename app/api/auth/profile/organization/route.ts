import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'ID organizzazione mancante' },
        { status: 400 }
      );
    }

    // Verifica che l'utente sia membro dell'organizzazione
    const { data: membership, error: membershipError } = await supabase
      .from('link_organization_user')
      .select('*')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { success: false, error: 'Non sei membro di questa organizzazione' },
        { status: 404 }
      );
    }

    // Conta quanti membri ha l'organizzazione
    const { data: membersCount, error: countError } = await supabase
      .from('link_organization_user')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    if (countError) {
      console.error('Error counting members:', countError);
    }

    // Se l'utente è l'ultimo membro dell'organizzazione, impedisci l'uscita
    // oppure elimina l'organizzazione (dipende dalla logica di business desiderata)
    // Per ora permettiamo l'uscita anche se è l'ultimo membro

    // Rimuovi l'utente dall'organizzazione
    const { error: deleteError } = await supabase
      .from('link_organization_user')
      .delete()
      .eq('user_id', user.id)
      .eq('organization_id', organizationId);

    if (deleteError) {
      console.error('Error leaving organization:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Errore nell\'uscita dall\'organizzazione' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Hai lasciato l\'organizzazione con successo',
    });

  } catch (error) {
    console.error('Error in leave organization API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

