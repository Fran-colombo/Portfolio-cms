import { useEffect, useState } from 'react';
import { api } from '../api/client';
import ProjectCard from '../components/ProjectCard';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getProjects(), api.getIncomingProjects()])
      .then(([live, inProgress]) => {
        setProjects(live);
        setIncoming(inProgress);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const hasAny = projects.length > 0 || incoming.length > 0;

  return (
    <div className="page container">
      <h1 className="section-title">All projects</h1>
      <p className="section-subtitle">
        Live demos, repositories, and projects currently in development.
      </p>

      {loading && <div className="loading">Loading projects...</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && !error && !hasAny && (
        <div className="empty-state">No published projects yet.</div>
      )}

      {!loading && !error && hasAny && (
        <>
          <h2 className="subsection-title">Live projects</h2>
          {projects.length === 0 ? (
            <p className="section-subtitle">No live projects with demos yet.</p>
          ) : (
            <div className="grid">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}

          {incoming.length > 0 && (
            <>
              <h2 className="subsection-title incoming-heading">Incoming</h2>
              <p className="section-subtitle">
                Work in progress — details available, demos coming soon.
              </p>
              <div className="grid">
                {incoming.map((project) => (
                  <ProjectCard key={project.id} project={project} incoming />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
