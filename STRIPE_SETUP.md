# Configurazione Stripe Webhook

## 📋 Panoramica

Il sistema di pagamenti è configurato per gestire:
1. **Pagamento iniziale** al checkout (creazione organizzazione)
2. **Pagamenti ricorrenti** mensili (subscription)
3. **Pagamenti falliti** (disattivazione organizzazione)

Tutti i pagamenti vengono salvati nella tabella `payments` con riferimento a `payments_settings`.

---

## 🔧 Configurazione Variabili d'Ambiente

Aggiungi queste variabili al tuo `.env.local`:

```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...                    # Dalla dashboard Stripe
STRIPE_WEBHOOK_SECRET=whsec_...                  # Generato dopo aver creato il webhook

# App URL
NEXT_PUBLIC_APP_URL=https://tuodominio.com      # In produzione
# NEXT_PUBLIC_APP_URL=http://localhost:3000      # In sviluppo locale
```

---

## 📡 Configurazione Webhook in Stripe Dashboard

### 1. **Accedi alla Dashboard Stripe**

Vai su: [https://dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks)

### 2. **Aggiungi un Nuovo Endpoint**

Clicca su **"Add endpoint"**

### 3. **Configura l'Endpoint**

**Endpoint URL:**
```
https://tuodominio.com/api/organizations/webhook
```

**Descrizione (opzionale):**
```
Gestione pagamenti organizzazioni e subscription
```

**Versione API:**
Seleziona la versione più recente (attualmente `2025-09-30.clover`)

### 4. **Seleziona gli Eventi da Ascoltare**

Seleziona questi eventi:

#### ✅ Eventi Obbligatori

- **`checkout.session.completed`**
  - Crea l'organizzazione
  - Aggiunge l'utente come owner
  - Salva payment_settings
  - Registra il primo pagamento

- **`invoice.paid`**
  - Registra pagamenti ricorrenti mensili
  - Riattiva l'organizzazione se era disattivata

- **`invoice.payment_failed`**
  - Registra tentativi falliti
  - Disattiva l'organizzazione (isactive = false)

#### ℹ️ Eventi Consigliati (già gestiti)

- **`customer.subscription.updated`**
  - Aggiorna lo stato della subscription

- **`customer.subscription.deleted`**
  - Marca la subscription come cancellata
  - Disattiva l'organizzazione

### 5. **Copia il Webhook Secret**

Dopo aver creato il webhook, vedrai un **Webhook signing secret** che inizia con `whsec_...`

Copialo e aggiungilo al tuo `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 🧪 Test in Locale con Stripe CLI

### Installazione Stripe CLI

**Windows:**
```bash
scoop install stripe
```

**Mac:**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.5/stripe_1.19.5_linux_x86_64.tar.gz
tar -xvf stripe_1.19.5_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin
```

### Login in Stripe CLI

```bash
stripe login
```

### Forward dei Webhook in Locale

```bash
stripe listen --forward-to localhost:3000/api/organizations/webhook
```

Questo comando ti darà un webhook secret temporaneo. Usalo nel tuo `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_...  # Il secret fornito dal comando stripe listen
```

### Testare il Checkout

1. Avvia il server Next.js:
```bash
npm run dev
```

2. In un'altra finestra del terminale, avvia il forward dei webhook:
```bash
stripe listen --forward-to localhost:3000/api/organizations/webhook
```

3. Vai su `http://localhost:3000/back`

4. Clicca su "Nuova Organizzazione"

5. Inserisci un nome e clicca su "Continua"

6. Usa una carta di test Stripe:
   - Numero: `4242 4242 4242 4242`
   - Data: Qualsiasi data futura
   - CVC: Qualsiasi 3 cifre

7. Controlla i log nella finestra di Stripe CLI per vedere gli eventi ricevuti

---

## 📊 Struttura Dati

### Tabella `payments_settings`

```sql
{
  id: uuid,
  organization_id: uuid,
  user_id: uuid,
  isactive: boolean,  -- true se la subscription è attiva
  metadata: {
    stripe_customer_id: "cus_...",
    stripe_subscription_id: "sub_...",
    stripe_session_id: "cs_...",
    plan_type: "organization_unlimited",
    amount_total: 5000,
    currency: "eur",
    payment_status: "paid",
    subscription_status: "active",
    created_at: "2025-..."
  }
}
```

### Tabella `payments`

#### Pagamento Iniziale
```sql
{
  id: uuid,
  pay_settings_id: uuid,
  metadata: {
    type: "initial_subscription",
    stripe_session_id: "cs_...",
    stripe_customer_id: "cus_...",
    stripe_subscription_id: "sub_...",
    amount_total: 5000,
    amount_subtotal: 5000,
    currency: "eur",
    payment_status: "paid",
    payment_method_types: ["card"],
    created_at: "2025-..."
  }
}
```

#### Pagamento Ricorrente
```sql
{
  id: uuid,
  pay_settings_id: uuid,
  metadata: {
    type: "recurring_subscription",
    stripe_invoice_id: "in_...",
    stripe_subscription_id: "sub_...",
    stripe_customer_id: "cus_...",
    stripe_payment_intent: "pi_...",
    amount_paid: 5000,
    amount_due: 5000,
    currency: "eur",
    status: "paid",
    period_start: "2025-...",
    period_end: "2025-...",
    billing_reason: "subscription_cycle",
    created_at: "2025-..."
  }
}
```

#### Pagamento Fallito
```sql
{
  id: uuid,
  pay_settings_id: uuid,
  metadata: {
    type: "failed_payment",
    stripe_invoice_id: "in_...",
    stripe_subscription_id: "sub_...",
    stripe_customer_id: "cus_...",
    amount_due: 5000,
    currency: "eur",
    status: "open",
    attempt_count: 1,
    next_payment_attempt: "2025-...",
    billing_reason: "subscription_cycle",
    created_at: "2025-..."
  }
}
```

---

## 🔄 Flusso Completo

### 1. **Checkout Iniziale**
```
Utente → Inserisce nome org → Checkout API → Stripe Checkout → Pagamento
                                                                     ↓
Webhook ← checkout.session.completed ← Stripe
   ↓
Crea organizzazione
   ↓
Aggiunge utente come owner
   ↓
Salva payments_settings (isactive: true)
   ↓
Salva primo pagamento in payments
```

### 2. **Pagamento Ricorrente (ogni mese)**
```
Stripe → Tenta pagamento mensile
   ↓
Successo → invoice.paid
   ↓
Webhook → Salva pagamento in payments
   ↓
Aggiorna isactive = true (se era false)
```

### 3. **Pagamento Fallito**
```
Stripe → Tenta pagamento mensile
   ↓
Fallito → invoice.payment_failed
   ↓
Webhook → Salva tentativo in payments
   ↓
Aggiorna isactive = false
   ↓
Aggiorna metadata con subscription_status = 'past_due'
```

### 4. **Subscription Cancellata**
```
Utente → Cancella subscription in Stripe
   ↓
customer.subscription.deleted
   ↓
Webhook → Aggiorna isactive = false
   ↓
Aggiorna metadata con subscription_status = 'cancelled'
```

---

## 🔍 Monitoraggio e Debug

### Log dei Webhook

Tutti i webhook loggano su console:
- ✅ Eventi ricevuti
- ✅ Operazioni completate
- ❌ Errori

### Dashboard Stripe

Controlla:
1. **Eventi** → Vedi tutti gli eventi webhook inviati
2. **Logs** → Dettagli delle richieste e risposte
3. **Customers** → Vedi i clienti creati
4. **Subscriptions** → Stato delle subscription

### Test degli Eventi

Usa Stripe CLI per simulare eventi:

```bash
# Simula un pagamento riuscito
stripe trigger invoice.paid

# Simula un pagamento fallito
stripe trigger invoice.payment_failed

# Simula una cancellazione
stripe trigger customer.subscription.deleted
```

---

## ⚠️ Note Importanti

1. **Webhook Secret**: Mai committare il webhook secret nel repository
2. **Test vs Live**: Usa chiavi diverse per test e produzione
3. **Retry**: Stripe ritenta automaticamente i webhook falliti
4. **Idempotenza**: Il webhook è progettato per essere idempotente
5. **Security**: La firma del webhook viene sempre verificata

---

## 🚀 Deployment in Produzione

1. **Cambia le chiavi** da test (`sk_test_`) a live (`sk_live_`)
2. **Crea un nuovo webhook** nella dashboard live di Stripe
3. **Aggiorna** `NEXT_PUBLIC_APP_URL` con il dominio di produzione
4. **Testa** con una carta reale o una carta di test in modalità live

---

## 📞 Supporto

Se hai problemi:
1. Controlla i log del webhook in Stripe Dashboard
2. Verifica che il webhook secret sia corretto
3. Controlla che l'endpoint sia raggiungibile pubblicamente
4. Verifica i log del server Next.js

