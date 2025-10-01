'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Validazione password in tempo reale
  const passwordValidation = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const isPasswordValid = 
    passwordValidation.minLength && 
    passwordValidation.hasUpperCase && 
    passwordValidation.hasLowerCase && 
    passwordValidation.hasSpecialChar;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, confirmPassword }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore durante la registrazione');
        setIsLoading(false);
        return;
      }

      setSuccess(data.message);
      
      // Se non richiede verifica email, redirect immediato
      if (!data.needsEmailVerification) {
        setTimeout(() => {
          router.push('/back');
          router.refresh();
        }, 2000);
      } else {
        // Mostra modal OTP
        setIsLoading(false);
        setShowOtpModal(true);
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('Errore di connessione. Riprova.');
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOtpError('');
    setIsVerifyingOtp(true);

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, token: otpCode }),
      });

      const data = await response.json();

      if (!data.success) {
        setOtpError(data.error || 'Codice OTP non valido');
        setIsVerifyingOtp(false);
        return;
      }

      // OTP verificato con successo, redirect a /back
      setSuccess('Email verificata con successo!');
      setTimeout(() => {
        router.push('/back');
        router.refresh();
      }, 1500);
    } catch (err) {
      console.error('OTP verification error:', err);
      setOtpError('Errore di connessione. Riprova.');
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      // Richiama la registrazione per inviare un nuovo OTP
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, confirmPassword }),
      });

      const data = await response.json();
      
      if (data.success) {
        setOtpError('');
        setSuccess('Nuovo codice inviato via email!');
      }
    } catch (err) {
      console.error('Resend OTP error:', err);
      setOtpError('Errore nell\'invio del codice. Riprova.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            LarinAI <span className="text-gray-400">Agent</span>
          </h1>
          <p className="text-gray-400">Crea il tuo account</p>
        </div>

        {/* Register Form */}
        <div className="">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle2 className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-green-500 text-sm">{success}</p>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
                placeholder="nome@esempio.com"
                disabled={isLoading || !!success}
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
                placeholder="••••••••"
                disabled={isLoading || !!success}
              />

              {/* Password Requirements */}
              {password && (
                <div className="mt-3 space-y-2">
                  <PasswordRequirement 
                    met={passwordValidation.minLength} 
                    text="Minimo 8 caratteri" 
                  />
                  <PasswordRequirement 
                    met={passwordValidation.hasUpperCase} 
                    text="Almeno una lettera maiuscola" 
                  />
                  <PasswordRequirement 
                    met={passwordValidation.hasLowerCase} 
                    text="Almeno una lettera minuscola" 
                  />
                  <PasswordRequirement 
                    met={passwordValidation.hasSpecialChar} 
                    text="Almeno un carattere speciale" 
                  />
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Conferma Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
                placeholder="••••••••"
                disabled={isLoading || !!success}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-2 text-sm text-red-400">Le password non coincidono</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !isPasswordValid || password !== confirmPassword || !!success}
              className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Registrazione in corso...
                </>
              ) : (
                'Registrati'
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Hai già un account?{' '}
              <Link 
                href="/login" 
                className="text-white font-medium hover:underline"
              >
                Accedi
              </Link>
            </p>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Link 
            href="/" 
            className="text-gray-400 text-sm hover:text-white transition-colors"
          >
            ← Torna alla home
          </Link>
        </div>
      </div>

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 max-w-md w-full relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowOtpModal(false);
                router.push('/login');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            {/* Modal Content */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Verifica la tua email</h2>
              <p className="text-gray-400">
                Abbiamo inviato un codice a <br />
                <span className="text-white font-medium">{email}</span>
              </p>
            </div>

            {/* OTP Form */}
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* OTP Error */}
              {otpError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-red-500 text-sm">{otpError}</p>
                </div>
              )}

              {/* Success Message in Modal */}
              {success && showOtpModal && (
                <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-3 flex items-start gap-2">
                  <CheckCircle2 className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-green-500 text-sm">{success}</p>
                </div>
              )}

              {/* OTP Input */}
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-300 mb-2">
                  Codice di verifica
                </label>
                <input
                  id="otp"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  required
                  maxLength={6}
                  placeholder="000000"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white text-center text-2xl tracking-widest placeholder-gray-600"
                  disabled={isVerifyingOtp}
                  autoFocus
                />
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={isVerifyingOtp || otpCode.length !== 6}
                className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifyingOtp ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Verifica in corso...
                  </>
                ) : (
                  'Verifica'
                )}
              </button>

              {/* Resend Link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isVerifyingOtp}
                  className="text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Non hai ricevuto il codice? Invia di nuovo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente helper per i requisiti password
function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
        met ? 'bg-green-500' : 'bg-gray-700'
      }`}>
        {met && <CheckCircle2 size={12} className="text-black" />}
      </div>
      <span className={met ? 'text-gray-400' : 'text-gray-500'}>
        {text}
      </span>
    </div>
  );
}

