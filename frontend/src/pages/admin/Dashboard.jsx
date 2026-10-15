import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { displayHost } from '../../utils';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadProjects = () => {
    setLoading(true);
    setError(null);
    api
      .getAdminProjects()
      .then((list) =>
        setProjects(
          [...list].sort(
            (a, b) => a.category.localeCompare(b.category, 'es') || a.display_order - b.display_order,
          ),
        ),
      )
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (project) => {
    if (!window.confirm(`¿Borrar "${project.title}"? No se puede deshacer.`)) {
      return;
    }

    setActionError(null);
    try {
      await api.deleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleTogglePublish = async (project) => {
    setActionError(null);
    try {
      const result = await api.togglePublish(project.id);
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, published: result.published } : p)),
      );
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>Accesos</h1>
        <Link to="/admin/projects/new" className="btn btn-primary">
          Nuevo acceso
        </Link>
      </div>

      {loading && <div className="loading">Cargando...</div>}
      {error && <div className="error-state">{error}</div>}
      {actionError && <p className="form-error">{actionError}</p>}

      {!loading && !error && projects.length === 0 && (
        <div className="empty-state">
          Todavía no hay accesos. <Link to="/admin/projects/new">Cargá el primero</Link>.
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Carpeta</th>
                <th>Nombre</th>
                <th>URL / IP</th>
                <th>Orden</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <span className="tag">{project.category}</span>
                  </td>
                  <td>{project.title}</td>
                  <td className="admin-mono">
                    {project.demo_url ? (
                      <a href={project.demo_url} target="_blank" rel="noopener noreferrer">
                        {displayHost(project.demo_url)}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{project.display_order}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        !project.published
                          ? 'status-draft'
                          : project.is_incoming
                            ? 'status-incoming'
                            : 'status-published'
                      }`}
                    >
                      {!project.published ? 'Oculto' : project.is_incoming ? 'Próximamente' : 'Visible'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <Link to={`/admin/projects/${project.id}/edit`} className="btn btn-outline btn-sm">
                        Editar
                      </Link>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleTogglePublish(project)}
                      >
                        {project.published ? 'Ocultar' : 'Mostrar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(project)}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
