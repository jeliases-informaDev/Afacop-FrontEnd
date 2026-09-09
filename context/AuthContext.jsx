import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const isAuthenticated = !!token;

  const [sedeActual, setSedeActual] = useState(() => {
    const saved = localStorage.getItem('sedeActual');
    return saved ? JSON.parse(saved) : { id: '11111111-1111-1111-1111-000000000001', nombre: 'Lima' };
  });

  // 1. Instancia de API Principal con Interceptor (SOLUCIÓN ERROR 401)
  const apiData = React.useMemo(() => {
    const isProd = window.location.hostname !== 'localhost' && !window.location.hostname.includes('192.168');
    const API_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const PROD_URL = import.meta.env.VITE_API_URL || 'https://afacop-backend.onrender.com';
    const BASE_URL = import.meta.env.VITE_API_URL || (isProd ? PROD_URL : `http://${API_HOST}:4001`);

    console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
    
    const instance = axios.create({ baseURL: BASE_URL });

    // Interceptor: Inyecta token y sede mágicamente antes de cada petición
    instance.interceptors.request.use((config) => {
      const currentToken = localStorage.getItem('token');
      if (currentToken) config.headers.Authorization = `Bearer ${currentToken}`;
      
      const savedSede = localStorage.getItem('sedeActual');
      if (savedSede) config.headers['x-sede-id'] = JSON.parse(savedSede).id;
      
      return config;
    });

    return { instance, BASE_URL };
  }, []); // <--- Dependencias vacías para no destruir la instancia

  const api = apiData.instance;
  const API_BASE_URL = apiData.BASE_URL;

  // 2. Instancia de API Radar con Interceptor (SOLUCIÓN ERROR 401)
  const radarApi = React.useMemo(() => {
    const API_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const RADAR_BASE_URL = import.meta.env.VITE_RADAR_API_URL || `http://${API_HOST}:4001`;

    const instance = axios.create({ baseURL: RADAR_BASE_URL });

    // Interceptor para Radar API
    instance.interceptors.request.use((config) => {
      const currentToken = localStorage.getItem('token');
      if (currentToken) config.headers.Authorization = `Bearer ${currentToken}`;
      
      const savedSede = localStorage.getItem('sedeActual');
      if (savedSede) config.headers['x-sede-id'] = JSON.parse(savedSede).id;
      
      return config;
    });

    return instance;
  }, []); // <--- Dependencias vacías para no destruir la instancia

  const login = async (username, password) => {
    const response = await radarApi.post('/api/auth/login', { username, password });
    const { token: accessToken, user: loggedUser } = response.data;

    // BLOQUEO: Los WORKERS no pueden entrar a la plataforma web
    if (loggedUser.rol === 'WORKER') {
      throw new Error('Solo los administradores pueden acceder a este portal web.');
    }

    setToken(accessToken);
    setUser(loggedUser);
    localStorage.setItem('token', accessToken);
    return response.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  // optional: verify token on mount
  useEffect(() => {
    const verify = async () => {
      if (token) {
        try {
          const res = await radarApi.get('/api/auth/me');
          if (res.data.user.rol === 'WORKER') {
            logout();
          } else {
            setUser(res.data.user);
          }
        } catch {
          logout();
        }
      }
    };
    verify();
  }, [token, radarApi]); // depend on radarApi

  const cambiarSede = (sede) => {
    setSedeActual(sede);
    localStorage.setItem('sedeActual', JSON.stringify(sede));
  };

  // ── TEMA FIJO (personalización temporalmente desactivada) ────────────────
  const THEME_LOCKED = true;

  const FIXED_THEME_VARS = {
    '--c-sidebar-bg':  '#0B22A1',
    '--c-sidebar-text':'#FFFFFF',
    '--c-bg':          '#F5F7FB',
    '--c-surface':     '#FFFFFF',
    '--c-surface-2':   '#F8F9FA',
    '--c-border':      '#DEE2E6',
    '--c-text':        '#212529',
    '--c-muted':       '#6C757D',
    '--c-muted-2':     '#9CA3AF',
    '--c-primary':     '#0B22A1',
    '--c-primary-h':   '#233CC4',
    '--c-primary-rgb': '11, 34, 161',
    '--c-on-primary':  '#FFFFFF',
    '--logo-filter':   'none',
    '--font-main':     'Inter',
  };

  const PREDETERMINADO_THEME = {
    sidebar_bg: '#0B22A1',
    sidebar_text: '#FFFFFF',
    main_bg: '#F5F7FB',
    main_text: '#212529',
    primary_color: '#0B22A1',
    font_family: 'Inter',
    logo_filter: 'none'
  };

  const applyStyles = () => {
    const root = document.documentElement;
    Object.entries(FIXED_THEME_VARS).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute('data-theme', 'light');
  };

  const fetchAndApplyTheme = async () => {
    if (THEME_LOCKED) {
      applyStyles(null);
      return;
    }
    try {
      const cached = localStorage.getItem('cachedTheme');
      if (cached) applyStyles(JSON.parse(cached));
    } catch { /* ignore */ }
    try {
      const res = await api.get('/api/config');
      const s = res.data;
      if (s && s.sidebar_bg) {
        applyStyles(s);
      } else {
        applyStyles(PREDETERMINADO_THEME);
      }
    } catch (err) {
      console.error('Error applying theme:', err);
      applyStyles(PREDETERMINADO_THEME);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchAndApplyTheme();
  }, [isAuthenticated, sedeActual.id]);

  return (
    <AuthContext.Provider value={{ 
      token, user, isAuthenticated, login, logout, api, radarApi, sedeActual, cambiarSede, 
      applyStyles, fetchAndApplyTheme 
    }}>
      {children}
    </AuthContext.Provider>
  );
};