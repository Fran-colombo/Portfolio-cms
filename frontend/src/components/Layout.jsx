import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">
            <span className="logo-mark">K</span>
            <span>
              Conkreto <span className="logo-sub">/ directorio</span>
            </span>
          </Link>
          <div className="header-actions">
            {user?.role === 'admin' && (
              <Link to="/admin" className="header-admin-link">
                Admin
              </Link>
            )}
            <button type="button" className="header-admin-link" onClick={handleLogout}>
              Salir
            </button>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <p>Conkreto · accesos internos</p>
          <p className="footer-hint">Si un link no abre, probá estando en la red de la oficina o con la VPN.</p>
        </div>
      </footer>
    </div>
  );
}
