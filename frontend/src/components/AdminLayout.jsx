import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';
import './AdminLayout.css';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="container admin-header-inner">
          <div>
            <Link to="/admin" className="admin-logo">
              <span className="logo-mark">K</span>
              Conkreto <span className="admin-logo-sub">/ admin</span>
            </Link>
            {user && <span className="admin-user">{user.email}</span>}
          </div>
          <div className="admin-header-actions">
            <Link to="/" className="btn btn-outline btn-sm">
              Ver directorio
            </Link>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout}>
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="admin-main container">
        <Outlet />
      </main>
    </div>
  );
}
