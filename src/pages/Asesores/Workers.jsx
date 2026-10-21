import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../app/providers/AuthContext.jsx';
import { useNotification } from '../../app/providers/NotificationContext.jsx';
import { ChevronDown, Check, X, Search as SearchIcon, UserX } from 'lucide-react';
import { getAvatarUrl } from '../../shared/utils/avatar.js';
import { cargarTodosLosAsesores } from '../../shared/utils/asesores.js';
import SelectorUbicacion from '../../shared/ui/SelectorUbicacion.jsx';

function WorkerFilterSelect({ value, onChange, options, ariaLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const selectedOption = options.find(option => option.value === value) || options[0];

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
      <div className="workers-custom-select" ref={containerRef}>
        <button
            type="button"
            className={`workers-custom-select-trigger${isOpen ? ' is-open' : ''}`}
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            onClick={() => setIsOpen(open => !open)}
        >
          <span>{selectedOption.label}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {isOpen && (
            <div className="workers-custom-select-menu" role="listbox" aria-label={ariaLabel}>
              {options.map(option => {
                const selected = option.value === value;
                return (
                    <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`workers-custom-select-option${selected ? ' is-selected' : ''}`}
                        key={option.value}
                        onClick={() => {
                          onChange(option.value);
                          setIsOpen(false);
                        }}
                    >
                      <span>{option.label}</span>
                      {selected && <Check size={16} aria-hidden="true" />}
                    </button>
                );
              })}
            </div>
        )}
      </div>
  );
}

export default function Workers() {
  const { radarApi, sedeActual } = useContext(AuthContext);
  const { showToast } = useNotification();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [workerPage, setWorkerPage] = useState(1);

  useEffect(() => {
    const fetchWorkers = async () => {
      setLoading(true);
      try {
        const res = await cargarTodosLosAsesores(radarApi);
        setWorkers(res.data.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchWorkers();
  }, [radarApi]);

  const navigate = useNavigate();
  const handleSelectWorker = async (w) => {
    navigate(`/workers/${w.id}`, { state: { worker: w } });
  };

  const [editingWorker, setEditingWorker] = useState(null);
  const [statusWorker, setStatusWorker] = useState(null);

  const handleToggleWorkerStatus = async (worker) => {
    const nextStatus = worker.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    setCreating(true);
    try {
      await radarApi.patch(`/api/asesores/${worker.id}/estado`, { estado: nextStatus });
      showToast(`Asesor ${nextStatus === 'ACTIVO' ? 'activado' : 'inactivado'} correctamente. Se conservó todo su historial.`, 'success');
      setStatusWorker(null);
      const res = await cargarTodosLosAsesores(radarApi);
      setWorkers(res.data.data || []);
    } catch (e) {
      showToast('Error: ' + (e.response?.data?.mensaje || e.response?.data?.error || e.message), 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleEditWorker = async (e) => {
    e.preventDefault();
    setCreating(true);

    const payload = {
      ...editingWorker,
      DNI: editingWorker.dni,
      documento: editingWorker.dni,
      apellidos: `${editingWorker.apellido_paterno || ''} ${editingWorker.apellido_materno || ''}`.trim(),
      correo: editingWorker.email
    };

    try {
      await radarApi.patch(`/api/asesores/${editingWorker.id}`, payload);
      setEditingWorker(null);
      showToast("Asesor actualizado exitosamente", 'success');

      const res = await cargarTodosLosAsesores(radarApi);
      setWorkers(res.data.data || []);
    } catch (e) {
      showToast('Error: ' + (e.response?.data?.error || e.response?.data?.mensaje || e.message), 'error');
    } finally {
      setCreating(false);
    }
  };

  const filteredWorkers = workers.filter(w => {
    const q = searchTerm.trim().toLowerCase();
    const matchSearch = !q || `${w.nombres} ${w.apellido_paterno} ${w.apellido_materno} ${w.dni} ${w.email}`.toLowerCase().includes(q);
    const matchEstado = filtroEstado === 'TODOS' || w.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const workersPerPage = 5;
  const workerTotalPages = Math.max(1, Math.ceil(filteredWorkers.length / workersPerPage));
  const currentWorkerPage = Math.min(workerPage, workerTotalPages);
  const paginatedWorkers = filteredWorkers.slice((currentWorkerPage - 1) * workersPerPage, currentWorkerPage * workersPerPage);

  useEffect(() => { setWorkerPage(1); }, [searchTerm, filtroEstado, sedeActual?.id]);
  useEffect(() => { setWorkerPage(page => Math.min(page, workerTotalPages)); }, [workerTotalPages]);

  return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', transition: 'all 0.3s' }}>
        <div>
          <div style={{ marginBottom: '24px' }}>
            <h1 className="text-2xl font-bold" style={{ fontSize: '26px' }}>Gestión de Asesores - {sedeActual?.nombre || 'General'}</h1>
            <p className="text-muted" style={{ fontSize: '14px' }}>Visualiza el estado de tus asesores en campo y su productividad en esta sede.</p>
          </div>

          <div className="workers-results-card">
            <div className="filter-bar workers-filter-bar" style={{ gap: '12px', flexWrap: 'wrap' }}>
              <div className="professional-search" style={{ flex: 1, minWidth: '260px' }}>
                <SearchIcon size={16} color="var(--c-muted)"/>
                <input type="text" placeholder="Buscar por nombre, documento, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <WorkerFilterSelect
                  value={filtroEstado}
                  onChange={setFiltroEstado}
                  ariaLabel="Filtrar por estado de asesor"
                  options={[
                    { value: 'TODOS', label: 'Todos los estados' },
                    { value: 'ACTIVO', label: 'Activos' },
                    { value: 'INACTIVO', label: 'Inactivos' }
                  ]}
              />
            </div>

            <div className="table-wrap workers-table-wrap">
              <table className="workers-table">
                <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Documento / Teléfono</th>
                  <th>Distrito Base</th>
                  <th>Estado Jornada</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
                </thead>
                <tbody>
                {loading ? (
                    <tr className="workers-loading-row">
                      <td colSpan="5">
                        <div className="clients-loading-state" role="status" aria-live="polite">
                          <p>Cargando asesores…</p>
                          <div className="clients-loading-skeleton" aria-hidden="true">
                            {Array.from({ length: workersPerPage }, (_, row) => (
                                <div className="clients-loading-placeholder" key={row}>
                                  <span /><span /><span /><span />
                                </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                ) : filteredWorkers.length === 0 ? (
                    <tr className="table-empty-row">
                      <td colSpan="5">
                        <div className="table-empty-state">
                          <div className="table-empty-icon"><UserX size={26} strokeWidth={1.8} /></div>
                          <strong>{searchTerm || filtroEstado !== 'TODOS' ? 'No encontramos colaboradores' : 'Aún no hay colaboradores registrados'}</strong>
                          <p>{searchTerm || filtroEstado !== 'TODOS' ? 'Prueba modificando la búsqueda o limpiando el filtro seleccionado.' : 'Los colaboradores aparecerán aquí cuando sean registrados.'}</p>
                          {(searchTerm || filtroEstado !== 'TODOS') && (
                              <button type="button" className="btn btn-ghost table-empty-action" onClick={() => { setSearchTerm(''); setFiltroEstado('TODOS'); }}>
                                Limpiar filtros
                              </button>
                          )}
                        </div>
                      </td>
                    </tr>
                ) : paginatedWorkers.map(w => (
                    <tr key={w.id} onClick={() => handleSelectWorker(w)} style={{ cursor: 'pointer' }}>
                      <td data-label="Asesor" >
                        <div className="flex items-center gap-3">
                          <div className="avatar-small" style={{ width: '36px', height: '36px' }}>
                            <img src={getAvatarUrl(w.nombres, w.id)} alt="avatar" />
                          </div>
                          <div>
                            <div className="font-bold" style={{ fontSize: '14px' }}>{w.nombres} {w.apellidos}</div>
                            <div className="text-sm text-muted">{w.email || 'Sin correo registrado'}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Documento / Teléfono">{w.dni} <br/> <small className="text-muted">{w.telefono}</small></td>
                      <td data-label="Distrito base">{w.distrito || '--'}</td>
                      <td data-label="Estado">
                        <span className={`badge ${w.estado === 'ACTIVO' ? 'badge-activo' : 'badge-inactivo'}`}>{w.estado}</span>
                      </td>
                      <td data-label="Acciones" className="table-col-final" style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditingWorker(w); }}>Editar</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: w.estado === 'ACTIVO' ? 'var(--c-danger)' : '#059669' }} onClick={(e) => { e.stopPropagation(); setStatusWorker(w); }}>
                          {w.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                ))}
                </tbody>
              </table>
            </div>
            {!loading && filteredWorkers.length > 0 && (
                <nav className="evaluation-pagination" aria-label="Paginación de asesores">
                  <p className="evaluation-pagination-summary">Mostrando <strong>{(currentWorkerPage - 1) * workersPerPage + 1}–{Math.min(currentWorkerPage * workersPerPage, filteredWorkers.length)}</strong> de {filteredWorkers.length} asesores</p>
                  <div className="evaluation-pagination-controls">
                    <button type="button" disabled={currentWorkerPage === 1} aria-label="Página anterior" onClick={() => setWorkerPage(currentWorkerPage - 1)}>‹</button>
                    {Array.from({ length: Math.min(5, workerTotalPages) }, (_, index) => Math.max(1, Math.min(currentWorkerPage - 2, workerTotalPages - 4)) + index).map(page => (
                        <button type="button" key={page} aria-label={`Ir a la página ${page}`} aria-current={page === currentWorkerPage ? 'page' : undefined} onClick={() => setWorkerPage(page)}>{page}</button>
                    ))}
                    <button type="button" disabled={currentWorkerPage === workerTotalPages} aria-label="Página siguiente" onClick={() => setWorkerPage(currentWorkerPage + 1)}>›</button>
                  </div>
                  <p className="evaluation-pagination-position" aria-live="polite">Página {currentWorkerPage} de {workerTotalPages}</p>
                </nav>
            )}
          </div>
        </div>

        {/* MODAL EDITAR */}
        {editingWorker && (
            <div className="modal-overlay" style={{ backdropFilter: 'blur(5px)' }}>
              <div className="modal" style={{ maxWidth: '600px', width: '95vw', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: '24px', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="p-10 flex justify-between items-center" style={{ padding: '32px 40px 20px', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
                  <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--c-text)', margin: 0 }}>Editar asesor</h2>
                  <button className="btn-icon" style={{ background: 'var(--c-surface-2)', borderRadius: '50%', padding: '8px' }} onClick={() => setEditingWorker(null)}><X size={20} /></button>
                </div>
                <form onSubmit={handleEditWorker} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                  <div className="modal-body" style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', flex: 1 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Estado de Cuenta</label>
                      <select className="form-input" style={{ background: 'var(--c-surface)' }} value={editingWorker.estado} onChange={e => setEditingWorker({...editingWorker, estado: e.target.value})}>
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="INACTIVO">INACTIVO</option>
                      </select>
                    </div>
                    <div className="form-row form-row-2">
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Nombres</label>
                        <input className="form-input" style={{ background: 'var(--c-surface)' }} value={editingWorker.nombres} onChange={e => setEditingWorker({...editingWorker, nombres: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Documento</label>
                        <input className="form-input" style={{ background: 'var(--c-surface)' }} value={editingWorker.dni || ''} onChange={e => setEditingWorker({...editingWorker, dni: e.target.value})} />
                      </div>
                    </div>
                    <div className="form-row form-row-2">
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Apellido Paterno</label>
                        <input className="form-input" style={{ background: 'var(--c-surface)' }} value={editingWorker.apellido_paterno || ''} onChange={e => setEditingWorker({...editingWorker, apellido_paterno: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Apellido Materno</label>
                        <input className="form-input" style={{ background: 'var(--c-surface)' }} value={editingWorker.apellido_materno || ''} onChange={e => setEditingWorker({...editingWorker, apellido_materno: e.target.value})} />
                      </div>
                    </div>
                    <div className="form-row form-row-2">
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Teléfono</label>
                        <input className="form-input" style={{ background: 'var(--c-surface)' }} value={editingWorker.telefono || ''} onChange={e => setEditingWorker({...editingWorker, telefono: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Email</label>
                        <input className="form-input" style={{ background: 'var(--c-surface)' }} value={editingWorker.email || ''} onChange={e => setEditingWorker({...editingWorker, email: e.target.value})} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Distrito Base</label>
                      <input className="form-input" style={{ background: 'var(--c-surface)' }} value={editingWorker.distrito || ''} onChange={e => setEditingWorker({...editingWorker, distrito: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Ubicación base</label>
                      <SelectorUbicacion
                          latitud={editingWorker.latitud}
                          longitud={editingWorker.longitud}
                          onChange={(lat, lng) => setEditingWorker(actual => ({ ...actual, latitud: lat, longitud: lng }))}
                          onDistrictChange={(distrito) => setEditingWorker(actual => ({ ...actual, distrito }))}
                      />
                    </div>
                  </div>
                  <div className="modal-footer" style={{ padding: '24px 40px', background: 'var(--c-surface-2)', borderTop: '1px solid var(--c-border)', display: 'flex', gap: '16px', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setEditingWorker(null)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '12px' }} disabled={creating}>{creating ? 'Guardando...' : 'Actualizar asesor'}</button>
                  </div>
                </form>
              </div>
            </div>
        )}

        {statusWorker && (
            <div className="modal-overlay" style={{ backdropFilter: 'blur(5px)' }}>
              <div className="modal" style={{ maxWidth: '450px', width: '90vw', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: '24px', overflow: 'hidden', padding: '32px', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--c-text)', marginTop: 0, marginBottom: '12px' }}>
                  {statusWorker.estado === 'ACTIVO' ? 'Inactivar asesor' : 'Activar asesor'}
                </h2>
                <p style={{ color: 'var(--c-text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                  ¿Deseas {statusWorker.estado === 'ACTIVO' ? 'inactivar' : 'activar'} al asesor <strong>{statusWorker.nombres} {statusWorker.apellidos}</strong>?<br/>
                  {statusWorker.estado === 'ACTIVO'
                      ? 'No podrá ingresar al aplicativo ni recibir nuevas asignaciones. Sus rutas, visitas y evidencias permanecerán registradas.'
                      : 'Recuperará el acceso al aplicativo y podrá recibir nuevas asignaciones.'}
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" onClick={() => setStatusWorker(null)} disabled={creating}>Cancelar</button>
                  <button className={statusWorker.estado === 'ACTIVO' ? 'btn btn-danger' : 'btn btn-primary'} style={{ color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: '700' }} onClick={() => handleToggleWorkerStatus(statusWorker)} disabled={creating}>
                    {creating ? 'Guardando...' : statusWorker.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}