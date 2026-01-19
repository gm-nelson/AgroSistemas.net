// ============================================
// VARIABLES GLOBALES (IGUAL AL ORIGINAL)
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
// INICIALIZACIÓN DEL MAPA (IGUAL AL ORIGINAL)
// ============================================

function initMap() {
    const losMochis = [25.8133, -108.9719];
    
    // Configuración del mapa optimizada para móviles
    map = L.map('map', {
        center: losMochis,
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: true, // HABILITADO para scroll del mouse
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
    
    // Configurar controles de dibujo (IGUAL AL ORIGINAL)
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
    
    // Eventos del mapa (IGUAL AL ORIGINAL)
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
// FUNCIONES DE UTILIDAD (IGUAL AL ORIGINAL)
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
// FUNCIONES DE ELEMENTOS (IGUAL AL ORIGINAL)
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
        posicion: latlng
    });
    
    if (tipo === 'valvula' || tipo === 'cabezal') {
        seleccionarElemento(elementoId, tipo);
    }
    
    actualizarResultados();
    
    return elementoId;
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
    if (!elemento) return;
    
    elementoSeleccionado = elemento;
    
    const icon = elemento.layer.getElement();
    if (icon) {
        icon.style.boxShadow = '0 0 0 3px #ff9f43';
        icon.style.border = '2px solid white';
    }
    
    elemento.layer.openPopup();
    
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
    
    actualizarConfiguracionElemento(tipo, elementoId);
    
    let nombreElemento = tipo;
    if (tipo === 'valvula') {
        const valvula = valvulas.find(v => v.elementoId === elementoId);
        if (valvula) nombreElemento = `Válvula ${valvula.nombre}`;
    } else if (tipo === 'cabezal') {
        nombreElemento = 'Cabezal';
    }
    
    mostrarMensaje(`${nombreElemento} seleccionado. Puedes modificar sus propiedades en el panel.`);
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
    
    actualizarConfiguracionElemento('cabezal');
}

function eliminarElemento(elementoId, tipo) {
    if (!confirm(`¿Estás seguro de eliminar este ${tipo}?`)) return;
    
    const elementoIndex = elementosGraficos.findIndex(e => e.id === parseInt(elementoId));
    if (elementoIndex !== -1) {
        map.removeLayer(elementosGraficos[elementoIndex].layer);
        elementosGraficos.splice(elementoIndex, 1);
    }
    
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
// FUNCIONES DE TUBERÍAS (IGUAL AL ORIGINAL)
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
// FUNCIONES DE CONEXIÓN (IGUAL AL ORIGINAL)
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
// FUNCIONES DE RESULTADOS (IGUAL AL ORIGINAL)
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
// FUNCIONES DE CAPTURA Y PDF (IGUAL AL ORIGINAL)
// ============================================

async function exportarPDF() {
    try {
        if (typeof window.jspdf === 'undefined') {
            alert('Error: jsPDF no está cargado. Recarga la página.');
            return;
        }
        
        mostrarMensaje('Generando PDF... Esto puede tomar unos segundos.', 3000);
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        let currentY = 20;
        
        doc.setFontSize(20);
        doc.setTextColor(0, 165, 83);
        doc.text('MEMORIA DE CÁLCULO - SISTEMA DE RIEGO', 105, currentY, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text('Agrosistemas - Asesoría Técnica Agrícola', 105, currentY + 8, { align: 'center' });
        doc.text('Fecha: ' + new Date().toLocaleDateString('es-MX'), 105, currentY + 15, { align: 'center' });
        
        currentY += 25;
        
        if (capturaTomada && capturaMapaDataUrl) {
            try {
                doc.setFontSize(14);
                doc.setTextColor(23, 114, 175);
                doc.text('1. REPRESENTACIÓN DEL DISEÑO', 20, currentY);
                currentY += 8;
                
                const imgWidth = 170;
                const imgHeight = 120;
                
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = function() {
                        try {
                            const tempCanvas = document.createElement('canvas');
                            const tempCtx = tempCanvas.getContext('2d');
                            tempCanvas.width = 800;
                            tempCanvas.height = 600;
                            tempCtx.drawImage(img, 0, 0, 800, 600);
                            
                            const optimizedDataUrl = tempCanvas.toDataURL('image/jpeg', 0.85);
                            doc.addImage(optimizedDataUrl, 'JPEG', 20, currentY, imgWidth, imgHeight);
                            currentY += imgHeight + 10;
                            
                            doc.setFontSize(8);
                            doc.setTextColor(100, 100, 100);
                            doc.text('Representación esquemática del sistema de riego', 20, currentY);
                            currentY += 5;
                            
                            resolve();
                        } catch (error) {
                            console.error('Error procesando imagen:', error);
                            currentY += 10;
                            resolve();
                        }
                    };
                    img.onerror = function() {
                        console.error('Error cargando imagen');
                        currentY += 10;
                        resolve();
                    };
                    img.src = capturaMapaDataUrl;
                });
                
            } catch (imgError) {
                console.error('Error con imagen:', imgError);
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text('No se pudo incluir la representación gráfica del diseño.', 25, currentY);
                currentY += 10;
            }
        } else {
            doc.setFontSize(14);
            doc.setTextColor(23, 114, 175);
            doc.text('1. REPRESENTACIÓN DEL DISEÑO', 20, currentY);
            currentY += 8;
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('Para incluir una representación gráfica del diseño, use la opción "Capturar Diseño Actual".', 25, currentY);
            currentY += 6;
            doc.text('La información técnica se presenta en las siguientes secciones.', 25, currentY);
            currentY += 10;
        }
        
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }
        
        doc.setFontSize(14);
        doc.setTextColor(23, 114, 175);
        doc.text('2. INFORMACIÓN GENERAL DEL PROYECTO', 20, currentY);
        currentY += 8;
        
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        
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
        
        if (tuberias.length > 0) {
            if (currentY > 200) {
                doc.addPage();
                currentY = 20;
            }
            
            doc.setFontSize(14);
            doc.setTextColor(23, 114, 175);
            doc.text('3. RESUMEN DE TUBERÍAS POR DIÁMETRO', 20, currentY);
            currentY += 10;
            
            const resumenTuberias = {};
            tuberias.forEach(tuberia => {
                const key = `${tuberia.tipo}-${tuberia.diametro}-${tuberia.tipoMaterial}`;
                if (!resumenTuberias[key]) {
                    resumenTuberias[key] = {
                        tipo: tuberia.tipo,
                        diametro: tuberia.diametro,
                        material: tuberia.tipoMaterial,
                        longitudTotal: 0,
                        cantidad: 0
                    };
                }
                resumenTuberias[key].longitudTotal += tuberia.longitud || 0;
                resumenTuberias[key].cantidad += 1;
            });
            
            const tablaTuberias = Object.values(resumenTuberias).map(item => [
                item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1),
                `${item.diametro}"`,
                item.material,
                item.cantidad.toString(),
                `${item.longitudTotal.toFixed(2)} m`
            ]);
            
            const totalGeneral = tuberias.reduce((sum, t) => sum + (t.longitud || 0), 0);
            
            const startX = 25;
            const colWidths = [30, 20, 30, 20, 30];
            
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('Tipo', startX, currentY);
            doc.text('Diám.', startX + colWidths[0], currentY);
            doc.text('Material', startX + colWidths[0] + colWidths[1], currentY);
            doc.text('Cant.', startX + colWidths[0] + colWidths[1] + colWidths[2], currentY);
            doc.text('Longitud', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY);
            
            currentY += 7;
            
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.line(startX, currentY, startX + 120, currentY);
            currentY += 5;
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            
            tablaTuberias.forEach((fila, index) => {
                doc.text(fila[0], startX, currentY);
                doc.text(fila[1], startX + colWidths[0], currentY);
                doc.text(fila[2], startX + colWidths[0] + colWidths[1], currentY);
                doc.text(fila[3], startX + colWidths[0] + colWidths[1] + colWidths[2], currentY);
                doc.text(fila[4], startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY);
                currentY += 6;
            });
            
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.line(startX, currentY, startX + 120, currentY);
            currentY += 5;
            
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('TOTAL GENERAL:', startX, currentY);
            doc.text(`${totalGeneral.toFixed(2)} m`, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY);
            
            currentY += 10;
        }
        
        if (valvulas.length > 0) {
            if (currentY > 200) {
                doc.addPage();
                currentY = 20;
            }
            
            doc.setFontSize(14);
            doc.setTextColor(23, 114, 175);
            doc.text('4. VÁLVULAS DE CONTROL DEL SISTEMA', 20, currentY);
            currentY += 10;
            
            const caudalTotalSistema = valvulas.reduce((sum, v) => sum + v.caudalTotal, 0);
            
            const startX = 25;
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text('Nombre', startX, currentY);
            doc.text('Tipo', startX + 25, currentY);
            doc.text('Diám.', startX + 50, currentY);
            doc.text('Presión', startX + 70, currentY);
            doc.text('Emisores', startX + 90, currentY);
            doc.text('Caudal', startX + 110, currentY);
            
            currentY += 6;
            
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.line(startX, currentY, startX + 140, currentY);
            currentY += 5;
            
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            
            valvulas.forEach(valvula => {
                doc.text(valvula.nombre, startX, currentY);
                doc.text(valvula.tipo.substring(0, 8), startX + 25, currentY);
                doc.text(valvula.diametro, startX + 50, currentY);
                doc.text(`${valvula.presion} bar`, startX + 70, currentY);
                doc.text(valvula.numeroEmisores.toString(), startX + 90, currentY);
                doc.text(`${valvula.caudalTotal} L/h`, startX + 110, currentY);
                currentY += 5;
            });
            
            currentY += 3;
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text('CAUDAL TOTAL DEL SISTEMA:', startX, currentY);
            doc.text(`${caudalTotalSistema.toFixed(2)} L/h (${(caudalTotalSistema / 3600).toFixed(2)} L/s)`, startX + 80, currentY);
            
            currentY += 10;
        }
        
        if (valvulas.length > 0) {
            if (currentY > 180) {
                doc.addPage();
                currentY = 20;
            }
            
            doc.setFontSize(14);
            doc.setTextColor(23, 114, 175);
            doc.text('5. CÁLCULOS HIDRÁULICOS', 20, currentY);
            currentY += 10;
            
            const caudalTotalSistema = valvulas.reduce((sum, v) => sum + v.caudalTotal, 0);
            const caudalLps = caudalTotalSistema / 3600;
            
            doc.setFontSize(10);
            
            const calculos = [
                ['Caudal total requerido:', `${caudalTotalSistema.toFixed(2)} L/h (${caudalLps.toFixed(3)} L/s)`],
                ['Número total de emisores:', valvulas.reduce((sum, v) => sum + v.numeroEmisores, 0).toString()],
                ['Presión promedio:', `${(valvulas.reduce((sum, v) => sum + v.presion, 0) / valvulas.length).toFixed(1)} bar`]
            ];
            
            if (cabezales.length > 0) {
                const cabezal = cabezales[0];
                const caudalCabezal = cabezal.caudalBomba * 1000;
                const diferencia = caudalCabezal - caudalTotalSistema;
                const porcentaje = (diferencia / caudalCabezal) * 100;
                
                calculos.push(
                    ['Caudal disponible (cabezal):', `${cabezal.caudalBomba} L/s (${caudalCabezal.toFixed(0)} L/h)`],
                    ['Balance del sistema:', `${diferencia >= 0 ? 'Sobrecapacidad' : 'Deficit'}`],
                    ['Margen:', `${Math.abs(porcentaje).toFixed(1)}%`]
                );
            }
            
            if (areaTotal > 0) {
                const laminaPorHora = caudalTotalSistema / (areaTotal * 1000);
                const horasPara10mm = 10 / laminaPorHora;
                
                calculos.push(
                    ['Lámina de riego por hora:', `${laminaPorHora.toFixed(3)} mm/h`],
                    ['Tiempo para 10 mm de riego:', `${horasPara10mm.toFixed(1)} horas`]
                );
            }
            
            calculos.forEach((item, index) => {
                doc.setFont(undefined, 'bold');
                doc.text(item[0], 25, currentY);
                doc.setFont(undefined, 'normal');
                doc.text(item[1], 90, currentY);
                currentY += 7;
            });
        }
        
        if (currentY > 200) {
            doc.addPage();
            currentY = 20;
        }
        
        doc.setFontSize(14);
        doc.setTextColor(23, 114, 175);
        doc.text('6. OBSERVACIONES Y APROBACIONES', 20, currentY);
        currentY += 15;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Observaciones:', 25, currentY);
        currentY += 15;
        
        doc.setLineWidth(0.5);
        doc.line(25, currentY, 185, currentY);
        currentY += 20;
        doc.line(25, currentY, 185, currentY);
        currentY += 10;
        
        doc.text('________________________________________', 105, currentY, { align: 'center' });
        currentY += 7;
        doc.text('Ing. Diseñador', 105, currentY, { align: 'center' });
        currentY += 20;
        
        doc.text('________________________________________', 105, currentY, { align: 'center' });
        currentY += 7;
        doc.text('Cliente / Responsable', 105, currentY, { align: 'center' });
        currentY += 20;
        
        doc.text('________________________________________', 105, currentY, { align: 'center' });
        currentY += 7;
        doc.text('Fecha de Aprobación', 105, currentY, { align: 'center' });
        
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Página ${i} de ${totalPages}`, 20, 285);
            doc.text('Agrosistemas - Asesoría Técnica Agrícola', 105, 285, { align: 'center' });
            doc.text('Los Mochis, Sinaloa, México | Tel: 668 123 4567', 105, 290, { align: 'center' });
        }
        
        const fechaHora = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const nombreArchivo = `Memoria_Calculo_Riego_${fechaHora}.pdf`;
        
        mostrarMensaje(`PDF generado exitosamente: ${nombreArchivo}`, 5000);
        
        doc.save(nombreArchivo);
        
    } catch (error) {
        console.error('Error en exportarPDF:', error);
        alert(`Error al generar el PDF: ${error.message}\n\nPor favor, intente nuevamente.`);
    }
}

async function capturarDiseñoActual() {
    try {
        mostrarMensaje('Preparando captura del diseño...', 2000);
        
        const btn = document.querySelector('[onclick="capturarDiseñoActual()"]');
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Capturando...';
            btn.disabled = true;
        }
        
        capturaMapaDataUrl = await crearRepresentacionVectorial();
        
        if (!capturaMapaDataUrl) {
            throw new Error('No se pudo generar la representación del diseño');
        }
        
        capturaTomada = true;
        
        mostrarVistaPreviaCaptura(capturaMapaDataUrl);
        
        actualizarEstadoCaptura(true, '¡Diseño preparado para PDF!');
        
        mostrarMensaje('Representación del diseño creada correctamente. Ahora puedes exportar el PDF.', 3000);
        
        return capturaMapaDataUrl;
        
    } catch (error) {
        console.error('Error capturando diseño:', error);
        actualizarEstadoCaptura(false, `Error: ${error.message}`);
        mostrarMensaje(`Error: ${error.message}`, 5000);
        throw error;
    } finally {
        const btn = document.querySelector('[onclick="capturarDiseñoActual()"]');
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

async function crearRepresentacionVectorial() {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const ancho = 800;
            const alto = 600;
            canvas.width = ancho;
            canvas.height = alto;
            
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, ancho, alto);
            
            ctx.fillStyle = '#333';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('DISEÑO DE SISTEMA DE RIEGO', ancho / 2, 40);
            
            ctx.font = '16px Arial';
            ctx.fillText('Agrosistemas - Diseñador CAD', ancho / 2, 70);
            ctx.fillText('Fecha: ' + new Date().toLocaleDateString('es-MX'), ancho / 2, 90);
            
            const marcoX = 50;
            const marcoY = 120;
            const marcoAncho = ancho - 100;
            const marcoAlto = alto - 200;
            
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 1;
            ctx.strokeRect(marcoX, marcoY, marcoAncho, marcoAlto);
            
            let todosLosPuntos = [];
            
            tuberias.forEach(t => {
                if (t.linea) {
                    try {
                        const latlngs = t.linea.getLatLngs();
                        if (Array.isArray(latlngs) && latlngs.length > 0) {
                            if (Array.isArray(latlngs[0]) && typeof latlngs[0][0] === 'object') {
                                latlngs.forEach(segmento => {
                                    if (Array.isArray(segmento)) {
                                        segmento.forEach(punto => {
                                            if (punto && punto.lat && punto.lng) {
                                                todosLosPuntos.push(punto);
                                            }
                                        });
                                    }
                                });
                            } else if (latlngs[0].lat) {
                                latlngs.forEach(punto => {
                                    if (punto && punto.lat && punto.lng) {
                                        todosLosPuntos.push(punto);
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        console.error('Error obteniendo puntos de tubería:', error, t);
                    }
                }
                
                if (t.puntoInicio) todosLosPuntos.push(t.puntoInicio);
                if (t.puntoFin) todosLosPuntos.push(t.puntoFin);
            });
    
    elementosGraficos.forEach(e => {
                todosLosPuntos.push(e.posicion);
            });
    
    drawnItems.eachLayer(layer => {
                if (layer instanceof L.Polygon) {
                    const latlngs = layer.getLatLngs()[0];
                    latlngs.forEach(latlng => todosLosPuntos.push(latlng));
                }
            });
    
    if (todosLosPuntos.length === 0) {
                crearRepresentacionMinima(ctx, marcoX, marcoY, marcoAncho, marcoAlto);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve(dataUrl);
                return;
            }
    
    let minLat = Infinity, maxLat = -Infinity;
            let minLng = Infinity, maxLng = -Infinity;
    
    todosLosPuntos.forEach(point => {
                if (point && point.lat && point.lng) {
                    minLat = Math.min(minLat, point.lat);
                    maxLat = Math.max(maxLat, point.lat);
                    minLng = Math.min(minLng, point.lng);
                    maxLng = Math.max(maxLng, point.lng);
                }
            });
    
    const latRange = maxLat - minLat;
            const lngRange = maxLng - minLng;
            const margin = 0.1;
    
    minLat -= latRange * margin;
            maxLat += latRange * margin;
            minLng -= lngRange * margin;
            maxLng += lngRange * margin;
    
    const toCanvasCoords = (lat, lng) => {
                const x = marcoX + ((lng - minLng) / (maxLng - minLng)) * marcoAncho;
                const y = marcoY + marcoAlto - ((lat - minLat) / (maxLat - minLat)) * marcoAlto;
                return { x, y };
            };
    
    drawnItems.eachLayer(layer => {
                if (layer instanceof L.Polygon) {
                    const latlngs = layer.getLatLngs()[0];
                    ctx.beginPath();
    
    latlngs.forEach((latlng, index) => {
                        const coords = toCanvasCoords(latlng.lat, latlng.lng);
                        if (index === 0) {
                            ctx.moveTo(coords.x, coords.y);
                        } else {
                            ctx.lineTo(coords.x, coords.y);
                        }
                    });
    
    ctx.closePath();
                    ctx.fillStyle = 'rgba(0, 165, 83, 0.2)';
                    ctx.fill();
                    ctx.strokeStyle = '#008a45';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            });
    
    tuberias.forEach(t => {
                try {
                    let puntosTuberia = [];
    
    if (t.linea && t.linea.getLatLngs) {
                        const latlngs = t.linea.getLatLngs();
    
    if (Array.isArray(latlngs) && latlngs.length > 0) {
                            if (Array.isArray(latlngs[0]) && typeof latlngs[0][0] === 'object') {
                                latlngs.forEach(segmento => {
                                    if (Array.isArray(segmento)) {
                                        segmento.forEach(punto => {
                                            if (punto && punto.lat && punto.lng) {
                                                puntosTuberia.push(punto);
                                            }
                                        });
                                    }
                                });
                            } else if (latlngs[0].lat) {
                                latlngs.forEach(punto => {
                                    if (punto && punto.lat && punto.lng) {
                                        puntosTuberia.push(punto);
                                    }
                                });
                            }
                        }
                    }
    
    if (puntosTuberia.length === 0 && t.puntoInicio && t.puntoFin) {
                        puntosTuberia = [t.puntoInicio, t.puntoFin];
                    }
    
    if (puntosTuberia.length < 2) {
                        console.warn('Tubería con menos de 2 puntos:', t);
                        return;
                    }
    
    let color, grosor;
                    if (t.tipo === 'principal') {
                        color = '#ff6b6b';
                        grosor = t.grosor || 6;
                    } else if (t.tipo === 'secundaria') {
                        color = '#4ecdc4';
                        grosor = t.grosor || 4;
                    } else {
                        color = '#45b7d1';
                        grosor = t.grosor || 3;
                    }
    
    ctx.beginPath();
    
    puntosTuberia.forEach((punto, index) => {
                        const coords = toCanvasCoords(punto.lat, punto.lng);
                        if (index === 0) {
                            ctx.moveTo(coords.x, coords.y);
                        } else {
                            ctx.lineTo(coords.x, coords.y);
                        }
                    });
    
    ctx.strokeStyle = color;
                    ctx.lineWidth = grosor;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke();
    
    let longitudTotal = 0;
                    for (let i = 0; i < puntosTuberia.length - 1; i++) {
                        longitudTotal += puntosTuberia[i].distanceTo(puntosTuberia[i + 1]);
                    }
    
    puntosTuberia.forEach((punto, index) => {
                        const coords = toCanvasCoords(punto.lat, punto.lng);
                        
                        if (puntosTuberia.length > 2 && index > 0 && index < puntosTuberia.length - 1) {
                            ctx.beginPath();
                            ctx.arc(coords.x, coords.y, grosor/2, 0, Math.PI * 2);
                            ctx.fillStyle = color;
                            ctx.fill();
                            ctx.strokeStyle = 'white';
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    });
    
    let midPointIndex = Math.floor(puntosTuberia.length / 2);
                    if (midPointIndex >= puntosTuberia.length) midPointIndex = puntosTuberia.length - 1;
                    
                    const puntoMedio = puntosTuberia[midPointIndex];
                    const coordsMedio = toCanvasCoords(puntoMedio.lat, puntoMedio.lng);
                    
                    let nombreValvulaCercana = '';
                    const tolerancia = 0.0001;
                    
                    if (puntosTuberia.length > 0) {
                        const primerPunto = puntosTuberia[0];
                        const ultimoPunto = puntosTuberia[puntosTuberia.length - 1];
                        
                        valvulas.forEach(v => {
                            if (v.posicion) {
                                const distanciaInicio = Math.abs(v.posicion.lat - primerPunto.lat) + 
                                                      Math.abs(v.posicion.lng - primerPunto.lng);
                                const distanciaFin = Math.abs(v.posicion.lat - ultimoPunto.lat) + 
                                                    Math.abs(v.posicion.lng - ultimoPunto.lng);
                                
                                if (distanciaInicio < tolerancia || distanciaFin < tolerancia) {
                                    nombreValvulaCercana = v.nombre;
                                }
                            }
                        });
                    }
    
    ctx.fillStyle = 'white';
                    ctx.fillRect(coordsMedio.x - 40, coordsMedio.y - 10, 80, 20);
    
    ctx.fillStyle = '#333';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    let textoEtiqueta = `${longitudTotal.toFixed(1)}m`;
                    if (t.diametro) {
                        textoEtiqueta += ` ${t.diametro}"`;
                    }
                    if (nombreValvulaCercana) {
                        textoEtiqueta += `\nVálv ${nombreValvulaCercana}`;
                        ctx.font = 'bold 9px Arial';
                    }
                    
                    const lineas = textoEtiqueta.split('\n');
                    lineas.forEach((linea, index) => {
                        ctx.fillText(linea, coordsMedio.x, coordsMedio.y + (index * 10) - 3);
                    });
                    
                } catch (error) {
                    console.error('Error dibujando tubería:', error, t);
                }
            });
    
    elementosGraficos.forEach(e => {
                try {
                    const coords = toCanvasCoords(e.posicion.lat, e.posicion.lng);
                    
                    let esValvula = false;
                    let nombreValvula = '';
                    let infoValvula = '';
                    
                    if (e.tipo === 'valvula') {
                        const valvula = valvulas.find(v => v.elementoId === e.id);
                        if (valvula) {
                            esValvula = true;
                            nombreValvula = valvula.nombre;
                            infoValvula = `${valvula.caudalTotal} L/h`;
                        }
                    }
                    
                    let color, icono;
                    switch(e.tipo) {
                        case 'cabezal':
                            color = '#1772af';
                            icono = '⚙️';
                            break;
                        case 'valvula':
                            color = '#ff6b6b';
                            icono = '⚡';
                            break;
                        case 'tomagua':
                            color = '#00a553';
                            icono = '💧';
                            break;
                        case 'filtro':
                            color = '#4ecdc4';
                            icono = '🔍';
                            break;
                        case 'purgaterminal':
                            color = '#ff9f43';
                            icono = '🚰';
                            break;
                        default:
                            color = '#666';
                            icono = '📍';
                    }
    
    ctx.beginPath();
                    ctx.arc(coords.x, coords.y, 12, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.stroke();
    
    ctx.fillStyle = 'white';
                    ctx.font = '14px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(icono, coords.x, coords.y);
    
    ctx.fillStyle = '#333';
                    ctx.font = 'bold 11px Arial';
                    
                    let textoEtiqueta = e.tipo.toUpperCase();
                    if (esValvula) {
                        textoEtiqueta = `VÁLV ${nombreValvula}`;
                        
                        ctx.font = '9px Arial';
                        ctx.fillText(infoValvula, coords.x, coords.y + 25);
                        ctx.font = 'bold 11px Arial';
                    }
    
    ctx.fillText(textoEtiqueta, coords.x, coords.y + 40);
                    
                } catch (error) {
                    console.error('Error dibujando elemento:', error, e);
                }
            });
    
    dibujarLeyendaMejorada(ctx, ancho, alto, valvulas);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            capturaCanvas = canvas;
    
    resolve(dataUrl);
                    
        } catch (error) {
            console.error('Error en crearRepresentacionVectorial:', error);
            const fallbackUrl = crearRepresentacionMinimaFallback();
            resolve(fallbackUrl);
        }
    });
}

function dibujarLeyendaMejorada(ctx, ancho, alto, valvulas) {
    const leyendaX = ancho - 220;
    const leyendaY = 120;
    const leyendaAncho = 200;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(leyendaX, leyendaY, leyendaAncho, 250);
    
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(leyendaX, leyendaY, leyendaAncho, 250);
    
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('LEYENDA DEL DISEÑO', leyendaX + 10, leyendaY + 25);
    
    let y = leyendaY + 45;
    
    ctx.beginPath();
    ctx.moveTo(leyendaX + 10, y);
    ctx.lineTo(leyendaX + 40, y);
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.font = '11px Arial';
    ctx.fillText('Tubería Principal', leyendaX + 50, y + 4);
    y += 25;
    
    ctx.beginPath();
    ctx.moveTo(leyendaX + 10, y);
    ctx.lineTo(leyendaX + 40, y);
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillText('Tubería Secundaria', leyendaX + 50, y + 4);
    y += 25;
    
    ctx.beginPath();
    ctx.moveTo(leyendaX + 10, y);
    ctx.lineTo(leyendaX + 40, y);
    ctx.strokeStyle = '#45b7d1';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillText('Tubería Regante', leyendaX + 50, y + 4);
    y += 35;
    
    const elementos = [
        {color: '#1772af', texto: 'Cabezal', icono: '⚙️'},
        {color: '#ff6b6b', texto: 'Válvula', icono: '⚡'},
        {color: '#00a553', texto: 'Toma de agua', icono: '💧'},
        {color: '#4ecdc4', texto: 'Filtro', icono: '🔍'},
        {color: '#ff9f43', texto: 'Purgas/Terminales', icono: '🚰'}
    ];
    
    elementos.forEach(elem => {
        ctx.beginPath();
        ctx.arc(leyendaX + 15, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = elem.color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(elem.icono, leyendaX + 15, y);
        
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.font = '10px Arial';
        ctx.fillText(elem.texto, leyendaX + 30, y + 4);
        y += 20;
    });
    
    y += 5;
    
    if (valvulas && valvulas.length > 0) {
        ctx.fillStyle = '#1772af';
        ctx.font = 'bold 11px Arial';
        ctx.fillText('VÁLVULAS:', leyendaX + 10, y);
        y += 15;
        
        ctx.fillStyle = '#666';
        ctx.font = '9px Arial';
        
        valvulas.forEach(valvula => {
            if (y < leyendaY + 220) {
                ctx.fillText(`• ${valvula.nombre}: ${valvula.caudalTotal} L/h`, leyendaX + 15, y);
                y += 12;
            }
        });
        
        if (valvulas.length > 3) {
            ctx.fillText(`+ ${valvulas.length - 3} más...`, leyendaX + 15, y);
        }
    }
}

function crearRepresentacionMinima(ctx, marcoX, marcoY, marcoAncho, marcoAlto) {
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(marcoX, marcoY, marcoAncho, marcoAlto);
    
    ctx.fillStyle = '#666';
    ctx.font = 'italic 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No hay elementos en el diseño actual', marcoX + marcoAncho / 2, marcoY + marcoAlto / 2);
    
    ctx.fillText('Agrega tuberías y elementos desde el panel de diseño', marcoX + marcoAncho / 2, marcoY + marcoAlto / 2 + 30);
}

function crearRepresentacionMinimaFallback() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 800;
    canvas.height = 600;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('INFORMACIÓN DEL DISEÑO', canvas.width / 2, 50);
    
    ctx.font = '14px Arial';
    let y = 100;
    
    const info = [
        `Área total: ${areaTotal > 0 ? areaTotal.toFixed(2) + ' m²' : 'No definida'}`,
        `Tuberías: ${tuberias.length}`,
        `Válvulas: ${valvulas.length}`,
        `Elementos: ${elementosGraficos.length}`,
        `Fecha: ${new Date().toLocaleDateString()}`
    ];
    
    info.forEach(texto => {
        ctx.textAlign = 'left';
        ctx.fillText('• ' + texto, 100, y);
        y += 30;
    });
    
    if (valvulas.length > 0) {
        y += 20;
        ctx.font = 'bold 16px Arial';
        ctx.fillText('Válvulas del Sistema:', 100, y);
        y += 25;
        
        ctx.font = '12px Arial';
        let columnaY = y;
        valvulas.forEach((valvula, index) => {
            if (index < 8) {
                ctx.fillText(`${valvula.nombre}: ${valvula.caudalTotal} L/h (${valvula.tipo})`, 
                            100 + (index % 2) * 300, 
                            columnaY + Math.floor(index / 2) * 20);
            }
        });
        
        if (valvulas.length > 8) {
            ctx.fillText(`... y ${valvulas.length - 8} más`, 100, columnaY + 100);
        }
    }
    
    ctx.textAlign = 'center';
    ctx.font = 'italic 12px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText('Para ver el diseño completo interactivo, accede a la aplicación web.', canvas.width / 2, 550);
    ctx.fillText('Esta imagen contiene la información esencial del diseño.', canvas.width / 2, 570);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    capturaCanvas = canvas;
    
    return dataUrl;
}

function actualizarEstadoCaptura(exito, mensaje) {
    const statusDiv = document.getElementById('capturaStatus');
    if (!statusDiv) return;
    
    if (exito) {
        statusDiv.innerHTML = `
            <div style="background: #e8f5e9; padding: 10px; border-radius: 5px; border-left: 4px solid #00a553;">
                <strong><i class="fas fa-check-circle" style="color: #00a553;"></i> ${mensaje}</strong>
                <br>
                <small>Ahora puedes exportar el PDF con el diseño.</small>
            </div>
        `;
    } else {
        statusDiv.innerHTML = `
            <div style="background: #ffeaea; padding: 10px; border-radius: 5px; border-left: 4px solid #ff6b6b;">
                <strong><i class="fas fa-exclamation-circle" style="color: #ff6b6b;"></i> ${mensaje}</strong>
                <br>
                <button onclick="capturarDiseñoActual()" style="margin-top: 5px; padding: 5px 10px; background: #ff6b6b; color: white; border: none; border-radius: 3px; font-size: 0.8rem;">
                    <i class="fas fa-redo"></i> Intentar nuevamente
                </button>
            </div>
        `;
    }
}

function mostrarVistaPreviaCaptura(dataUrl) {
    const previewExistente = document.querySelector('.modal-vista-previa');
    if (previewExistente) {
        previewExistente.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-vista-previa';
    modal.innerHTML = `
        <div class="modal-contenido">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #333;">Vista Previa de la Captura</h3>
                <button onclick="this.closest('.modal-vista-previa').remove()" 
                        style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="overflow: auto; max-height: 70vh; text-align: center;">
                <img src="${dataUrl}" 
                     style="max-width: 100%; border: 1px solid #ddd; border-radius: 5px;"
                     alt="Vista previa del diseño">
            </div>
            <div style="margin-top: 15px; text-align: center; color: #666; font-size: 0.9rem;">
                <p>Esta imagen se incluirá en el PDF. Contiene la información esencial del diseño.</p>
                <button onclick="this.closest('.modal-vista-previa').remove()" 
                        style="background: #00a553; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                    <i class="fas fa-check"></i> Continuar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function forzarRecaptura() {
    capturaTomada = false;
    capturaMapaDataUrl = null;
    capturaCanvas = null;
    
    const statusDiv = document.getElementById('capturaStatus');
    if (statusDiv) {
        statusDiv.innerHTML = `
            <div style="background: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107;">
                <strong><i class="fas fa-sync-alt" style="color: #ffc107;"></i> Listo para nueva captura</strong>
                <br>
                <small>Haz clic en "Capturar Diseño Actual" para generar una nueva imagen.</small>
            </div>
        `;
    }
    
    mostrarMensaje('Listo para nueva captura. Ajusta la vista del mapa si es necesario.', 3000);
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
// FUNCIONES DE GESTIÓN DE DISEÑOS
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
            posicion: [e.posicion.lat, e.posicion.lng]
        })),
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
        miniatura: imagenDiseñoDataUrl,
        metadata: {
            version: '1.1',
            software: 'Agrosistemas Diseñador CAD',
            fechaExportacion: new Date().toISOString(),
            totalElementos: tuberias.length + elementosGraficos.length + valvulas.length + cabezales.length,
            tuberiasConAristas: tuberias.filter(t => {
                const puntos = extraerPuntosLinea(t.linea);
                return puntos.length > 2;
            }).length
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
    
    if (diseño.elementos) {
        diseño.elementos.forEach(eData => {
            agregarElementoGrafico(L.latLng(eData.posicion[0], eData.posicion[1]), eData.tipo);
        });
    }
    
    if (diseño.valvulas) {
        valvulas = diseño.valvulas.map(v => ({
            ...v,
            posicion: v.posicion ? L.latLng(v.posicion[0], v.posicion[1]) : null
        }));
    }
    
    if (diseño.cabezales) {
        cabezales = diseño.cabezales.map(c => ({
            ...c,
            posicion: c.posicion ? L.latLng(c.posicion[0], c.posicion[1]) : null
        }));
    }
    
    actualizarResumenTuberias();
    actualizarResultados();
    mostrarMensaje(`Diseño "${diseño.nombre}" cargado correctamente. Tuberías con aristas: ${diseño.tuberias.filter(t => t.tieneAristas).length}`);
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
// FUNCIÓN DE LIMPIAR DISEÑO (IGUAL AL ORIGINAL)
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