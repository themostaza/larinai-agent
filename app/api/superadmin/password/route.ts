import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    // Verifica autenticazione
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // Verifica che sia il super admin
    if (user.email !== 'paolo@neocode.dev') {
      return NextResponse.json(
        { success: false, error: 'Accesso negato. Solo il super admin può modificare le password.' },
        { status: 403 }
      );
    }

    // Leggi i parametri dalla richiesta
    const body = await request.json();
    const { userId, newPassword } = body;

    if (!userId || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'userId e newPassword sono obbligatori' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'La password deve essere di almeno 6 caratteri' },
        { status: 400 }
      );
    }

    // Usa il client admin per aggiornare la password
    const adminClient = createAdminClient();
    
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json(
        { success: false, error: 'Errore nell\'aggiornamento della password' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password aggiornata con successo',
    });

  } catch (error) {
    console.error('Error in superadmin password API:', error);
    return NextResponse.json(
      { success: false, error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

