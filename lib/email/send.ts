import { resend, DEFAULT_FROM } from './client';
import { InviteExistingUserEmail } from './templates/InviteExistingUser';
import { InviteNewUserEmail } from './templates/InviteNewUser';
import { render } from '@react-email/components';

interface SendInviteExistingUserParams {
  to: string;
  organizationName: string;
  invitedByEmail: string;
  inviteLink: string;
  role: string;
}

interface SendInviteNewUserParams {
  to: string;
  organizationName: string;
  invitedByEmail: string;
  registerLink: string;
  role: string;
}

/**
 * Invia email di invito a un utente già registrato
 */
export async function sendInviteExistingUser({
  to,
  organizationName,
  invitedByEmail,
  inviteLink,
  role,
}: SendInviteExistingUserParams) {
  try {
    const emailHtml = await render(
      InviteExistingUserEmail({
        organizationName,
        invitedByEmail,
        inviteLink,
        role,
      })
    );

    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: `Invito a ${organizationName}`,
      html: emailHtml,
    });

    if (error) {
      console.error('Error sending invite email to existing user:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in sendInviteExistingUser:', error);
    return { success: false, error };
  }
}

/**
 * Invia email di invito a un nuovo utente (non ancora registrato)
 */
export async function sendInviteNewUser({
  to,
  organizationName,
  invitedByEmail,
  registerLink,
  role,
}: SendInviteNewUserParams) {
  try {
    const emailHtml = await render(
      InviteNewUserEmail({
        organizationName,
        invitedByEmail,
        registerLink,
        role,
        email: to,
      })
    );

    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: `Invito a ${organizationName}`,
      html: emailHtml,
    });

    if (error) {
      console.error('Error sending invite email to new user:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in sendInviteNewUser:', error);
    return { success: false, error };
  }
}

/**
 * Funzione generica per inviare qualsiasi tipo di email
 * Utile per future implementazioni
 */
export async function sendEmail({
  to,
  subject,
  html,
  from = DEFAULT_FROM,
}: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in sendEmail:', error);
    return { success: false, error };
  }
}

