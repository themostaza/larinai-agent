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

export async function POST(request: Request) {
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

    // Crea la nuova organizzazione
    const { data: newOrganization, error: orgError } = await supabase
      .from('organization')
      .insert({
        name: name.trim(),
      })
      .select()
      .single();

    if (orgError || !newOrganization) {
      console.error('Error creating organization:', orgError);
      return NextResponse.json(
        { success: false, error: 'Errore nella creazione dell\'organizzazione' },
        { status: 500 }
      );
    }

    // Collega l'utente all'organizzazione come owner
    const { error: linkError } = await supabase
      .from('link_organization_user')
      .insert({
        organization_id: newOrganization.id,
        user_id: user.id,
        role: 'owner',
      });

    if (linkError) {
      console.error('Error linking user to organization:', linkError);
      // Elimina l'organizzazione appena creata per mantenere la coerenza
      await supabase.from('organization').delete().eq('id', newOrganization.id);
      return NextResponse.json(
        { success: false, error: 'Errore nel collegamento dell\'utente all\'organizzazione' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organization: {
        id: newOrganization.id,
        name: newOrganization.name,
        role: 'owner',
        createdAt: newOrganization.created_at,
        settings: newOrganization.settings,
      },
    });

  } catch (error) {
    console.error('Error in organizations POST API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

