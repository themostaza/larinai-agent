import { Resend } from 'resend';

// Inizializza il client Resend
// Assicurati di avere RESEND_API_KEY nelle variabili d'ambiente
export const resend = new Resend(process.env.RESEND_API_KEY);

// Email mittente di default (dovrai verificarla su Resend)
export const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

