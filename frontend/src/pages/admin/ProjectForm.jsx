import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { emptyToNull, normalizeUrl, slugify } from '../../utils';

const emptyForm = {
  title: '',
  slug: '',
  category: '',
  short_description: '',
  demo_url: '',
  image_url: '',
  display_order: 0,
  published: true,
  is_incoming: false,
};

export default function ProjectForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [legacy, setLegacy] = useState({});
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [slugManual, setSlugManual] = useState(false);

  useEffect(() => {
    api
      .getAdminProjects()
      .then((projects) => {
        setCategories([...new Set(projects.map((p) => p.category).filter(Boolean))].sort());

        if (!isEdit) return;
        const project = projects.find((p) => p.id === Number(id));
        if (!project) {
          throw new Error('No se encontró la página');
        }
        setForm({
          title: project.title,
          slug: project.slug,
          category: project.category,
          short_description: project.short_description,
          demo_url: project.demo_url || '',
          image_url: project.image_url || '',
          display_order: project.display_order,
          published: project.published,
          is_incoming: project.is_incoming,
        });
        setLegacy({
          description: project.description,
          technologies: project.technologies,
          features: project.features,
          repository_url: project.repository_url,
          test_guide: project.test_guide,
        });
        setSlugManual(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'title' && !slugManual) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...legacy,
      title: form.title.trim(),
      slug: form.slug.trim(),
      category: form.category.trim() || 'General',
      short_description: form.short_description.trim(),
      demo_url: normalizeUrl(form.demo_url),
      image_url: emptyToNull(form.image_url),
      display_order: Number(form.display_order) || 0,
      published: form.published,
      is_incoming: form.is_incoming,
    };

    try {
      if (isEdit) {
        await api.updateProject(Number(id), payload);
      } else {
        await api.createProject(payload);
      }
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>{isEdit ? 'Editar acceso' : 'Nuevo acceso'}</h1>
        <Link to="/admin" className="btn btn-outline btn-sm">
          Volver
        </Link>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="title">Nombre *</label>
            <input
              id="title"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Ej: Panel de stock"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="category">Carpeta *</label>
            <input
              id="category"
              list="category-options"
              value={form.category}
              onChange={(e) => updateField('category', e.target.value)}
              placeholder="Ej: Sistemas internos"
              required
            />
            <datalist id="category-options">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="demo_url">URL o IP</label>
          <input
            id="demo_url"
            value={form.demo_url}
            onChange={(e) => updateField('demo_url', e.target.value)}
            placeholder="192.168.1.20:8080 o https://..."
          />
          <small className="form-hint">Si no ponés http:// lo agregamos solos.</small>
        </div>

        <div className="form-group">
          <label htmlFor="short_description">Descripción corta</label>
          <input
            id="short_description"
            value={form.short_description}
            onChange={(e) => updateField('short_description', e.target.value)}
            placeholder="Para qué sirve, en una línea"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="image_url">Ícono (URL de imagen, opcional)</label>
            <input
              id="image_url"
              type="url"
              value={form.image_url}
              onChange={(e) => updateField('image_url', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="form-group">
            <label htmlFor="slug">Identificador *</label>
            <input
              id="slug"
              value={form.slug}
              onChange={(e) => {
                setSlugManual(true);
                updateField('slug', e.target.value);
              }}
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              title="Solo minúsculas, números y guiones"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="display_order">Orden dentro de la carpeta</label>
            <input
              id="display_order"
              type="number"
              value={form.display_order}
              onChange={(e) => updateField('display_order', e.target.value)}
              min="0"
            />
          </div>
          <div className="form-checks">
            <div className="form-group form-checkbox">
              <input
                id="published"
                type="checkbox"
                checked={form.published}
                onChange={(e) => updateField('published', e.target.checked)}
              />
              <label htmlFor="published">Visible en el directorio</label>
            </div>
            <div className="form-group form-checkbox">
              <input
                id="is_incoming"
                type="checkbox"
                checked={form.is_incoming}
                onChange={(e) => updateField('is_incoming', e.target.checked)}
              />
              <label htmlFor="is_incoming">Próximamente (se muestra sin link)</label>
            </div>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear acceso'}
          </button>
          <Link to="/admin" className="btn btn-outline">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
