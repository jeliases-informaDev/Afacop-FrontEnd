import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../app/providers/AuthContext.jsx";
import CustomDatePicker from '../../shared/ui/CustomDatePicker.jsx';
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  MapPin,
  Search,
  UserRound,
  X,
} from "lucide-react";
import "./Evidencias.css";
const fullName = (value) =>
  [value?.nombres, value?.apellido_paterno, value?.apellido_materno]
    .filter(Boolean)
    .join(" ") || "Sin registrar";
const formatDate = (value) =>
  new Date(value).toLocaleString("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const money = (value) =>
  value == null
    ? "No registrado"
    : Number(value).toLocaleString("es-PE", {
        style: "currency",
        currency: "PEN",
      });
export default function Evidencias() {
  const { api } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({
    buscar: "",
    resultado: "",
    desde: "",
    hasta: "",
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resultMenuOpen, setResultMenuOpen] = useState(false);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState({ clientes: [], asesores: [] });
  const searchRef = useRef(null);
  const resultMenuRef = useRef(null);
  const resultOptions = [
    { value: "", label: "Todos los resultados" },
    { value: "GESTIONADO", label: "Gestionado" },
    { value: "REPROGRAMADO", label: "Reprogramado" },
    { value: "NO_ENCONTRADO", label: "No encontrado" },
  ];
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const response = await api.get("/api/visitas/evidencias", {
        params: { ...filters, page, limit: 12 },
      });
      setItems(response.data.data.items || []);
      setPagination(
        response.data.data.pagination || { page: 1, pages: 1, total: 0 },
      );
    } catch (e) {
      setError(
        e.response?.data?.error || "No se pudieron cargar las evidencias.",
      );
    } finally {
      setLoading(false);
    }
  }, [api, filters, page]);
  useEffect(() => {
    const timer = setTimeout(load, filters.buscar ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.buscar]);
  useEffect(() => {
    const refresh = (event) => {
      if (event.detail?.type === "evidence_created") load();
    };
    window.addEventListener("radar:data-changed", refresh);
    return () => window.removeEventListener("radar:data-changed", refresh);
  }, [load]);
  useEffect(() => {
    const term = filters.buscar.trim();
    if (!term) {
      setSuggestions({ clientes: [], asesores: [] });
      setSearchLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await api.get("/api/visitas/evidencias/sugerencias", {
          params: { buscar: term },
          signal: controller.signal,
        });
        setSuggestions(response.data?.data || { clientes: [], asesores: [] });
      } catch (requestError) {
        if (requestError.code !== "ERR_CANCELED") setSuggestions({ clientes: [], asesores: [] });
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, filters.buscar]);
  useEffect(() => {
    const close = (event) => {
      if (!resultMenuRef.current?.contains(event.target)) setResultMenuOpen(false);
      if (!searchRef.current?.contains(event.target)) setSearchMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const change = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const open = async (id) => {
    setDetailLoading(true);
    setSelected({ id_visita: id });
    try {
      const response = await api.get(`/api/visitas/evidencias/${id}`);
      setSelected(response.data.data);
    } catch (e) {
      setSelected(null);
      setError(e.response?.data?.error || "No se pudo abrir la evidencia.");
    } finally {
      setDetailLoading(false);
    }
  };
  return (
    <section className="evidence-page">
      <header className="evidence-heading">
        <div>
          <span className="evidence-eyebrow">
            <Camera size={15} /> CONTROL DE CAMPO
          </span>
          <h1 style={{fontSize: '26px'}}>Evidencias de gestión</h1>
          <p>
            Registro verificable de las visitas realizadas desde el aplicativo.
          </p>
        </div>
        <div className="evidence-total">
          <strong>{pagination.total}</strong>
          <span>gestiones documentadas</span>
        </div>
      </header>
      <div className="evidence-filters">
        <div className={`evidence-search${searchMenuOpen ? " is-open" : ""}`} ref={searchRef}>
          <Search size={18} />
          <input
            value={filters.buscar}
            onChange={(e) => {
              change("buscar", e.target.value);
              setSearchMenuOpen(Boolean(e.target.value.trim()));
            }}
            onFocus={() => setSearchMenuOpen(Boolean(filters.buscar.trim()))}
            placeholder="Buscar cliente, DNI o asesor…"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchMenuOpen}
            aria-controls="evidence-search-results"
          />
          {searchMenuOpen && (
            <div className="evidence-search-menu" id="evidence-search-results" role="listbox">
              {searchLoading ? (
                <div className="evidence-search-status">Buscando clientes y asesores…</div>
              ) : suggestions.clientes.length || suggestions.asesores.length ? (
                <>
                  {suggestions.clientes.length > 0 && (
                    <div className="evidence-search-group">
                      <span className="evidence-search-group-title">Clientes</span>
                      {suggestions.clientes.map((cliente) => (
                        <button type="button" role="option" key={`cliente-${cliente.id_cliente}`} onClick={() => { change("buscar", fullName(cliente)); setSearchMenuOpen(false); }}>
                          <span className="evidence-suggestion-avatar">{cliente.nombres?.[0] || "C"}</span>
                          <span className="evidence-suggestion-copy">
                            <strong>{fullName(cliente)}</strong>
                            <small>DNI {cliente.dni}{cliente.distrito ? ` · ${cliente.distrito}` : ""}</small>
                          </span>
                          <span className="evidence-suggestion-type">Cliente</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {suggestions.asesores.length > 0 && (
                    <div className="evidence-search-group">
                      <span className="evidence-search-group-title">Asesores</span>
                      {suggestions.asesores.map((asesor) => (
                        <button type="button" role="option" key={`asesor-${asesor.id_asesor}`} onClick={() => { change("buscar", fullName(asesor)); setSearchMenuOpen(false); }}>
                          <span className="evidence-suggestion-avatar is-advisor"><UserRound size={16} /></span>
                          <span className="evidence-suggestion-copy">
                            <strong>{fullName(asesor)}</strong>
                            <small>DNI {asesor.dni} · {asesor.estado === "ACTIVO" ? "Activo" : "Inactivo"}</small>
                          </span>
                          <span className="evidence-suggestion-type is-advisor">Asesor</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="evidence-search-status">No se encontraron clientes ni asesores con evidencias.</div>
              )}
            </div>
          )}
        </div>
        <div
          className={`evidence-select${resultMenuOpen ? " is-open" : ""}`}
          ref={resultMenuRef}
        >
          <button
            type="button"
            className="evidence-select-trigger"
            aria-haspopup="listbox"
            aria-expanded={resultMenuOpen}
            onClick={() => setResultMenuOpen((open) => !open)}
          >
            <span>{resultOptions.find((option) => option.value === filters.resultado)?.label}</span>
            <ChevronDown size={17} aria-hidden="true" />
          </button>
          {resultMenuOpen && (
            <div className="evidence-select-menu" role="listbox" aria-label="Filtrar por resultado">
              {resultOptions.map((option) => {
                const selectedOption = filters.resultado === option.value;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedOption}
                    className={selectedOption ? "is-selected" : ""}
                    key={option.value || "todos"}
                    onClick={() => {
                      change("resultado", option.value);
                      setResultMenuOpen(false);
                    }}
                  >
                    <span>{option.label}</span>
                    {selectedOption && <Check size={16} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <CustomDatePicker
          name="desde"
          aria-label="Desde"
          className="evidence-date-input"
          value={filters.desde}
          onChange={(e) => change("desde", e.target.value)}
        />
        <CustomDatePicker
          name="hasta"
          aria-label="Hasta"
          className="evidence-date-input"
          value={filters.hasta}
          onChange={(e) => change("hasta", e.target.value)}
        />
      </div>
      {error && <div className="evidence-error">{error}</div>}
      {loading ? (
        <div className="evidence-loading">
          <span />
          Cargando evidencias…
        </div>
      ) : items.length ? (
        <div className="evidence-grid">
          {items.map((item) => (
            <article className="evidence-card" key={item.id_visita}>
              <div className="evidence-card-top">
                <span
                  className={`evidence-status evidence-status--${item.resultado?.toLowerCase()}`}
                >
                  {item.resultado?.replaceAll("_", " ")}
                </span>
                <time>{formatDate(item.fecha_hora_checkin)}</time>
              </div>
              <div className="evidence-person">
                <div className="evidence-avatar">
                  {item.cliente?.nombres?.[0] || "C"}
                </div>
                <div>
                  <h2>{fullName(item.cliente)}</h2>
                  <p>
                    DNI {item.cliente?.dni} ·{" "}
                    {item.cliente?.distrito || "Sin distrito"}
                  </p>
                </div>
              </div>
              <p className="evidence-description">
                {item.observaciones || "Sin descripción registrada."}
              </p>
              <div className="evidence-tags">
                <span className={item.tiene_foto ? "ok" : ""}>
                  <Camera size={15} />
                  Foto
                </span>
                <span className={item.tiene_foto_adicional ? "ok" : ""}>
                  <Camera size={15} />
                  Foto 2
                </span>
                <span className={item.tiene_firma ? "ok" : ""}>
                  <FileSignature size={15} />
                  Firma
                </span>
                <span>
                  <CheckCircle2 size={15} />
                  {money(item.monto_recaudado)}
                </span>
              </div>
              <div className="evidence-card-footer">
                <span>
                  <UserRound size={15} />
                  {fullName(item.asesor)}
                </span>
                <button onClick={() => open(item.id_visita)}>
                  Ver evidencia
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="evidence-empty">
          <Camera size={34} />
          <h2>Aún no hay evidencias</h2>
          <p>
            Las fotos y firmas aparecerán aquí al sincronizar una gestión desde
            el aplicativo.
          </p>
        </div>
      )}
      {pagination.pages > 1 && (
        <nav className="evidence-pagination">
          <button
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            Página {pagination.page} de {pagination.pages}
          </span>
          <button
            disabled={page === pagination.pages}
            onClick={() => setPage((value) => value + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </nav>
      )}
      {selected && (
        <div className="evidence-modal" role="dialog" aria-modal="true">
          <button
            className="evidence-backdrop"
            aria-label="Cerrar"
            onClick={() => setSelected(null)}
          />
          <div className="evidence-modal-card">
            <header>
              <div>
                <span>EVIDENCIA #{selected.id_visita}</span>
                <h2>
                  {detailLoading ? "Cargando…" : fullName(selected.cliente)}
                </h2>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Cerrar">
                <X />
              </button>
            </header>
            {!detailLoading && (
              <div className="evidence-modal-body">
                <div className="evidence-media">
                  <figure>
                    <figcaption>
                      <Camera size={16} />
                      Fotografía
                    </figcaption>
                    {selected.foto_evidencia ? (
                      <img
                        src={selected.foto_evidencia}
                        alt={`Evidencia de ${fullName(selected.cliente)}`}
                      />
                    ) : (
                      <div className="media-missing">Sin fotografía</div>
                    )}
                  </figure>
                  <figure>
                    <figcaption>
                      <Camera size={16} />
                      Fotografía 2
                    </figcaption>
                    {selected.foto_adicional_evidencia ? (
                      <img src={selected.foto_adicional_evidencia} alt={`Segunda evidencia de ${fullName(selected.cliente)}`} />
                    ) : (
                      <div className="media-missing">Sin segunda fotografía</div>
                    )}
                  </figure>
                  <figure className="signature">
                    <figcaption>
                      <FileSignature size={16} />
                      Firma del cliente
                    </figcaption>
                    {selected.firma_evidencia ? (
                      <img
                        src={selected.firma_evidencia}
                        alt="Firma registrada por el cliente"
                      />
                    ) : (
                      <div className="media-missing">Sin firma</div>
                    )}
                  </figure>
                </div>
                <div className="evidence-detail">
                  <div>
                    <span>Resultado</span>
                    <strong>{selected.resultado?.replaceAll("_", " ")}</strong>
                  </div>
                  <div>
                    <span>Fecha y hora</span>
                    <strong>{formatDate(selected.fecha_hora_checkin)}</strong>
                  </div>
                  <div>
                    <span>Asesor</span>
                    <strong>{fullName(selected.asesor)}</strong>
                  </div>
                  <div>
                    <span>Monto recaudado</span>
                    <strong>{money(selected.monto_recaudado)}</strong>
                  </div>
                  <div className="wide">
                    <span>Descripción</span>
                    <p>
                      {selected.observaciones || "Sin descripción registrada."}
                    </p>
                  </div>
                  <div className="wide">
                    <span>Ubicación capturada</span>
                    <a
                      href={`https://www.google.com/maps?q=${selected.latitud},${selected.longitud}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={16} />
                      {selected.latitud}, {selected.longitud}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
