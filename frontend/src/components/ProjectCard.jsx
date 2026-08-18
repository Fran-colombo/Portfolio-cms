import { Link } from 'react-router-dom';
import './ProjectCard.css';

export default function ProjectCard({ project, incoming = false }) {
  const isIncoming = incoming || project.is_incoming;

  return (
    <article className={`project-card ${isIncoming ? 'project-card-incoming' : ''}`}>
      {project.image_url && (
        <div className="project-card-image">
          <img src={project.image_url} alt={project.title} loading="lazy" />
          {isIncoming && <span className="project-card-badge">In progress</span>}
        </div>
      )}
      {!project.image_url && isIncoming && (
        <div className="project-card-image project-card-image-placeholder">
          <span className="project-card-badge">In progress</span>
        </div>
      )}
      <div className="project-card-body">
        <h3 className="project-card-title">{project.title}</h3>
        <p className="project-card-desc">{project.short_description}</p>
        {project.technologies?.length > 0 && (
          <div className="project-card-tags">
            {project.technologies.map((tech) => (
              <span key={tech} className="tag">
                {tech}
              </span>
            ))}
          </div>
        )}
        <div className="project-card-actions">
          <Link to={`/projects/${project.slug}`} className="btn btn-outline btn-sm">
            View project
          </Link>
          {!isIncoming && project.demo_url && (
            <a href={project.demo_url} target="_blank" rel="noopener noreferrer" className="btn btn-demo btn-sm">
              DEMO
            </a>
          )}
          {project.repository_url && (
            <a
              href={project.repository_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              Repository
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
