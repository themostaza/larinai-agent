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

interface InviteExistingUserEmailProps {
  organizationName: string;
  invitedByEmail: string;
  inviteLink: string;
  role: string;
}

export const InviteExistingUserEmail = ({
  organizationName,
  invitedByEmail,
  inviteLink,
  role,
}: InviteExistingUserEmailProps) => (
  <Html>
    <Head />
    <Preview>Hai ricevuto un invito a {organizationName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Invito a {organizationName}</Heading>
        
        <Text style={text}>
          Ciao! Hai ricevuto un invito da <strong>{invitedByEmail}</strong> per entrare nell&apos;organizzazione <strong>{organizationName}</strong> con il ruolo di <strong>{role}</strong>.
        </Text>

        <Section style={buttonContainer}>
          <Button style={button} href={inviteLink}>
            Accetta l&apos;invito
          </Button>
        </Section>

        <Text style={text}>
          oppure copia e incolla questo link nel tuo browser:
        </Text>
        
        <Link href={inviteLink} style={link}>
          {inviteLink}
        </Link>

        <Text style={footer}>
          Questo invito scadrà automaticamente dopo 3 giorni. Se non desideri accettare l&apos;invito, puoi ignorare questa email.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default InviteExistingUserEmail;

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

