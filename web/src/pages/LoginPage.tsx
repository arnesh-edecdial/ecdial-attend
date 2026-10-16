import React, { FormEvent, useState } from 'react';
import { ShieldCheck, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ identifier, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(340px, 0.9fr)', background: 'var(--bg-app)' }}>
      <section style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 'clamp(28px, 6vw, 84px)', background: 'radial-gradient(circle at 20% 20%, rgba(0,102,204,.25), transparent 48%), linear-gradient(145deg, #0D1527, #0A0F1D)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #0066CC, #003D7A)' }}><ShieldCheck size={26} color="white" /></div>
          <div><div style={{ fontWeight: 850, fontSize: 21, letterSpacing: '.02em' }}>ECDIAL</div><div style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: '.13em', textTransform: 'uppercase' }}>Enterprise workspace</div></div>
        </div>
        <div style={{ maxWidth: 570, padding: '56px 0' }}>
          <div className="badge badge-present" style={{ marginBottom: 22 }}>SECURE TEAM ACCESS</div>
          <h1 style={{ fontSize: 'clamp(34px, 4.2vw, 58px)', lineHeight: 1.08, letterSpacing: '-.04em', marginBottom: 20 }}>One workspace.<br />Every operation in sync.</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 450, lineHeight: 1.8 }}>Manage attendance, AC quotations, product catalogue and daily operations through your ECDIAL account.</p>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Authorized ECDIAL personnel only.</p>
      </section>

      <section style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <form onSubmit={handleSubmit} className="glass-card" style={{ width: '100%', maxWidth: 430, padding: 'clamp(24px, 4vw, 38px)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(0,102,204,.14)', color: 'var(--primary-400)', marginBottom: 22 }}><LockKeyhole size={23} /></div>
          <h2 style={{ fontSize: 27, letterSpacing: '-.03em', marginBottom: 8 }}>Welcome back</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>Sign in with your registered ECDIAL credentials.</p>

          <div className="form-group">
            <label htmlFor="login-identifier" className="form-label">Email or employee code</label>
            <div style={{ position: 'relative' }}>
              {identifier.includes('@') ? <Mail size={17} color="var(--text-dim)" style={{ position: 'absolute', left: 13, top: 13 }} /> : <UserRound size={17} color="var(--text-dim)" style={{ position: 'absolute', left: 13, top: 13 }} />}
              <input id="login-identifier" className="form-control" style={{ paddingLeft: 40 }} autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="name@ecdial.com or employee code" required autoFocus />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label htmlFor="login-password" className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <LockKeyhole size={17} color="var(--text-dim)" style={{ position: 'absolute', left: 13, top: 13 }} />
              <input id="login-password" className="form-control" style={{ paddingLeft: 40, paddingRight: 44 }} type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 10, top: 8, border: 0, background: 'transparent', color: 'var(--text-muted)', padding: 5, cursor: 'pointer' }}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>

          {error && <div role="alert" style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.35)', color: '#FCA5A5', borderRadius: 9, padding: '11px 13px', fontSize: 13, marginBottom: 18 }}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', minHeight: 46, opacity: submitting ? .7 : 1 }}>
            {submitting ? 'Signing in…' : 'Sign in securely'}
          </button>
          <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-dim)', fontSize: 11 }}>Your access is verified by the ECDIAL server.</p>
        </form>
      </section>
      <style>{`@media (max-width: 760px) { form { max-width: 460px !important; } body > #root > div > section:first-child { display: none !important; } }`}</style>
    </div>
  );
};
