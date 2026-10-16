// Utilidades para ubicar un punto en el mapa a partir de lo que escribe el usuario: una direccion, unas coordenadas o un enlace de Google Maps.

// OpenStreetMap solo entiende bien la direccion escrita completa ("Avenida", no "Av.") y sin ", Peru" al final;
// por eso se arregla el texto antes de buscar.
const ABREVIATURAS = [
  [/\bAV(?:DA?)?(?:\.\s*|(?=\s))/gi, 'Avenida '],
  [/\bJR(?:\.\s*|(?=\s))/gi, 'Jirón '],
  [/\bCAL?(?:\.\s*|(?=\s))/gi, 'Calle '],
  [/\bPSJE?(?:\.\s*|(?=\s))/gi, 'Pasaje '],
  [/\bURB(?:\.\s*|(?=\s))/gi, 'Urbanización '],
];
const COORDENADAS = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const ESPERA_ENTRE_BUSQUEDAS_MS = 1100;

const arreglarEspacios = texto => texto.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim();

export function prepararConsulta(texto) {
  let consulta = String(texto ?? '').replace(/,?\s*per[uú]\s*$/i, '');
  for (const [patron, reemplazo] of ABREVIATURAS) consulta = consulta.replace(patron, reemplazo);
  return arreglarEspacios(consulta);
}

const sinNumeros = texto => arreglarEspacios(texto.replace(/\b\d{1,5}[A-Za-z]?\b(?!\s+de\b)/g, ''));

// Coordenadas pegadas desde Google Maps (clic derecho -> copiar). Devuelve null si el texto no parece coordenadas,
// 'fuera' si no caen en Peru, o [latitud, longitud].
export function leerCoordenadas(texto) {
  const coincidencia = COORDENADAS.exec(texto);
  if (!coincidencia) return null;
  const latitud = Number(coincidencia[1]);
  const longitud = Number(coincidencia[2]);
  const enPeru = latitud >= -18.5 && latitud <= 0.1 && longitud >= -81.5 && longitud <= -68.5;
  return enPeru ? [latitud, longitud] : 'fuera';
}

export const parecerEnlace = texto => /^https?:\/\//i.test(String(texto ?? '').trim());

// Enlaces de Google Maps que ya traen las coordenadas en la direccion. Los enlaces cortos (maps.app.goo.gl) no las traen:
// esos los resuelve el servidor.
export function leerEnlaceDeGoogleMaps(url) {
  const patrones = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /maps\/place\/[^/]+\/(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const patron of patrones) {
    const m = String(url ?? '').match(patron);
    if (m) return [Number(m[1]), Number(m[2])];
  }
  return null;
}

export function zoomPorTipo(item) {
  const tipo = item.addresstype || item.type;
  if (['house', 'building', 'place'].includes(tipo)) return 18;
  if (['road', 'street', 'pedestrian', 'residential'].includes(tipo)) return 16;
  return 15;
}

// El servicio publico de OpenStreetMap permite como maximo una consulta por segundo (y no admite autocompletar al escribir:
// se busca solo cuando el usuario lo pide). El control es de todo el navegador, no de cada componente.
let ultimaConsulta = 0;

async function consultar(consulta) {
  const falta = ESPERA_ENTRE_BUSQUEDAS_MS - (Date.now() - ultimaConsulta);
  if (falta > 0) await new Promise(resolver => setTimeout(resolver, falta));
  ultimaConsulta = Date.now();

  const params = new URLSearchParams({ q: consulta, format: 'jsonv2', countrycodes: 'pe', limit: '6', 'accept-language': 'es' });
  const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } });
  if (!respuesta.ok) throw new Error('busqueda');
  return respuesta.json();
}

// Devuelve { lista, soloCalle }: soloCalle es true cuando el mapa no tiene el numero de la casa y solo encontro la calle.
export async function buscarDirecciones(texto) {
  const base = prepararConsulta(texto);
  let lista = await consultar(base);
  let soloCalle = false;
  if (!lista.length && /\d/.test(base)) {
    const calle = sinNumeros(base);
    if (calle && calle !== base) {
      lista = await consultar(calle);
      soloCalle = lista.length > 0;
    }
  }
  return { lista, soloCalle };
}
