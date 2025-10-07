import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Ottieni l'utente autenticato
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Query per ottenere tutte le organizzazioni a cui l'utente appartiene
    // con il suo ruolo
    const { data: userOrganizations, error } = await supabase
      .from('link_organization_user')
      .select(`
        role,
        organization:organization_id (
          id,
          name,
          created_at,
          settings
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching organizations:', error);
      return NextResponse.json(
        { success: false, error: 'Errore nel recupero delle organizzazioni' },
        { status: 500 }
      );
    }

    // Formatta i dati per il frontend
    const organizations = userOrganizations?.map(item => ({
      id: item.organization?.id,
      name: item.organization?.name,
      role: item.role,
      createdAt: item.organization?.created_at,
      settings: item.organization?.settings,
    })) || [];

    return NextResponse.json({
      success: true,
      organizations,
      total: organizations.length,
    });

  } catch (error) {
    console.error('Error in organizations API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}


