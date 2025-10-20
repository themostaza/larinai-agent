import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Ottieni dettagli invito con lazy cleanup
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token non fornito' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Ottieni l'invito
    const { data: invite, error: inviteError } = await supabase
      .from('invited_users')
      .select('id, email, organization_id, role, status, created_at')
      .eq('public_invitation_id', token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { success: false, error: 'Invito non trovato' },
        { status: 404 }
      );
    }

    // Verifica che ci sia un organization_id
    if (!invite.organization_id) {
      return NextResponse.json(
        { success: false, error: 'Invito non valido: organizzazione mancante' },
        { status: 400 }
      );
    }

    // Verifica che ci sia un'email nell'invito
    if (!invite.email) {
      return NextResponse.json(
        { success: false, error: 'Invito non valido: email mancante' },
        { status: 400 }
      );
    }

    // Ottieni il nome dell'organizzazione
    const { data: org, error: orgError } = await supabase
      .from('organization')
      .select('name')
      .eq('id', invite.organization_id)
      .single();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
    }

    // Lazy cleanup: verifica se l'invito è scaduto (più di 3 giorni)
    const createdAt = new Date(invite.created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const isExpired = daysDiff > 3;

    // Se è scaduto e lo status è null (pending), aggiorna a rejected
    if (isExpired && !invite.status) {
      const { error: updateError } = await supabase
        .from('invited_users')
        .update({ status: 'rejected' })
        .eq('id', invite.id);

      if (updateError) {
        console.error('Error updating expired invite:', updateError);
      }
      
      // Aggiorna lo status locale
      invite.status = 'rejected';
    }

    // Ottieni l'utente corrente (se loggato)
    const { data: { user } } = await supabase.auth.getUser();

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        organization_id: invite.organization_id,
        organization_name: org?.name || 'Organizzazione',
        role: invite.role,
        status: invite.status,
        created_at: invite.created_at,
        isExpired,
      },
      currentUserEmail: user?.email || null,
    });

  } catch (error) {
    console.error('Error in get invitation API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

// PUT: Accetta o rifiuta invito
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { action } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token non fornito' },
        { status: 400 }
      );
    }

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Azione non valida. Usa "accept" o "reject"' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Ottieni l'utente autenticato
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Devi essere autenticato per accettare o rifiutare un invito' },
        { status: 401 }
      );
    }

    // Ottieni l'invito
    const { data: invite, error: inviteError } = await supabase
      .from('invited_users')
      .select('id, email, organization_id, role, status, created_at')
      .eq('public_invitation_id', token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { success: false, error: 'Invito non trovato' },
        { status: 404 }
      );
    }

    // Verifica che ci sia un'email nell'invito
    if (!invite.email) {
      return NextResponse.json(
        { success: false, error: 'Invito non valido: email mancante' },
        { status: 400 }
      );
    }

    // Verifica che l'email dell'utente corrisponda
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Questo invito è destinato a un\'altra email. Effettua il logout e accedi con l\'email corretta.' 
        },
        { status: 403 }
      );
    }

    // Verifica che ci sia un organization_id
    if (!invite.organization_id) {
      return NextResponse.json(
        { success: false, error: 'Invito non valido: organizzazione mancante' },
        { status: 400 }
      );
    }

    // Verifica se l'invito è già stato processato
    if (invite.status) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Questo invito è già stato ${invite.status === 'confirmed' ? 'accettato' : 'rifiutato'}` 
        },
        { status: 400 }
      );
    }

    // Verifica se l'invito è scaduto (lazy cleanup)
    const createdAt = new Date(invite.created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 3) {
      // Marca come rejected
      await supabase
        .from('invited_users')
        .update({ status: 'rejected' })
        .eq('id', invite.id);

      return NextResponse.json(
        { success: false, error: 'Questo invito è scaduto (gli inviti sono validi per 3 giorni)' },
        { status: 400 }
      );
    }

    if (action === 'reject') {
      // Rifiuta l'invito
      const { error: updateError } = await supabase
        .from('invited_users')
        .update({ status: 'rejected' })
        .eq('id', invite.id);

      if (updateError) {
        console.error('Error rejecting invite:', updateError);
        return NextResponse.json(
          { success: false, error: 'Errore nel rifiuto dell\'invito' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Invito rifiutato con successo',
      });
    }

    // Accetta l'invito (action === 'accept')
    
    // Verifica se l'utente è già membro dell'organizzazione
    const { data: existingMembership, error: membershipError } = await supabase
      .from('link_organization_user')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', invite.organization_id)
      .maybeSingle();

    if (membershipError) {
      console.error('Error checking membership:', membershipError);
    }

    if (existingMembership) {
      // L'utente è già membro, marca l'invito come confermato
      await supabase
        .from('invited_users')
        .update({ status: 'confirmed' })
        .eq('id', invite.id);

      return NextResponse.json({
        success: true,
        message: 'Sei già membro di questa organizzazione',
        alreadyMember: true,
      });
    }

    // Aggiungi l'utente all'organizzazione
    const { error: insertError } = await supabase
      .from('link_organization_user')
      .insert({
        user_id: user.id,
        organization_id: invite.organization_id,
        role: invite.role,
      });

    if (insertError) {
      console.error('Error adding user to organization:', insertError);
      return NextResponse.json(
        { success: false, error: 'Errore nell\'aggiunta all\'organizzazione' },
        { status: 500 }
      );
    }

    // Marca l'invito come confermato
    const { error: updateError } = await supabase
      .from('invited_users')
      .update({ status: 'confirmed' })
      .eq('id', invite.id);

    if (updateError) {
      console.error('Error updating invite status:', updateError);
      // Non blocchiamo qui, l'utente è già stato aggiunto
    }

    return NextResponse.json({
      success: true,
      message: 'Invito accettato con successo',
    });

  } catch (error) {
    console.error('Error in accept/reject invitation API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}

