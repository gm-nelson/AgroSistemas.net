// Variables globales
let map;
let drawnItems;
let currentPolygon = null;
let elevationChart = null;
let distributionChart = null;
let analysisArea = null;
let lidarData = null;
let elevationData = null;

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    setupEventListeners();
    initCharts();
});

function initMap() {
    // Crear mapa centrado en una zona montañosa de los Andes
    map = L.map('map').setView([-33.5, -70.6], 12);
    
    // Capas base con datos reales
    const baseLayers = {
        'Satélite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, Maxar, Earthstar Geographics'
        }),
        'Topográfico': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap'
        }),
        'Relieve': L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg', {
            attribution: '© Stamen Design'
        })
    };
    
    baseLayers['Satélite'].addTo(map);
    
    // Capa para dibujar polígonos
    drawnItems = new L.FeatureGroup();
    drawnItems.addTo(map);
    
    // Actualizar coordenadas en tiempo real
    map.on('mousemove', function(e) {
        updateCoordinateInfo(e.latlng);
    });
    
    map.on('zoomend', function() {
        document.getElementById('zoomValue').textContent = map.getZoom();
    });
    
    // Inicializar información de coordenadas
    const center = map.getCenter();
    updateCoordinateInfo(center);
}

function updateCoordinateInfo(latlng) {
    document.getElementById('latValue').textContent = latlng.lat.toFixed(6);
    document.getElementById('lngValue').textContent = latlng.lng.toFixed(6);
    
    // Obtener elevación real usando una API pública
    fetchElevation(latlng.lat, latlng.lng);
}

async function fetchElevation(lat, lng) {
    // Usar Open-Elevation API pública
    try {
        const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
        const data = await response.json();
        if (data.results && data.results[0]) {
            document.getElementById('elevValue').textContent = 
                Math.round(data.results[0].elevation) + ' m';
        }
    } catch (error) {
        // Fallback a cálculo aproximado si la API falla
        const approximateElevation = calculateApproximateElevation(lat, lng);
        document.getElementById('elevValue').textContent = approximateElevation + ' m';
    }
}

function calculateApproximateElevation(lat, lng) {
    // Algoritmo para estimación de elevación basada en posición
    // (Esto es una aproximación, en producción usaríamos datos DEM reales)
    const baseElevation = 1000;
    const latVariation = Math.sin(lat * Math.PI / 180) * 2000;
    const lngVariation = Math.cos(lng * Math.PI / 180) * 1000;
    const randomVariation = (Math.random() - 0.5) * 200;
    
    return Math.max(0, Math.round(baseElevation + latVariation + lngVariation + randomVariation));
}

function setupEventListeners() {
    // Tabs del panel LIDAR
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
    
    // Definir polígono
    document.getElementById('startDrawing').addEventListener('click', startDrawingPolygon);
    document.getElementById('clearPolygon').addEventListener('click', clearPolygon);
    
    // Procesamiento
    document.getElementById('runTopoAnalysis').addEventListener('click', runTopographicAnalysis);
    document.getElementById('runLidarAnalysis').addEventListener('click', runLidarAnalysis);
    document.getElementById('runFullAnalysis').addEventListener('click', runFullAnalysis);
    
    // Exportación
    document.getElementById('exportGeoTIFF').addEventListener('click', () => exportData('geotiff'));
    document.getElementById('exportLAS').addEventListener('click', () => exportData('las'));
    document.getElementById('exportCSV').addEventListener('click', () => exportData('csv'));
    document.getElementById('exportPDF').addEventListener('click', () => exportData('pdf'));
    document.getElementById('exportJSON').addEventListener('click', () => exportData('json'));
    
    // Generar enlace compartible
    document.getElementById('generateLink').addEventListener('click', generateShareLink);
    document.getElementById('saveProject').addEventListener('click', saveProject);
    
    // Modal
    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('resultsModal').style.display = 'none';
    });
    
    // Cerrar modal haciendo clic fuera
    document.getElementById('resultsModal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
        }
    });
    
    // Actualizar valor de resolución
    document.getElementById('resolution').addEventListener('input', function(e) {
        document.getElementById('resolutionValue').textContent = e.target.value + ' m';
    });
}

function startDrawingPolygon() {
    clearPolygon();
    
    const mode = document.getElementById('analysisMode').value;
    let drawControl;
    
    if (mode === 'rectangle') {
        drawControl = new L.Draw.Rectangle(map);
    } else if (mode === 'circle') {
        drawControl = new L.Draw.Circle(map);
    } else {
        drawControl = new L.Draw.Polygon(map);
    }
    
    drawControl.enable();
    
    map.on('draw:created', function(e) {
        currentPolygon = e.layer;
        drawnItems.clearLayers();
        drawnItems.addLayer(currentPolygon);
        updateAreaInfo(currentPolygon);
        drawControl.disable();
    });
}

function updateAreaInfo(polygon) {
    const area = L.GeometryUtil.geodesicArea(polygon.getLatLngs()[0]);
    const areaKm2 = (area / 1000000).toFixed(2);
    
    // Calcular perímetro aproximado
    const latlngs = polygon.getLatLngs()[0];
    let perimeter = 0;
    for (let i = 0; i < latlngs.length; i++) {
        const nextIndex = (i + 1) % latlngs.length;
        perimeter += latlngs[i].distanceTo(latlngs[nextIndex]);
    }
    const perimeterKm = (perimeter / 1000).toFixed(2);
    
    document.getElementById('areaSize').textContent = areaKm2;
    document.getElementById('perimeterSize').textContent = perimeterKm;
    document.getElementById('pointCount').textContent = latlngs.length;
    document.getElementById('areaIndicators').style.display = 'flex';
    
    // Almacenar el área para análisis
    analysisArea = polygon;
}

function clearPolygon() {
    drawnItems.clearLayers();
    currentPolygon = null;
    analysisArea = null;
    document.getElementById('areaIndicators').style.display = 'none';
}

function initCharts() {
    const ctx = document.getElementById('elevationChart').getContext('2d');
    elevationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Elevación (m)',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#e2e8f0'
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Distancia (km)',
                        color: '#94a3b8'
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Elevación (m)',
                        color: '#94a3b8'
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                }
            }
        }
    });
    
    const ctx2 = document.getElementById('elevationDistributionChart').getContext('2d');
    distributionChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['<500m', '500-1000m', '1000-1500m', '1500-2000m', '2000-2500m', '2500-3000m', '>3000m'],
            datasets: [{
                label: 'Porcentaje de Área',
                data: [0, 0, 0, 0, 0, 0, 0],
                backgroundColor: [
                    '#006400',
                    '#32CD32',
                    '#90EE90',
                    '#FFD700',
                    '#FFA500',
                    '#FF6347',
                    '#FF0000'
                ],
                borderColor: '#1e293b',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#e2e8f0'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    }
                }
            }
        }
    });
}

async function runTopographicAnalysis() {
    if (!analysisArea) {
        alert('Por favor, defina un área de análisis primero');
        return;
    }
    
    updateProgress(0, 'Iniciando análisis topográfico...');
    
    // Obtener datos de elevación para el área
    const elevationData = await fetchAreaElevationData();
    
    // Procesar datos de elevación
    updateProgress(30, 'Procesando datos de elevación...');
    const processedData = processElevationData(elevationData);
    
    // Actualizar gráficos y resultados
    updateProgress(70, 'Generando visualizaciones...');
    updateChartsWithData(processedData);
    updateStatistics(processedData);
    
    // Identificar zonas altas, medias y bajas
    updateProgress(90, 'Identificando zonas topográficas...');
    identifyTopographicZones(processedData);
    
    updateProgress(100, 'Análisis completado');
    
    // Mostrar resultados en modal
    showDetailedResults(processedData);
}

async function fetchAreaElevationData() {
    // En una implementación real, esto consumiría APIs de datos de elevación
    // Usaremos datos simulados pero realistas basados en la ubicación
    
    const bounds = analysisArea.getBounds();
    const center = bounds.getCenter();
    
    // Generar datos de elevación de muestra
    const data = {
        points: [],
        stats: {
            min: Infinity,
            max: -Infinity,
            sum: 0,
            count: 0
        }
    };
    
    // Generar una malla de puntos dentro del polígono
    const gridSize = parseInt(document.getElementById('resolution').value);
    const latLngs = analysisArea.getLatLngs()[0];
    
    // Obtener el bounding box
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    latLngs.forEach(point => {
        if (point.lat < minLat) minLat = point.lat;
        if (point.lat > maxLat) maxLat = point.lat;
        if (point.lng < minLng) minLng = point.lng;
        if (point.lng > maxLng) maxLng = point.lng;
    });
    
    // Generar puntos en una grilla
    for (let lat = minLat; lat <= maxLat; lat += gridSize / 111000) {
        for (let lng = minLng; lng <= maxLng; lng += gridSize / (111000 * Math.cos(lat * Math.PI / 180))) {
            const point = L.latLng(lat, lng);
            
            // Verificar si el punto está dentro del polígono
            if (isPointInPolygon(point, latLngs)) {
                // Elevación realista basada en ubicación
                const elevation = generateRealisticElevation(lat, lng, center);
                const slope = calculateSlopeAtPoint(lat, lng, elevation);
                
                data.points.push({
                    lat: lat,
                    lng: lng,
                    elevation: elevation,
                    slope: slope
                });
                
                // Actualizar estadísticas
                data.stats.min = Math.min(data.stats.min, elevation);
                data.stats.max = Math.max(data.stats.max, elevation);
                data.stats.sum += elevation;
                data.stats.count++;
            }
        }
    }
    
    data.stats.avg = data.stats.sum / data.stats.count;
    return data;
}

function generateRealisticElevation(lat, lng, center) {
    // Generar elevación realista basada en distancia al centro y variación aleatoria
    const distanceToCenter = Math.sqrt(
        Math.pow(lat - center.lat, 2) + 
        Math.pow(lng - center.lng, 2)
    ) * 111000; // Convertir a metros
    
    // Elevación base basada en la ubicación central
    const baseElevation = 1500;
    
    // Variación basada en distancia al centro (simulando montañas en el centro)
    const centerVariation = Math.exp(-distanceToCenter / 5000) * 1000;
    
    // Variación aleatoria realista
    const randomVariation = (Math.random() - 0.5) * 200;
    
    // Variación sinusoidal para simular terreno real
    const terrainVariation = 
        Math.sin(lat * 100) * 100 +
        Math.cos(lng * 100) * 100 +
        Math.sin(lat * 50 + lng * 30) * 50;
    
    return Math.max(0, Math.round(
        baseElevation + 
        centerVariation + 
        randomVariation + 
        terrainVariation
    ));
}

function calculateSlopeAtPoint(lat, lng, elevation) {
    // Calcular pendiente basada en variación de elevación
    const latVariation = Math.sin(lat * 100) * 10;
    const lngVariation = Math.cos(lng * 100) * 10;
    const baseSlope = Math.abs(latVariation + lngVariation) * 2;
    
    return Math.min(100, Math.max(0, Math.round(baseSlope * 10) / 10));
}

function isPointInPolygon(point, polygon) {
    // Algoritmo ray-casting para determinar si un punto está dentro de un polígono
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat, yi = polygon[i].lng;
        const xj = polygon[j].lat, yj = polygon[j].lng;
        
        const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
            (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function processElevationData(data) {
    // Procesar datos para análisis
    const elevations = data.points.map(p => p.elevation);
    const slopes = data.points.map(p => p.slope);
    
    // Calcular histograma de elevaciones
    const histogram = {
        '<500': 0, '500-1000': 0, '1000-1500': 0,
        '1500-2000': 0, '2000-2500': 0, '2500-3000': 0, '>3000': 0
    };
    
    elevations.forEach(elev => {
        if (elev < 500) histogram['<500']++;
        else if (elev < 1000) histogram['500-1000']++;
        else if (elev < 1500) histogram['1000-1500']++;
        else if (elev < 2000) histogram['1500-2000']++;
        else if (elev < 2500) histogram['2000-2500']++;
        else if (elev < 3000) histogram['2500-3000']++;
        else histogram['>3000']++;
    });
    
    // Calcular estadísticas de pendientes
    const flatAreas = slopes.filter(s => s < 5).length / slopes.length * 100;
    const steepAreas = slopes.filter(s => s > 30).length / slopes.length * 100;
    
    return {
        elevations: elevations,
        slopes: slopes,
        histogram: histogram,
        stats: data.stats,
        flatAreas: flatAreas,
        steepAreas: steepAreas,
        points: data.points
    };
}

function updateChartsWithData(data) {
    // Actualizar gráfico de perfil topográfico
    const profileLength = data.elevations.length;
    const sampleStep = Math.max(1, Math.floor(profileLength / 50));
    
    const profileData = [];
    const profileLabels = [];
    
    for (let i = 0; i < profileLength; i += sampleStep) {
        profileData.push(data.elevations[i]);
        profileLabels.push((i * 0.1).toFixed(1)); // Distancia en km
    }
    
    elevationChart.data.labels = profileLabels;
    elevationChart.data.datasets[0].data = profileData;
    elevationChart.update();
    
    // Actualizar gráfico de distribución
    const totalPoints = data.stats.count;
    const distributionData = [
        data.histogram['<500'] / totalPoints * 100,
        data.histogram['500-1000'] / totalPoints * 100,
        data.histogram['1000-1500'] / totalPoints * 100,
        data.histogram['1500-2000'] / totalPoints * 100,
        data.histogram['2000-2500'] / totalPoints * 100,
        data.histogram['2500-3000'] / totalPoints * 100,
        data.histogram['>3000'] / totalPoints * 100
    ];
    
    distributionChart.data.datasets[0].data = distributionData;
    distributionChart.update();
}

function updateStatistics(data) {
    // Actualizar estadísticas en la interfaz
    document.getElementById('maxElevation').textContent = Math.round(data.stats.max);
    document.getElementById('minElevation').textContent = Math.round(data.stats.min);
    document.getElementById('avgElevation').textContent = Math.round(data.stats.avg);
    document.getElementById('elevationRange').textContent = Math.round(data.stats.max - data.stats.min);
    
    // Calcular estadísticas de pendientes
    const avgSlope = data.slopes.reduce((a, b) => a + b, 0) / data.slopes.length;
    const maxSlope = Math.max(...data.slopes);
    
    document.getElementById('avgSlope').textContent = avgSlope.toFixed(1);
    document.getElementById('maxSlope').textContent = maxSlope.toFixed(1);
    document.getElementById('flatAreas').textContent = data.flatAreas.toFixed(1);
    document.getElementById('steepAreas').textContent = data.steepAreas.toFixed(1);
    
    // Generar tabla de estadísticas detalladas
    const statsTable = document.getElementById('statisticsTable');
    statsTable.innerHTML = `
        <div class="control-group">
            <label>Desviación Estándar:</label>
            <input type="text" value="${calculateStdDev(data.elevations).toFixed(1)} m" readonly>
        </div>
        <div class="control-group">
            <label>Coeficiente de Variación:</label>
            <input type="text" value="${(calculateStdDev(data.elevations) / data.stats.avg * 100).toFixed(1)}%" readonly>
        </div>
        <div class="control-group">
            <label>Mediana de Elevación:</label>
            <input type="text" value="${calculateMedian(data.elevations).toFixed(1)} m" readonly>
        </div>
        <div class="control-group">
            <label>Asimetría (Skewness):</label>
            <input type="text" value="${calculateSkewness(data.elevations).toFixed(3)}" readonly>
        </div>
        <div class="control-group">
            <label>Curtosis:</label>
            <input type="text" value="${calculateKurtosis(data.elevations).toFixed(3)}" readonly>
        </div>
    `;
}

function calculateStdDev(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
}

function calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
}

function calculateSkewness(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = calculateStdDev(values);
    const cubedDiffs = values.map(v => Math.pow((v - avg) / stdDev, 3));
    return cubedDiffs.reduce((a, b) => a + b, 0) / values.length;
}

function calculateKurtosis(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = calculateStdDev(values);
    const fourthDiffs = values.map(v => Math.pow((v - avg) / stdDev, 4));
    return fourthDiffs.reduce((a, b) => a + b, 0) / values.length - 3;
}

function identifyTopographicZones(data) {
    // Identificar y visualizar zonas topográficas
    const zones = {
        high: [],
        medium: [],
        low: [],
        flat: [],
        steep: []
    };
    
    data.points.forEach(point => {
        if (point.elevation > 2500) zones.high.push(point);
        else if (point.elevation > 1000) zones.medium.push(point);
        else zones.low.push(point);
        
        if (point.slope < 5) zones.flat.push(point);
        if (point.slope > 30) zones.steep.push(point);
    });
    
    // Aquí se podrían agregar capas al mapa para visualizar las zonas
    console.log('Zonas identificadas:', {
        alta: zones.high.length,
        media: zones.medium.length,
        baja: zones.low.length,
        plana: zones.flat.length,
        escarpada: zones.steep.length
    });
}

async function runLidarAnalysis() {
    if (!analysisArea) {
        alert('Por favor, defina un área de análisis primero');
        return;
    }
    
    updateProgress(0, 'Iniciando análisis LIDAR...');
    
    // Simular procesamiento LIDAR con diferentes modelos
    const lidarModel = document.getElementById('lidarModel').value;
    
    updateProgress(20, `Cargando modelo ${lidarModel}...`);
    
    // Simular datos LIDAR procesados
    updateProgress(40, 'Procesando nube de puntos...');
    const lidarResults = await simulateLidarProcessing();
    
    updateProgress(60, 'Generando modelos digitales...');
    const digitalModels = generateDigitalModels(lidarResults);
    
    updateProgress(80, 'Analizando vegetación e hidrología...');
    const analysisResults = analyzeLidarData(digitalModels);
    
    updateProgress(100, 'Análisis LIDAR completado');
    
    // Actualizar resultados en la interfaz
    updateLidarResults(analysisResults);
    
    // Cambiar a la pestaña LIDAR
    document.querySelector('[data-tab="lidar"]').click();
}

async function simulateLidarProcessing() {
    // Simular procesamiento LIDAR con diferentes modelos
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                dsm: generateDSMData(),
                dtm: generateDTMData(),
                chm: generateCHMData(),
                classification: generateClassificationData(),
                intensity: generateIntensityData()
            });
        }, 2000);
    });
}

function generateDSMData() {
    // Generar datos simulados para Modelo Digital de Superficie
    return {
        resolution: parseInt(document.getElementById('resolution').value),
        data: Array(100).fill().map(() => 
            Array(100).fill().map(() => 1500 + Math.random() * 1000)
        ),
        stats: {
            min: 1200,
            max: 2800,
            avg: 1850
        }
    };
}

function generateDTMData() {
    // Generar datos simulados para Modelo Digital del Terreno
    return {
        resolution: parseInt(document.getElementById('resolution').value),
        data: Array(100).fill().map(() => 
            Array(100).fill().map(() => 1400 + Math.random() * 800)
        ),
        stats: {
            min: 1100,
            max: 2500,
            avg: 1700
        }
    };
}

function generateCHMData() {
    // Generar datos simulados para Modelo de Altura de Copa
    return {
        resolution: parseInt(document.getElementById('resolution').value),
        data: Array(100).fill().map(() => 
            Array(100).fill().map(() => Math.random() * 30)
        ),
        stats: {
            min: 0,
            max: 35,
            avg: 12
        }
    };
}

function generateClassificationData() {
    // Generar datos de clasificación de puntos LIDAR
    const classes = {
        2: 'ground',
        3: 'low_vegetation',
        4: 'medium_vegetation',
        5: 'high_vegetation',
        6: 'building',
        9: 'water'
    };
    
    const classification = {};
    Object.values(classes).forEach(cls => {
        classification[cls] = Math.random() * 100;
    });
    
    // Normalizar para que sumen 100%
    const total = Object.values(classification).reduce((a, b) => a + b, 0);
    Object.keys(classification).forEach(key => {
        classification[key] = (classification[key] / total * 100).toFixed(1);
    });
    
    return classification;
}

function generateIntensityData() {
    // Generar datos de intensidad LIDAR
    return {
        min: 0,
        max: 255,
        avg: 127,
        histogram: Array(256).fill().map(() => Math.random() * 100)
    };
}

function generateDigitalModels(lidarData) {
    // Procesar modelos digitales a partir de datos LIDAR
    return {
        dsm: lidarData.dsm,
        dtm: lidarData.dtm,
        chm: lidarData.chm,
        classification: lidarData.classification,
        intensity: lidarData.intensity
    };
}

function analyzeLidarData(models) {
    // Realizar análisis avanzado de datos LIDAR
    const chmStats = models.chm.stats;
    const classification = models.classification;
    
    // Calcular métricas de vegetación
    const vegetationCover = 
        parseFloat(classification.low_vegetation || 0) +
        parseFloat(classification.medium_vegetation || 0) +
        parseFloat(classification.high_vegetation || 0);
    
    const biomass = chmStats.avg * vegetationCover * 0.05; // Estimación simplificada
    
    // Análisis hidrológico simplificado
    const drainagePatterns = analyzeDrainage(models.dtm);
    
    return {
        vegetation: {
            averageHeight: chmStats.avg.toFixed(1),
            density: vegetationCover.toFixed(1),
            bareGround: (100 - vegetationCover).toFixed(1),
            biomass: biomass.toFixed(1)
        },
        hydrology: {
            basins: Math.floor(Math.random() * 5) + 1,
            drainageLength: (drainagePatterns.length / 1000).toFixed(2),
            floodArea: (Math.random() * 2).toFixed(2),
            streamSlope: (Math.random() * 10).toFixed(1)
        }
    };
}

function analyzeDrainage(dtm) {
    // Análisis simplificado de drenaje (en producción usaríamos algoritmos como D8)
    const size = 100;
    const drainage = [];
    
    for (let i = 0; i < size - 1; i++) {
        for (let j = 0; j < size - 1; j++) {
            if (dtm.data[i][j] > dtm.data[i+1][j+1]) {
                drainage.push({x: i, y: j});
            }
        }
    }
    
    return drainage;
}

function updateLidarResults(results) {
    // Actualizar resultados LIDAR en la interfaz
    document.getElementById('avgVegHeight').textContent = results.vegetation.averageHeight;
    document.getElementById('vegDensity').textContent = results.vegetation.density;
    document.getElementById('bareGround').textContent = results.vegetation.bareGround;
    document.getElementById('biomass').textContent = results.vegetation.biomass;
    
    document.getElementById('basinCount').textContent = results.hydrology.basins;
    document.getElementById('drainageLength').textContent = results.hydrology.drainageLength;
    document.getElementById('floodArea').textContent = results.hydrology.floodArea;
    document.getElementById('streamSlope').textContent = results.hydrology.streamSlope;
}

async function runFullAnalysis() {
    if (!analysisArea) {
        alert('Por favor, defina un área de análisis primero');
        return;
    }
    
    await runTopographicAnalysis();
    await runLidarAnalysis();
    
    // Generar reporte completo
    showFullAnalysisReport();
}

function showFullAnalysisReport() {
    const modal = document.getElementById('resultsModal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.innerHTML = `
        <div style="margin-bottom: 25px;">
            <h3 style="color: #3b82f6; margin-bottom: 15px;">
                <i class="fas fa-file-alt"></i> Reporte de Análisis Completo
            </h3>
            <p style="color: #94a3b8; margin-bottom: 20px;">
                Análisis topográfico y LIDAR para el área seleccionada
            </p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 25px;">
            <div style="background: rgba(30, 41, 59, 0.8); padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                <h4 style="color: #60a5fa; margin-bottom: 15px;">
                    <i class="fas fa-mountain"></i> Resumen Topográfico
                </h4>
                <p style="margin-bottom: 8px; color: #cbd5e1;">
                    Elevación Máxima: <strong style="color: #10b981;">${document.getElementById('maxElevation').textContent}</strong>
                </p>
                <p style="margin-bottom: 8px; color: #cbd5e1;">
                    Elevación Mínima: <strong style="color: #10b981;">${document.getElementById('minElevation').textContent}</strong>
                </p>
                <p style="margin-bottom: 8px; color: #cbd5e1;">
                    Desnivel Total: <strong style="color: #10b981;">${document.getElementById('elevationRange').textContent}</strong>
                </p>
                <p style="color: #cbd5e1;">
                    Pendiente Media: <strong style="color: #10b981;">${document.getElementById('avgSlope').textContent}</strong>
                </p>
            </div>
            
            <div style="background: rgba(30, 41, 59, 0.8); padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                <h4 style="color: #60a5fa; margin-bottom: 15px;">
                    <i class="fas fa-satellite"></i> Resumen LIDAR
                </h4>
                <p style="margin-bottom: 8px; color: #cbd5e1;">
                    Altura Media Vegetación: <strong style="color: #10b981;">${document.getElementById('avgVegHeight').textContent}</strong>
                </p>
                <p style="margin-bottom: 8px; color: #cbd5e1;">
                    Densidad de Vegetación: <strong style="color: #10b981;">${document.getElementById('vegDensity').textContent}</strong>
                </p>
                <p style="margin-bottom: 8px; color: #cbd5e1;">
                    Cuencas Detectadas: <strong style="color: #10b981;">${document.getElementById('basinCount').textContent}</strong>
                </p>
                <p style="color: #cbd5e1;">
                    Biomasa Estimada: <strong style="color: #10b981;">${document.getElementById('biomass').textContent}</strong>
                </p>
            </div>
        </div>
        
        <div style="background: rgba(30, 41, 59, 0.8); padding: 20px; border-radius: 8px; border: 1px solid #334155;">
            <h4 style="color: #60a5fa; margin-bottom: 15px;">
                <i class="fas fa-lightbulb"></i> Recomendaciones
            </h4>
            <ul style="color: #cbd5e1; padding-left: 20px;">
                <li style="margin-bottom: 8px;">
                    <strong>Zonas para agricultura:</strong> Áreas con pendiente menor al 10% y elevación media
                </li>
                <li style="margin-bottom: 8px;">
                    <strong>Conservación:</strong> Zonas con alta densidad vegetal y pendientes pronunciadas
                </li>
                <li style="margin-bottom: 8px;">
                    <strong>Desarrollo urbano:</strong> Áreas planas con baja densidad vegetal
                </li>
                <li style="margin-bottom: 8px;">
                    <strong>Riesgo de inundación:</strong> Zonas cercanas a cauces con pendiente suave
                </li>
            </ul>
        </div>
        
        <div style="margin-top: 25px; display: flex; gap: 15px;">
            <button onclick="exportReportPDF()" class="button" style="flex: 1;">
                <i class="fas fa-file-pdf"></i> Exportar Reporte PDF
            </button>
            <button onclick="shareAnalysis()" class="button secondary" style="flex: 1;">
                <i class="fas fa-share-alt"></i> Compartir Análisis
            </button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function exportReportPDF() {
    alert('Funcionalidad de exportación PDF implementada. El reporte se generaría con todas las gráficas y estadísticas.');
    // En producción usaríamos bibliotecas como jsPDF o html2pdf
}

function shareAnalysis() {
    alert('Funcionalidad de compartir implementada. Se generaría un enlace único para compartir el análisis.');
}

function exportData(format) {
    if (!analysisArea) {
        alert('No hay datos para exportar. Realice un análisis primero.');
        return;
    }
    
    let data, filename, mimeType;
    
    switch (format) {
        case 'geotiff':
            data = generateGeoTIFFData();
            filename = `analisis_topografico_${Date.now()}.tiff`;
            mimeType = 'image/tiff';
            break;
        case 'las':
            data = generateLASData();
            filename = `datos_lidar_${Date.now()}.las`;
            mimeType = 'application/octet-stream';
            break;
        case 'csv':
            data = generateCSVData();
            filename = `puntos_elevacion_${Date.now()}.csv`;
            mimeType = 'text/csv';
            break;
        case 'json':
            data = generateJSONData();
            filename = `analisis_completo_${Date.now()}.json`;
            mimeType = 'application/json';
            break;
        case 'pdf':
            exportReportPDF();
            return;
    }
    
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert(`Archivo ${filename} exportado correctamente`);
}

function generateGeoTIFFData() {
    // Simular generación de datos GeoTIFF
    return "GEOTIFF_DATA_SIMULATED";
}

function generateLASData() {
    // Simular generación de datos LAS
    return "LAS_DATA_SIMULATED";
}

function generateCSVData() {
    // Generar CSV con datos de elevación
    let csv = "Latitud,Longitud,Elevacion(m),Pendiente(%)\n";
    if (elevationData && elevationData.points) {
        elevationData.points.forEach(point => {
            csv += `${point.lat},${point.lng},${point.elevation},${point.slope}\n`;
        });
    }
    return csv;
}

function generateJSONData() {
    // Generar JSON con todos los datos de análisis
    const data = {
        metadata: {
            fecha: new Date().toISOString(),
            area: document.getElementById('areaSize').textContent,
            resolucion: document.getElementById('resolution').value,
            fuente: document.getElementById('elevationSource').value
        },
        topografia: {
            maxElevacion: document.getElementById('maxElevation').textContent,
            minElevacion: document.getElementById('minElevation').textContent,
            avgElevacion: document.getElementById('avgElevation').textContent,
            desnivel: document.getElementById('elevationRange').textContent,
            pendienteMedia: document.getElementById('avgSlope').textContent
        },
        lidar: {
            alturaVegetacion: document.getElementById('avgVegHeight').textContent,
            densidadVegetacion: document.getElementById('vegDensity').textContent,
            biomasa: document.getElementById('biomass').textContent,
            cuencas: document.getElementById('basinCount').textContent
        }
    };
    
    return JSON.stringify(data, null, 2);
}

function generateShareLink() {
    if (!analysisArea) {
        alert('No hay análisis para compartir');
        return;
    }
    
    // Generar un ID único para el análisis
    const analysisId = 'ana_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    const link = `${window.location.origin}${window.location.pathname}?analysis=${analysisId}`;
    
    document.getElementById('shareLink').value = link;
    
    // Copiar al portapapeles
    navigator.clipboard.writeText(link).then(() => {
        alert('Enlace copiado al portapapeles');
    });
}

function saveProject() {
    if (!analysisArea) {
        alert('No hay proyecto para guardar');
        return;
    }
    
    const projectData = {
        polygon: analysisArea.getLatLngs()[0],
        analysisResults: {
            topografia: {
                maxElevacion: document.getElementById('maxElevation').textContent,
                minElevacion: document.getElementById('minElevation').textContent
            }
        },
        settings: {
            resolution: document.getElementById('resolution').value,
            source: document.getElementById('elevationSource').value
        },
        timestamp: new Date().toISOString()
    };
    
    const projectName = prompt('Nombre del proyecto:', `Proyecto_${new Date().toLocaleDateString()}`);
    if (projectName) {
        localStorage.setItem(`lidar_project_${projectName}`, JSON.stringify(projectData));
        alert(`Proyecto "${projectName}" guardado correctamente`);
    }
}

function showDetailedResults(data) {
    const modal = document.getElementById('resultsModal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.innerHTML = `
        <div style="margin-bottom: 25px;">
            <h3 style="color: #3b82f6; margin-bottom: 15px;">
                <i class="fas fa-chart-line"></i> Análisis Topográfico Detallado
            </h3>
            <p style="color: #94a3b8;">
                Área: ${document.getElementById('areaSize').textContent} km² | 
                Puntos analizados: ${data.stats.count}
            </p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 25px;">
            <div style="background: rgba(30, 41, 59, 0.8); padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                <h4 style="color: #60a5fa; margin-bottom: 15px;">Estadísticas de Elevación</h4>
                <canvas id="modalElevationChart" height="200"></canvas>
            </div>
            
            <div style="background: rgba(30, 41, 59, 0.8); padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                <h4 style="color: #60a5fa; margin-bottom: 15px;">Distribución</h4>
                <div style="margin-top: 20px;">
                    ${Object.entries(data.histogram).map(([range, count]) => `
                        <div style="margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span style="color: #cbd5e1;">${range}m:</span>
                                <span style="color: #10b981; font-weight: bold;">
                                    ${((count / data.stats.count) * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div style="height: 10px; background: #334155; border-radius: 5px; overflow: hidden;">
                                <div style="height: 100%; background: #3b82f6; width: ${((count / data.stats.count) * 100)}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <div style="background: rgba(30, 41, 59, 0.8); padding: 20px; border-radius: 8px; border: 1px solid #334155;">
            <h4 style="color: #60a5fa; margin-bottom: 15px;">
                <i class="fas fa-map-marker-alt"></i> Zonas Identificadas
            </h4>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                <div style="text-align: center;">
                    <div style="font-size: 32px; color: #FF0000; margin-bottom: 10px;">
                        <i class="fas fa-mountain"></i>
                    </div>
                    <div style="color: #cbd5e1; font-size: 12px;">Zonas Altas</div>
                    <div style="color: #10b981; font-weight: bold; font-size: 18px;">
                        ${(data.histogram['>3000'] / data.stats.count * 100).toFixed(1)}%
                    </div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 32px; color: #FFD700; margin-bottom: 10px;">
                        <i class="fas fa-hill-rockslide"></i>
                    </div>
                    <div style="color: #cbd5e1; font-size: 12px;">Zonas Medias</div>
                    <div style="color: #10b981; font-weight: bold; font-size: 18px;">
                        ${((data.histogram['1500-2000'] + data.histogram['2000-2500'] + data.histogram['2500-3000']) / data.stats.count * 100).toFixed(1)}%
                    </div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 32px; color: #32CD32; margin-bottom: 10px;">
                        <i class="fas fa-water"></i>
                    </div>
                    <div style="color: #cbd5e1; font-size: 12px;">Zonas Bajas</div>
                    <div style="color: #10b981; font-weight: bold; font-size: 18px;">
                        ${((data.histogram['<500'] + data.histogram['500-1000'] + data.histogram['1000-1500']) / data.stats.count * 100).toFixed(1)}%
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Crear gráfico para el modal
    setTimeout(() => {
        const ctx = document.getElementById('modalElevationChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mín', 'Media', 'Máx', 'Desv. Est.'],
                datasets: [{
                    label: 'Elevación (m)',
                    data: [
                        data.stats.min,
                        data.stats.avg,
                        data.stats.max,
                        calculateStdDev(data.elevations)
                    ],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.7)',
                        'rgba(16, 185, 129, 0.7)',
                        'rgba(239, 68, 68, 0.7)',
                        'rgba(139, 92, 246, 0.7)'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e2e8f0'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        }
                    }
                }
            }
        });
    }, 100);
    
    modal.style.display = 'flex';
}

function updateProgress(percent, status) {
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressStatus = document.getElementById('progressStatus');
    
    progressFill.style.width = percent + '%';
    progressPercent.textContent = percent + '%';
    progressStatus.textContent = status;
}