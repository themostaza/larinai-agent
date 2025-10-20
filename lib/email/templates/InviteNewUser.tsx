import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface InviteNewUserEmailProps {
  organizationName: string;
  invitedByEmail: string;
  registerLink: string;
  role: string;
  email: string;
}

export const InviteNewUserEmail = ({
  organizationName,
  invitedByEmail,
  registerLink,
  role,
  email,
}: InviteNewUserEmailProps) => (
  <Html>
    <Head />
    <Preview>Hai ricevuto un invito a {organizationName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Invito a {organizationName}</Heading>
        
        <Text style={text}>
          Ciao! Hai ricevuto un invito da <strong>{invitedByEmail}</strong> per entrare nell&apos;organizzazione <strong>{organizationName}</strong> con il ruolo di <strong>{role}</strong>.
        </Text>

        <Text style={text}>
          Per accettare l&apos;invito, è necessario prima creare un account sulla nostra piattaforma.
        </Text>

        <Section style={buttonContainer}>
          <Button style={button} href={registerLink}>
            Registrati ora
          </Button>
        </Section>

        <Text style={text}>
          oppure copia e incolla questo link nel tuo browser:
        </Text>
        
        <Link href={registerLink} style={link}>
          {registerLink}
        </Link>

        <Text style={footer}>
          Una volta completata la registrazione con l&apos;email <strong>{email}</strong>, l&apos;accesso all&apos;organizzazione sarà automatico. Questo invito scadrà automaticamente dopo 3 giorni.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default InviteNewUserEmail;

// Stili inline per compatibilità email
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 24px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#000',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
};

const link = {
  color: '#067df7',
  fontSize: '14px',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
  margin: '16px 24px',
  display: 'block',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '24px 24px',
};

