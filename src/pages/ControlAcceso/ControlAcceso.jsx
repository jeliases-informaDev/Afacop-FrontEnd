import React, { useState, useContext, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { AuthContext } from '../../app/providers/AuthContext.jsx';
import { useNotification } from '../../app/providers/NotificationContext.jsx';
import { ROLES_CONFIG, MODULOS, DEMO_USERS } from '../../app/providers/AuthContext.jsx';
import { Shield, Users, Search, Plus, Edit2, Trash2, Check, X, Lock, Unlock, Key, AlertTriangle, ChevronRight, Save, RotateCcw, MapPin } from 'lucide-react';
import SelectorUbicacion from '../../shared/ui/SelectorUbicacion.jsx';

// ─── 1. UTILIDADES Y HELPERS ──────────────────────────────────
const MODULOS_LIST = Object.values(MODULOS);

function describeAuditEntry(entry) {
    const route = entry.ruta || '';
    const success = entry.estado_http < 400;
    if (route === '/api/auth/login') return success ? 'Inicio de sesión exitoso' : 'Intento de acceso rechazado';
    if (route === '/api/auth/logout') return 'Cierre de sesión';
    if (route.includes('/mfa/')) return success ? 'Verificación de seguridad completada' : 'Verificación de seguridad fallida';
    if (route.startsWith('/api/usuarios')) {
        if (entry.metodo === 'POST') return 'Usuario creado';
        if (entry.metodo === 'DELETE') return success ? 'Usuario eliminado' : 'Eliminación de usuario rechazada';
        if (['PUT', 'PATCH'].includes(entry.metodo)) return 'Usuario o permisos actualizados';
    }
    return success ? 'Operación administrativa completada' : 'Operación administrativa rechazada';
}

function describeDevice(userAgent = '') {
    if (!userAgent) return 'Dispositivo no identificado';
    const browser = /Edg\//.test(userAgent) ? 'Edge' : /CriOS\//.test(userAgent) ? 'Chrome iOS' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'Navegador web';
    const system = /iPhone|iPad/.test(userAgent) ? 'iOS' : /Android/.test(userAgent) ? 'Android' : /Windows/.test(userAgent) ? 'Windows' : /Mac OS X/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : 'Sistema no identificado';
    return `${browser} · ${system}`;
}

const evaluatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'transparent' };
    let score = 0;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score: 1, label: 'Débil', color: '#DC2626' };
    if (score <= 4) return { score: 2, label: 'Media', color: '#F59E0B' };
    return { score: 3, label: 'Fuerte', color: '#10B981' };
};

// ─── 2. COMPONENTES DE UI BÁSICOS ─────────────────────────────
function RoleBadge({ rol, rolesConfig }) {
    const cfg = (rolesConfig || ROLES_CONFIG)[rol] || { label: rol, color: '#6C757D', bg: 'rgba(108,117,125,0.1)' };
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
    );
}

function EstadoBadge({ estado }) {
    const active = estado === 'ACTIVO';
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', color: active ? '#059669' : '#DC2626', background: active ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)', padding: '3px 10px', borderRadius: '20px' }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor' }} />
            {active ? 'Activo' : 'Inactivo' }
    </span>
    );
}

function AccessFilterSelect({ value, onChange, options, ariaLabel }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const selectedOption = options.find(option => option.value === value) || options[0];

    useEffect(() => {
        const handleOutsideClick = (event) => { if (!containerRef.current?.contains(event.target)) setIsOpen(false); };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    return (
        <div className="access-custom-select clients-custom-select" ref={containerRef} onKeyDown={event => { if (event.key === 'Escape') { setIsOpen(false); containerRef.current?.querySelector('button')?.focus(); } }}>
            <button type="button" className={`clients-custom-select-trigger${isOpen ? ' is-open' : ''}`} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>
                <span>{selectedOption.label}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {isOpen && (
                <div className="clients-custom-select-menu" role="listbox">
                    {options.map(option => (
                        <button type="button" role="option" aria-selected={option.value === value} className={`clients-custom-select-option${option.value === value ? ' is-selected' : ''}`} key={option.value} onClick={() => { onChange(option.value); setIsOpen(false); }}>
                            <span>{option.label}</span>
                            {option.value === value && <span className="clients-custom-select-check">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const Field = React.forwardRef(({ label, type = 'text', required, placeholder, error, hint, action, ...rest }, ref) => {
    const [showPwd, setShowPwd] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPwd ? 'text' : 'password') : type;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '18px' }}>
                {label && (
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {label}{required && <span style={{ color: '#DC3545' }}> *</span>}
                    </label>
                )}
                {action}
            </div>
            <div style={{ position: 'relative' }}>
                <input type={inputType} ref={ref} {...rest} placeholder={placeholder} aria-invalid={Boolean(error)}
                       style={{ width: '100%', padding: isPassword ? '9px 36px 9px 12px' : '9px 12px', border: `1px solid ${error ? '#DC3545' : '#DEE2E6'}`, borderRadius: '6px', fontSize: '13px', color: '#212529', fontFamily: 'Inter, sans-serif', outline: 'none', background: '#FAFAFA', transition: 'border-color 0.15s', boxSizing: 'border-box' }}
                       onFocus={e => e.target.style.borderColor = '#0B22A1'} />
                {isPassword && (
                    <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6C757D', display: 'flex', alignItems: 'center' }}>
                        {showPwd
                            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        }
                    </button>
                )}
            </div>
            {(error || hint) && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, lineHeight: 1.35, color: error ? '#DC3545' : '#6C757D' }}>{error && <AlertTriangle size={11} style={{ flexShrink: 0 }} />}{error || hint}</span>}
        </div>
    );
});

function UserFormSelect({ value, onChange, options, ariaLabel, disabled = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const menuRef = useRef(null);
    const [menuPosition, setMenuPosition] = useState({});
    const selectedOption = options.find(option => option.value === value) || options[0];

    useEffect(() => {
        const handleOutsideClick = (event) => { if (!containerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setIsOpen(false); };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    return (
        <div className="routes-custom-select" ref={containerRef} style={{ width: '100%', minWidth: 0, flex: 'none' }} onKeyDown={event => { if (event.key === 'Escape') { setIsOpen(false); containerRef.current?.querySelector('button')?.focus(); } }}>
            <button type="button" className={`routes-custom-select-trigger${isOpen ? ' is-open' : ''}`} disabled={disabled} style={{ height: 40, fontSize: 13, opacity: disabled ? .65 : 1 }} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={isOpen}
                    onClick={() => {
                        const rect = containerRef.current.getBoundingClientRect();
                        const height = Math.min(options.length * 40 + 12, 240);
                        setMenuPosition({ position: 'fixed', left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: rect.width, right: 'auto', top: rect.bottom + height + 8 > window.innerHeight ? Math.max(8, rect.top - height - 7) : rect.bottom + 7, maxHeight: height, overflowY: 'auto', zIndex: 21000 });
                        setIsOpen(open => !open);
                    }}>
                <span>{selectedOption.label}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {isOpen && createPortal(
                <div ref={menuRef} style={menuPosition} className="routes-custom-select-menu" role="listbox">
                    {options.map(option => {
                        const selectedOption = option.value === value;
                        return (
                            <button type="button" role="option" aria-selected={selectedOption} className={`routes-custom-select-option${selectedOption ? ' is-selected' : ''}`} key={option.value} onClick={() => { onChange(option.value); setIsOpen(false); }}>
                                <span>{option.label}</span>
                                {selectedOption && <Check size={16} aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>, document.body
            )}
        </div>
    );
}

function SelectField({ label, value, onChange, options, disabled = false, hint = '' }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
            <UserFormSelect value={value} onChange={onChange} options={options} disabled={disabled} ariaLabel={label} />
            {hint && <span style={{ fontSize: 10, lineHeight: 1.35, color: '#6C757D' }}>{hint}</span>}
        </div>
    );
}

// ─── 3. SUB-COMPONENTES MODULARES DEL FORMULARIO ──────────────

function PasswordInput({ register, errors, setValue, watch, isEditMode }) {
    const passwordActual = watch('password');
    const pwdStrength = evaluatePasswordStrength(passwordActual);

    const generarPassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let pwd = "";
        for (let i = 0; i < 14; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
        setValue('password', pwd, { shouldValidate: true, shouldDirty: true });
    };

    const actionBtn = (
        <button
            type="button"
            onClick={generarPassword}
            title="Generar contraseña segura aleatoria"
            style={{
                background: '#F0F3FF',
                border: '1px solid #D0DBFF',
                borderRadius: '5px',
                color: '#0B22A1',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                lineHeight: 1.2,
                transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E0E7FF'; e.currentTarget.style.borderColor = '#B4C6FF'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F0F3FF'; e.currentTarget.style.borderColor = '#D0DBFF'; }}
        >
            <Key size={11} style={{ flexShrink: 0 }} />
            <span>Generar</span>
        </button>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Field
                label="Contraseña"
                placeholder="Asigna una contraseña"
                type="password"
                error={errors.password?.message}
                required={!isEditMode}
                hint="Min. 12 caracteres."
                action={actionBtn}
                {...register("password", { required: !isEditMode ? "Requerido" : false, minLength: { value: 12, message: "Mínimo 12 caracteres" } })}
            />
            {passwordActual && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <div style={{ flex: 1, height: '4px', background: '#E5E7EB', borderRadius: '2px', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ height: '100%', width: pwdStrength.score === 1 ? '33%' : pwdStrength.score === 2 ? '66%' : '100%', background: pwdStrength.color, transition: 'all 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: pwdStrength.color }}>{pwdStrength.label}</span>
                </div>
            )}
        </div>
    );
}

function FormNuevoAsesor({ register, watch, setValue, errors }) {
    const [showMap, setShowMap] = useState(false);
    const tipoDocActual = watch('tipo_documento');

    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', gap: '8px', alignItems: 'start' }}>
                    <SelectField label="Tipo *" value={tipoDocActual} options={[{ value: 'DNI', label: 'DNI' }, { value: 'CE', label: 'CE' }, { value: 'PASAPORTE', label: 'PAS' }]}
                                 onChange={v => { setValue('tipo_documento', v); setValue('dni', ''); }} />
                    <Field label="Documento" placeholder={tipoDocActual === 'DNI' ? '8 dígitos' : tipoDocActual === 'CE' ? '9 caracteres' : 'Libre'} error={errors.dni?.message} required
                           {...register("dni", {
                               required: "Requerido",
                               onChange: (e) => {
                                   let clean = e.target.value;
                                   if (tipoDocActual === 'DNI') clean = clean.replace(/\D/g, '').slice(0, 8);
                                   if (tipoDocActual === 'CE') clean = clean.replace(/[^A-Za-z0-9]/g, '').slice(0, 9).toUpperCase();
                                   setValue('dni', clean);
                                   if (!watch('username')) setValue('username', clean, { shouldValidate: true });
                               },
                               validate: (val) => {
                                   if (tipoDocActual === 'DNI' && !/^\d{8}$/.test(val)) return 'DNI inválido';
                                   if (tipoDocActual === 'CE' && !/^[A-Za-z0-9]{9}$/.test(val)) return 'CE inválido';
                                   return true;
                               }
                           })}
                    />
                </div>
                <Field label="Celular" placeholder="Ej. 987654321" error={errors.telefono?.message}
                       {...register("telefono", { onChange: e => setValue('telefono', e.target.value.replace(/\D/g, '').slice(0, 9)), pattern: { value: /^9\d{8}$/, message: "Celular inválido" } })} />
            </div>

            <Field label="Nombres" placeholder="Nombres completos" error={errors.nombres?.message} required {...register("nombres", { required: "Ingresa los nombres" })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Apellido Paterno" placeholder="Paterno" error={errors.apellido_paterno?.message} required {...register("apellido_paterno", { required: "Ingresa el apellido paterno" })} />
                <Field label="Apellido Materno" placeholder="Materno" {...register("apellido_materno")} />
            </div>
            <Field label="Distrito Base" placeholder="Ej. Lima, Miraflores..." {...register("distrito")} />

            <div>
                <button type="button" onClick={() => setShowMap(prev => !prev)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#0B22A1', background: '#F0F3FF', border: '1px solid #D0DBFF', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>
                    <MapPin size={13} /> {showMap ? 'Ocultar mapa' : 'Asignar punto en mapa (opcional)'}
                </button>
                {showMap && (
                    <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', border: '1px solid #DEE2E6' }}>
                        <SelectorUbicacion latitud={watch('latitud')} longitud={watch('longitud')}
                                           onChange={(lat, lng) => { setValue('latitud', lat); setValue('longitud', lng); }}
                                           onDistrictChange={dist => setValue('distrito', dist)} altura={180} />
                    </div>
                )}
            </div>
        </>
    );
}

function FormAdministrativo({ register, errors }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Nombres" placeholder="Ingrese nombres" error={errors.nombres?.message} required {...register("nombres", { required: "Requerido" })} />
            <Field label="Apellidos" placeholder="Ingrese apellidos" error={errors.apellidos?.message} required {...register("apellidos", { required: "Requerido" })} />
        </div>
    );
}

function FormCredencialesUniversales({ register, errors, watch, setValue, isEditMode }) {
    return (
        <div style={{ padding: '14px 16px', background: '#FAFAFA', borderRadius: '10px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#0B22A1', textTransform: 'uppercase', letterSpacing: '0.6px' }}>2. Credenciales de Acceso</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Usuario de Ingreso" placeholder="Ej. jperez" error={errors.username?.message} required {...register("username", { required: "Requerido", pattern: { value: /^[A-Za-z0-9._-]+$/, message: "Formato inválido" } })} />
                <PasswordInput register={register} errors={errors} watch={watch} setValue={setValue} isEditMode={isEditMode} />
            </div>
            <Field label="Correo corporativo / personal" placeholder="nombre@correo.com" type="email" error={errors.email?.message} required {...register("email", { required: "Requerido", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Email inválido" } })} />
        </div>
    );
}

function FormSeguridadYEstado({ watch, setValue, isCurrentUser }) {
    const mfaHabilitadoActual = watch('mfa_habilitado');
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SelectField label="Estado de la cuenta" value={watch('estado')} options={[{ value: 'ACTIVO', label: 'Activo' }, { value: 'INACTIVO', label: 'Inactivo' }]}
                         onChange={v => setValue('estado', v)} disabled={isCurrentUser} hint={isCurrentUser ? 'Tu cuenta debe permanecer activa mientras tienes sesión.' : ''} />

            <div onClick={() => setValue('mfa_habilitado', !mfaHabilitadoActual)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', border: `1.5px solid ${mfaHabilitadoActual ? '#0B22A1' : '#DEE2E6'}`, background: mfaHabilitadoActual ? '#F0F3FF' : '#FAFAFA', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: mfaHabilitadoActual ? '#0B22A1' : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><circle cx="12" cy="16" r="1" fill="#fff" stroke="none" /></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#212529' }}>Autenticación de dos factores (MFA)</div>
                        <div style={{ fontSize: 11, color: '#6C757D', marginTop: 1 }}>Requiere verificación adicional de identidad</div>
                    </div>
                </div>
                <div style={{ width: 40, height: 22, borderRadius: 99, flexShrink: 0, background: mfaHabilitadoActual ? '#0B22A1' : '#CED4DA', position: 'relative' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: mfaHabilitadoActual ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
            </div>
        </div>
    );
}

// ─── 4. MODAL PRINCIPAL ORQUESTADOR ───────────────────────────
function ModalUsuario({ usuario, onClose, onSave, rolesConfig, isCurrentUser = false }) {
    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
        defaultValues: usuario ? {
            ...usuario, tipo_documento: usuario.tipo_documento || 'DNI', dni: usuario.dni || '', telefono: usuario.telefono || '',
            apellido_paterno: usuario.apellido_paterno || '', apellido_materno: usuario.apellido_materno || '', distrito: usuario.distrito || '',
            password: ''
        } : {
            nombres: '', apellidos: '', apellido_paterno: '', apellido_materno: '', tipo_documento: 'DNI', dni: '', telefono: '', distrito: '', latitud: '', longitud: '',
            username: '', password: '', email: '', rol: 'ASESOR', sede: 'Lima', estado: 'ACTIVO', mfa_habilitado: false,
        }
    });

    const rolActual = watch('rol');
    const isNuevoAsesor = rolActual === 'ASESOR' && !usuario;

    const onSubmit = async (data) => {
        await onSave({ ...data, isNewAdvisor: isNuevoAsesor, id: usuario?.id || `u${Date.now()}` });
    };

    return createPortal((
        <div className="user-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 15, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000, padding: 20 }}>
            <div className={`user-modal-card${!usuario ? ' user-create-styled' : ''}`} style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', width: '100%', maxWidth: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.12)' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #E5E7EB', background: '#F8FAFF', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
                    <div className="user-create-heading">
                        {!usuario && <span className="user-create-icon"><Users size={22} /></span>}
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#212529', letterSpacing: '-0.3px' }}>
                                {usuario ? 'Editar Usuario' : isNuevoAsesor ? 'Nuevo Asesor y Cuenta' : 'Nuevo Usuario'}
                            </h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6C757D' }}>
                                {usuario ? 'Modifica los datos del operador' : isNuevoAsesor ? 'Registra los datos de campo y su acceso móvil' : 'Registra un nuevo operador en el sistema'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} style={{ background: '#F3F4F6', border: 'none', cursor: 'pointer', color: '#6C757D', padding: '6px', borderRadius: '8px' }}><X size={18} /></button>
                </div>

                <form className="user-modal-form" onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                    <div className="user-modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>

                        {/* SECCIÓN 1: CONFIGURACIÓN INICIAL */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <SelectField label="Rol del sistema" value={rolActual} options={Object.entries(rolesConfig || ROLES_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                                         onChange={v => setValue('rol', v)} disabled={!!usuario} hint={!!usuario ? 'El rol no se puede cambiar.' : ''} />
                            <SelectField label="Sede" value={watch('sede')} options={[{ value: 'Lima', label: 'Lima' }, { value: 'Arequipa', label: 'Arequipa' }]}
                                         onChange={v => setValue('sede', v)} />
                        </div>

                        {/* SECCIÓN 2: DATOS PERSONALES (DINÁMICO SEGÚN ROL) */}
                        <div style={{ padding: '14px 16px', background: '#FAFAFA', borderRadius: '10px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <h4 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#0B22A1', textTransform: 'uppercase', letterSpacing: '0.6px' }}>1. Datos del Colaborador</h4>
                            {isNuevoAsesor && <FormNuevoAsesor register={register} watch={watch} setValue={setValue} errors={errors} />}
                            {rolActual !== 'ASESOR' && <FormAdministrativo register={register} errors={errors} />}
                            {usuario && rolActual === 'ASESOR' && <FormAdministrativo register={register} errors={errors} />} {/* Si edita un asesor, solo muestra nombres */}
                        </div>

                        {/* SECCIÓN 3: CREDENCIALES (UNIVERSAL PARA TODOS LOS FLUJOS) */}
                        <FormCredencialesUniversales register={register} errors={errors} watch={watch} setValue={setValue} isEditMode={!!usuario} />

                        {/* SECCIÓN 4: ESTADO Y SEGURIDAD MFA */}
                        <FormSeguridadYEstado watch={watch} setValue={setValue} isCurrentUser={isCurrentUser} />

                    </div>

                    <div className="user-modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid #E5E7EB', background: '#F8FAFF', borderRadius: '0 0 16px 16px', flexShrink: 0 }}>
                        <button type="button" onClick={onClose} style={S.btnGhost} disabled={isSubmitting}>Cancelar</button>
                        <button type="submit" style={S.btnPrimary} disabled={isSubmitting}>
                            <Check size={14} /> {isSubmitting ? 'Guardando...' : usuario ? 'Guardar cambios' : 'Crear usuario y acceso'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    ), document.body);
}

// ─── 5. PÁGINA PRINCIPAL ──────────────────────────────────────
function RolPermisoEditor({ rolKey, rolCfg, onSave, onCancel }) {
    const [modulos, setModulos] = useState([...rolCfg.modulos]);
    const toggle = (key) => setModulos(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    const hasChanged = JSON.stringify([...modulos].sort()) !== JSON.stringify([...rolCfg.modulos].sort());

    return (
        <div style={{ background: '#F0F4FF', border: `2px solid ${rolCfg.color}`, borderRadius: '12px', padding: '20px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: rolCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: rolCfg.color }}>
                        <Key size={16} />
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#212529' }}>{rolCfg.label}</div>
                        <div style={{ fontSize: '11px', color: '#6C757D' }}>{rolCfg.descripcion}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onCancel} style={{ ...S.btnGhost, padding: '6px 12px', fontSize: '12px' }}><X size={13} /> Cancelar</button>
                    <button onClick={() => onSave(modulos)} disabled={!hasChanged} style={{ ...S.btnPrimary, padding: '6px 12px', fontSize: '12px', opacity: hasChanged ? 1 : 0.4 }}><Save size={13} /> Guardar</button>
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                {MODULOS_LIST.map(m => {
                    const active = modulos.includes(m.key);
                    return (
                        <button key={m.key} onClick={() => toggle(m.key)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: `1.5px solid ${active ? rolCfg.color : '#DEE2E6'}`, borderRadius: '8px', background: active ? rolCfg.bg : '#FFFFFF', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: active ? rolCfg.color : '#9CA3AF', transition: 'all 0.15s', textAlign: 'left' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, border: `2px solid ${active ? rolCfg.color : '#DEE2E6'}`, background: active ? rolCfg.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {active && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
                            </div>
                            {m.label}
                        </button>
                    );
                })}
            </div>
            {!hasChanged && <p style={{ margin: '12px 0 0', fontSize: '11px', color: '#6C757D', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertTriangle size={12} /> Modifica los permisos para habilitar el guardado</p>}
        </div>
    );
}

export default function ControlAcceso() {
    const { api, user, logout, usuarios, setUsuarios, rolesConfig, updateRoleModulos, saveRole, deleteRole } = useContext(AuthContext);
    const { showToast } = useNotification();
    const [tab, setTab] = useState('usuarios');
    const [search, setSearch] = useState('');
    const [filtroRol, setFiltroRol] = useState('TODOS');
    const [filtroEstado, setFiltroEstado] = useState('TODOS');
    const [modal, setModal] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [editingRol, setEditingRol] = useState(null);
    const [savedMsg, setSavedMsg] = useState('');
    const [rolModal, setRolModal] = useState(null);
    const [auditLog, setAuditLog] = useState([]);

    const currentRolesConfig = rolesConfig || ROLES_CONFIG;
    const localUsuarios = usuarios || DEMO_USERS;

    useEffect(() => {
        if (tab !== 'auditoria') return;
        api.get('/api/seguridad/auditoria', { params: { limit: 50 } }).then(response => {
            setAuditLog((response.data.data || []).map(entry => ({
                id: entry.id_auditoria, desc: describeAuditEntry(entry), user: entry.actor || 'anonymous',
                fecha: new Date(entry.fecha).toLocaleString('es-PE'), source: 'Portal web',
                ip: entry.ip_address || (entry.ip_hash ? `Huella ${entry.ip_hash.slice(0, 10)}` : 'IP no disponible'),
                device: describeDevice(entry.user_agent), tipo: entry.estado_http >= 400 ? 'ALERTA' : 'OPERACIÓN',
                color: entry.estado_http >= 400 ? '#DC2626' : '#059669', icon: entry.estado_http >= 400 ? <AlertTriangle size={15} /> : <Unlock size={15} />,
            })));
        }).catch(error => showToast(error.response?.data?.error || 'No se pudo cargar la auditoría.', 'error'));
    }, [tab, api, showToast]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return localUsuarios.filter(u => {
            const matchSearch = !q || (u.nombres || '').toLowerCase().includes(q) || (u.apellidos || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
            const matchRol = filtroRol === 'TODOS' || u.rol === filtroRol;
            const matchEstado = filtroEstado === 'TODOS' || u.estado === filtroEstado;
            return matchSearch && matchRol && matchEstado;
        });
    }, [localUsuarios, search, filtroRol, filtroEstado]);

    const [userPage, setUserPage] = useState(1);
    const usersPerPage = 3;
    const totalUserPages = Math.max(1, Math.ceil(filtered.length / usersPerPage));
    const currentUserPage = Math.min(userPage, totalUserPages);
    const paginatedUsers = filtered.slice((currentUserPage - 1) * usersPerPage, currentUserPage * usersPerPage);

    useEffect(() => { setUserPage(1); }, [search, filtroRol, filtroEstado]);
    useEffect(() => { setUserPage(page => Math.min(page, totalUserPages)); }, [totalUserPages]);

    const handleSave = async (usuario) => {
        const changedOwnPassword = usuario.id === user?.id && Boolean(usuario.password);
        try {
            let finalAdvisorId = usuario.id_asesor;
            if (usuario.rol === 'ASESOR' && usuario.isNewAdvisor && !finalAdvisorId) {
                const advisorPayload = {
                    nombres: usuario.nombres.trim(),
                    apellido_paterno: (usuario.apellido_paterno || '').trim(),
                    apellido_materno: (usuario.apellido_materno || '').trim(),
                    apellidos: `${usuario.apellido_paterno || ''} ${usuario.apellido_materno || ''}`.trim(),
                    tipo_documento: usuario.tipo_documento,
                    dni: usuario.dni.trim(),
                    DNI: usuario.dni.trim(),
                    documento: usuario.dni.trim(),
                    telefono: (usuario.telefono || '').trim(),
                    email: usuario.email.trim(),
                    correo: usuario.email.trim(),
                    distrito: (usuario.distrito || '').trim(),
                    latitud: usuario.latitud || null,
                    longitud: usuario.longitud || null,
                };
                const resAdvisor = await api.post('/api/asesores', advisorPayload);
                const createdAdvisor = resAdvisor.data?.data || resAdvisor.data;
                finalAdvisorId = Number(createdAdvisor?.id_asesor ?? createdAdvisor?.id);
                if (!finalAdvisorId) throw new Error('No se pudo obtener el identificador del nuevo asesor registrado.');
            }

            const payload = {
                username: usuario.username.trim(), password: usuario.password || undefined, nombres: usuario.nombres.trim(),
                apellidos: usuario.rol === 'ASESOR' && usuario.isNewAdvisor ? `${usuario.apellido_paterno || ''} ${usuario.apellido_materno || ''}`.trim() : (usuario.apellidos || '').trim(),
                email: usuario.email.trim(), sede: usuario.sede, rol: usuario.rol, estado: usuario.estado, mfa_habilitado: Boolean(usuario.mfa_habilitado),
                id_asesor: usuario.rol === 'ASESOR' ? Number(finalAdvisorId) : null,
            };

            const response = usuario.id && !usuario.id.startsWith('u') ? await api.put(`/api/usuarios/${usuario.id}`, payload) : await api.post('/api/usuarios', payload);
            const saved = response.data.data;
            setUsuarios(localUsuarios.find(u => u.id === saved.id) ? localUsuarios.map(u => u.id === saved.id ? saved : u) : [...localUsuarios, saved]);
            setModal(null);

            if (changedOwnPassword) {
                showToast('Contraseña actualizada. Inicia sesión nuevamente con tu nueva contraseña.', 'success');
                logout({ notifyServer: false });
                return;
            }
            showToast(usuario.rol === 'ASESOR' && usuario.isNewAdvisor ? 'Asesor y cuenta creados correctamente.' : 'Usuario guardado correctamente.', 'success');
        } catch (error) {
            const data = error.response?.data;
            showToast(Array.isArray(data?.details) ? data.details.map(i => i.message).join(' ') : (data?.mensaje || data?.error || error.message || 'Error al guardar.'), 'error');
        }
    };

    const handleDelete = async (id) => {
        try { await api.delete(`/api/usuarios/${id}`); }
        catch (error) { showToast(error.response?.data?.mensaje || error.response?.data?.error || 'No se pudo eliminar el usuario.', 'error'); return; }
        setUsuarios(localUsuarios.filter(u => u.id !== id));
        setConfirmDelete(null);
        showToast('Usuario eliminado correctamente.', 'success');
    };

    const toggleEstado = async (usuario) => {
        const updated = { ...usuario, estado: usuario.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' };
        try { await api.patch(`/api/usuarios/${usuario.id}`, { estado: updated.estado }); }
        catch (error) { showToast(error.response?.data?.mensaje || error.response?.data?.error || 'No se pudo actualizar el estado.', 'error'); return; }
        setUsuarios(localUsuarios.map(u => u.id === usuario.id ? updated : u));
        showToast(`Usuario ${updated.estado === 'ACTIVO' ? 'activado' : 'desactivado'} correctamente.`, 'success');
    };

    const handleSavePermisos = (rolKey, newModulos) => {
        updateRoleModulos(rolKey, newModulos); setEditingRol(null);
        setSavedMsg(`Permisos de ${currentRolesConfig[rolKey].label} actualizados`); setTimeout(() => setSavedMsg(''), 3000);
    };

    const resetRolPermisos = (rolKey) => {
        updateRoleModulos(rolKey, [...ROLES_CONFIG[rolKey].modulos]);
        setSavedMsg(`Permisos de ${currentRolesConfig[rolKey].label} restaurados al valor por defecto`); setTimeout(() => setSavedMsg(''), 3000);
    };

    const statCards = [
        { label: 'Total usuarios', value: localUsuarios.length, color: '#0B22A1', bg: 'rgba(11,34,161,0.08)', icon: <Users size={18} /> },
        { label: 'Activos', value: localUsuarios.filter(u => u.estado === 'ACTIVO').length, color: '#059669', bg: 'rgba(5,150,105,0.08)', icon: <Unlock size={18} /> },
        { label: 'Inactivos', value: localUsuarios.filter(u => u.estado !== 'ACTIVO').length, color: '#DC2626', bg: 'rgba(220,38,38,0.08)', icon: <Lock size={18} /> },
        { label: 'Roles configurados', value: Object.keys(currentRolesConfig).length, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', icon: <Shield size={18} /> },
    ];

    const TABS = [{ key: 'usuarios', label: 'Usuarios y Operadores' }, { key: 'roles', label: 'Roles y Permisos' }, { key: 'auditoria', label: 'Auditoría de Accesos' }];

    return (
        <div className="access-control-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Shield size={18} color="#0B22A1" />
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#0B22A1', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Administración</span>
                    </div>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#212529', letterSpacing: '-0.5px' }}>Control de Acceso</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6C757D' }}>Gestión de usuarios, roles y permisos del sistema</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setModal({ mode: 'create' })} style={{ ...S.btnPrimary, height: 34, minHeight: 34, padding: '4px 12px', fontSize: 13, boxSizing: 'border-box' }}>
                        <Plus size={15} /> Nuevo usuario
                    </button>
                </div>
            </div>

            {savedMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#059669' }}>
                    <Check size={15} /> {savedMsg}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                {statCards.map((c, i) => (
                    <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, flexShrink: 0 }}>{c.icon}</div>
                        <div>
                            <div style={{ fontSize: '26px', fontWeight: '800', color: '#212529', lineHeight: 1, letterSpacing: '-1px' }}>{c.value}</div>
                            <div style={{ fontSize: '12px', color: '#6C757D', marginTop: '2px' }}>{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="access-tabs" style={{ display: 'flex', gap: '0', borderBottom: '2px solid #E5E7EB' }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 20px', fontSize: '13px', fontWeight: tab === t.key ? '700' : '500', color: tab === t.key ? '#0B22A1' : '#6C757D', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #0B22A1' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s', marginBottom: '-2px', letterSpacing: '-0.1px' }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'usuarios' && (
                <>
                    <div className="access-filters access-filter-bar" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
                            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                            <input className="access-filter-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, usuario o correo..." style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1px solid #DEE2E6', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#212529', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }} />
                        </div>
                        <AccessFilterSelect value={filtroRol} onChange={setFiltroRol} ariaLabel="Filtrar por rol" options={[{ value: 'TODOS', label: 'Todos los roles' }, ...Object.entries(currentRolesConfig).map(([value, role]) => ({ value, label: role.label }))]} />
                        <AccessFilterSelect value={filtroEstado} onChange={setFiltroEstado} ariaLabel="Filtrar por estado" options={[{ value: 'TODOS', label: 'Todos los estados' }, { value: 'ACTIVO', label: 'Activos' }, { value: 'INACTIVO', label: 'Inactivos' }]} />
                        {(search || filtroRol !== 'TODOS' || filtroEstado !== 'TODOS') && (
                            <button onClick={() => { setSearch(''); setFiltroRol('TODOS'); setFiltroEstado('TODOS'); }} style={{ padding: '9px 14px', background: '#F3F4F6', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#6C757D', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}><X size={13} /> Limpiar</button>
                        )}
                        <span style={{ fontSize: '12px', color: '#6C757D', marginLeft: 'auto' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className="access-users-table-wrap" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                        <table className="access-users-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ background: '#F8F9FA' }}>{['Operador', 'Correo', 'Rol', 'Sede', 'Módulos', 'Estado', 'Acciones'].map(h => <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '800', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #E5E7EB' }}>{h}</th>)}</tr></thead>
                            <tbody>
                            {filtered.length === 0 ? <tr className="access-empty-row"><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}><Shield size={28} color="#DEE2E6" style={{ display: 'block', margin: '0 auto 10px' }} />No se encontraron operadores</td></tr> : paginatedUsers.map((u, i) => {
                                const rolCfg = currentRolesConfig[u.rol] || { modulos: [] }; const isCurrentUser = u.id === user?.id;
                                return (
                                    <tr key={u.id} style={{ borderBottom: i < paginatedUsers.length - 1 ? '1px solid #F3F4F6' : 'none', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFBFF'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td data-label="Operador" style={{ padding: '12px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '36px', height: '36px', borderRadius: '10px', background: (currentRolesConfig[u.rol] || ROLES_CONFIG.ASESOR).bg, color: (currentRolesConfig[u.rol] || ROLES_CONFIG.ASESOR).color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 }}>{(u.nombres || '?')[0]}</div><div><div style={{ fontSize: '13px', fontWeight: '700', color: '#212529' }}>{u.nombres} {u.apellidos}</div><div style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'monospace' }}>@{u.username}</div></div></div></td>
                                        <td data-label="Correo" style={{ padding: '12px 16px', fontSize: '13px', color: '#6C757D' }}>{u.email || '—'}</td>
                                        <td data-label="Rol" style={{ padding: '12px 16px' }}><RoleBadge rol={u.rol} rolesConfig={currentRolesConfig} /></td>
                                        <td data-label="Sede" style={{ padding: '12px 16px', fontSize: '12px', color: '#212529', fontWeight: '600' }}>{u.sede || '—'}</td>
                                        <td data-label="Módulos" style={{ padding: '12px 16px' }}><div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', maxWidth: '200px' }}>{rolCfg.modulos.slice(0, 3).map(m => <span key={m} style={{ fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: '#EEF2FF', color: '#3730A3', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{MODULOS[m]?.label || m}</span>)}{rolCfg.modulos.length > 3 && <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: '#F3F4F6', color: '#9CA3AF' }}>+{rolCfg.modulos.length - 3}</span>}</div></td>
                                        <td data-label="Estado" style={{ padding: '12px 16px' }}><EstadoBadge estado={u.estado} /></td>
                                        <td data-label="Acciones" className="access-user-actions" style={{ padding: '12px 16px' }}><div style={{ display: 'flex', gap: '4px' }}><button onClick={() => toggleEstado(u)} disabled={isCurrentUser} title={isCurrentUser ? 'No puedes desactivar tu propia cuenta' : (u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar')} style={{ ...S.iconBtn, color: u.estado === 'ACTIVO' ? '#DC2626' : '#059669', opacity: isCurrentUser ? 0.35 : 1, cursor: isCurrentUser ? 'not-allowed' : 'pointer' }}>{u.estado === 'ACTIVO' ? <Lock size={13} /> : <Unlock size={13} />}</button><button onClick={() => setModal({ mode: 'edit', usuario: u })} style={{ ...S.iconBtn, color: '#0B22A1' }}><Edit2 size={13} /></button><button onClick={() => setConfirmDelete(u)} disabled={isCurrentUser} title={isCurrentUser ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'} style={{ ...S.iconBtn, color: '#DC2626', opacity: isCurrentUser ? 0.35 : 1, cursor: isCurrentUser ? 'not-allowed' : 'pointer' }}><Trash2 size={13} /></button></div></td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length > 0 && (
                        <nav className="evaluation-pagination" aria-label="Paginación de usuarios">
                            <p className="evaluation-pagination-summary">Mostrando <strong>{(currentUserPage - 1) * usersPerPage + 1}–{Math.min(currentUserPage * usersPerPage, filtered.length)}</strong> de {filtered.length} usuarios</p>
                            <div className="evaluation-pagination-controls">
                                <button type="button" disabled={currentUserPage === 1} aria-label="Página anterior" onClick={() => setUserPage(currentUserPage - 1)}>‹</button>
                                {Array.from({ length: Math.min(5, totalUserPages) }, (_, index) => Math.max(1, Math.min(currentUserPage - 2, totalUserPages - 4)) + index).map(page => <button type="button" key={page} aria-label={`Ir a la página ${page}`} aria-current={page === currentUserPage ? 'page' : undefined} onClick={() => setUserPage(page)}>{page}</button>)}
                                <button type="button" disabled={currentUserPage === totalUserPages} aria-label="Página siguiente" onClick={() => setUserPage(currentUserPage + 1)}>›</button>
                            </div>
                            <p className="evaluation-pagination-position" aria-live="polite">Página {currentUserPage} de {totalUserPages}</p>
                        </nav>
                    )}
                </>
            )}

            {tab === 'roles' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6C757D' }}>Configura qué módulos puede acceder cada rol.</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { Object.keys(ROLES_CONFIG).forEach(k => resetRolPermisos(k)); setEditingRol(null); }} style={{ ...S.btnGhost, padding: '7px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><RotateCcw size={13} /> Restaurar por defecto</button>
                            <button onClick={() => setRolModal({ mode: 'create', rolKey: '', rolData: { label: '', descripcion: '', color: '#2563eb', bg: 'rgba(37,99,235,0.1)', modulos: [] } })} style={{ ...S.btnPrimary, padding: '7px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={13} /> Crear Rol</button>
                        </div>
                    </div>
                    <div className="access-roles-scroll">
                        <div className="permissions-table-wrap" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                            <table className="permissions-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1180px', tableLayout: 'auto' }}>
                                <thead><tr style={{ background: '#F8F9FA' }}><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '800', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #E5E7EB', minWidth: '190px' }}>ROL</th>{MODULOS_LIST.map(m => <th key={m.key} title={m.label} style={{ padding: '12px 10px', textAlign: 'center', fontSize: '10px', lineHeight: 1.25, fontWeight: '800', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.65px', borderBottom: '1px solid #E5E7EB', minWidth: m.key === 'admision' || m.key === 'asesores' ? 135 : 105, whiteSpace: 'normal' }}>{m.label}</th>)}<th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '10px', fontWeight: '800', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #E5E7EB', minWidth: 220 }}>ACCIONES</th></tr></thead>
                                <tbody>
                                {Object.entries(currentRolesConfig).map(([rolKey, rolCfg], i, arr) => (
                                    <tr key={rolKey} style={{ borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none', background: editingRol === rolKey ? '#FAFBFF' : 'transparent' }}>
                                        <td data-label="Rol" className="permission-role" style={{ padding: '14px 16px' }}><RoleBadge rol={rolKey} rolesConfig={currentRolesConfig} />{rolKey === 'ASESOR' && <div style={{ fontSize: 10, color: '#059669', fontWeight: 800, marginTop: 5 }}>SOLO APLICATIVO MÓVIL</div>}<div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '3px' }}>{localUsuarios.filter(u => u.rol === rolKey).length} usuarios</div></td>
                                        {MODULOS_LIST.map(m => {
                                            const tiene = rolCfg.modulos.includes(m.key); const mobileOnly = rolKey === 'ASESOR';
                                            return <td key={m.key} data-label={m.label} className="permission-module" style={{ padding: '14px 10px', textAlign: 'center' }}><div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: mobileOnly ? '#F3F4F6' : tiene ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.06)', color: mobileOnly ? '#9CA3AF' : tiene ? '#059669' : '#DC2626' }}>{mobileOnly ? <span title="No aplica: acceso exclusivo desde la app móvil" style={{ color: '#9CA3AF', fontWeight: 800 }}>—</span> : tiene ? <Check size={12} strokeWidth={2.5} /> : <X size={12} strokeWidth={2.5} />}</div></td>;
                                        })}
                                        <td data-label="Acciones" className="permission-actions" style={{ padding: '14px 16px', textAlign: 'center' }}>
                                            {rolKey === 'ASESOR' ? <span style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 20, color: '#059669', background: 'rgba(5,150,105,0.1)', fontSize: 10, fontWeight: 800 }}>PERMISOS EN APP</span> : <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}><button onClick={() => setEditingRol(editingRol === rolKey ? null : rolKey)} style={{ ...S.btnGhost, padding: '5px 10px', fontSize: '11px', fontWeight: '700', color: '#0B22A1', borderColor: '#0B22A1', display: 'flex', alignItems: 'center', gap: '4px' }}><Edit2 size={11} /> Permisos</button><button onClick={() => setRolModal({ mode: 'edit', rolKey, rolData: { label: rolCfg.label, descripcion: rolCfg.descripcion || '', color: rolCfg.color, bg: rolCfg.bg, modulos: rolCfg.modulos } })} style={{ ...S.btnGhost, padding: '5px 10px', fontSize: '11px', fontWeight: '700', color: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}><Edit2 size={11} /> Editar</button><button onClick={() => resetRolPermisos(rolKey)} title="Restaurar permisos" style={{ ...S.iconBtn, color: '#D97706', border: '1px solid #DEE2E6' }}><RotateCcw size={12} /></button>{!ROLES_CONFIG[rolKey] && <button onClick={() => setConfirmDelete({ type: 'role', rolKey, label: rolCfg.label })} style={{ ...S.iconBtn, color: '#DC2626', border: '1px solid #DEE2E6' }}><Trash2 size={12} /></button>}</div>}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                        {editingRol && currentRolesConfig[editingRol] && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}><ChevronRight size={14} color="#0B22A1" /><span style={{ fontSize: '12px', fontWeight: '700', color: '#0B22A1', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Editando permisos — {currentRolesConfig[editingRol].label}</span></div>
                                <RolPermisoEditor key={editingRol} rolKey={editingRol} rolCfg={currentRolesConfig[editingRol]} onSave={(mods) => handleSavePermisos(editingRol, mods)} onCancel={() => setEditingRol(null)} />
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', marginTop: '4px' }}>
                            {Object.entries(currentRolesConfig).map(([rolKey, rolCfg]) => (
                                <div key={rolKey} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}><RoleBadge rol={rolKey} rolesConfig={currentRolesConfig} /><span style={{ fontSize: '11px', color: '#6C757D' }}>{rolCfg.modulos.length}/{MODULOS_LIST.length} módulos</span></div>
                                    <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#6C757D', lineHeight: '1.5' }}>{rolCfg.descripcion}</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{MODULOS_LIST.map(m => { const tiene = rolCfg.modulos.includes(m.key); return <span key={m.key} style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', color: tiene ? rolCfg.color : '#C9CED6', background: tiene ? rolCfg.bg : '#F3F4F6', textTransform: 'uppercase' }}>{m.label}</span>; })}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {rolModal && (
                <div className="role-modal-overlay" onClick={() => setRolModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000, padding: 20 }}>
                    <div className="role-modal-card" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB' }}>
                        <div className="role-modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E5E7EB', background: '#F8FAFF', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#212529' }}>{rolModal.mode === 'create' ? 'Crear nuevo rol' : `Editar rol — ${rolModal.rolData.label}`}</h3><p style={{ margin: '2px 0 0', fontSize: 12, color: '#6C757D' }}>{rolModal.mode === 'create' ? 'Define el nombre, color y descripción' : 'Modifica los datos del rol'}</p></div>
                            <button onClick={() => setRolModal(null)} style={{ background: '#F3F4F6', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#6C757D' }}><X size={18} /></button>
                        </div>
                        <div className="role-modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {rolModal.mode === 'create' && (<div><label style={{ fontSize: 11, fontWeight: 700, color: '#6C757D', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Clave del rol <span style={{ color: '#DC3545' }}>*</span></label><input value={rolModal.rolKey} onChange={e => setRolModal(m => ({ ...m, rolKey: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))} placeholder="Ej: SUPERVISOR" style={{ width: '100%', padding: '9px 12px', border: '1px solid #DEE2E6', borderRadius: 6, fontSize: 13, background: '#FAFAFA', boxSizing: 'border-box' }} /><p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Solo letras mayúsculas, números y guión bajo.</p></div>)}
                            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6C757D', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Nombre del rol <span style={{ color: '#DC3545' }}>*</span></label><input value={rolModal.rolData.label} onChange={e => setRolModal(m => ({ ...m, rolData: { ...m.rolData, label: e.target.value } }))} placeholder="Ej: Supervisor de Campo" style={{ width: '100%', padding: '9px 12px', border: '1px solid #DEE2E6', borderRadius: 6, fontSize: 13, background: '#FAFAFA', boxSizing: 'border-box' }} /></div>
                            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6C757D', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Descripción</label><textarea value={rolModal.rolData.descripcion} onChange={e => setRolModal(m => ({ ...m, rolData: { ...m.rolData, descripcion: e.target.value } }))} rows={2} style={{ width: '100%', padding: '9px 12px', border: '1px solid #DEE2E6', borderRadius: 6, fontSize: 13, background: '#FAFAFA', resize: 'vertical', boxSizing: 'border-box' }} /></div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: '#6C757D', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Color del rol</label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[{ color: '#2563eb', bg: 'rgba(37,99,235,0.1)', label: 'Azul' }, { color: '#059669', bg: 'rgba(5,150,105,0.1)', label: 'Verde' }, { color: '#DC2626', bg: 'rgba(220,38,38,0.1)', label: 'Rojo' }, { color: '#D97706', bg: 'rgba(217,119,6,0.1)', label: 'Naranja' }, { color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', label: 'Violeta' }, { color: '#0891B2', bg: 'rgba(8,145,178,0.1)', label: 'Cian' }, { color: '#BE185D', bg: 'rgba(190,24,93,0.1)', label: 'Rosa' }, { color: '#374151', bg: 'rgba(55,65,81,0.1)', label: 'Gris' }].map(c => <button key={c.color} type="button" onClick={() => setRolModal(m => ({ ...m, rolData: { ...m.rolData, color: c.color, bg: c.bg } }))} title={c.label} style={{ width: 28, height: 28, borderRadius: '50%', background: c.color, border: rolModal.rolData.color === c.color ? `3px solid #212529` : '3px solid transparent', cursor: 'pointer', transition: 'transform 0.1s', transform: rolModal.rolData.color === c.color ? 'scale(1.2)' : 'scale(1)' }} />)}</div>
                            </div>
                            {rolModal.mode === 'create' && (<div><label style={{ fontSize: 11, fontWeight: 700, color: '#6C757D', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Módulos con acceso</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{MODULOS_LIST.map(m => { const selected = rolModal.rolData.modulos.includes(m.key); return <button key={m.key} type="button" onClick={() => setRolModal(prev => ({ ...prev, rolData: { ...prev.rolData, modulos: selected ? prev.rolData.modulos.filter(x => x !== m.key) : [...prev.rolData.modulos, m.key] } }))} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: `1px solid ${selected ? rolModal.rolData.color : '#DEE2E6'}`, background: selected ? rolModal.rolData.bg : '#F9FAFB', color: selected ? rolModal.rolData.color : '#6C757D', cursor: 'pointer' }}>{m.label}</button>; })}</div></div>)}
                        </div>
                        <div className="role-modal-footer" style={{ padding: '14px 24px', borderTop: '1px solid #E5E7EB', background: '#F8FAFF', borderRadius: '0 0 14px 14px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setRolModal(null)} style={S.btnGhost}>Cancelar</button>
                            <button onClick={() => {
                                const { mode, rolKey, rolData } = rolModal;
                                if (!rolData.label.trim()) return showToast('Ingresa el nombre del rol.', 'warning');
                                if (mode === 'create' && !rolKey.trim()) return showToast('Ingresa la clave del rol.', 'warning');
                                if (mode === 'create' && currentRolesConfig[rolKey]) return showToast('La clave del rol ya existe.', 'warning');
                                if (mode === 'create' && rolData.modulos.length === 0) return showToast('Selecciona al menos un módulo.', 'warning');
                                saveRole(mode === 'create' ? rolKey : rolModal.rolKey, rolData, mode === 'create');
                                setSavedMsg(mode === 'create' ? `Rol "${rolData.label}" creado` : `Rol "${rolData.label}" actualizado`); setTimeout(() => setSavedMsg(''), 3000);
                                setRolModal(null);
                            }} style={{ ...S.btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}><Save size={13} /> {rolModal.mode === 'create' ? 'Crear rol' : 'Guardar cambios'}</button>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'auditoria' && (
                <div className="access-audit-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '800', color: '#212529' }}>Registro de Accesos y Cambios</h3>
                        <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#6C757D' }}>Historial de operaciones críticas del sistema</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {auditLog.map((entry, i) => (
                                <div key={entry.id} style={{ display: 'flex', gap: '14px', padding: '12px 0', borderBottom: i < auditLog.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'flex-start' }}>
                                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: entry.color + '12', color: entry.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>{entry.icon}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '13px', fontWeight: '700', color: '#212529', marginBottom: '4px' }}>{entry.desc}</div><div style={{ fontSize: '11px', color: '#6C757D', lineHeight: 1.55 }}><strong>{entry.user}</strong> · {entry.source} · IP: {entry.ip}<br />{entry.device} · {entry.fecha}</div></div>
                                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '12px', background: entry.color + '14', color: entry.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{entry.tipo}</span>
                                </div>
                            ))}
                            {!auditLog.length && <div style={{ padding: '24px', textAlign: 'center', color: '#6C757D' }}>No hay operaciones auditadas.</div>}
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                        {Object.entries(currentRolesConfig).map(([rolKey, rolCfg]) => {
                            const count = localUsuarios.filter(u => u.rol === rolKey).length;
                            return (
                                <div key={rolKey} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><RoleBadge rol={rolKey} rolesConfig={currentRolesConfig} /><span style={{ fontSize: '20px', fontWeight: '800', color: '#212529' }}>{count}</span></div>
                                    <div style={{ height: '4px', background: '#F3F4F6', borderRadius: '99px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${count > 0 ? Math.min((count / localUsuarios.length) * 100, 100) : 0}%`, background: rolCfg.color, borderRadius: '99px', transition: 'width 0.6s ease' }} /></div>
                                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>{count > 0 ? `${Math.round((count / localUsuarios.length) * 100)}% del total` : 'Sin usuarios'}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {modal && (
                <ModalUsuario
                    usuario={modal.mode === 'edit' ? modal.usuario : null}
                    isCurrentUser={modal.mode === 'edit' && modal.usuario?.id === user?.id}
                    onClose={() => setModal(null)} onSave={handleSave} rolesConfig={currentRolesConfig} api={api}
                    linkedAdvisorIds={localUsuarios.map(item => Number(item.id_asesor)).filter(Number.isInteger)}
                />
            )}

            {confirmDelete && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(33,37,41,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
                    <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', width: '100%', maxWidth: 380, padding: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.12)' }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#DC2626' }}><AlertTriangle size={20} /></div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#212529', letterSpacing: '-0.3px' }}>{confirmDelete.type === 'role' ? 'Eliminar rol' : 'Eliminar usuario'}</h4>
                                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#6C757D', lineHeight: '1.5' }}>¿Confirma la eliminación de <strong style={{ color: '#212529' }}>{confirmDelete.type === 'role' ? confirmDelete.label : `${confirmDelete.nombres} ${confirmDelete.apellidos}`}</strong>? Esta acción es irreversible.</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setConfirmDelete(null)} style={S.btnGhost}>Cancelar</button>
                            <button onClick={() => {
                                if (confirmDelete.type === 'role') { deleteRole(confirmDelete.rolKey); showToast(`Rol "${confirmDelete.label}" eliminado.`, 'success'); setConfirmDelete(null); }
                                else { handleDelete(confirmDelete.id); }
                            }} style={{ ...S.btnPrimary, background: '#DC2626' }}><Trash2 size={13} /> Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const S = {
    btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: '#0B22A1', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
    btnGhost: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: '#FFFFFF', color: '#212529', border: '1px solid #DEE2E6', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
    iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: 'transparent', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.12s' },
};