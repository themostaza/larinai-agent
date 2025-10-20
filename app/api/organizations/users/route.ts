import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// GET: Ottieni tutti gli utenti di un'organizzazione (attivi + invitati)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organizationId è obbligatorio' },
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

    // Verifica che l'utente sia admin dell'organizzazione
    const { data: userOrg, error: userOrgError } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (userOrgError || !userOrg || (userOrg.role !== 'admin' && userOrg.role !== 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Non hai permessi di admin per questa organizzazione' },
        { status: 403 }
      );
    }

    // Query per ottenere tutti gli utenti attivi dell'organizzazione
    const { data: orgUsers, error: orgUsersError } = await supabase
      .from('link_organization_user')
      .select('user_id, role, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (orgUsersError) {
      console.error('Error fetching organization users:', orgUsersError);
      return NextResponse.json(
        { success: false, error: 'Errore nel recupero degli utenti' },
        { status: 500 }
      );
    }

    // Query per ottenere tutti gli utenti invitati ma non ancora registrati
    const { data: invitedUsers, error: invitedError } = await supabase
      .from('invited_users')
      .select('id, email, role, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (invitedError) {
      console.error('Error fetching invited users:', invitedError);
    }

    // Per ogni user_id attivo, ottieni l'email da auth.users tramite service role
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Filtra utenti con user_id valido
    const validOrgUsers = (orgUsers || []).filter(orgUser => orgUser.user_id !== null);
    
    const activeUsersPromises = validOrgUsers.map(async (orgUser) => {
      try {
        const { data: { user: userData }, error: userError } = await supabaseAdmin.auth.admin.getUserById(orgUser.user_id!);
        
        if (userError) {
          console.error('Error fetching user details:', userError);
        }
        
        return {
          id: orgUser.user_id,
          email: userData?.email || 'Email non disponibile',
          role: orgUser.role,
          created_at: orgUser.created_at,
          status: 'active' as const,
        };
      } catch (err) {
        console.error('Error fetching user details:', err);
        return {
          id: orgUser.user_id,
          email: 'Email non disponibile',
          role: orgUser.role,
          created_at: orgUser.created_at,
          status: 'active' as const,
        };
      }
    });

    const activeUsers = await Promise.all(activeUsersPromises);

    // Mappa gli utenti invitati con status 'invited'
    const pendingUsers = (invitedUsers || []).map((invite) => ({
      id: `invite-${invite.id}`,
      email: invite.email || 'Email non disponibile',
      role: invite.role,
      created_at: invite.created_at,
      status: 'invited' as const,
      inviteId: invite.id,
    }));

    // Combina gli utenti
    const allUsers = [...activeUsers, ...pendingUsers];

    return NextResponse.json({
      success: true,
      users: allUsers,
      total: allUsers.length,
    });

  } catch (error) {
    console.error('Error in get organization users API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

// POST: Aggiungi utente (crea invito)
export async function POST(request: NextRequest) {
  try {
    const { organizationId, email, role } = await request.json();

    if (!organizationId || !email || !role) {
      return NextResponse.json(
        { success: false, error: 'organizationId, email e role sono obbligatori' },
        { status: 400 }
      );
    }

    if (!['admin', 'user'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'role deve essere "admin" o "user"' },
        { status: 400 }
      );
    }

    // Validazione email base
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Email non valida' },
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

    // Verifica che l'utente sia admin dell'organizzazione
    const { data: userOrg, error: userOrgError } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (userOrgError || !userOrg || (userOrg.role !== 'admin' && userOrg.role !== 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Non hai permessi di admin per questa organizzazione' },
        { status: 403 }
      );
    }

    // Verifica se l'email è già presente nella tabella invited_users
    const { data: existingInvite, error: inviteCheckError } = await supabase
      .from('invited_users')
      .select('id, email')
      .eq('organization_id', organizationId)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (inviteCheckError) {
      console.error('Error checking existing invite:', inviteCheckError);
      return NextResponse.json(
        { success: false, error: 'Errore durante la verifica dell\'invito' },
        { status: 500 }
      );
    }

    if (existingInvite) {
      return NextResponse.json(
        { success: false, error: 'Questa email è già stata invitata per questa organizzazione' },
        { status: 400 }
      );
    }

    // Verifica se l'utente esiste già come utente registrato nell'organizzazione
    // Usa service role per cercare utente per email
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { users: existingUsers }, error: userSearchError } = await supabaseAdmin.auth.admin.listUsers();

    if (userSearchError) {
      console.error('Error searching for user:', userSearchError);
    }

    // Cerca se esiste un utente con questa email
    const existingUser = existingUsers?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // Verifica se è già nell'organizzazione
      const { data: existingOrgUser, error: orgUserError } = await supabase
        .from('link_organization_user')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (orgUserError) {
        console.error('Error checking organization user:', orgUserError);
      }

      if (existingOrgUser) {
        return NextResponse.json(
          { success: false, error: 'Questo utente è già membro dell\'organizzazione' },
          { status: 400 }
        );
      }
    }

    // Crea l'invito nella tabella invited_users
    const { error: insertError } = await supabase
      .from('invited_users')
      .insert({
        organization_id: organizationId,
        email: email.toLowerCase(),
        role: role,
      });

    if (insertError) {
      console.error('Error creating invite:', insertError);
      return NextResponse.json(
        { success: false, error: 'Errore nella creazione dell\'invito' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invito creato con successo',
    });

  } catch (error) {
    console.error('Error in add user API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

// DELETE: Rimuovi utente da organizzazione
export async function DELETE(request: NextRequest) {
  try {
    const { userId, organizationId } = await request.json();

    if (!userId || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'userId e organizationId sono obbligatori' },
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

    // Verifica che l'utente sia admin dell'organizzazione
    const { data: userOrg, error: userOrgError } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (userOrgError || !userOrg || (userOrg.role !== 'admin' && userOrg.role !== 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Non hai permessi di admin per questa organizzazione' },
        { status: 403 }
      );
    }

    // Impedisci all'utente di rimuovere se stesso
    if (userId === user.id) {
      return NextResponse.json(
        { success: false, error: 'Non puoi rimuovere te stesso dall\'organizzazione' },
        { status: 400 }
      );
    }

    // Rimuovi l'utente dall'organizzazione
    const { error: deleteError } = await supabase
      .from('link_organization_user')
      .delete()
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (deleteError) {
      console.error('Error removing user from organization:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Errore nella rimozione dell\'utente' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Utente rimosso con successo',
    });

  } catch (error) {
    console.error('Error in remove user from organization API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

// PUT: Aggiorna ruolo utente
export async function PUT(request: NextRequest) {
  try {
    const { userId, organizationId, role } = await request.json();

    if (!userId || !organizationId || !role) {
      return NextResponse.json(
        { success: false, error: 'userId, organizationId e role sono obbligatori' },
        { status: 400 }
      );
    }

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'role deve essere "admin" o "member"' },
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

    // Verifica che l'utente sia admin dell'organizzazione
    const { data: userOrg, error: userOrgError } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (userOrgError || !userOrg || (userOrg.role !== 'admin' && userOrg.role !== 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Non hai permessi di admin per questa organizzazione' },
        { status: 403 }
      );
    }

    // Impedisci all'utente di modificare il proprio ruolo
    if (userId === user.id) {
      return NextResponse.json(
        { success: false, error: 'Non puoi modificare il tuo ruolo' },
        { status: 400 }
      );
    }

    // Conta quanti admin ci sono nell'organizzazione
    const { count: adminCount } = await supabase
      .from('link_organization_user')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('role', 'admin');

    // Se questo è l'ultimo admin e sta tentando di downgrade, blocca
    if (adminCount === 1 && role !== 'admin') {
      // Verifica se l'utente da modificare è admin
      const { data: targetUser } = await supabase
        .from('link_organization_user')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .single();

      if (targetUser?.role === 'admin') {
        return NextResponse.json(
          { success: false, error: 'Non puoi rimuovere l\'ultimo admin dell\'organizzazione' },
          { status: 400 }
        );
      }
    }

    // Aggiorna il ruolo
    const { error: updateError } = await supabase
      .from('link_organization_user')
      .update({ role })
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (updateError) {
      console.error('Error updating user role:', updateError);
      return NextResponse.json(
        { success: false, error: 'Errore nell\'aggiornamento del ruolo' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Ruolo aggiornato con successo',
    });

  } catch (error) {
    console.error('Error in update user role API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}
