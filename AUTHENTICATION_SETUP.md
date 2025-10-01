# Sistema di Autenticazione LarinAI Agent

## 📋 Panoramica

Sistema completo di autenticazione con Supabase Auth, gestione organizzazioni e agents.

## 🚀 Funzionalità Implementate

### ✅ Autenticazione
- **Login** (`/login`) - Email e password
- **Registrazione** (`/register`) - Email e password con validazione:
  - Minimo 8 caratteri
  - Almeno una lettera maiuscola
  - Almeno una lettera minuscola
  - Almeno un carattere speciale
- **OTP via email** - Modal popup per inserire codice a 6 cifre ricevuto via email
  - Input visivo con caratteri grandi e spaziati
  - Pulsante "Invia di nuovo" per ricevere un nuovo codice
  - Verifica automatica con Supabase Auth
- **Logout** - Endpoint API per disconnessione

### ✅ Dashboard `/back`
- **Selezione organizzazione** - Select in alto a sinistra per cambiare organizzazione
- **Lista agents** - Card degli agents dell'organizzazione selezionata
- **Pulsante "Add User"** - Visibile solo per utenti con ruolo "admin"
- **Logout** - Pulsante in alto a destra

### ✅ Home Page
- **Pulsante "Accedi"** - In alto a destra per il login
- **CTA "Dialoga con l'Agent"** - Reindirizza alla registrazione

## 🔧 API Endpoints

### Autenticazione
- `POST /api/auth/login` - Login con email e password
- `POST /api/auth/register` - Registrazione nuovo utente
- `POST /api/auth/verify-otp` - Verifica codice OTP via email
- `POST /api/auth/logout` - Logout utente
- `GET /api/auth/user` - Ottieni utente autenticato
- `GET /api/auth/callback` - Callback OAuth per verifica email

### Organizzazioni e Agents
- `GET /api/organizations` - Lista organizzazioni dell'utente con ruoli
- `GET /api/agents?organizationId=xxx` - Lista agents per organizzazione

## 📁 Struttura File

```
app/
├── api/
│   ├── auth/
│   │   ├── login/route.ts
│   │   ├── register/route.ts
│   │   ├── logout/route.ts
│   │   ├── user/route.ts
│   │   └── callback/route.ts
│   ├── organizations/route.ts
│   └── agents/route.ts
├── login/page.tsx
├── register/page.tsx
├── back/page.tsx
└── page.tsx (home modificata)

lib/
└── supabase/
    ├── client.ts (client-side)
    ├── server.ts (server-side)
    └── middleware.ts (session management)

middleware.ts (protezione route /back)
```

## 🗄️ Schema Database (Supabase)

### Tabelle Utilizzate

#### `organization`
```sql
- id (uuid)
- name (text)
- created_at (timestamp)
- settings (jsonb)
```

#### `link_organization_user`
```sql
- id (number)
- organization_id (uuid) → organization.id
- user_id (uuid) → auth.users.id
- role (text) - es: "admin", "user"
- created_at (timestamp)
```

#### `agents`
```sql
- id (uuid)
- organization_id (uuid) → organization.id
- name (text)
- created_at (timestamp)
- settings (jsonb)
```

## 🔐 Middleware

Il middleware protegge automaticamente tutte le route sotto `/back`:
- Verifica sessione Supabase
- Reindirizza a `/login` se non autenticato
- Gestisce refresh token automatico

## 🎨 UI/UX

### Design System
- Sfondo nero (`bg-black`)
- Testo bianco (`text-white`)
- Accenti grigi (`bg-gray-900`, `border-gray-800`)
- Pulsanti primari bianchi su nero
- Icone da Lucide React

### Pagine Responsive
- Mobile-first design
- Grid responsive per le card degli agents
- Select organizzazione adattivo

## 🔄 Flusso Utente

1. **Nuovo Utente**
   - Visita home → Click "Dialoga con l'Agent" → Registrazione
   - Compila form con email e password (2 volte)
   - Riceve OTP via email (codice a 6 cifre)
   - Si apre modal popup per inserire il codice OTP
   - Inserisce il codice e verifica
   - Redirect automatico a `/back` dopo verifica

2. **Utente Esistente**
   - Visita home → Click "Accedi"
   - Inserisce credenziali
   - Redirect a `/back`

3. **Dashboard**
   - Vede lista organizzazioni a cui appartiene
   - Seleziona organizzazione
   - Vede lista agents dell'organizzazione
   - Se admin: vede pulsante "Add User"

## ⚙️ Configurazione Necessaria

### Variabili d'Ambiente
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Setup Supabase

1. **Abilita Email Auth** in Supabase Dashboard
2. **Configura Email Templates** per OTP (opzionale)
3. **Disabilita conferma email** se vuoi login immediato (Settings → Auth → Email Auth)
4. **Crea le tabelle** se non esistono già (organization, link_organization_user, agents)

## 🧪 Testing

### Test Flow Completo
1. Avvia dev server: `npm run dev`
2. Vai su `http://localhost:3000`
3. Click "Dialoga con l'Agent" → Registrazione
4. Compila form e registrati
5. Verifica redirect a `/back`
6. Testa cambio organizzazione nella select
7. Testa logout

## 📝 Note Importanti

- ✅ **Validazione password** lato client e server
- ✅ **Middleware** protegge tutte le route `/back/*`
- ✅ **Ruoli utente** gestiti tramite `link_organization_user.role`
- ✅ **Multi-organizzazione** - Un utente può appartenere a più organizzazioni
- ✅ **OTP Modal** - Popup elegante con input a 6 cifre, reinvio codice e verifica immediata
- ⚠️ **Add User** - Attualmente solo UI, logica da implementare

## 🚧 TODO Future

- [ ] Implementare logica "Add User" per admin
- [ ] Pagina profilo utente
- [ ] Reset password
- [ ] Gestione inviti organizzazione
- [ ] Pagine di dettaglio agent
- [ ] Permission granulari per organizzazione

## 🆘 Troubleshooting

### "Utente non autenticato" dopo login
- Verifica che le variabili d'ambiente Supabase siano corrette
- Controlla cookie del browser
- Verifica configurazione Auth in Supabase Dashboard

### "Non sei associato a nessuna organizzazione"
- L'utente deve essere aggiunto manualmente a `link_organization_user`
- Oppure implementare flusso di creazione organizzazione

### Middleware non funziona
- Verifica che `middleware.ts` sia nella root del progetto
- Controlla che il pattern `matcher` includa `/back`

