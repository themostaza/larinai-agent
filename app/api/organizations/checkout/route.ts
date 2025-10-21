import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // Leggi il body della richiesta
    const body = await req.json();
    const { organizationName } = body;

    if (!organizationName || typeof organizationName !== 'string' || !organizationName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Il nome dell\'organizzazione è obbligatorio' },
        { status: 400 }
      );
    }

    if (organizationName.trim().length > 50) {
      return NextResponse.json(
        { success: false, error: 'Il nome non può superare i 50 caratteri' },
        { status: 400 }
      );
    }

    // TODO: In futuro, qui potrai gestire logiche custom
    // Per esempio, verificare se l'utente ha diritto a sconti speciali
    // o creare direttamente l'organizzazione senza pagamento
    
    // Per ora, reindirizza sempre a Stripe checkout
    const createOrganizationDirectly = false; // Imposta a true per bypassare Stripe
    
    if (createOrganizationDirectly) {
      // Sconto 100% - Crea l'organizzazione direttamente
      // Crea l'organizzazione
      const { data: organization, error: orgError } = await supabase
        .from('organization')
        .insert({
          name: organizationName.trim(),
        })
        .select()
        .single();

      if (orgError) {
        console.error('Error creating organization:', orgError);
        return NextResponse.json(
          { success: false, error: 'Errore nella creazione dell\'organizzazione' },
          { status: 500 }
        );
      }

      // Aggiungi l'utente come owner dell'organizzazione
      const { error: memberError } = await supabase
        .from('link_organization_user')
        .insert({
          organization_id: organization.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) {
        console.error('Error adding user to organization:', memberError);
        return NextResponse.json(
          { success: false, error: 'Errore nell\'aggiunta dell\'utente all\'organizzazione' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        organization: {
          id: organization.id,
          name: organization.name,
        },
      });
    }

    // Altrimenti, crea una sessione di checkout Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-09-30.clover',
    });
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Piano Organizzazione Unlimited',
              description: 'Chatbot illimitati, utenti illimitati, API key personalizzate',
            },
            unit_amount: 5000, // 50.00 EUR (in centesimi)
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/back?checkout=success`,
      cancel_url: `${appUrl}/back?checkout=cancelled`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        user_email: user.email || '',
        organization_name: organizationName.trim(),
        plan_type: 'organization_unlimited',
      },
      allow_promotion_codes: true, // Permette di usare codici sconto direttamente in Stripe
    });
    
    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, error: 'Errore del server' },
      { status: 500 }
    );
  }
}

