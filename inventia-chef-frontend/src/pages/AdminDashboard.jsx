import { useEffect, useState } from 'react';
import { 
  FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaSave,
  FaServer, FaUsers, FaHeart, FaUtensils, FaCarrot, FaGlobe, FaSyncAlt, FaBroom
} from 'react-icons/fa';
import '../styles/AdminDashboard.css';
import { authHeaders } from '../services/auth';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState({
    recetasClasicasMax: '9',
    recetasIaMin: '3',
    recetasIaMax: '9',
    recetasIaDefault: '9',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const cargar = async () => {
    try {
      setError('');
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          ...authHeaders(),
        },
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.mensaje || `No se pudo completar la solicitud (HTTP ${response.status}).`);
      }
      setData(json);
      const ajustes = json?.ajustes || {};
      setSettings({
        recetasClasicasMax: String(ajustes.recetasClasicasMax ?? 9),
        recetasIaMin: String(ajustes.recetasIaMin ?? 3),
        recetasIaMax: String(ajustes.recetasIaMax ?? 9),
        recetasIaDefault: String(ajustes.recetasIaDefault ?? 9),
      });
    } catch (err) {
      setError(err.message || 'No se pudo cargar el panel de administracion. Prueba otra vez.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  if (loading) {
    return (
      <div className="admin-container">
        <div className="admin-loading">
          <h2>Cargando panel de administración...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-container">
        <div className="admin-error">
          <h2>Panel de administración no disponible</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const spoonacular = data?.alertas?.spoonacular || {};
  const metricas = data?.metricas || {};
  const gemini = data?.alertas?.gemini || {};

  const handleSettingChange = (field) => (event) => {
    setSettings((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const guardarAjustes = async (event) => {
    event.preventDefault();
    setSaveMsg('');
    setSaving(true);

    try {
      const payload = {
        recetasClasicasMax: Number.parseInt(settings.recetasClasicasMax, 10),
        recetasIaMin: Number.parseInt(settings.recetasIaMin, 10),
        recetasIaMax: Number.parseInt(settings.recetasIaMax, 10),
        recetasIaDefault: Number.parseInt(settings.recetasIaDefault, 10),
      };

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.mensaje || `No se pudo guardar (HTTP ${response.status}).`);
      }

      const ajustes = json?.ajustes || {};
      setSettings({
        recetasClasicasMax: String(ajustes.recetasClasicasMax ?? settings.recetasClasicasMax),
        recetasIaMin: String(ajustes.recetasIaMin ?? settings.recetasIaMin),
        recetasIaMax: String(ajustes.recetasIaMax ?? settings.recetasIaMax),
        recetasIaDefault: String(ajustes.recetasIaDefault ?? settings.recetasIaDefault),
      });
      setSaveMsg('Ajustes guardados. Estos limites ya se aplican.');
    } catch (err) {
      setSaveMsg(err.message || 'No se pudieron guardar los ajustes.');
    } finally {
      setSaving(false);
    }
  };

  const vaciarCacheLocal = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('inventia_recetas_hechas');
      setSaveMsg('Caché local limpiada correctamente.');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg('Error limpiando caché local.');
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-kicker">Sistema</span>
          <h2>Panel de Control</h2>
          <p>Estado de servicios, métricas en tiempo real y configuración avanzada de la plataforma.</p>
        </div>
        <div className="admin-hero-actions">
          <button onClick={cargar} className="admin-action-btn admin-action-outline">
            <FaSyncAlt /> Refrescar
          </button>
          <button onClick={vaciarCacheLocal} className="admin-action-btn admin-action-danger">
            <FaBroom /> Limpiar Caché Local
          </button>
        </div>
      </div>

      <div className="admin-metrics-grid">
        <article className="admin-metric-card">
          <div className="admin-metric-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
            <FaUsers />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-label">Usuarios</span>
            <span className="admin-metric-value">{Number(metricas.usuarios || 0)}</span>
          </div>
        </article>
        
        <article className="admin-metric-card">
          <div className="admin-metric-icon" style={{ background: '#fce7f3', color: '#be185d' }}>
            <FaHeart />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-label">Favoritos</span>
            <span className="admin-metric-value">{Number(metricas.favoritos || 0)}</span>
          </div>
        </article>

        <article className="admin-metric-card">
          <div className="admin-metric-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            <FaCarrot />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-label">Alimentos</span>
            <span className="admin-metric-value">{Number(metricas.alimentos || 0)}</span>
          </div>
        </article>

        <article className="admin-metric-card">
          <div className="admin-metric-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
            <FaUtensils />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-label">Pendientes</span>
            <span className="admin-metric-value">{Number(metricas.pendientes || 0)}</span>
          </div>
        </article>

        <article className="admin-metric-card">
          <div className="admin-metric-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
            <FaGlobe />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-label">Comunidad</span>
            <span className="admin-metric-value">{Number(metricas.recetas_comunidad || 0)}</span>
          </div>
        </article>
      </div>

      <div className="admin-grid">
        {/* Estado del sistema */}
        <article className="admin-card admin-health-card">
          <h3><FaServer /> Estado del Sistema</h3>
          <div className="admin-health-row">
            <div className="admin-health-item">
              <span className="admin-stat-label">InventIA Core API</span>
              <span className="admin-status-ok"><FaCheckCircle /> Online</span>
            </div>
            <div className="admin-health-item">
              <span className="admin-stat-label">Spoonacular API</span>
              {spoonacular.bloqueado ? (
                <span className="admin-status-warning"><FaExclamationTriangle /> Límite excedido</span>
              ) : (
                <span className="admin-status-ok"><FaCheckCircle /> Operativo</span>
              )}
            </div>
            <div className="admin-health-item">
              <span className="admin-stat-label">Gemini (Google)</span>
              {Number(gemini.keys_configuradas || 0) > 0 ? (
                <span className="admin-status-ok"><FaCheckCircle /> Listo ({gemini.keys_configuradas} Keys)</span>
              ) : (
                <span className="admin-status-error"><FaTimesCircle /> Sin configurar</span>
              )}
            </div>
            <div className="admin-health-item">
              <span className="admin-stat-label">Entorno</span>
              <span className="admin-status-neutral">Producción</span>
            </div>
          </div>
          {spoonacular.bloqueado && spoonacular.disponible_desde && (
            <div className="admin-alert-banner">
              Spoonacular bloqueado hasta el: <strong>{new Date(spoonacular.disponible_desde).toLocaleString('es-ES')}</strong>
            </div>
          )}
        </article>

        {/* Ajustes */}
        <article className="admin-card">
          <h3>Ajustes Operativos</h3>
          <form onSubmit={guardarAjustes} className="admin-settings-form">
            <div className="admin-settings-grid">
              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="recetasClasicasMax">
                  Recetas clásicas (Spoonacular)
                </label>
                <input
                  id="recetasClasicasMax"
                  type="number"
                  min="3"
                  max="24"
                  value={settings.recetasClasicasMax}
                  onChange={handleSettingChange('recetasClasicasMax')}
                  className="admin-form-input"
                />
                <small className="admin-form-hint">Límite a mostrar por búsqueda</small>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="recetasIaMin">
                  Sugerencias (mín.)
                </label>
                <input
                  id="recetasIaMin"
                  type="number"
                  min="1"
                  max="24"
                  value={settings.recetasIaMin}
                  onChange={handleSettingChange('recetasIaMin')}
                  className="admin-form-input"
                />
                <small className="admin-form-hint">Mínimo sugerido</small>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="recetasIaMax">
                  Sugerencias (máx.)
                </label>
                <input
                  id="recetasIaMax"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.recetasIaMax}
                  onChange={handleSettingChange('recetasIaMax')}
                  className="admin-form-input"
                />
                <small className="admin-form-hint">Máximo sugerido</small>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="recetasIaDefault">
                  Sugerencias por defecto
                </label>
                <input
                  id="recetasIaDefault"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.recetasIaDefault}
                  onChange={handleSettingChange('recetasIaDefault')}
                  className="admin-form-input"
                />
                <small className="admin-form-hint">Default al generar</small>
              </div>
            </div>

            <div className="admin-button-group">
              <button type="submit" className="admin-submit-btn" disabled={saving}>
                <FaSave /> {saving ? 'Guardando...' : 'Guardar Ajustes'}
              </button>
            </div>

            {saveMsg && (
              <div className={`admin-message ${saveMsg.includes('guardados') || saveMsg.includes('correctamente') ? 'success' : 'error'}`}>
                {saveMsg}
              </div>
            )}
          </form>
        </article>
      </div>
    </div>
  );
}
