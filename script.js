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
                areaTotal = 0;
                document.getElementById('areaDisplay').textContent = 'Área: 0 m²';
                actualizarResultados();
                mostrarControlesMapa();
            }
        });
    });
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

function getColorTuberia(tipo) {
    const colores = {
        'principal': '#ff6b6b',
        'secundaria': '#4ecdc4',
        'regante': '#45b7d1'
    };
    return colores[tipo] || '#000000';
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
                tuberiaEnArray.etiquetaLongitud.setIcon(L.divIcon({
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
        tuberia.etiquetaLongitud.setIcon(L.divIcon({
            className: 'tuberia-label',
            html: `<div style="background: white; padding: 2px 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold;">
                   ${tuberia.longitud.toFixed(1)}m - ${nuevoDiámetro}"</div>`,
            iconSize: [80, 20],
            iconAnchor: [40, 10]
        }));
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
// FUNCIONES DE PDF (CON IMAGEN HD DEL DISEÑO AJUSTADA)
// ============================================

async function exportarPDF() {
    try {
        if (typeof window.jspdf === 'undefined') {
            alert('Error: jsPDF no está cargado. Recarga la página.');
            return;
        }
        
        mostrarMensaje('Generando PDF con imagen del diseño... Esto puede tomar unos segundos.', 5000);
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // TÍTULO
        doc.setFontSize(20);
        doc.setTextColor(0, 165, 83);
        doc.text('MEMORIA DE CÁLCULO - SISTEMA DE RIEGO', 105, 15, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text('Agrosistemas - Asesoría Técnica Agrícola', 105, 22, { align: 'center' });
        doc.text('Fecha: ' + new Date().toLocaleDateString('es-MX'), 105, 28, { align: 'center' });
        
        // CAPTURAR Y DIBUJAR MAPA CON ELEMENTOS PRECISOS
        let currentY = 35;
        
        try {
            // Obtener el bounds del mapa actual
            const mapBounds = map.getBounds();
            const mapCenter = map.getCenter();
            const mapZoom = map.getZoom();
            
            // Calcular dimensiones para la imagen en el PDF
            const pdfWidth = 170; // mm en A4
            const pdfHeight = 120; // mm
            
            // Coordenadas en el PDF
            const pdfX = 20;
            const pdfY = currentY;
            
            // Crear canvas para dibujar todo exactamente
            const canvas = document.createElement('canvas');
            const scaleFactor = 2; // Para mejor calidad
            canvas.width = pdfWidth * 3.78 * scaleFactor; // Convertir mm a px (96 DPI)
            canvas.height = pdfHeight * 3.78 * scaleFactor;
            
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
                const point = map.project(latlng, mapZoom);
                
                // Calcular relación entre el mapa visible y el canvas
                const mapPixelBounds = map.getPixelBounds();
                const mapPixelSize = mapPixelBounds.getSize();
                
                // Posición relativa en el mapa
                const relativeX = (point.x - mapPixelBounds.min.x) / mapPixelSize.x;
                const relativeY = (point.y - mapPixelBounds.min.y) / mapPixelSize.y;
                
                // Escalar al tamaño del canvas
                const canvasX = relativeX * canvasWidth;
                const canvasY = relativeY * canvasHeight;
                
                return { x: canvasX, y: canvasY };
            }
            
            // 1. Dibujar polígonos del terreno
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
                }
            });
            
            // 2. Dibujar tuberías
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
                                        canvasPoints.push(latLngToCanvas(point));
                                    });
                                }
                            });
                        } else if (latlngs[0].lat) {
                            // Es un array simple de puntos
                            latlngs.forEach(point => {
                                canvasPoints.push(latLngToCanvas(point));
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
                        
                        // Estilo según tipo de tubería
                        let color, width;
                        switch(tuberia.tipo) {
                            case 'principal':
                                color = '#ff6b6b'; // Rojo
                                width = 6 * scaleFactor;
                                break;
                            case 'secundaria':
                                color = '#4ecdc4'; // Turquesa
                                width = 4 * scaleFactor;
                                break;
                            case 'regante':
                                color = '#45b7d1'; // Azul claro
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
                    }
                }
            });
            
            // 3. Dibujar elementos gráficos (válvulas, cabezales, etc.)
            elementosGraficos.forEach(elemento => {
                const canvasPoint = latLngToCanvas(elemento.posicion);
                const radius = 12 * scaleFactor;
                
                // Color según tipo
                let color;
                let texto = '';
                
                switch(elemento.tipo) {
                    case 'cabezal': 
                        color = '#1772af'; 
                        texto = 'C'; // 'C' para cabezal
                        break;
                    case 'valvula': 
                        color = '#ff6b6b'; 
                        // Obtener el nombre de la válvula usando elementoId
                        const nombreValvula = obtenerNombreValvulaPorElementoId(elemento.id);
                        texto = nombreValvula || 'V'; // Usar nombre si existe, o 'V' como fallback
                        break;
                    case 'purgaterminal': 
                        color = '#ff9f43'; 
                        texto = 'P'; // 'P' para purgaterminal
                        break;
                    case 'tomagua': 
                        color = '#00a553'; 
                        texto = 'T'; // 'T' para tomagua
                        break;
                    case 'filtro': 
                        color = '#4ecdc4'; 
                        texto = 'F'; // 'F' para filtro
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
                
                // Texto del elemento - ajustar tamaño según longitud del texto
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Si es válvula y el nombre es corto (hasta 2 caracteres), usar fuente más grande
                if (elemento.tipo === 'valvula' && texto.length <= 2) {
                    ctx.font = `bold ${10 * scaleFactor}px Arial`;
                    ctx.fillText(texto, canvasPoint.x, canvasPoint.y);
                } else {
                    // Para otros elementos o nombres largos
                    ctx.font = `${9 * scaleFactor}px Arial`;
                    // Si el texto es muy largo, truncarlo
                    const textoMostrar = texto.length > 3 ? texto.substring(0, 3) + '.' : texto;
                    ctx.fillText(textoMostrar, canvasPoint.x, canvasPoint.y);
                }
            });
            
            // 4. Dibujar puntos de tuberías
            puntosTuberias.forEach(punto => {
                const canvasPoint = latLngToCanvas(punto.latlng);
                const radius = 8 * scaleFactor;
                
                ctx.beginPath();
                ctx.arc(canvasPoint.x, canvasPoint.y, radius, 0, Math.PI * 2);
                
                // Color según tipo de tubería
                let color;
                switch(punto.tipo) {
                    case 'principal': color = '#ff6b6b'; break;
                    case 'secundaria': color = '#4ecdc4'; break;
                    case 'regante': color = '#45b7d1'; break;
                    default: color = '#000000';
                }
                
                ctx.fillStyle = color;
                ctx.fill();
                
                // Borde blanco
                ctx.lineWidth = 2 * scaleFactor;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
            });
            
            // 5. Dibujar cuadrícula de referencia (opcional, ayuda a alinear)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 1 * scaleFactor;
            ctx.setLineDash([5 * scaleFactor, 5 * scaleFactor]);
            
            // Líneas verticales y horizontales
            for (let x = 0; x <= canvasWidth; x += canvasWidth / 10) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvasHeight);
                ctx.stroke();
            }
            
            for (let y = 0; y <= canvasHeight; y += canvasHeight / 10) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvasWidth, y);
                ctx.stroke();
            }
            
            ctx.setLineDash([]);
            
            // 6. Añadir leyenda
            const legendX = 10 * scaleFactor;
            const legendY = canvasHeight - 100 * scaleFactor;
            const legendItemHeight = 20 * scaleFactor;
            
            // Fondo de leyenda
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(legendX, legendY, 150 * scaleFactor, 90 * scaleFactor);
            
            ctx.fillStyle = '#333333';
            ctx.font = `${12 * scaleFactor}px Arial`;
            ctx.textAlign = 'left';
            ctx.fillText('LEYENDA', legendX + 10 * scaleFactor, legendY + 15 * scaleFactor);
            
            // Ítems de leyenda
            const legendItems = [
                { color: '#ff6b6b', text: 'Tubería Principal' },
                { color: '#4ecdc4', text: 'Tubería Secundaria' },
                { color: '#45b7d1', text: 'Tubería Regante' },
                { color: '#1772af', text: 'Cabezal' },
                { color: '#ff6b6b', text: 'Válvula' }
            ];
            
            legendItems.forEach((item, index) => {
                const y = legendY + 30 * scaleFactor + (index * legendItemHeight);
                
                // Círculo de color
                ctx.beginPath();
                ctx.arc(legendX + 15 * scaleFactor, y, 6 * scaleFactor, 0, Math.PI * 2);
                ctx.fillStyle = item.color;
                ctx.fill();
                
                // Texto
                ctx.fillStyle = '#333333';
                ctx.font = `${9 * scaleFactor}px Arial`;
                ctx.fillText(item.text, legendX + 30 * scaleFactor, y + 3 * scaleFactor);
            });
            
            // Convertir a imagen y agregar al PDF
            const imageData = canvas.toDataURL('image/jpeg', 0.95);
            
            // Añadir imagen al PDF
            doc.addImage(imageData, 'JPEG', pdfX, pdfY, pdfWidth, pdfHeight);
            currentY += pdfHeight + 10;
            
            // Pie de foto
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text('Figura 1: Diseño del sistema de riego', 105, currentY, { align: 'center' });
            currentY += 8;
            
            // Información de escala
            doc.setFontSize(8);
            doc.text(`Escala aproximada 1:${Math.round(10000 / Math.pow(2, mapZoom - 10))} | Zoom: ${mapZoom}`, 105, currentY, { align: 'center' });
            currentY += 8;
            
        } catch (imageError) {
            console.error('Error generando imagen del diseño:', imageError);
            
            // Continuar sin imagen si hay error
            doc.setFontSize(10);
            doc.setTextColor(200, 0, 0);
            doc.text('Nota: No se pudo generar la imagen del diseño.', 105, currentY, { align: 'center' });
            currentY += 10;
            
            // Mostrar información de resumen en lugar de imagen
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(`Área del diseño: ${areaTotal > 0 ? areaTotal.toFixed(0) + ' m²' : 'No definida'}`, 20, currentY);
            currentY += 7;
            doc.text(`Tuberías: ${tuberias.length} (${tuberias.filter(t => t.tipo === 'principal').length} principal, ${tuberias.filter(t => t.tipo === 'secundaria').length} secundaria, ${tuberias.filter(t => t.tipo === 'regante').length} regante)`, 20, currentY);
            currentY += 7;
            doc.text(`Válvulas: ${valvulas.length}`, 20, currentY);
            currentY += 7;
            doc.text(`Elementos: ${elementosGraficos.length}`, 20, currentY);
            currentY += 10;
        }
        
        // INFORMACIÓN GENERAL
        doc.setFontSize(14);
        doc.setTextColor(23, 114, 175);
        doc.text('1. INFORMACIÓN GENERAL DEL PROYECTO', 20, currentY);
        currentY += 8;
        
        const infoItems = [
            ['Área Total:', areaTotal > 0 ? `${areaTotal.toFixed(2)} m² (${(areaTotal / 10000).toFixed(3)} ha)` : 'No definida'],
            ['Fecha de Diseño:', new Date().toLocaleDateString('es-MX')],
            ['Número de Válvulas:', valvulas.length.toString()],
            ['Longitud Total Tuberías:', `${tuberias.reduce((sum, t) => sum + (t.longitud || 0), 0).toFixed(2)} m`],
            ['Número de Elementos:', elementosGraficos.length.toString()]
        ];
        
        infoItems.forEach((item, index) => {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(item[0], 25, currentY);
            doc.setFont(undefined, 'normal');
            doc.text(item[1], 70, currentY);
            currentY += 7;
        });
        
        currentY += 5;
        
        // TABLA DE TUBERÍAS
        if (tuberias.length > 0) {
            doc.setFontSize(14);
            doc.setTextColor(23, 114, 175);
            doc.text('2. TUBERÍAS POR DIÁMETRO', 20, currentY);
            currentY += 8;
            
            const resumenTuberias = {};
            tuberias.forEach(t => {
                const key = `${t.tipo}_${t.diametro}_${t.tipoMaterial}`;
                if (!resumenTuberias[key]) {
                    resumenTuberias[key] = {
                        tipo: t.tipo,
                        diametro: t.diametro,
                        tipoMaterial: t.tipoMaterial,
                        longitudTotal: 0
                    };
                }
                resumenTuberias[key].longitudTotal += t.longitud || 0;
            });
            
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('Tipo', 25, currentY);
            doc.text('Diámetro', 60, currentY);
            doc.text('Material', 85, currentY);
            doc.text('Longitud (m)', 120, currentY, { align: 'right' });
            currentY += 6;
            
            Object.values(resumenTuberias).forEach(item => {
                doc.setFont(undefined, 'normal');
                doc.text(item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1), 25, currentY);
                doc.text(item.diametro + '"', 60, currentY);
                doc.text(item.tipoMaterial, 85, currentY);
                doc.text(item.longitudTotal.toFixed(2), 120, currentY, { align: 'right' });
                currentY += 6;
            });
            
            const totalTuberias = tuberias.reduce((sum, t) => sum + (t.longitud || 0), 0);
            doc.setFont(undefined, 'bold');
            doc.text('Total General:', 25, currentY);
            doc.text(totalTuberias.toFixed(2) + ' m', 120, currentY, { align: 'right' });
            currentY += 10;
        }
        
        // TABLA DE VÁLVULAS
        if (valvulas.length > 0) {
            doc.setFontSize(14);
            doc.setTextColor(23, 114, 175);
            doc.text('3. VÁLVULAS DE CONTROL', 20, currentY);
            currentY += 8;
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text('Nombre', 25, currentY);
            doc.text('Tipo', 45, currentY);
            doc.text('Diámetro', 65, currentY);
            doc.text('Presión', 80, currentY);
            doc.text('Emisores', 95, currentY);
            doc.text('Caudal Emisor', 115, currentY);
            doc.text('Caudal Total', 145, currentY, { align: 'right' });
            currentY += 5;
            
            valvulas.forEach(valvula => {
                doc.setFont(undefined, 'normal');
                doc.text(valvula.nombre, 25, currentY);
                doc.text(valvula.tipo, 45, currentY);
                doc.text(valvula.diametro, 65, currentY);
                doc.text(valvula.presion.toString(), 80, currentY);
                doc.text(valvula.numeroEmisores.toString(), 95, currentY);
                doc.text(valvula.caudalEmisor.toString(), 115, currentY);
                doc.text(valvula.caudalTotal.toString(), 145, currentY, { align: 'right' });
                currentY += 5;
            });
            
            const caudalTotalSistema = valvulas.reduce((sum, v) => sum + v.caudalTotal, 0);
            doc.setFont(undefined, 'bold');
            doc.text('Caudal Total del Sistema:', 25, currentY);
            doc.text(`${caudalTotalSistema.toFixed(2)} L/h (${(caudalTotalSistema / 3600).toFixed(2)} L/s)`, 145, currentY, { align: 'right' });
            currentY += 10;
        }
        
        // CÁLCULOS HIDRÁULICOS
        if (valvulas.length > 0 && areaTotal > 0) {
            doc.setFontSize(14);
            doc.setTextColor(23, 114, 175);
            doc.text('4. CÁLCULOS HIDRÁULICOS', 20, currentY);
            currentY += 8;
            
            doc.setFontSize(10);
            const caudalTotalSistema = valvulas.reduce((sum, v) => sum + v.caudalTotal, 0);
            const caudalLps = caudalTotalSistema / 3600;
            const laminaPorHora = caudalTotalSistema / (areaTotal * 1000);
            const horasPara10mm = 10 / laminaPorHora;
            
            doc.text(`Caudal Total Requerido: ${caudalTotalSistema.toFixed(2)} L/h (${caudalLps.toFixed(2)} L/s)`, 25, currentY);
            currentY += 6;
            doc.text(`Lámina de Riego por Hora: ${laminaPorHora.toFixed(3)} mm/h`, 25, currentY);
            currentY += 6;
            doc.text(`Tiempo para aplicar 10 mm de riego: ${horasPara10mm.toFixed(1)} horas`, 25, currentY);
            currentY += 6;
            
            if (cabezales.length > 0) {
                const cabezalPrincipal = cabezales[0];
                const caudalCabezal = cabezalPrincipal.caudalBomba * 1000;
                const diferencia = caudalCabezal - caudalTotalSistema;
                const porcentaje = (diferencia / caudalCabezal) * 100;
                
                doc.text(`Caudal Disponible (Cabezal): ${caudalCabezal.toFixed(2)} L/h (${cabezalPrincipal.caudalBomba} L/s)`, 25, currentY);
                currentY += 6;
                doc.text(`Diferencia: ${diferencia.toFixed(2)} L/h (${(diferencia / 3600).toFixed(2)} L/s)`, 25, currentY);
                currentY += 6;
                doc.text(`Observación: ${diferencia >= 0 ? 'Sobrecapacidad del ' + porcentaje.toFixed(1) + '%' : 'Deficit del ' + Math.abs(porcentaje).toFixed(1) + '%'}`, 25, currentY);
                currentY += 6;
            }
            
            currentY += 5;
        }
        
        // GUARDAR PDF
        const fechaHora = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const nombreArchivo = `Memoria_Calculo_Riego_${fechaHora}.pdf`;
        
        mostrarMensaje(`PDF generado exitosamente: ${nombreArchivo}`, 5000);
        
        doc.save(nombreArchivo);
        
    } catch (error) {
        console.error('Error en exportarPDF:', error);
        alert(`Error al generar el PDF: ${error.message}\n\nPor favor, intente nuevamente.`);
    }
}

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
// FUNCIONES DE GESTIÓN DE DISEÑOS (MEJORADAS)
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
    
    // GUARDAR TODOS LOS DATOS DE LAS VÁLVULAS COMPLETAMENTE
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
                tieneAristas: puntosGuardar.length > 2
            };
        }),
        elementos: elementosGraficos.filter(e => e.type === 'elemento').map(e => ({
            id: e.id,
            tipo: e.tipo,
            posicion: [e.posicion.lat, e.posicion.lng],
            // GUARDAMOS EL NOMBRE DE LA VÁLVULA EN LOS ELEMENTOS
            nombre: e.nombre || ''
        })),
        // GUARDAR VÁLVULAS CON TODOS LOS DATOS
        valvulas: valvulas.map(v => ({
            id: v.id,
            nombre: v.nombre, // NOMBRE GUARDADO
            elementoId: v.elementoId, // ID DEL ELEMENTO GRÁFICO
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
        miniatura: imagenDiseñoDataUrl,
        metadata: {
            version: '1.3', // Incrementamos la versión para las mejoras
            software: 'Agrosistemas Diseñador CAD',
            fechaExportacion: new Date().toISOString(),
            totalElementos: tuberias.length + elementosGraficos.length + valvulas.length + cabezales.length,
            tuberiasConAristas: tuberias.filter(t => {
                const puntos = extraerPuntosLinea(t.linea);
                return puntos.length > 2;
            }).length,
            valvulasConNombre: valvulas.filter(v => v.nombre && v.nombre !== '').length
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

// FUNCIÓN MEJORADA PARA CARGAR DISEÑOS
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
                
                const centro = L.latLng(centroLat, centroLng);
                
                const longitud = tData.longitud || calcularLongitudTotal(puntosLatLng);
                const etiqueta = L.marker(centro, {
                    icon: L.divIcon({
                        className: 'tuberia-label',
                        html: `<div style="background: white; padding: 2px 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold;">
                                ${longitud.toFixed(1)}m - ${tData.diametro}"</div>`,
                        iconSize: [80, 20],
                        iconAnchor: [40, 10]
                    })
                }).addTo(map);
                
                linea.on('edit', function(e) {
                    const nuevosLatlngs = e.target.getLatLngs();
                    const nuevaLongitud = calcularLongitudTotal(nuevosLatlngs);
                    
                    const nuevoCentro = calcularCentroPolilinea(nuevosLatlngs);
                    etiqueta.setLatLng(nuevoCentro);
                    etiqueta.setIcon(L.divIcon({
                        className: 'tuberia-label',
                        html: `<div style="background: white; padding: 2px 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 9px; font-weight: bold;">
                                ${nuevaLongitud.toFixed(1)}m - ${tData.diametro}"</div>`,
                        iconSize: [80, 20],
                        iconAnchor: [40, 10]
                    }));
                    
                    const tuberia = tuberias.find(t => t.id === tuberiaActualId);
                    if (tuberia) {
                        tuberia.longitud = nuevaLongitud;
                        actualizarResumenTuberias();
                        actualizarResultados();
                    }
                });
                
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
    
    // PRIMERO CARGAR ELEMENTOS GRÁFICOS
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
    
    // LUEGO CARGAR VÁLVULAS CON SUS DATOS COMPLETOS
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
    mostrarMensaje(`Diseño "${diseño.nombre}" cargado correctamente. Válvulas: ${valvulas.length}`);
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
// FUNCIÓN DE LIMPIAR DISEÑO
// ============================================

function limpiarDiseño() {
    deseleccionarElemento();
    
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
    
    puntosTuberias = [];
    
    elementosGraficos.forEach(e => map.removeLayer(e.layer));
    elementosGraficos = [];
    
    valvulas = [];
    cabezales = [];
    
    drawnItems.clearLayers();
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