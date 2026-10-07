import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { ArrowLeft, CheckCircle2, ExternalLink, MapPin, Search, X } from 'lucide-react';
import { AuthContext } from '../../app/providers/AuthContext.jsx';
import { AppAlert } from '../../shared/utils/alerts/alerts.js';
import './UbicacionesRevision.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const LIMA_CENTER = [-12.0464, -77.0428];
const ROLES_PERMITIDOS = ['ADMINISTRADOR', 'GERENTE', 'SUPERVISOR'];
const PAGE_SIZE = 15;

const TABS = [
  { key: 'REVISAR', label: 'Por revisar' },
  { key: 'NO_ENCONTRADO', label: 'No encontrados' },
  { key: 'ERROR', label: 'Con error' },
  { key: 'LOCALIZADO', label: 'Automáticos' },
  { key: 'VERIFICADO', label: 'Verificados' },
];
const ESTADO_LABEL = {
  REVISAR: 'Por revisar',
  NO_ENCONTRADO: 'No encontrado',
  ERROR: 'Error',
  LOCALIZADO: 'Automático',
  VERIFICADO: 'Verificado',
  PENDIENTE: 'Pendiente',
};
const CONFIANZA_CLASE = { ALTA: 'is-high', MEDIA: 'is-medium', BAJA: 'is-low' };

function MapClick({ onPick }) {
  useMapEvents({ click: event => onPick([event.latlng.lat, event.latlng.lng]) });
  return null;
}

function ModalUbicacion({ cliente, onClose, onSaved }) {
  const { api } = useContext(AuthContext);
  const tieneUbicacion = cliente.latitud !== null && cliente.longitud !== null;
  const centroInicial = tieneUbicacion
    ? [cliente.latitud, cliente.longitud]
    : cliente.centro_sugerido
      ? [cliente.centro_sugerido.latitud, cliente.centro_sugerido.longitud]
      : LIMA_CENTER;
  const zoomInicial = tieneUbicacion ? 17 : cliente.centro_sugerido ? 15 : 12;

  const [posicion, setPosicion] = useState(tieneUbicacion ? centroInicial : null);
  const [aplicarMisma, setAplicarMisma] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const movido = Boolean(posicion) && (
    !tieneUbicacion
    || posicion[0] !== cliente.latitud
    || posicion[1] !== cliente.longitud
  );

  useEffect(() => {
    const alPresionar = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onClose]);

  const consultaMapa = [cliente.direccion, cliente.distrito, 'Perú'].filter(Boolean).join(', ');
  const enlaceMapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consultaMapa)}`;

  const ejecutar = async peticion => {
    setGuardando(true);
    try {
      const { data } = await peticion();
      onSaved(data.data);
    } catch (error) {
      AppAlert.error('No se pudo guardar la ubicación', error.response?.data?.error || error.message);
    } finally {
      setGuardando(false);
    }
  };

  const guardar = () => ejecutar(() => api.patch(`/api/clientes/${cliente.id}/ubicacion`, {
    latitud: Number(posicion[0].toFixed(7)),
    longitud: Number(posicion[1].toFixed(7)),
    aplicar_misma_direccion: aplicarMisma,
  }));
  const confirmar = () => ejecutar(() => api.post(`/api/clientes/${cliente.id}/ubicacion/confirmar`));

  return (
    <div className="ubi-overlay" role="dialog" aria-modal="true" aria-label="Revisar ubicación" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="ubi-modal">
        <header className="ubi-modal-head">
          <div>
            <h2>{cliente.nombres} {cliente.apellidos}</h2>
            <p>{cliente.tipo_documento} {cliente.numero_documento}</p>
          </div>
          <button type="button" className="ubi-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="ubi-modal-body">
          <aside className="ubi-info">
            <dl>
              <dt>Dirección registrada</dt>
              <dd>{cliente.direccion || '—'}{cliente.distrito ? `, ${cliente.distrito}` : ''}</dd>
              <dt>Dirección que encontró el mapa</dt>
              <dd>{cliente.direccion_geocodificada || 'No se encontró ninguna coincidencia'}</dd>
              <dt>Estado</dt>
              <dd>
                <span className={`ubi-badge is-estado-${cliente.estado_geocodificacion}`}>{ESTADO_LABEL[cliente.estado_geocodificacion] || cliente.estado_geocodificacion}</span>
                {cliente.confianza_geocodificacion && (
                  <span className={`ubi-badge ${CONFIANZA_CLASE[cliente.confianza_geocodificacion] || ''}`}>Confianza {cliente.confianza_geocodificacion.toLowerCase()}</span>
                )}
              </dd>
            </dl>

            <a className="ubi-link" href={enlaceMapa} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> Buscar esta dirección en Google Maps
            </a>
            <p className="ubi-hint">
              {tieneUbicacion
                ? 'Arrastra el pin o haz clic en el mapa para colocarlo en el domicilio correcto.'
                : 'Haz clic en el mapa para colocar el pin en el domicilio del cliente.'}
            </p>

            <label className="ubi-check">
              <input type="checkbox" checked={aplicarMisma} onChange={event => setAplicarMisma(event.target.checked)} />
              Aplicar también a los clientes con exactamente la misma dirección
            </label>

            <div className="ubi-actions">
              <button type="button" className="ubi-btn is-primary" disabled={!movido || guardando} onClick={guardar}>
                <MapPin size={16} /> {guardando ? 'Guardando…' : 'Guardar ubicación'}
              </button>
              {tieneUbicacion && !movido && (
                <button type="button" className="ubi-btn" disabled={guardando} onClick={confirmar}>
                  <CheckCircle2 size={16} /> La ubicación es correcta
                </button>
              )}
              <button type="button" className="ubi-btn is-ghost" onClick={onClose}>Cancelar</button>
            </div>
          </aside>

          <div className="ubi-map">
            <MapContainer key={cliente.id} center={centroInicial} zoom={zoomInicial} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClick onPick={setPosicion} />
              {posicion && (
                <Marker
                  position={posicion}
                  draggable
                  eventHandlers={{
                    dragend: event => {
                      const { lat, lng } = event.target.getLatLng();
                      setPosicion([lat, lng]);
                    },
                  }}
                />
              )}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UbicacionesRevision() {
  const { api, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [estado, setEstado] = useState('REVISAR');
  const [entrada, setEntrada] = useState('');
  const [buscar, setBuscar] = useState('');
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState({ items: [], resumen: {}, pagination: { page: 1, pages: 1, total: 0 } });
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState(null);

  const autorizado = ROLES_PERMITIDOS.includes(user?.rol);

  useEffect(() => {
    const temporizador = setTimeout(() => { setBuscar(entrada.trim()); setPage(1); }, 400);
    return () => clearTimeout(temporizador);
  }, [entrada]);

  const cargar = useCallback(async () => {
    if (!autorizado) return;
    setCargando(true);
    try {
      const { data } = await api.get('/api/clientes/ubicaciones/revision', {
        params: { estado, buscar: buscar || undefined, page, limit: PAGE_SIZE },
      });
      setDatos(data.data);
    } catch (error) {
      AppAlert.error('No se pudo cargar la lista', error.response?.data?.error || error.message);
    } finally {
      setCargando(false);
    }
  }, [api, autorizado, estado, buscar, page]);

  useEffect(() => { cargar(); }, [cargar]);

  const alGuardar = resultado => {
    setSeleccionado(null);
    const extra = resultado.copiados > 0
      ? ` También se actualizaron ${resultado.copiados} cliente(s) con la misma dirección.`
      : '';
    AppAlert.success('Ubicación guardada', `La ubicación quedó verificada.${extra}`);
    cargar();
  };

  if (!autorizado) {
    return (
      <div className="ubi-page">
        <p className="ubi-empty">No tienes permiso para revisar ubicaciones de clientes.</p>
      </div>
    );
  }

  const { items, resumen, pagination } = datos;

  return (
    <div className="ubi-page">
      <button type="button" className="ubi-back" onClick={() => navigate('/clientes')}>
        <ArrowLeft size={16} /> Volver a Clientes
      </button>
      <h1>Ubicaciones de clientes</h1>
      <p className="ubi-subtitle">
        Revisa los clientes cuya dirección no se pudo ubicar con certeza y corrige el pin en el mapa.
        Una vez verificada, la ubicación no se vuelve a cambiar sola.
      </p>

      <div className="ubi-tabs" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={estado === tab.key}
            className={`ubi-tab${estado === tab.key ? ' is-active' : ''}`}
            onClick={() => { setEstado(tab.key); setPage(1); }}
          >
            {tab.label} <span>{resumen[tab.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="ubi-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Buscar por nombre, documento o dirección…"
          value={entrada}
          onChange={event => setEntrada(event.target.value)}
        />
      </div>

      <div className="ubi-table-wrap">
        <table className="ubi-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Dirección registrada</th>
              <th>Dirección encontrada</th>
              <th>Confianza</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={5} className="ubi-empty">Cargando…</td></tr>}
            {!cargando && items.length === 0 && (
              <tr><td colSpan={5} className="ubi-empty">No hay clientes en este estado.</td></tr>
            )}
            {!cargando && items.map(cliente => (
              <tr key={cliente.id}>
                <td>
                  <strong>{cliente.nombres} {cliente.apellidos}</strong>
                  <small>{cliente.tipo_documento} {cliente.numero_documento}</small>
                </td>
                <td>{cliente.direccion || '—'}{cliente.distrito ? <small>{cliente.distrito}</small> : null}</td>
                <td>{cliente.direccion_geocodificada || <small>Sin coincidencia</small>}</td>
                <td>
                  {cliente.confianza_geocodificacion
                    ? <span className={`ubi-badge ${CONFIANZA_CLASE[cliente.confianza_geocodificacion] || ''}`}>{cliente.confianza_geocodificacion}</span>
                    : '—'}
                </td>
                <td>
                  <button type="button" className="ubi-btn is-small" onClick={() => setSeleccionado(cliente)}>
                    <MapPin size={14} /> Revisar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ubi-pager">
        <button type="button" className="ubi-btn is-small" disabled={pagination.page <= 1 || cargando} onClick={() => setPage(p => p - 1)}>Anterior</button>
        <span>Página {pagination.page} de {pagination.pages} · {pagination.total} cliente(s)</span>
        <button type="button" className="ubi-btn is-small" disabled={pagination.page >= pagination.pages || cargando} onClick={() => setPage(p => p + 1)}>Siguiente</button>
      </div>

      {seleccionado && (
        <ModalUbicacion
          cliente={seleccionado}
          onClose={() => setSeleccionado(null)}
          onSaved={alGuardar}
        />
      )}
    </div>
  );
}
