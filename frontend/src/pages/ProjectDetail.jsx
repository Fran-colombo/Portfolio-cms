import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import './ProjectDetail.css';

export default function ProjectDetail() {
  const { slug } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getProject(slug)
      .then(setProject)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="page container loading">Loading project...</div>;
  }

  if (error || !project) {
    return (
      <div className="page container">
        <div className="error-state">{error || 'Project not found'}</div>
        <Link to="/projects" className="btn btn-outline">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="page project-detail">
      {project.image_url && (
        <div className="project-hero-image">
          <img src={project.image_url} alt={project.title} />
        </div>
      )}

      <div className="container project-detail-inner">
        <Link to="/projects" className="back-link">
          &larr; All projects
        </Link>

        <header className="project-header">
          <h1>{project.title}</h1>
          {project.is_incoming && <span className="incoming-detail-badge">In progress</span>}
          {project.short_description && <p className="project-lead">{project.short_description}</p>}

          <div className="project-cta">
            {project.is_incoming && !project.demo_url && (
              <span className="btn btn-incoming">Demo coming soon</span>
            )}
            {!project.is_incoming && project.demo_url && (
              <a href={project.demo_url} target="_blank" rel="noopener noreferrer" className="btn btn-demo">
                Launch DEMO
              </a>
            )}
            {project.repository_url && (
              <a
                href={project.repository_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
              >
                View repository
              </a>
            )}
          </div>
        </header>

        {project.description && (
          <section className="detail-section">
            <h2>Overview</h2>
            <p className="detail-text">{project.description}</p>
          </section>
        )}

        {project.features?.length > 0 && (
          <section className="detail-section">
            <h2>Features</h2>
            <ul className="detail-list">
              {project.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>
        )}

        {project.technologies?.length > 0 && (
          <section className="detail-section">
            <h2>Technologies</h2>
            <div className="tech-tags">
              {project.technologies.map((tech) => (
                <span key={tech} className="tag">
                  {tech}
                </span>
              ))}
            </div>
          </section>
        )}

        {project.test_guide?.length > 0 && (
          <section className="detail-section">
            <h2>Test guide</h2>
            <ol className="detail-list numbered">
              {project.test_guide.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
