import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const emptyForm = { email: '', password: '', role: 'member' };

export default function Users() {
  const { user: currentUser, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadUsers = () => {
    setLoading(true);
    setError(null);
    api
      .getUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionError(null);
    setSaving(true);
    try {
      const created = await api.createUser(form);
      setUsers((prev) => [...prev, created].sort((a, b) => a.email.localeCompare(b.email)));
      setForm(emptyForm);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action) => {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleToggleActive = (account) => {
    runAction(async () => {
      const updated = await api.updateUser(account.id, { is_active: !account.is_active });
      setUsers((prev) => prev.map((item) => (item.id === account.id ? updated : item)));
    });
  };

  const handleRole = (account) => {
    const nextRole = account.role === 'admin' ? 'member' : 'admin';
    const label = nextRole === 'admin' ? 'admin' : 'miembro';
    if (!window.confirm(`¿Pasar a ${account.email} a ${label}?`)) {
      return;
    }
    runAction(async () => {
      const updated = await api.updateUser(account.id, { role: nextRole });
      setUsers((prev) => prev.map((item) => (item.id === account.id ? updated : item)));
    });
  };

  const handlePassword = (account) => {
    const password = window.prompt(`Nueva contraseña para ${account.email} (mínimo 8 caracteres)`);
    if (!password) {
      return;
    }
    if (password.length < 8) {
      setActionError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    runAction(async () => {
      await api.updateUser(account.id, { password });
    });
  };

  const handleResetTotp = (account) => {
    if (!window.confirm(`¿Resetear el segundo factor de ${account.email}? Va a tener que vincular la app de nuevo.`)) {
      return;
    }
    runAction(async () => {
      const updated = await api.resetUserTotp(account.id);
      setUsers((prev) => prev.map((item) => (item.id === account.id ? updated : item)));
    });
  };

  const handleDelete = (account) => {
    const own = account.id === currentUser?.id;
    const message = own
      ? 'Vas a borrar tu propia cuenta y salir de la sesión.'
      : `¿Borrar a ${account.email}? No se puede deshacer.`;
    if (!window.confirm(message)) {
      return;
    }
    runAction(async () => {
      await api.deleteUser(account.id);
      if (own) {
        logout();
        return;
      }
      setUsers((prev) => prev.filter((item) => item.id !== account.id));
    });
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>Usuarios</h1>
      </div>

      <form className="admin-form user-create" onSubmit={handleCreate}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="user-email">Email</label>
            <input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="user-password">Contraseña</label>
            <input
              id="user-password"
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="user-role">Rol</label>
            <select
              id="user-role"
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
            >
              <option value="member">Miembro</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </div>
        <p className="form-hint">
          Un admin nuevo vincula la app autenticadora la primera vez que entra. Los miembros solo usan email y contraseña.
        </p>
      </form>

      {loading && <div className="loading">Cargando...</div>}
      {error && <div className="error-state">{error}</div>}
      {actionError && <p className="form-error">{actionError}</p>}

      {!loading && !error && users.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>2FA</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => {
                const isSelf = account.id === currentUser?.id;
                return (
                  <tr key={account.id}>
                    <td>{account.email}</td>
                    <td>{account.role === 'admin' ? 'Admin' : 'Miembro'}</td>
                    <td>
                      <span className={`status-badge ${account.is_active ? 'status-published' : 'status-draft'}`}>
                        {account.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>{account.role === 'admin' ? (account.totp_enabled ? 'Activo' : 'Pendiente') : '—'}</td>
                    <td>
                      <div className="admin-actions">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleToggleActive(account)}>
                          {account.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleRole(account)}>
                          {account.role === 'admin' ? 'Hacer miembro' : 'Hacer admin'}
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => handlePassword(account)}>
                          Contraseña
                        </button>
                        {account.role === 'admin' && !isSelf && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleResetTotp(account)}>
                            Reset 2FA
                          </button>
                        )}
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(account)}>
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
