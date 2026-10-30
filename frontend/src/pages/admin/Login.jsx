import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

function destination(user, from) {
  const requested = from && from !== '/' && from !== '/login' && from !== '/admin/login';
  if (requested) {
    if (from.startsWith('/admin') && user.role !== 'admin') {
      return '/';
    }
    return from;
  }
  return user.role === 'admin' ? '/admin' : '/';
}

export default function Login() {
  const { login, completeTotp, isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('credentials');
  const [pendingToken, setPendingToken] = useState('');
  const [setup, setSetup] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="login-page">
        <div className="loading">Cargando...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={destination(user, location.state?.from)} replace />;
  }

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.status === 'authenticated') {
        navigate(destination(result.user, location.state?.from), { replace: true });
        return;
      }

      setPendingToken(result.pendingToken);
      if (result.status === 'totp_setup') {
        const enrollment = await api.totpSetup(result.pendingToken);
        setSetup(enrollment);
        setPendingToken(enrollment.pending_token);
        setStep('setup');
      } else {
        setStep('code');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCode = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const me = await completeTotp(pendingToken, code);
      navigate(destination(me, location.state?.from), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const backToCredentials = () => {
    setStep('credentials');
    setPendingToken('');
    setSetup(null);
    setCode('');
    setError(null);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Conkreto</h1>
        {step === 'credentials' && (
          <>
            <p>Ingresá con la cuenta que te dio el admin. No hay registro público.</p>
            <form className="admin-form" onSubmit={handleCredentials}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && <p className="form-error">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </>
        )}

        {step === 'setup' && setup && (
          <>
            <p>Vinculá una app autenticadora y confirmá el primer código.</p>
            <div className="login-qr" dangerouslySetInnerHTML={{ __html: setup.qr_svg }} />
            <p className="login-secret">
              Si no podés escanear: <code>{setup.secret}</code>
            </p>
            <form className="admin-form" onSubmit={handleCode}>
              <div className="form-group">
                <label htmlFor="code">Código de 6 dígitos</label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  pattern="[0-9 ]{6,8}"
                />
              </div>
              {error && <p className="form-error">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Verificando...' : 'Confirmar'}
              </button>
              <button type="button" className="btn btn-outline" onClick={backToCredentials}>
                Volver
              </button>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <p>Ingresá el código de tu app autenticadora.</p>
            <form className="admin-form" onSubmit={handleCode}>
              <div className="form-group">
                <label htmlFor="code">Código de 6 dígitos</label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  pattern="[0-9 ]{6,8}"
                />
              </div>
              {error && <p className="form-error">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Verificando...' : 'Confirmar'}
              </button>
              <button type="button" className="btn btn-outline" onClick={backToCredentials}>
                Volver
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
