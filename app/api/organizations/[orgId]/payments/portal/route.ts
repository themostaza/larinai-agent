import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const supabase = await createClient();
    const { orgId } = await params;

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // Verifica che l'utente sia owner o admin dell'organizzazione
    const { data: membership } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json(
        { success: false, error: 'Non hai i permessi per gestire i pagamenti' },
        { status: 403 }
      );
    }

    // Recupera i payment settings per ottenere il customer ID
    const { data: paymentSettings, error: settingsError } = await supabase
      .from('payments_settings')
      .select('metadata')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (settingsError || !paymentSettings) {
      return NextResponse.json(
        { success: false, error: 'Nessun abbonamento trovato' },
        { status: 404 }
      );
    }

    const metadata = paymentSettings.metadata as { stripe_customer_id?: string };
    const customerId = metadata?.stripe_customer_id;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID non trovato' },
        { status: 404 }
      );
    }

    // Crea una sessione del Customer Portal
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/back/${orgId}/edit`,
    });

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    });

  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { success: false, error: 'Errore del server' },
      { status: 500 }
    );
  }
}

