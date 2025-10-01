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
        
        // Cerca inviti per questa email
        const { data: invites, error: invitesError } = await supabaseAdmin
          .from('invited_users')
          .select('*')
          .eq('email', email.toLowerCase());

        if (!invitesError && invites && invites.length > 0) {
          // Aggiungi l'utente a tutte le organizzazioni per cui è stato invitato
          for (const invite of invites) {
            await supabaseAdmin
              .from('link_organization_user')
              .insert({
                user_id: data.user.id,
                organization_id: invite.organization_id,
                role: invite.role || 'user',
              });

            // Elimina l'invito dopo averlo processato
            await supabaseAdmin
              .from('invited_users')
              .delete()
              .eq('id', invite.id);
          }

          console.log(`User ${email} added to ${invites.length} organization(s) based on invites`);
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


