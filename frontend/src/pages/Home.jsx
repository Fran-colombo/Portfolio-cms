import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ProjectCard from '../components/ProjectCard';
import './Home.css';

export default function Home() {
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

  return (
    <div className="page home">
      <section className="hero container">
        <p className="hero-label">Software Developer</p>
        <h1 className="hero-title">Those are the projects I'm working on</h1>
        <p className="hero-subtitle">
          Hi, my name is Francesco, this is a curated showcase of applications I have designed and built — live demos, work in progress,
          and detailed project breakdowns.
        </p>
        <Link to="/projects" className="btn btn-primary">
          View all projects
        </Link>
      </section>

      <section className="featured container">
        <h2 className="section-title">Live projects</h2>
        <p className="section-subtitle">Explore working demos and detailed project breakdowns.</p>

        {loading && <div className="loading">Loading projects...</div>}
        {error && <div className="error-state">{error}</div>}
        {!loading && !error && projects.length === 0 && (
          <div className="empty-state">No live projects yet.</div>
        )}
        {!loading && !error && projects.length > 0 && (
          <div className="grid">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      {!loading && !error && incoming.length > 0 && (
        <section className="featured incoming-section container">
          <h2 className="section-title">Incoming</h2>
          <p className="section-subtitle">
            Projects currently in development — not yet deployed, but actively being built.
          </p>
          <div className="grid">
            {incoming.map((project) => (
              <ProjectCard key={project.id} project={project} incoming />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
