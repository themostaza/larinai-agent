import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Funzione di validazione password
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'La password deve contenere almeno 8 caratteri' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'La password deve contenere almeno una lettera maiuscola' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'La password deve contenere almeno una lettera minuscola' };
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'La password deve contenere almeno un carattere speciale' };
  }
  
  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, confirmPassword } = await request.json();

    // Validazione input
    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Tutti i campi sono obbligatori' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Le password non coincidono' },
        { status: 400 }
      );
    }

    // Validazione password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, error: passwordValidation.error },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Registrazione con Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${request.nextUrl.origin}/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    // Controlla se l'email deve essere verificata
    const needsEmailVerification = data.user && !data.session;

    // Se la registrazione è andata a buon fine, controlla se ci sono inviti pending
    if (data.user) {
      try {
        // Crea un client Supabase con service role per operazioni admin
        const supabaseAdmin = createAdminClient();
        
        // Cerca inviti pending per questa email (status null o non specificato)
        const { data: invites, error: invitesError } = await supabaseAdmin
          .from('invited_users')
          .select('*')
          .eq('email', email.toLowerCase())
          .is('status', null); // Solo inviti pending

        if (!invitesError && invites && invites.length > 0) {
          let addedCount = 0;
          
          // Aggiungi l'utente a tutte le organizzazioni per cui è stato invitato
          for (const invite of invites) {
            // Verifica se l'invito è scaduto (>3 giorni)
            const createdAt = new Date(invite.created_at);
            const now = new Date();
            const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysDiff > 3) {
              // Invito scaduto, marca come rejected
              await supabaseAdmin
                .from('invited_users')
                .update({ status: 'rejected' })
                .eq('id', invite.id);
              
              console.log(`Invite ${invite.id} expired, marked as rejected`);
              continue; // Salta questo invito
            }

            // Salta se non c'è organization_id
            if (!invite.organization_id) {
              console.log(`Invite ${invite.id} has no organization_id, skipping`);
              continue;
            }

            // Verifica se l'utente è già nell'organizzazione
            const { data: existingMembership } = await supabaseAdmin
              .from('link_organization_user')
              .select('id')
              .eq('user_id', data.user.id)
              .eq('organization_id', invite.organization_id)
              .maybeSingle();

            if (!existingMembership) {
              // Aggiungi l'utente all'organizzazione
              const { error: insertError } = await supabaseAdmin
                .from('link_organization_user')
                .insert({
                  user_id: data.user.id,
                  organization_id: invite.organization_id,
                  role: invite.role || 'user',
                });

              if (!insertError) {
                addedCount++;
              } else {
                console.error('Error adding user to organization:', insertError);
              }
            }

            // Marca l'invito come confirmed
            await supabaseAdmin
              .from('invited_users')
              .update({ status: 'confirmed' })
              .eq('id', invite.id);
          }

          if (addedCount > 0) {
            console.log(`User ${email} added to ${addedCount} organization(s) based on invites`);
          }
        }
      } catch (inviteError) {
        console.error('Error processing invites during registration:', inviteError);
        // Non blocchiamo la registrazione se c'è un errore con gli inviti
      }
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      session: data.session,
      message: needsEmailVerification 
        ? 'Registrazione completata! Controlla la tua email per verificare l\'account.'
        : 'Registrazione completata con successo!',
      needsEmailVerification,
    });

  } catch (error) {
    console.error('Error in register API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore interno del server' 
      },
      { status: 500 }
    );
  }
}


