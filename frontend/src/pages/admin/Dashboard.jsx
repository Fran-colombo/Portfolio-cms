import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

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
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (project) => {
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) {
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
        <h1>Projects</h1>
        <Link to="/admin/projects/new" className="btn btn-primary">
          New project
        </Link>
      </div>

      {loading && <div className="loading">Loading projects...</div>}
      {error && <div className="error-state">{error}</div>}
      {actionError && <p className="form-error">{actionError}</p>}

      {!loading && !error && projects.length === 0 && (
        <div className="empty-state">
          No projects yet. <Link to="/admin/projects/new">Create your first project</Link>.
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Order</th>
                <th>Status</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.title}</td>
                  <td>{project.slug}</td>
                  <td>{project.display_order}</td>
                  <td>
                    <span
                      className={`status-badge ${project.published ? 'status-published' : 'status-draft'}`}
                    >
                      {project.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${project.is_incoming ? 'status-incoming' : 'status-live'}`}>
                      {project.is_incoming ? 'Incoming' : 'Live'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <Link to={`/admin/projects/${project.id}/edit`} className="btn btn-outline btn-sm">
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleTogglePublish(project)}
                      >
                        {project.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(project)}
                      >
                        Delete
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
