import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json();

    if (!email || !token) {
      return NextResponse.json(
        { success: false, error: 'Email e codice OTP sono obbligatori' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verifica OTP con Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || 'Codice OTP non valido' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      session: data.session,
      message: 'Email verificata con successo!',
    });

  } catch (error) {
    console.error('Error in verify OTP API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}


