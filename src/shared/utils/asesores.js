// El endpoint /api/asesores responde de a 12 por defecto (y 100 como maximo por pagina). Las pantallas que necesitan la
// lista completa de asesores (selector de rutas, lista de asesores, mapa...) deben pedir todas las paginas; si solo piden la
// primera, los asesores que quedan despues de los 12 primeros (por apellido) no aparecen.
export async function cargarTodosLosAsesores(api, config = {}) {
  const POR_PAGINA = 100;
  const todos = [];
  let pagina = 1;
  let totalPaginas = 1;
  do {
    const res = await api.get('/api/asesores', {
      ...config,
      params: { ...(config.params || {}), page: pagina, limit: POR_PAGINA },
    });
    todos.push(...(Array.isArray(res.data?.data) ? res.data.data : []));
    totalPaginas = Number(res.data?.pagination?.totalPages) || 1;
    pagina += 1;
  } while (pagina <= totalPaginas);
  // misma forma que la respuesta de axios que ya esperan las pantallas: res.data.data
  return { data: { data: todos } };
}
