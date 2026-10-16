import React, { useContext, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { MapPin, Search, X } from 'lucide-react';
import { AuthContext } from '../../app/providers/AuthContext.jsx';
import { buscarDirecciones, leerCoordenadas, leerEnlaceDeGoogleMaps, parecerEnlace, zoomPorTipo } from '../utils/busquedaDireccion.js';
import './SelectorUbicacion.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const CENTRO_LIMA = [-12.0464, -77.0428];
const redondear = numero => Number(Number(numero).toFixed(6));
const comoNumero = valor => (valor === '' || valor === null || valor === undefined ? NaN : Number(valor));

function ClicEnMapa({ alElegir }) {
  useMapEvents({ click: evento => alElegir([evento.latlng.lat, evento.latlng.lng]) });
  return null;
}

/**
 * Selector de ubicacion con mapa: se busca la direccion (o se pega un enlace de Google Maps o unas coordenadas), se hace clic
 * en el mapa o se arrastra el pin. Cada vez que el usuario mueve el pin se completa el distrito (onDistrictChange).
 * Es un componente controlado: latitud/longitud vienen del formulario y onChange(latitud, longitud) las devuelve
 * (numeros, o '' cuando se quita la ubicacion). No usa <form> para poder ir dentro de otro formulario.
 */
export default function SelectorUbicacion({ latitud, longitud, onChange, onDistrictChange, altura = 280 }) {
  const { radarApi } = useContext(AuthContext);
  const lat = comoNumero(latitud);
  const lng = comoNumero(longitud);
  const posicion = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;

  const [mapa, setMapa] = useState(null);
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [direccion, setDireccion] = useState('');

  // Siempre se usan las ultimas funciones del formulario sin volver a ejecutar los efectos en cada tecla
  const alCambiar = useRef(onChange);
  const alCambiarDistrito = useRef(onDistrictChange);
  alCambiar.current = onChange;
  alCambiarDistrito.current = onDistrictChange;
  // true cuando el cambio de ubicacion lo hizo el usuario aqui (y no el formulario al cargar un asesor ya guardado)
  const accionDelUsuario = useRef(false);

  const colocarPin = (coordenadas, { volar = false, zoom = 17 } = {}) => {
    accionDelUsuario.current = true;
    alCambiar.current?.(redondear(coordenadas[0]), redondear(coordenadas[1]));
    if (volar && mapa) mapa.flyTo(coordenadas, zoom);
  };

  // El mapa vive dentro de un modal que aparece con animacion: hay que avisarle cuando ya tiene su tamano final.
  useEffect(() => {
    if (!mapa) return undefined;
    const temporizador = setTimeout(() => mapa.invalidateSize(), 300);
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => mapa.invalidateSize());
    observador?.observe(mapa.getContainer());
    return () => {
      clearTimeout(temporizador);
      observador?.disconnect();
    };
  }, [mapa]);

  // Direccion y distrito del punto marcado (servicio del propio sistema; solo es una ayuda, si falla se siguen usando las coordenadas)
  useEffect(() => {
    if (!posicion) {
      setDireccion('');
      return undefined;
    }
    const lopuso = accionDelUsuario.current;
    const controlador = new AbortController();
    const temporizador = setTimeout(async () => {
      try {
        const respuesta = await radarApi.post('/api/asesores/geocodificar', { latitud: posicion[0], longitud: posicion[1] }, { signal: controlador.signal });
        const datos = respuesta.data?.data;
        if (!datos) return;
        setDireccion(datos.direccion || [datos.distrito, datos.provincia, datos.departamento].filter(Boolean).join(', '));
        if (lopuso && datos.distrito) alCambiarDistrito.current?.(datos.distrito);
      } catch {
        // sin direccion: no pasa nada
      }
    }, 700);
    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radarApi]);

  // Si el formulario cambia la ubicacion por su cuenta (por ejemplo al abrir un asesor ya guardado), el mapa se centra ahi
  useEffect(() => {
    if (mapa && posicion && !accionDelUsuario.current) mapa.setView(posicion, 16);
    accionDelUsuario.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, lat, lng]);

  const buscar = async () => {
    const buscado = texto.trim();
    if (!buscado) return;
    setMensaje('');
    setResultados([]);
    setAbierto(false);

    const coordenadas = leerCoordenadas(buscado);
    if (coordenadas === 'fuera') {
      setMensaje('Esas coordenadas no están dentro de Perú.');
      return;
    }
    if (coordenadas) {
      colocarPin(coordenadas, { volar: true, zoom: 18 });
      setMensaje('Pin colocado en esas coordenadas. Revisa que sea el lugar.');
      return;
    }

    if (parecerEnlace(buscado)) {
      const directas = leerEnlaceDeGoogleMaps(buscado);
      if (directas) {
        colocarPin(directas, { volar: true, zoom: 18 });
        return;
      }
      setBuscando(true);
      try {
        // enlaces cortos (maps.app.goo.gl): los abre el servidor
        const respuesta = await radarApi.post('/api/asesores/geocodificar', { url: buscado });
        const datos = respuesta.data?.data;
        if (datos?.latitud !== null && datos?.latitud !== undefined && datos?.longitud !== null && datos?.longitud !== undefined) {
          colocarPin([Number(datos.latitud), Number(datos.longitud)], { volar: true, zoom: 18 });
        } else {
          setMensaje('Ese enlace no trae una ubicación reconocible.');
        }
      } catch {
        setMensaje('No se pudo leer ese enlace. Busca la dirección o haz clic en el mapa.');
      } finally {
        setBuscando(false);
      }
      return;
    }

    setBuscando(true);
    try {
      const { lista, soloCalle } = await buscarDirecciones(buscado);
      setResultados(lista);
      setAbierto(lista.length > 0);
      if (!lista.length) {
        setMensaje('Sin resultados. Prueba con solo la calle y el distrito, o haz clic en el mapa.');
      } else if (soloCalle) {
        setMensaje('El mapa no tiene ese número: solo encontró la calle. Elige el resultado y luego haz clic donde está el domicilio.');
      }
    } catch {
      setMensaje('No se pudo buscar ahora. Inténtalo de nuevo en unos segundos.');
    } finally {
      setBuscando(false);
    }
  };

  const elegirResultado = item => {
    colocarPin([Number(item.lat), Number(item.lon)], { volar: true, zoom: zoomPorTipo(item) });
    setAbierto(false);
    setMensaje('Pin colocado. Arrástralo o haz clic en el mapa para afinar el punto.');
  };

  const quitarUbicacion = () => {
    accionDelUsuario.current = true;
    alCambiar.current?.('', '');
    setDireccion('');
    setMensaje('');
  };

  return (
    <div className="selub">
      <div className="selub-busqueda">
        <Search size={16} aria-hidden="true" />
        <input
          type="text"
          value={texto}
          onChange={evento => setTexto(evento.target.value)}
          onKeyDown={evento => {
            if (evento.key === 'Enter') {
              evento.preventDefault();
              buscar();
            }
          }}
          placeholder="Escribe la dirección, o pega coordenadas o un enlace de Google Maps…"
          aria-label="Buscar la ubicación del asesor en el mapa"
        />
        <button type="button" className="selub-boton" onClick={buscar} disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {abierto && resultados.length > 0 && (
        <ul className="selub-resultados">
          {resultados.map(item => {
            const partes = String(item.display_name || '').split(',');
            return (
              <li key={item.place_id}>
                <button type="button" onClick={() => elegirResultado(item)}>
                  <strong>{partes[0]}</strong>
                  <small>{partes.slice(1, 4).join(',').trim()}</small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {mensaje && <p className="selub-mensaje">{mensaje}</p>}

      <div className="selub-mapa" style={{ height: altura }}>
        <MapContainer ref={setMapa} center={posicion || CENTRO_LIMA} zoom={posicion ? 16 : 12} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <ClicEnMapa alElegir={coordenadas => colocarPin(coordenadas)} />
          {posicion && (
            <Marker
              position={posicion}
              draggable
              eventHandlers={{
                dragend: evento => {
                  const punto = evento.target.getLatLng();
                  colocarPin([punto.lat, punto.lng]);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="selub-pie">
        {posicion ? (
          <>
            <span className="selub-ok"><MapPin size={14} aria-hidden="true" /> {direccion || 'Ubicación marcada'}</span>
            <span className="selub-coordenadas">{posicion[0].toFixed(5)}, {posicion[1].toFixed(5)}</span>
            <button type="button" className="selub-quitar" onClick={quitarUbicacion}><X size={12} aria-hidden="true" /> Quitar</button>
          </>
        ) : (
          <span className="selub-aviso">Sin ubicación: busca una dirección o haz clic en el mapa para marcar el punto base.</span>
        )}
      </div>
    </div>
  );
}
