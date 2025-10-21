import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { success: false, error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verifica la firma del webhook
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Gestisci l'evento checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('Checkout session completed:', session.id);

      // Estrai i dati dai metadata
      const userId = session.metadata?.user_id;
      const userEmail = session.metadata?.user_email;
      const organizationName = session.metadata?.organization_name;
      const planType = session.metadata?.plan_type;

      if (!userId || !organizationName) {
        console.error('Missing required metadata in checkout session:', session.metadata);
        return NextResponse.json(
          { success: false, error: 'Missing required metadata' },
          { status: 400 }
        );
      }

      // Crea un client Supabase con service role per operazioni admin
      const supabase = await createClient();

      // 1. Crea l'organizzazione
      const { data: organization, error: orgError } = await supabase
        .from('organization')
        .insert({
          name: organizationName,
        })
        .select()
        .single();

      if (orgError || !organization) {
        console.error('Error creating organization:', orgError);
        return NextResponse.json(
          { success: false, error: 'Failed to create organization' },
          { status: 500 }
        );
      }

      console.log('Organization created:', organization.id);

      // 2. Aggiungi l'utente come owner dell'organizzazione
      const { error: linkError } = await supabase
        .from('link_organization_user')
        .insert({
          organization_id: organization.id,
          user_id: userId,
          role: 'owner',
        });

      if (linkError) {
        console.error('Error linking user to organization:', linkError);
        console.error('Link details:', {
          organization_id: organization.id,
          user_id: userId,
          role: 'owner',
        });
        // Rollback: elimina l'organizzazione
        await supabase.from('organization').delete().eq('id', organization.id);
        return NextResponse.json(
          { success: false, error: 'Failed to link user to organization' },
          { status: 500 }
        );
      }

      console.log('User linked to organization as owner:', {
        organization_id: organization.id,
        user_id: userId,
      });

      // 3. Recupera i dati fiscali dal customer Stripe
      let taxData = null;
      const customerId = session.customer as string;
      
      if (customerId) {
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if ('tax_ids' in customer) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const customerAny = customer as any;
            if (customerAny.tax_ids?.data?.length > 0) {
              taxData = customerAny.tax_ids.data.map((tax: { type: string; value: string; country?: string }) => ({
                type: tax.type,
                value: tax.value,
                country: tax.country,
              }));
              console.log('Tax IDs retrieved:', taxData);
            }
          }
        } catch (error) {
          console.error('Error retrieving customer tax data:', error);
        }
      }

      // 4. Salva i payment settings
      const paymentMetadata = {
        stripe_customer_id: customerId,
        stripe_subscription_id: session.subscription as string,
        stripe_session_id: session.id,
        plan_type: planType,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
        subscription_status: 'active',
        tax_data: taxData, // Dati fiscali (Codice Fiscale / Partita IVA)
        customer_email: session.customer_details?.email || userEmail,
        created_at: new Date().toISOString(),
      };

      const { data: paymentSettings, error: paymentError } = await supabase
        .from('payments_settings')
        .insert({
          organization_id: organization.id,
          user_id: userId,
          isactive: true,
          metadata: paymentMetadata,
        })
        .select()
        .single();

      if (paymentError || !paymentSettings) {
        console.error('Error saving payment settings:', paymentError);
        // Non facciamo rollback qui perché l'organizzazione è già creata
        // Ma logghiamo l'errore per debug
      } else {
        console.log('Payment settings saved:', paymentSettings.id);

        // 5. Recupera l'invoice dal session (se disponibile)
        let invoiceId = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessionAny = session as any;
        if (sessionAny.invoice) {
          invoiceId = typeof sessionAny.invoice === 'string' 
            ? sessionAny.invoice 
            : sessionAny.invoice?.id;
        }

        // 6. Salva il primo pagamento nella tabella payments
        const firstPaymentMetadata = {
          type: 'initial_subscription',
          stripe_session_id: session.id,
          stripe_invoice_id: invoiceId, // Invoice ID del primo pagamento
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          amount_total: session.amount_total,
          amount_subtotal: session.amount_subtotal,
          currency: session.currency,
          payment_status: session.payment_status,
          payment_method_types: session.payment_method_types,
          created_at: new Date().toISOString(),
        };

        const { error: firstPaymentError } = await supabase
          .from('payments')
          .insert({
            pay_settings_id: paymentSettings.id,
            metadata: firstPaymentMetadata,
          });

        if (firstPaymentError) {
          console.error('Error saving first payment:', firstPaymentError);
        } else {
          console.log('First payment recorded');
        }
      }

      return NextResponse.json({
        success: true,
        organization_id: organization.id,
      });
    }

    // Gestisci altri eventi se necessario
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;

      console.log('Subscription updated:', subscription.id);

      // Aggiorna lo stato della subscription nei payment_settings
      const supabase = await createClient();

      // Recupera il record esistente
      const { data: existingRecord } = await supabase
        .from('payments_settings')
        .select('metadata')
        .eq('metadata->>stripe_subscription_id', subscription.id)
        .single();

      if (existingRecord && existingRecord.metadata) {
        const updatedMetadata = {
          ...(existingRecord.metadata as Record<string, unknown>),
          subscription_status: subscription.status,
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from('payments_settings')
          .update({ metadata: updatedMetadata })
          .eq('metadata->>stripe_subscription_id', subscription.id);

        if (updateError) {
          console.error('Error updating subscription status:', updateError);
        }
      }

      return NextResponse.json({ success: true, received: true });
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;

      console.log('Subscription deleted:', subscription.id);

      // Aggiorna lo stato della subscription nei payment_settings e disattiva
      const supabase = await createClient();

      // Recupera il record esistente
      const { data: existingRecord } = await supabase
        .from('payments_settings')
        .select('metadata')
        .eq('metadata->>stripe_subscription_id', subscription.id)
        .single();

      if (existingRecord && existingRecord.metadata) {
        const updatedMetadata = {
          ...(existingRecord.metadata as Record<string, unknown>),
          subscription_status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from('payments_settings')
          .update({ 
            metadata: updatedMetadata,
            isactive: false,
          })
          .eq('metadata->>stripe_subscription_id', subscription.id);

        if (updateError) {
          console.error('Error updating subscription status:', updateError);
        }
      }

      return NextResponse.json({ success: true, received: true });
    }

    // Gestisci i pagamenti ricorrenti
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;

      console.log('Invoice paid:', invoice.id);

      // Verifica che sia una subscription
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoiceAny = invoice as any;
      const subscriptionId = typeof invoiceAny.subscription === 'string' 
        ? invoiceAny.subscription 
        : invoiceAny.subscription?.id;

      if (!subscriptionId) {
        return NextResponse.json({ success: true, received: true });
      }

      const supabase = await createClient();

      // Recupera il payment_settings
      const { data: paymentSettings } = await supabase
        .from('payments_settings')
        .select('id')
        .eq('metadata->>stripe_subscription_id', subscriptionId)
        .single();

      if (paymentSettings) {
        const customerId = typeof invoice.customer === 'string' 
          ? invoice.customer 
          : invoice.customer?.id || '';
        
        const paymentIntentId = typeof invoiceAny.payment_intent === 'string'
          ? invoiceAny.payment_intent
          : invoiceAny.payment_intent?.id || '';

        // Salva il pagamento ricorrente
        const recurringPaymentMetadata = {
          type: 'recurring_subscription',
          stripe_invoice_id: invoice.id,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          stripe_payment_intent: paymentIntentId,
          amount_paid: invoice.amount_paid,
          amount_due: invoice.amount_due,
          currency: invoice.currency,
          status: invoice.status,
          period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
          period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
          billing_reason: invoice.billing_reason,
          created_at: new Date().toISOString(),
        };

        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            pay_settings_id: paymentSettings.id,
            metadata: recurringPaymentMetadata,
          });

        if (paymentError) {
          console.error('Error saving recurring payment:', paymentError);
        } else {
          console.log('Recurring payment recorded');
        }

        // Assicurati che isactive sia true se il pagamento è andato a buon fine
        await supabase
          .from('payments_settings')
          .update({ isactive: true })
          .eq('id', paymentSettings.id);
      }

      return NextResponse.json({ success: true, received: true });
    }

    // Gestisci i pagamenti falliti
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;

      console.log('Invoice payment failed:', invoice.id);

      // Verifica che sia una subscription
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoiceAny = invoice as any;
      const subscriptionId = typeof invoiceAny.subscription === 'string' 
        ? invoiceAny.subscription 
        : invoiceAny.subscription?.id;

      if (!subscriptionId) {
        return NextResponse.json({ success: true, received: true });
      }

      const supabase = await createClient();

      // Recupera il payment_settings
      const { data: paymentSettings } = await supabase
        .from('payments_settings')
        .select('id, metadata')
        .eq('metadata->>stripe_subscription_id', subscriptionId)
        .single();

      if (paymentSettings) {
        const customerId = typeof invoice.customer === 'string' 
          ? invoice.customer 
          : invoice.customer?.id || '';

        // Salva il tentativo di pagamento fallito
        const failedPaymentMetadata = {
          type: 'failed_payment',
          stripe_invoice_id: invoice.id,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          amount_due: invoice.amount_due,
          currency: invoice.currency,
          status: invoice.status,
          attempt_count: invoice.attempt_count,
          next_payment_attempt: invoice.next_payment_attempt 
            ? new Date(invoice.next_payment_attempt * 1000).toISOString() 
            : null,
          billing_reason: invoice.billing_reason,
          created_at: new Date().toISOString(),
        };

        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            pay_settings_id: paymentSettings.id,
            metadata: failedPaymentMetadata,
          });

        if (paymentError) {
          console.error('Error saving failed payment:', paymentError);
        } else {
          console.log('Failed payment recorded');
        }

        // Disattiva l'organizzazione dopo un tentativo fallito
        const updatedMetadata = {
          ...(paymentSettings.metadata as Record<string, unknown>),
          subscription_status: 'past_due',
          last_payment_failed_at: new Date().toISOString(),
        };

        await supabase
          .from('payments_settings')
          .update({ 
            isactive: false,
            metadata: updatedMetadata,
          })
          .eq('id', paymentSettings.id);

        console.log('Organization deactivated due to failed payment');
      }

      return NextResponse.json({ success: true, received: true });
    }

    // Altri eventi vengono accettati ma non gestiti
    return NextResponse.json({ success: true, received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

