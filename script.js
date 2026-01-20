// ============================================
// VARIABLES GLOBALES (MEJORADAS)
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
let etiquetasPoligonos = []; // Nuevo: para gestionar etiquetas de polígonos
let etiquetasTuberias = []; // Nuevo: para gestionar etiquetas de tuberías
let ultimoScrollY = 0; // Para el menú móvil
let menuVisible = true; // Para el menú móvil

// Función para obtener el nombre de una válvula por su elementoId
function obtenerNombreValvulaPorElementoId(elementoId) {
    const valvula = valvulas.find(v => v.elementoId === elementoId);
    return valvula ? valvula.nombre : '';
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initMap();
    setupMobileNavigation();
    setupCadTabs();
    cargarDiseñosGuardados();
    setupEventListeners();
    setupTouchEvents();
    setupScrollHideMenu(); // Nuevo: configurar ocultar menú al scroll
});

function setupEventListeners() {
    // Botones del mapa
    document.getElementById('drawPolygonBtn')?.addEventListener('click', function() {
        if (currentDrawMode) {
            currentDrawMode.disable();
            currentDrawMode = null;
        }
        currentDrawMode = new L.Draw.Polygon(map, drawControl.options.draw.polygon);
        currentDrawMode.enable();
    });
    
    document.getElementById('measureBtn')?.addEventListener('click', function() {
        if (currentDrawMode) {
            currentDrawMode.disable();
            currentDrawMode = null;
        }
        currentDrawMode = new L.Draw.Polyline(map, drawControl.options.draw.polyline);
        currentDrawMode.enable();
    });
    
    document.getElementById('clearBtn')?.addEventListener('click', limpiarDiseño);
    document.getElementById('hideControlsBtn')?.addEventListener('click', ocultarControlesMapa);
    document.getElementById('showControlsBtn')?.addEventListener('click', mostrarControlesMapa);
    document.getElementById('searchBtn')?.addEventListener('click', buscarUbicacion);
    
    // Búsqueda por enter
    document.getElementById('location-search')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            buscarUbicacion();
        }
    });
}

// NUEVO: Configurar ocultar menú al scroll en móvil
function setupScrollHideMenu() {
    const topMenu = document.getElementById('topMenu');
    if (!topMenu) return;
    
    window.addEventListener('scroll', function() {
        if (window.innerWidth <= 768) { // Solo en móvil
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > ultimoScrollY && currentScrollY > 100) {
                // Scroll hacia abajo, ocultar menú
                if (menuVisible) {
                    topMenu.style.transform = 'translateY(-100%)';
                    topMenu.style.transition = 'transform 0.3s ease';
                    menuVisible = false;
                }
            } else if (currentScrollY < ultimoScrollY || currentScrollY <= 50) {
                // Scroll hacia arriba o en la parte superior, mostrar menú
                if (!menuVisible) {
                    topMenu.style.transform = 'translateY(0)';
                    menuVisible = true;
                }
            }
            
            ultimoScrollY = currentScrollY;
        }
    });
}

function setupMobileNavigation() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mainNav = document.getElementById('mainNav');
    
    if (mobileMenuBtn && mainNav) {
        mobileMenuBtn.addEventListener('click', function() {
            mainNav.classList.toggle('active');
            document.body.style.overflow = mainNav.classList.contains('active') ? 'hidden' : '';
        });
        
        // Cerrar menú al hacer clic en un enlace
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                mainNav.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
        
        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', function(e) {
            if (!mainNav.contains(e.target) && !mobileMenuBtn.contains(e.target) && mainNav.classList.contains('active')) {
                mainNav.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
}

function setupCadTabs() {
    document.querySelectorAll('.cad-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.cad-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.cad-tab-content').forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

function setupTouchEvents() {
    // Prevenir zoom con doble toque
    document.getElementById('map')?.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Habilitar scroll sobre el mapa
    document.getElementById('map')?.addEventListener('wheel', function(e) {
        e.stopPropagation();
    }, { passive: false });
}

// ============================================
// INICIALIZACIÓN DEL MAPA
// ============================================

function initMap() {
    const losMochis = [25.8133, -108.9719];
    
    // Configuración del mapa optimizada para móviles
    map = L.map('map', {
        center: losMochis,
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: false,
        dragging: true,
        tap: true,
        maxZoom: 19,
        minZoom: 3,
        inertia: true,
        inertiaDeceleration: 3000,
        inertiaMaxSpeed: 1500,
        easeLinearity: 0.2,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    // Inicializar arrays de etiquetas
    etiquetasPoligonos = [];
    etiquetasTuberias = [];
    
    // Configurar controles de dibujo
    drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            polygon: {
                allowIntersection: false,
                shapeOptions: {
                    color: '#008a45',
                    fillColor: '#00a553',
                    fillOpacity: 0.3,
                    weight: 2
                },
                showArea: true,
                metric: true
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
    
    // Eventos del mapa
    map.on('click', function(e) {
        if (modoAgregarElemento) {
            agregarElementoGrafico(e.latlng, modoAgregarElemento);
            modoAgregarElemento = null;
            document.getElementById('instruccionesElementos').style.display = 'none';
            
            document.querySelectorAll('.elemento-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            mostrarMensaje('Elemento agregado. Selecciona otro para agregar más.');
        } else {
            if (!e.originalEvent.ctrlKey) {
                deseleccionarElemento();
            }
        }
    });
    
    map.on(L.Draw.Event.CREATED, function(event) {
        const layer = event.layer;
        drawnItems.addLayer(layer);
        
        if (event.layerType === 'polygon') {
            calcularAreaPoligono(layer);
        } else if (event.layerType === 'polyline') {
            calcularLongitudPolilinea(layer);
        }
        
        if (currentDrawMode) {
            currentDrawMode.disable();
            currentDrawMode = null;
        }
    });
    
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
    
    map.on(L.Draw.Event.DELETED, function(event) {
        const layers = event.layers;
        layers.eachLayer(function(layer) {
            if (layer instanceof L.Polygon) {
                // Eliminar etiquetas asociadas al polígono
                eliminarEtiquetasPoligono(layer);
                
                areaTotal = 0;
                document.getElementById('areaDisplay').textContent = 'Área: 0 m²';
                actualizarResultados();
                mostrarControlesMapa();
            }
        });
    });
}

// NUEVA FUNCIÓN: Eliminar etiquetas de polígono
function eliminarEtiquetasPoligono(polygon) {
    if (polygon.etiquetaArea) {
        map.removeLayer(polygon.etiquetaArea);
        polygon.etiquetaArea = null;
    }
    
    if (polygon.etiquetasLados) {
        polygon.etiquetasLados.forEach(etiqueta => {
            if (etiqueta && etiqueta.remove) {
                map.removeLayer(etiqueta);
            }
        });
        polygon.etiquetasLados = [];
    }
    
    // Eliminar del array global
    etiquetasPoligonos = etiquetasPoligonos.filter(etiqueta => 
        etiqueta.polygonId !== polygon._leaflet_id
    );
}

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

function getGrosorTuberia(tipo, diametro) {
    const grosoresBase = {
        'principal': 8,
        'secundaria': 6,
        'regante': 4
    };
    
    const base = grosoresBase[tipo] || 4;
    const diametroNum = parseFloat(diametro);
    
    if (tipo === 'principal') {
        return base + (diametroNum * 1.2);
    } else if (tipo === 'secundaria') {
        return base + (diametroNum * 0.8);
    } else {
        return base + (diametroNum * 0.5);
    }
}

// MODIFICADO: Cambiar colores de tuberías
function getColorTuberia(tipo) {
    const colores = {
        'principal': '#ff0000', // ROJO
        'secundaria': '#0000ff', // AZUL
        'regante': '#00ff00' // VERDE
    };
    return colores[tipo] || '#000000';
}

function calcularAreaPoligono(polygon) {
    const latlngs = polygon.getLatLngs()[0];
    areaTotal = L.GeometryUtil.geodesicArea(latlngs);
    
    // Calcular perímetro
    let perimetro = 0;
    for (let i = 0; i < latlngs.length; i++) {
        const puntoActual = latlngs[i];
        const puntoSiguiente = latlngs[(i + 1) % latlngs.length];
        perimetro += puntoActual.distanceTo(puntoSiguiente);
    }
    
    // Calcular centro para la etiqueta
    const centro = calcularCentroPoligono(latlngs);
    
    // Crear o actualizar etiqueta del polígono (con controles)
    if (!polygon.etiquetaArea) {
        polygon.etiquetaArea = crearEtiquetaPoligono(centro, areaTotal, perimetro, polygon);
        polygon.etiquetaArea.addTo(map);
    } else {
        polygon.etiquetaArea.setLatLng(centro);
        actualizarContenidoEtiquetaPoligono(polygon.etiquetaArea, areaTotal, perimetro);
    }
    
    // Calcular medidas de cada lado y agregar etiquetas (con controles)
    actualizarEtiquetasLados(polygon, latlngs);
    
    // Actualizar display principal
    document.getElementById('areaDisplay').textContent = 
        `Área: ${areaTotal.toFixed(2)} m² (${(areaTotal / 10000).toFixed(2)} ha) | Perímetro: ${perimetro.toFixed(2)} m`;
    
    ocultarControlesMapa();
    actualizarResultados();
    
    return { area: areaTotal, perimetro: perimetro };
}

// NUEVA FUNCIÓN: Crear etiqueta de polígono con controles
function crearEtiquetaPoligono(centro, area, perimetro, polygon) {
    const polygonId = polygon._leaflet_id || Date.now();
    
    const etiqueta = L.marker(centro, {
        icon: L.divIcon({
            className: 'etiqueta-poligono interactiva',
            html: crearHTMLMedidasPoligono(area, perimetro, polygonId),
            iconSize: [200, 80],
            iconAnchor: [100, 40]
        }),
        draggable: true,
        interactive: true
    });
    
    // Almacenar referencia
    etiqueta.polygonId = polygonId;
    etiqueta.type = 'polygon-label';
    
    // Guardar en array global
    etiquetasPoligonos.push({
        id: polygonId,
        marker: etiqueta,
        polygon: polygon,
        visible: true,
        fontSize: 11,
        rotation: 0
    });
    
    // Configurar eventos de arrastre
    etiqueta.on('dragend', function(e) {
        const nuevaPos = e.target.getLatLng();
        // Actualizar posición en el array
        const etiquetaIndex = etiquetasPoligonos.findIndex(e => e.id === polygonId);
        if (etiquetaIndex !== -1) {
            etiquetasPoligonos[etiquetaIndex].position = nuevaPos;
        }
    });
    
    // Configurar clic derecho para menú contextual
    etiqueta.on('contextmenu', function(e) {
        e.originalEvent.preventDefault();
        mostrarMenuContextualEtiqueta(e.latlng, polygonId, 'polygon');
    });
    
    return etiqueta;
}

// NUEVA FUNCIÓN: Actualizar contenido de etiqueta de polígono
function actualizarContenidoEtiquetaPoligono(etiquetaMarker, area, perimetro) {
    const etiquetaData = etiquetasPoligonos.find(e => e.marker === etiquetaMarker);
    if (!etiquetaData) return;
    
    etiquetaMarker.setIcon(L.divIcon({
        className: 'etiqueta-poligono interactiva',
        html: crearHTMLMedidasPoligono(area, perimetro, etiquetaData.id),
        iconSize: [200, 80],
        iconAnchor: [100, 40]
    }));
}

// NUEVA FUNCIÓN: HTML para etiquetas de polígono con ID
function crearHTMLMedidasPoligono(area, perimetro, polygonId) {
    const etiquetaData = etiquetasPoligonos.find(e => e.id === polygonId);
    const fontSize = etiquetaData ? etiquetaData.fontSize : 11;
    const rotation = etiquetaData ? etiquetaData.rotation : 0;
    
    return `
        <div id="etiqueta-polygon-${polygonId}" 
             style="background: rgba(255, 255, 255, 0.95); padding: 10px; border-radius: 8px; 
                    border: 2px solid #008a45; box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
                    text-align: center; min-width: 180px; cursor: move;
                    font-size: ${fontSize}px; transform: rotate(${rotation}deg);
                    transform-origin: center;">
            <div style="font-weight: bold; color: #008a45; margin-bottom: 5px;">MEDIDAS DEL TERRENO</div>
            <div style="color: #333;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span>Área:</span>
                    <span style="font-weight: bold;">${area.toFixed(1)} m²</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span>Hectáreas:</span>
                    <span style="font-weight: bold;">${(area / 10000).toFixed(3)} ha</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Perímetro:</span>
                    <span style="font-weight: bold;">${perimetro.toFixed(1)} m</span>
                </div>
            </div>
        </div>
    `;
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
// FUNCIONES DE ELEMENTOS (MEJORADAS)
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
    const elemento = L.marker(latlng, {
        icon: L.divIcon({
            className: 'elemento-grafico',
            html: `<div style="background: ${colores[tipo]}; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas ${iconos[tipo]}"></i></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        }),
        draggable: true
    }).addTo(map);
    
    let popupContent = `<b>${tipo.toUpperCase()}</b><br>Arrastra para mover`;
    let nombreValvula = '';
    
    if (tipo === 'valvula') {
        nombreValvula = generarNombreValvula();
        const valvulaData = {
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
        };
        valvulas.push(valvulaData);
        
        popupContent = `<b>VÁLVULA ${nombreValvula}</b><br>Caudal: 400 L/h<br>Arrastra para mover`;
        
        // Actualizar ícono con el nombre
        actualizarIconoElemento(elementoId, nombreValvula);
    }
    
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
    
    elemento.on('click', function(e) {
        if (e.originalEvent.ctrlKey) return;
        
        seleccionarElemento(elementoId, tipo);
        e.originalEvent.stopPropagation();
    });
    
    elemento.on('dragend', function(e) {
        const nuevaPos = e.target.getLatLng();
        const elementoIndex = elementosGraficos.findIndex(e => e.layer === elemento);
        if (elementoIndex !== -1) {
            elementosGraficos[elementoIndex].posicion = nuevaPos;
            
            if (tipo === 'valvula') {
                const valvulaIndex = valvulas.findIndex(v => v.elementoId === elementosGraficos[elementoIndex].id);
                if (valvulaIndex !== -1) {
                    valvulas[valvulaIndex].posicion = nuevaPos;
                    
                    if (elementoSeleccionado && elementoSeleccionado.id === elementoId) {
                        actualizarConfiguracionElemento(tipo, elementoId);
                    }
                }
            } else if (tipo === 'cabezal') {
                const cabezalIndex = cabezales.findIndex(c => c.elementoId === elementosGraficos[elementoIndex].id);
                if (cabezalIndex !== -1) {
                    cabezales[cabezalIndex].posicion = nuevaPos;
                    
                    if (elementoSeleccionado && elementoSeleccionado.id === elementoId) {
                        actualizarConfiguracionElemento(tipo, elementoId);
                    }
                }
            }
        }
    });
    
    elementosGraficos.push({
        id: elementoId,
        type: 'elemento',
        layer: elemento,
        tipo: tipo,
        posicion: latlng,
        nombre: tipo === 'valvula' ? nombreValvula : (tipo === 'cabezal' ? 'Cabezal' : tipo)
    });
    
    if (tipo === 'valvula' || tipo === 'cabezal') {
        seleccionarElemento(elementoId, tipo);
    }
    
    actualizarResultados();
    
    return elementoId;
}

function actualizarIconoElemento(elementoId, nombre) {
    const elemento = elementosGraficos.find(e => e.id === elementoId);
    if (!elemento || !elemento.layer) {
        console.warn(`No se pudo actualizar ícono: elemento ${elementoId} no encontrado`);
        return;
    }
    
    const tipo = elemento.tipo;
    const colores = {
        'cabezal': '#1772af',
        'purgaterminal': '#ff9f43',
        'tomagua': '#00a553',
        'valvula': '#ff6b6b',
        'filtro': '#4ecdc4'
    };
    
    const color = colores[tipo] || '#000000';
    
    // Determinar qué texto mostrar en el ícono
    let texto = '';
    if (tipo === 'valvula') {
        // Para válvulas, usar el nombre proporcionado o buscar en el array de válvulas
        if (nombre) {
            texto = nombre;
        } else {
            // Buscar el nombre en el array de válvulas
            const valvula = valvulas.find(v => v.elementoId === elementoId);
            texto = valvula ? valvula.nombre : 'V';
        }
        // Si el nombre es muy largo, truncarlo
        if (texto.length > 3) {
            texto = texto.substring(0, 3);
        }
    } else {
        // Para otros elementos, usar la primera letra del tipo
        texto = tipo.charAt(0).toUpperCase();
    }
    
    elemento.layer.setIcon(L.divIcon({
        className: 'elemento-grafico',
        html: `<div style="background: ${color}; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">
                ${texto}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    }));
}

function seleccionarElemento(elementoId, tipo) {
    if (elementoSeleccionado && elementoSeleccionado.layer) {
        const icon = elementoSeleccionado.layer.getElement();
        if (icon) {
            icon.style.boxShadow = '';
            icon.style.border = '';
        }
    }
    
    const elemento = elementosGraficos.find(e => e.id === elementoId);
    if (!elemento) {
        console.warn(`Elemento con ID ${elementoId} no encontrado`);
        return;
    }
    
    elementoSeleccionado = elemento;
    
    const icon = elemento.layer.getElement();
    if (icon) {
        icon.style.boxShadow = '0 0 0 3px #ff9f43';
        icon.style.border = '2px solid white';
    }
    
    elemento.layer.openPopup();
    
    // Asegurar que estamos en la pestaña correcta
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
    
    // Forzar actualización de configuración del elemento
    actualizarConfiguracionElemento(tipo, elementoId.toString());
    
    let nombreElemento = tipo;
    if (tipo === 'valvula') {
        const valvula = valvulas.find(v => v.elementoId === elementoId);
        if (valvula) {
            nombreElemento = `Válvula ${valvula.nombre}`;
            // Asegurar que el ícono muestra el nombre correcto
            actualizarIconoElemento(elementoId, valvula.nombre);
        }
    } else if (tipo === 'cabezal') {
        nombreElemento = 'Cabezal';
    }
    
    mostrarMensaje(`${nombreElemento} seleccionado. Puedes modificar sus propiedades en el panel.`);
}

function eliminarElemento(elementoId, tipo) {
    if (!confirm(`¿Estás seguro de eliminar este ${tipo}?`)) return;
    
    const elementoIndex = elementosGraficos.findIndex(e => e.id === parseInt(elementoId));
    if (elementoIndex !== -1) {
        map.removeLayer(elementosGraficos[elementoIndex].layer);
        elementosGraficos.splice(elementoIndex, 1);
    }
    
    if (tipo === 'valvula') {
        const valvulaIndex = valvulas.findIndex(v => v.elementoId === parseInt(elementoId));
        if (valvulaIndex !== -1) {
            valvulas.splice(valvulaIndex, 1);
        }
    } else if (tipo === 'cabezal') {
        const cabezalIndex = cabezales.findIndex(c => c.elementoId === parseInt(elementoId));
        if (cabezalIndex !== -1) {
            cabezales.splice(cabezalIndex, 1);
        }
    }
    
    if (elementoSeleccionado && elementoSeleccionado.id === parseInt(elementoId)) {
        deseleccionarElemento();
    }
    
    actualizarResultados();
    
    mostrarMensaje(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} eliminado`);
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

function actualizarConfiguracionElemento(tipo, elementoId = null) {
    const configDiv = document.getElementById('elementoConfig');
    
    // Si hay un elemento seleccionado y tenemos un elementoId,
    // usamos el tipo del elemento seleccionado, no el que se pasa como parámetro
    if (elementoId && elementoSeleccionado) {
        // Si el elementoId coincide con el elemento seleccionado, usamos su tipo
        if (elementoSeleccionado.id === parseInt(elementoId)) {
            tipo = elementoSeleccionado.tipo;
        }
    } else if (elementoSeleccionado && !elementoId) {
        // Si no hay elementoId pero hay elemento seleccionado, usamos su tipo
        tipo = elementoSeleccionado.tipo;
        elementoId = elementoSeleccionado.id;
    }
    
    if (tipo === 'valvula' && elementoId) {
        const valvula = valvulas.find(v => v.elementoId === parseInt(elementoId));
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
        const cabezal = cabezales.find(c => c.elementoId === parseInt(elementoId));
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

function deseleccionarElemento() {
    if (elementoSeleccionado && elementoSeleccionado.layer) {
        const icon = elementoSeleccionado.layer.getElement();
        if (icon) {
            icon.style.boxShadow = '';
            icon.style.border = '';
        }
        
        elementoSeleccionado.layer.closePopup();
    }
    
    elementoSeleccionado = null;
    
    const configDiv = document.getElementById('elementoConfig');
    configDiv.innerHTML = `
        <h4>Configuración de Elemento</h4>
        <p>Selecciona un elemento en el mapa o coloca uno nuevo para configurarlo.</p>
        <p>Puedes agregar:</p>
        <ul style="margin-left: 20px;">
            <li>Válvulas de control</li>
            <li>Cabezales de bombeo</li>
            <li>Purgas terminales</li>
            <li>Tomas de agua</li>
            <li>Filtros</li>
        </ul>
    `;
}

function actualizarValvula(elementoId, campo, valor) {
    const valvula = valvulas.find(v => v.elementoId === parseInt(elementoId));
    if (valvula) {
        valvula[campo] = valor;
        
        if (campo === 'caudalEmisor' || campo === 'numeroEmisores') {
            valvula.caudalTotal = valvula.caudalEmisor * valvula.numeroEmisores;
        }

        if (campo === 'nombre') {
            // Si cambia el nombre, actualizar el ícono
            actualizarIconoElemento(elementoId, valor);
        }
        
        const elementoGrafico = elementosGraficos.find(e => e.id === parseInt(elementoId));
        if (elementoGrafico && elementoGrafico.layer) {
            // Actualizar el popup con el nuevo nombre
            elementoGrafico.layer.bindPopup(`<b>VÁLVULA ${valvula.nombre}</b><br>Caudal: ${valvula.caudalTotal} L/h<br>Tipo: ${valvula.tipo}<br>Arrastra para mover`);
            
            // Actualizar el nombre en el array de elementos gráficos
            elementoGrafico.nombre = valvula.nombre;
        }
        
        if (elementoSeleccionado && elementoSeleccionado.id === parseInt(elementoId)) {
            actualizarConfiguracionElemento('valvula', elementoId);
        }
        
        actualizarResultados();
    }
}

function actualizarCabezal(elementoId, campo, valor) {
    const cabezal = cabezales.find(c => c.elementoId === parseInt(elementoId));
    if (cabezal) {
        cabezal[campo] = valor;
        
        const elementoGrafico = elementosGraficos.find(e => e.id === parseInt(elementoId));
        if (elementoGrafico && elementoGrafico.layer) {
            elementoGrafico.layer.bindPopup(`<b>CABEZAL PRINCIPAL</b><br>Caudal: ${cabezal.caudalBomba} L/s<br>Filtros: ${cabezal.numeroFiltros} ${cabezal.tipoFiltros}<br>Arrastra para mover`);
        }
        
        if (elementoSeleccionado && elementoSeleccionado.id === parseInt(elementoId)) {
            actualizarConfiguracionElemento('cabezal', elementoId);
        }
        
        actualizarResultados();
    }
}

function iniciarModoElemento(tipoElemento) {
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
    
    document.querySelectorAll('.elemento-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const elementoBtn = document.querySelector(`.elemento-btn[data-elemento="${tipoElemento}"]`);
    if (elementoBtn) {
        elementoBtn.classList.add('active');
    }
    
    modoAgregarElemento = tipoElemento;
    document.getElementById('instruccionesElementos').style.display = 'block';
    mostrarMensaje(`Modo elemento activado. Haz clic en el mapa para colocar el ${tipoElemento}.`);
    
    actualizarConfiguracionElemento(tipoElemento);
}

// ============================================
// FUNCIONES DE TUBERÍAS
// ============================================

function iniciarModoTuberia(tipoTuberia) {
    if (currentDrawMode) {
        currentDrawMode.disable();
        currentDrawMode = null;
    }
    
    modoConexion = false;
    tuberiaConexionTipo = null;
    puntoOrigenConexion = null;
    
    modoAgregarElemento = null;
    document.getElementById('instruccionesElementos').style.display = 'none';
    document.querySelectorAll('.elemento-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
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
    
    mostrarMensaje(`Modo dibujo tubería ${tipoTuberia} (${diametro}"). Haz clic en el mapa para establecer el punto de inicio.`);
    
    configurarEventosDibujoTuberia(tipoTuberia, diametro, tipoMaterial);
}

function configurarEventosDibujoTuberia(tipoTuberia, diametro, tipoMaterial) {
    map.off('click');
    
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
        
        mostrarMensaje(`Punto de inicio establecido. Ahora haz clic para establecer el punto final.`);
        
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
    
    // Crear etiqueta de tubería con controles
    const etiqueta = crearEtiquetaTuberia(centro, longitud, diametro, tipoTuberia, tuberiaActual.id);
    etiqueta.addTo(map);
    
    tuberiaActual.etiquetaLongitud = etiqueta;
    
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
    
    restaurarEventoClickMapa();
    
    tuberiaActual = null;
    
    const instruccionesId = tipoTuberia === 'principal' ? 'instruccionesPrincipal' : 
                           tipoTuberia === 'secundaria' ? 'instruccionesSecundaria' : 'instruccionesRegante';
    document.getElementById(instruccionesId).style.display = 'none';
    
    const botonId = tipoTuberia === 'principal' ? 'btnTuberiaPrincipal' : 
                   tipoTuberia === 'secundaria' ? 'btnTuberiaSecundaria' : 'btnTuberiaRegante';
    document.getElementById(botonId).classList.remove('activo');
    
    mostrarMensaje(`Tubería ${tipoTuberia} (${diametro}") creada. Longitud: ${longitud.toFixed(1)} metros`);
}

// NUEVA FUNCIÓN: Crear etiqueta de tubería con controles
function crearEtiquetaTuberia(centro, longitud, diametro, tipoTuberia, tuberiaId) {
    const etiqueta = L.marker(centro, {
        icon: L.divIcon({
            className: 'tuberia-label interactiva',
            html: crearHTMLMedidasTuberia(longitud, diametro, tipoTuberia, tuberiaId),
            iconSize: [100, 30],
            iconAnchor: [50, 15]
        }),
        draggable: true,
        interactive: true
    });
    
    // Almacenar referencia
    etiqueta.tuberiaId = tuberiaId;
    etiqueta.type = 'tuberia-label';
    
    // Guardar en array global
    etiquetasTuberias.push({
        id: tuberiaId,
        marker: etiqueta,
        longitud: longitud,
        diametro: diametro,
        tipoTuberia: tipoTuberia,
        visible: true,
        fontSize: 9,
        rotation: 0,
        position: centro
    });
    
    // Configurar eventos de arrastre
    etiqueta.on('dragend', function(e) {
        const nuevaPos = e.target.getLatLng();
        // Actualizar posición en el array
        const etiquetaIndex = etiquetasTuberias.findIndex(e => e.id === tuberiaId);
        if (etiquetaIndex !== -1) {
            etiquetasTuberias[etiquetaIndex].position = nuevaPos;
        }
    });
    
    // Configurar clic derecho para menú contextual
    etiqueta.on('contextmenu', function(e) {
        e.originalEvent.preventDefault();
        mostrarMenuContextualEtiqueta(e.latlng, tuberiaId, 'tuberia');
    });
    
    return etiqueta;
}

// NUEVA FUNCIÓN: HTML para etiquetas de tubería con controles
function crearHTMLMedidasTuberia(longitud, diametro, tipoTuberia, tuberiaId) {
    const etiquetaData = etiquetasTuberias.find(e => e.id === tuberiaId);
    const fontSize = etiquetaData ? etiquetaData.fontSize : 9;
    const rotation = etiquetaData ? etiquetaData.rotation : 0;
    
    return `
        <div id="etiqueta-tuberia-${tuberiaId}" 
             style="background: white; padding: 3px 8px; border: 1px solid #ccc; 
                    border-radius: 3px; font-weight: bold; text-align: center; 
                    line-height: 1.2; cursor: move; font-size: ${fontSize}px;
                    transform: rotate(${rotation}deg); transform-origin: center;">
            ${longitud.toFixed(1)}m - ${diametro}"
        </div>
    `;
}

// NUEVA FUNCIÓN: Actualizar contenido de etiqueta de tubería
function actualizarContenidoEtiquetaTuberia(etiquetaMarker, longitud, diametro) {
    const etiquetaData = etiquetasTuberias.find(e => e.marker === etiquetaMarker);
    if (!etiquetaData) return;
    
    etiquetaMarker.setIcon(L.divIcon({
        className: 'tuberia-label interactiva',
        html: crearHTMLMedidasTuberia(longitud, diametro, etiquetaData.tipoTuberia, etiquetaData.id),
        iconSize: [100, 30],
        iconAnchor: [50, 15]
    }));
}

function restaurarEventoClickMapa() {
    map.off('click');
    
    map.on('click', function(e) {
        if (modoAgregarElemento) {
            agregarElementoGrafico(e.latlng, modoAgregarElemento);
            modoAgregarElemento = null;
            document.getElementById('instruccionesElementos').style.display = 'none';
            
            document.querySelectorAll('.elemento-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            mostrarMensaje('Elemento agregado. Selecciona otro para agregar más.');
        } else {
            if (!e.originalEvent.ctrlKey) {
                deseleccionarElemento();
            }
        }
    });
}

function crearMarcadorTuberia(latlng, tipo, tipoTuberia, diametro) {
    const color = getColorTuberia(tipoTuberia);
    const tamanos = {
        'principal': 18,
        'secundaria': 15,
        'regante': 12
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
    
    linea.editing.enable();
    
    const distancia = puntoInicio.distanceTo(puntoFin);
    const angulo = calcularAngulo(puntoInicio, puntoFin);
    
    const centro = L.latLng(
        (puntoInicio.lat + puntoFin.lat) / 2,
        (puntoInicio.lng + puntoFin.lng) / 2
    );
    

    
    linea.on('edit', function(e) {
        const latlngs = e.target.getLatLngs();
        const longitudTotal = calcularLongitudTotal(latlngs);
        
        if (latlngs.length > 2) {
            mostrarInfoPolilinea(linea, latlngs, diametro, longitudTotal);
        } else {
            const angulo = calcularAngulo(latlngs[0], latlngs[1]);
            
            const centro = L.latLng(
                (latlngs[0].lat + latlngs[1].lat) / 2,
                (latlngs[0].lng + latlngs[1].lng) / 2
            );
            
            if (linea.etiquetas && linea.etiquetas[0]) {
                linea.etiquetas[0].setLatLng(centro);
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
            
            const anguloStd = calcularAnguloCercano(angulo);
            actualizarPanelInfoSegmento(0, longitudTotal, angulo, anguloStd);
        }
        
        const tuberiaEnArray = tuberias.find(t => t.linea === linea);
        if (tuberiaEnArray) {
            tuberiaEnArray.longitud = longitudTotal;
            tuberiaEnArray.puntoInicio = latlngs[0];
            tuberiaEnArray.puntoFin = latlngs[latlngs.length - 1];
            tuberiaEnArray.puntosIntermedios = latlngs.slice(1, -1);
            
            if (tuberiaEnArray.etiquetaLongitud) {
                actualizarContenidoEtiquetaTuberia(tuberiaEnArray.etiquetaLongitud, longitudTotal, tuberiaEnArray.diametro);
            }
            
            actualizarResumenTuberias();
            actualizarResultados();
        }
    });
    
    return linea;
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

function calcularAnguloCercano(angulo) {
    const angulosEstándar = [0, 11.25, 22.5, 45, 90, 135, 180, 225, 270, 315, 360];
    const angulosCodos = [11.25, 22.5, 45, 90];
    const angulosTees = [90];
    
    let anguloCercano = angulosEstándar[0];
    let diferenciaMinima = Math.abs(angulo - angulosEstándar[0]);
    
    for (const anguloStd of angulosEstándar) {
        const diferencia = Math.abs(angulo - anguloStd);
        if (diferencia < diferenciaMinima) {
            diferenciaMinima = diferencia;
            anguloCercano = anguloStd;
        }
    }
    
    return {
        angulo: anguloCercano,
        diferencia: diferenciaMinima,
        esExacto: diferenciaMinima < 0.1,
        tipoAccesorio: anguloCercano === 90 ? 'Tee' : 
                       angulosCodos.includes(anguloCercano) ? 'Codo' : 
                       'Recto'
    };
}

function calcularLongitudTotal(latlngs) {
    let longitud = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
        longitud += latlngs[i].distanceTo(latlngs[i + 1]);
    }
    return longitud;
}

function mostrarInfoPolilinea(linea, latlngs, diametro, longitudTotal = null) {
    if (longitudTotal === null) {
        longitudTotal = calcularLongitudTotal(latlngs);
    }
    
    if (linea.etiquetas) {
        linea.etiquetas.forEach(etiqueta => {
            if (etiqueta && etiqueta.remove) {
                etiqueta.remove();
            }
        });
    }
    linea.etiquetas = [];
    
    let longitudAcumulada = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
        const segmento = {
            inicio: latlngs[i],
            fin: latlngs[i+1]
        };
        const longitudSegmento = latlngs[i].distanceTo(latlngs[i+1]);
        longitudAcumulada += longitudSegmento;
        
        actualizarInfoSegmento(linea, segmento, i, diametro, longitudSegmento, longitudAcumulada, longitudTotal);
    }
}

function actualizarInfoSegmento(linea, segmento, indice, diametro, longitudSegmento, longitudAcumulada, longitudTotal) {
    const distancia = longitudSegmento;
    const angulo = calcularAngulo(segmento.inicio, segmento.fin);
    const anguloStd = calcularAnguloCercano(angulo);
    
    const centro = L.latLng(
        (segmento.inicio.lat + segmento.fin.lat) / 2,
        (segmento.inicio.lng + segmento.fin.lng) / 2
    );
    
    const desplazamiento = 0.00002 * (indice + 1);
    const centroDesplazado = L.latLng(
        centro.lat + desplazamiento,
        centro.lng + desplazamiento
    );
    
    if (!linea.etiquetas) linea.etiquetas = [];
    
    if (linea.etiquetas[indice]) {
        linea.etiquetas[indice].setLatLng(centroDesplazado);
        linea.etiquetas[indice].setIcon(L.divIcon({
            className: 'tuberia-label',
            html: `<div style="background: white; padding: 3px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold; text-align: center; line-height: 1.2;">
                   ${distancia.toFixed(1)}m (${longitudAcumulada.toFixed(1)}/${longitudTotal.toFixed(1)}m)<br>
                   <small style="color: #666;">${angulo.toFixed(1)}°</small>
                   ${anguloStd.diferencia < 5 ? `<br><small style="color: #00a553;">Codo ${anguloStd.angulo}°</small>` : ''}
                   </div>`,
            iconSize: [90, 40],
            iconAnchor: [45, 20]
        }));
    } else {
        const etiqueta = L.marker(centroDesplazado, {
            icon: L.divIcon({
                className: 'tuberia-label',
                html: `<div style="background: white; padding: 3px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold; text-align: center; line-height: 1.2;">
                       ${distancia.toFixed(1)}m (${longitudAcumulada.toFixed(1)}/${longitudTotal.toFixed(1)}m)<br>
                       <small style="color: #666;">${angulo.toFixed(1)}°</small>
                       ${anguloStd.diferencia < 5 ? `<br><small style="color: #00a553;">Codo ${anguloStd.angulo}°</small>` : ''}
                       </div>`,
                iconSize: [90, 40],
                iconAnchor: [45, 20]
            })
        }).addTo(map);
        
        linea.etiquetas[indice] = etiqueta;
    }
    
    actualizarPanelInfoSegmento(indice, distancia, angulo, anguloStd, longitudAcumulada, longitudTotal);
    
    return linea.etiquetas[indice];
}

function actualizarPanelInfoSegmento(indice, distancia, angulo, anguloStd, longitudAcumulada = null, longitudTotal = null) {
    let panelInfo = document.getElementById('panel-info-segmentos');
    if (!panelInfo) {
        panelInfo = document.createElement('div');
        panelInfo.id = 'panel-info-segmentos';
        panelInfo.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            max-width: 320px;
            max-height: 300px;
            overflow-y: auto;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            z-index: 1000;
            font-size: 0.9rem;
        `;
        document.body.appendChild(panelInfo);
    }
    
    panelInfo.style.display = 'block';
    
    const contenido = document.getElementById('contenido-info-segmentos') || document.createElement('div');
    contenido.id = 'contenido-info-segmentos';
    
    let html = `<h4 style="margin: 0 0 10px 0; color: #333;">Información de Segmentos</h4>`;
    
    html += `
        <div style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
            <strong>Segmento ${indice + 1}</strong><br>
            <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                <span>Longitud segmento:</span>
                <span>${distancia.toFixed(2)} m</span>
            </div>`;
    
    if (longitudAcumulada !== null && longitudTotal !== null) {
        html += `
            <div style="display: flex; justify-content: space-between;">
                <span>Longitud acumulada:</span>
                <span>${longitudAcumulada.toFixed(2)} m</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Longitud total:</span>
                <span>${longitudTotal.toFixed(2)} m</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Porcentaje:</span>
                <span>${(longitudAcumulada/longitudTotal*100).toFixed(1)}%</span>
            </div>`;
    }
    
    html += `
            <div style="display: flex; justify-content: space-between;">
                <span>Ángulo:</span>
                <span>${angulo.toFixed(1)}°</span>
            </div>
            ${anguloStd.diferencia < 5 ? `
            <div style="display: flex; justify-content: space-between; color: #00a553;">
                <span>Accesorio sugerido:</span>
                <span>${anguloStd.tipoAccesorio} ${anguloStd.angulo}°</span>
            </div>
            ` : ''}
        </div>
        <button onclick="document.getElementById('panel-info-segmentos').style.display='none'" 
                style="width: 100%; padding: 5px 10px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
            Cerrar
        </button>
    `;
    
    contenido.innerHTML = html;
    panelInfo.innerHTML = '';
    panelInfo.appendChild(contenido);
    
    clearTimeout(panelInfo.timeout);
    panelInfo.timeout = setTimeout(() => {
        panelInfo.style.display = 'none';
    }, 10000);
}

function eliminarTuberia(tuberiaId) {
    const tuberiaIndex = tuberias.findIndex(t => t.id === parseInt(tuberiaId));
    if (tuberiaIndex === -1) return;
    
    const tuberia = tuberias[tuberiaIndex];
    
    if (!confirm(`¿Eliminar tubería ${tuberia.tipo} (${tuberia.diametro}")?`)) return;
    
    if (tuberia.marcadorInicio) map.removeLayer(tuberia.marcadorInicio);
    if (tuberia.marcadorFin) map.removeLayer(tuberia.marcadorFin);
    if (tuberia.linea) {
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
    
    // Eliminar etiqueta del array global
    etiquetasTuberias = etiquetasTuberias.filter(e => e.id !== tuberia.id);
    
    puntosTuberias = puntosTuberias.filter(p => p.tuberiaId !== tuberia.id);
    
    tuberias.splice(tuberiaIndex, 1);
    
    actualizarResumenTuberias();
    actualizarResultados();
    
    mostrarMensaje(`Tubería eliminada`);
}

function editarTuberia(tuberiaId) {
    const tuberiaIndex = tuberias.findIndex(t => t.id === parseInt(tuberiaId));
    if (tuberiaIndex === -1) return;
    
    const tuberia = tuberias[tuberiaIndex];
    
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
                <button onclick="document.getElementById('dialogEditarTuberia').remove()" 
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
    
    const dialogAnterior = document.getElementById('dialogEditarTuberia');
    if (dialogAnterior) dialogAnterior.remove();
    
    const dialogDiv = document.createElement('div');
    dialogDiv.innerHTML = dialogHtml;
    document.body.appendChild(dialogDiv);
    
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;';
    overlay.id = 'overlayEditarTuberia';
    document.body.appendChild(overlay);
}

function confirmarEdicionTuberia(tuberiaId) {
    const nuevoDiámetro = document.getElementById('nuevoDiametro').value;
    
    document.getElementById('dialogEditarTuberia').remove();
    document.getElementById('overlayEditarTuberia').remove();
    
    const tuberiaIndex = tuberias.findIndex(t => t.id === parseInt(tuberiaId));
    if (tuberiaIndex === -1) return;
    
    const tuberia = tuberias[tuberiaIndex];
    
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
    
    tuberia.diametro = nuevoDiámetro;
    tuberia.grosor = getGrosorTuberia(tuberia.tipo, nuevoDiámetro);
    
    if (tuberia.linea) {
        tuberia.linea.setStyle({
            weight: tuberia.grosor
        });
    }
    
    if (tuberia.linea && tuberia.linea.etiquetas) {
        const latlngs = tuberia.linea.getLatLngs();
        
        if (latlngs.length === 2) {
            const distancia = latlngs[0].distanceTo(latlngs[1]);
            const angulo = calcularAngulo(latlngs[0], latlngs[1]);
            
            const centro = L.latLng(
                (latlngs[0].lat + latlngs[1].lat) / 2,
                (latlngs[0].lng + latlngs[1].lng) / 2
            );
            
            if (tuberia.linea.etiquetas[0]) {
                tuberia.linea.etiquetas[0].setLatLng(centro);
                tuberia.linea.etiquetas[0].setIcon(L.divIcon({
                    className: 'tuberia-label',
                    html: `<div style="background: white; padding: 3px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold; text-align: center; line-height: 1.2;">
                           ${distancia.toFixed(1)}m - ${nuevoDiámetro}"<br>
                           <small style="color: #666;">${angulo.toFixed(1)}°</small>
                           </div>`,
                    iconSize: [80, 30],
                    iconAnchor: [40, 15]
                }));
            }
        } else if (latlngs.length > 2) {
            mostrarInfoPolilinea(tuberia.linea, latlngs, nuevoDiámetro);
        }
    }
    
    if (tuberia.etiquetaLongitud) {
        actualizarContenidoEtiquetaTuberia(tuberia.etiquetaLongitud, tuberia.longitud, nuevoDiámetro);
        
        // Actualizar en array global
        const etiquetaIndex = etiquetasTuberias.findIndex(e => e.id === tuberia.id);
        if (etiquetaIndex !== -1) {
            etiquetasTuberias[etiquetaIndex].diametro = nuevoDiámetro;
        }
    }
    
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
                actualizarContenidoEtiquetaTuberia(tuberia.etiquetaLongitud, nuevaLongitud, tuberia.diametro);
                
                // Actualizar en array global
                const etiquetaIndex = etiquetasTuberias.findIndex(e => e.id === tuberia.id);
                if (etiquetaIndex !== -1) {
                    etiquetasTuberias[etiquetaIndex].longitud = nuevaLongitud;
                    etiquetasTuberias[etiquetaIndex].position = centro;
                }
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
                actualizarContenidoEtiquetaTuberia(tuberia.etiquetaLongitud, nuevaLongitud, tuberia.diametro);
                
                // Actualizar en array global
                const etiquetaIndex = etiquetasTuberias.findIndex(e => e.id === tuberia.id);
                if (etiquetaIndex !== -1) {
                    etiquetasTuberias[etiquetaIndex].longitud = nuevaLongitud;
                    etiquetasTuberias[etiquetaIndex].position = centro;
                }
            }
        }
    });
    
    actualizarResumenTuberias();
    actualizarResultados();
}

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

// ============================================
// FUNCIONES DE CONEXIÓN
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
    
    mostrarMensaje(`Modo conexión ${tipoTuberia} (${diametro}"). Haz clic en un punto de tubería para iniciar la conexión.`);
    
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
        mostrarMensaje('No hay un punto de tubería cerca. Haz clic cerca de un punto existente.');
        return;
    }
    
    if (!puntoOrigenConexion) {
        puntoOrigenConexion = {
            punto: puntoCercano,
            latlng: puntoCercano.latlng
        };
        
        resaltarPunto(puntoCercano.latlng);
        mostrarMensaje('Punto origen seleccionado. Ahora haz clic en otro punto para conectar.');
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
        
        // Crear etiqueta de tubería con controles
        const etiqueta = crearEtiquetaTuberia(centro, nuevaTuberia.longitud, diametro, tipoTuberia, nuevaTuberia.id);
        etiqueta.addTo(map);
        
        nuevaTuberia.etiquetaLongitud = etiqueta;
        
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
        
        document.getElementById(botonId).classList.remove('modo-conexion-activo');
        
        map.off('click');
        quitarResaltadoPuntos();
        
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
// FUNCIONES DE RESULTADOS
// ============================================

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
    
    if (valvulas.length > 0) {
        html += '<div class="resultado-seccion">';
        html += '<h4 class="resultado-titulo">Resumen Hidráulico</h4>';
        html += '<table class="resultado-tabla">';
        html += '<tr><th>Parámetro</th><th>Valor</th><th>Observaciones</th></tr>';
        
        const caudalTotalSistema = valvulas.reduce((sum, v) => sum + v.caudalTotal, 0);
        const caudalLps = caudalTotalSistema / 3600;
        
        html += `<tr>
            <td>Caudal Total Requerido</td>
            <td>${caudalTotalSistema.toFixed(2)} L/h (${caudalLps.toFixed(2)} L/s)</td>
            <td>Suma de todas las válvulas</td>
        </tr>`;
        
        if (cabezales.length > 0) {
            const cabezalPrincipal = cabezales[0];
            const caudalCabezal = cabezalPrincipal.caudalBomba * 1000;
            const diferencia = caudalCabezal - caudalTotalSistema;
            const porcentaje = (diferencia / caudalCabezal) * 100;
            
            html += `<tr>
                <td>Caudal Disponible (Cabezal)</td>
                <td>${(cabezalPrincipal.caudalBomba * 1000).toFixed(2)} L/h (${cabezalPrincipal.caudalBomba} L/s)</td>
                <td>Capacidad del sistema de bombeo</td>
            </tr>`;
            
            html += `<tr>
                <td>Diferencia</td>
                <td>${diferencia.toFixed(2)} L/h (${(diferencia / 3600).toFixed(2)} L/s)</td>
                <td>${diferencia >= 0 ? 'Sobrecapacidad: ' + porcentaje.toFixed(1) + '%' : 'Deficit: ' + Math.abs(porcentaje).toFixed(1) + '%'}</td>
            </tr>`;
        }
        
        if (areaTotal > 0 && caudalTotalSistema > 0) {
            const laminaPorHora = caudalTotalSistema / (areaTotal * 1000);
            const horasPara10mm = 10 / laminaPorHora;
            
            html += `<tr>
                <td>Lámina de Riego por Hora</td>
                <td>${laminaPorHora.toFixed(3)} mm/h</td>
                <td></td>
            </tr>`;
            html += `<tr>
                <td>Tiempo para 10 mm de riego</td>
                <td>${horasPara10mm.toFixed(1)} horas</td>
                <td>Lámina estándar para muchos cultivos</td>
            </tr>`;
        }
        
        html += '</table>';
        html += '</div>';
    }
    
    resultadosDiv.innerHTML = html;
}

// ============================================
// FUNCIONES DE ETIQUETAS (ROTAR, CAMBIAR TAMAÑO, OCULTAR, MOVER)
// ============================================

// NUEVA FUNCIÓN: Mostrar menú contextual para etiquetas
function mostrarMenuContextualEtiqueta(posicion, etiquetaId, tipo) {
    // Crear menú contextual
    const menuDiv = document.createElement('div');
    menuDiv.id = 'menu-contextual-etiqueta';
    menuDiv.style.cssText = `
        position: absolute;
        top: ${posicion.lat}px;
        left: ${posicion.lng}px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        z-index: 10000;
        min-width: 180px;
    `;
    
    let etiquetaData;
    if (tipo === 'polygon') {
        etiquetaData = etiquetasPoligonos.find(e => e.id === etiquetaId);
    } else {
        etiquetaData = etiquetasTuberias.find(e => e.id === etiquetaId);
    }
    
    if (!etiquetaData) return;
    
    const fontSize = etiquetaData.fontSize || (tipo === 'polygon' ? 11 : 9);
    const rotation = etiquetaData.rotation || 0;
    const visible = etiquetaData.visible !== false;
    
    menuDiv.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; color: #333;">
            ${tipo === 'polygon' ? 'Etiqueta de Terreno' : 'Etiqueta de Tubería'}
        </div>
        
        <div style="margin-bottom: 8px;">
            <label style="display: block; margin-bottom: 3px; font-size: 0.9rem;">Tamaño de fuente:</label>
            <input type="range" id="slider-tamano" min="8" max="20" value="${fontSize}" 
                   style="width: 100%;" onchange="cambiarTamanoEtiqueta('${etiquetaId}', '${tipo}', this.value)">
            <div style="text-align: center; font-size: 0.8rem;">${fontSize}px</div>
        </div>
        
        <div style="margin-bottom: 8px;">
            <label style="display: block; margin-bottom: 3px; font-size: 0.9rem;">Rotación:</label>
            <input type="range" id="slider-rotacion" min="0" max="360" value="${rotation}" 
                   style="width: 100%;" onchange="rotarEtiqueta('${etiquetaId}', '${tipo}', this.value)">
            <div style="text-align: center; font-size: 0.8rem;">${rotation}°</div>
        </div>
        
        <div style="display: flex; gap: 5px; margin-bottom: 10px;">
            <button onclick="toggleVisibilidadEtiqueta('${etiquetaId}', '${tipo}')" 
                    style="flex: 1; padding: 5px; background: ${visible ? '#4ecdc4' : '#ff6b6b'}; color: white; border: none; border-radius: 4px; cursor: pointer;">
                ${visible ? 'Ocultar' : 'Mostrar'}
            </button>
            <button onclick="eliminarEtiqueta('${etiquetaId}', '${tipo}')" 
                    style="flex: 1; padding: 5px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Eliminar
            </button>
        </div>
        
        <button onclick="document.getElementById('menu-contextual-etiqueta').remove()" 
                style="width: 100%; padding: 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
            Cerrar
        </button>
    `;
    
    // Eliminar menú anterior si existe
    const menuAnterior = document.getElementById('menu-contextual-etiqueta');
    if (menuAnterior) menuAnterior.remove();
    
    document.body.appendChild(menuDiv);
    
    // Cerrar menú al hacer clic fuera
    setTimeout(() => {
        const cerrarMenu = function(e) {
            if (!menuDiv.contains(e.target)) {
                menuDiv.remove();
                document.removeEventListener('click', cerrarMenu);
            }
        };
        document.addEventListener('click', cerrarMenu);
    }, 10);
}

// NUEVA FUNCIÓN: Cambiar tamaño de etiqueta
function cambiarTamanoEtiqueta(etiquetaId, tipo, nuevoTamano) {
    if (tipo === 'polygon') {
        const etiquetaIndex = etiquetasPoligonos.findIndex(e => e.id === etiquetaId);
        if (etiquetaIndex !== -1) {
            etiquetasPoligonos[etiquetaIndex].fontSize = parseInt(nuevoTamano);
            
            // Actualizar visualmente
            const etiqueta = etiquetasPoligonos[etiquetaIndex];
            if (etiqueta.marker && etiqueta.marker.setIcon) {
                const polygon = etiqueta.polygon;
                if (polygon) {
                    const latlngs = polygon.getLatLngs()[0];
                    const area = L.GeometryUtil.geodesicArea(latlngs);
                    let perimetro = 0;
                    for (let i = 0; i < latlngs.length; i++) {
                        const puntoActual = latlngs[i];
                        const puntoSiguiente = latlngs[(i + 1) % latlngs.length];
                        perimetro += puntoActual.distanceTo(puntoSiguiente);
                    }
                    
                    etiqueta.marker.setIcon(L.divIcon({
                        className: 'etiqueta-poligono interactiva',
                        html: crearHTMLMedidasPoligono(area, perimetro, etiquetaId),
                        iconSize: [200, 80],
                        iconAnchor: [100, 40]
                    }));
                }
            }
            
            // Actualizar slider value
            const slider = document.getElementById('slider-tamano');
            if (slider) {
                const valueDisplay = slider.nextElementSibling;
                if (valueDisplay) {
                    valueDisplay.textContent = `${nuevoTamano}px`;
                }
            }
        }
    } else {
        const etiquetaIndex = etiquetasTuberias.findIndex(e => e.id === etiquetaId);
        if (etiquetaIndex !== -1) {
            etiquetasTuberias[etiquetaIndex].fontSize = parseInt(nuevoTamano);
            
            // Actualizar visualmente
            const etiqueta = etiquetasTuberias[etiquetaIndex];
            if (etiqueta.marker && etiqueta.marker.setIcon) {
                etiqueta.marker.setIcon(L.divIcon({
                    className: 'tuberia-label interactiva',
                    html: crearHTMLMedidasTuberia(etiqueta.longitud, etiqueta.diametro, etiqueta.tipoTuberia, etiquetaId),
                    iconSize: [100, 30],
                    iconAnchor: [50, 15]
                }));
            }
            
            // Actualizar slider value
            const slider = document.getElementById('slider-tamano');
            if (slider) {
                const valueDisplay = slider.nextElementSibling;
                if (valueDisplay) {
                    valueDisplay.textContent = `${nuevoTamano}px`;
                }
            }
        }
    }
}

// NUEVA FUNCIÓN: Rotar etiqueta
function rotarEtiqueta(etiquetaId, tipo, nuevaRotacion) {
    if (tipo === 'polygon') {
        const etiquetaIndex = etiquetasPoligonos.findIndex(e => e.id === etiquetaId);
        if (etiquetaIndex !== -1) {
            etiquetasPoligonos[etiquetaIndex].rotation = parseInt(nuevaRotacion);
            
            // Actualizar visualmente
            const etiqueta = etiquetasPoligonos[etiquetaIndex];
            if (etiqueta.marker && etiqueta.marker.setIcon) {
                const polygon = etiqueta.polygon;
                if (polygon) {
                    const latlngs = polygon.getLatLngs()[0];
                    const area = L.GeometryUtil.geodesicArea(latlngs);
                    let perimetro = 0;
                    for (let i = 0; i < latlngs.length; i++) {
                        const puntoActual = latlngs[i];
                        const puntoSiguiente = latlngs[(i + 1) % latlngs.length];
                        perimetro += puntoActual.distanceTo(puntoSiguiente);
                    }
                    
                    etiqueta.marker.setIcon(L.divIcon({
                        className: 'etiqueta-poligono interactiva',
                        html: crearHTMLMedidasPoligono(area, perimetro, etiquetaId),
                        iconSize: [200, 80],
                        iconAnchor: [100, 40]
                    }));
                }
            }
            
            // Actualizar slider value
            const slider = document.getElementById('slider-rotacion');
            if (slider) {
                const valueDisplay = slider.nextElementSibling;
                if (valueDisplay) {
                    valueDisplay.textContent = `${nuevaRotacion}°`;
                }
            }
        }
    } else {
        const etiquetaIndex = etiquetasTuberias.findIndex(e => e.id === etiquetaId);
        if (etiquetaIndex !== -1) {
            etiquetasTuberias[etiquetaIndex].rotation = parseInt(nuevaRotacion);
            
            // Actualizar visualmente
            const etiqueta = etiquetasTuberias[etiquetaIndex];
            if (etiqueta.marker && etiqueta.marker.setIcon) {
                etiqueta.marker.setIcon(L.divIcon({
                    className: 'tuberia-label interactiva',
                    html: crearHTMLMedidasTuberia(etiqueta.longitud, etiqueta.diametro, etiqueta.tipoTuberia, etiquetaId),
                    iconSize: [100, 30],
                    iconAnchor: [50, 15]
                }));
            }
            
            // Actualizar slider value
            const slider = document.getElementById('slider-rotacion');
            if (slider) {
                const valueDisplay = slider.nextElementSibling;
                if (valueDisplay) {
                    valueDisplay.textContent = `${nuevaRotacion}°`;
                }
            }
        }
    }
}

// NUEVA FUNCIÓN: Alternar visibilidad de etiqueta
function toggleVisibilidadEtiqueta(etiquetaId, tipo) {
    if (tipo === 'polygon') {
        const etiquetaIndex = etiquetasPoligonos.findIndex(e => e.id === etiquetaId);
        if (etiquetaIndex !== -1) {
            const etiqueta = etiquetasPoligonos[etiquetaIndex];
            etiqueta.visible = !etiqueta.visible;
            
            if (etiqueta.visible) {
                if (etiqueta.marker && !map.hasLayer(etiqueta.marker)) {
                    etiqueta.marker.addTo(map);
                }
            } else {
                if (etiqueta.marker && map.hasLayer(etiqueta.marker)) {
                    map.removeLayer(etiqueta.marker);
                }
            }
            
            // Cerrar menú contextual
            const menu = document.getElementById('menu-contextual-etiqueta');
            if (menu) menu.remove();
        }
    } else {
        const etiquetaIndex = etiquetasTuberias.findIndex(e => e.id === etiquetaId);
        if (etiquetaIndex !== -1) {
            const etiqueta = etiquetasTuberias[etiquetaIndex];
            etiqueta.visible = !etiqueta.visible;
            
            if (etiqueta.visible) {
                if (etiqueta.marker && !map.hasLayer(etiqueta.marker)) {
                    etiqueta.marker.addTo(map);
                }
            } else {
                if (etiqueta.marker && map.hasLayer(etiqueta.marker)) {
                    map.removeLayer(etiqueta.marker);
                }
            }
            
            // Cerrar menú contextual
            const menu = document.getElementById('menu-contextual-etiqueta');
            if (menu) menu.remove();
        }
    }
}

// NUEVA FUNCIÓN: Eliminar etiqueta
function eliminarEtiqueta(etiquetaId, tipo) {
    if (tipo === 'polygon') {
        const etiquetaIndex = etiquetasPoligonos.findIndex(e => e.id === etiquetaId);
        if (etiquetaIndex !== -1) {
            const etiqueta = etiquetasPoligonos[etiquetaIndex];
            if (etiqueta.marker && map.hasLayer(etiqueta.marker)) {
                map.removeLayer(etiqueta.marker);
            }
            etiquetasPoligonos.splice(etiquetaIndex, 1);
        }
    } else {
        const etiquetaIndex = etiquetasTuberias.findIndex(e => e.id === etiquetaId);
        if (etiquetaIndex !== -1) {
            const etiqueta = etiquetasTuberias[etiquetaIndex];
            if (etiqueta.marker && map.hasLayer(etiqueta.marker)) {
                map.removeLayer(etiqueta.marker);
            }
            etiquetasTuberias.splice(etiquetaIndex, 1);
        }
    }
    
    // Cerrar menú contextual
    const menu = document.getElementById('menu-contextual-etiqueta');
    if (menu) menu.remove();
}

// NUEVA FUNCIÓN: Actualizar etiquetas de lados de polígono
function actualizarEtiquetasLados(polygon, latlngs) {
    // Eliminar etiquetas anteriores si existen
    if (polygon.etiquetasLados) {
        polygon.etiquetasLados.forEach(etiqueta => {
            if (etiqueta && etiqueta.remove) {
                map.removeLayer(etiqueta);
            }
        });
    }
    
    polygon.etiquetasLados = [];
    
    // Crear etiquetas para cada lado
    for (let i = 0; i < latlngs.length; i++) {
        const puntoActual = latlngs[i];
        const puntoSiguiente = latlngs[(i + 1) % latlngs.length];
        
        const distancia = puntoActual.distanceTo(puntoSiguiente);
        const centro = L.latLng(
            (puntoActual.lat + puntoSiguiente.lat) / 2,
            (puntoActual.lng + puntoSiguiente.lng) / 2
        );
        
        // Calcular ángulo para orientar la etiqueta
        const angulo = calcularAngulo(puntoActual, puntoSiguiente);
        
        // Desplazar la etiqueta para que no se superponga con el polígono
        const desplazamiento = 0.00002; // Ajustar según zoom
        const anguloRadianes = (90 - angulo) * Math.PI / 180;
        const centroDesplazado = L.latLng(
            centro.lat + Math.cos(anguloRadianes) * desplazamiento,
            centro.lng + Math.sin(anguloRadianes) * desplazamiento
        );
        
        const etiqueta = L.marker(centroDesplazado, {
            icon: L.divIcon({
                className: 'etiqueta-lado',
                html: `
                    <div style="background: rgba(255, 255, 255, 0.9); padding: 4px 8px; border-radius: 4px; 
                           border: 1px solid #008a45; font-size: 10px; font-weight: bold; color: #333; 
                           transform: rotate(${angulo}deg); transform-origin: center; cursor: move;">
                        ${distancia.toFixed(1)} m
                    </div>`,
                iconSize: [70, 25],
                iconAnchor: [35, 12.5]
            }),
            rotationAngle: angulo,
            draggable: true,
            interactive: true
        }).addTo(map);
        
        // Configurar eventos de arrastre
        etiqueta.on('dragend', function(e) {
            const nuevaPos = e.target.getLatLng();
            // Aquí podrías actualizar la posición en un array si quisieras guardarla
        });
        
        // Configurar clic derecho para menú contextual
        etiqueta.on('contextmenu', function(e) {
            e.originalEvent.preventDefault();
            mostrarMenuContextualEtiquetaLado(e.latlng, etiqueta, distancia, i);
        });
        
        polygon.etiquetasLados.push(etiqueta);
    }
}

// NUEVA FUNCIÓN: Menú contextual para etiquetas de lados
function mostrarMenuContextualEtiquetaLado(posicion, etiqueta, distancia, indice) {
    const menuDiv = document.createElement('div');
    menuDiv.id = 'menu-contextual-lado';
    menuDiv.style.cssText = `
        position: absolute;
        top: ${posicion.lat}px;
        left: ${posicion.lng}px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        z-index: 10000;
        min-width: 150px;
    `;
    
    menuDiv.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; color: #333;">
            Lado ${indice + 1}
        </div>
        
        <div style="margin-bottom: 10px;">
            <strong>Longitud:</strong> ${distancia.toFixed(2)} m
        </div>
        
        <button onclick="eliminarEtiquetaLado(${indice})" 
                style="width: 100%; padding: 5px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 5px;">
            Ocultar Etiqueta
        </button>
        
        <button onclick="document.getElementById('menu-contextual-lado').remove()" 
                style="width: 100%; padding: 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
            Cerrar
        </button>
    `;
    
    // Eliminar menú anterior si existe
    const menuAnterior = document.getElementById('menu-contextual-lado');
    if (menuAnterior) menuAnterior.remove();
    
    document.body.appendChild(menuDiv);
    
    // Cerrar menú al hacer clic fuera
    setTimeout(() => {
        const cerrarMenu = function(e) {
            if (!menuDiv.contains(e.target)) {
                menuDiv.remove();
                document.removeEventListener('click', cerrarMenu);
            }
        };
        document.addEventListener('click', cerrarMenu);
    }, 10);
}

// NUEVA FUNCIÓN: Eliminar etiqueta de lado
function eliminarEtiquetaLado(indice) {
    // Esta función sería más compleja ya que necesitarías saber a qué polígono pertenece
    // Por simplicidad, aquí solo cerramos el menú
    const menu = document.getElementById('menu-contextual-lado');
    if (menu) menu.remove();
}

// ============================================
// FUNCIONES DE PDF COMPLETAS CON MEDIDAS
// ============================================

async function exportarPDF() {
    try {
        if (typeof window.jspdf === 'undefined') {
            alert('Error: jsPDF no está cargado. Recarga la página.');
            return;
        }
        
        mostrarMensaje('Generando resumen técnico profesional...', 3000);
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // ====================================================================
        // CONFIGURACIÓN DE ESTILOS Y COLORES AGROSISTEMAS
        // ====================================================================
        const colores = {
            primario: '#00a553',      // Verde Agrosistemas
            secundario: '#008a45',    // Verde oscuro
            acento: '#1772af',        // Azul
            texto: '#333333',         // Texto principal
            textoClaro: '#666666',    // Texto secundario
            fondo: '#f8f9fa',         // Fondo claro
            borde: '#e0e0e0',         // Borde gris claro
            peligro: '#ff6b6b',       // Rojo para alertas
            advertencia: '#ff9f43',   // Naranja
            exito: '#4ecdc4'          // Verde turquesa
        };
        
        // ====================================================================
        // CALCULAR DATOS PARA TODO EL DOCUMENTO
        // ====================================================================
        
        // Calcular área total del terreno
        let areaTotalTerreno = 0;
        let perimetroTotalTerreno = 0;
        let numPoligonos = 0;
        const detallesPoligonos = [];
        
        drawnItems.eachLayer(function(layer) {
            if (layer instanceof L.Polygon) {
                const latlngs = layer.getLatLngs()[0];
                const area = L.GeometryUtil.geodesicArea(latlngs);
                let perimetro = 0;
                
                for (let i = 0; i < latlngs.length; i++) {
                    const puntoActual = latlngs[i];
                    const puntoSiguiente = latlngs[(i + 1) % latlngs.length];
                    perimetro += puntoActual.distanceTo(puntoSiguiente);
                }
                
                areaTotalTerreno += area;
                perimetroTotalTerreno += perimetro;
                numPoligonos++;
                
                detallesPoligonos.push({
                    numero: numPoligonos,
                    area: area,
                    perimetro: perimetro,
                    lados: latlngs.length
                });
            }
        });
        
        // Calcular resumen de tuberías
        const resumenTuberias = {};
        let longitudTotalTuberias = 0;
        
        tuberias.forEach(t => {
            const key = `${t.tipo}_${t.diametro}`;
            if (!resumenTuberias[key]) {
                resumenTuberias[key] = {
                    tipo: t.tipo,
                    diametro: t.diametro,
                    longitudTotal: 0,
                    cantidad: 0,
                    material: t.tipoMaterial || 'PVC'
                };
            }
            resumenTuberias[key].longitudTotal += t.longitud || 0;
            resumenTuberias[key].cantidad += 1;
            longitudTotalTuberias += t.longitud || 0;
        });
        
        // Calcular caudal total
        let caudalTotalSistema = 0;
        if (valvulas.length > 0) {
            caudalTotalSistema = valvulas.reduce((sum, v) => sum + v.caudalTotal, 0);
        }
        
        // ====================================================================
        // PÁGINA 1: PORTADA PROFESIONAL
        // ====================================================================
        doc.setFillColor(240, 245, 242); // Fondo verde muy claro
        doc.rect(0, 0, 210, 297, 'F');
        
        // Logo Agrosistemas (simulado)
        doc.setFillColor(colores.primario);
        doc.roundedRect(70, 40, 70, 70, 10, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.text('A', 105, 78, { align: 'center' });
        doc.setFontSize(16);
        doc.text('GRO', 123, 77);
        doc.text('SISTEMAS', 105, 95, { align: 'center' });
        
        // Título principal
        doc.setTextColor(colores.texto);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text('MEMORIA TÉCNICA', 105, 130, { align: 'center' });
        doc.setFontSize(22);
        doc.text('SISTEMA DE RIEGO', 105, 145, { align: 'center' });
        
        // Línea decorativa
        doc.setDrawColor(colores.primario);
        doc.setLineWidth(2);
        doc.line(60, 155, 150, 155);
        
        // Información del proyecto
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.textoClaro);
        doc.text('Proyecto:', 60, 175);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.texto);
        const nombreProyecto = `Diseño_${new Date().toLocaleDateString('es-MX').replace(/\//g, '-')}`;
        doc.text(nombreProyecto, 90, 175);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.textoClaro);
        doc.text('Fecha:', 60, 185);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.texto);
        doc.text(new Date().toLocaleDateString('es-MX', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }), 90, 185);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.textoClaro);
        doc.text('Versión:', 60, 195);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.texto);
        doc.text('1.0', 90, 195);
        
        // Resumen ejecutivo en portada
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.primario);
        doc.text('RESUMEN EJECUTIVO', 105, 215, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.texto);
        doc.text(`• Área total: ${areaTotalTerreno > 0 ? areaTotalTerreno.toFixed(0) : '0'} m²`, 105, 225, { align: 'center' });
        doc.text(`• Tuberías: ${longitudTotalTuberias.toFixed(0)} m`, 105, 232, { align: 'center' });
        doc.text(`• Válvulas: ${valvulas.length}`, 105, 239, { align: 'center' });
        
        // Datos de contacto
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.textoClaro);
        doc.text('Agrosistemas - Asesoría Técnica Agrícola', 105, 260, { align: 'center' });
        doc.text('www.agrosistemas.com.mx | contacto@agrosistemas.com.mx', 105, 267, { align: 'center' });
        doc.text('Tel: 668 123 4567 | Los Mochis, Sinaloa', 105, 274, { align: 'center' });
        
        // Pie de página portada
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.text('Documento confidencial - Uso exclusivo del cliente', 105, 285, { align: 'center' });
        
        // ====================================================================
        // PÁGINA 2: ÍNDICE
        // ====================================================================
        doc.addPage();
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, 210, 297, 'F');
        
        // Encabezado
        doc.setFillColor(colores.primario);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('ÍNDICE DE CONTENIDOS', 105, 20, { align: 'center' });
        
        let currentY = 50;
        
        // Secciones del índice
        const secciones = [
            { titulo: '1. RESUMEN EJECUTIVO', pagina: 3 },
            { titulo: '2. PLANO DEL SISTEMA', pagina: 4 },
            { titulo: '3. INFORMACIÓN DEL TERRENO', pagina: 5 },
            { titulo: '4. DISEÑO HIDRÁULICO', pagina: 6 },
            { titulo: '5. TUBERÍAS Y CONEXIONES', pagina: 7 },
            { titulo: '6. EQUIPOS Y ELEMENTOS', pagina: 8 },
            { titulo: '7. CÁLCULOS TÉCNICOS', pagina: 9 },
            { titulo: '8. ESPECIFICACIONES TÉCNICAS', pagina: 10 },
            { titulo: '9. RECOMENDACIONES', pagina: 11 },
            { titulo: 'ANEXOS Y FIRMAS', pagina: 12 }
        ];
        
        secciones.forEach((seccion, index) => {
            doc.setTextColor(colores.texto);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(seccion.titulo, 20, currentY);
            
            // Puntos de guía
            doc.setDrawColor(colores.borde);
            doc.setLineWidth(0.5);
            const xPuntos = 190;
            for (let i = 0; i < 20; i++) {
                doc.line(20 + (i * 2), currentY + 3, 20 + (i * 2) + 1, currentY + 3);
            }
            
            doc.setTextColor(colores.acento);
            doc.text(seccion.pagina.toString(), 195, currentY, { align: 'right' });
            
            currentY += 15;
        });
        
        // Nota del índice
        currentY += 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(colores.textoClaro);
        doc.text('* Este documento contiene información técnica para la implementación del sistema de riego.', 20, currentY);
        
        // ====================================================================
        // PÁGINA 3: RESUMEN EJECUTIVO
        // ====================================================================
        doc.addPage();
        // Encabezado de página
        doc.setFillColor(colores.primario);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('1. RESUMEN EJECUTIVO', 105, 20, { align: 'center' });
        
        currentY = 40;
        
        // Cuadro resumen ejecutivo
        doc.setFillColor(colores.fondo);
        doc.roundedRect(15, currentY, 180, 60, 3, 3, 'F');
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.primario);
        doc.text('RESUMEN DEL PROYECTO', 105, currentY + 10, { align: 'center' });
        
        currentY += 25;
        
        // Datos clave
        const datosResumen = [
            ['Área Total del Terreno:', `${areaTotalTerreno > 0 ? areaTotalTerreno.toFixed(0) : '0'} m² (${(areaTotalTerreno / 10000).toFixed(2)} ha)`],
            ['Longitud Total de Tuberías:', `${longitudTotalTuberias.toFixed(0)} m`],
            ['Número de Válvulas:', `${valvulas.length}`],
            ['Caudal Total del Sistema:', `${caudalTotalSistema.toFixed(0)} L/h (${(caudalTotalSistema / 3600).toFixed(1)} L/s)`],
            ['Elementos Instalados:', `${elementosGraficos.length}`],
            ['Cabezales de Bombeo:', `${cabezales.length}`]
        ];
        
        datosResumen.forEach((dato, index) => {
            const y = currentY + (index * 7);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.texto);
            doc.text(dato[0], 20, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colores.acento);
            doc.text(dato[1], 100, y);
        });
        
        currentY += 50;
        
        // Objetivo del proyecto
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.primario);
        doc.text('OBJETIVO DEL PROYECTO', 20, currentY);
        
        currentY += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.texto);
        const objetivo = 'Diseñar e implementar un sistema de riego eficiente que maximice el uso del agua, ' +
                        'garantice una distribución uniforme y optimice los recursos disponibles para el cultivo.';
        doc.text(objetivo, 20, currentY, { maxWidth: 170 });
        
        currentY += 20;
        
        // Alcance
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.primario);
        doc.text('ALCANCE', 20, currentY);
        
        currentY += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.texto);
        const alcances = [
            '• Diseño completo del sistema de riego por goteo/aspersión',
            '• Especificación de tuberías, válvulas y accesorios',
            '• Cálculos hidráulicos y de requerimientos hídricos',
            '• Dimensionamiento del cabezal de bombeo y filtración',
            '• Estimación de materiales y costo preliminar'
        ];
        
        alcances.forEach((alcance, index) => {
            doc.text(alcance, 25, currentY + (index * 6), { maxWidth: 165 });
        });
        
        // ====================================================================
        // PÁGINA 4: PLANO DEL SISTEMA (IMAGEN)
        // ====================================================================
        doc.addPage();
        // Encabezado de página
        doc.setFillColor(colores.primario);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('2. PLANO DEL SISTEMA', 105, 20, { align: 'center' });
        
        currentY = 35;
        
        try {
            // Determinar los límites del diseño
            let bounds = null;
            
            // Buscar todos los elementos para determinar el área total del diseño
            const allLatLngs = [];
            
            // 1. Polígonos del terreno
            drawnItems.eachLayer(function(layer) {
                if (layer instanceof L.Polygon) {
                    const latlngs = layer.getLatLngs()[0];
                    latlngs.forEach(latlng => allLatLngs.push(latlng));
                }
            });
            
            // 2. Tuberías
            tuberias.forEach(tuberia => {
                if (tuberia.linea && tuberia.linea.getLatLngs) {
                    const latlngs = tuberia.linea.getLatLngs();
                    
                    // Aplanar array de puntos
                    if (Array.isArray(latlngs)) {
                        if (Array.isArray(latlngs[0]) && typeof latlngs[0][0] === 'object') {
                            // Es un array de arrays (polilínea con segmentos)
                            latlngs.forEach(segment => {
                                if (Array.isArray(segment)) {
                                    segment.forEach(point => {
                                        if (point && point.lat && point.lng) {
                                            allLatLngs.push(point);
                                        }
                                    });
                                }
                            });
                        } else if (latlngs[0].lat) {
                            // Es un array simple de puntos
                            latlngs.forEach(point => {
                                if (point && point.lat && point.lng) {
                                    allLatLngs.push(point);
                                }
                            });
                        }
                    }
                }
                
                // Agregar puntos de inicio y fin
                if (tuberia.puntoInicio) allLatLngs.push(tuberia.puntoInicio);
                if (tuberia.puntoFin) allLatLngs.push(tuberia.puntoFin);
            });
            
            // 3. Elementos gráficos
            elementosGraficos.forEach(elemento => {
                if (elemento.posicion) {
                    allLatLngs.push(elemento.posicion);
                }
            });
            
            // Si no hay elementos, usar vista actual del mapa
            if (allLatLngs.length === 0) {
                bounds = map.getBounds();
            } else {
                // Crear bounds a partir de todos los puntos
                const boundsArray = L.latLngBounds(allLatLngs);
                
                // Añadir un margen de 10% alrededor del diseño
                const paddingPercent = 0.1;
                const sw = boundsArray.getSouthWest();
                const ne = boundsArray.getNorthEast();
                
                const latDiff = ne.lat - sw.lat;
                const lngDiff = ne.lng - sw.lng;
                
                const paddedSW = L.latLng(
                    sw.lat - (latDiff * paddingPercent),
                    sw.lng - (lngDiff * paddingPercent)
                );
                
                const paddedNE = L.latLng(
                    ne.lat + (latDiff * paddingPercent),
                    ne.lng + (lngDiff * paddingPercent)
                );
                
                bounds = L.latLngBounds(paddedSW, paddedNE);
            }
            
            // Calcular dimensiones para la imagen en el PDF
            const pdfPageWidth = 210; // mm en A4 horizontal
            const pdfPageHeight = 297; // mm en A4 vertical
            
            // Margen izquierdo y derecho de 10mm
            const pdfMarginX = 10;
            const pdfWidth = pdfPageWidth - (pdfMarginX * 2); // 190mm
            
            // Espacio para título y pie
            const pdfMarginTop = currentY;
            const pdfMarginBottom = 20;
            const pdfHeight = pdfPageHeight - pdfMarginTop - pdfMarginBottom - 30; // Altura disponible
            
            // Calcular relación de aspecto
            const boundsSize = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
            const boundsAspectRatio = Math.abs((bounds.getNorthEast().lng - bounds.getSouthWest().lng) / 
                                             (bounds.getNorthEast().lat - bounds.getSouthWest().lat));
            
            let finalWidth, finalHeight;
            const pdfAspectRatio = pdfWidth / pdfHeight;
            
            if (boundsAspectRatio > pdfAspectRatio) {
                // El diseño es más ancho que alto respecto al espacio disponible
                finalWidth = pdfWidth;
                finalHeight = pdfWidth / boundsAspectRatio;
            } else {
                // El diseño es más alto que ancho
                finalHeight = pdfHeight;
                finalWidth = pdfHeight * boundsAspectRatio;
            }
            
            // Centrar en el PDF
            const pdfX = pdfMarginX + (pdfWidth - finalWidth) / 2;
            const pdfY = currentY + (pdfHeight - finalHeight) / 2;
            
            // Crear canvas para dibujar el diseño
            const canvas = document.createElement('canvas');
            const dpi = 150; // Resolución media para buen balance calidad/tamaño
            const scaleFactor = dpi / 96; // Factor de escala
            
            canvas.width = finalWidth * 3.78 * scaleFactor; // Convertir mm a px (3.78 px/mm * scale)
            canvas.height = finalHeight * 3.78 * scaleFactor;
            
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Fondo blanco
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Coordenadas para conversión
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            // Función para convertir coordenadas geográficas a píxeles en el canvas
            function latLngToCanvas(latlng) {
                // Normalizar las coordenadas dentro del bounds
                const normalizedX = (latlng.lng - bounds.getSouthWest().lng) / 
                                  (bounds.getNorthEast().lng - bounds.getSouthWest().lng);
                const normalizedY = 1 - ((latlng.lat - bounds.getSouthWest().lat) / 
                                       (bounds.getNorthEast().lat - bounds.getSouthWest().lat));
                
                // Escalar al tamaño del canvas
                const canvasX = normalizedX * canvasWidth;
                const canvasY = normalizedY * canvasHeight;
                
                return { x: canvasX, y: canvasY };
            }
            
            // 1. Dibujar polígonos del terreno CON MEDIDAS Y ETIQUETAS
            drawnItems.eachLayer(function(layer) {
                if (layer instanceof L.Polygon) {
                    const latlngs = layer.getLatLngs()[0];
                    const canvasPoints = latlngs.map(latlng => latLngToCanvas(latlng));
                    
                    // Dibujar polígono
                    ctx.beginPath();
                    ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
                    for (let i = 1; i < canvasPoints.length; i++) {
                        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
                    }
                    ctx.closePath();
                    
                    // Estilo del polígono
                    ctx.fillStyle = 'rgba(0, 165, 83, 0.3)'; // Verde transparente
                    ctx.fill();
                    
                    ctx.lineWidth = 3 * scaleFactor;
                    ctx.strokeStyle = '#008a45';
                    ctx.stroke();
                    
                    // Calcular área y perímetro para la etiqueta
                    const area = L.GeometryUtil.geodesicArea(latlngs);
                    let perimetro = 0;
                    for (let i = 0; i < latlngs.length; i++) {
                        const puntoActual = latlngs[i];
                        const puntoSiguiente = latlngs[(i + 1) % latlngs.length];
                        perimetro += puntoActual.distanceTo(puntoSiguiente);
                    }
                    
                    // Buscar la etiqueta del polígono para usar su posición actual
                    let etiquetaPoligono = null;
                    const polygonId = layer._leaflet_id;
                    const etiquetaIndex = etiquetasPoligonos.findIndex(e => e.id === polygonId);
                    
                    // Usar la posición de la etiqueta si existe y está visible
                    let canvasCentro;
                    if (etiquetaIndex !== -1 && etiquetasPoligonos[etiquetaIndex].visible !== false) {
                        // Usar la posición actual de la etiqueta (si fue movida)
                        const etiquetaData = etiquetasPoligonos[etiquetaIndex];
                        if (etiquetaData.marker && etiquetaData.marker.getLatLng) {
                            const posicionEtiqueta = etiquetaData.marker.getLatLng();
                            canvasCentro = latLngToCanvas(posicionEtiqueta);
                        } else {
                            // Calcular centro como fallback
                            let centroLat = 0, centroLng = 0;
                            latlngs.forEach(punto => {
                                centroLat += punto.lat;
                                centroLng += punto.lng;
                            });
                            const centro = L.latLng(centroLat / latlngs.length, centroLng / latlngs.length);
                            canvasCentro = latLngToCanvas(centro);
                        }
                    } else {
                        // Calcular centro si no hay etiqueta
                        let centroLat = 0, centroLng = 0;
                        latlngs.forEach(punto => {
                            centroLat += punto.lat;
                            centroLng += punto.lng;
                        });
                        const centro = L.latLng(centroLat / latlngs.length, centroLng / latlngs.length);
                        canvasCentro = latLngToCanvas(centro);
                    }
                    
                    // Dibujar etiqueta del polígono
                    const etiquetaWidth = 180 * scaleFactor;
                    const etiquetaHeight = 80 * scaleFactor;
                    
                    // Fondo de etiqueta
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    ctx.fillRect(
                        canvasCentro.x - etiquetaWidth/2, 
                        canvasCentro.y - etiquetaHeight/2, 
                        etiquetaWidth, 
                        etiquetaHeight
                    );
                    
                    ctx.strokeStyle = '#008a45';
                    ctx.lineWidth = 2 * scaleFactor;
                    ctx.strokeRect(
                        canvasCentro.x - etiquetaWidth/2, 
                        canvasCentro.y - etiquetaHeight/2, 
                        etiquetaWidth, 
                        etiquetaHeight
                    );
                    
                    // Texto de la etiqueta
                    ctx.fillStyle = '#008a45';
                    ctx.font = `bold ${12 * scaleFactor}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('MEDIDAS DEL TERRENO', canvasCentro.x, canvasCentro.y - 25 * scaleFactor);
                    
                    ctx.fillStyle = '#333333';
                    ctx.font = `${11 * scaleFactor}px Arial`;
                    ctx.fillText(`Área: ${area.toFixed(1)} m²`, canvasCentro.x, canvasCentro.y - 5 * scaleFactor);
                    ctx.fillText(`Hectáreas: ${(area / 10000).toFixed(3)} ha`, canvasCentro.x, canvasCentro.y + 5 * scaleFactor);
                    ctx.fillText(`Perímetro: ${perimetro.toFixed(1)} m`, canvasCentro.x, canvasCentro.y + 15 * scaleFactor);
                    
                    // Dibujar medidas de los lados del polígono
                    for (let i = 0; i < canvasPoints.length; i++) {
                        const start = canvasPoints[i];
                        const end = canvasPoints[(i + 1) % canvasPoints.length];
                        
                        // Calcular punto medio del lado
                        const midX = (start.x + end.x) / 2;
                        const midY = (start.y + end.y) / 2;
                        
                        // Calcular distancia en píxeles
                        const dx = end.x - start.x;
                        const dy = end.y - start.y;
                        
                        // Calcular distancia real
                        const punto1 = latlngs[i];
                        const punto2 = latlngs[(i + 1) % latlngs.length];
                        const distanciaReal = punto1.distanceTo(punto2);
                        
                        // Calcular ángulo para rotar el texto
                        const angulo = Math.atan2(dy, dx);
                        
                        // Guardar estado del contexto
                        ctx.save();
                        
                        // Mover al punto medio y rotar
                        ctx.translate(midX, midY);
                        ctx.rotate(angulo);
                        
                        // Fondo para la medida del lado
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                        const textoAncho = 60 * scaleFactor;
                        const textoAlto = 18 * scaleFactor;
                        ctx.fillRect(-textoAncho/2, -textoAlto/2, textoAncho, textoAlto);
                        
                        // Borde
                        ctx.strokeStyle = 'rgba(0, 138, 69, 0.5)';
                        ctx.lineWidth = 1 * scaleFactor;
                        ctx.strokeRect(-textoAncho/2, -textoAlto/2, textoAncho, textoAlto);
                        
                        // Texto de la medida
                        ctx.fillStyle = '#008a45';
                        ctx.font = `${8 * scaleFactor}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(`${distanciaReal.toFixed(1)} m`, 0, 0);
                        
                        // Restaurar contexto
                        ctx.restore();
                        
                        // Dibujar puntos en los vértices
                        ctx.beginPath();
                        ctx.arc(start.x, start.y, 4 * scaleFactor, 0, Math.PI * 2);
                        ctx.fillStyle = '#008a45';
                        ctx.fill();
                        
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1 * scaleFactor;
                        ctx.stroke();
                        
                        // Número del vértice
                        ctx.fillStyle = '#ffffff';
                        ctx.font = `${7 * scaleFactor}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText((i + 1).toString(), start.x, start.y);
                    }
                }
            });
            
            // 2. Dibujar tuberías CON ETIQUETAS
            tuberias.forEach(tuberia => {
                if (tuberia.linea && tuberia.linea.getLatLngs) {
                    const latlngs = tuberia.linea.getLatLngs();
                    const canvasPoints = [];
                    
                    // Aplanar array de puntos si es necesario
                    if (Array.isArray(latlngs)) {
                        if (Array.isArray(latlngs[0]) && typeof latlngs[0][0] === 'object') {
                            // Es un array de arrays (polilínea con segmentos)
                            latlngs.forEach(segment => {
                                if (Array.isArray(segment)) {
                                    segment.forEach(point => {
                                        if (point && point.lat && point.lng) {
                                            canvasPoints.push(latLngToCanvas(point));
                                        }
                                    });
                                }
                            });
                        } else if (latlngs[0].lat) {
                            // Es un array simple de puntos
                            latlngs.forEach(point => {
                                if (point && point.lat && point.lng) {
                                    canvasPoints.push(latLngToCanvas(point));
                                }
                            });
                        }
                    }
                    
                    if (canvasPoints.length > 1) {
                        // Dibujar línea
                        ctx.beginPath();
                        ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
                        
                        for (let i = 1; i < canvasPoints.length; i++) {
                            ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
                        }
                        
                        // Estilo según tipo de tubería (COLORES ACTUALIZADOS)
                        let color, width;
                        switch(tuberia.tipo) {
                            case 'principal':
                                color = '#ff0000'; // ROJO
                                width = 6 * scaleFactor;
                                break;
                            case 'secundaria':
                                color = '#0000ff'; // AZUL
                                width = 4 * scaleFactor;
                                break;
                            case 'regante':
                                color = '#00ff00'; // VERDE
                                width = 3 * scaleFactor;
                                break;
                            default:
                                color = '#000000';
                                width = 2 * scaleFactor;
                        }
                        
                        ctx.lineWidth = width;
                        ctx.strokeStyle = color;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.stroke();
                        
                        // Buscar la etiqueta de la tubería para usar su posición actual
                        let etiquetaTuberia = null;
                        const tuberiaId = tuberia.id || tuberia._leaflet_id;
                        const etiquetaIndex = etiquetasTuberias.findIndex(e => e.id === tuberiaId);
                        
                        // Dibujar etiqueta de tubería
                        if (tuberia.longitud && tuberia.diametro) {
                            let midX, midY;
                            
                            // Usar la posición de la etiqueta si existe y está visible
                            if (etiquetaIndex !== -1 && etiquetasTuberias[etiquetaIndex].visible !== false) {
                                const etiquetaData = etiquetasTuberias[etiquetaIndex];
                                
                                // Usar position si está disponible (posición actual después de ser movida)
                                if (etiquetaData.position) {
                                    const canvasPos = latLngToCanvas(etiquetaData.position);
                                    midX = canvasPos.x;
                                    midY = canvasPos.y;
                                } 
                                // Si no, usar la posición del marcador
                                else if (etiquetaData.marker && etiquetaData.marker.getLatLng) {
                                    const posicionEtiqueta = etiquetaData.marker.getLatLng();
                                    const canvasPos = latLngToCanvas(posicionEtiqueta);
                                    midX = canvasPos.x;
                                    midY = canvasPos.y;
                                } else {
                                    // Calcular punto medio como fallback
                                    let sumX = 0, sumY = 0;
                                    canvasPoints.forEach(p => {
                                        sumX += p.x;
                                        sumY += p.y;
                                    });
                                    midX = sumX / canvasPoints.length;
                                    midY = sumY / canvasPoints.length;
                                }
                            } else {
                                // Calcular punto medio como fallback
                                let sumX = 0, sumY = 0;
                                canvasPoints.forEach(p => {
                                    sumX += p.x;
                                    sumY += p.y;
                                });
                                midX = sumX / canvasPoints.length;
                                midY = sumY / canvasPoints.length;
                            }
                            
                            // Solo dibujar si la etiqueta está visible o no existe en el array
                            if (etiquetaIndex === -1 || etiquetasTuberias[etiquetaIndex].visible !== false) {
                                // Fondo de etiqueta
                                const etiquetaWidth = 100 * scaleFactor;
                                const etiquetaHeight = 30 * scaleFactor;
                                
                                ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                                ctx.fillRect(midX - etiquetaWidth/2, midY - etiquetaHeight/2, etiquetaWidth, etiquetaHeight);
                                
                                ctx.strokeStyle = '#cccccc';
                                ctx.lineWidth = 1 * scaleFactor;
                                ctx.strokeRect(midX - etiquetaWidth/2, midY - etiquetaHeight/2, etiquetaWidth, etiquetaHeight);
                                
                                // Texto de la etiqueta con rotación si existe
                                let anguloRotacion = 0;
                                if (etiquetaIndex !== -1) {
                                    anguloRotacion = etiquetasTuberias[etiquetaIndex].rotation || 0;
                                }
                                
                                // Guardar estado del contexto para aplicar rotación
                                ctx.save();
                                ctx.translate(midX, midY);
                                ctx.rotate(anguloRotacion * Math.PI / 180);
                                
                                ctx.fillStyle = '#333333';
                                ctx.font = `bold ${9 * scaleFactor}px Arial`;
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(`${tuberia.longitud.toFixed(1)}m - ${tuberia.diametro}"`, 0, 0);
                                
                                // Restaurar contexto
                                ctx.restore();
                            }
                        }
                    }
                }
            });
            
            // 3. Dibujar elementos gráficos (válvulas, cabezales, etc.)
            elementosGraficos.forEach(elemento => {
                if (elemento.posicion) {
                    const canvasPoint = latLngToCanvas(elemento.posicion);
                    const radius = 12 * scaleFactor;
                    
                    // Color según tipo
                    let color;
                    let texto = '';
                    
                    switch(elemento.tipo) {
                        case 'cabezal': 
                            color = '#1772af'; 
                            texto = 'C';
                            break;
                        case 'valvula': 
                            color = '#ff6b6b'; 
                            const nombreValvula = obtenerNombreValvulaPorElementoId(elemento.id);
                            texto = nombreValvula || 'V';
                            break;
                        case 'purgaterminal': 
                            color = '#ff9f43'; 
                            texto = 'P';
                            break;
                        case 'tomagua': 
                            color = '#00a553'; 
                            texto = 'T';
                            break;
                        case 'filtro': 
                            color = '#4ecdc4'; 
                            texto = 'F';
                            break;
                        default: 
                            color = '#000000';
                            texto = elemento.tipo.charAt(0).toUpperCase();
                    }
                    
                    // Círculo del elemento
                    ctx.beginPath();
                    ctx.arc(canvasPoint.x, canvasPoint.y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    
                    // Borde blanco
                    ctx.lineWidth = 2 * scaleFactor;
                    ctx.strokeStyle = '#ffffff';
                    ctx.stroke();
                    
                    // Texto del elemento
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    if (elemento.tipo === 'valvula' && texto.length <= 2) {
                        ctx.font = `bold ${10 * scaleFactor}px Arial`;
                        ctx.fillText(texto, canvasPoint.x, canvasPoint.y);
                    } else {
                        ctx.font = `${9 * scaleFactor}px Arial`;
                        const textoMostrar = texto.length > 3 ? texto.substring(0, 3) + '.' : texto;
                        ctx.fillText(textoMostrar, canvasPoint.x, canvasPoint.y);
                    }
                }
            });
            
            // 4. Dibujar puntos de tuberías
            puntosTuberias.forEach(punto => {
                if (punto.latlng) {
                    const canvasPoint = latLngToCanvas(punto.latlng);
                    const radius = 8 * scaleFactor;
                    
                    ctx.beginPath();
                    ctx.arc(canvasPoint.x, canvasPoint.y, radius, 0, Math.PI * 2);
                    
                    // Color según tipo de tubería (COLORES ACTUALIZADOS)
                    let color;
                    switch(punto.tipo) {
                        case 'principal': color = '#ff0000'; break; // ROJO
                        case 'secundaria': color = '#0000ff'; break; // AZUL
                        case 'regante': color = '#00ff00'; break; // VERDE
                        default: color = '#000000';
                    }
                    
                    ctx.fillStyle = color;
                    ctx.fill();
                    
                    // Borde blanco
                    ctx.lineWidth = 2 * scaleFactor;
                    ctx.strokeStyle = '#ffffff';
                    ctx.stroke();
                }
            });
            
            // 5. DIBUJAR FLECHA DEL NORTE
            const norteX = 40 * scaleFactor;
            const norteY = 40 * scaleFactor;
            
            // Círculo de fondo
            ctx.beginPath();
            ctx.arc(norteX, norteY, 20 * scaleFactor, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 2 * scaleFactor;
            ctx.stroke();
            
            // Flecha del norte
            ctx.beginPath();
            ctx.moveTo(norteX, norteY - 15 * scaleFactor);
            ctx.lineTo(norteX - 5 * scaleFactor, norteY - 5 * scaleFactor);
            ctx.lineTo(norteX + 5 * scaleFactor, norteY - 5 * scaleFactor);
            ctx.closePath();
            ctx.fillStyle = '#ff0000';
            ctx.fill();
            
            // Cuerpo de la flecha
            ctx.fillStyle = '#000000';
            ctx.fillRect(norteX - 3 * scaleFactor, norteY - 5 * scaleFactor, 6 * scaleFactor, 12 * scaleFactor);
            
            // Letra "N"
            ctx.fillStyle = '#000000';
            ctx.font = `bold ${12 * scaleFactor}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('N', norteX, norteY + 10 * scaleFactor);
            
            // Línea de referencia
            ctx.beginPath();
            ctx.moveTo(norteX, norteY + 20 * scaleFactor);
            ctx.lineTo(norteX, norteY + 25 * scaleFactor);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1 * scaleFactor;
            ctx.stroke();
            
            // Texto "Norte"
            ctx.fillStyle = '#333333';
            ctx.font = `${9 * scaleFactor}px Arial`;
            ctx.fillText('Norte', norteX, norteY + 35 * scaleFactor);
            
            // 6. Añadir escala gráfica profesional
            const scaleX = canvasWidth - 120 * scaleFactor;
            const scaleY = canvasHeight - 40 * scaleFactor;
            
            // Calcular escala real basada en la relación de latitud/longitud
            const realWidthMeters = bounds.getNorthEast().distanceTo(
                L.latLng(bounds.getNorthEast().lat, bounds.getSouthWest().lng)
            );
            
            // Escala sugerida: 100m o la distancia más apropiada
            let scaleMeters = 100;
            if (realWidthMeters < 50) scaleMeters = 10;
            else if (realWidthMeters < 200) scaleMeters = 50;
            else if (realWidthMeters > 1000) scaleMeters = 500;
            
            const scalePixels = (scaleMeters / realWidthMeters) * canvasWidth;
            
            // Fondo de escala
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(scaleX - 10, scaleY - 15, 130 * scaleFactor, 30 * scaleFactor);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 1 * scaleFactor;
            ctx.strokeRect(scaleX - 10, scaleY - 15, 130 * scaleFactor, 30 * scaleFactor);
            
            // Línea de escala
            ctx.beginPath();
            ctx.moveTo(scaleX, scaleY);
            ctx.lineTo(scaleX + scalePixels, scaleY);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2 * scaleFactor;
            ctx.stroke();
            
            // Marcas de escala
            ctx.beginPath();
            ctx.moveTo(scaleX, scaleY - 5);
            ctx.lineTo(scaleX, scaleY + 5);
            ctx.moveTo(scaleX + scalePixels/2, scaleY - 5);
            ctx.lineTo(scaleX + scalePixels/2, scaleY + 5);
            ctx.moveTo(scaleX + scalePixels, scaleY - 5);
            ctx.lineTo(scaleX + scalePixels, scaleY + 5);
            ctx.stroke();
            
            // Texto de escala
            ctx.fillStyle = '#333333';
            ctx.font = `${8 * scaleFactor}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('0', scaleX, scaleY + 15);
            ctx.fillText(`${scaleMeters/2}`, scaleX + scalePixels/2, scaleY + 15);
            ctx.fillText(`${scaleMeters} m`, scaleX + scalePixels, scaleY + 15);
            ctx.fillText('ESCALA', scaleX + scalePixels/2, scaleY - 10);
            
            // 7. Añadir leyenda profesional
            const legendX = 10 * scaleFactor;
            const legendY = canvasHeight - 150 * scaleFactor;
            const legendItemHeight = 20 * scaleFactor;
            
            // Fondo de leyenda
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(legendX, legendY, 180 * scaleFactor, 140 * scaleFactor);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 1 * scaleFactor;
            ctx.strokeRect(legendX, legendY, 180 * scaleFactor, 140 * scaleFactor);
            
            ctx.fillStyle = '#333333';
            ctx.font = `${12 * scaleFactor}px Arial`;
            ctx.textAlign = 'left';
            ctx.fillText('LEYENDA', legendX + 10 * scaleFactor, legendY + 15 * scaleFactor);
            
            // Ítems de leyenda
            const legendItems = [
                { color: '#008a45', text: 'Terreno (Polígono)', icon: 'fa-square' },
                { color: '#ff0000', text: 'Tubería Principal', icon: 'fa-minus' },
                { color: '#0000ff', text: 'Tubería Secundaria', icon: 'fa-minus' },
                { color: '#00ff00', text: 'Tubería Regante', icon: 'fa-minus' },
                { color: '#1772af', text: 'Cabezal', icon: 'fa-gear' },
                { color: '#ff6b6b', text: 'Válvula', icon: 'fa-toggle-on' },
                { color: '#ff9f43', text: 'Purga Terminal', icon: 'fa-faucet' },
                { color: '#00a553', text: 'Toma de Agua', icon: 'fa-tint' },
                { color: '#4ecdc4', text: 'Filtro', icon: 'fa-filter' }
            ];
            
            legendItems.forEach((item, index) => {
                const y = legendY + 30 * scaleFactor + (index * legendItemHeight);
                
                // Dibujar ícono/color
                if (item.icon === 'fa-square') {
                    // Para terreno: cuadrado
                    ctx.fillStyle = item.color;
                    ctx.fillRect(legendX + 10 * scaleFactor, y - 6 * scaleFactor, 12 * scaleFactor, 12 * scaleFactor);
                } else if (item.icon === 'fa-minus') {
                    // Para tuberías: línea
                    ctx.beginPath();
                    ctx.moveTo(legendX + 10 * scaleFactor, y);
                    ctx.lineTo(legendX + 22 * scaleFactor, y);
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 3 * scaleFactor;
                    ctx.stroke();
                } else {
                    // Para elementos: círculo
                    ctx.beginPath();
                    ctx.arc(legendX + 16 * scaleFactor, y, 6 * scaleFactor, 0, Math.PI * 2);
                    ctx.fillStyle = item.color;
                    ctx.fill();
                    
                    // Borde blanco
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1 * scaleFactor;
                    ctx.stroke();
                    
                    // Simular ícono con texto
                    ctx.fillStyle = '#ffffff';
                    ctx.font = `${8 * scaleFactor}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    let iconChar = '';
                    switch(item.icon) {
                        case 'fa-gear': iconChar = '⚙'; break;
                        case 'fa-toggle-on': iconChar = 'V'; break;
                        case 'fa-faucet': iconChar = 'P'; break;
                        case 'fa-tint': iconChar = 'T'; break;
                        case 'fa-filter': iconChar = 'F'; break;
                        default: iconChar = '●';
                    }
                    
                    ctx.fillText(iconChar, legendX + 16 * scaleFactor, y);
                }
                
                // Texto
                ctx.fillStyle = '#333333';
                ctx.font = `${9 * scaleFactor}px Arial`;
                ctx.textAlign = 'left';
                ctx.fillText(item.text, legendX + 30 * scaleFactor, y + 3 * scaleFactor);
            });
            
            // Convertir a imagen y agregar al PDF
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            
            // Añadir imagen al PDF
            doc.addImage(imageData, 'JPEG', pdfX, pdfY, finalWidth, finalHeight);
            currentY = pdfY + finalHeight + 10;
            
            // Pie de foto profesional
            doc.setFontSize(9);
            doc.setTextColor(colores.textoClaro);
            
            // Información de escala real
            const escalaReal = `1:${Math.round(realWidthMeters / (finalWidth / 1000))}`;
            doc.text(`Figura 1: Plano del sistema de riego | Escala aproximada: ${escalaReal}`, 
                    105, currentY, { align: 'center' });
            
            // Mostrar dimensiones del diseño
            const diseñoWidth = realWidthMeters.toFixed(0);
            const diseñoHeight = bounds.getNorthEast().distanceTo(
                L.latLng(bounds.getSouthWest().lat, bounds.getNorthEast().lng)
            ).toFixed(0);
            
            currentY += 5;
            doc.text(`Dimensiones del diseño: ${diseñoWidth}m × ${diseñoHeight}m`, 
                    105, currentY, { align: 'center' });
            
            currentY += 10;
            
        } catch (imageError) {
            console.error('Error generando imagen del diseño:', imageError);
            
            // Continuar sin imagen si hay error
            doc.setFontSize(10);
            doc.setTextColor(colores.peligro);
            doc.text('Nota: No se pudo generar la imagen del diseño.', 105, currentY, { align: 'center' });
            currentY += 10;
            
            // Mostrar información de resumen
            doc.setFontSize(10);
            doc.setTextColor(colores.texto);
            
            if (numPoligonos > 0) {
                doc.text(`Área del terreno: ${areaTotalTerreno.toFixed(0)} m² (${(areaTotalTerreno / 10000).toFixed(2)} ha)`, 20, currentY);
                currentY += 7;
                doc.text(`Perímetro total: ${perimetroTotalTerreno.toFixed(0)} m`, 20, currentY);
                currentY += 7;
                doc.text(`Polígonos: ${numPoligonos}`, 20, currentY);
                currentY += 7;
            }
            
            doc.text(`Tuberías: ${tuberias.length}`, 20, currentY);
            currentY += 7;
            doc.text(`Válvulas: ${valvulas.length}`, 20, currentY);
            currentY += 7;
            doc.text(`Elementos: ${elementosGraficos.length}`, 20, currentY);
            currentY += 10;
        }
        
        // ====================================================================
        // PÁGINA 5: INFORMACIÓN DEL TERRENO
        // ====================================================================
        doc.addPage();
        // Encabezado de página
        doc.setFillColor(colores.primario);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('3. INFORMACIÓN DEL TERRENO', 105, 20, { align: 'center' });
        
        currentY = 40;
        
        if (areaTotalTerreno > 0) {
            // Información general del terreno
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.primario);
            doc.text('CARACTERÍSTICAS DEL TERRENO', 20, currentY);
            
            currentY += 10;
            
            const caracteristicas = [
                ['Área Total:', `${areaTotalTerreno.toFixed(2)} m²`],
                ['En Hectáreas:', `${(areaTotalTerreno / 10000).toFixed(3)} ha`],
                ['Perímetro Total:', `${perimetroTotalTerreno.toFixed(2)} m`],
                ['Número de Polígonos:', `${numPoligonos}`],
                ['Ubicación Aproximada:', `${map.getCenter().lat.toFixed(6)}°, ${map.getCenter().lng.toFixed(6)}°`]
            ];
            
            caracteristicas.forEach((caract, index) => {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colores.texto);
                doc.text(caract[0], 25, currentY + (index * 7));
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colores.acento);
                doc.text(caract[1], 90, currentY + (index * 7));
            });
            
            currentY += 40;
            
            // Detalle de polígonos
            if (detallesPoligonos.length > 0) {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colores.primario);
                doc.text('DETALLE DE POLÍGONOS', 20, currentY);
                
                currentY += 15;
                
                // Encabezado de tabla
                doc.setFillColor(colores.fondo);
                doc.rect(20, currentY, 170, 8, 'F');
                
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colores.texto);
                doc.text('Polígono', 25, currentY + 6);
                doc.text('Área (m²)', 70, currentY + 6);
                doc.text('Hectáreas', 100, currentY + 6);
                doc.text('Perímetro (m)', 140, currentY + 6);
                doc.text('Lados', 180, currentY + 6, { align: 'right' });
                
                currentY += 12;
                
                // Filas de polígonos
                detallesPoligonos.forEach((poligono, index) => {
                    if (index % 2 === 0) {
                        doc.setFillColor(255, 255, 255);
                    } else {
                        doc.setFillColor(colores.fondo);
                    }
                    doc.rect(20, currentY, 170, 7, 'F');
                    
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(colores.texto);
                    doc.text(`P-${poligono.numero}`, 25, currentY + 5);
                    doc.text(poligono.area.toFixed(1), 70, currentY + 5);
                    doc.text((poligono.area / 10000).toFixed(3), 100, currentY + 5);
                    doc.text(poligono.perimetro.toFixed(1), 140, currentY + 5);
                    doc.text(poligono.lados.toString(), 180, currentY + 5, { align: 'right' });
                    
                    currentY += 8;
                });
                
                // Totales
                currentY += 5;
                doc.setDrawColor(colores.borde);
                doc.setLineWidth(0.5);
                doc.line(20, currentY, 190, currentY);
                
                currentY += 8;
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colores.primario);
                doc.text('TOTALES:', 25, currentY);
                doc.text(areaTotalTerreno.toFixed(1), 70, currentY);
                doc.text((areaTotalTerreno / 10000).toFixed(3), 100, currentY);
                doc.text(perimetroTotalTerreno.toFixed(1), 140, currentY);
            }
        } else {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(colores.textoClaro);
            doc.text('No se ha definido ningún polígono de terreno.', 20, currentY);
        }
        
        // ====================================================================
        // PÁGINA 6: DISEÑO HIDRÁULICO
        // ====================================================================
        doc.addPage();
        // Encabezado de página
        doc.setFillColor(colores.primario);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('4. DISEÑO HIDRÁULICO', 105, 20, { align: 'center' });
        
        currentY = 40;
        
        if (valvulas.length > 0) {
            // Resumen de válvulas
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.primario);
            doc.text('VÁLVULAS DE CONTROL', 20, currentY);
            
            currentY += 15;
            
            // Encabezado de tabla
            doc.setFillColor(colores.fondo);
            doc.rect(20, currentY, 170, 8, 'F');
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.texto);
            doc.text('Válvula', 25, currentY + 6);
            doc.text('Tipo', 50, currentY + 6);
            doc.text('Diámetro', 75, currentY + 6);
            doc.text('Presión', 95, currentY + 6);
            doc.text('Emisores', 115, currentY + 6);
            doc.text('Caudal (L/h)', 150, currentY + 6, { align: 'right' });
            
            currentY += 12;
            
            // Filas de válvulas
            valvulas.forEach((valvula, index) => {
                if (index % 2 === 0) {
                    doc.setFillColor(255, 255, 255);
                } else {
                    doc.setFillColor(colores.fondo);
                }
                doc.rect(20, currentY, 170, 7, 'F');
                
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colores.texto);
                doc.text(valvula.nombre, 25, currentY + 5);
                doc.text(valvula.tipo, 50, currentY + 5);
                doc.text(valvula.diametro, 75, currentY + 5);
                doc.text(`${valvula.presion} bar`, 95, currentY + 5);
                doc.text(valvula.numeroEmisores.toString(), 115, currentY + 5);
                doc.text(valvula.caudalTotal.toString(), 150, currentY + 5, { align: 'right' });
                
                currentY += 8;
            });
            
            // Totales caudal
            currentY += 5;
            doc.setDrawColor(colores.borde);
            doc.setLineWidth(0.5);
            doc.line(20, currentY, 190, currentY);
            
            currentY += 8;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.primario);
            doc.text('CAUDAL TOTAL DEL SISTEMA:', 25, currentY);
            doc.text(`${caudalTotalSistema.toFixed(0)} L/h (${(caudalTotalSistema / 3600).toFixed(1)} L/s)`, 150, currentY, { align: 'right' });
            
            currentY += 20;
            
            // Cálculos de lámina de riego
            if (areaTotalTerreno > 0 && caudalTotalSistema > 0) {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colores.primario);
                doc.text('CÁLCULOS DE RIEGO', 20, currentY);
                
                currentY += 10;
                
                const laminaPorHora = caudalTotalSistema / (areaTotalTerreno * 1000);
                const horasPara10mm = 10 / laminaPorHora;
                const horasPara20mm = 20 / laminaPorHora;
                
                const calculos = [
                    ['Lámina de riego por hora:', `${laminaPorHora.toFixed(3)} mm/h`],
                    ['Tiempo para aplicar 10 mm:', `${horasPara10mm.toFixed(1)} horas`],
                    ['Tiempo para aplicar 20 mm:', `${horasPara20mm.toFixed(1)} horas`],
                    ['Volumen diario (8 horas):', `${(caudalTotalSistema * 8 / 1000).toFixed(1)} m³/día`]
                ];
                
                calculos.forEach((calc, index) => {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(colores.texto);
                    doc.text(calc[0], 25, currentY + (index * 7));
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(colores.acento);
                    doc.text(calc[1], 120, currentY + (index * 7));
                });
            }
        }
        
        // ====================================================================
        // PÁGINA 7: TUBERÍAS Y CONEXIONES
        // ====================================================================
        doc.addPage();
        // Encabezado de página
        doc.setFillColor(colores.primario);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('5. TUBERÍAS Y CONEXIONES', 105, 20, { align: 'center' });
        
        currentY = 40;
        
        if (tuberias.length > 0) {
            // Resumen por tipo de tubería
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.primario);
            doc.text('RESUMEN DE TUBERÍAS POR TIPO', 20, currentY);
            
            currentY += 15;
            
            // Ordenar por tipo: principal, secundaria, regante
            const tiposOrden = ['principal', 'secundaria', 'regante'];
            const itemsOrdenados = Object.values(resumenTuberias).sort((a, b) => {
                return tiposOrden.indexOf(a.tipo) - tiposOrden.indexOf(b.tipo);
            });
            
            // Tabla de resumen
            doc.setFillColor(colores.fondo);
            doc.rect(20, currentY, 170, 8, 'F');
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.texto);
            doc.text('Tipo', 25, currentY + 6);
            doc.text('Diámetro', 70, currentY + 6);
            doc.text('Material', 100, currentY + 6);
            doc.text('Cantidad', 130, currentY + 6);
            doc.text('Longitud (m)', 170, currentY + 6, { align: 'right' });
            
            currentY += 12;
            
            itemsOrdenados.forEach((item, index) => {
                if (index % 2 === 0) {
                    doc.setFillColor(255, 255, 255);
                } else {
                    doc.setFillColor(colores.fondo);
                }
                doc.rect(20, currentY, 170, 7, 'F');
                
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colores.texto);
                
                // Nombre del tipo con primera letra mayúscula
                const tipoNombre = item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1);
                doc.text(tipoNombre, 25, currentY + 5);
                doc.text(`${item.diametro}"`, 70, currentY + 5);
                doc.text(item.material, 100, currentY + 5);
                doc.text(item.cantidad.toString(), 130, currentY + 5);
                doc.text(item.longitudTotal.toFixed(1), 170, currentY + 5, { align: 'right' });
                
                currentY += 8;
            });
            
            // Total general
            currentY += 5;
            doc.setDrawColor(colores.borde);
            doc.setLineWidth(0.5);
            doc.line(20, currentY, 190, currentY);
            
            currentY += 8;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.primario);
            doc.text('LONGITUD TOTAL:', 25, currentY);
            doc.text(`${longitudTotalTuberias.toFixed(1)} m`, 170, currentY, { align: 'right' });
            
            currentY += 20;
            
            // Conexiones y accesorios
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.primario);
            doc.text('CONEXIONES Y ACCESORIOS', 20, currentY);
            
            currentY += 10;
            
            // Calcular conexiones aproximadas
            const conexionesEstimadas = Math.ceil(tuberias.length * 1.5);
            const codosEstimados = Math.ceil(tuberias.length * 0.8);
            const teesEstimadas = Math.ceil(tuberias.length * 0.3);
            
            const accesorios = [
                ['Conexiones totales estimadas:', `${conexionesEstimadas}`],
                ['Codos 90° aproximados:', `${codosEstimados}`],
                ['Tees aproximadas:', `${teesEstimadas}`],
                ['Uniones rápidas:', `${Math.ceil(tuberias.length * 0.5)}`]
            ];
            
            accesorios.forEach((accesorio, index) => {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colores.texto);
                doc.text(accesorio[0], 25, currentY + (index * 7));
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colores.acento);
                doc.text(accesorio[1], 120, currentY + (index * 7));
            });
        }
        
        // ====================================================================
        // PÁGINA 8: EQUIPOS Y ELEMENTOS
        // ====================================================================
        doc.addPage();
        // Encabezado de página
        doc.setFillColor(colores.primario);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('6. EQUIPOS Y ELEMENTOS', 105, 20, { align: 'center' });
        
        currentY = 40;
        
        // Cabezal de bombeo
        if (cabezales.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.primario);
            doc.text('CABEZAL DE BOMBEO Y FILTRACIÓN', 20, currentY);
            
            currentY += 15;
            
            cabezales.forEach((cabezal, index) => {
                if (index > 0) {
                    currentY += 10;
                }
                
                const datosCabezal = [
                    ['Caudal de bomba:', `${cabezal.caudalBomba} L/s (${(cabezal.caudalBomba * 3600).toFixed(0)} L/h)`],
                    ['Diámetro succión:', cabezal.diametroSuccion],
                    ['Diámetro descarga:', cabezal.diametroDescarga],
                    ['Número de filtros:', cabezal.numeroFiltros.toString()],
                    ['Tipo de filtros:', cabezal.tipoFiltros]
                ];
                
                datosCabezal.forEach((dato, idx) => {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(colores.texto);
                    doc.text(dato[0], 25, currentY);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(colores.acento);
                    doc.text(dato[1], 100, currentY);
                    currentY += 7;
                });
                
                if (cabezal.notas && cabezal.notas.trim() !== '') {
                    currentY += 3;
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'italic');
                    doc.setTextColor(colores.textoClaro);
                    doc.text('Notas:', 25, currentY);
                    currentY += 5;
                    const lineasNotas = doc.splitTextToSize(cabezal.notas, 150);
                    lineasNotas.forEach(linea => {
                        doc.text(linea, 30, currentY);
                        currentY += 5;
                    });
                }
            });
            
            currentY += 10;
        }
        
        // Resumen de elementos
        if (elementosGraficos.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.primario);
            doc.text('ELEMENTOS DEL SISTEMA', 20, currentY);
            
            currentY += 15;
            
            // Contar elementos por tipo
            const elementosPorTipo = {};
            elementosGraficos.forEach(elemento => {
                if (!elementosPorTipo[elemento.tipo]) {
                    elementosPorTipo[elemento.tipo] = 0;
                }
                elementosPorTipo[elemento.tipo]++;
            });
            
            // Mostrar resumen
            const tiposElementos = ['cabezal', 'valvula', 'purgaterminal', 'tomagua', 'filtro'];
            let columna = 0;
            const anchoColumna = 85;
            
            tiposElementos.forEach((tipo, index) => {
                if (elementosPorTipo[tipo]) {
                    const x = 25 + (columna * anchoColumna);
                    const y = currentY + (Math.floor(columna / 2) * 15);
                    
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(colores.texto);
                    
                    // Nombre del tipo
                    let nombreTipo = '';
                    switch(tipo) {
                        case 'cabezal': nombreTipo = 'Cabezales'; break;
                        case 'valvula': nombreTipo = 'Válvulas'; break;
                        case 'purgaterminal': nombreTipo = 'Purgas'; break;
                        case 'tomagua': nombreTipo = 'Tomas agua'; break;
                        case 'filtro': nombreTipo = 'Filtros'; break;
                        default: nombreTipo = tipo;
                    }
                    
                    doc.text(nombreTipo, x, y);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(colores.acento);
                    doc.text(`: ${elementosPorTipo[tipo]}`, x + 40, y);
                    
                    columna++;
                }
            });
        }
        
        // ====================================================================
        // PÁGINA 9: CÁLCULOS TÉCNICOS
        // ====================================================================
        doc.addPage();
        // Encabezado de página
        doc.setFillColor(colores.primario);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('7. CÁLCULOS TÉCNICOS', 105, 20, { align: 'center' });
        
        currentY = 40;
        
        // Análisis hidráulico
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.primario);
        doc.text('ANÁLISIS HIDRÁULICO', 20, currentY);
        
        currentY += 10;
        
        if (cabezales.length > 0 && valvulas.length > 0) {
            const cabezalPrincipal = cabezales[0];
            const caudalCabezal = cabezalPrincipal.caudalBomba * 1000; // L/h
            const diferencia = caudalCabezal - caudalTotalSistema;
            const porcentaje = (diferencia / caudalCabezal) * 100;
            
            const analisis = [
                ['Caudal disponible (cabezal):', `${caudalCabezal.toFixed(0)} L/h (${cabezalPrincipal.caudalBomba} L/s)`],
                ['Caudal requerido (válvulas):', `${caudalTotalSistema.toFixed(0)} L/h (${(caudalTotalSistema / 3600).toFixed(1)} L/s)`],
                ['Diferencia:', `${diferencia.toFixed(0)} L/h (${(diferencia / 3600).toFixed(1)} L/s)`],
                ['Porcentaje:', `${Math.abs(porcentaje).toFixed(1)}%`]
            ];
            
            analisis.forEach((item, index) => {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colores.texto);
                doc.text(item[0], 25, currentY + (index * 7));
                doc.setFont('helvetica', 'normal');
                
                // Color según si hay déficit o sobrecapacidad
                if (index === 3) { // Porcentaje
                    if (diferencia >= 0) {
                        doc.setTextColor(colores.exito); // Verde para sobrecapacidad
                    } else {
                        doc.setTextColor(colores.peligro); // Rojo para déficit
                    }
                } else {
                    doc.setTextColor(colores.acento);
                }
                
                doc.text(item[1], 120, currentY + (index * 7));
            });
            
            currentY += 35;
            
            // Evaluación del sistema
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colores.primario);
            doc.text('EVALUACIÓN DEL SISTEMA', 20, currentY);
            
            currentY += 10;
            
            let evaluacion = '';
            let colorEvaluacion = colores.texto;
            
            if (diferencia >= (caudalTotalSistema * 0.2)) {
                evaluacion = 'SOBRECAPACIDAD - El cabezal tiene capacidad suficiente con margen de seguridad adecuado.';
                colorEvaluacion = colores.exito;
            } else if (diferencia >= 0) {
                evaluacion = 'CAPACIDAD ADECUADA - El cabezal cubre los requerimientos del sistema.';
                colorEvaluacion = colores.exito;
            } else if (diferencia >= -(caudalTotalSistema * 0.1)) {
                evaluacion = 'LIGERO DÉFICIT - El cabezal está ligeramente subdimensionado. Considerar ajustes menores.';
                colorEvaluacion = colores.advertencia;
            } else {
                evaluacion = 'DÉFICIT SIGNIFICATIVO - El cabezal no cubre los requerimientos. Se requiere rediseño.';
                colorEvaluacion = colores.peligro;
            }
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colorEvaluacion);
            const lineasEvaluacion = doc.splitTextToSize(evaluacion, 160);
            lineasEvaluacion.forEach(linea => {
                doc.text(linea, 25, currentY);
                currentY += 6;
            });
        }
        
        // ====================================================================
        // PÁGINA 10: ESPECIFICACIONES TÉCNICAS
        // ====================================================================
        doc.addPage();
        // Encabezado de página
        doc.setFillColor(colores.primario);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('8. ESPECIFICACIONES TÉCNICAS', 105, 20, { align: 'center' });
        
        currentY = 40;
        
        // Especificaciones generales
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.primario);
        doc.text('ESPECIFICACIONES GENERALES', 20, currentY);
        
        currentY += 10;
        
        const especificaciones = [
            '• Todas las tuberías deben ser de PVC grado hidráulico',
            '• Las conexiones deben ser del mismo material que las tuberías',
            '• Válvulas manuales con cuerpo de latón o PVC',
            '• Filtración mínima de 120 mesh para sistemas de goteo',
            '• Presión de trabajo: 2-4 bar según diseño',
            '• Todas las uniones deben ser herméticas y probadas',
            '• Protección catódica en zonas con alta conductividad',
            '• Marcado de tuberías según norma de colores'
        ];
        
        especificaciones.forEach((espec, index) => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colores.texto);
            doc.text(espec, 25, currentY + (index * 7), { maxWidth: 160 });
        });
        
        currentY += 60;
        
        // Normas aplicables
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.primario);
        doc.text('NORMAS Y ESTÁNDARES', 20, currentY);
        
        currentY += 10;
        
        const normas = [
            '• NMX-AA-XXX Sistemas de riego agrícola',
            '• NMX-E-XXX Tuberías de PVC para riego',
            '• ISO 9001:2015 Sistemas de gestión de calidad',
            '• Normas oficiales mexicanas de la CONAGUA',
            '• Reglamento de construcción local'
        ];
        
        normas.forEach((norma, index) => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colores.texto);
            doc.text(norma, 25, currentY + (index * 7), { maxWidth: 160 });
        });
        
        // ====================================================================
        // PÁGINA 11: RECOMENDACIONES
        // ====================================================================
        doc.addPage();
        // Encabezado de página
        doc.setFillColor(colores.primario);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('9. RECOMENDACIONES', 105, 20, { align: 'center' });
        
        currentY = 40;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.primario);
        doc.text('RECOMENDACIONES TÉCNICAS', 20, currentY);
        
        currentY += 10;
        
        // Generar recomendaciones basadas en el análisis
        const recomendaciones = [];
        
        if (areaTotalTerreno > 0 && caudalTotalSistema > 0) {
            const laminaPorHora = caudalTotalSistema / (areaTotalTerreno * 1000);
            
            if (laminaPorHora > 2) {
                recomendaciones.push('• Lámina de riego alta (>2 mm/h). Considerar reducir tiempo de riego o aumentar área regada.');
            } else if (laminaPorHora < 0.5) {
                recomendaciones.push('• Lámina de riego baja (<0.5 mm/h). Considerar aumentar tiempo de riego o caudal.');
            } else {
                recomendaciones.push('• Lámina de riego adecuada para la mayoría de cultivos (0.5-2 mm/h).');
            }
        }
        
        if (cabezales.length > 0 && valvulas.length > 0) {
            const cabezalPrincipal = cabezales[0];
            const caudalCabezal = cabezalPrincipal.caudalBomba * 1000;
            const diferencia = caudalCabezal - caudalTotalSistema;
            
            if (diferencia < 0) {
                recomendaciones.push(`• El cabezal tiene insuficiente capacidad. Se requiere aumentar en ${Math.abs(diferencia).toFixed(0)} L/h.`);
            } else if (diferencia > caudalTotalSistema * 0.5) {
                recomendaciones.push('• El cabezal tiene excesiva capacidad. Considerar reducir tamaño para ahorro energético.');
            } else {
                recomendaciones.push('• El cabezal está correctamente dimensionado para el sistema.');
            }
        }
        
        if (valvulas.length < 3 && areaTotalTerreno > 5000) {
            recomendaciones.push('• Pocas válvulas para el área. Considerar dividir en más sectores para mejor control.');
        }
        
        if (tuberias.length > 20) {
            recomendaciones.push('• Sistema extenso de tuberías. Considerar válvulas de purga en puntos bajos.');
        }
        
        if (recomendaciones.length === 0) {
            recomendaciones.push('• El sistema está bien dimensionado. Continuar con el diseño detallado.');
            recomendaciones.push('• Realizar pruebas de presión antes de la puesta en marcha.');
            recomendaciones.push('• Implementar programa de mantenimiento preventivo.');
        }
        
        // Recomendaciones estándar
        recomendaciones.push('• Realizar pruebas hidráulicas antes de la puesta en marcha.');
        recomendaciones.push('• Capacitar al personal en operación y mantenimiento.');
        recomendaciones.push('• Implementar programa de monitoreo de presión y caudal.');
        recomendaciones.push('• Considerar automatización para optimizar el uso de agua.');
        
        recomendaciones.forEach((recom, index) => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colores.texto);
            const lineas = doc.splitTextToSize(recom, 160);
            lineas.forEach(linea => {
                doc.text(linea, 25, currentY);
                currentY += 6;
            });
            currentY += 2;
        });
        
        currentY += 10;
        
        // Observaciones finales
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.primario);
        doc.text('OBSERVACIONES FINALES', 20, currentY);
        
        currentY += 10;
        
        const observaciones = [
            'Este documento constituye una memoria técnica preliminar.',
            'Para el diseño ejecutivo, se requiere:',
            '  - Topografía detallada del terreno',
            '  - Análisis de suelo y agua',
            '  - Diseño estructural de soportes',
            '  - Cálculo eléctrico para automatización',
            '  - Presupuesto detallado'
        ];
        
        observaciones.forEach((obs, index) => {
            doc.setFontSize(10);
            doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
            doc.setTextColor(index === 0 ? colores.texto : colores.textoClaro);
            doc.text(obs, 25, currentY);
            currentY += 7;
        });
        
        // ====================================================================
        // PÁGINA 12: FIRMAS Y ANEXOS
        // ====================================================================
        doc.addPage();
        // Encabezado de página
        doc.setFillColor(colores.primario);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('ANEXOS Y FIRMAS', 105, 20, { align: 'center' });
        
        currentY = 60;
        
        // Firma diseñador
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.texto);
        doc.text('ELABORADO POR:', 20, currentY);
        
        doc.setDrawColor(colores.borde);
        doc.setLineWidth(0.5);
        doc.line(20, currentY + 5, 100, currentY + 5);
        
        currentY += 20;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.textoClaro);
        doc.text('Ing. Responsable del Diseño', 20, currentY);
        
        currentY += 30;
        
        // Firma revisión
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.texto);
        doc.text('REVISADO POR:', 20, currentY);
        
        doc.setDrawColor(colores.borde);
        doc.line(20, currentY + 5, 100, currentY + 5);
        
        currentY += 20;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.textoClaro);
        doc.text('Ing. Responsable de Proyectos', 20, currentY);
        
        currentY += 30;
        
        // Firma aprobación
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.texto);
        doc.text('APROBADO POR:', 20, currentY);
        
        doc.setDrawColor(colores.borde);
        doc.line(20, currentY + 5, 100, currentY + 5);
        
        currentY += 20;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.textoClaro);
        doc.text('Director Técnico Agrosistemas', 20, currentY);
        
        currentY += 40;
        
        // Firma cliente
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.texto);
        doc.text('CONFORMIDAD DEL CLIENTE:', 20, currentY);
        
        doc.setDrawColor(colores.borde);
        doc.line(20, currentY + 5, 100, currentY + 5);
        
        currentY += 20;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.textoClaro);
        doc.text('Representante Legal del Cliente', 20, currentY);
        
        currentY += 40;
        
        // Sello y fecha
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.primario);
        doc.text('FECHA DE EMISIÓN:', 20, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.texto);
        doc.text(new Date().toLocaleDateString('es-MX'), 70, currentY);
        
        currentY += 10;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colores.primario);
        doc.text('VIGENCIA:', 20, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colores.texto);
        
        // Calcular fecha de vigencia (6 meses)
        const fechaVigencia = new Date();
        fechaVigencia.setMonth(fechaVigencia.getMonth() + 6);
        doc.text(fechaVigencia.toLocaleDateString('es-MX'), 70, currentY);
        
        // ====================================================================
        // NUMERAR PÁGINAS Y PIE DE PÁGINA
        // ====================================================================
        const totalPaginas = doc.internal.getNumberOfPages();
        
        for (let i = 1; i <= totalPaginas; i++) {
            doc.setPage(i);
            
            // Pie de página
            doc.setFontSize(8);
            doc.setTextColor(colores.textoClaro);
            
            // Línea separadora
            doc.setDrawColor(colores.borde);
            doc.setLineWidth(0.3);
            doc.line(15, 285, 195, 285);
            
            // Información pie de página
            doc.text(`Agrosistemas - Memoria Técnica Sistema de Riego - Página ${i} de ${totalPaginas}`, 105, 290, { align: 'center' });
            
            if (i > 1 && i < totalPaginas) {
                // Número de página en esquina
                doc.setFontSize(9);
                doc.setTextColor(colores.primario);
                doc.text(i.toString(), 200, 15, { align: 'right' });
            }
        }
        
        // ====================================================================
        // GUARDAR PDF
        // ====================================================================
        const fechaHora = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const nombreArchivo = `Memoria_Tecnica_Riego_Agrosistemas_${fechaHora}.pdf`;
        
        mostrarMensaje(`Memoria técnica generada exitosamente: ${nombreArchivo}`, 5000);
        
        doc.save(nombreArchivo);
        
    } catch (error) {
        console.error('Error en exportarPDF:', error);
        alert(`Error al generar el PDF: ${error.message}\n\nPor favor, intente nuevamente.`);
    }
}

// ============================================
// FUNCIONES DE UTILIDAD (MODIFICADAS)
// ============================================

function calcularCentroPoligono(latlngs) {
    let latSum = 0, lngSum = 0;
    latlngs.forEach(punto => {
        latSum += punto.lat;
        lngSum += punto.lng;
    });
    return L.latLng(latSum / latlngs.length, lngSum / latlngs.length);
}

// Modificar el evento de edición para actualizar medidas
map.on(L.Draw.Event.EDITED, function(event) {
    const layers = event.layers;
    layers.eachLayer(function(layer) {
        if (layer instanceof L.Polygon) {
            // Actualizar área y medidas
            const medidas = calcularAreaPoligono(layer);
            
            // Actualizar etiquetas de lados
            const latlngs = layer.getLatLngs()[0];
            actualizarEtiquetasLados(layer, latlngs);
            
            // Actualizar display general
            const areaDisplay = document.getElementById('areaDisplay');
            areaDisplay.textContent = 
                `Área: ${medidas.area.toFixed(2)} m² (${(medidas.area / 10000).toFixed(2)} ha) | Perímetro: ${medidas.perimetro.toFixed(2)} m`;
        } else if (layer instanceof L.Polyline) {
            calcularLongitudPolilinea(layer);
        }
    });
});

// Modificar el evento de eliminación para limpiar etiquetas
map.on(L.Draw.Event.DELETED, function(event) {
    const layers = event.layers;
    layers.eachLayer(function(layer) {
        if (layer instanceof L.Polygon) {
            // Eliminar etiquetas del polígono usando la nueva función
            eliminarEtiquetasPoligono(layer);
            
            areaTotal = 0;
            document.getElementById('areaDisplay').textContent = 'Área: 0 m²';
            actualizarResultados();
            mostrarControlesMapa();
        }
    });
});

// ============================================
// FUNCIONES DE CONTROLES DEL MAPA
// ============================================

function ocultarControlesMapa() {
    const controls = document.getElementById('mapaControls');
    controls.style.display = 'none';
    document.getElementById('showControlsBtn').style.display = 'block';
    document.getElementById('hideControlsBtn').style.display = 'none';
}

function mostrarControlesMapa() {
    const controls = document.getElementById('mapaControls');
    controls.style.display = 'block';
    document.getElementById('showControlsBtn').style.display = 'none';
    document.getElementById('hideControlsBtn').style.display = 'none';
}

function buscarUbicacion() {
    const query = document.getElementById('location-search').value;
    if (!query.trim()) return;
    
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                
                map.setView([lat, lon], 15);
                
                L.marker([lat, lon])
                    .addTo(map)
                    .bindPopup(`<b>${result.display_name}</b>`)
                    .openPopup();
            } else {
                alert('Ubicación no encontrada');
            }
        })
        .catch(error => {
            console.error('Error en la búsqueda:', error);
            alert('Error al buscar la ubicación');
        });
}

// ============================================
// FUNCIONES DE GESTIÓN DE DISEÑOS (MEJORADAS CON ETIQUETAS)
// ============================================

function guardarDiseño(nombre = null) {
    if (!nombre) {
        nombre = prompt('Nombre del diseño:', `Diseño_${new Date().toLocaleDateString()}`);
        if (!nombre) return;
    }
    
    const poligonosTerreno = [];
    drawnItems.eachLayer(function(layer) {
        if (layer instanceof L.Polygon) {
            const latlngs = layer.getLatLngs()[0];
            poligonosTerreno.push({
                latlngs: latlngs.map(latlng => [latlng.lat, latlng.lng]),
                color: layer.options.color,
                fillColor: layer.options.fillColor,
                fillOpacity: layer.options.fillOpacity,
                weight: layer.options.weight
            });
        }
    });
    
    let imagenDiseñoDataUrl = null;
    try {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = 400;
        tempCanvas.height = 300;
        
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, 400, 300);
        
        tempCtx.fillStyle = '#333';
        tempCtx.font = 'bold 16px Arial';
        tempCtx.textAlign = 'center';
        tempCtx.fillText('DISEÑO DE RIEGO', 200, 30);
        tempCtx.fillText(nombre, 200, 55);
        
        tempCtx.font = '12px Arial';
        tempCtx.textAlign = 'left';
        let infoY = 90;
        
        tempCtx.fillText(`• Área: ${areaTotal > 0 ? areaTotal.toFixed(0) + ' m²' : 'No definida'}`, 40, infoY);
        infoY += 25;
        tempCtx.fillText(`• Tuberías: ${tuberias.length}`, 40, infoY);
        infoY += 25;
        
        const tuberiasConAristas = tuberias.filter(t => {
            if (t.linea && t.linea.getLatLngs) {
                const puntos = t.linea.getLatLngs();
                if (Array.isArray(puntos) && puntos.length > 0) {
                    if (Array.isArray(puntos[0])) {
                        return puntos[0].length > 2;
                    }
                    return puntos.length > 2;
                }
            }
            return false;
        }).length;
        
        if (tuberiasConAristas > 0) {
            tempCtx.fillText(`• Con aristas: ${tuberiasConAristas}`, 40, infoY);
            infoY += 25;
        }
        
        tempCtx.fillText(`• Válvulas: ${valvulas.length}`, 40, infoY);
        infoY += 25;
        
        if (valvulas.length > 0) {
            tempCtx.fillText('Válvulas:', 40, infoY);
            infoY += 20;
            tempCtx.font = '10px Arial';
            
            valvulas.slice(0, 4).forEach(valvula => {
                tempCtx.fillText(`${valvula.nombre}: ${valvula.caudalTotal} L/h`, 60, infoY);
                infoY += 15;
            });
            
            if (valvulas.length > 4) {
                tempCtx.fillText(`+ ${valvulas.length - 4} más...`, 60, infoY);
            }
        }
        
        imagenDiseñoDataUrl = tempCanvas.toDataURL('image/jpeg', 0.8);
        
    } catch (error) {
        console.error('Error creando miniatura:', error);
    }
    
    function extraerPuntosLinea(linea) {
        const puntos = [];
        
        if (!linea || !linea.getLatLngs) {
            return puntos;
        }
        
        try {
            const latlngs = linea.getLatLngs();
            
            if (Array.isArray(latlngs) && latlngs.length > 0) {
                if (Array.isArray(latlngs[0]) && typeof latlngs[0][0] === 'object') {
                    latlngs.forEach(segmento => {
                        if (Array.isArray(segmento)) {
                            segmento.forEach(punto => {
                                if (punto && punto.lat && punto.lng) {
                                    puntos.push([punto.lat, punto.lng]);
                                }
                            });
                        }
                    });
                } else if (latlngs[0].lat) {
                    latlngs.forEach(punto => {
                        if (punto && punto.lat && punto.lng) {
                            puntos.push([punto.lat, punto.lng]);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error extrayendo puntos de línea:', error);
        }
        
        return puntos;
    }
    
    function calcularLongitudLinea(puntos) {
        let longitud = 0;
        for (let i = 0; i < puntos.length - 1; i++) {
            const punto1 = L.latLng(puntos[i][0], puntos[i][1]);
            const punto2 = L.latLng(puntos[i+1][0], puntos[i+1][1]);
            longitud += punto1.distanceTo(punto2);
        }
        return longitud;
    }
    
    // GUARDAR TODOS LOS DATOS, INCLUYENDO ETIQUETAS
    const diseño = {
        id: Date.now(),
        nombre: nombre,
        fecha: new Date().toISOString(),
        area: areaTotal,
        terreno: poligonosTerreno,
        tuberias: tuberias.map(t => {
            const puntosLinea = extraerPuntosLinea(t.linea);
            
            let puntosGuardar = puntosLinea;
            if (puntosGuardar.length === 0 && t.puntoInicio && t.puntoFin) {
                puntosGuardar = [
                    [t.puntoInicio.lat, t.puntoInicio.lng],
                    [t.puntoFin.lat, t.puntoFin.lng]
                ];
            }
            
            const longitudReal = puntosGuardar.length > 1 ? calcularLongitudLinea(puntosGuardar) : (t.longitud || 0);
            
            // Buscar datos de etiqueta asociada
            const etiquetaData = etiquetasTuberias.find(e => e.id === t.id);
            
            return {
                tipo: t.tipo,
                puntos: puntosGuardar,
                puntoInicio: puntosGuardar.length > 0 ? puntosGuardar[0] : null,
                puntoFin: puntosGuardar.length > 0 ? puntosGuardar[puntosGuardar.length - 1] : null,
                longitud: longitudReal,
                color: t.color,
                grosor: t.grosor,
                diametro: t.diametro,
                tipoMaterial: t.tipoMaterial,
                conexiones: t.conexiones || [],
                esConexion: t.esConexion || false,
                tieneAristas: puntosGuardar.length > 2,
                // GUARDAR DATOS DE ETIQUETA
                etiqueta: etiquetaData ? {
                    position: etiquetaData.position ? [etiquetaData.position.lat, etiquetaData.position.lng] : null,
                    visible: etiquetaData.visible !== false,
                    fontSize: etiquetaData.fontSize || 9,
                    rotation: etiquetaData.rotation || 0
                } : null
            };
        }),
        elementos: elementosGraficos.filter(e => e.type === 'elemento').map(e => ({
            id: e.id,
            tipo: e.tipo,
            posicion: [e.posicion.lat, e.posicion.lng],
            nombre: e.nombre || ''
        })),
        // GUARDAR VÁLVULAS CON TODOS LOS DATOS
        valvulas: valvulas.map(v => ({
            id: v.id,
            nombre: v.nombre,
            elementoId: v.elementoId,
            posicion: v.posicion ? [v.posicion.lat, v.posicion.lng] : null,
            caudalEmisor: v.caudalEmisor,
            numeroEmisores: v.numeroEmisores,
            tipo: v.tipo,
            diametro: v.diametro,
            presion: v.presion,
            caudalTotal: v.caudalTotal
        })),
        cabezales: cabezales.map(c => ({
            id: c.id,
            elementoId: c.elementoId,
            posicion: c.posicion ? [c.posicion.lat, c.posicion.lng] : null,
            caudalBomba: c.caudalBomba,
            diametroSuccion: c.diametroSuccion,
            diametroDescarga: c.diametroDescarga,
            numeroFiltros: c.numeroFiltros,
            tipoFiltros: c.tipoFiltros,
            notas: c.notas
        })),
        // GUARDAR ETIQUETAS DE POLÍGONOS
        etiquetasPoligonos: etiquetasPoligonos.map(ep => ({
            polygonId: ep.id,
            position: ep.marker && ep.marker.getLatLng ? [ep.marker.getLatLng().lat, ep.marker.getLatLng().lng] : null,
            visible: ep.visible !== false,
            fontSize: ep.fontSize || 11,
            rotation: ep.rotation || 0
        })),
        miniatura: imagenDiseñoDataUrl,
        metadata: {
            version: '1.4', // Incrementamos la versión para las nuevas funcionalidades
            software: 'Agrosistemas Diseñador CAD',
            fechaExportacion: new Date().toISOString(),
            totalElementos: tuberias.length + elementosGraficos.length + valvulas.length + cabezales.length,
            tuberiasConAristas: tuberias.filter(t => {
                const puntos = extraerPuntosLinea(t.linea);
                return puntos.length > 2;
            }).length,
            valvulasConNombre: valvulas.filter(v => v.nombre && v.nombre !== '').length,
            etiquetasGuardadas: etiquetasPoligonos.length + etiquetasTuberias.length
        }
    };
    
    diseñosGuardados = JSON.parse(localStorage.getItem('diseñosRiego') || '[]');
    diseñosGuardados.push(diseño);
    localStorage.setItem('diseñosRiego', JSON.stringify(diseñosGuardados));
    
    mostrarMensaje(`Diseño "${nombre}" guardado correctamente`);
    actualizarGaleriaDiseños();
    
    return diseño;
}

function exportarDiseño() {
    const diseño = guardarDiseño('Exportado_' + Date.now());
    
    const dataStr = JSON.stringify(diseño, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `diseño_riego_${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    mostrarMensaje('Diseño exportado como JSON');
}

function importarDiseño(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const diseño = JSON.parse(e.target.result);
            cargarDiseño(diseño);
            mostrarMensaje(`Diseño "${diseño.nombre}" importado correctamente`);
        } catch (error) {
            alert('Error al importar el diseño: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// FUNCIÓN MEJORADA PARA CARGAR DISEÑOS CON ETIQUETAS
function cargarDiseño(diseño) {
    limpiarDiseño();
    
    if (diseño.terreno && diseño.terreno.length > 0) {
        diseño.terreno.forEach(poligonoData => {
            const poligono = L.polygon(poligonoData.latlngs.map(latlng => [latlng[0], latlng[1]]), {
                color: poligonoData.color || '#008a45',
                fillColor: poligonoData.fillColor || '#00a553',
                fillOpacity: poligonoData.fillOpacity || 0.3,
                weight: poligonoData.weight || 2
            }).addTo(map);
            
            drawnItems.addLayer(poligono);
            
            const area = L.GeometryUtil.geodesicArea(poligono.getLatLngs()[0]);
            areaTotal += area;
            
            // Calcular medidas para la etiqueta
            const latlngs = poligono.getLatLngs()[0];
            let perimetro = 0;
            for (let i = 0; i < latlngs.length; i++) {
                const puntoActual = latlngs[i];
                const puntoSiguiente = latlngs[(i + 1) % latlngs.length];
                perimetro += puntoActual.distanceTo(puntoSiguiente);
            }
            
            const centro = calcularCentroPoligono(latlngs);
            
            // Verificar si hay datos de etiqueta guardados
            const etiquetaGuardada = diseño.etiquetasPoligonos?.find(ep => ep.polygonId === poligono._leaflet_id);
            
            if (etiquetaGuardada && etiquetaGuardada.position) {
                centro = L.latLng(etiquetaGuardada.position[0], etiquetaGuardada.position[1]);
            }
            
            // Crear etiqueta del polígono
            poligono.etiquetaArea = crearEtiquetaPoligono(centro, area, perimetro, poligono);
            poligono.etiquetaArea.addTo(map);
            
            // Aplicar propiedades guardadas de la etiqueta
            if (etiquetaGuardada) {
                const etiquetaIndex = etiquetasPoligonos.findIndex(e => e.id === poligono._leaflet_id);
                if (etiquetaIndex !== -1) {
                    etiquetasPoligonos[etiquetaIndex].visible = etiquetaGuardada.visible !== false;
                    etiquetasPoligonos[etiquetaIndex].fontSize = etiquetaGuardada.fontSize || 11;
                    etiquetasPoligonos[etiquetaIndex].rotation = etiquetaGuardada.rotation || 0;
                    
                    if (!etiquetasPoligonos[etiquetaIndex].visible) {
                        map.removeLayer(etiquetasPoligonos[etiquetaIndex].marker);
                    } else {
                        // Actualizar visualmente con las propiedades guardadas
                        actualizarContenidoEtiquetaPoligono(etiquetasPoligonos[etiquetaIndex].marker, area, perimetro);
                    }
                }
            }
            
            // Crear etiquetas de lados
            actualizarEtiquetasLados(poligono, latlngs);
        });
        
        if (areaTotal > 0) {
            document.getElementById('areaDisplay').textContent = 
                `Área: ${areaTotal.toFixed(2)} m² (${(areaTotal / 10000).toFixed(2)} ha)`;
            ocultarControlesMapa();
        }
    }
    
    if (diseño.tuberias) {
        diseño.tuberias.forEach(tData => {
            try {
                let puntosLatLng = [];
                
                if (tData.puntos && Array.isArray(tData.puntos) && tData.puntos.length > 0) {
                    puntosLatLng = tData.puntos.map(p => L.latLng(p[0], p[1]));
                } else if (tData.puntoInicio && tData.puntoFin) {
                    puntosLatLng = [
                        L.latLng(tData.puntoInicio[0], tData.puntoInicio[1]),
                        L.latLng(tData.puntoFin[0], tData.puntoFin[1])
                    ];
                } else {
                    console.warn('Tubería sin puntos válidos:', tData);
                    return;
                }
                
                if (puntosLatLng.length < 2) {
                    console.warn('Tubería con menos de 2 puntos:', tData);
                    return;
                }
                
                const marcadorInicio = crearMarcadorTuberia(puntosLatLng[0], 'inicio', tData.tipo, tData.diametro);
                marcadorInicio.addTo(map);
                
                const marcadorFin = crearMarcadorTuberia(puntosLatLng[puntosLatLng.length - 1], 'fin', tData.tipo, tData.diametro);
                marcadorFin.addTo(map);
                
                const linea = L.polyline(puntosLatLng, {
                    color: tData.color || getColorTuberia(tData.tipo),
                    weight: tData.grosor || getGrosorTuberia(tData.tipo, tData.diametro),
                    opacity: 0.8,
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(map);
                
                linea.editing.enable();
                
                let centroLat = 0, centroLng = 0;
                puntosLatLng.forEach(p => {
                    centroLat += p.lat;
                    centroLng += p.lng;
                });
                centroLat /= puntosLatLng.length;
                centroLng /= puntosLatLng.length;
                
                let centro = L.latLng(centroLat, centroLng);
                
                // Usar posición de etiqueta guardada si existe
                if (tData.etiqueta && tData.etiqueta.position) {
                    centro = L.latLng(tData.etiqueta.position[0], tData.etiqueta.position[1]);
                }
                
                const longitud = tData.longitud || calcularLongitudTotal(puntosLatLng);
                
                // Crear etiqueta de tubería
                const etiqueta = crearEtiquetaTuberia(centro, longitud, tData.diametro, tData.tipo, tData.id || Date.now());
                
                // Aplicar propiedades guardadas de la etiqueta
                if (tData.etiqueta) {
                    const etiquetaIndex = etiquetasTuberias.findIndex(e => e.id === (tData.id || Date.now()));
                    if (etiquetaIndex !== -1) {
                        etiquetasTuberias[etiquetaIndex].visible = tData.etiqueta.visible !== false;
                        etiquetasTuberias[etiquetaIndex].fontSize = tData.etiqueta.fontSize || 9;
                        etiquetasTuberias[etiquetaIndex].rotation = tData.etiqueta.rotation || 0;
                        
                        if (!etiquetasTuberias[etiquetaIndex].visible) {
                            // No agregar al mapa si no es visible
                        } else {
                            etiqueta.addTo(map);
                            actualizarContenidoEtiquetaTuberia(etiqueta, longitud, tData.diametro);
                        }
                    }
                } else {
                    etiqueta.addTo(map);
                }
                
                const tuberiaActualId = tData.id || Date.now() + Math.random();
                
                const tuberia = {
                    id: tuberiaActualId,
                    tipo: tData.tipo,
                    puntoInicio: puntosLatLng[0],
                    puntoFin: puntosLatLng[puntosLatLng.length - 1],
                    color: tData.color,
                    grosor: tData.grosor,
                    diametro: tData.diametro,
                    tipoMaterial: tData.tipoMaterial,
                    longitud: longitud,
                    conexiones: tData.conexiones || [],
                    esConexion: tData.esConexion || false,
                    marcadorInicio: marcadorInicio,
                    marcadorFin: marcadorFin,
                    linea: linea,
                    etiquetaLongitud: etiqueta,
                    tieneAristas: puntosLatLng.length > 2
                };
                
                tuberias.push(tuberia);
                
                puntosLatLng.forEach((punto, index) => {
                    puntosTuberias.push({
                        tipo: tData.tipo,
                        latlng: punto,
                        tuberiaId: tuberiaActualId,
                        esInicio: index === 0,
                        esFin: index === puntosLatLng.length - 1
                    });
                });
                
            } catch (error) {
                console.error('Error cargando tubería:', error, tData);
            }
        });
    }
    
    // CARGAR ELEMENTOS GRÁFICOS Y VÁLVULAS (código existente)
    if (diseño.elementos) {
        elementosGraficos = [];
        
        diseño.elementos.forEach(eData => {
            try {
                const latlng = L.latLng(eData.posicion[0], eData.posicion[1]);
                const elementoId = eData.id || Date.now();
                
                // Crear el elemento gráfico
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
                
                const elemento = L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'elemento-grafico',
                        html: `<div style="background: ${colores[eData.tipo]}; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i class="fas ${iconos[eData.tipo]}"></i></div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    }),
                    draggable: true
                }).addTo(map);
                
                let popupContent = `<b>${eData.tipo.toUpperCase()}</b><br>Arrastra para mover`;
                
                // Agregar al array de elementos gráficos
                elementosGraficos.push({
                    id: elementoId,
                    type: 'elemento',
                    layer: elemento,
                    tipo: eData.tipo,
                    posicion: latlng,
                    nombre: eData.nombre || eData.tipo
                });
                
                // Configurar eventos del elemento
                elemento.on('click', function(e) {
                    if (e.originalEvent.ctrlKey) return;
                    
                    seleccionarElemento(elementoId, eData.tipo);
                    e.originalEvent.stopPropagation();
                });
                
                elemento.on('dragend', function(e) {
                    const nuevaPos = e.target.getLatLng();
                    const elementoIndex = elementosGraficos.findIndex(e => e.layer === elemento);
                    if (elementoIndex !== -1) {
                        elementosGraficos[elementoIndex].posicion = nuevaPos;
                        
                        // Actualizar posición en válvulas si corresponde
                        if (eData.tipo === 'valvula') {
                            const valvulaIndex = valvulas.findIndex(v => v.elementoId === elementoId);
                            if (valvulaIndex !== -1) {
                                valvulas[valvulaIndex].posicion = nuevaPos;
                            }
                        }
                        
                        // Actualizar posición en cabezales si corresponde
                        if (eData.tipo === 'cabezal') {
                            const cabezalIndex = cabezales.findIndex(c => c.elementoId === elementoId);
                            if (cabezalIndex !== -1) {
                                cabezales[cabezalIndex].posicion = nuevaPos;
                            }
                        }
                    }
                });
                
                elemento.bindPopup(popupContent);
                
            } catch (error) {
                console.error('Error cargando elemento:', error, eData);
            }
        });
    }
    
    // CARGAR VÁLVULAS
    if (diseño.valvulas) {
        valvulas = [];
        
        diseño.valvulas.forEach(vData => {
            try {
                // Buscar el elemento gráfico correspondiente
                const elementoExistente = elementosGraficos.find(e => e.id === vData.elementoId);
                
                // Si no existe el elemento, crearlo
                if (!elementoExistente && vData.posicion) {
                    const latlng = L.latLng(vData.posicion[0], vData.posicion[1]);
                    const elementoId = vData.elementoId || Date.now();
                    
                    // Crear el elemento gráfico
                    const elemento = L.marker(latlng, {
                        icon: L.divIcon({
                            className: 'elemento-grafico',
                            html: `<div style="background: #ff6b6b; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-toggle-on"></i></div>`,
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                        }),
                        draggable: true
                    }).addTo(map);
                    
                    elementosGraficos.push({
                        id: elementoId,
                        type: 'elemento',
                        layer: elemento,
                        tipo: 'valvula',
                        posicion: latlng,
                        nombre: vData.nombre || 'Válvula'
                    });
                    
                    // Configurar eventos
                    elemento.on('click', function(e) {
                        if (e.originalEvent.ctrlKey) return;
                        seleccionarElemento(elementoId, 'valvula');
                        e.originalEvent.stopPropagation();
                    });
                    
                    elemento.on('dragend', function(e) {
                        const nuevaPos = e.target.getLatLng();
                        const elementoIndex = elementosGraficos.findIndex(e => e.layer === elemento);
                        if (elementoIndex !== -1) {
                            elementosGraficos[elementoIndex].posicion = nuevaPos;
                            const valvulaIndex = valvulas.findIndex(v => v.elementoId === elementoId);
                            if (valvulaIndex !== -1) {
                                valvulas[valvulaIndex].posicion = nuevaPos;
                            }
                        }
                    });
                    
                    elemento.bindPopup(`<b>VÁLVULA ${vData.nombre || ''}</b><br>Arrastra para mover`);
                }
                
                // Crear el objeto válvula completo
                const valvula = {
                    id: vData.id || Date.now(),
                    nombre: vData.nombre || `V${valvulas.length + 1}`,
                    elementoId: vData.elementoId || (elementoExistente ? elementoExistente.id : Date.now()),
                    posicion: vData.posicion ? L.latLng(vData.posicion[0], vData.posicion[1]) : 
                             (elementoExistente ? elementoExistente.posicion : null),
                    caudalEmisor: vData.caudalEmisor || 4,
                    numeroEmisores: vData.numeroEmisores || 100,
                    tipo: vData.tipo || 'Manual',
                    diametro: vData.diametro || '2"',
                    presion: vData.presion || 3,
                    caudalTotal: vData.caudalTotal || (vData.caudalEmisor || 4) * (vData.numeroEmisores || 100)
                };
                
                valvulas.push(valvula);
                
                // Actualizar el elemento gráfico con el nombre de la válvula
                const elemGrafico = elementosGraficos.find(e => e.id === valvula.elementoId);
                if (elemGrafico) {
                    elemGrafico.nombre = valvula.nombre;
                    
                    // Actualizar popup
                    if (elemGrafico.layer) {
                        elemGrafico.layer.bindPopup(`<b>VÁLVULA ${valvula.nombre}</b><br>Caudal: ${valvula.caudalTotal} L/h<br>Arrastra para mover`);
                    }
                    
                    // Actualizar ícono con el nombre
                    actualizarIconoElemento(valvula.elementoId, valvula.nombre);
                }
                
            } catch (error) {
                console.error('Error cargando válvula:', error, vData);
            }
        });
    }
    
    // CARGAR CABEZALES
    if (diseño.cabezales) {
        cabezales = [];
        
        diseño.cabezales.forEach(cData => {
            try {
                const cabezal = {
                    id: cData.id || Date.now(),
                    elementoId: cData.elementoId || Date.now(),
                    posicion: cData.posicion ? L.latLng(cData.posicion[0], cData.posicion[1]) : null,
                    caudalBomba: cData.caudalBomba || 50,
                    diametroSuccion: cData.diametroSuccion || '4"',
                    diametroDescarga: cData.diametroDescarga || '3"',
                    numeroFiltros: cData.numeroFiltros || 2,
                    tipoFiltros: cData.tipoFiltros || 'Anillas',
                    notas: cData.notas || 'Cabezal principal del sistema'
                };
                
                cabezales.push(cabezal);
                
                // Verificar si ya existe el elemento gráfico
                const elemGrafico = elementosGraficos.find(e => e.id === cabezal.elementoId);
                if (!elemGrafico && cabezal.posicion) {
                    // Crear elemento gráfico si no existe
                    const elemento = L.marker(cabezal.posicion, {
                        icon: L.divIcon({
                            className: 'elemento-grafico',
                            html: `<div style="background: #1772af; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-gear"></i></div>`,
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                        }),
                        draggable: true
                    }).addTo(map);
                    
                    elementosGraficos.push({
                        id: cabezal.elementoId,
                        type: 'elemento',
                        layer: elemento,
                        tipo: 'cabezal',
                        posicion: cabezal.posicion,
                        nombre: 'Cabezal'
                    });
                    
                    elemento.on('click', function(e) {
                        if (e.originalEvent.ctrlKey) return;
                        seleccionarElemento(cabezal.elementoId, 'cabezal');
                        e.originalEvent.stopPropagation();
                    });
                    
                    elemento.bindPopup(`<b>CABEZAL PRINCIPAL</b><br>Caudal: ${cabezal.caudalBomba} L/s<br>Arrastra para mover`);
                }
                
            } catch (error) {
                console.error('Error cargando cabezal:', error, cData);
            }
        });
    }
    
    actualizarResumenTuberias();
    actualizarResultados();
    mostrarMensaje(`Diseño "${diseño.nombre}" cargado correctamente. Válvulas: ${valvulas.length}, Etiquetas: ${etiquetasPoligonos.length + etiquetasTuberias.length}`);
}

function calcularCentroPolilinea(latlngs) {
    let latSum = 0, lngSum = 0, count = 0;
    
    if (Array.isArray(latlngs) && latlngs.length > 0) {
        if (Array.isArray(latlngs[0])) {
            latlngs.forEach(segmento => {
                if (Array.isArray(segmento)) {
                    segmento.forEach(punto => {
                        if (punto && punto.lat && punto.lng) {
                            latSum += punto.lat;
                            lngSum += punto.lng;
                            count++;
                        }
                    });
                }
            });
        } else if (latlngs[0].lat) {
            latlngs.forEach(punto => {
                if (punto && punto.lat && punto.lng) {
                    latSum += punto.lat;
                    lngSum += punto.lng;
                    count++;
                }
            });
        }
    }
    
    if (count === 0) {
        return L.latLng(0, 0);
    }
    
    return L.latLng(latSum / count, lngSum / count);
}

function cargarDiseñosGuardados() {
    diseñosGuardados = JSON.parse(localStorage.getItem('diseñosRiego') || '[]');
    actualizarGaleriaDiseños();
}

function actualizarGaleriaDiseños() {
    const galeriaDiv = document.getElementById('galeriaDiseños');
    if (!galeriaDiv) return;
    
    if (diseñosGuardados.length === 0) {
        galeriaDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No hay diseños guardados</p>';
        return;
    }
    
    let html = '<div class="diseños-lista">';
    diseñosGuardados.forEach(diseño => {
        const fecha = new Date(diseño.fecha).toLocaleDateString();
        html += `
            <div class="diseño-item" onclick="cargarDiseñoDesdeGaleria(${diseño.id})">
                <strong>${diseño.nombre}</strong>
                <div style="font-size: 0.8rem; color: #666;">
                    ${fecha} | ${diseño.tuberias?.length || 0} tuberías | ${diseño.valvulas?.length || 0} válvulas
                </div>
                <button onclick="eliminarDiseño(${diseño.id}, event)" 
                        style="position: absolute; right: 10px; top: 10px; background: #ff6b6b; color: white; border: none; border-radius: 3px; padding: 3px 8px; font-size: 0.8rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    html += '</div>';
    
    galeriaDiv.innerHTML = html;
}

function cargarDiseñoDesdeGaleria(diseñoId) {
    const diseño = diseñosGuardados.find(d => d.id === diseñoId);
    if (diseño) {
        cargarDiseño(diseño);
    }
}

function eliminarDiseño(diseñoId, event) {
    if (event) event.stopPropagation();
    
    if (!confirm('¿Estás seguro de eliminar este diseño?')) return;
    
    diseñosGuardados = diseñosGuardados.filter(d => d.id !== diseñoId);
    localStorage.setItem('diseñosRiego', JSON.stringify(diseñosGuardados));
    
    actualizarGaleriaDiseños();
    mostrarMensaje('Diseño eliminado');
}

// ============================================
// FUNCIÓN DE LIMPIAR DISEÑO (MEJORADA)
// ============================================

function limpiarDiseño() {
    deseleccionarElemento();
    
    // Eliminar tuberías y sus etiquetas
    tuberias.forEach(t => {
        if (t.marcadorInicio) map.removeLayer(t.marcadorInicio);
        if (t.marcadorFin) map.removeLayer(t.marcadorFin);
        if (t.linea) {
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
    
    // Eliminar etiquetas de tuberías del array global
    etiquetasTuberias = [];
    
    puntosTuberias = [];
    
    // Eliminar elementos gráficos
    elementosGraficos.forEach(e => map.removeLayer(e.layer));
    elementosGraficos = [];
    
    valvulas = [];
    cabezales = [];
    
    // Eliminar polígonos y sus etiquetas
    drawnItems.eachLayer(function(layer) {
        if (layer instanceof L.Polygon) {
            eliminarEtiquetasPoligono(layer);
        }
    });
    drawnItems.clearLayers();
    
    // Limpiar array global de etiquetas de polígonos
    etiquetasPoligonos = [];
    
    areaTotal = 0;
    document.getElementById('areaDisplay').textContent = 'Área: 0 m²';
    
    actualizarResumenTuberias();
    actualizarResultados();
    
    mostrarControlesMapa();
    
    modoDibujoTuberia = null;
    tuberiaActual = null;
    puntoInicioTuberia = null;
    modoAgregarElemento = null;
    
    modoConexion = false;
    tuberiaConexionTipo = null;
    puntoOrigenConexion = null;
    
    document.querySelectorAll('.tuberia-btn').forEach(btn => {
        btn.classList.remove('activo');
        btn.classList.remove('modo-conexion-activo');
    });
    
    document.querySelectorAll('.elemento-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById('instruccionesPrincipal').style.display = 'none';
    document.getElementById('instruccionesSecundaria').style.display = 'none';
    document.getElementById('instruccionesRegante').style.display = 'none';
    document.getElementById('instruccionesElementos').style.display = 'none';
    
    quitarResaltadoPuntos();
    
    const panelInfo = document.getElementById('panel-info-segmentos');
    if (panelInfo) {
        panelInfo.style.display = 'none';
    }
    
    const menuContextual = document.getElementById('menu-contextual-etiqueta');
    if (menuContextual) {
        menuContextual.remove();
    }
    
    const menuLado = document.getElementById('menu-contextual-lado');
    if (menuLado) {
        menuLado.remove();
    }
    
    mostrarMensaje('Diseño limpiado completamente');
}

// ============================================
// FUNCIÓN DE MENSAJES
// ============================================

function mostrarMensaje(mensaje, duracion = 3000) {
    const mensajeAnterior = document.querySelector('.mensaje-flotante');
    if (mensajeAnterior) {
        mensajeAnterior.remove();
    }
    
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = 'mensaje-flotante';
    mensajeDiv.innerHTML = `
        <div style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                    background: rgba(0,0,0,0.8); color: white; padding: 12px 20px;
                    border-radius: 8px; z-index: 10000; font-size: 0.9rem;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2); max-width: 90%;
                    text-align: center;">
            ${mensaje}
        </div>
    `;
    
    document.body.appendChild(mensajeDiv);
    
    setTimeout(() => {
        if (mensajeDiv.parentNode) {
            mensajeDiv.remove();
        }
    }, duracion);
}
