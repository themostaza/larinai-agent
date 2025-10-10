import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
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
        { success: false, error: 'Accesso negato. Solo il super admin può accedere.' },
        { status: 403 }
      );
    }

    // Usa il client admin per recuperare tutti gli utenti
    const adminClient = createAdminClient();
    
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers();

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        { success: false, error: 'Errore nel recupero degli utenti' },
        { status: 500 }
      );
    }

    // Formatta i dati degli utenti
    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));

    return NextResponse.json({
      success: true,
      users: formattedUsers,
    });

  } catch (error) {
    console.error('Error in superadmin users API:', error);
    return NextResponse.json(
      { success: false, error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

