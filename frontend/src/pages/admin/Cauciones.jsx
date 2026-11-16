import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import './Cauciones.css';

const DRAFT_KEY = 'cauciones_comparador';

const ESTADO = {
  vigente: 'Vigente',
  parada: 'Parada',
  renovar: 'Podés renovar',
  vencida: 'Vencida',
  avisada: 'Avisada',
};

const ars = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const pct = (value, digits = 2) =>
  `${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;

const fecha = (iso) => {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

const todayInput = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const emptyForm = () => ({
  persona: '',
  monto: '',
  tna: '',
  dias: '',
  fecha_inicio: todayInput(),
});

const blankRow = () => ({
  key: crypto.randomUUID(),
  monto: '',
  tna: '',
  dias: '',
  fecha_inicio: todayInput(),
});

function loadDraft() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (Array.isArray(parsed) && parsed.length >= 2) {
      return parsed.map((row) => ({ ...blankRow(), ...row, key: row.key || crypto.randomUUID() }));
    }
  } catch {
    /* el borrador se vuelve a armar */
  }
  return [blankRow(), blankRow()];
}

function toPayload(form) {
  const monto = Number(form.monto);
  const tna = Number(form.tna);
  const dias = Number(form.dias);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error('El monto tiene que ser mayor a cero');
  }
  if (!Number.isFinite(tna) || tna <= 0) {
    throw new Error('La TNA tiene que ser mayor a cero');
  }
  if (!Number.isInteger(dias) || dias < 1) {
    throw new Error('Los días tienen que ser un entero de 1 o más');
  }
  if (!form.fecha_inicio) {
    throw new Error('Falta la fecha de inicio');
  }
  return { monto, tna, dias, fecha_inicio: form.fecha_inicio };
}

function toSaved(form) {
  const persona = form.persona.trim().replace(/\s+/g, ' ');
  if (!persona) {
    throw new Error('Falta la persona');
  }
  return { ...toPayload(form), persona };
}

function Verdict({ name }) {
  const slug = (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
  return <span className={`verdict verdict-${slug}`}>{name}</span>;
}

function Resultado({ data }) {
  if (!data) return null;
  return (
    <div className="caucion-result">
      <div className="caucion-result-head">
        <Verdict name={data.veredicto} />
        <strong>{ars(data.interes)}</strong>
      </div>
      <p>{data.motivo}</p>
      <p className="caucion-resumen">{data.resumen}</p>
      <dl className="caucion-metrics">
        <div>
          <dt>Interés</dt>
          <dd>{ars(data.interes)}</dd>
        </div>
        <div>
          <dt>Por día</dt>
          <dd>{ars(data.ganancia_diaria)}</dd>
        </div>
        <div>
          <dt>Del período</dt>
          <dd>{pct(data.rendimiento_periodo, 4)}</dd>
        </div>
        <div>
          <dt>TEA</dt>
          <dd>{pct(data.tea)}</dd>
        </div>
        <div>
          <dt>TNA efectiva</dt>
          <dd>{pct(data.tna_efectiva)}</dd>
        </div>
        <div>
          <dt>Días parados</dt>
          <dd>{data.dias_parados}</dd>
        </div>
      </dl>
      {data.dias_parados > 0 && (
        <p className="form-hint">
          En esos días, al 20,83% de mercado, dejás de ganar {ars(data.costo_dias_parados)}.
        </p>
      )}
      <ul className="caucion-notes">
        {data.notas.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function Fields({ idPrefix, value, onChange, montoLabel = 'Monto', persona = false }) {
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value });
  return (
    <>
      {persona && (
        <div className="form-group">
          <label htmlFor={`${idPrefix}-persona`}>Persona</label>
          <input
            id={`${idPrefix}-persona`}
            value={value.persona}
            onChange={set('persona')}
            maxLength={80}
            required
          />
        </div>
      )}
      <div className="form-group">
        <label htmlFor={`${idPrefix}-monto`}>{montoLabel}</label>
        <input id={`${idPrefix}-monto`} type="number" min="0" step="0.01" value={value.monto} onChange={set('monto')} required />
      </div>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-tna`}>TNA anual %</label>
        <input id={`${idPrefix}-tna`} type="number" min="0" step="0.01" value={value.tna} onChange={set('tna')} required />
      </div>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-dias`}>Días</label>
        <input id={`${idPrefix}-dias`} type="number" min="1" step="1" value={value.dias} onChange={set('dias')} required />
      </div>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-inicio`}>Inicio</label>
        <input id={`${idPrefix}-inicio`} type="date" value={value.fecha_inicio} onChange={set('fecha_inicio')} required />
      </div>
    </>
  );
}

export default function Cauciones() {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [calcForm, setCalcForm] = useState(emptyForm);
  const [calcResult, setCalcResult] = useState(null);
  const [calcError, setCalcError] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const [rows, setRows] = useState(loadDraft);
  const [compareResult, setCompareResult] = useState(null);
  const [compareError, setCompareError] = useState(null);
  const [comparing, setComparing] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getCauciones()
      .then(setBook)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(rows));
  }, [rows]);

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const payload = toSaved(form);
      if (editingId) {
        await api.updateCaucion(editingId, payload);
      } else {
        await api.createCaucion(payload);
      }
      setForm(emptyForm());
      setEditingId(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      persona: item.persona === 'Sin persona' ? '' : item.persona,
      monto: String(item.monto),
      tna: String(item.tna),
      dias: String(item.dias),
      fecha_inicio: item.fecha_inicio,
    });
    setFormError(null);
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`¿Borrar la caución de ${item.persona}, ${ars(item.monto)} al ${pct(item.tna)}?`)) {
      return;
    }
    setFormError(null);
    try {
      await api.deleteCaucion(item.id);
      if (editingId === item.id) {
        setEditingId(null);
        setForm(emptyForm());
      }
      load();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleCalc = async (event) => {
    event.preventDefault();
    setCalcError(null);
    setCalculating(true);
    try {
      setCalcResult(await api.calcularCaucion(toPayload(calcForm)));
    } catch (err) {
      setCalcResult(null);
      setCalcError(err.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleCompare = async (event) => {
    event.preventDefault();
    setCompareError(null);
    setComparing(true);
    try {
      const items = rows.map(toPayload);
      if (items.length < 2) {
        throw new Error('Cargá al menos dos cauciones para comparar');
      }
      setCompareResult(await api.compararCauciones(items));
    } catch (err) {
      setCompareResult(null);
      setCompareError(err.message);
    } finally {
      setComparing(false);
    }
  };

  const referencia = book?.referencia;
  const avisos = (book?.items || []).filter((item) => item.estado === 'renovar' || item.estado === 'parada');

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Cauciones</h1>
          <p className="caucion-lead">Pesos. El mail sale a las 9:00 del día en que ya podés volver a colocar.</p>
        </div>
      </div>

      {referencia && (
        <div className="caucion-ref">
          <div className="caucion-stat">
            <span>Cauciones {referencia.fecha}</span>
            <strong>{pct(referencia.tna_cauciones)}</strong>
          </div>
          <div className="caucion-stat">
            <span>Plazo fijo 30 días</span>
            <strong>{pct(referencia.tna_plazo_fijo)}</strong>
          </div>
          <div className="caucion-stat">
            <span>Inflación mensual</span>
            <strong>{pct(referencia.inflacion_mensual)}</strong>
          </div>
          <div className="caucion-stat">
            <span>Inflación esperada 12 m</span>
            <strong>{pct(referencia.inflacion_esperada_12m)}</strong>
          </div>
        </div>
      )}
      {referencia && <p className="form-hint">{referencia.fuente}. La recomendación usa la TNA efectiva, no la pactada.</p>}

      {book && !book.smtp_configurado && (
        <p className="caucion-banner">
          El aviso por mail no está configurado. Las cauciones se guardan igual. Completá el SMTP en el entorno y reiniciá el backend.
        </p>
      )}
      {book && !book.feriados_disponibles && (
        <p className="caucion-banner">
          No pude traer todos los feriados. En los años que faltan, solo se descuentan sábados y domingos.
        </p>
      )}

      {avisos.map((item) => (
        <p className="caucion-banner" key={item.id}>
          {item.estado === 'renovar' && item.fecha_vencimiento === item.fecha_renovacion
            ? `${item.persona}: vence hoy y podés renovar ${ars(item.monto)} al ${pct(item.tna)}.`
            : item.estado === 'renovar'
              ? `${item.persona}: hoy podés colocar de nuevo ${ars(item.monto)} (venció el ${fecha(item.fecha_vencimiento)}).`
              : `${item.persona}: está parada hasta el ${fecha(item.fecha_renovacion)}, ${ars(item.monto)} al ${pct(item.tna)}.`}
          {' '}
          {item.resumen}
        </p>
      ))}

      <section className="caucion-section">
        <h2>{editingId ? 'Editar caución' : 'Cargar caución'}</h2>
        <p className="caucion-lead">
          Estas son las que avisan. El vencimiento es la fecha de inicio más los días corridos. El interés y el mail se arman por persona.
        </p>
        <form className="admin-form" onSubmit={handleSave}>
          <div className="caucion-fields with-persona">
            <Fields idPrefix="book" value={form} onChange={setForm} persona />
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar caución'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm());
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="caucion-section">
        <h2>Historial</h2>
        {loading && <div className="loading">Cargando...</div>}
        {error && <div className="error-state">{error}</div>}
        {book && (
          <>
            <h3>Total</h3>
            <div className="caucion-ref">
              <div className="caucion-stat">
                <span>Interés cobrado</span>
                <strong>{ars(book.acumulado.interes_cobrado)}</strong>
              </div>
              <div className="caucion-stat">
                <span>Interés de las vigentes</span>
                <strong>{ars(book.acumulado.interes_vigente)}</strong>
              </div>
              <div className="caucion-stat">
                <span>TNA ponderada</span>
                <strong>{pct(book.acumulado.tna_ponderada)}</strong>
              </div>
              <div className="caucion-stat">
                <span>Rendimiento del capital</span>
                <strong>{pct(book.acumulado.rendimiento_capital, 4)}</strong>
              </div>
            </div>
            <p className="form-hint">
              El total de arriba junta a todas las personas. Abajo, cada una tiene su interés, su TNA ponderada y su rendimiento.
            </p>
            {book.items.length === 0 ? (
              <p className="empty-state">Todavía no hay cauciones cargadas.</p>
            ) : (
              book.por_persona.map((persona) => (
                <PersonaBlock
                  key={persona.persona}
                  persona={persona}
                  items={book.items.filter(
                    (item) => item.persona.trim().toLocaleLowerCase() === persona.persona.trim().toLocaleLowerCase(),
                  )}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              ))
            )}
          </>
        )}
      </section>

      <section className="caucion-section">
        <h2>Calculadora</h2>
        <p className="caucion-lead">No se guarda y no manda mail. Sirve para ver si el plazo y la tasa cierran.</p>
        <form className="admin-form" onSubmit={handleCalc}>
          <div className="caucion-fields">
            <Fields idPrefix="calc" value={calcForm} onChange={setCalcForm} montoLabel="Patrimonio" />
          </div>
          {calcError && <p className="form-error">{calcError}</p>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={calculating}>
              {calculating ? 'Calculando...' : 'Calcular'}
            </button>
          </div>
        </form>
        <Resultado data={calcResult} />
      </section>

      <section className="caucion-section">
        <h2>Comparar</h2>
        <p className="caucion-lead">
          Misma cuenta. No se guardan. El orden de arriba es el que más conviene por tasa y plazo; el de abajo, el que deja más pesos.
        </p>
        <form onSubmit={handleCompare}>
          {rows.map((row, index) => (
            <div className="caucion-compare-row" key={row.key}>
              <span className="caucion-compare-index">{index + 1}</span>
              <div className="caucion-fields">
                <Fields
                  idPrefix={`cmp-${row.key}`}
                  value={row}
                  onChange={(next) => setRows((prev) => prev.map((item) => (item.key === row.key ? next : item)))}
                />
              </div>
              {rows.length > 2 && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setRows((prev) => prev.filter((item) => item.key !== row.key))}
                >
                  Quitar
                </button>
              )}
            </div>
          ))}
          {compareError && <p className="form-error">{compareError}</p>}
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setRows((prev) => [...prev, blankRow()])}>
              Agregar
            </button>
            <button type="submit" className="btn btn-primary" disabled={comparing}>
              {comparing ? 'Comparando...' : 'Comparar'}
            </button>
          </div>
        </form>
        {compareResult && (
          <div className="caucion-ranks">
            <Rank title="Más eficientes" items={compareResult.mas_eficiente} />
            <Rank title="Más plata en el período" items={compareResult.mas_plata} money />
          </div>
        )}
      </section>
    </div>
  );
}

function PersonaBlock({ persona, items, onEdit, onDelete }) {
  return (
    <div className="caucion-person">
      <h3>{persona.persona}</h3>
      <div className="caucion-ref">
        <div className="caucion-stat">
          <span>Interés cobrado</span>
          <strong>{ars(persona.interes_cobrado)}</strong>
        </div>
        <div className="caucion-stat">
          <span>Interés vigente</span>
          <strong>{ars(persona.interes_vigente)}</strong>
        </div>
        <div className="caucion-stat">
          <span>TNA ponderada</span>
          <strong>{pct(persona.tna_ponderada)}</strong>
        </div>
        <div className="caucion-stat">
          <span>Rendimiento</span>
          <strong>{pct(persona.rendimiento_capital, 4)}</strong>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Inicio</th>
              <th>Vence</th>
              <th>Renovás</th>
              <th>Monto</th>
              <th>Días</th>
              <th>TNA</th>
              <th>Efectiva</th>
              <th>Interés</th>
              <th>%</th>
              <th>Veredicto</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{fecha(item.fecha_inicio)}</td>
                <td>{fecha(item.fecha_vencimiento)}</td>
                <td>{fecha(item.fecha_renovacion)}</td>
                <td>{ars(item.monto)}</td>
                <td>{item.dias}</td>
                <td>{pct(item.tna)}</td>
                <td>{pct(item.tna_efectiva)}</td>
                <td>{ars(item.interes)}</td>
                <td>{pct(item.rendimiento_periodo, 4)}</td>
                <td>
                  <Verdict name={item.veredicto} />
                </td>
                <td>{ESTADO[item.estado] || item.estado}</td>
                <td>
                  <div className="admin-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => onEdit(item)}>
                      Editar
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(item)}>
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Rank({ title, items, money = false }) {
  return (
    <div>
      <h3>{title}</h3>
      <ol className="caucion-rank">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>
            <Verdict name={item.veredicto} />
            <strong>
              {ars(item.monto)} al {pct(item.tna)} por {item.dias} días
            </strong>
            <span>{money ? `Interés ${ars(item.interes)}` : `Efectiva ${pct(item.tna_efectiva)}`}</span>
            <p>{item.motivo}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
