import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as QuaggaModule from '@ericblade/quagga2';
import { buscarProductoPorCodigo } from '../services/openFoodFacts';
import * as tf from '@tensorflow/tfjs';
import * as tmImage from '@teachablemachine/image';
import { isAdmin } from '../services/auth';
import PageHeader from '../components/PageHeader';
import '../styles/Escaner.css';

const Quagga = QuaggaModule.default || QuaggaModule;

const UMBRAL_CONFIANZA_VISION = 0.7;
const METRICAS_VISION_KEY = 'inventia_vision_metricas';
const MEDIA_COMPACTO = '(max-width: 900px)';

const metricasIniciales = {
    detecciones_totales: 0,
    aciertos_confirmados: 0,
    rechazos_manual: 0
};

const clasesDemo = ['Tomate', 'Manzana', 'Platano', 'Cebolla', 'Leche', 'Pan', 'Fondo'];

const Escaner = () => {
    const navigate = useNavigate();
    const esAdmin = isAdmin();

    const [modo, setModo] = useState('manual');

    const [formulario, setFormulario] = useState({
        nombre: '',
        cantidad: 1,
        unidad_medida: 'Unidades',
        categoria: 'Fresco',
        fecha_caducidad: '',
        metodo_ingreso: 'Manual'
    });

    const [codigoPrueba, setCodigoPrueba] = useState('');
    const [resultadoApi, setResultadoApi] = useState(null);
    const [buscando, setBuscando] = useState(false);
    const [camaraActiva, setCamaraActiva] = useState(false);
    
    const scannerRef = useRef(null);
    const onDetectedRef = useRef(null);
    const videoRef = useRef(null);
    
    const [modeloVision, setModeloVision] = useState(null);
    const [confirmacionPrediccion, setConfirmacionPrediccion] = useState(null);
    const [mensajeVision, setMensajeVision] = useState(null);
    const [metricasVision, setMetricasVision] = useState(metricasIniciales);
    const [analizando, setAnalizando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [mensajeFlujo, setMensajeFlujo] = useState(null);
    
    const nombreInputRef = useRef(null);
    const codigoInputRef = useRef(null);
    const ultimoCodigoDetectadoRef = useRef('');
    const ultimoCodigoDetectadoFechaRef = useRef(0);

    const [compacto, setCompacto] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(MEDIA_COMPACTO).matches
    );
    const [dispositivosVideo, setDispositivosVideo] = useState([]);
    const [deviceIdBarcode, setDeviceIdBarcode] = useState('');
    const [barcodeFacingUser, setBarcodeFacingUser] = useState(false);
    const [deviceIdVision, setDeviceIdVision] = useState('');
    const [visionFacingUser, setVisionFacingUser] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mq = window.matchMedia(MEDIA_COMPACTO);
        const fn = () => setCompacto(mq.matches);
        mq.addEventListener('change', fn);
        return () => mq.removeEventListener('change', fn);
    }, []);

    const [codigoBarrasOpcional, setCodigoBarrasOpcional] = useState('');

    useEffect(() => {
        if (modo === 'manual' && nombreInputRef.current) {
            nombreInputRef.current.focus();
        } else if (modo === 'barcode' && codigoInputRef.current) {
            codigoInputRef.current.focus();
        }
    }, [modo]);

    useEffect(() => {
        try {
            const guardadas = localStorage.getItem(METRICAS_VISION_KEY);
            if (guardadas) {
                const parsed = JSON.parse(guardadas);
                setMetricasVision({ ...metricasIniciales, ...parsed });
            }
        } catch (error) {
            console.error('Error al cargar metricas locales:', error);
        }
    }, []);

    useEffect(() => {
        if (modo !== 'vision' || compacto) return undefined;
        let cancelado = false;
        (async () => {
                    try {
                        const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
                        tmp.getTracks().forEach((t) => t.stop());
                        const all = await navigator.mediaDevices.enumerateDevices();
                        const v = all.filter((d) => d.kind === 'videoinput');
                        if (cancelado) return;
                        setDispositivosVideo(v);
                        setDeviceIdVision((prev) => prev || v[0]?.deviceId || '');
                    } catch (e) {
                        console.error('No se pudieron listar cámaras:', e);
                    }
        })();
        return () => {
            cancelado = true;
        };
    }, [modo, compacto]);

    const activarCamaraBarcode = async () => {
        setMensajeFlujo(null);
            try {
                if (!compacto) {
                    const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
                    tmp.getTracks().forEach((t) => t.stop());
                    const all = await navigator.mediaDevices.enumerateDevices();
                    const v = all.filter((d) => d.kind === 'videoinput');
                    setDispositivosVideo(v);
                    setDeviceIdBarcode((prev) => prev || v[0]?.deviceId || '');
                }
                setCamaraActiva(true);
            } catch (err) {
                console.error('Cannot access camera:', err);
                setMensajeFlujo({
                    tipo: 'error',
                    texto: 'No se ha podido acceder a la cámara. Comprueba los permisos.',
                });
            }
    };

    const actualizarMetricasVision = (cambios) => {
        setMetricasVision((prev) => {
            const next = {
                ...prev,
                ...Object.fromEntries(
                    Object.entries(cambios).map(([key, value]) => [key, (prev[key] || 0) + value])
                )
            };

            try {
                localStorage.setItem(METRICAS_VISION_KEY, JSON.stringify(next));
            } catch (error) {
                console.error('No se han podido guardar las metricas:', error);
            }

            return next;
        });
    };

    const resetearMetricasVision = () => {
        setMetricasVision(metricasIniciales);
        try {
            localStorage.setItem(METRICAS_VISION_KEY, JSON.stringify(metricasIniciales));
        } catch (error) {
            console.error('Error al resetear metricas:', error);
        }
    };

    const exportarMetricasVision = () => {
        const total = Number(metricasVision.detecciones_totales || 0);
        const aciertos = Number(metricasVision.aciertos_confirmados || 0);
        const rechazos = Number(metricasVision.rechazos_manual || 0);
        const tasaAceptacion = total > 0 ? Number(((aciertos / total) * 100).toFixed(2)) : 0;

        const payload = {
            version: 1,
            fecha_exportacion: new Date().toISOString(),
            configuracion_demo: {
                umbral_confianza: UMBRAL_CONFIANZA_VISION,
                clases: clasesDemo
            },
            metricas: {
                detecciones_totales: total,
                aciertos_confirmados: aciertos,
                rechazos_manual: rechazos,
                tasa_aceptacion_porcentaje: tasaAceptacion
            }
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `vision-stats-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const normalizarNombreClase = (texto) => {
        const valor = String(texto || '').trim();
        if (!valor) return '';
        return valor.charAt(0).toUpperCase() + valor.slice(1).toLowerCase();
    };

    const procesarResultadoBarcode = (resultado, codigo) => {
        const ahora = Date.now();
        const codigoAnterior = String(ultimoCodigoDetectadoRef.current || '');
        const diferenciaTiempo = ahora - Number(ultimoCodigoDetectadoFechaRef.current || 0);

        if (codigoAnterior === codigo && diferenciaTiempo < 2500) {
            setMensajeFlujo({
                tipo: 'warn',
                texto: 'Ese código ya lo acabas de escanear. Cambia de producto.'
            });
            return;
        }

        ultimoCodigoDetectadoRef.current = codigo;
        ultimoCodigoDetectadoFechaRef.current = ahora;
        setCodigoBarrasOpcional('');

        if (resultado?.encontrado) {
            setFormulario((prev) => ({
                ...prev,
                nombre: resultado.nombre || prev.nombre,
                categoria:
                    resultado.fuente === 'despensa'
                        ? resultado.categoria || 'Envasado'
                        : 'Envasado',
                metodo_ingreso: 'QuaggaJS_Barcode',
                datos_openfoodfacts: {
                    codigo_barras: codigo,
                    nutriscore: resultado.nutriscore || 'N/A',
                    alergenos_detectados: []
                }
            }));

            setMensajeFlujo({
                tipo: 'ok',
                texto:
                    resultado.fuente === 'despensa'
                        ? '¡Coincidencia en tu despensa! Hemos puesto el nombre que ya tenías.'
                        : 'Producto encontrado en Open Food Facts. Revisa si todo esta bien.'
            });
        } else {
            setFormulario((prev) => ({
                ...prev,
                metodo_ingreso: 'QuaggaJS_Barcode',
                datos_openfoodfacts: {
                    codigo_barras: codigo,
                    nutriscore: 'N/A',
                    alergenos_detectados: []
                }
            }));

            setMensajeFlujo({
                tipo: 'warn',
                texto: 'No hemos encontrado este producto. Tendras que poner el nombre a mano.'
            });
        }

        setModo('manual');
    };

    useEffect(() => {
        if (modo === 'barcode' && camaraActiva && scannerRef.current) {
            Quagga.init({
                locate: true,
                frequency: 10,
                numOfWorkers: navigator.hardwareConcurrency ? Math.max(2, Math.min(4, navigator.hardwareConcurrency - 1)) : 2,
                inputStream: {
                    type: 'LiveStream',
                    target: scannerRef.current,
                    area: {
                        top: '10%',
                        right: '10%',
                        bottom: '10%',
                        left: '10%'
                    },
                    constraints: compacto
                        ? {
                               width: { ideal: 1280 },
                               height: { ideal: 720 },
                               facingMode: barcodeFacingUser ? 'user' : 'environment',
                           }
                        : deviceIdBarcode
                          ? {
                                width: { ideal: 1280 },
                                height: { ideal: 720 },
                                deviceId: { exact: deviceIdBarcode },
                            }
                          : {
                                width: { ideal: 1280 },
                                height: { ideal: 720 },
                                facingMode: 'environment',
                            },
                },
                decoder: {
                    readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'code_128_reader']
                }
            }, (err) => {
                if (err) {
                    console.error('Error al inicializar Quagga:', err);
                    setCamaraActiva(false);
                    return;
                }
                Quagga.start();
            });

            const onDetected = async (data) => {
                const codigoLeido = data.codeResult.code;

                if (codigoLeido === ultimoCodigoDetectadoRef.current && Date.now() - ultimoCodigoDetectadoFechaRef.current < 2500) {
                    return;
                }

                setCodigoPrueba(codigoLeido);
                setCamaraActiva(false);
                Quagga.stop();

                setBuscando(true);
                const resultado = await buscarProductoPorCodigo(codigoLeido);
                setResultadoApi(resultado);
                procesarResultadoBarcode(resultado, codigoLeido);
                setBuscando(false);
            };

            onDetectedRef.current = onDetected;
            Quagga.onDetected(onDetected);

            return () => {
                try {
                    if (onDetectedRef.current) {
                        Quagga.offDetected(onDetectedRef.current);
                        onDetectedRef.current = null;
                    }
                    Quagga.stop();
                } catch (error) {
                    console.error('Error al parar el escaner:', error);
                }
            };
        }

        return undefined;
    }, [modo, camaraActiva, compacto, deviceIdBarcode, barcodeFacingUser]);

    useEffect(() => {
        if (modo !== 'vision') return undefined;
        let cancelado = false;
        (async () => {
            try {
                await tf.ready();
                const BASE = 'https://teachablemachine.withgoogle.com/models/XZpqlMANh/';
                const modeloCargado = await tmImage.load(`${BASE}model.json`, `${BASE}metadata.json`);
                if (cancelado) return;
                setModeloVision((prev) => prev || modeloCargado);
            } catch (error) {
                console.error('No se ha podido cargar el modelo de IA:', error);
            }
        })();
        return () => {
            cancelado = true;
        };
    }, [modo]);

    useEffect(() => {
        if (modo !== 'vision') return undefined;
        let streamPuntero = null;
        let cancelado = false;

        (async () => {
            try {
                const videoOpts = compacto
                    ? { facingMode: visionFacingUser ? 'user' : 'environment' }
                    : deviceIdVision
                      ? { deviceId: { exact: deviceIdVision } }
                      : true;

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: videoOpts,
                });
                if (cancelado) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamPuntero = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error('Fallo al abrir la camara de vision:', error);
            }
        })();

        return () => {
            cancelado = true;
            if (streamPuntero) {
                streamPuntero.getTracks().forEach((track) => track.stop());
            }
        };
    }, [modo, compacto, deviceIdVision, visionFacingUser]);

    useEffect(() => {
        if (modo !== 'barcode') {
            setCamaraActiva(false);
        }
    }, [modo]);

    const handleTestApi = async () => {
        const codigoNormalizado = codigoPrueba.trim();
        if (!codigoNormalizado) {
            setMensajeFlujo({
                tipo: 'error',
                texto: 'Escribe un código para buscarlo.'
            });
            return;
        }

        setCodigoPrueba(codigoNormalizado);
        setBuscando(true);
        const resultado = await buscarProductoPorCodigo(codigoNormalizado);
        setResultadoApi(resultado);
        procesarResultadoBarcode(resultado, codigoNormalizado);
        setBuscando(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormulario({
            ...formulario,
            [name]: name === 'cantidad' ? Number(value) : value
        });
    };

    const clasificarImagen = async () => {
        if (modeloVision && videoRef.current) {
            setAnalizando(true);
            setMensajeVision(null);
            setConfirmacionPrediccion(null);
            try {
                const predicciones = await modeloVision.predict(videoRef.current);
                const mejorPrediccion = predicciones.reduce(
                    (max, p) => (p.probability > max.probability ? p : max),
                    predicciones[0]
                );

                actualizarMetricasVision({ detecciones_totales: 1 });

                const clase = (mejorPrediccion.className || '').toLowerCase();
                const confianza = Number(mejorPrediccion.probability || 0);
                const nombreSugerido = normalizarNombreClase(mejorPrediccion.className || '');

                if (clase === 'nada' || clase === 'fondo' || confianza < UMBRAL_CONFIANZA_VISION) {
                    actualizarMetricasVision({ rechazos_manual: 1 });
                    setMensajeVision({
                        tipo: 'warn',
                        texto: `No estoy muy seguro (${(confianza * 100).toFixed(0)}%). Mejor ponlo tu.`
                    });
                    setMensajeFlujo({
                        tipo: 'warn',
                        texto: 'No se ha reconocido con seguridad. Escribe el nombre tú mismo.'
                    });
                    setModo('manual');
                    return;
                }

                setConfirmacionPrediccion({
                    nombre: nombreSugerido,
                    confianza
                });
            } catch (error) {
                console.error('Error al analizar la imagen:', error);
                setMensajeVision({
                    tipo: 'error',
                    texto: 'Vaya, ha fallado el analisis visual.'
                });
            } finally {
                setAnalizando(false);
            }
        }
    };

    const confirmarPrediccionVision = (esCorrecta) => {
        if (!confirmacionPrediccion) return;

        if (esCorrecta) {
            actualizarMetricasVision({ aciertos_confirmados: 1 });
            setFormulario((prev) => ({
                ...prev,
                nombre: confirmacionPrediccion.nombre,
                categoria: 'Fresco',
                metodo_ingreso: 'TensorFlow_Vision'
            }));
            setMensajeFlujo({
                tipo: 'ok',
                texto: `¡Anotado! Hemos puesto "${confirmacionPrediccion.nombre}".`
            });
        } else {
            actualizarMetricasVision({ rechazos_manual: 1 });
            setMensajeFlujo({
                tipo: 'warn',
                texto: 'Vale, sin problema. Rellena los datos a mano.'
            });
        }

        setConfirmacionPrediccion(null);
        setMensajeVision(null);
        setModo('manual');
    };

    const totalDetecciones = Number(metricasVision.detecciones_totales || 0);
    const tasaAceptacion = totalDetecciones > 0
        ? ((Number(metricasVision.aciertos_confirmados || 0) / totalDetecciones) * 100).toFixed(1)
        : '0.0';

    const claseMensajeFlujo = mensajeFlujo
        ? `escaner-feedback escaner-feedback-${mensajeFlujo.tipo}`
        : '';

    const claseMensajeVision = mensajeVision
        ? `escaner-feedback escaner-feedback-${mensajeVision.tipo}`
        : '';

    const ayudaModo = (() => {
        if (modo === 'manual') {
            return {
                icono: 'fa-solid fa-pen-to-square',
                titulo: 'Registro manual',
                texto: 'Escribe los datos tú mismo. Es lo más fiable si no hay código.'
            };
        }

        if (modo === 'barcode') {
            return {
                icono: 'fa-solid fa-barcode',
                titulo: 'Escaneo de código',
                texto: compacto
                    ? 'Pon el código frente a la cámara. Puedes cambiar de lente si quieres.'
                    : 'Acerca el producto. Si tienes varias cámaras, elige la mejor arriba.',
            };
        }

        return {
            icono: 'fa-solid fa-camera',
            titulo: 'Reconocimiento visual',
            texto: compacto
                ? 'Enfoca un solo alimento con buena luz. Pulsa "Analizar" cuando estes listo.'
                : 'Usa la cámara para que la IA intente adivinar qué producto es.',
        };
    })();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const nombreNormalizado = String(formulario.nombre || '').trim();

        if (!nombreNormalizado) {
            setModo('manual');
            setMensajeFlujo({
                tipo: 'error',
                texto: 'El nombre es obligatorio para guardar.'
            });
            return;
        }

        try {
            setGuardando(true);
            const payload = {
                ...formulario,
                nombre: nombreNormalizado,
            };
            const codigoManual = codigoBarrasOpcional.trim();
            if (codigoManual && !payload.datos_openfoodfacts?.codigo_barras) {
                payload.datos_openfoodfacts = {
                    codigo_barras: codigoManual,
                    nutriscore: payload.datos_openfoodfacts?.nutriscore || 'N/A',
                    alergenos_detectados: Array.isArray(payload.datos_openfoodfacts?.alergenos_detectados)
                        ? payload.datos_openfoodfacts.alergenos_detectados
                        : [],
                };
            }
            const response = await fetch('/api/alimentos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                await response.json();
                navigate('/');
            } else {
                let detalle = null;
                try {
                    detalle = await response.json();
                } catch {
                    detalle = null;
                }

                setMensajeFlujo({
                    tipo: 'error',
                    texto: detalle?.mensaje || 'Vaya, no se ha podido guardar el alimento. ¿Están todos los campos bien?'
                });
            }
        } catch (error) {
            console.error('Error al conectar con el servidor:', error);
            setMensajeFlujo({
                tipo: 'error',
                texto: 'Parece que hay un error de conexion. Prueba de nuevo en un momento.'
            });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <section className="view-section active escaner-page">
            <PageHeader
                kicker="Inventario Rápido"
                title="Añadir alimento"
                description="Escanea un código, usa la cámara o rellena el formulario para añadir productos a la despensa."
            >
                <div className="page-hero-stats">
                    {esAdmin ? (
                        <>
                            <div>
                                <strong>3 modos</strong>
                                <span>Canales</span>
                            </div>
                            <div>
                                <strong>{tasaAceptacion}%</strong>
                                <span>Aciertos</span>
                            </div>
                            <div>
                                <strong>{metricasVision.detecciones_totales}</strong>
                                <span>Detecciones</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <strong>Manual</strong>
                                <span>Escribir</span>
                            </div>
                            <div>
                                <strong>Código</strong>
                                <span>Escanear</span>
                            </div>
                            <div>
                                <strong>Visión</strong>
                                <span>Reconocer</span>
                            </div>
                        </>
                    )}
                </div>
            </PageHeader>

            <div className="escaner-mode-switch" role="tablist" aria-label="Modo de registro">
                <button
                    type="button"
                    className={`escaner-mode-btn ${modo === 'manual' ? 'active manual' : ''}`}
                    onClick={() => {
                        setModo('manual');
                        setMensajeFlujo(null);
                        setFormulario((prev) => ({
                            ...prev,
                            metodo_ingreso: 'Manual'
                        }));
                    }}
                >
                    <span className="escaner-mode-btn-text">
                        <strong>Manual</strong>
                        <span>Control total</span>
                    </span>
                </button>
                <button
                    type="button"
                    className={`escaner-mode-btn ${modo === 'barcode' ? 'active barcode' : ''}`}
                    onClick={() => {
                        setModo('barcode');
                        setMensajeFlujo(null);
                    }}
                >
                    <span className="escaner-mode-btn-text">
                        <strong>Código</strong>
                        <span>Búsqueda automática</span>
                    </span>
                </button>
                <button
                    type="button"
                    className={`escaner-mode-btn ${modo === 'vision' ? 'active vision' : ''}`}
                    onClick={() => {
                        setModo('vision');
                        setMensajeFlujo(null);
                        setMensajeVision(null);
                        setConfirmacionPrediccion(null);
                    }}
                >
                    <span className="escaner-mode-btn-text">
                        <strong>Visión</strong>
                        <span>Sugerencia asistida</span>
                    </span>
                </button>
            </div>

            <div className="escaner-mode-help" role="status" aria-live="polite">
                <i className={ayudaModo.icono}></i>
                <div>
                    <strong>{ayudaModo.titulo}</strong>
                    <p>{ayudaModo.texto}</p>
                </div>
            </div>

            <div className="card escaner-panel">
                {modo === 'manual' && (
                    <form onSubmit={handleSubmit} className="escaner-form">
                        <h3 className="escaner-panel-title">Datos del producto</h3>

                        {mensajeFlujo && (
                            <div className={claseMensajeFlujo}>
                                {mensajeFlujo.texto}
                            </div>
                        )}

                        <div className="escaner-field">
                            <label>Nombre del alimento</label>
                            <input
                                ref={nombreInputRef}
                                type="text"
                                name="nombre"
                                value={formulario.nombre}
                                onChange={handleChange}
                                required
                                placeholder="Ej. Tomates pera"
                            />
                        </div>

                        <div className="escaner-field">
                            <label>Código de barras (opcional)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                value={codigoBarrasOpcional}
                                onChange={(e) => setCodigoBarrasOpcional(e.target.value)}
                                disabled={Boolean(formulario.datos_openfoodfacts?.codigo_barras)}
                                placeholder={
                                    formulario.datos_openfoodfacts?.codigo_barras
                                        ? `Leído: ${formulario.datos_openfoodfacts.codigo_barras}`
                                        : 'Ej. 8410123456789'
                                }
                            />
                            <p className="escaner-field-hint">
                                Si lo guardas, el escaner lo reconocera directamente la proxima vez.
                            </p>
                        </div>

                        <div className="escaner-grid-2">
                            <div className="escaner-field">
                                <label>Cantidad</label>
                                <input
                                    type="number"
                                    name="cantidad"
                                    min="1"
                                    value={formulario.cantidad}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="escaner-field">
                                <label>Unidad</label>
                                <select
                                    name="unidad_medida"
                                    value={formulario.unidad_medida}
                                    onChange={handleChange}
                                >
                                    <option value="Unidades">Unidades</option>
                                    <option value="Gramos">Gramos</option>
                                    <option value="Kilos">Kilos</option>
                                    <option value="Litros">Litros</option>
                                </select>
                            </div>
                        </div>

                        <div className="escaner-grid-2">
                            <div className="escaner-field">
                                <label>Categoría</label>
                                <select
                                    name="categoria"
                                    value={formulario.categoria}
                                    onChange={handleChange}
                                >
                                    <option value="Fresco">Fresco</option>
                                    <option value="Envasado">Envasado</option>
                                    <option value="Lácteos">Lácteos</option>
                                    <option value="Congelado">Congelado</option>
                                </select>
                            </div>

                            <div className="escaner-field">
                                <label>Fecha de caducidad</label>
                                <input
                                    type="date"
                                    name="fecha_caducidad"
                                    value={formulario.fecha_caducidad}
                                    onChange={handleChange}
                                    placeholder="Selecciona una fecha"
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={guardando} className="action-btn escaner-submit-btn">
                            {guardando ? 'Guardando...' : 'Guardar en despensa'}
                        </button>
                    </form>
                )}

                {modo === 'barcode' && (
                    <div className="escaner-barcode-wrap">
                        <div className="escaner-barcode-search">
                            <input
                                ref={codigoInputRef}
                                type="text"
                                value={codigoPrueba}
                                onChange={(e) => setCodigoPrueba(e.target.value)}
                                placeholder="Escribe el código..."
                            />
                            <button
                                type="button"
                                onClick={handleTestApi}
                                disabled={buscando}
                                className="action-btn escaner-secondary-btn"
                            >
                                {buscando ? 'Buscando...' : 'Buscar'}
                            </button>
                        </div>

                        {camaraActiva && (
                            <div className="escaner-camera-toolbar" role="toolbar" aria-label="Cámara de código de barras">
                                {!compacto && dispositivosVideo.length > 0 && (
                                    <label className="escaner-camera-select-label">
                                        <span>Cámara</span>
                                        <select
                                            className="escaner-camera-select"
                                            value={deviceIdBarcode}
                                            onChange={(e) => setDeviceIdBarcode(e.target.value)}
                                        >
                                            {dispositivosVideo.map((d, i) => (
                                                <option key={d.deviceId || `cam-b-${i}`} value={d.deviceId}>
                                                    {d.label || `Cámara ${i + 1}`}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                                {compacto && (
                                    <button
                                        type="button"
                                        className="action-btn escaner-secondary-btn escaner-flip-cam-btn"
                                        onClick={() => setBarcodeFacingUser((v) => !v)}
                                    >
                                        <i className="fa-solid fa-camera-rotate" aria-hidden="true" /> Cambiar cámara
                                    </button>
                                )}
                            </div>
                        )}

                        <div ref={scannerRef} className="escaner-camera-box escaner-camera-box-barcode">
                            {camaraActiva && (
                                <div className="escaner-camera-overlay" aria-hidden="true">
                                    <span className="escaner-camera-hint">Enfoca el código aquí</span>
                                </div>
                            )}

                            {!camaraActiva && !buscando && (
                                <div className="escaner-camera-guide" aria-hidden="true">
                                    <span>Coloca el producto frente a la cámara</span>
                                </div>
                            )}

                            {!camaraActiva && (
                                <button
                                    type="button"
                                    className="action-btn escaner-camera-btn"
                                    onClick={activarCamaraBarcode}
                                >
                                    <i className="fa-solid fa-camera"></i> Activar cámara
                                </button>
                            )}
                        </div>

                        {resultadoApi && (
                            <div className={`escaner-result-card ${resultadoApi.encontrado ? 'found' : 'not-found'}`}>
                                {resultadoApi.encontrado ? (
                                    <div className="escaner-result-content">
                                        {resultadoApi.imagen && (
                                            <img src={resultadoApi.imagen} alt={resultadoApi.nombre} className="escaner-result-image" />
                                        )}
                                        <div>
                                            <h4>{resultadoApi.nombre}</h4>
                                            <p>Marca: {resultadoApi.marca || 'Generica'}</p>
                                            <p className="escaner-result-score">NutriScore: {resultadoApi.nutriscore}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="escaner-result-error"><i className="fa-solid fa-circle-exclamation"></i> {resultadoApi.mensaje}</p>
                                )}
                            </div>
                        )}

                        {!resultadoApi && !buscando && (
                            <div className="escaner-empty-state">
                                <i className="fa-solid fa-box-open"></i>
                                    <h4>No hay nada escaneado</h4>
                                    <p>Pulsa en activar cámara o busca un código a mano.</p>
                            </div>
                        )}
                    </div>
                )}

                {modo === 'vision' && (
                    <div className="escaner-vision-wrap">
                        {esAdmin ? (
                            <div className="escaner-vision-intro escaner-vision-intro-admin">
                                <p>
                                    Reconociendo: {clasesDemo.join(', ')}
                                </p>
                                <p>
                                    Confianza minima: {(UMBRAL_CONFIANZA_VISION * 100).toFixed(0)}%
                                </p>
                            </div>
                        ) : (
                            <div className="escaner-vision-intro escaner-vision-intro-user">
                                <p>Pon el producto frente a la cámara con buena luz.</p>
                                <p>Si el nombre no es correcto, podras cambiarlo despues.</p>
                            </div>
                        )}

                        {esAdmin && (
                            <div className="escaner-metrics-grid">
                                <div className="escaner-metric-card detecciones">
                                    <p>Total</p>
                                    <strong>{metricasVision.detecciones_totales}</strong>
                                </div>
                                <div className="escaner-metric-card aciertos">
                                    <p>Aciertos</p>
                                    <strong>{metricasVision.aciertos_confirmados}</strong>
                                </div>
                                <div className="escaner-metric-card rechazos">
                                    <p>Rechazos</p>
                                    <strong>{metricasVision.rechazos_manual}</strong>
                                </div>
                                <div className="escaner-metric-card tasa">
                                    <p>Acierto %</p>
                                    <strong>{tasaAceptacion}%</strong>
                                </div>
                            </div>
                        )}

                        <div className="escaner-camera-toolbar escaner-camera-toolbar--vision" role="toolbar" aria-label="Cámara de visión">
                            {!compacto && dispositivosVideo.length > 0 && (
                                <label className="escaner-camera-select-label">
                                    <span>Cámara</span>
                                    <select
                                        className="escaner-camera-select"
                                        value={deviceIdVision}
                                        onChange={(e) => setDeviceIdVision(e.target.value)}
                                    >
                                        {dispositivosVideo.map((d, i) => (
                                            <option key={d.deviceId || `cam-v-${i}`} value={d.deviceId}>
                                                {d.label || `Cámara ${i + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            {compacto && (
                                <button
                                    type="button"
                                    className="action-btn escaner-secondary-btn escaner-flip-cam-btn"
                                    onClick={() => setVisionFacingUser((v) => !v)}
                                >
                                    <i className="fa-solid fa-camera-rotate" aria-hidden="true" /> Cambiar cámara
                                </button>
                            )}
                        </div>

                        <div className="escaner-video-box escaner-video-box-vision">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                            ></video>
                        </div>

                        {!modeloVision ? (
                            <p className="escaner-loading"><i className="fa-solid fa-spinner fa-spin"></i> Cargando inteligencia artificial...</p>
                        ) : (
                            <button
                                type="button"
                                className="action-btn escaner-vision-btn"
                                onClick={clasificarImagen}
                                disabled={analizando}
                            >
                                <i className="fa-solid fa-brain"></i> {analizando ? 'Analizando...' : 'Analizar producto'}
                            </button>
                        )}

                        {mensajeVision && (
                            <div className={claseMensajeVision}>
                                {mensajeVision.texto}
                            </div>
                        )}

                        {confirmacionPrediccion && (
                            <div className="escaner-confirm-card">
                                <h4>
                                    ¿Es <strong>{confirmacionPrediccion.nombre}</strong>?
                                </h4>
                                <p className="escaner-confirm-score">
                                    Seguridad: {(confirmacionPrediccion.confianza * 100).toFixed(1)}%
                                </p>
                                <div className="escaner-confirm-actions">
                                    <button
                                        type="button"
                                        className="action-btn escaner-accept-btn"
                                        onClick={() => confirmarPrediccionVision(true)}
                                    >
                                        Sí, es ese
                                    </button>
                                    <button
                                        type="button"
                                        className="action-btn escaner-edit-btn"
                                        onClick={() => confirmarPrediccionVision(false)}
                                    >
                                        No, editar
                                    </button>
                                </div>
                            </div>
                        )}

                        {esAdmin && (
                            <div className="escaner-admin-actions">
                                <button
                                    type="button"
                                    onClick={exportarMetricasVision}
                                    className="escaner-admin-btn export"
                                >
                                    Bajar JSON de pruebas
                                </button>
                                <button
                                    type="button"
                                    onClick={resetearMetricasVision}
                                    className="escaner-admin-btn reset"
                                >
                                    Limpiar estadisticas
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

export default Escaner;
