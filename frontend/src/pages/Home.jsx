import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { displayHost, groupByCategory } from '../utils';
import './Home.css';

function PageLink({ page }) {
  const pending = page.is_incoming || !page.demo_url;

  const content = (
    <>
      <span className="page-icon">
        {page.image_url ? <img src={page.image_url} alt="" /> : page.title.charAt(0).toUpperCase()}
      </span>
      <span className="page-info">
        <span className="page-title">{page.title}</span>
        {page.short_description && <span className="page-desc">{page.short_description}</span>}
        <span className="page-host">{pending ? 'Próximamente' : displayHost(page.demo_url)}</span>
      </span>
      {!pending && <span className="page-arrow">↗</span>}
    </>
  );

  if (pending) {
    return <div className="page-link page-link-pending">{content}</div>;
  }

  return (
    <a className="page-link" href={page.demo_url} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  );
}

export default function Home() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.all([api.getProjects(), api.getIncomingProjects()])
      .then(([live, incoming]) => setPages([...live, ...incoming]))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const folders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? pages.filter((p) =>
          [p.title, p.short_description, p.category, p.demo_url]
            .filter(Boolean)
            .some((field) => field.toLowerCase().includes(q)),
        )
      : pages;
    return groupByCategory(filtered);
  }, [pages, query]);

  return (
    <div className="page home">
      <section className="home-head container">
        <div>
          <p className="home-label">Directorio interno</p>
          <h1 className="home-title">Todos los accesos de Conkreto, en un solo lugar.</h1>
        </div>
        <input
          type="search"
          className="home-search"
          placeholder="Buscar página, carpeta o IP..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </section>

      <section className="container">
        {loading && <div className="loading">Cargando accesos...</div>}
        {error && <div className="error-state">{error}</div>}
        {!loading && !error && pages.length === 0 && (
          <div className="empty-state">Todavía no hay páginas cargadas. Agregalas desde el admin.</div>
        )}
        {!loading && !error && pages.length > 0 && folders.length === 0 && (
          <div className="empty-state">Nada coincide con &quot;{query}&quot;.</div>
        )}

        <div className="folders">
          {folders.map(([category, items]) => (
            <article key={category} className="folder">
              <header className="folder-head">
                <span className="folder-icon" aria-hidden="true" />
                <h2 className="folder-name">{category}</h2>
                <span className="folder-count">{items.length}</span>
              </header>
              <div className="folder-body">
                {items.map((page) => (
                  <PageLink key={page.id} page={page} />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
