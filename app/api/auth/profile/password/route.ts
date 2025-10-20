import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
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
    const { currentPassword, newPassword } = body;

    // Validazione input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Password attuale e nuova password sono obbligatorie' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'La nuova password deve essere di almeno 8 caratteri' },
        { status: 400 }
      );
    }

    // Verifica la password attuale tentando il sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json(
        { success: false, error: 'Password attuale non corretta' },
        { status: 401 }
      );
    }

    // Aggiorna la password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

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
    console.error('Error in change password API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

