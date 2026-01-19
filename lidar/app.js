class TopoAnalyzer {
    constructor() {
        this.map = null;
        this.drawnItems = new L.FeatureGroup();
        this.polygon = null;
        this.elevationData = [];
        this.isDrawing = false;
        this.tempPolyline = null;
        this.clickPoints = [];
        this.markers = []; // Para almacenar los marcadores
        
        this.initMap();
        this.initCharts();
        this.bindEvents();
        this.init3DScene();
    }

    initMap() {
        this.map = L.map('map', {
            center: [40.4168, -3.7038], // Madrid
            zoom: 12,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.drawnItems.addTo(this.map);
    }

    bindEvents() {
        document.getElementById('drawPolygon').addEventListener('click', () => this.startDrawing());
        document.getElementById('clearAll').addEventListener('click', () => this.clearAll());
        document.getElementById('exportData').addEventListener('click', () => this.exportData());

        this.map.on('click', (e) => {
            if (this.isDrawing) {
                this.handleMapClick(e);
            }
        });
    }

    startDrawing() {
        this.clearAll();
        this.isDrawing = true;
        this.clickPoints = [];
        this.markers = [];
        
        const drawBtn = document.getElementById('drawPolygon');
        drawBtn.disabled = true;
        drawBtn.textContent = 'Dibujando...';
        drawBtn.classList.add('drawing');
        
        // Agregar botón para cerrar polígono
        this.addCloseButton();
        
        this.showMessage('Haz clic en el mapa para dibujar el polígono. Haz clic en "Cerrar Polígono" cuando termines.');
    }

    addCloseButton() {
        // Remover botón anterior si existe
        const oldBtn = document.getElementById('closePolygonBtn');
        if (oldBtn) oldBtn.remove();
        
        // Crear nuevo botón
        const closeBtn = document.createElement('button');
        closeBtn.id = 'closePolygonBtn';
        closeBtn.className = 'btn btn-success';
        closeBtn.textContent = 'Cerrar Polígono';
        closeBtn.style.marginTop = '10px';
        closeBtn.style.display = 'none';
        
        closeBtn.addEventListener('click', () => this.completePolygon());
        
        document.querySelector('.button-group').appendChild(closeBtn);
    }

    handleMapClick(e) {
        const point = e.latlng;
        const isFirstPoint = this.clickPoints.length === 0;
        
        // Si es el primer punto o no está muy cerca de puntos existentes
        if (isFirstPoint || !this.isPointTooClose(point)) {
            this.clickPoints.push(point);
            
            // Crear o actualizar la polilínea temporal
            if (this.tempPolyline) {
                this.map.removeLayer(this.tempPolyline);
            }
            
            this.tempPolyline = L.polyline(this.clickPoints, {
                color: '#667eea',
                weight: 3,
                dashArray: '5, 5'
            }).addTo(this.map);
            
            // Marcar el punto
            const marker = L.circleMarker(point, {
                radius: 6,
                fillColor: '#667eea',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(this.map);
            
            // Añadir número al marcador
            const markerNumber = this.clickPoints.length;
            marker.bindTooltip(`Punto ${markerNumber}`, {permanent: true, direction: 'top'});
            
            this.markers.push(marker);
            
            // Mostrar botón de cerrar si hay al menos 3 puntos
            if (this.clickPoints.length >= 3) {
                const closeBtn = document.getElementById('closePolygonBtn');
                if (closeBtn) closeBtn.style.display = 'block';
            }
            
            // Actualizar mensaje
            this.updateDrawingMessage();
        }
    }

    isPointTooClose(newPoint) {
        const MIN_DISTANCE = 10; // metros
        
        for (const point of this.clickPoints) {
            const distance = point.distanceTo(newPoint);
            if (distance < MIN_DISTANCE) {
                return true;
            }
        }
        return false;
    }

    updateDrawingMessage() {
        const count = this.clickPoints.length;
        let message = `Puntos colocados: ${count}`;
        
        if (count < 3) {
            message += ' (mínimo 3 puntos necesarios)';
        } else {
            message += '. Haz clic en "Cerrar Polígono" para finalizar.';
        }
        
        this.showMessage(message);
    }

    completePolygon() {
        if (this.clickPoints.length < 3) {
            this.showMessage('Se necesitan al menos 3 puntos para crear un polígono');
            return;
        }

        this.isDrawing = false;
        
        // Crear polígono cerrado (añadir primer punto al final)
        const polygonPoints = [...this.clickPoints, this.clickPoints[0]];
        
        // Crear polígono final
        this.polygon = L.polygon(polygonPoints, {
            color: '#667eea',
            fillColor: '#667eea',
            fillOpacity: 0.3,
            weight: 3
        }).addTo(this.map);

        // Limpiar elementos temporales
        if (this.tempPolyline) {
            this.map.removeLayer(this.tempPolyline);
            this.tempPolyline = null;
        }
        
        // Ocultar botón de cerrar
        const closeBtn = document.getElementById('closePolygonBtn');
        if (closeBtn) closeBtn.style.display = 'none';
        
        // Restaurar botón de dibujar
        const drawBtn = document.getElementById('drawPolygon');
        drawBtn.disabled = false;
        drawBtn.textContent = 'Dibujar Polígono';
        drawBtn.classList.remove('drawing');
        
        // Analizar el área
        this.analyzeArea();
    }

    async analyzeArea() {
        if (!this.polygon) return;

        this.showMessage('Obteniendo datos de elevación...');

        try {
            // Generar puntos de muestra dentro del polígono
            const bounds = this.polygon.getBounds();
            const samplePoints = this.generateSamplePoints(bounds, this.polygon);
            
            if (samplePoints.length === 0) {
                this.showMessage('No se pudieron generar puntos de muestra. Usando datos de prueba.');
                this.useTestData();
                return;
            }
            
            // Obtener elevación de los puntos
            this.elevationData = await this.getElevationData(samplePoints);
            
            // Calcular estadísticas
            this.calculateStatistics();
            
            // Actualizar gráficos
            this.updateProfileChart();
            this.update3DScene();
            
            this.showMessage('Análisis completado');
        } catch (error) {
            console.error('Error en el análisis:', error);
            this.showMessage('Error obteniendo datos de elevación. Usando datos de prueba.');
            this.useTestData();
        }
    }

    async getElevationData(points) {
        // Usar API de Open-TopoData como alternativa
        const locations = points.map(p => ({
            latitude: p.lat,
            longitude: p.lng
        }));
        
        // Limitar a 100 puntos para no sobrecargar la API
        const limitedPoints = locations.slice(0, 100);
        
        try {
            // Intentar con Open-Elevation primero
            const response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ locations: limitedPoints })
            });

            if (!response.ok) throw new Error('API no disponible');
            
            const data = await response.json();
            
            // Combinar con las coordenadas
            return data.results.map((result, index) => ({
                lat: points[index].lat,
                lng: points[index].lng,
                elevation: result.elevation || 0
            }));
        } catch (error) {
            console.log('Open-Elevation falló, usando Open-TopoData');
            
            // Usar Open-TopoData como respaldo
            const url = `https://api.opentopodata.org/v1/srtm30m?locations=${limitedPoints.map(p => `${p.latitude},${p.longitude}`).join('|')}`;
            const response = await fetch(url);
            const data = await response.json();
            
            return data.results.map((result, index) => ({
                lat: points[index].lat,
                lng: points[index].lng,
                elevation: result.elevation || 0
            }));
        }
    }

    generateSamplePoints(bounds, polygon) {
        const points = [];
        const latStep = (bounds.getNorth() - bounds.getSouth()) / 15;
        const lngStep = (bounds.getEast() - bounds.getWest()) / 15;
        
        // Crear una cuadrícula de puntos
        for (let lat = bounds.getSouth(); lat <= bounds.getNorth(); lat += latStep) {
            for (let lng = bounds.getWest(); lng <= bounds.getEast(); lng += lngStep) {
                const point = L.latLng(lat, lng);
                
                // Verificar si el punto está dentro del polígono
                if (this.isPointInPolygon(point, this.clickPoints)) {
                    points.push(point);
                }
            }
        }
        
        // Si no hay puntos, usar los vértices del polígono
        if (points.length === 0) {
            return this.clickPoints.slice(0, -1); // Excluir el último punto duplicado
        }
        
        return points.slice(0, 50); // Limitar a 50 puntos
    }

    isPointInPolygon(point, polygonPoints) {
        // Algoritmo de punto en polígono (ray casting)
        let inside = false;
        const x = point.lng, y = point.lat;
        
        for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
            const xi = polygonPoints[i].lng, yi = polygonPoints[i].lat;
            const xj = polygonPoints[j].lng, yj = polygonPoints[j].lat;
            
            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        
        return inside;
    }

    calculateStatistics() {
        if (this.elevationData.length === 0) return;

        const elevations = this.elevationData.map(d => d.elevation);
        const min = Math.min(...elevations);
        const max = Math.max(...elevations);
        const avg = elevations.reduce((a, b) => a + b) / elevations.length;
        const variance = elevations.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / elevations.length;
        const stdDev = Math.sqrt(variance);
        
        // Calcular pendiente
        let totalSlope = 0;
        let slopeCount = 0;
        
        for (let i = 1; i < this.elevationData.length; i++) {
            const dist = this.calculateDistance(
                this.elevationData[i-1].lat, this.elevationData[i-1].lng,
                this.elevationData[i].lat, this.elevationData[i].lng
            );
            const elevDiff = this.elevationData[i].elevation - this.elevationData[i-1].elevation;
            
            if (dist > 0) {
                const slope = (Math.abs(elevDiff) / dist) * 100;
                totalSlope += slope;
                slopeCount++;
            }
        }
        
        const avgSlope = slopeCount > 0 ? totalSlope / slopeCount : 0;

        // Mostrar resultados
        const resultsHTML = `
            <div class="result-item">
                <span class="result-label">Puntos analizados:</span>
                <span class="result-value">${this.elevationData.length}</span>
            </div>
            <div class="result-item">
                <span class="result-label">Elevación mínima:</span>
                <span class="result-value">${min.toFixed(1)} m</span>
            </div>
            <div class="result-item">
                <span class="result-label">Elevación máxima:</span>
                <span class="result-value">${max.toFixed(1)} m</span>
            </div>
            <div class="result-item">
                <span class="result-label">Elevación media:</span>
                <span class="result-value">${avg.toFixed(1)} m</span>
            </div>
            <div class="result-item">
                <span class="result-label">Desviación estándar:</span>
                <span class="result-value">${stdDev.toFixed(1)} m</span>
            </div>
            <div class="result-item">
                <span class="result-label">Pendiente media:</span>
                <span class="result-value">${avgSlope.toFixed(1)}%</span>
            </div>
            <div class="result-item">
                <span class="result-label">Desnivel total:</span>
                <span class="result-value">${(max - min).toFixed(1)} m</span>
            </div>
        `;

        document.getElementById('analysisResults').innerHTML = resultsHTML;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    initCharts() {
        // Gráfico de perfil
        this.profileChart = new Chart(document.getElementById('profileChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Perfil de Elevación',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#667eea'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Elevación: ${context.parsed.y.toFixed(1)} m`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Elevación (m)',
                            font: {
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Puntos de muestreo',
                            font: {
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    updateProfileChart() {
        const elevations = this.elevationData.map(d => d.elevation);
        const labels = Array.from({length: elevations.length}, (_, i) => `P${i+1}`);
        
        this.profileChart.data.labels = labels;
        this.profileChart.data.datasets[0].data = elevations;
        this.profileChart.update();
    }

    init3DScene() {
        const canvas = document.getElementById('elevation3D');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            canvas, 
            alpha: true, 
            antialias: true 
        });
        
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.setClearColor(0xffffff, 0);
        
        // Iluminación mejorada
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);
        
        const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.3);
        this.scene.add(hemisphereLight);
        
        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(0, 0, 0);
        
        this.animate();
    }

    update3DScene() {
        // Limpiar escena anterior pero mantener luces
        const lights = [];
        this.scene.children.forEach(child => {
            if (child instanceof THREE.Light) {
                lights.push(child);
            }
        });
        
        this.scene.children = [];
        lights.forEach(light => this.scene.add(light));
        
        if (this.elevationData.length > 0) {
            this.create3DTerrain();
        }
    }

    create3DTerrain() {
        // Organizar datos en una cuadrícula
        const gridSize = Math.ceil(Math.sqrt(this.elevationData.length));
        const normalizedData = this.normalizeElevationData();
        
        // Crear geometría del terreno
        const geometry = new THREE.PlaneGeometry(15, 15, gridSize - 1, gridSize - 1);
        
        // Ajustar vértices Y según la elevación
        const positions = geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            const vertexIndex = i / 3;
            if (vertexIndex < normalizedData.length) {
                positions[i + 1] = normalizedData[vertexIndex] * 5; // Multiplicar por 5 para exagerar el relieve
            }
        }
        
        geometry.computeVertexNormals();
        
        // Crear material con gradiente de color según altura
        const material = new THREE.MeshLambertMaterial({ 
            color: 0x4a6572,
            wireframe: false,
            flatShading: false
        });
        
        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.terrainMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.terrainMesh);
        
        // Añadir ejes de referencia
        const axesHelper = new THREE.AxesHelper(10);
        this.scene.add(axesHelper);
        
        // Ajustar cámara para que se vea todo
        const boundingBox = new THREE.Box3().setFromObject(this.terrainMesh);
        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
        
        this.camera.position.set(center.x, center.y + 5, cameraZ * 0.8);
        this.camera.lookAt(center);
    }

    normalizeElevationData() {
        const elevations = this.elevationData.map(d => d.elevation);
        const min = Math.min(...elevations);
        const max = Math.max(...elevations);
        const range = max - min;
        
        if (range === 0) return elevations.map(() => 0.5);
        
        return elevations.map(e => (e - min) / range);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Rotación automática lenta si hay terreno
        if (this.terrainMesh) {
            this.terrainMesh.rotation.y += 0.002;
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    clearAll() {
        // Limpiar polilínea temporal
        if (this.tempPolyline) {
            this.map.removeLayer(this.tempPolyline);
            this.tempPolyline = null;
        }
        
        // Limpiar polígono
        if (this.polygon) {
            this.map.removeLayer(this.polygon);
            this.polygon = null;
        }
        
        // Limpiar marcadores
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = [];
        
        // Ocultar botón de cerrar
        const closeBtn = document.getElementById('closePolygonBtn');
        if (closeBtn) closeBtn.style.display = 'none';
        
        // Restaurar estado
        this.isDrawing = false;
        this.clickPoints = [];
        this.elevationData = [];
        
        const drawBtn = document.getElementById('drawPolygon');
        drawBtn.disabled = false;
        drawBtn.textContent = 'Dibujar Polígono';
        drawBtn.classList.remove('drawing');
        
        // Limpiar resultados
        document.getElementById('analysisResults').innerHTML = '';
        
        // Reset charts
        this.profileChart.data.labels = [];
        this.profileChart.data.datasets[0].data = [];
        this.profileChart.update();
        
        // Limpiar escena 3D
        this.update3DScene();
    }

    showMessage(message) {
        const resultsDiv = document.getElementById('analysisResults');
        resultsDiv.innerHTML = `<div class="result-item" style="background: #f0f9ff; padding: 10px; border-radius: 5px;">
            <span class="result-label" style="color: #0369a1;">${message}</span>
        </div>`;
    }

    useTestData() {
        // Datos de prueba realistas basados en ubicación
        const testData = [];
        const centerLat = this.clickPoints.length > 0 ? 
            this.clickPoints[0].lat : 40.4168;
        const centerLng = this.clickPoints.length > 0 ? 
            this.clickPoints[0].lng : -3.7038;
        
        // Crear datos con patrón de montaña
        for (let i = 0; i < 40; i++) {
            const angle = (i / 40) * Math.PI * 2;
            const radius = 0.005;
            const lat = centerLat + Math.sin(angle) * radius;
            const lng = centerLng + Math.cos(angle) * radius;
            
            // Elevación con patrón de montaña (más alto en el centro)
            const distFromCenter = Math.sqrt(
                Math.pow(lat - centerLat, 2) + 
                Math.pow(lng - centerLng, 2)
            );
            const elevation = 650 - (distFromCenter / 0.005) * 100 + 
                             Math.random() * 30 + 
                             Math.sin(i * 0.5) * 20;
            
            testData.push({
                lat,
                lng,
                elevation: Math.max(500, parseFloat(elevation.toFixed(1)))
            });
        }
        
        this.elevationData = testData;
        this.calculateStatistics();
        this.updateProfileChart();
        this.update3DScene();
    }

    exportData() {
        if (this.elevationData.length === 0) {
            this.showMessage('No hay datos para exportar');
            return;
        }

        // Formatear datos para CSV
        const csvContent = [
            ['Latitud', 'Longitud', 'Elevación (m)'],
            ...this.elevationData.map(d => [d.lat, d.lng, d.elevation])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `topografia_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showMessage('Datos exportados como CSV');
    }
}

// Inicializar la aplicación cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    new TopoAnalyzer();
});