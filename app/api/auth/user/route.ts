import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });

  } catch (error) {
    console.error('Error in user API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}


