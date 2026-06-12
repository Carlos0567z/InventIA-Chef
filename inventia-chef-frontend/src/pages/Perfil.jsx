import { useEffect, useRef, useState } from 'react';
import { FaUser, FaEnvelope, FaShieldAlt, FaSignOutAlt, FaTrash, FaCheck, FaPlus, FaCheckCircle, FaLock, FaSave, FaExclamationTriangle, FaBookOpen, FaPencilAlt, FaStar, FaHeart } from 'react-icons/fa';
import { authHeaders, clearSession, getCurrentUser, getToken, isAuthenticated, saveSession } from '../services/auth';
import { listMisRecetasComunidad } from '../services/communityApi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../styles/pageTabs.css';
import '../styles/authAccess.css';
import '../styles/Recetas.css';
import '../styles/profileUser.css';
import { comprimirImagen } from '../utils/imageCompressor';
import { showToast } from '../utils/toast';

const Perfil = ({ embedded = false, authOnly = false } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const nextPath = query.get('next') || '/';

  const [modoAcceso, setModoAcceso] = useState('login');
  const [nombreAcceso, setNombreAcceso] = useState('');
  const [emailAcceso, setEmailAcceso] = useState('');
  const [passwordAcceso, setPasswordAcceso] = useState('');
  const [passwordAccesoConfirmacion, setPasswordAccesoConfirmacion] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [mostrarPasswordAcceso, setMostrarPasswordAcceso] = useState(false);
  const [recordarme, setRecordarme] = useState(false);
  const [errorAcceso, setErrorAcceso] = useState('');
  const [cargandoAcceso, setCargandoAcceso] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [googleDisponible, setGoogleDisponible] = useState(false);

  const [token, setToken] = useState(getToken());
  const [user, setUser] = useState(getCurrentUser());
  const [perfil, setPerfil] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  const [nombreCuenta, setNombreCuenta] = useState('');
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordNuevaConfirmacion, setPasswordNuevaConfirmacion] = useState('');
  const [imagenPerfil, setImagenPerfil] = useState('');
  const [imagenBanner, setImagenBanner] = useState('');
  const [biografia, setBiografia] = useState('');
  const [mostrarModalPassword, setMostrarModalPassword] = useState(false);

  // Estados para el recorte/previsualización de imagen
  const [imagenTemporal, setImagenTemporal] = useState(null);
  const [tipoEdicionImagen, setTipoEdicionImagen] = useState(null); // 'avatar' o 'banner'
  const [mostrarModalRecorte, setMostrarModalRecorte] = useState(false);
  const [zoomImagen, setZoomImagen] = useState(1);

  const [mensajeSesion, setMensajeSesion] = useState(null);
  const [mensajeCuenta, setMensajeCuenta] = useState(null);
  const [mensajeAcceso, setMensajeAcceso] = useState(null);
  const [mensajePassword, setMensajePassword] = useState(null);

  const [misRecetas, setMisRecetas] = useState([]);
  const [cargandoMisRecetas, setCargandoMisRecetas] = useState(false);
  const passwordActualInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const botonAbrirPasswordRef = useRef(null);
  const ultimoElementoActivoRef = useRef(null);
  const alergiasSectionRef = useRef(null);
  const googleButtonRef = useRef(null);
  const googleInitializedRef = useRef(false);
  const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

  const leerArchivoImagen = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });

  const onBannerFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await leerArchivoImagen(file);
      setImagenTemporal(b64);
      setTipoEdicionImagen('banner');
      setMostrarModalRecorte(true);
      setZoomImagen(1);
    } catch (err) {
      alert(err.message);
    }
    e.target.value = ''; // limpiar input file
  };

  const onAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await leerArchivoImagen(file);
      setImagenTemporal(b64);
      setTipoEdicionImagen('avatar');
      setMostrarModalRecorte(true);
      setZoomImagen(1);
    } catch (err) {
      alert(err.message);
    }
    e.target.value = ''; // limpiar input file
  };

  const confirmarImagen = async () => {
    if (!imagenTemporal) {
      cerrarModalRecorte();
      return;
    }

    const config = tipoEdicionImagen === 'avatar' 
      ? { w: 400, h: 400, q: 0.7 } 
      : { w: 1200, h: 400, q: 0.6 };

    try {
      const b64Comprimida = await comprimirImagen(imagenTemporal, config.w, config.h, config.q);
      
      let nuevaImgPerfil = imagenPerfil;
      let nuevaImgBanner = imagenBanner;

      if (tipoEdicionImagen === 'avatar') {
        setImagenPerfil(b64Comprimida);
        nuevaImgPerfil = b64Comprimida;
      } else {
        setImagenBanner(b64Comprimida);
        nuevaImgBanner = b64Comprimida;
      }

      // Guardamos directamente en el servidor para que el usuario no tenga que darle al botón de abajo
      showToast('Guardando imagen...', 'info');
      const response = await fetch('/api/perfil/account', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ 
          nombre: nombreCuenta,
          biografia: biografia,
          imagen_perfil: nuevaImgPerfil,
          imagen_banner: nuevaImgBanner
        }),
      });

      if (response.ok) {
        const data = await response.json();
        saveSession({ token: data.token, user: data.user });
        showToast(tipoEdicionImagen === 'avatar' ? 'Foto de perfil actualizada' : 'Banner actualizado', 'success');
      } else {
        throw new Error('Error al guardar la imagen');
      }

    } catch (error) {
      console.error('Error al procesar/guardar la imagen:', error);
      showToast('No se ha podido guardar la imagen. Inténtalo de nuevo.', 'error');
    }

    cerrarModalRecorte();
  };

  const cerrarModalRecorte = () => {
    setImagenTemporal(null);
    setTipoEdicionImagen(null);
    setMostrarModalRecorte(false);
  };

  const opcionesAlergias = [
    'Celiaco (Sin Gluten)',
    'Alergia al Marisco',
    'Intolerancia a la Lactosa',
    'Alergia a los Frutos Secos',
    'Vegano',
    'Vegetariano',
  ];

  // Lógica de pasos para completar el perfil
  const pasosPerfil = [
    { id: 'avatar', label: 'Sube una foto de perfil', completado: !!imagenPerfil },
    { id: 'banner', label: 'Personaliza tu banner', completado: !!imagenBanner },
    { id: 'receta', label: 'Publica tu primera receta', completado: misRecetas.length > 0 },
  ];
  
  const pasosCompletados = pasosPerfil.filter(p => p.completado).length;
  const porcentajeCompletado = Math.round((pasosCompletados / pasosPerfil.length) * 100);

  useEffect(() => {
    const refreshAuth = () => {
      setToken(getToken());
      setUser(getCurrentUser());
    };

    window.addEventListener('auth-changed', refreshAuth);
    window.addEventListener('storage', refreshAuth);

    return () => {
      window.removeEventListener('auth-changed', refreshAuth);
      window.removeEventListener('storage', refreshAuth);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      setPerfil(null);
      return;
    }

    const cargarPerfil = async () => {
      try {
        const response = await fetch('/api/perfil', {
          headers: {
            ...authHeaders(),
          },
        });

        if (response.status === 401) {
          clearSession();
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setPerfil(data);
          setNombreCuenta(data?.nombre || '');
          setBiografia(data?.biografia || '');
          setImagenPerfil(data?.imagen_perfil || '');
          setImagenBanner(data?.imagen_banner || '');
        }
      } catch (error) {
        console.error('Error al cargar perfil:', error);
      }
    };

    const cargarMisRecetas = async () => {
      try {
        setCargandoMisRecetas(true);
        const data = await listMisRecetasComunidad();
        setMisRecetas(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error al cargar mis recetas en perfil:', error);
      } finally {
        setCargandoMisRecetas(false);
      }
    };

    cargarPerfil();
    cargarMisRecetas();
  }, [token]);

  const redirigirTrasAcceso = (data) => {
    const rol = String(data?.user?.rol || '').toLowerCase();
    if (nextPath === '/recetas-comunidad/contribuir' && rol === 'admin') {
      navigate('/admin');
      return;
    }
    navigate(nextPath);
  };

  useEffect(() => {
    if (!authOnly || isAuthenticated()) {
      setGoogleDisponible(false);
      return;
    }

    if (!googleClientId) {
      setGoogleDisponible(false);
      return;
    }

    let isMounted = true;
    let scriptNode = null;

    const onGoogleResponse = async (response) => {
      const credential = String(response?.credential || '').trim();
      if (!credential) {
        setErrorAcceso('No pudimos iniciar sesión con Google. Inténtalo de nuevo.');
        return;
      }

      setErrorAcceso('');
      setCargandoGoogle(true);
      try {
        const r = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(data?.mensaje || `No se pudo completar la solicitud (HTTP ${r.status}).`);
        }

        saveSession({ token: data.token, user: data.user });
        redirigirTrasAcceso(data);
      } catch (error) {
        setErrorAcceso(error.message || 'No pudimos iniciar sesión con Google. Inténtalo de nuevo.');
      } finally {
        setCargandoGoogle(false);
      }
    };

    const renderGoogleButton = () => {
      if (!isMounted) return;
      if (!googleButtonRef.current) return;
      if (!window.google?.accounts?.id) {
        window.setTimeout(renderGoogleButton, 120);
        return;
      }

      if (!googleInitializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: onGoogleResponse,
        });
        googleInitializedRef.current = true;
      }

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 320,
      });

      setGoogleDisponible(true);
    };

    const existingScript = document.getElementById('google-gsi-client');
    if (!existingScript) {
      scriptNode = document.createElement('script');
      scriptNode.id = 'google-gsi-client';
      scriptNode.src = 'https://accounts.google.com/gsi/client';
      scriptNode.async = true;
      scriptNode.defer = true;
      scriptNode.onload = renderGoogleButton;
      document.head.appendChild(scriptNode);
    } else {
      renderGoogleButton();
    }

    return () => {
      isMounted = false;
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, [authOnly, googleClientId]);

  const submitAcceso = async (event) => {
    event.preventDefault();
    setMensajeSesion(null);
    setErrorAcceso('');

    const email = String(emailAcceso || '').trim().toLowerCase();
    const password = String(passwordAcceso || '');
    const nombre = String(nombreAcceso || '').trim();

    if (!email || !password) {
      setErrorAcceso('Completa correo y contraseña.');
      return;
    }

    if (modoAcceso === 'register') {
      if (!nombre) {
        setErrorAcceso('Completa tu nombre para registrarte.');
        return;
      }
      if (password.length < 6) {
        setErrorAcceso('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (password !== String(passwordAccesoConfirmacion || '')) {
        setErrorAcceso('La confirmación de contraseña no coincide.');
        return;
      }
      if (!aceptaTerminos) {
        setErrorAcceso('Debes aceptar los términos para continuar.');
        return;
      }
    }

    try {
      setCargandoAcceso(true);

      const endpoint = modoAcceso === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = modoAcceso === 'register'
        ? { nombre, email, password }
        : { email, password, recordarme };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.mensaje || `No se pudo completar la solicitud (HTTP ${response.status}).`);
      }

      saveSession({ token: data.token, user: data.user });
      setEmailAcceso('');
      setPasswordAcceso('');
      setPasswordAccesoConfirmacion('');
      setAceptaTerminos(false);
      setMostrarPasswordAcceso(false);
      redirigirTrasAcceso(data);
    } catch (err) {
      setErrorAcceso(err.message || 'No pudimos completar la autenticación. Inténtalo de nuevo.');
    } finally {
      setCargandoAcceso(false);
    }
  };

  const recuperarPassword = () => {
    setErrorAcceso('La recuperación de contraseña por correo aún no está disponible.');
  };

  const abrirModalPassword = () => {
    setMostrarModalPassword(true);
    setMensajePassword(null);
    setMensajeAcceso(null);
    ultimoElementoActivoRef.current = document.activeElement;
  };

  const cerrarModalPassword = () => {
    setMostrarModalPassword(false);
    setMensajePassword(null);
    setPasswordActual('');
    setPasswordNueva('');
    setPasswordNuevaConfirmacion('');

    const boton = botonAbrirPasswordRef.current;
    if (boton && typeof boton.focus === 'function') {
      boton.focus();
      return;
    }

    const ultimo = ultimoElementoActivoRef.current;
    if (ultimo && typeof ultimo.focus === 'function') {
      ultimo.focus();
    }
  };

  const cerrarSesion = () => {
    const nombrePendiente = String(nombreCuenta || '').trim() !== String(perfil?.nombre || '').trim();
    const passwordPendiente = Boolean(passwordActual || passwordNueva || passwordNuevaConfirmacion);
    const hayCambiosPendientes = nombrePendiente || passwordPendiente;

    if (hayCambiosPendientes) {
      const confirmar = window.confirm('Tienes cambios sin guardar. Si cierras sesión ahora se perderán. ¿Quieres continuar?');
      if (!confirmar) {
        return;
      }
    }

    clearSession();
    setPerfil(null);
    setPasswordAcceso('');
    setPasswordActual('');
    setPasswordNueva('');
    setPasswordNuevaConfirmacion('');
    setMostrarModalPassword(false);
    setMensajeSesion({
      tipo: 'ok',
      texto: 'Sesión cerrada correctamente.',
    });
  };

  const solicitarEliminacion = () => {
    if(window.confirm('¿Estás seguro de que deseas eliminar tu cuenta? Esta acción no se puede deshacer. (Nota: Esto es una demostración, contacta con soporte para ejecutar la eliminación real)')) {
      alert('Se ha enviado una solicitud a soporte para la eliminación de la cuenta.');
    }
  };

  const guardarCuenta = async (event) => {
    event.preventDefault();
    setMensajeCuenta(null);

    const nombre = String(nombreCuenta || '').trim();
    if (!nombre) {
      setMensajeCuenta({ tipo: 'error', texto: 'El nombre no puede estar vacío.' });
      return;
    }

    try {
      setGuardandoCuenta(true);
      const response = await fetch('/api/perfil/account', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ 
          nombre,
          biografia,
          imagen_perfil: imagenPerfil,
          imagen_banner: imagenBanner
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        clearSession();
        return;
      }
      if (!response.ok) {
        throw new Error(data?.mensaje || `No se pudo completar la solicitud (HTTP ${response.status}).`);
      }

      saveSession({ token: data.token, user: data.user });
      if (data?.perfil) {
        setPerfil(data.perfil);
      }

      setMensajeCuenta({ tipo: 'ok', texto: 'Perfil actualizado correctamente.' });
    } catch (error) {
      setMensajeCuenta({ tipo: 'error', texto: error.message || 'No se pudo actualizar el nombre.' });
    } finally {
      setGuardandoCuenta(false);
    }
  };

  const cambiarPassword = async (event) => {
    event.preventDefault();
    setMensajePassword(null);
    setMensajeAcceso(null);

    if (!passwordActual || !passwordNueva) {
      setMensajePassword({ tipo: 'error', texto: 'Completa la contraseña actual y la nueva.' });
      return;
    }

    if (passwordNueva.length < 6) {
      setMensajePassword({ tipo: 'error', texto: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    if (passwordNueva !== passwordNuevaConfirmacion) {
      setMensajePassword({ tipo: 'error', texto: 'La confirmación de contraseña no coincide.' });
      return;
    }

    try {
      setGuardandoPassword(true);
      const response = await fetch('/api/perfil/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          password_actual: passwordActual,
          password_nueva: passwordNueva,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        const mensaje401 = String(data?.mensaje || '');
        if (mensaje401.toLowerCase().includes('no autorizado')) {
          clearSession();
          return;
        }

        const restantes = Number(data?.intentos_restantes);
        const sufijoRestantes = Number.isFinite(restantes)
          ? ` Intentos restantes: ${Math.max(restantes, 0)}.`
          : '';
        setMensajePassword({
          tipo: 'error',
          texto: `${mensaje401 || 'La contraseña actual no es válida.'}${sufijoRestantes}`,
        });
        return;
      }

      if (response.status === 429) {
        const retry = Number(data?.retry_after_segundos || 0);
        const extra = retry > 0 ? ` Vuelve a intentarlo en ${retry} segundos.` : '';
        setMensajePassword({
          tipo: 'error',
          texto: `${String(data?.mensaje || 'Demasiados intentos.')} ${extra}`.trim(),
        });
        return;
      }

      if (!response.ok) {
        throw new Error(data?.mensaje || `No se pudo completar la solicitud (HTTP ${response.status}).`);
      }

      saveSession({ token: data.token, user: data.user });
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordNuevaConfirmacion('');
      cerrarModalPassword();
      setMensajeAcceso({ tipo: 'ok', texto: 'Contraseña actualizada correctamente.' });
    } catch (error) {
      setMensajePassword({ tipo: 'error', texto: error.message || 'No se pudo actualizar la contraseña.' });
    } finally {
      setGuardandoPassword(false);
    }
  };

  const toggleAlergia = async (alergia) => {
    if (!perfil) return;

    setGuardando(true);

    let nuevasAlergias = [...perfil.alergias];
    if (nuevasAlergias.includes(alergia)) {
      nuevasAlergias = nuevasAlergias.filter((item) => item !== alergia);
    } else {
      nuevasAlergias.push(alergia);
    }

    try {
      const response = await fetch('/api/perfil', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ alergias: nuevasAlergias }),
      });

      if (response.status === 401) {
        clearSession();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setPerfil(data);
      }
    } catch (error) {
      console.error('Error al guardar alergias:', error);
    } finally {
      setGuardando(false);
    }
  };

  if (!isAuthenticated()) {
    return (
      <section className={authOnly ? 'view-section active auth-only-view' : 'view-section active'}>
        {!authOnly && (
          <div className="view-header">
            <div className="view-title">
              <h1>Perfil y acceso</h1>
              <p>Inicia sesión para editar tus preferencias.</p>
            </div>
          </div>
        )}

        <div className={authOnly ? 'card auth-access-card auth-card-centered' : 'card auth-access-card'}>
          {authOnly && (
            <div className="auth-hero-head">
              <div className="auth-avatar-badge">
                <i className="fa-regular fa-user" />
              </div>
              <h2>{modoAcceso === 'register' ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</h2>
              <p>{modoAcceso === 'register' ? 'Configura tu cuenta para empezar a usar InventIA Chef.' : 'Inicia sesión para seguir con tu espacio de cocina.'}</p>
            </div>
          )}

          {!authOnly && <h3>Acceso</h3>}
          {!authOnly && (
            <p className="auth-access-subtitle">
              Aquí puedes iniciar sesión o crear una cuenta.
            </p>
          )}

          <div className="auth-mode-switch">
            <button
              type="button"
              className={modoAcceso === 'login' ? 'auth-switch-btn active' : 'auth-switch-btn'}
              onClick={() => setModoAcceso('login')}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={modoAcceso === 'register' ? 'auth-switch-btn active' : 'auth-switch-btn'}
              onClick={() => setModoAcceso('register')}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={submitAcceso} className="auth-access-form">
            {modoAcceso === 'register' && (
              <label className="auth-input-wrap">
                <i className="fa-regular fa-user" />
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={nombreAcceso}
                  onChange={(e) => setNombreAcceso(e.target.value)}
                  className="auth-input"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="auth-input-wrap">
              <i className="fa-regular fa-envelope" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={emailAcceso}
                onChange={(e) => setEmailAcceso(e.target.value)}
                className="auth-input"
                autoComplete="email"
              />
            </label>

            <label className="auth-input-wrap auth-password-wrap">
              <i className="fa-solid fa-lock" />
              <input
                type={mostrarPasswordAcceso ? 'text' : 'password'}
                placeholder="Contraseña"
                value={passwordAcceso}
                onChange={(e) => setPasswordAcceso(e.target.value)}
                className="auth-input"
                autoComplete={modoAcceso === 'register' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={mostrarPasswordAcceso ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setMostrarPasswordAcceso((prev) => !prev)}
              >
                <i className={mostrarPasswordAcceso ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'} />
              </button>
            </label>

            {modoAcceso === 'register' && (
              <>
                <label className="auth-input-wrap auth-password-wrap">
                  <i className="fa-solid fa-lock" />
                  <input
                    type={mostrarPasswordAcceso ? 'text' : 'password'}
                    placeholder="Confirmar contraseña"
                    value={passwordAccesoConfirmacion}
                    onChange={(e) => setPasswordAccesoConfirmacion(e.target.value)}
                    className="auth-input"
                    autoComplete="new-password"
                  />
                </label>

                <label className="auth-checkbox-row">
                  <input
                    type="checkbox"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                  />
                  <span>Acepto los términos de uso y la política de privacidad.</span>
                </label>
              </>
            )}

            {modoAcceso === 'login' && (
              <>
                <div className="auth-inline-actions">
                  <label className="auth-checkbox-row compact">
                    <input
                      type="checkbox"
                      checked={recordarme}
                      onChange={(e) => setRecordarme(e.target.checked)}
                    />
                    <span>Recordarme</span>
                  </label>
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={recuperarPassword}
                    disabled={cargandoAcceso}
                  >
                    Olvidé mi contraseña
                  </button>
                </div>
              </>
            )}

            {errorAcceso && <p className="auth-error-message">{errorAcceso}</p>}

            {cargandoGoogle && <p className="auth-info-message">Validando acceso con Google...</p>}
            {!googleDisponible && googleClientId && <p className="auth-info-message">Cargando boton de acceso con Google...</p>}

            <button type="submit" className="action-btn auth-submit-btn" disabled={cargandoAcceso}>
              {cargandoAcceso ? 'Enviando...' : modoAcceso === 'register' ? 'Crear cuenta' : 'Entrar'}
            </button>
          </form>

          <div className="auth-divider" aria-hidden="true">
            <span>o continua con</span>
          </div>

          <div className="auth-social-stack">
            <div ref={googleButtonRef} className="auth-google-slot" />
            {!googleClientId && (
              <p className="auth-social-hint">Activa VITE_GOOGLE_CLIENT_ID en frontend y GOOGLE_CLIENT_ID en backend para habilitar Google.</p>
            )}
          </div>

          {mensajeSesion && (
            <p style={{ marginTop: '12px', color: '#166534', fontWeight: 600 }}>
              {mensajeSesion.texto}
            </p>
          )}
        </div>
      </section>
    );
  }

  if (!perfil) {
    return (
      <section className="view-section active">
        <div className="card">
          <p>Cargando perfil...</p>
        </div>
      </section>
    );
  }

  const emailVisible = perfil?.email || user?.email || '-';
  const nombreVisible = String(perfil?.nombre || user?.nombre || 'Usuario');
  const alergiasSeleccionadas = Array.isArray(perfil?.alergias) ? perfil.alergias.length : 0;

  return (
    <section className="view-section active cocinero-profile-view profile-shell">
      <div className="chef-unified-container">
        {/* Banner */}
        <div className="chef-banner">
          <div 
            className="chef-banner-bg" 
            style={{ 
              backgroundImage: imagenBanner ? `url(${imagenBanner})` : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              backgroundColor: !imagenBanner ? '#0f172a' : 'transparent'
            }}
          ></div>
          <button 
            type="button" 
            className="edit-pencil-btn banner-pencil" 
            onClick={() => bannerInputRef.current?.click()}
            title="Cambiar imagen de banner"
          >
            <FaPencilAlt />
          </button>
          <input type="file" ref={bannerInputRef} style={{ display: 'none' }} accept="image/*" onChange={onBannerFileChange} />
        </div>

        <div className="chef-content-wrapper">
          {/* Cabecera (foto y titulos) */}
          <div className="chef-header-section" style={{ borderBottom: '1px solid var(--border)', marginBottom: 30, paddingBottom: 30 }}>
            <div className="chef-avatar-wrapper" style={{ position: 'relative' }}>
              <div className="chef-avatar">
                {imagenPerfil ? <img src={imagenPerfil} alt={nombreVisible} /> : <FaUser />}
              </div>
              <button 
                type="button" 
                className="edit-pencil-btn avatar-pencil" 
                onClick={() => avatarInputRef.current?.click()}
                title="Cambiar foto de perfil"
              >
                <FaPencilAlt />
              </button>
              <input type="file" ref={avatarInputRef} style={{ display: 'none' }} accept="image/*" onChange={onAvatarFileChange} />
            </div>

            <div className="chef-info-grid">
              <div className="chef-info-left">
                <span className="badge-premium">Tu perfil</span>
                <h1 className="chef-name">{nombreVisible}</h1>
                <p className="chef-bio-text">{emailVisible} · {perfil?.rol || 'Usuario'}</p>
              </div>
              
              <div className="chef-info-right">
                <div className="chef-stats-horizontal">
                  <div className="chef-stat-item">
                    <span className="stat-value">{alergiasSeleccionadas}</span>
                    <span className="stat-label">Alergias</span>
                  </div>
                  <div className="mini-stat-sep"></div>
                  <div className="chef-stat-item">
                    <span className="stat-value">{misRecetas.length}</span>
                    <span className="stat-label">Mis Recetas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Perfil en dos columnas */}
          <div className="profile-main-grid-unified" style={{ marginTop: 0 }}>
            <div className="profile-main-column">
              <div className="profile-section-unified">
                <div className="profile-section-head">
                  <h3><FaUser /> Datos de Cuenta</h3>
                  <span className="badge-spec">Info</span>
                </div>
                <form onSubmit={guardarCuenta} className="profile-form-stack">
                  <div className="profile-input-grid-2">
                    <div className="profile-input-group">
                      <label>Nombre Público</label>
                      <input type="text" value={nombreCuenta} onChange={(e) => setNombreCuenta(e.target.value)} className="profile-text-input" placeholder="Tu nombre en la app" required />
                    </div>
                    <div className="profile-input-group">
                      <label>Email</label>
                      <input type="text" value={emailVisible} className="profile-text-input muted" readOnly />
                    </div>
                  </div>
                  <div className="profile-input-group">
                    <label>Biografía / Descripción</label>
                    <textarea 
                      value={biografia} 
                      onChange={(e) => setBiografia(e.target.value)} 
                      className="profile-text-input" 
                      placeholder="Cuéntanos un poco sobre ti (opcional)" 
                      rows="3"
                      maxLength="300"
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Máx. 300 caracteres.</small>
                  </div>
                  <button type="submit" className="profile-action-primary" disabled={guardandoCuenta}>
                    <FaSave /> {guardandoCuenta ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  {mensajeCuenta && <p className={`profile-feedback ${mensajeCuenta.tipo}`}>{mensajeCuenta.texto}</p>}
                </form>
              </div>

              <div className="profile-section-unified" ref={alergiasSectionRef}>
                <div className="profile-section-head">
                  <h3><FaShieldAlt /> Dieta y restricciones</h3>
                </div>
                <p className="profile-subcopy">Marca lo que quieres filtrar al buscar o guardar recetas.</p>
                <div className="profile-chip-grid">
                  {opcionesAlergias.map((alergia) => {
                    const seleccionada = Array.isArray(perfil?.alergias) && perfil.alergias.includes(alergia);
                    return (
                      <button
                        key={alergia}
                        onClick={() => toggleAlergia(alergia)}
                        disabled={guardando}
                        className={seleccionada ? 'profile-chip active' : 'profile-chip'}
                      >
                        {seleccionada ? <FaCheck /> : <FaPlus />}
                        {alergia}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="profile-section-unified">
                <div className="profile-section-head">
                  <h3><FaBookOpen /> Mis Recetas</h3>
                  <button type="button" className="profile-link-btn" onClick={() => navigate('/recetas-comunidad/mis-recetas')}>Ver todas</button>
                </div>
                {cargandoMisRecetas ? (
                  <p>Cargando recetas...</p>
                ) : misRecetas.length === 0 ? (
                  <div className="profile-empty-mini">
                    <p>Comparte tu primera receta con la comunidad.</p>
                    <button type="button" className="profile-action-primary-outline" onClick={() => navigate('/recetas-comunidad/contribuir')}>
                      <FaPlus /> Publicar Ahora
                    </button>
                  </div>
                ) : (
                  <div className="profile-recetas-preview-grid">
                    {misRecetas.slice(0, 2).map(r => (
                      <div key={r._id} className="profile-receta-card-mini" onClick={() => navigate(`/recetas-comunidad/${r._id}`)}>
                        <img src={r.image} alt={r.title} />
                        <div className="profile-receta-mini-info">
                          <h4>{r.title}</h4>
                          <span>{r.estado === 'publicada' ? 'Publicada' : 'Borrador'}</span>
                        </div>
                      </div>
                    ))}
                    <div className="profile-add-card-mini" onClick={() => navigate('/recetas-comunidad/contribuir')}>
                      <FaPlus />
                      <span>Nueva</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside className="profile-side-column-unified">
              <div className="profile-status-box">
                <h4>Estado</h4>
                <ul className="profile-check-list">
                  <li><FaCheckCircle /> Activo</li>
                  <li><FaCheckCircle /> Datos en la nube</li>
                </ul>
              </div>

              <div className="profile-status-box">
                <h4>Progreso del Perfil</h4>
                <div className="profile-progress-bar">
                  <div className="progress-fill" style={{ width: `${porcentajeCompletado}%` }} />
                </div>
                <p className="profile-progress-text">{porcentajeCompletado}% completado</p>
                
                <div className="profile-checklist-unified">
                  {pasosPerfil.map(paso => (
                    <div key={paso.id} className={`checklist-item ${paso.completado ? 'done' : 'pending'}`}>
                      {paso.completado ? <FaCheckCircle className="check-icon" /> : <div className="dot-icon" />}
                      <span>{paso.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="profile-card-unified">
                <div className="profile-section-head">
                  <h3><FaLock /> Acceso y Seguridad</h3>
                </div>
                <div className="profile-cta-stack">
                  <button type="button" className="profile-action-secondary-full" onClick={abrirModalPassword}>
                    <FaLock /> Cambiar Contraseña
                  </button>
                  <button type="button" className="profile-action-danger-full" onClick={cerrarSesion}>
                    <FaSignOutAlt /> Cerrar Sesión
                  </button>
                  <button type="button" className="profile-action-danger-ghost" onClick={solicitarEliminacion}>
                    <FaTrash /> Eliminar Cuenta
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Modal de Cambio de Contraseña */}
      {mostrarModalPassword && (
        <div className="profile-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && cerrarModalPassword()}>
          <div className="profile-modal-card">
            <h3>Cambiar contraseña</h3>
            <form onSubmit={cambiarPassword} className="profile-form-stack compact">
              <input ref={passwordActualInputRef} type="password" placeholder="Contraseña actual" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} className="profile-text-input" />
              <input type="password" placeholder="Nueva contraseña" value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)} className="profile-text-input" />
              <input type="password" placeholder="Confirmar contraseña" value={passwordNuevaConfirmacion} onChange={(e) => setPasswordNuevaConfirmacion(e.target.value)} className="profile-text-input" />
              {mensajePassword && <p className="profile-feedback error">{mensajePassword.texto}</p>}
              <div className="profile-cta-row">
                <button type="submit" className="profile-action-primary" disabled={guardandoPassword}>Actualizar</button>
                <button type="button" className="profile-action-secondary" onClick={cerrarModalPassword}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Previsualización / Encuadre de Imagen */}
      {mostrarModalRecorte && (
        <div className="profile-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && cerrarModalRecorte()}>
          <div className="profile-modal-card image-edit-modal">
            <h3>{tipoEdicionImagen === 'avatar' ? 'Encuadrar Foto de Perfil' : 'Encuadrar Banner'}</h3>
            <p className="modal-subtitle">Ajusta la posición y zoom de tu imagen antes de confirmar.</p>
            
            <div className={`image-preview-frame ${tipoEdicionImagen}`}>
              <div className="preview-container">
                <img 
                  src={imagenTemporal} 
                  alt="Previsualización" 
                  style={{ transform: `scale(${zoomImagen})` }} 
                />
              </div>
            </div>

            <div className="image-edit-controls">
              <label>Zoom</label>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.1" 
                value={zoomImagen} 
                onChange={(e) => setZoomImagen(e.target.value)} 
              />
            </div>

            <div className="profile-cta-row">
              <button type="button" className="profile-action-primary" onClick={confirmarImagen}>
                Confirmar y Aplicar
              </button>
              <button type="button" className="profile-action-secondary" onClick={cerrarModalRecorte}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Perfil;
