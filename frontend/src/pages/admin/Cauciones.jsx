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

const emptyCaucion = () => ({
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

function toMoney(value, { allowZero = false } = {}) {
  const monto = Number(value);
  if (!Number.isFinite(monto) || monto < 0 || (!allowZero && monto === 0)) {
    throw new Error(allowZero ? 'El monto no puede ser negativo' : 'El monto tiene que ser mayor a cero');
  }
  return monto;
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

function Fields({ idPrefix, value, onChange, montoLabel = 'Monto' }) {
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value });
  return (
    <>
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

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="caucion-modal-backdrop" onMouseDown={onClose}>
      <div
        className="caucion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="caucion-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="caucion-modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function Cauciones() {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [email, setEmail] = useState('');
  const [mailError, setMailError] = useState(null);
  const [savingMail, setSavingMail] = useState(false);

  const [calcForm, setCalcForm] = useState(emptyCaucion);
  const [calcResult, setCalcResult] = useState(null);
  const [calcError, setCalcError] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const [rollForm, setRollForm] = useState(() => ({
    monto: '',
    tna: '',
    cada: '2',
    durante: '20',
    fecha_inicio: todayInput(),
  }));
  const [rollResult, setRollResult] = useState(null);
  const [rollError, setRollError] = useState(null);
  const [rolling, setRolling] = useState(false);

  const [rows, setRows] = useState(loadDraft);
  const [compareResult, setCompareResult] = useState(null);
  const [compareError, setCompareError] = useState(null);
  const [comparing, setComparing] = useState(false);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    return api
      .getCauciones()
      .then((data) => {
        setBook(data);
        return data;
      })
      .catch((err) => {
        setError(err.message);
        throw err;
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(rows));
  }, [rows]);

  const perfiles = book?.perfiles || [];
  const selected = perfiles.find((item) => item.id === selectedId) || perfiles[0] || null;

  useEffect(() => {
    setEmail(selected?.email || '');
    setMailError(null);
  }, [selected?.id, selected?.email]);

  const closeDialog = () => setDialog(null);

  const openPersona = () => {
    setDialog({ type: 'persona', nombre: '', email: '', error: null, busy: false });
  };

  const openCaucion = (item) => {
    setDialog({
      type: 'caucion',
      id: item?.id || null,
      personaId: item?.persona_id || selected?.id,
      form: item
        ? {
            monto: String(item.monto),
            tna: String(item.tna),
            dias: String(item.dias),
            fecha_inicio: item.fecha_inicio.slice(0, 10),
          }
        : emptyCaucion(),
      error: null,
      busy: false,
    });
  };

  const openOtra = (otra) => {
    setDialog({
      type: 'otra',
      id: otra?.id || null,
      nombre: otra?.nombre || '',
      monto: otra ? String(otra.monto) : '',
      error: null,
      busy: false,
    });
  };

  const askConfirm = ({ title, message, confirmLabel, run }) => {
    setDialog({ type: 'confirm', title, message, confirmLabel, run, error: null, busy: false });
  };

  const savePersona = async (event) => {
    event.preventDefault();
    const nombre = dialog.nombre.trim().replace(/\s+/g, ' ');
    const mail = dialog.email.trim();
    if (!nombre) {
      setDialog((current) => ({ ...current, error: 'Falta el nombre' }));
      return;
    }
    if (!mail.includes('@')) {
      setDialog((current) => ({ ...current, error: 'Falta el mail de la persona' }));
      return;
    }
    setDialog((current) => ({ ...current, busy: true, error: null }));
    try {
      const created = await api.createPersona({ nombre, email: mail });
      await load(true);
      setSelectedId(created.id);
      setDialog({
        type: 'alert',
        title: 'Perfil creado',
        message: `${created.nombre} quedó creado. El patrimonio se arma con sus cauciones y con Otras. Los avisos salen a ${created.email}.`,
      });
    } catch (err) {
      setDialog((current) => ({ ...current, busy: false, error: err.message }));
    }
  };

  const saveMail = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const mail = email.trim();
    if (!mail.includes('@')) {
      setMailError('Falta el mail de la persona');
      return;
    }
    setMailError(null);
    setSavingMail(true);
    try {
      await api.updatePersona(selected.id, { nombre: selected.nombre, email: mail });
      await load(true);
      setDialog({
        type: 'alert',
        title: 'Mail guardado',
        message: `Los avisos de ${selected.nombre} salen a ${mail}, desde mailconkreto@gmail.com.`,
      });
    } catch (err) {
      setMailError(err.message);
    } finally {
      setSavingMail(false);
    }
  };

  const saveCaucion = async (event) => {
    event.preventDefault();
    setDialog((current) => ({ ...current, busy: true, error: null }));
    try {
      const payload = { ...toPayload(dialog.form), persona_id: dialog.personaId };
      const editing = Boolean(dialog.id);
      if (editing) {
        await api.updateCaucion(dialog.id, payload);
      } else {
        await api.createCaucion(payload);
      }
      await load(true);
      const nombre = selected?.nombre || 'la persona';
      setDialog({
        type: 'alert',
        title: editing ? 'Cambios guardados' : 'Caución cargada',
        message: editing
          ? `La caución de ${nombre} quedó actualizada.`
          : `Quedó guardada en ${nombre}. El aviso sale a su mail el día en que ya puede volver a colocar.`,
      });
    } catch (err) {
      setDialog((current) => (current?.type === 'caucion' ? { ...current, busy: false, error: err.message } : current));
    }
  };

  const saveOtra = async (event) => {
    event.preventDefault();
    const nombre = dialog.nombre.trim().replace(/\s+/g, ' ');
    if (!nombre) {
      setDialog((current) => ({ ...current, error: 'Falta el nombre' }));
      return;
    }
    setDialog((current) => ({ ...current, busy: true, error: null }));
    try {
      const payload = { nombre, monto: toMoney(dialog.monto, { allowZero: true }) };
      const editing = Boolean(dialog.id);
      if (editing) {
        await api.updateOtra(dialog.id, payload);
      } else {
        await api.createOtra(selected.id, payload);
      }
      await load(true);
      setDialog({
        type: 'alert',
        title: editing ? 'Otra actualizada' : 'Otra cargada',
        message: editing
          ? `${nombre} quedó en ${ars(payload.monto)}.`
          : `${nombre} se sumó al patrimonio de ${selected.nombre}.`,
      });
    } catch (err) {
      setDialog((current) => (current?.type === 'otra' ? { ...current, busy: false, error: err.message } : current));
    }
  };

  const runConfirm = async () => {
    setDialog((current) => ({ ...current, busy: true, error: null }));
    try {
      const done = await dialog.run();
      await load(true);
      setDialog({ type: 'alert', title: done.title, message: done.message });
    } catch (err) {
      setDialog((current) => (current?.type === 'confirm' ? { ...current, busy: false, error: err.message } : current));
    }
  };

  const askDeleteCaucion = (item) => {
    askConfirm({
      title: 'Borrar caución',
      message: `¿Borrar la caución de ${item.persona}, ${ars(item.monto)} al ${pct(item.tna)}?`,
      confirmLabel: 'Borrar',
      run: async () => {
        await api.deleteCaucion(item.id);
        return {
          title: 'Caución borrada',
          message: `Se borró del historial de ${item.persona}.`,
        };
      },
    });
  };

  const askDeleteOtra = (otra) => {
    askConfirm({
      title: 'Borrar otra',
      message: `¿Borrar ${otra.nombre} (${ars(otra.monto)}) del patrimonio de ${selected.nombre}?`,
      confirmLabel: 'Borrar',
      run: async () => {
        await api.deleteOtra(otra.id);
        return {
          title: 'Otra borrada',
          message: `${otra.nombre} ya no suma en el patrimonio de ${selected.nombre}.`,
        };
      },
    });
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

  const handleRoll = async (event) => {
    event.preventDefault();
    setRollError(null);
    setRolling(true);
    try {
      const monto = Number(rollForm.monto);
      const tna = Number(rollForm.tna);
      const cada = Number(rollForm.cada);
      const durante = Number(rollForm.durante);
      if (!Number.isFinite(monto) || monto <= 0) {
        throw new Error('El monto tiene que ser mayor a cero');
      }
      if (!Number.isFinite(tna) || tna <= 0) {
        throw new Error('La TNA tiene que ser mayor a cero');
      }
      if (!Number.isInteger(cada) || cada < 1) {
        throw new Error('Los días de cada renovación tienen que ser un entero de 1 o más');
      }
      if (!Number.isInteger(durante) || durante < cada) {
        throw new Error('El plazo tiene que alcanzar para aunque sea una renovación');
      }
      if (!rollForm.fecha_inicio) {
        throw new Error('Falta la fecha de inicio');
      }
      setRollResult(
        await api.proyectarCaucion({
          monto,
          tna,
          cada,
          durante,
          fecha_inicio: rollForm.fecha_inicio,
        }),
      );
    } catch (err) {
      setRollResult(null);
      setRollError(err.message);
    } finally {
      setRolling(false);
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
  const avisos = (selected?.cauciones || []).filter((item) => item.estado === 'renovar' || item.estado === 'parada');

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
      {referencia && (
        <p className="form-hint">
          {referencia.fuente}. Superar el {pct(referencia.tna_cauciones)} no alcanza para que convenga. La
          recomendación mira la TNA efectiva: de 8 a 30 días pide al menos 22,80%. Una caución al 21,90% por 10 días
          queda en Poco premio: le gana al promedio y al plazo fijo, y no llega a ese premio. Plazo fijo e inflación
          son contexto, no el sí o el no.
        </p>
      )}

      {book && !book.smtp_configurado && (
        <p className="caucion-banner">
          Los avisos salen desde mailconkreto@gmail.com. Falta la contraseña de aplicación en SMTP_PASSWORD. Las cauciones se guardan igual.
        </p>
      )}
      {book && !book.feriados_disponibles && (
        <p className="caucion-banner">
          No pude traer todos los feriados. En los años que faltan, solo se descuentan sábados y domingos.
        </p>
      )}

      <div className="caucion-tabs" role="tablist">
        {perfiles.map((persona) => (
          <button
            key={persona.id}
            type="button"
            role="tab"
            aria-selected={selected?.id === persona.id}
            className={`caucion-tab${selected?.id === persona.id ? ' is-active' : ''}`}
            onClick={() => setSelectedId(persona.id)}
          >
            {persona.nombre}
          </button>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={openPersona}>
          Nueva persona
        </button>
      </div>

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
        {loading && <div className="loading">Cargando...</div>}
        {error && <div className="error-state">{error}</div>}
        {book && !selected && <p className="empty-state">Creá un perfil para ver el patrimonio y cargar cauciones.</p>}
        {selected && (
          <>
            <h2>{selected.nombre}</h2>
            <form className="caucion-mail" onSubmit={saveMail}>
              <div className="form-group">
                <label htmlFor="perfil-mail">Mail que recibe el aviso</label>
                <input
                  id="perfil-mail"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="nombre@correo.com"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingMail}>
                {savingMail ? 'Guardando...' : 'Guardar mail'}
              </button>
            </form>
            {mailError && <p className="form-error">{mailError}</p>}
            <p className="form-hint">
              Los avisos de {selected.nombre} salen a este mail, desde mailconkreto@gmail.com.
            </p>

            <div className="caucion-ref cols-3">
              <div className="caucion-stat">
                <span>En cauciones</span>
                <strong>{ars(selected.patrimonio.en_cauciones)}</strong>
              </div>
              <div className="caucion-stat">
                <span>En otras</span>
                <strong>{ars(selected.patrimonio.en_otras)}</strong>
              </div>
              <div className="caucion-stat">
                <span>Patrimonio</span>
                <strong>{ars(selected.patrimonio.total)}</strong>
              </div>
            </div>
            <p className="form-hint">
              El patrimonio suma el capital que sigue colocado más Otras. Las cauciones ya vencidas quedan en el historial y no se cuentan otra vez.
            </p>

            <div className="caucion-ref">
              <div className="caucion-stat">
                <span>Interés cobrado</span>
                <strong>{ars(selected.acumulado.interes_cobrado)}</strong>
              </div>
              <div className="caucion-stat">
                <span>Interés vigente</span>
                <strong>{ars(selected.acumulado.interes_vigente)}</strong>
              </div>
              <div className="caucion-stat">
                <span>TNA ponderada</span>
                <strong>{pct(selected.acumulado.tna_ponderada)}</strong>
              </div>
              <div className="caucion-stat">
                <span>Rendimiento</span>
                <strong>{pct(selected.acumulado.rendimiento_capital, 4)}</strong>
              </div>
            </div>

            <div className="caucion-toolbar">
              <h3>Cauciones</h3>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openCaucion(null)}>
                Cargar caución
              </button>
            </div>
            {selected.cauciones.length === 0 ? (
              <p className="empty-state">Todavía no hay cauciones de {selected.nombre}.</p>
            ) : (
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
                    {selected.cauciones.map((item) => (
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
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => openCaucion(item)}>
                              Editar
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => askDeleteCaucion(item)}>
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

            <div className="caucion-toolbar">
              <h3>Otras</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => openOtra(null)}>
                Agregar
              </button>
            </div>
            <p className="form-hint">Saldos que no son caución. Actualizalos cuando quieras: se pisa el monto y queda la fecha.</p>
            {selected.otras.length === 0 ? (
              <p className="empty-state">Nada cargado en Otras.</p>
            ) : (
              <ul className="caucion-otras">
                {selected.otras.map((otra) => (
                  <li key={otra.id}>
                    <div>
                      <strong>{otra.nombre}</strong>
                      <span>{ars(otra.monto)}</span>
                      {otra.updated_at && <small>Actualizado el {fecha(otra.updated_at)}</small>}
                    </div>
                    <div className="admin-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => openOtra(otra)}>
                        Actualizar
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => askDeleteOtra(otra)}>
                        Borrar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="caucion-section">
        <h2>Calculadora</h2>
        <p className="caucion-lead">No se guarda y no manda mail. Sirve para ver si el plazo y la tasa cierran.</p>
        <form className="admin-form" onSubmit={handleCalc}>
          <div className="caucion-fields">
            <Fields idPrefix="calc" value={calcForm} onChange={setCalcForm} />
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
        <h2>Si lo renovás</h2>
        <p className="caucion-lead">
          No se guarda. Dejás un monto a una tasa promedio y lo volvés a colocar cada tantos días, durante el plazo que elijas.
        </p>
        <form className="admin-form" onSubmit={handleRoll}>
          <div className="caucion-fields caucion-fields-roll">
            <div className="form-group">
              <label htmlFor="roll-monto">Monto</label>
              <input
                id="roll-monto"
                type="number"
                min="0"
                step="0.01"
                value={rollForm.monto}
                onChange={(event) => setRollForm((prev) => ({ ...prev, monto: event.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="roll-tna">TNA promedio %</label>
              <input
                id="roll-tna"
                type="number"
                min="0"
                step="0.01"
                value={rollForm.tna}
                onChange={(event) => setRollForm((prev) => ({ ...prev, tna: event.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="roll-cada">Renovás cada</label>
              <input
                id="roll-cada"
                type="number"
                min="1"
                step="1"
                value={rollForm.cada}
                onChange={(event) => setRollForm((prev) => ({ ...prev, cada: event.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="roll-durante">Durante (días)</label>
              <input
                id="roll-durante"
                type="number"
                min="1"
                step="1"
                value={rollForm.durante}
                onChange={(event) => setRollForm((prev) => ({ ...prev, durante: event.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="roll-inicio">Desde</label>
              <input
                id="roll-inicio"
                type="date"
                value={rollForm.fecha_inicio}
                onChange={(event) => setRollForm((prev) => ({ ...prev, fecha_inicio: event.target.value }))}
                required
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setRollForm((prev) => ({ ...prev, durante: '20' }))}>
              20 días
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setRollForm((prev) => ({ ...prev, durante: '30' }))}>
              Un mes (30 días)
            </button>
            <button type="submit" className="btn btn-primary" disabled={rolling}>
              {rolling ? 'Calculando...' : 'Calcular'}
            </button>
          </div>
          {rollError && <p className="form-error">{rollError}</p>}
        </form>
        <Proyeccion data={rollResult} />
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

      {dialog?.type === 'persona' && (
        <Modal title="Nueva persona" onClose={closeDialog}>
          <form className="admin-form" onSubmit={savePersona}>
            <div className="form-group">
              <label htmlFor="nueva-nombre">Nombre</label>
              <input
                id="nueva-nombre"
                value={dialog.nombre}
                onChange={(event) => setDialog((current) => ({ ...current, nombre: event.target.value }))}
                maxLength={80}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="nueva-mail">Mail que recibe el aviso</label>
              <input
                id="nueva-mail"
                type="email"
                value={dialog.email}
                onChange={(event) => setDialog((current) => ({ ...current, email: event.target.value }))}
                autoComplete="email"
                placeholder="nombre@correo.com"
                required
              />
            </div>
            <p className="form-hint">Desde mailconkreto@gmail.com, a las 9:00 del día en que puede volver a colocar.</p>
            {dialog.error && <p className="form-error">{dialog.error}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={dialog.busy}>
                {dialog.busy ? 'Guardando...' : 'Crear perfil'}
              </button>
              <button type="button" className="btn btn-outline" onClick={closeDialog} disabled={dialog.busy}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dialog?.type === 'caucion' && (
        <Modal title={dialog.id ? 'Editar caución' : 'Cargar caución'} onClose={closeDialog}>
          <p className="caucion-lead">
            El vencimiento es la fecha de inicio más los días corridos. Queda en {selected?.nombre}.
          </p>
          <form className="admin-form" onSubmit={saveCaucion}>
            <div className="caucion-fields">
              <Fields idPrefix="modal-caucion" value={dialog.form} onChange={(form) => setDialog((current) => ({ ...current, form }))} />
            </div>
            {dialog.error && <p className="form-error">{dialog.error}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={dialog.busy}>
                {dialog.busy ? 'Guardando...' : dialog.id ? 'Guardar cambios' : 'Guardar caución'}
              </button>
              <button type="button" className="btn btn-outline" onClick={closeDialog} disabled={dialog.busy}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dialog?.type === 'otra' && (
        <Modal title={dialog.id ? 'Actualizar otra' : 'Agregar otra'} onClose={closeDialog}>
          <form className="admin-form" onSubmit={saveOtra}>
            <div className="form-group">
              <label htmlFor="otra-nombre">Nombre</label>
              <input
                id="otra-nombre"
                value={dialog.nombre}
                onChange={(event) => setDialog((current) => ({ ...current, nombre: event.target.value }))}
                maxLength={80}
                placeholder="Dólares, FCI..."
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="otra-monto">Monto actual</label>
              <input
                id="otra-monto"
                type="number"
                min="0"
                step="0.01"
                value={dialog.monto}
                onChange={(event) => setDialog((current) => ({ ...current, monto: event.target.value }))}
                required
              />
            </div>
            <p className="form-hint">Se guarda este saldo y la fecha de hoy. No arma un historial diario.</p>
            {dialog.error && <p className="form-error">{dialog.error}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={dialog.busy}>
                {dialog.busy ? 'Guardando...' : dialog.id ? 'Guardar monto' : 'Agregar'}
              </button>
              <button type="button" className="btn btn-outline" onClick={closeDialog} disabled={dialog.busy}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dialog?.type === 'alert' && (
        <Modal title={dialog.title} onClose={closeDialog}>
          <p>{dialog.message}</p>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={closeDialog}>
              Aceptar
            </button>
          </div>
        </Modal>
      )}

      {dialog?.type === 'confirm' && (
        <Modal title={dialog.title} onClose={dialog.busy ? () => {} : closeDialog}>
          <p>{dialog.message}</p>
          {dialog.error && <p className="form-error">{dialog.error}</p>}
          <div className="form-actions">
            <button type="button" className="btn btn-danger" onClick={runConfirm} disabled={dialog.busy}>
              {dialog.busy ? 'Borrando...' : dialog.confirmLabel}
            </button>
            <button type="button" className="btn btn-outline" onClick={closeDialog} disabled={dialog.busy}>
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Proyeccion({ data }) {
  if (!data) return null;
  return (
    <div className="caucion-result">
      <div className="caucion-result-head">
        <strong>{data.vueltas} {data.vueltas === 1 ? 'vuelta' : 'vueltas'}</strong>
        <strong>{ars(data.interes)}</strong>
      </div>
      <p>
        {ars(data.monto_inicial)} al {pct(data.tna)}, renovado cada {data.cada} días desde el {fecha(data.fecha_inicio)}.
        Al {fecha(data.fecha_fin)} quedan {ars(data.monto_final)}.
      </p>
      <dl className="caucion-metrics">
        <div>
          <dt>Genera</dt>
          <dd>{ars(data.interes)}</dd>
        </div>
        <div>
          <dt>Queda</dt>
          <dd>{ars(data.monto_final)}</dd>
        </div>
        <div>
          <dt>Días que rinden</dt>
          <dd>{data.dias_rendidos}</dd>
        </div>
        <div>
          <dt>Días parados</dt>
          <dd>{data.dias_parados}</dd>
        </div>
        <div>
          <dt>Sin reinvertir</dt>
          <dd>{ars(data.interes_sin_reinvertir)}</dd>
        </div>
        <div>
          <dt>Vueltas</dt>
          <dd>{data.vueltas}</dd>
        </div>
      </dl>
      <ul className="caucion-notes">
        {data.notas.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <div className="admin-table-wrap caucion-roll-table">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Inicio</th>
              <th>Vence</th>
              <th>Renovás</th>
              <th>Parados</th>
              <th>Interés</th>
              <th>Queda</th>
            </tr>
          </thead>
          <tbody>
            {data.detalle.map((vuelta) => (
              <tr key={vuelta.numero}>
                <td>{vuelta.numero}</td>
                <td>{fecha(vuelta.fecha_inicio)}</td>
                <td>{fecha(vuelta.fecha_vencimiento)}</td>
                <td>{fecha(vuelta.fecha_renovacion)}</td>
                <td>{vuelta.dias_parados}</td>
                <td>{ars(vuelta.interes)}</td>
                <td>{ars(vuelta.monto_final)}</td>
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
