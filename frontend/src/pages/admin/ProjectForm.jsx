import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { arrayToLines, emptyToNull, linesToArray, slugify } from '../../utils';

const emptyForm = {
  title: '',
  slug: '',
  short_description: '',
  description: '',
  technologies: '',
  features: '',
  demo_url: '',
  repository_url: '',
  image_url: '',
  test_guide: '',
  display_order: 0,
  published: false,
  is_incoming: false,
};

export default function ProjectForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [slugManual, setSlugManual] = useState(false);

  useEffect(() => {
    if (!isEdit) return;

    setLoading(true);
    api
      .getAdminProjects()
      .then((projects) => {
        const project = projects.find((p) => p.id === Number(id));
        if (!project) {
          throw new Error('Project not found');
        }
        setForm({
          title: project.title,
          slug: project.slug,
          short_description: project.short_description,
          description: project.description,
          technologies: arrayToLines(project.technologies),
          features: arrayToLines(project.features),
          demo_url: project.demo_url || '',
          repository_url: project.repository_url || '',
          image_url: project.image_url || '',
          test_guide: arrayToLines(project.test_guide),
          display_order: project.display_order,
          published: project.published,
          is_incoming: project.is_incoming,
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
      title: form.title.trim(),
      slug: form.slug.trim(),
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      technologies: linesToArray(form.technologies),
      features: linesToArray(form.features),
      demo_url: emptyToNull(form.demo_url),
      repository_url: emptyToNull(form.repository_url),
      image_url: emptyToNull(form.image_url),
      test_guide: linesToArray(form.test_guide),
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
    return <div className="loading">Loading project...</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>{isEdit ? 'Edit project' : 'New project'}</h1>
        <Link to="/admin" className="btn btn-outline btn-sm">
          Back to dashboard
        </Link>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              id="title"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="slug">Slug *</label>
            <input
              id="slug"
              value={form.slug}
              onChange={(e) => {
                setSlugManual(true);
                updateField('slug', e.target.value);
              }}
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              title="Lowercase letters, numbers, and hyphens only"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="short_description">Short description</label>
          <input
            id="short_description"
            value={form.short_description}
            onChange={(e) => updateField('short_description', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Full description</label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={5}
          />
        </div>

        <div className="form-group">
          <label htmlFor="technologies">Technologies (one per line)</label>
          <textarea
            id="technologies"
            value={form.technologies}
            onChange={(e) => updateField('technologies', e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="features">Features (one per line)</label>
          <textarea
            id="features"
            value={form.features}
            onChange={(e) => updateField('features', e.target.value)}
            rows={4}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="demo_url">Demo URL</label>
            <input
              id="demo_url"
              type="url"
              value={form.demo_url}
              onChange={(e) => updateField('demo_url', e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="form-group">
            <label htmlFor="repository_url">Repository URL</label>
            <input
              id="repository_url"
              type="url"
              value={form.repository_url}
              onChange={(e) => updateField('repository_url', e.target.value)}
              placeholder="https://github.com/..."
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="image_url">Image URL</label>
          <input
            id="image_url"
            type="url"
            value={form.image_url}
            onChange={(e) => updateField('image_url', e.target.value)}
            placeholder="https://"
          />
        </div>

        <div className="form-group">
          <label htmlFor="test_guide">Test guide steps (one per line)</label>
          <textarea
            id="test_guide"
            value={form.test_guide}
            onChange={(e) => updateField('test_guide', e.target.value)}
            rows={4}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="display_order">Display order</label>
            <input
              id="display_order"
              type="number"
              value={form.display_order}
              onChange={(e) => updateField('display_order', e.target.value)}
              min="0"
            />
          </div>
          <div className="form-group form-checkbox">
            <input
              id="published"
              type="checkbox"
              checked={form.published}
              onChange={(e) => updateField('published', e.target.checked)}
            />
            <label htmlFor="published">Published</label>
          </div>
          <div className="form-group form-checkbox">
            <input
              id="is_incoming"
              type="checkbox"
              checked={form.is_incoming}
              onChange={(e) => updateField('is_incoming', e.target.checked)}
            />
            <label htmlFor="is_incoming">Incoming (in progress, no demo yet)</label>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update project' : 'Create project'}
          </button>
          <Link to="/admin" className="btn btn-outline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
