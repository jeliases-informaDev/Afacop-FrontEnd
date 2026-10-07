import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  { key: 'APROXIMADAS', label: 'Aproximadas' },
  { key: 'PRECISAS', label: 'Precisas' },
  { key: 'VERIFICADO', label: 'Verificados' },
  { key: 'ERROR', label: 'Con error' },
];
// Orden en que se elige la pestaña inicial: la primera que tenga clientes.
const PRIORIDAD_INICIAL = ['REVISAR', 'NO_ENCONTRADO', 'APROXIMADAS', 'PRECISAS', 'VERIFICADO'];

function etiquetaCalidad(cliente) {
  switch (cliente.estado_geocodificacion) {
    case 'VERIFICADO': return 'Verificado';
    case 'REVISAR': return 'Por revisar';
    case 'NO_ENCONTRADO': return 'No encontrado';
    case 'ERROR': return 'Error';
    case 'PENDIENTE': return 'Pendiente';
    case 'LOCALIZADO':
      return cliente.confianza_geocodificacion === 'ALTA' || cliente.precision_geocodificacion === 'IMPORTADA'
        ? 'Precisa'
        : 'Aproximada';
    default: return cliente.estado_geocodificacion || 'Sin estado';
  }
}
const CONFIANZA_CLASE = { ALTA: 'is-high', MEDIA: 'is-medium', BAJA: 'is-low' };

function MapClick({ onPick }) {
  useMapEvents({ click: event => onPick([event.latlng.lat, event.latlng.lng]) });
  return null;
}

// OpenStreetMap solo entiende bien la dirección escrita completa ("Avenida", no "Av.")
// y sin ", Perú" al final; por eso se arregla el texto antes de buscar.
const ABREVIATURAS = [
  [/\bAV(?:DA?)?(?:\.\s*|(?=\s))/gi, 'Avenida '],
  [/\bJR(?:\.\s*|(?=\s))/gi, 'Jirón '],
  [/\bCAL?(?:\.\s*|(?=\s))/gi, 'Calle '],
  [/\bPSJE?(?:\.\s*|(?=\s))/gi, 'Pasaje '],
  [/\bURB(?:\.\s*|(?=\s))/gi, 'Urbanización '],
];
const COORDENADAS = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const ESPERA_ENTRE_BUSQUEDAS_MS = 1100;

const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const arreglarEspacios = texto => texto.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim();

function prepararConsulta(texto) {
  let consulta = String(texto ?? '').replace(/,?\s*per[uú]\s*$/i, '');
  for (const [patron, reemplazo] of ABREVIATURAS) consulta = consulta.replace(patron, reemplazo);
  return arreglarEspacios(consulta);
}

const sinNumeros = texto => arreglarEspacios(texto.replace(/\b\d{1,5}[A-Za-z]?\b(?!\s+de\b)/g, ''));

// Coordenadas pegadas desde Google Maps (clic derecho -> copiar). Devuelve null si el
// texto no parece coordenadas, 'fuera' si no caen en Perú, o [latitud, longitud].
function leerCoordenadas(texto) {
  const coincidencia = COORDENADAS.exec(texto);
  if (!coincidencia) return null;
  const latitud = Number(coincidencia[1]);
  const longitud = Number(coincidencia[2]);
  const enPeru = latitud >= -18.5 && latitud <= 0.1 && longitud >= -81.5 && longitud <= -68.5;
  return enPeru ? [latitud, longitud] : 'fuera';
}

function zoomPorTipo(item) {
  const tipo = item.addresstype || item.type;
  if (['house', 'building', 'place'].includes(tipo)) return 18;
  if (['road', 'street', 'pedestrian', 'residential'].includes(tipo)) return 16;
  return 15;
}

function BuscadorDireccion({ mapa, textoInicial, distrito, autoCentrar, onColocarPin }) {
  const [texto, setTexto] = useState(textoInicial);
  const [resultados, setResultados] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const ultimaConsulta = useRef(0);

  const consultar = async consulta => {
    // El servicio público de OpenStreetMap permite como máximo una consulta por segundo.
    const falta = ESPERA_ENTRE_BUSQUEDAS_MS - (Date.now() - ultimaConsulta.current);
    if (falta > 0) await new Promise(resolver => setTimeout(resolver, falta));
    ultimaConsulta.current = Date.now();

    const params = new URLSearchParams({
      q: consulta, format: 'jsonv2', countrycodes: 'pe', limit: '6', 'accept-language': 'es',
    });
    const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!respuesta.ok) throw new Error('busqueda');
    return respuesta.json();
  };

  const irA = item => mapa?.flyTo([Number(item.lat), Number(item.lon)], zoomPorTipo(item));

  const buscar = async (valor, { silencioso = false } = {}) => {
    const buscado = valor.trim();
    if (!buscado || !mapa) return;

    const coordenadas = leerCoordenadas(buscado);
    if (coordenadas === 'fuera') {
      setMensaje('Esas coordenadas no están dentro de Perú.');
      return;
    }
    if (coordenadas) {
      onColocarPin(coordenadas);
      mapa.flyTo(coordenadas, 18);
      setResultados([]);
      setAbierto(false);
      setMensaje('Pin colocado en esas coordenadas. Revisa que sea el lugar y guarda.');
      return;
    }

    setBuscando(true);
    setMensaje('');
    try {
      const base = prepararConsulta(buscado);
      let lista = await consultar(base);
      let soloCalle = false;
      if (!lista.length && /\d/.test(base)) {
        const calle = sinNumeros(base);
        if (calle && calle !== base) {
          lista = await consultar(calle);
          soloCalle = lista.length > 0;
        }
      }

      if (silencioso) {
        const elegido = lista.find(item => !distrito || normalizar(item.display_name).includes(normalizar(distrito)));
        if (elegido) irA(elegido);
        return;
      }

      setResultados(lista);
      setAbierto(lista.length > 0);
      if (!lista.length) {
        setMensaje('Sin resultados. Prueba con solo la calle y el distrito, o pega las coordenadas de Google Maps.');
      } else if (soloCalle) {
        setMensaje('El mapa no tiene ese número: solo encontró la calle. Haz clic en el mapa donde está la casa.');
      }
    } catch {
      if (!silencioso) setMensaje('No se pudo buscar ahora. Inténtalo de nuevo en unos segundos.');
    } finally {
      setBuscando(false);
    }
  };

  // Si el cliente aún no tiene ubicación, el mapa abre ya centrado en su calle.
  useEffect(() => {
    if (autoCentrar && mapa) buscar(textoInicial, { silencioso: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa]);

  return (
    <div className="ubi-buscador">
      <form
        className="ubi-buscador-form"
        onSubmit={event => { event.preventDefault(); buscar(texto); }}
      >
        <Search size={16} />
        <input
          type="text"
          value={texto}
          onChange={event => setTexto(event.target.value)}
          placeholder="Buscar dirección o pegar coordenadas…"
          aria-label="Buscar dirección en el mapa"
        />
        <button type="submit" className="ubi-btn is-primary is-small" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
      {mensaje && <p className="ubi-buscador-msg">{mensaje}</p>}
      {abierto && resultados.length > 0 && (
        <ul className="ubi-buscador-lista">
          {resultados.map(item => {
            const partes = String(item.display_name || '').split(',');
            return (
              <li key={item.place_id}>
                <button type="button" onClick={() => { irA(item); setAbierto(false); }}>
                  <strong>{partes[0]}</strong>
                  <small>{partes.slice(1, 4).join(',').trim()}</small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
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
  const [mapa, setMapa] = useState(null);
  const direccionInicial = [cliente.direccion, cliente.distrito].filter(Boolean).join(', ');

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
                <span className={`ubi-badge is-estado-${cliente.estado_geocodificacion}`}>{etiquetaCalidad(cliente)}</span>
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
              {' '}Usa el buscador sobre el mapa para llegar a la calle. Si encuentras el lugar exacto en Google Maps,
              haz clic derecho sobre él, copia las coordenadas y pégalas en el buscador.
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
            <BuscadorDireccion
              mapa={mapa}
              textoInicial={direccionInicial}
              distrito={cliente.distrito}
              autoCentrar={!tieneUbicacion}
              onColocarPin={setPosicion}
            />
            <MapContainer ref={setMapa} key={cliente.id} center={centroInicial} zoom={zoomInicial} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
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
  const pestanaElegida = useRef(false);

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

      // La primera vez, si la pestaña inicial está vacía, se abre la primera que tenga clientes.
      if (!pestanaElegida.current) {
        pestanaElegida.current = true;
        const resumen = data.data.resumen || {};
        const siguiente = PRIORIDAD_INICIAL.find(clave => resumen[clave] > 0);
        if (!resumen[estado] && siguiente && siguiente !== estado) setEstado(siguiente);
      }
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
        Calidad de la ubicación de cada cliente. Una vez verificada, la ubicación no se vuelve a cambiar sola.
      </p>
      <div className="ubi-note" role="note">
        <strong>No necesitas revisar todo.</strong> Las ubicaciones <em>aproximadas</em> sirven para ver la zona en
        el mapa, y el asesor navega por la dirección escrita cuando el punto no es confiable. Se corrigen cuando el
        asesor confirma el domicilio al llegar. Aquí revisa solo lo que vayas a visitar pronto, empezando por
        "Por revisar" y "No encontrados".
      </div>

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
