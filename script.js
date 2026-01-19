// ============================================
// VARIABLES GLOBALES
// ============================================
let map;
let drawnItems;
let drawControl;
let currentDrawMode = null;
let areaTotal = 0;
let selectedElement = 'cabezal';
let valvulas = [];
let tuberias = [];
let elementosGraficos = [];
let modoDibujoTuberia = null;
let tuberiaActual = null;
let puntoInicioTuberia = null;
let diseñosGuardados = [];
let modoAgregarElemento = null;
let modoConexion = false;
let tuberiaConexionTipo = null;
let puntoOrigenConexion = null;
let puntosTuberias = [];
let cabezales = [];
let elementoSeleccionado = null;

// Variables para captura de pantalla
let capturaMapaDataUrl = null;
let capturaTomada = false;
let capturaCanvas = null;

// Variables para manejo táctil
let touchStartTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let isTouch = false;
let longPressTimer = null;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar componentes
    initMap();
    setupMobileNavigation();
    setupCadTabs();
    setupMapButtons();
    loadSavedDesigns();
    setupTouchEvents();
    
    // Inicializar controles de dibujo del mapa
    initDrawControls();
    
    // Mostrar mensaje de bienvenida
    setTimeout(() => {
        mostrarMensaje('Usa dos dedos para hacer zoom en el mapa', 4000);
    }, 1000);
});

function setupTouchEvents() {
    // Detectar si es dispositivo táctil
    isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Prevenir zoom con doble toque
    document.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
        touchStartTime = Date.now();
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: false });
    
    // Configurar eventos táctiles para elementos interactivos
    document.querySelectorAll('.tuberia-btn, .elemento-btn, .mapa-btn, .btn').forEach(btn => {
        btn.addEventListener('touchstart', function(e) {
            this.classList.add('touch-active');
            e.preventDefault();
        }, { passive: false });
        
        btn.addEventListener('touchend', function(e) {
            this.classList.remove('touch-active');
            e.preventDefault();
        }, { passive: false });
    });
        // ← AGREGAR ESTO: Asegurar que el scroll funcione en el mapa
    document.getElementById('map').addEventListener('wheel', function(e) {
        e.stopPropagation();
    }, { passive: false });
}

function setupMobileNavigation() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mainNav = document.getElementById('mainNav');
    
    if (mobileMenuBtn && mainNav) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        
        // Cerrar menú al hacer clic en enlace
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
    }
}

function toggleMobileMenu() {
    const mainNav = document.getElementById('mainNav');
    mainNav.classList.toggle('active');
    document.body.style.overflow = mainNav.classList.contains('active') ? 'hidden' : '';
}

function closeMobileMenu() {
    const mainNav = document.getElementById('mainNav');
    mainNav.classList.remove('active');
    document.body.style.overflow = '';
}

function setupCadTabs() {
    document.querySelectorAll('.cad-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            changeTab(this);
        });
    });
}

function changeTab(tab) {
    // Remover clase active de todas las pestañas
    document.querySelectorAll('.cad-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.cad-tab-content').forEach(c => c.classList.remove('active'));
    
    // Agregar clase active a la pestaña seleccionada
    tab.classList.add('active');
    const tabId = tab.getAttribute('data-tab');
    document.getElementById(`${tabId}-tab`).classList.add('active');
}

function setupMapButtons() {
    // Configurar botones del mapa
    document.getElementById('drawPolygonBtn')?.addEventListener('click', iniciarDibujoPoligono);
    document.getElementById('measureBtn')?.addEventListener('click', iniciarMedicion);
    document.getElementById('clearBtn')?.addEventListener('click', limpiarDiseño);
    document.getElementById('searchBtn')?.addEventListener('click', buscarUbicacion);
    
    // Búsqueda por enter
    document.getElementById('location-search')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            buscarUbicacion();
        }
    });
}

// ============================================
// FUNCIONES DEL MAPA (IGUALES AL ORIGINAL)
// ============================================

function initMap() {
    const losMochis = [25.8133, -108.9719];
    
    map = L.map('map', {
        tap: !isTouch, // Desactivar tap de Leaflet en dispositivos táctiles
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: false,
        zoomControl: true,
        zoomControlOptions: {
            position: isTouch ? 'topleft' : 'topleft'
        },
        attributionControl: true,
        maxZoom: 19,
        minZoom: 3
    }).setView(losMochis, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        detectRetina: true
    }).addTo(map);
    
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    setupMapEvents();
}

function initDrawControls() {
    drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            polygon: {
                allowIntersection: false,
                shapeOptions: {
                    color: '#008a45',
                    fillColor: '#00a553',
                    fillOpacity: 0.3,
                    weight: 3
                },
                showArea: true,
                metric: true,
                guideLines: true,
                showLength: true
            },
            polyline: {
                shapeOptions: {
                    color: '#ff0000',
                    weight: 2
                },
                showLength: true,
                metric: true
            },
            rectangle: false,
            circle: false,
            marker: false,
            circlemarker: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });
    
    map.addControl(drawControl);
}

function setupMapEvents() {
    // Evento cuando se crea un elemento de dibujo
    map.on(L.Draw.Event.CREATED, function(event) {
        const layer = event.layer;
        drawnItems.addLayer(layer);
        
        if (event.layerType === 'polygon') {
            calcularAreaPoligono(layer);
            // IMPORTANTE: Desactivar el modo de dibujo actual
            if (currentDrawMode) {
                currentDrawMode.disable();
                currentDrawMode = null;
            }
        } else if (event.layerType === 'polyline') {
            calcularLongitudPolilinea(layer);
            if (currentDrawMode) {
                currentDrawMode.disable();
                currentDrawMode = null;
            }
        }
        
        ocultarControlesMapa();
    });
    
    // Evento cuando se edita un elemento
    map.on(L.Draw.Event.EDITED, function(event) {
        const layers = event.layers;
        layers.eachLayer(function(layer) {
            if (layer instanceof L.Polygon) {
                calcularAreaPoligono(layer);
            } else if (layer instanceof L.Polyline) {
                calcularLongitudPolilinea(layer);
            }
        });
    });
    
    // Evento cuando se elimina un elemento
    map.on(L.Draw.Event.DELETED, function(event) {
        const layers = event.layers;
        layers.eachLayer(function(layer) {
            if (layer instanceof L.Polygon) {
                areaTotal = 0;
                document.getElementById('areaDisplay').textContent = 'Área: 0 m²';
                actualizarResultados();
                mostrarControlesMapa();
            }
        });
    });
    
    // Evento click en el mapa para elementos
    map.on('click', function(e) {
        handleMapClick(e);
    });
}

function handleMapClick(e) {
    if (modoAgregarElemento) {
        agregarElementoGrafico(e.latlng, modoAgregarElemento);
        modoAgregarElemento = null;
        document.getElementById('instruccionesElementos').style.display = 'none';
        
        document.querySelectorAll('.elemento-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        mostrarMensaje('Elemento agregado.');
    } else if (modoConexion) {
        manejarClicConexion(e.latlng, tuberiaConexionTipo);
    } else {
        // Deseleccionar elemento si se hace clic en el mapa vacío
        if (!e.originalEvent.ctrlKey) {
            deseleccionarElemento();
        }
    }
}

// ============================================
// FUNCIONES DE DIBUJO DE POLÍGONOS (ORIGINAL)
// ============================================

function iniciarDibujoPoligono() {
    if (currentDrawMode) {
        currentDrawMode.disable();
        currentDrawMode = null;
    }
    
    // Activar el modo de dibujo de polígonos
    currentDrawMode = new L.Draw.Polygon(map, drawControl.options.draw.polygon);
    currentDrawMode.enable();
    
    mostrarMensaje('Dibuja el terreno. Haz clic para agregar puntos, doble clic para terminar.');
}

function iniciarMedicion() {
    if (currentDrawMode) {
        currentDrawMode.disable();
        currentDrawMode = null;
    }
    
    // Activar el modo de dibujo de polilíneas
    currentDrawMode = new L.Draw.Polyline(map, drawControl.options.draw.polyline);
    currentDrawMode.enable();
    
    mostrarMensaje('Dibuja una línea para medir. Haz clic para agregar puntos, doble clic para terminar.');
}

function calcularAreaPoligono(polygon) {
    areaTotal = L.GeometryUtil.geodesicArea(polygon.getLatLngs()[0]);
    
    document.getElementById('areaDisplay').textContent = 
        `Área: ${areaTotal.toFixed(2)} m² (${(areaTotal / 10000).toFixed(2)} ha)`;
    
    ocultarControlesMapa();
    actualizarResultados();
}

function calcularLongitudPolilinea(polyline) {
    const latlngs = polyline.getLatLngs();
    let length = 0;
    
    for (let i = 0; i < latlngs.length - 1; i++) {
        length += latlngs[i].distanceTo(latlngs[i + 1]);
    }
    
    const areaDisplay = document.getElementById('areaDisplay');
    const currentArea = areaDisplay.textContent.includes('Longitud') ? 
        areaDisplay.textContent.split(' | ')[0] : areaDisplay.textContent;
    areaDisplay.textContent = `${currentArea} | Longitud: ${length.toFixed(2)} m`;
}

// ============================================
// FUNCIONES DE TUBERÍAS (100% IGUAL AL ORIGINAL)
// ============================================

function iniciarModoTuberia(tipoTuberia) {
    if (currentDrawMode) {
        currentDrawMode.disable();
        currentDrawMode = null;
    }
    
    modoConexion = false;
    tuberiaConexionTipo = null;
    puntoOrigenConexion = null;
    
    // Quitar cualquier modo de elemento activo
    modoAgregarElemento = null;
    document.getElementById('instruccionesElementos').style.display = 'none';
    document.querySelectorAll('.elemento-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Limpiar el estado de conexión visualmente
    document.querySelectorAll('.tuberia-btn').forEach(btn => {
        btn.classList.remove('modo-conexion-activo');
        btn.classList.remove('activo');
    });
    
    const botonId = tipoTuberia === 'principal' ? 'btnTuberiaPrincipal' : 
                   tipoTuberia === 'secundaria' ? 'btnTuberiaSecundaria' : 'btnTuberiaRegante';
    document.getElementById(botonId).classList.add('activo');
    
    const instruccionesId = tipoTuberia === 'principal' ? 'instruccionesPrincipal' : 
                           tipoTuberia === 'secundaria' ? 'instruccionesSecundaria' : 'instruccionesRegante';
    document.getElementById(instruccionesId).style.display = 'block';
    
    const diametroSelectId = tipoTuberia === 'principal' ? 'diametroPrincipal' : 
                             tipoTuberia === 'secundaria' ? 'diametroSecundaria' : 'diametroRegante';
    const diametro = document.getElementById(diametroSelectId).value;
    
    const tipoSelectId = tipoTuberia === 'principal' ? 'tipoPrincipal' : 
                         tipoTuberia === 'secundaria' ? 'tipoSecundaria' : 'tipoRegante';
    const tipoMaterial = document.getElementById(tipoSelectId).value;
    
    tuberiaActual = {
        tipo: tipoTuberia,
        puntoInicio: null,
        puntoFin: null,
        color: getColorTuberia(tipoTuberia),
        grosor: getGrosorTuberia(tipoTuberia, diametro),
        diametro: diametro,
        tipoMaterial: tipoMaterial,
        id: Date.now(),
        conexiones: []
    };
    
    mostrarMensaje(`Modo dibujo tubería ${tipoTuberia} (${diametro}"). Toca el mapa para establecer el punto de inicio.`);
    
    // Configurar eventos específicos para el dibujo de tuberías
    configurarEventosDibujoTuberia(tipoTuberia, diametro, tipoMaterial);
}

function configurarEventosDibujoTuberia(tipoTuberia, diametro, tipoMaterial) {
    // Remover eventos anteriores
    map.off('click');
    
    // Primer clic: establecer punto de inicio
    map.once('click', function(e) {
        tuberiaActual.puntoInicio = e.latlng;
        
        const marcadorInicio = crearMarcadorTuberia(e.latlng, 'inicio', tipoTuberia, diametro);
        marcadorInicio.addTo(map);
        tuberiaActual.marcadorInicio = marcadorInicio;
        
        puntosTuberias.push({
            tipo: tipoTuberia,
            latlng: e.latlng,
            tuberiaId: tuberiaActual.id,
            esInicio: true
        });
        
        mostrarMensaje(`Punto de inicio establecido. Ahora toca para establecer el punto final.`);
        
        // Segundo clic: establecer punto final
        map.once('click', function(e2) {
            establecerPuntoFinal(e2.latlng, tipoTuberia, diametro, tipoMaterial);
        });
    });
}

function establecerPuntoFinal(latlng, tipoTuberia, diametro, tipoMaterial) {
    if (!tuberiaActual || !tuberiaActual.puntoInicio) return;
    
    let puntoExistente = null;
    let esConexion = false;
    
    puntosTuberias.forEach(punto => {
        const distancia = latlng.distanceTo(punto.latlng);
        if (distancia < 5) {
            puntoExistente = punto;
            esConexion = true;
        }
    });
    
    tuberiaActual.puntoFin = puntoExistente ? puntoExistente.latlng : latlng;
    
    if (!puntoExistente) {
        const marcadorFin = crearMarcadorTuberia(latlng, 'fin', tipoTuberia, diametro);
        marcadorFin.addTo(map);
        tuberiaActual.marcadorFin = marcadorFin;
        
        puntosTuberias.push({
            tipo: tipoTuberia,
            latlng: latlng,
            tuberiaId: tuberiaActual.id,
            esInicio: false
        });
    } else {
        tuberiaActual.conexiones.push({
            tuberiaId: puntoExistente.tuberiaId,
            punto: puntoExistente.esInicio ? 'inicio' : 'fin',
            latlng: puntoExistente.latlng
        });
        
        const otraTuberia = tuberias.find(t => t.id === puntoExistente.tuberiaId);
        if (otraTuberia) {
            otraTuberia.conexiones.push({
                tuberiaId: tuberiaActual.id,
                punto: 'pendiente',
                latlng: tuberiaActual.puntoFin
            });
        }
    }
    
    const linea = dibujarLineaTuberia(tuberiaActual.puntoInicio, tuberiaActual.puntoFin, tipoTuberia, diametro);
    tuberiaActual.linea = linea;
    
    const longitud = tuberiaActual.puntoInicio.distanceTo(tuberiaActual.puntoFin);
    tuberiaActual.longitud = longitud;
    
    const centro = L.latLng(
        (tuberiaActual.puntoInicio.lat + tuberiaActual.puntoFin.lat) / 2,
        (tuberiaActual.puntoInicio.lng + tuberiaActual.puntoFin.lng) / 2
    );
    
    const etiqueta = L.marker(centro, {
        icon: L.divIcon({
            className: 'tuberia-label',
            html: `<div style="background: white; padding: 2px 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold;">
                   ${longitud.toFixed(1)}m - ${diametro}"</div>`,
            iconSize: [80, 20],
            iconAnchor: [40, 10]
        })
    }).addTo(map);
    
    tuberiaActual.etiquetaLongitud = etiqueta;
    
    // Agregar botón de eliminación al popup de la tubería
    const popupContent = `
        <div style="text-align: center;">
            <b>Tubería ${tipoTuberia} (${diametro}")</b><br>
            Longitud: ${longitud.toFixed(2)} m<br>
            Material: ${tipoMaterial}<br>
            <button onclick="eliminarTuberia('${tuberiaActual.id}')" 
                    style="margin-top: 5px; padding: 3px 8px; background-color: #ff6b6b; color: white; border: none; border-radius: 3px; font-size: 0.8rem; cursor: pointer;">
                <i class="fas fa-trash"></i> Eliminar Tubería
            </button>
            <button onclick="editarTuberia('${tuberiaActual.id}')" 
                    style="margin-top: 5px; margin-left: 5px; padding: 3px 8px; background-color: #4ecdc4; color: white; border: none; border-radius: 3px; font-size: 0.8rem; cursor: pointer;">
                <i class="fas fa-edit"></i> Editar Diámetro
            </button>
        </div>
    `;
    
    linea.bindPopup(popupContent);
    
    tuberias.push({...tuberiaActual});
    
    actualizarResumenTuberias();
    actualizarResultados();
    
    // Restaurar el evento click original del mapa
    restaurarEventoClickMapa();
    
    // Limpiar estado de la tubería actual
    tuberiaActual = null;
    
    const instruccionesId = tipoTuberia === 'principal' ? 'instruccionesPrincipal' : 
                           tipoTuberia === 'secundaria' ? 'instruccionesSecundaria' : 'instruccionesRegante';
    document.getElementById(instruccionesId).style.display = 'none';
    
    const botonId = tipoTuberia === 'principal' ? 'btnTuberiaPrincipal' : 
                   tipoTuberia === 'secundaria' ? 'btnTuberiaSecundaria' : 'btnTuberiaRegante';
    document.getElementById(botonId).classList.remove('activo');
    
    mostrarMensaje(`Tubería ${tipoTuberia} (${diametro}") creada. Longitud: ${longitud.toFixed(1)} metros`);
}

function restaurarEventoClickMapa() {
    // Remover todos los eventos click del mapa
    map.off('click');
    
    // Restaurar el evento click original
    map.on('click', function(e) {
        handleMapClick(e);
    });
}

function crearMarcadorTuberia(latlng, tipo, tipoTuberia, diametro) {
    const color = getColorTuberia(tipoTuberia);
    const tamanos = {
        'principal': isTouch ? 22 : 18,
        'secundaria': isTouch ? 19 : 15,
        'regante': isTouch ? 16 : 12
    };
    
    const tamano = tamanos[tipoTuberia];
    
    const marcador = L.marker(latlng, {
        icon: L.divIcon({
            className: 'tuberia-punto',
            html: `<div style="background: ${color}; width: ${tamano}px; height: ${tamano}px; 
                   border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); 
                   cursor: pointer;" title="${tipoTuberia} ${diametro}"></div>`,
            iconSize: [tamano, tamano],
            iconAnchor: [tamano/2, tamano/2]
        })
    });
    
    marcador.draggable = true;
    marcador.on('dragend', function(e) {
        const nuevoLatLng = e.target.getLatLng();
        
        const puntoIndex = puntosTuberias.findIndex(p => 
            Math.abs(p.latlng.lat - latlng.lat) < 0.00001 && 
            Math.abs(p.latlng.lng - latlng.lng) < 0.00001
        );
        
        if (puntoIndex !== -1) {
            puntosTuberias[puntoIndex].latlng = nuevoLatLng;
        }
        
        actualizarTuberiasConPunto(latlng, nuevoLatLng);
    });
    
    return marcador;
}

function dibujarLineaTuberia(puntoInicio, puntoFin, tipoTuberia, diametro) {
    const color = getColorTuberia(tipoTuberia);
    const grosor = getGrosorTuberia(tipoTuberia, diametro);
    
    const linea = L.polyline([puntoInicio, puntoFin], {
        color: color,
        weight: grosor,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);
    
    // Hacer editable la línea
    linea.editing.enable();
    
    // Calcular y mostrar información inicial
    const distancia = puntoInicio.distanceTo(puntoFin);
    const angulo = calcularAngulo(puntoInicio, puntoFin);
    
    const centro = L.latLng(
        (puntoInicio.lat + puntoFin.lat) / 2,
        (puntoInicio.lng + puntoFin.lng) / 2
    );
    
    const etiqueta = L.marker(centro, {
        icon: L.divIcon({
            className: 'tuberia-label',
            html: `<div style="background: white; padding: 3px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold; text-align: center; line-height: 1.2;">
                   ${distancia.toFixed(1)}m - ${diametro}"<br>
                   <small style="color: #666;">${angulo.toFixed(1)}°</small>
                   </div>`,
            iconSize: [80, 30],
            iconAnchor: [40, 15]
        })
    }).addTo(map);
    
    linea.etiquetas = [etiqueta];
    
    // Configurar evento de edición
    linea.on('edit', function(e) {
        const latlngs = e.target.getLatLngs();
        const longitudTotal = calcularLongitudTotal(latlngs);
        const angulo = calcularAngulo(latlngs[0], latlngs[1]);
        
        const nuevoCentro = L.latLng(
            (latlngs[0].lat + latlngs[1].lat) / 2,
            (latlngs[0].lng + latlngs[1].lng) / 2
        );
        
        if (linea.etiquetas && linea.etiquetas[0]) {
            linea.etiquetas[0].setLatLng(nuevoCentro);
            linea.etiquetas[0].setIcon(L.divIcon({
                className: 'tuberia-label',
                html: `<div style="background: white; padding: 3px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold; text-align: center; line-height: 1.2;">
                       ${longitudTotal.toFixed(1)}m - ${diametro}"<br>
                       <small style="color: #666;">${angulo.toFixed(1)}°</small>
                       </div>`,
                iconSize: [80, 30],
                iconAnchor: [40, 15]
            }));
        }
        
        // Actualizar la tubería en el array
        const tuberia = tuberias.find(t => t.linea === linea);
        if (tuberia) {
            tuberia.longitud = longitudTotal;
            tuberia.puntoInicio = latlngs[0];
            tuberia.puntoFin = latlngs[1];
            
            if (tuberia.etiquetaLongitud) {
                tuberia.etiquetaLongitud.setIcon(L.divIcon({
                    className: 'tuberia-label',
                    html: `<div style="background: white; padding: 2px 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold;">
                           ${longitudTotal.toFixed(1)}m - ${diametro}"</div>`,
                    iconSize: [80, 20],
                    iconAnchor: [40, 10]
                }));
            }
            
            actualizarResumenTuberias();
            actualizarResultados();
        }
    });
    
    return linea;
}

function calcularLongitudTotal(latlngs) {
    let longitud = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
        longitud += latlngs[i].distanceTo(latlngs[i + 1]);
    }
    return longitud;
}

function calcularAngulo(p1, p2) {
    const dx = p2.lng - p1.lng;
    const dy = p2.lat - p1.lat;
    let angulo = Math.atan2(dy, dx);
    angulo = angulo * (180 / Math.PI);
    angulo = (90 - angulo) % 360;
    if (angulo < 0) angulo += 360;
    return angulo;
}

// ============================================
// FUNCIONES DE UTILIDAD (ORIGINAL)
// ============================================

function getGrosorTuberia(tipo, diametro) {
    const grosoresBase = {
        'principal': 8,
        'secundaria': 6,
        'regante': 4
    };
    
    const base = grosoresBase[tipo] || 4;
    const diametroNum = parseFloat(diametro);
    
    if (isTouch) {
        // Aumentar grosor para mejor visibilidad en móviles
        return base + 4;
    }
    
    if (tipo === 'principal') {
        return base + (diametroNum * 1.2);
    } else if (tipo === 'secundaria') {
        return base + (diametroNum * 0.8);
    } else {
        return base + (diametroNum * 0.5);
    }
}

function getColorTuberia(tipo) {
    const colores = {
        'principal': '#ff6b6b',
        'secundaria': '#4ecdc4',
        'regante': '#45b7d1'
    };
    return colores[tipo] || '#000000';
}

function actualizarTuberiasConPunto(viejoLatLng, nuevoLatLng) {
    tuberias.forEach(tuberia => {
        if (tuberia.puntoInicio && 
            Math.abs(tuberia.puntoInicio.lat - viejoLatLng.lat) < 0.00001 && 
            Math.abs(tuberia.puntoInicio.lng - viejoLatLng.lng) < 0.00001) {
            tuberia.puntoInicio = nuevoLatLng;
            
            if (tuberia.linea && tuberia.puntoFin) {
                const nuevosPuntos = [nuevoLatLng, tuberia.puntoFin];
                tuberia.linea.setLatLngs(nuevosPuntos);
            }
            
            if (tuberia.etiquetaLongitud && tuberia.puntoFin) {
                const centro = L.latLng(
                    (nuevoLatLng.lat + tuberia.puntoFin.lat) / 2,
                    (nuevoLatLng.lng + tuberia.puntoFin.lng) / 2
                );
                tuberia.etiquetaLongitud.setLatLng(centro);
                
                const nuevaLongitud = nuevoLatLng.distanceTo(tuberia.puntoFin);
                tuberia.longitud = nuevaLongitud;
                tuberia.etiquetaLongitud.setIcon(L.divIcon({
                    className: 'tuberia-label',
                    html: `<div style="background: white; padding: 2px 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold;">
                           ${nuevaLongitud.toFixed(1)}m - ${tuberia.diametro}"</div>`,
                    iconSize: [80, 20],
                    iconAnchor: [40, 10]
                }));
            }
        }
        
        if (tuberia.puntoFin && 
            Math.abs(tuberia.puntoFin.lat - viejoLatLng.lat) < 0.00001 && 
            Math.abs(tuberia.puntoFin.lng - viejoLatLng.lng) < 0.00001) {
            tuberia.puntoFin = nuevoLatLng;
            
            if (tuberia.linea && tuberia.puntoInicio) {
                const nuevosPuntos = [tuberia.puntoInicio, nuevoLatLng];
                tuberia.linea.setLatLngs(nuevosPuntos);
            }
            
            if (tuberia.etiquetaLongitud && tuberia.puntoInicio) {
                const centro = L.latLng(
                    (tuberia.puntoInicio.lat + nuevoLatLng.lat) / 2,
                    (tuberia.puntoInicio.lng + nuevoLatLng.lng) / 2
                );
                tuberia.etiquetaLongitud.setLatLng(centro);
                
                const nuevaLongitud = tuberia.puntoInicio.distanceTo(nuevoLatLng);
                tuberia.longitud = nuevaLongitud;
                tuberia.etiquetaLongitud.setIcon(L.divIcon({
                    className: 'tuberia-label',
                    html: `<div style="background: white; padding: 2px 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold;">
                           ${nuevaLongitud.toFixed(1)}m - ${tuberia.diametro}"</div>`,
                    iconSize: [80, 20],
                    iconAnchor: [40, 10]
                }));
            }
        }
    });
    
    actualizarResumenTuberias();
    actualizarResultados();
}

// ============================================
// FUNCIONES DE ELEMENTOS (ORIGINAL)
// ============================================

function agregarElementoGrafico(latlng, tipo) {
    const iconos = {
        'cabezal': 'fa-gear',
        'purgaterminal': 'fa-faucet',
        'tomagua': 'fa-tint',
        'valvula': 'fa-toggle-on',
        'filtro': 'fa-filter'
    };
    
    const colores = {
        'cabezal': '#1772af',
        'purgaterminal': '#ff9f43',
        'tomagua': '#00a553',
        'valvula': '#ff6b6b',
        'filtro': '#4ecdc4'
    };
    
    const elementoId = Date.now();
    const tamañoIcono = isTouch ? 40 : 30;
    
    const elemento = L.marker(latlng, {
        icon: L.divIcon({
            className: 'elemento-grafico',
            html: `<div style="background: ${colores[tipo]}; color: white; width: ${tamañoIcono}px; height: ${tamañoIcono}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${tamañoIcono/2}px;">
                    <i class="fas ${iconos[tipo]}"></i></div>`,
            iconSize: [tamañoIcono, tamañoIcono],
            iconAnchor: [tamañoIcono/2, tamañoIcono/2]
        }),
        draggable: true
    }).addTo(map);
    
    // Configurar popup inicial
    let popupContent = `<b>${tipo.toUpperCase()}</b><br>Arrastra para mover`;
    let nombreValvula = '';
    
    // Si es una válvula, configurar específicamente
    if (tipo === 'valvula') {
        nombreValvula = generarNombreValvula();
        valvulas.push({
            id: elementoId,
            nombre: nombreValvula,
            elementoId: elementoId,
            posicion: latlng,
            caudalEmisor: 4,
            numeroEmisores: 100,
            tipo: 'Manual',
            diametro: '2"',
            presion: 3,
            caudalTotal: 400
        });
        popupContent = `<b>VÁLVULA ${nombreValvula}</b><br>Caudal: 400 L/h<br>Arrastra para mover`;
    }
    
    // Si es un cabezal, configurar específicamente
    if (tipo === 'cabezal') {
        cabezales.push({
            id: elementoId,
            elementoId: elementoId,
            posicion: latlng,
            caudalBomba: 50,
            diametroSuccion: '4"',
            diametroDescarga: '3"',
            numeroFiltros: 2,
            tipoFiltros: 'Anillas',
            notas: 'Cabezal principal del sistema'
        });
        popupContent = `<b>CABEZAL PRINCIPAL</b><br>Caudal: 50 L/s<br>Arrastra para mover`;
    }
    
    elemento.bindPopup(popupContent);
    
    // Evento para hacer clic en el elemento (para seleccionarlo)
    elemento.on('click', function(e) {
        // Si se mantiene presionado Ctrl, no hacer nada (para arrastrar)
        if (e.originalEvent.ctrlKey) return;
        
        // Seleccionar este elemento
        seleccionarElemento(elementoId, tipo);
        e.originalEvent.stopPropagation();
    });
    
    // Evento para arrastrar
    elemento.on('dragend', function(e) {
        const nuevaPos = e.target.getLatLng();
        const elementoIndex = elementosGraficos.findIndex(e => e.layer === elemento);
        if (elementoIndex !== -1) {
            elementosGraficos[elementoIndex].posicion = nuevaPos;
            
            // Actualizar en el array correspondiente
            if (tipo === 'valvula') {
                const valvulaIndex = valvulas.findIndex(v => v.elementoId === elementosGraficos[elementoIndex].id);
                if (valvulaIndex !== -1) {
                    valvulas[valvulaIndex].posicion = nuevaPos;
                    
                    // Actualizar la configuración si está seleccionada
                    if (elementoSeleccionado && elementoSeleccionado.id === elementoId) {
                        actualizarConfiguracionElemento(tipo, elementoId);
                    }
                }
            } else if (tipo === 'cabezal') {
                const cabezalIndex = cabezales.findIndex(c => c.elementoId === elementosGraficos[elementoIndex].id);
                if (cabezalIndex !== -1) {
                    cabezales[cabezalIndex].posicion = nuevaPos;
                    
                    // Actualizar la configuración si está seleccionada
                    if (elementoSeleccionado && elementoSeleccionado.id === elementoId) {
                        actualizarConfiguracionElemento(tipo, elementoId);
                    }
                }
            }
        }
    });
    
    // Guardar referencia
    elementosGraficos.push({
        id: elementoId,
        type: 'elemento',
        layer: elemento,
        tipo: tipo,
        posicion: latlng
    });
    
    // Si es válvula o cabezal, seleccionarlo automáticamente
    if (tipo === 'valvula' || tipo === 'cabezal') {
        seleccionarElemento(elementoId, tipo);
    }
    
    // Actualizar resultados
    actualizarResultados();
    
    return elementoId;
}

function iniciarModoElemento(tipoElemento) {
    // Desactivar otros modos
    if (currentDrawMode) {
        currentDrawMode.disable();
        currentDrawMode = null;
    }
    
    if (tuberiaActual) {
        tuberiaActual = null;
        puntoInicioTuberia = null;
        
        document.querySelectorAll('.tuberia-btn').forEach(btn => {
            btn.classList.remove('activo');
        });
        
        document.getElementById('instruccionesPrincipal').style.display = 'none';
        document.getElementById('instruccionesSecundaria').style.display = 'none';
        document.getElementById('instruccionesRegante').style.display = 'none';
    }
    
    if (modoConexion) {
        modoConexion = false;
        tuberiaConexionTipo = null;
        puntoOrigenConexion = null;
        
        document.querySelectorAll('.tuberia-btn').forEach(btn => {
            btn.classList.remove('modo-conexion-activo');
        });
    }
    
    // Quitar clase active de todos los botones de elemento
    document.querySelectorAll('.elemento-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Agregar clase active al botón clickeado
    const elementoBtn = document.querySelector(`.elemento-btn[data-elemento="${tipoElemento}"]`);
    if (elementoBtn) {
        elementoBtn.classList.add('active');
    }
    
    modoAgregarElemento = tipoElemento;
    document.getElementById('instruccionesElementos').style.display = 'block';
    mostrarMensaje(`Modo elemento activado. Toca el mapa para colocar el ${tipoElemento}.`);
    
    // Actualizar configuración del elemento
    actualizarConfiguracionElemento(tipoElemento);
}

function seleccionarElemento(elementoId, tipo) {
    // Limpiar selección anterior
    if (elementoSeleccionado && elementoSeleccionado.layer) {
        // Quitar efecto visual de selección
        const icon = elementoSeleccionado.layer.getElement();
        if (icon) {
            icon.style.boxShadow = '';
            icon.style.border = '';
        }
    }
    
    // Buscar el elemento
    const elemento = elementosGraficos.find(e => e.id === elementoId);
    if (!elemento) return;
    
    // Establecer como seleccionado
    elementoSeleccionado = elemento;
    
    // Aplicar efecto visual de selección
    const icon = elemento.layer.getElement();
    if (icon) {
        icon.style.boxShadow = '0 0 0 3px #ff9f43';
        icon.style.border = '2px solid white';
    }
    
    // Abrir popup
    elemento.layer.openPopup();
    
    // Cambiar a la pestaña de elementos si no está activa
    if (!document.querySelector('.cad-tab[data-tab="elementos"]').classList.contains('active')) {
        document.querySelectorAll('.cad-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.cad-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const elementosTab = document.querySelector('.cad-tab[data-tab="elementos"]');
        elementosTab.classList.add('active');
        document.getElementById('elementos-tab').classList.add('active');
    }
    
    // Actualizar la configuración del elemento seleccionado
    actualizarConfiguracionElemento(tipo, elementoId);
    
    // Mostrar mensaje
    let nombreElemento = tipo;
    if (tipo === 'valvula') {
        const valvula = valvulas.find(v => v.elementoId === elementoId);
        if (valvula) nombreElemento = `Válvula ${valvula.nombre}`;
    } else if (tipo === 'cabezal') {
        nombreElemento = 'Cabezal';
    }
    
    mostrarMensaje(`${nombreElemento} seleccionado.`);
}

function deseleccionarElemento() {
    if (elementoSeleccionado && elementoSeleccionado.layer) {
        // Quitar efecto visual de selección
        const icon = elementoSeleccionado.layer.getElement();
        if (icon) {
            icon.style.boxShadow = '';
            icon.style.border = '';
        }
        
        // Cerrar popup
        elementoSeleccionado.layer.closePopup();
    }
    
    elementoSeleccionado = null;
    
    // Restaurar configuración por defecto
    actualizarConfiguracionElemento('cabezal');
}

function generarNombreValvula() {
    const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    const numeros = Array.from({length: 10}, (_, i) => i + 1);
    
    const nombresExistentes = valvulas.map(v => v.nombre);
    
    for (let letra of letras) {
        for (let numero of numeros) {
            const nombre = `${letra}${numero}`;
            if (!nombresExistentes.includes(nombre)) {
                return nombre;
            }
        }
    }
    
    return `V${valvulas.length + 1}`;
}

// ============================================
// FUNCIONES DE CONEXIÓN (ORIGINAL)
// ============================================

function iniciarModoConexion(tipoTuberia) {
    if (currentDrawMode) {
        currentDrawMode.disable();
        currentDrawMode = null;
    }
    
    if (tuberiaActual) {
        tuberiaActual = null;
    }
    
    document.querySelectorAll('.tuberia-btn').forEach(btn => {
        btn.classList.remove('activo');
    });
    
    const botonId = tipoTuberia === 'principal' ? 'btnConectarPrincipal' : 
                   tipoTuberia === 'secundaria' ? 'btnConectarSecundaria' : 'btnConectarRegante';
    document.getElementById(botonId).classList.add('modo-conexion-activo');
    
    modoConexion = true;
    tuberiaConexionTipo = tipoTuberia;
    puntoOrigenConexion = null;
    
    const diametroSelectId = tipoTuberia === 'principal' ? 'diametroPrincipal' : 
                             tipoTuberia === 'secundaria' ? 'diametroSecundaria' : 'diametroRegante';
    const diametro = document.getElementById(diametroSelectId).value;
    
    const tipoSelectId = tipoTuberia === 'principal' ? 'tipoPrincipal' : 
                         tipoTuberia === 'secundaria' ? 'tipoSecundaria' : 'tipoRegante';
    const tipoMaterial = document.getElementById(tipoSelectId).value;
    
    mostrarMensaje(`Modo conexión ${tipoTuberia} (${diametro}"). Toca un punto de tubería para iniciar la conexión.`);
    
    map.off('click');
    map.on('click', function(e) {
        manejarClicConexion(e.latlng, tipoTuberia, diametro, tipoMaterial);
    });
}

function manejarClicConexion(latlng, tipoTuberia, diametro, tipoMaterial) {
    let puntoCercano = null;
    let distanciaMinima = Infinity;
    
    puntosTuberias.forEach(punto => {
        const distancia = latlng.distanceTo(punto.latlng);
        if (distancia < 10) {
            if (distancia < distanciaMinima) {
                distanciaMinima = distancia;
                puntoCercano = punto;
            }
        }
    });
    
    if (!puntoCercano) {
        mostrarMensaje('No hay un punto de tubería cerca. Toca cerca de un punto existente.');
        return;
    }
    
    if (!puntoOrigenConexion) {
        puntoOrigenConexion = {
            punto: puntoCercano,
            latlng: puntoCercano.latlng
        };
        
        resaltarPunto(puntoCercano.latlng);
        mostrarMensaje('Punto origen seleccionado. Ahora toca otro punto para conectar.');
    } else {
        if (puntoCercano.latlng.lat === puntoOrigenConexion.latlng.lat && 
            puntoCercano.latlng.lng === puntoOrigenConexion.latlng.lng) {
            mostrarMensaje('No puedes conectar un punto consigo mismo. Selecciona otro punto.');
            return;
        }
        
        const nuevaTuberia = {
            tipo: tipoTuberia,
            puntoInicio: puntoOrigenConexion.latlng,
            puntoFin: puntoCercano.latlng,
            color: getColorTuberia(tipoTuberia),
            grosor: getGrosorTuberia(tipoTuberia, diametro),
            diametro: diametro,
            tipoMaterial: tipoMaterial,
            id: Date.now(),
            conexiones: [
                {
                    tuberiaId: puntoOrigenConexion.punto.tuberiaId,
                    punto: puntoOrigenConexion.punto.esInicio ? 'inicio' : 'fin',
                    latlng: puntoOrigenConexion.latlng
                },
                {
                    tuberiaId: puntoCercano.tuberiaId,
                    punto: puntoCercano.esInicio ? 'inicio' : 'fin',
                    latlng: puntoCercano.latlng
                }
            ],
            esConexion: true
        };
        
        const linea = dibujarLineaTuberia(nuevaTuberia.puntoInicio, nuevaTuberia.puntoFin, tipoTuberia, diametro);
        nuevaTuberia.linea = linea;
        
        nuevaTuberia.longitud = nuevaTuberia.puntoInicio.distanceTo(nuevaTuberia.puntoFin);
        
        const centro = L.latLng(
            (nuevaTuberia.puntoInicio.lat + nuevaTuberia.puntoFin.lat) / 2,
            (nuevaTuberia.puntoInicio.lng + nuevaTuberia.puntoFin.lng) / 2
        );
        
        const etiqueta = L.marker(centro, {
            icon: L.divIcon({
                className: 'tuberia-label',
                html: `<div style="background: white; padding: 2px 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold;">
                       ${nuevaTuberia.longitud.toFixed(1)}m - ${diametro}"</div>`,
                iconSize: [80, 20],
                iconAnchor: [40, 10]
            })
        }).addTo(map);
        
        nuevaTuberia.etiquetaLongitud = etiqueta;
        
        // Agregar popup con botones de eliminación/edición
        const popupContent = `
            <div style="text-align: center;">
                <b>Conexión ${tipoTuberia} (${diametro}")</b><br>
                Longitud: ${nuevaTuberia.longitud.toFixed(2)} m<br>
                <button onclick="eliminarTuberia('${nuevaTuberia.id}')" 
                        style="margin-top: 5px; padding: 3px 8px; background-color: #ff6b6b; color: white; border: none; border-radius: 3px; font-size: 0.8rem; cursor: pointer;">
                    <i class="fas fa-trash"></i> Eliminar Conexión
                </button>
                <button onclick="editarTuberia('${nuevaTuberia.id}')" 
                        style="margin-top: 5px; margin-left: 5px; padding: 3px 8px; background-color: #4ecdc4; color: white; border: none; border-radius: 3px; font-size: 0.8rem; cursor: pointer;">
                    <i class="fas fa-edit"></i> Editar Diámetro
                </button>
            </div>
        `;
        
        linea.bindPopup(popupContent);
        
        tuberias.push(nuevaTuberia);
        
        const tuberiaOrigen = tuberias.find(t => t.id === puntoOrigenConexion.punto.tuberiaId);
        const tuberiaDestino = tuberias.find(t => t.id === puntoCercano.tuberiaId);
        
        if (tuberiaOrigen) {
            if (!tuberiaOrigen.conexiones) tuberiaOrigen.conexiones = [];
            tuberiaOrigen.conexiones.push({
                tuberiaId: nuevaTuberia.id,
                punto: 'conexion',
                latlng: puntoOrigenConexion.latlng
            });
        }
        
        if (tuberiaDestino) {
            if (!tuberiaDestino.conexiones) tuberiaDestino.conexiones = [];
            tuberiaDestino.conexiones.push({
                tuberiaId: nuevaTuberia.id,
                punto: 'conexion',
                latlng: puntoCercano.latlng
            });
        }
        
        actualizarResumenTuberias();
        actualizarResultados();
        
        modoConexion = false;
        tuberiaConexionTipo = null;
        puntoOrigenConexion = null;
        
        const botonId = tipoTuberia === 'principal' ? 'btnConectarPrincipal' : 
                       tipoTuberia === 'secundaria' ? 'btnConectarSecundaria' : 'btnConectarRegante';
        document.getElementById(botonId).classList.remove('modo-conexion-activo');
        
        map.off('click');
        quitarResaltadoPuntos();
        restaurarEventoClickMapa();
        
        mostrarMensaje(`Conexión establecida entre tuberías. Longitud: ${nuevaTuberia.longitud.toFixed(1)} metros`);
    }
}

function resaltarPunto(latlng) {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            const markerLatLng = layer.getLatLng();
            if (markerLatLng && 
                Math.abs(markerLatLng.lat - latlng.lat) < 0.00001 && 
                Math.abs(markerLatLng.lng - latlng.lng) < 0.00001) {
                const icon = layer.getElement();
                if (icon) {
                    icon.classList.add('punto-activo');
                }
            }
        }
    });
}

function quitarResaltadoPuntos() {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            const icon = layer.getElement();
            if (icon) {
                icon.classList.remove('punto-activo');
            }
        }
    });
}

// ============================================
// FUNCIONES DE GESTIÓN (ORIGINAL)
// ============================================

function eliminarTuberia(tuberiaId) {
    const tuberiaIndex = tuberias.findIndex(t => t.id === parseInt(tuberiaId));
    if (tuberiaIndex === -1) return;
    
    const tuberia = tuberias[tuberiaIndex];
    
    if (!confirm(`¿Eliminar tubería ${tuberia.tipo} (${tuberia.diametro}")?`)) return;
    
    // Remover elementos del mapa
    if (tuberia.marcadorInicio) map.removeLayer(tuberia.marcadorInicio);
    if (tuberia.marcadorFin) map.removeLayer(tuberia.marcadorFin);
    if (tuberia.linea) {
        // Remover etiquetas si existen
        if (tuberia.linea.etiquetas) {
            tuberia.linea.etiquetas.forEach(etiqueta => {
                if (etiqueta && etiqueta.remove) {
                    etiqueta.remove();
                }
            });
        }
        map.removeLayer(tuberia.linea);
    }
    if (tuberia.etiquetaLongitud) map.removeLayer(tuberia.etiquetaLongitud);
    
    // Remover puntos asociados
    puntosTuberias = puntosTuberias.filter(p => p.tuberiaId !== tuberia.id);
    
    // Remover de tuberías
    tuberias.splice(tuberiaIndex, 1);
    
    actualizarResumenTuberias();
    actualizarResultados();
    
    mostrarMensaje(`Tubería eliminada`);
}

function editarTuberia(tuberiaId) {
    const tuberiaIndex = tuberias.findIndex(t => t.id === parseInt(tuberiaId));
    if (tuberiaIndex === -1) return;
    
    const tuberia = tuberias[tuberiaIndex];
    
    // Mostrar diálogos disponibles según tipo
    let opcionesDiámetro = '';
    if (tuberia.tipo === 'principal') {
        const diametros = ['2', '3', '4', '6', '8', '10', '12', '14', '16', '18', '20'];
        diametros.forEach(d => {
            opcionesDiámetro += `<option value="${d}" ${tuberia.diametro === d ? 'selected' : ''}>${d}"</option>`;
        });
    } else if (tuberia.tipo === 'secundaria') {
        const diametros = ['1', '1.5', '2', '3', '4'];
        diametros.forEach(d => {
            opcionesDiámetro += `<option value="${d}" ${tuberia.diametro === d ? 'selected' : ''}>${d}"</option>`;
        });
    } else {
        const diametros = ['0.5', '0.75', '1'];
        diametros.forEach(d => {
            opcionesDiámetro += `<option value="${d}" ${tuberia.diametro === d ? 'selected' : ''}>${d}"</option>`;
        });
    }
    
    // Crear diálogo personalizado
    const dialogHtml = `
        <div id="dialogEditarTuberia" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.2); z-index: 10000; min-width: 300px;">
            <h3 style="margin-top: 0;">Editar tubería ${tuberia.tipo}</h3>
            <p><strong>Longitud actual:</strong> ${tuberia.longitud.toFixed(2)} m</p>
            <p><strong>Diámetro actual:</strong> ${tuberia.diametro}"</p>
            <div style="margin: 15px 0;">
                <label for="nuevoDiametro" style="display: block; margin-bottom: 5px;">Nuevo diámetro:</label>
                <select id="nuevoDiametro" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    ${opcionesDiámetro}
                </select>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                <button onclick="document.getElementById('dialogEditarTuberia').remove(); document.getElementById('overlayEditarTuberia').remove()" 
                        style="padding: 8px 15px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
                    Cancelar
                </button>
                <button onclick="confirmarEdicionTuberia('${tuberiaId}')" 
                        style="padding: 8px 15px; background: #00a553; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Aplicar
                </button>
            </div>
        </div>
    `;
    
    // Remover diálogo anterior si existe
    const dialogAnterior = document.getElementById('dialogEditarTuberia');
    if (dialogAnterior) dialogAnterior.remove();
    
    // Agregar nuevo diálogo
    const dialogDiv = document.createElement('div');
    dialogDiv.innerHTML = dialogHtml;
    document.body.appendChild(dialogDiv);
    
    // Agregar overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;';
    overlay.id = 'overlayEditarTuberia';
    document.body.appendChild(overlay);
}

function confirmarEdicionTuberia(tuberiaId) {
    const nuevoDiámetro = document.getElementById('nuevoDiametro').value;
    
    // Remover diálogo y overlay
    document.getElementById('dialogEditarTuberia').remove();
    document.getElementById('overlayEditarTuberia').remove();
    
    const tuberiaIndex = tuberias.findIndex(t => t.id === parseInt(tuberiaId));
    if (tuberiaIndex === -1) return;
    
    const tuberia = tuberias[tuberiaIndex];
    
    // Validar que el diámetro sea válido
    let diametrosValidos = [];
    if (tuberia.tipo === 'principal') {
        diametrosValidos = ['2', '3', '4', '6', '8', '10', '12', '14', '16', '18', '20'];
    } else if (tuberia.tipo === 'secundaria') {
        diametrosValidos = ['1', '1.5', '2', '3', '4'];
    } else {
        diametrosValidos = ['0.5', '0.75', '1'];
    }
    
    if (!diametrosValidos.includes(nuevoDiámetro)) {
        alert(`Diámetro no válido para tubería ${tuberia.tipo}. Debe ser uno de: ${diametrosValidos.join(', ')}"`);
        return;
    }
    
    // Actualizar tubería
    tuberia.diametro = nuevoDiámetro;
    tuberia.grosor = getGrosorTuberia(tuberia.tipo, nuevoDiámetro);
    
    // Actualizar línea en el mapa
    if (tuberia.linea) {
        tuberia.linea.setStyle({
            weight: tuberia.grosor
        });
    }
    
    // Actualizar etiqueta principal si existe
    if (tuberia.etiquetaLongitud) {
        tuberia.etiquetaLongitud.setIcon(L.divIcon({
            className: 'tuberia-label',
            html: `<div style="background: white; padding: 2px 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold;">
                   ${tuberia.longitud.toFixed(1)}m - ${nuevoDiámetro}"</div>`,
            iconSize: [80, 20],
            iconAnchor: [40, 10]
        }));
    }
    
    // Actualizar popup
    if (tuberia.linea) {
        const popupContent = `
            <div style="text-align: center;">
                <b>Tubería ${tuberia.tipo} (${nuevoDiámetro}")</b><br>
                Longitud: ${tuberia.longitud.toFixed(2)} m<br>
                Material: ${tuberia.tipoMaterial}<br>
                <button onclick="eliminarTuberia('${tuberia.id}')" 
                        style="margin-top: 5px; padding: 3px 8px; background-color: #ff6b6b; color: white; border: none; border-radius: 3px; font-size: 0.8rem; cursor: pointer;">
                    <i class="fas fa-trash"></i> Eliminar Tubería
                </button>
                <button onclick="editarTuberia('${tuberia.id}')" 
                        style="margin-top: 5px; margin-left: 5px; padding: 3px 8px; background-color: #4ecdc4; color: white; border: none; border-radius: 3px; font-size: 0.8rem; cursor: pointer;">
                    <i class="fas fa-edit"></i> Editar Diámetro
                </button>
            </div>
        `;
        tuberia.linea.bindPopup(popupContent);
    }
    
    actualizarResumenTuberias();
    actualizarResultados();
    
    mostrarMensaje(`Diámetro actualizado a ${nuevoDiámetro}"`);
}

// ============================================
// FUNCIONES DE RESULTADOS (ORIGINAL)
// ============================================

function actualizarResumenTuberias() {
    const resumen = {};
    
    tuberias.forEach(t => {
        const key = `${t.tipo}_${t.diametro}`;
        if (!resumen[key]) {
            resumen[key] = {
                tipo: t.tipo,
                diametro: t.diametro,
                longitudTotal: 0,
                tipoMaterial: t.tipoMaterial,
                conexiones: 0
            };
        }
        resumen[key].longitudTotal += t.longitud || 0;
        resumen[key].conexiones += t.conexiones ? t.conexiones.length : 0;
    });
    
    let html = '<h4>Resumen de Tuberías por Diámetro</h4>';
    
    const totalesPorTipo = {};
    
    Object.keys(resumen).forEach(key => {
        const item = resumen[key];
        if (!totalesPorTipo[item.tipo]) {
            totalesPorTipo[item.tipo] = 0;
        }
        totalesPorTipo[item.tipo] += item.longitudTotal;
    });
    
    ['principal', 'secundaria', 'regante'].forEach(tipo => {
        const itemsTipo = Object.values(resumen).filter(item => item.tipo === tipo);
        if (itemsTipo.length > 0) {
            html += `<div style="margin-bottom: 10px;">`;
            html += `<strong>${tipo.charAt(0).toUpperCase() + tipo.slice(1)}:</strong>`;
            
            itemsTipo.forEach(item => {
                html += `<div class="resumen-item">
                    <span>${item.diametro}" (${item.tipoMaterial}):</span>
                    <span>${item.longitudTotal.toFixed(2)} m</span>
                </div>`;
            });
            
            html += `<div class="resumen-item" style="font-weight: bold;">
                <span>Total ${tipo}:</span>
                <span>${totalesPorTipo[tipo]?.toFixed(2) || '0.00'} m</span>
            </div>`;
            html += `</div>`;
        }
    });
    
    const totalGeneral = Object.values(totalesPorTipo).reduce((sum, val) => sum + val, 0);
    
    html += `<div class="resumen-item" style="font-weight: bold; border-top: 1px solid #ddd; padding-top: 8px;">
        <span>Total General:</span>
        <span>${totalGeneral.toFixed(2)} m</span>
    </div>`;
    
    document.getElementById('resumenTuberiasDetallado').innerHTML = html;
}

function actualizarResultados() {
    const resultadosDiv = document.getElementById('resultadosCalculos');
    
    if (tuberias.length === 0 && valvulas.length === 0 && cabezales.length === 0) {
        resultadosDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No hay elementos en el diseño. Agrega tuberías y elementos para ver los resultados.</p>';
        return;
    }
    
    let html = '';
    
    html += '<div class="resultado-seccion">';
    html += '<h4 class="resultado-titulo">Información General</h4>';
    html += '<table class="resultado-tabla">';
    html += '<tr><th>Área Total</th><td>' + (areaTotal > 0 ? areaTotal.toFixed(2) + ' m² (' + (areaTotal / 10000).toFixed(2) + ' ha)' : 'No definida') + '</td></tr>';
    html += '<tr><th>Fecha de Diseño</th><td>' + new Date().toLocaleDateString() + '</td></tr>';
    html += '</table>';
    html += '</div>';
    
    if (tuberias.length > 0) {
        html += '<div class="resultado-seccion">';
        html += '<h4 class="resultado-titulo">Tuberías por Diámetro</h4>';
        html += '<table class="resultado-tabla">';
        html += '<tr><th>Tipo</th><th>Diámetro</th><th>Material</th><th>Longitud (m)</th><th>Conexiones</th></tr>';
        
        const resumen = {};
        
        tuberias.forEach(t => {
            const key = `${t.tipo}_${t.diametro}_${t.tipoMaterial}`;
            if (!resumen[key]) {
                resumen[key] = {
                    tipo: t.tipo,
                    diametro: t.diametro,
                    tipoMaterial: t.tipoMaterial,
                    longitudTotal: 0,
                    conexiones: 0
                };
            }
            resumen[key].longitudTotal += t.longitud || 0;
            resumen[key].conexiones += t.conexiones ? t.conexiones.length : 0;
        });
        
        let totalGeneral = 0;
        Object.values(resumen).forEach(item => {
            html += `<tr>
                <td>${item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}</td>
                <td>${item.diametro}"</td>
                <td>${item.tipoMaterial}</td>
                <td>${item.longitudTotal.toFixed(2)}</td>
                <td>${item.conexiones}</td>
            </tr>`;
            totalGeneral += item.longitudTotal;
        });
        
        html += `<tr style="font-weight: bold; background-color: #f0f0f0;">
            <td colspan="3">TOTAL GENERAL</td>
            <td>${totalGeneral.toFixed(2)} m</td>
            <td></td>
        </tr>`;
        
        html += '</table>';
        html += '</div>';
    }
    
    if (valvulas.length > 0) {
        html += '<div class="resultado-seccion">';
        html += '<h4 class="resultado-titulo">Válvulas de Control</h4>';
        html += '<table class="resultado-tabla">';
        html += '<tr><th>Nombre</th><th>Tipo</th><th>Diámetro</th><th>Presión (bar)</th><th>Emisores</th><th>Caudal Emisor (L/h)</th><th>Caudal Total (L/h)</th></tr>';
        
        let caudalTotalSistema = 0;
        valvulas.forEach(valvula => {
            html += `<tr>
                <td>${valvula.nombre}</td>
                <td>${valvula.tipo}</td>
                <td>${valvula.diametro}</td>
                <td>${valvula.presion}</td>
                <td>${valvula.numeroEmisores}</td>
                <td>${valvula.caudalEmisor}</td>
                <td>${valvula.caudalTotal}</td>
            </tr>`;
            caudalTotalSistema += valvula.caudalTotal;
        });
        
        html += `<tr style="font-weight: bold; background-color: #f0f0f0;">
            <td colspan="6">CAUDAL TOTAL DEL SISTEMA</td>
            <td>${caudalTotalSistema.toFixed(2)} L/h (${(caudalTotalSistema / 3600).toFixed(2)} L/s)</td>
        </tr>`;
        
        html += '</table>';
        html += '</div>';
    }
    
    if (cabezales.length > 0) {
        html += '<div class="resultado-seccion">';
        html += '<h4 class="resultado-titulo">Cabezal de Bombeo y Filtración</h4>';
        
        cabezales.forEach(cabezal => {
            html += '<table class="resultado-tabla" style="margin-bottom: 15px;">';
            html += `<tr><th colspan="2" style="text-align: center;">CABEZAL PRINCIPAL</th></tr>`;
            html += `<tr><td>Caudal de Bomba</td><td>${cabezal.caudalBomba} L/s</td></tr>`;
            html += `<tr><td>Diámetro Succión</td><td>${cabezal.diametroSuccion}</td></tr>`;
            html += `<tr><td>Diámetro Descarga</td><td>${cabezal.diametroDescarga}</td></tr>`;
            html += `<tr><td>Número de Filtros</td><td>${cabezal.numeroFiltros}</td></tr>`;
            html += `<tr><td>Tipo de Filtros</td><td>${cabezal.tipoFiltros}</td></tr>`;
            if (cabezal.notas) {
                html += `<tr><td>Notas</td><td>${cabezal.notas}</td></tr>`;
            }
            html += '</table>';
        });
        
        html += '</div>';
    }
    
    resultadosDiv.innerHTML = html;
}

// ============================================
// FUNCIONES DE CONFIGURACIÓN DE ELEMENTOS (ORIGINAL)
// ============================================

function actualizarConfiguracionElemento(tipo, elementoId = null) {
    const configDiv = document.getElementById('elementoConfig');
    
    // Si no hay elementoId especificado pero hay un elemento seleccionado del mismo tipo
    if (!elementoId && elementoSeleccionado && elementoSeleccionado.tipo === tipo) {
        elementoId = elementoSeleccionado.id;
    }
    
    if (tipo === 'valvula' && elementoId) {
        const valvula = valvulas.find(v => v.id === parseInt(elementoId));
        if (valvula) {
            configDiv.innerHTML = `
                <h4>Configuración de Válvula ${valvula.nombre}</h4>
                <div class="control-row">
                    <div class="control-label">Nombre:</div>
                    <input type="text" id="nombreValvula" value="${valvula.nombre}" onchange="actualizarValvula('${elementoId}', 'nombre', this.value)">
                </div>
                <div class="control-row">
                    <div class="control-label">Caudal emisor:</div>
                    <input type="number" id="caudalEmisorValvula" value="${valvula.caudalEmisor}" step="0.5" min="1" max="100" onchange="actualizarValvula('${elementoId}', 'caudalEmisor', this.value)">
                    L/h
                </div>
                <div class="control-row">
                    <div class="control-label">N° emisores:</div>
                    <input type="number" id="numEmisoresValvula" value="${valvula.numeroEmisores}" min="1" max="10000" onchange="actualizarValvula('${elementoId}', 'numeroEmisores', this.value)">
                </div>
                <div class="control-row">
                    <div class="control-label">Tipo:</div>
                    <select id="tipoValvula" onchange="actualizarValvula('${elementoId}', 'tipo', this.value)">
                        <option value="Manual" ${valvula.tipo === 'Manual' ? 'selected' : ''}>Manual</option>
                        <option value="Automática" ${valvula.tipo === 'Automática' ? 'selected' : ''}>Automática</option>
                        <option value="Electroválvula" ${valvula.tipo === 'Electroválvula' ? 'selected' : ''}>Electroválvula</option>
                    </select>
                </div>
                <div class="control-row">
                    <div class="control-label">Diámetro:</div>
                    <select id="diametroValvula" onchange="actualizarValvula('${elementoId}', 'diametro', this.value)">
                        <option value="1\"" ${valvula.diametro === '1"' ? 'selected' : ''}>1"</option>
                        <option value="2\"" ${valvula.diametro === '2"' ? 'selected' : ''}>2"</option>
                        <option value="3\"" ${valvula.diametro === '3"' ? 'selected' : ''}>3"</option>
                        <option value="4\"" ${valvula.diametro === '4"' ? 'selected' : ''}>4"</option>
                    </select>
                </div>
                <div class="control-row">
                    <div class="control-label">Presión:</div>
                    <input type="number" id="presionValvula" value="${valvula.presion}" step="0.5" min="1" max="10" onchange="actualizarValvula('${elementoId}', 'presion', this.value)">
                    bar
                </div>
                <div style="margin-top: 10px; padding: 10px; background-color: #e8f4fd; border-radius: 5px;">
                    <strong>Caudal Total:</strong> ${valvula.caudalTotal} L/h (${(valvula.caudalTotal / 3600).toFixed(2)} L/s)
                </div>
                <button onclick="eliminarElemento('${elementoId}', 'valvula')" style="margin-top: 10px; padding: 8px 15px; background-color: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                    <i class="fas fa-trash"></i> Eliminar Válvula
                </button>
            `;
        }
    } else if (tipo === 'cabezal' && elementoId) {
        const cabezal = cabezales.find(c => c.id === parseInt(elementoId));
        if (cabezal) {
            configDiv.innerHTML = `
                <h4>Configuración del Cabezal</h4>
                <div class="control-row">
                    <div class="control-label">Caudal bomba:</div>
                    <input type="number" id="caudalBomba" value="${cabezal.caudalBomba}" step="5" min="1" max="1000" onchange="actualizarCabezal('${elementoId}', 'caudalBomba', this.value)">
                    L/s
                </div>
                <div class="control-row">
                    <div class="control-label">Diámetro succión:</div>
                    <select id="diametroSuccion" onchange="actualizarCabezal('${elementoId}', 'diametroSuccion', this.value)">
                        <option value="2\"" ${cabezal.diametroSuccion === '2"' ? 'selected' : ''}>2"</option>
                        <option value="3\"" ${cabezal.diametroSuccion === '3"' ? 'selected' : ''}>3"</option>
                        <option value="4\"" ${cabezal.diametroSuccion === '4"' ? 'selected' : ''}>4"</option>
                        <option value="6\"" ${cabezal.diametroSuccion === '6"' ? 'selected' : ''}>6"</option>
                        <option value="8\"" ${cabezal.diametroSuccion === '8"' ? 'selected' : ''}>8"</option>
                </select>
            </div>
            <div class="control-row">
                <div class="control-label">Diámetro descarga:</div>
                <select id="diametroDescarga" onchange="actualizarCabezal('${elementoId}', 'diametroDescarga', this.value)">
                    <option value="2\"" ${cabezal.diametroDescarga === '2"' ? 'selected' : ''}>2"</option>
                    <option value="3\"" ${cabezal.diametroDescarga === '3"' ? 'selected' : ''}>3"</option>
                    <option value="4\"" ${cabezal.diametroDescarga === '4"' ? 'selected' : ''}>4"</option>
                    <option value="6\"" ${cabezal.diametroDescarga === '6"' ? 'selected' : ''}>6"</option>
                </select>
            </div>
            <div class="control-row">
                <div class="control-label">N° filtros:</div>
                <input type="number" id="numFiltros" value="${cabezal.numeroFiltros}" min="1" max="10" onchange="actualizarCabezal('${elementoId}', 'numeroFiltros', this.value)">
            </div>
            <div class="control-row">
                <div class="control-label">Tipo filtros:</div>
                <select id="tipoFiltros" onchange="actualizarCabezal('${elementoId}', 'tipoFiltros', this.value)">
                    <option value="Anillas" ${cabezal.tipoFiltros === 'Anillas' ? 'selected' : ''}>Anillas</option>
                    <option value="Arena" ${cabezal.tipoFiltros === 'Arena' ? 'selected' : ''}>Arena</option>
                    <option value="Malla" ${cabezal.tipoFiltros === 'Malla' ? 'selected' : ''}>Malla</option>
                    <option value="Hidrociclón" ${cabezal.tipoFiltros === 'Hidrociclón' ? 'selected' : ''}>Hidrociclón</option>
                </select>
            </div>
            <div class="control-row">
                <div class="control-label">Notas:</div>
                <textarea id="notasCabezal" rows="3" style="width: 100%; margin-top: 5px;" onchange="actualizarCabezal('${elementoId}', 'notas', this.value)">${cabezal.notas}</textarea>
            </div>
            <button onclick="eliminarElemento('${elementoId}', 'cabezal')" style="margin-top: 10px; padding: 8px 15px; background-color: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                <i class="fas fa-trash"></i> Eliminar Cabezal
            </button>
        `;
    }
} else {
    let contenido = '';
    
    switch(tipo) {
        case 'cabezal':
            contenido = `
                <h4>Configuración del Cabezal</h4>
                <p>Haz clic en un cabezal existente en el mapa para editarlo, o coloca uno nuevo.</p>
                <div class="control-row">
                    <div class="control-label">Caudal bomba:</div>
                    <input type="number" id="caudalBomba" value="50" step="5" min="1" max="1000"> L/s
                </div>
                <div class="control-row">
                    <div class="control-label">Diámetro succión:</div>
                    <select id="diametroSuccion">
                        <option value="2\"" selected>2"</option>
                        <option value="3"">3"</option>
                        <option value="4"">4"</option>
                        <option value="6"">6"</option>
                        <option value="8"">8"</option>
                    </select>
                </div>
                <div class="control-row">
                    <div class="control-label">Diámetro descarga:</div>
                    <select id="diametroDescarga">
                        <option value="2\"">2"</option>
                        <option value="3\"" selected>3"</option>
                        <option value="4\"">4"</option>
                        <option value="6\"">6"</option>
                    </select>
                </div>
            `;
            break;
            
        case 'valvula':
            const nombreValvula = generarNombreValvula();
            contenido = `
                <h4>Configuración de Válvula</h4>
                <p>Haz clic en una válvula existente en el mapa para editarla, o coloca una nueva.</p>
                <div class="control-row">
                    <div class="control-label">Nombre:</div>
                    <input type="text" id="nombreValvula" value="${nombreValvula}">
                </div>
                <div class="control-row">
                    <div class="control-label">Caudal emisor:</div>
                    <input type="number" id="caudalEmisorValvula" value="4" step="0.5" min="1" max="100"> L/h
                </div>
                <div class="control-row">
                    <div class="control-label">N° emisores:</div>
                    <input type="number" id="numEmisoresValvula" value="100" min="1" max="10000">
                </div>
            `;
            break;
            
        default:
            contenido = `<p>Selecciona un elemento en el mapa o coloca uno nuevo para configurarlo</p>`;
    }
    
    configDiv.innerHTML = contenido;
}
}

function actualizarValvula(elementoId, campo, valor) {
    const valvula = valvulas.find(v => v.id === parseInt(elementoId));
    if (valvula) {
        valvula[campo] = valor;
        
        if (campo === 'caudalEmisor' || campo === 'numeroEmisores') {
            valvula.caudalTotal = valvula.caudalEmisor * valvula.numeroEmisores;
        }
        
        const elementoGrafico = elementosGraficos.find(e => e.id === parseInt(elementoId));
        if (elementoGrafico && elementoGrafico.layer) {
            elementoGrafico.layer.bindPopup(`<b>VÁLVULA ${valvula.nombre}</b><br>Caudal: ${valvula.caudalTotal} L/h<br>Tipo: ${valvula.tipo}<br>Arrastra para mover`);
        }
        
        // Actualizar la configuración si está seleccionada
        if (elementoSeleccionado && elementoSeleccionado.id === parseInt(elementoId)) {
            actualizarConfiguracionElemento('valvula', elementoId);
        }
        
        actualizarResultados();
    }
}

function actualizarCabezal(elementoId, campo, valor) {
    const cabezal = cabezales.find(c => c.id === parseInt(elementoId));
    if (cabezal) {
        cabezal[campo] = valor;
        
        const elementoGrafico = elementosGraficos.find(e => e.id === parseInt(elementoId));
        if (elementoGrafico && elementoGrafico.layer) {
            elementoGrafico.layer.bindPopup(`<b>CABEZAL PRINCIPAL</b><br>Caudal: ${cabezal.caudalBomba} L/s<br>Filtros: ${cabezal.numeroFiltros} ${cabezal.tipoFiltros}<br>Arrastra para mover`);
        }
        
        // Actualizar la configuración si está seleccionada
        if (elementoSeleccionado && elementoSeleccionado.id === parseInt(elementoId)) {
            actualizarConfiguracionElemento('cabezal', elementoId);
        }
        
        actualizarResultados();
    }
}

function eliminarElemento(elementoId, tipo) {
    if (!confirm(`¿Estás seguro de eliminar este ${tipo}?`)) return;
    
    // Buscar el elemento en elementosGraficos
    const elementoIndex = elementosGraficos.findIndex(e => e.id === parseInt(elementoId));
    if (elementoIndex !== -1) {
        // Remover del mapa
        map.removeLayer(elementosGraficos[elementoIndex].layer);
        // Remover del array
        elementosGraficos.splice(elementoIndex, 1);
    }
    
    // Remover de arrays específicos
    if (tipo === 'valvula') {
        const valvulaIndex = valvulas.findIndex(v => v.id === parseInt(elementoId));
        if (valvulaIndex !== -1) {
            valvulas.splice(valvulaIndex, 1);
        }
    } else if (tipo === 'cabezal') {
        const cabezalIndex = cabezales.findIndex(c => c.id === parseInt(elementoId));
        if (cabezalIndex !== -1) {
            cabezales.splice(cabezalIndex, 1);
        }
    }
    
    // Deseleccionar si era el elemento seleccionado
    if (elementoSeleccionado && elementoSeleccionado.id === parseInt(elementoId)) {
        deseleccionarElemento();
    }
    
    // Actualizar resultados
    actualizarResultados();
    
    mostrarMensaje(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} eliminado`);
}

// ============================================
// FUNCIONES DE LIMPIEZA (ORIGINAL)
// ============================================

function limpiarDiseño() {
    if (!confirm('¿Estás seguro de limpiar todo el diseño?')) return;
    
    // Deseleccionar elemento si hay uno seleccionado
    deseleccionarElemento();
    
    // Limpiar tuberías
    tuberias.forEach(t => {
        if (t.marcadorInicio) map.removeLayer(t.marcadorInicio);
        if (t.marcadorFin) map.removeLayer(t.marcadorFin);
        if (t.linea) {
            // Remover etiquetas si existen
            if (t.linea.etiquetas) {
                t.linea.etiquetas.forEach(etiqueta => {
                    if (etiqueta && etiqueta.remove) {
                        etiqueta.remove();
                    }
                });
            }
            map.removeLayer(t.linea);
        }
        if (t.etiquetaLongitud) map.removeLayer(t.etiquetaLongitud);
    });
    tuberias = [];
    
    // Limpiar puntos
    puntosTuberias = [];
    
    // Limpiar elementos gráficos
    elementosGraficos.forEach(e => map.removeLayer(e.layer));
    elementosGraficos = [];
    
    // Limpiar arrays de válvulas y cabezales
    valvulas = [];
    cabezales = [];
    
    // Limpiar área
    drawnItems.clearLayers();
    areaTotal = 0;
    document.getElementById('areaDisplay').textContent = 'Área: 0 m²';
    
    // Resetear cálculos
    actualizarResumenTuberias();
    actualizarResultados();
    
    // Mostrar controles
    mostrarControlesMapa();
    
    // Resetear modo de dibujo
    modoDibujoTuberia = null;
    tuberiaActual = null;
    puntoInicioTuberia = null;
    modoAgregarElemento = null;
    
    // Resetear modo conexión
    modoConexion = false;
    tuberiaConexionTipo = null;
    puntoOrigenConexion = null;
    
    // Quitar clases activas
    document.querySelectorAll('.tuberia-btn').forEach(btn => {
        btn.classList.remove('activo');
        btn.classList.remove('modo-conexion-activo');
    });
    
    document.querySelectorAll('.elemento-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Ocultar instrucciones
    document.getElementById('instruccionesPrincipal').style.display = 'none';
    document.getElementById('instruccionesSecundaria').style.display = 'none';
    document.getElementById('instruccionesRegante').style.display = 'none';
    document.getElementById('instruccionesElementos').style.display = 'none';
    
    // Quitar resaltado de puntos
    quitarResaltadoPuntos();
    
    mostrarMensaje('Diseño limpiado completamente');
}

// ============================================
// FUNCIONES DE CONTROLES DEL MAPA (ORIGINAL)
// ============================================

function ocultarControlesMapa() {
    const controls = document.getElementById('mapaControls');
    if (controls) {
        controls.style.display = 'none';
        document.getElementById('showControlsBtn').style.display = 'block';
        document.getElementById('hideControlsBtn').style.display = 'none';
    }
}

function mostrarControlesMapa() {
    const controls = document.getElementById('mapaControls');
    if (controls) {
        controls.style.display = 'block';
        document.getElementById('showControlsBtn').style.display = 'none';
        document.getElementById('hideControlsBtn').style.display = 'none';
    }
}

function buscarUbicacion() {
    const query = document.getElementById('location-search').value;
    if (!query.trim()) {
        mostrarMensaje('Escribe una ubicación para buscar');
        return;
    }
    
    mostrarMensaje('Buscando ubicación...');
    
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                
                map.setView([lat, lon], 16);
                
                L.marker([lat, lon])
                    .addTo(map)
                    .bindPopup(`<b>${result.display_name}</b>`)
                    .openPopup();
                    
                mostrarMensaje('Ubicación encontrada');
            } else {
                mostrarMensaje('Ubicación no encontrada');
            }
        })
        .catch(error => {
            console.error('Error en la búsqueda:', error);
            mostrarMensaje('Error al buscar la ubicación');
        });
}

// ============================================
// FUNCIONES DE GALERÍA Y GUARDADO (SIMPLIFICADAS)
// ============================================

function loadSavedDesigns() {
    diseñosGuardados = JSON.parse(localStorage.getItem('diseñosRiego') || '[]');
    actualizarGaleriaDiseños();
}

function guardarDiseño() {
    const nombre = prompt('Nombre del diseño:', `Diseño_${new Date().toLocaleDateString()}`);
    if (!nombre) return;
    
    // Crear objeto de diseño simplificado
    const diseño = {
        id: Date.now(),
        nombre: nombre,
        fecha: new Date().toISOString(),
        area: areaTotal,
        tuberias: tuberias.length,
        valvulas: valvulas.length,
        elementos: elementosGraficos.filter(e => e.type === 'elemento').length
    };
    
    // Guardar en localStorage
    diseñosGuardados.push(diseño);
    localStorage.setItem('diseñosRiego', JSON.stringify(diseñosGuardados));
    
    mostrarMensaje(`"${nombre}" guardado`);
    actualizarGaleriaDiseños();
}

function actualizarGaleriaDiseños() {
    const galeriaDiv = document.getElementById('galeriaDiseños');
    if (!galeriaDiv) return;
    
    if (diseñosGuardados.length === 0) {
        galeriaDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No hay diseños guardados</p>';
        return;
    }
    
    let html = '';
    diseñosGuardados.forEach(diseño => {
        const fecha = new Date(diseño.fecha).toLocaleDateString();
        html += `
            <div class="diseño-item">
                <strong>${diseño.nombre}</strong>
                <div style="font-size: 0.8rem; color: #666;">
                    ${fecha} | ${diseño.tuberias} tuberías | ${diseño.valvulas} válvulas
                </div>
            </div>
        `;
    });
    
    galeriaDiv.innerHTML = html;
}

function exportarDiseño() {
    const diseño = {
        nombre: `Diseño_${Date.now()}`,
        fecha: new Date().toISOString(),
        area: areaTotal,
        tuberias: tuberias.length,
        valvulas: valvulas.length,
        elementos: elementosGraficos.filter(e => e.type === 'elemento').length,
        resumen: `Área: ${areaTotal.toFixed(2)} m², Tuberías: ${tuberias.length}, Válvulas: ${valvulas.length}`
    };
    
    const dataStr = JSON.stringify(diseño, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `diseño_riego_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarMensaje('Diseño exportado como JSON');
}

function importarDiseño(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const diseño = JSON.parse(e.target.result);
            mostrarMensaje(`Diseño "${diseño.nombre}" importado`);
            // Nota: Para una implementación completa, aquí deberías cargar el diseño
        } catch (error) {
            alert('Error al importar el diseño: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// ============================================
// FUNCIONES DE EXPORTACIÓN (SIMPLIFICADAS PARA MÓVILES)
// ============================================

function exportarPDF() {
    if (isTouch) {
        mostrarMensaje('Para exportar a PDF, por favor usa la versión de escritorio para mejor experiencia.', 5000);
        return;
    }
    
    // Implementación simplificada
    mostrarMensaje('Exportando a PDF...');
    // Aquí iría la lógica completa de exportación a PDF
}

function capturarDiseñoActual() {
    mostrarMensaje('Preparando captura del diseño...');
    // Implementación simplificada
    capturaTomada = true;
    mostrarMensaje('Captura lista para incluir en PDF');
}

function forzarRecaptura() {
    capturaTomada = false;
    mostrarMensaje('Listo para nueva captura');
}

// ============================================
// FUNCIONES DE MENSAJES
// ============================================

function mostrarMensaje(mensaje, duracion = 3000) {
    // Remover mensaje anterior
    const mensajeAnterior = document.querySelector('.mensaje-flotante');
    if (mensajeAnterior) {
        mensajeAnterior.remove();
    }
    
    // Crear nuevo mensaje
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = 'mensaje-flotante';
    mensajeDiv.innerHTML = `
        <div style="position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
                    background: rgba(0,0,0,0.85); color: white; padding: ${isTouch ? '15px 25px' : '12px 20px'};
                    border-radius: 8px; z-index: 10000; font-size: ${isTouch ? '1rem' : '0.9rem'};
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 90%;
                    text-align: center; backdrop-filter: blur(5px);">
            ${mensaje}
        </div>
    `;
    
    document.body.appendChild(mensajeDiv);
    
    // Auto-remover después de la duración
    setTimeout(() => {
        if (mensajeDiv.parentNode) {
            mensajeDiv.remove();
        }
    }, duracion);
}

// ============================================
// MANEJO DE ORIENTACIÓN EN MÓVILES
// ============================================

window.addEventListener('orientationchange', function() {
    setTimeout(() => {
        // Redimensionar el mapa
        map.invalidateSize();
        
        // Ajustar controles según orientación
        if (window.innerHeight > window.innerWidth) {
            // Portrait
            document.querySelector('.disenador-grid')?.style.setProperty('height', 'auto');
        } else {
            // Landscape
            document.querySelector('.disenador-grid')?.style.setProperty('height', '500px');
        }
    }, 300);
});

// ============================================
// INICIALIZACIÓN FINAL
// ============================================

// Asegurar que el mapa se redimensione correctamente
window.addEventListener('resize', function() {
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
});

// Inicializar mensaje de bienvenida
window.addEventListener('load', function() {
    if (isTouch) {
        setTimeout(() => {
            mostrarMensaje('Usa dos dedos para hacer zoom en el mapa', 4000);
        }, 1500);
    }
});