import { Link, Outlet } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
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
          <Link to="/admin/login" className="header-admin-link">
            Admin
          </Link>
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
