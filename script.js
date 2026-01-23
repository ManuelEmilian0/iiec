// Variables globales
var map;
var currentGeoJSONLayer = null;

window.onload = function() {
    initMap();
};

function initMap() {
    // 1. Inicializar mapa base
    map = L.map('map', {
        minZoom: 2, maxZoom: 18, zoomControl: false
    }).setView([20, 0], 2);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 2. Capa Oscura (CartoDB DarkMatter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Cargar capa por defecto (Mundial)
    loadLayer('mundial');
}

// Función para cambiar de pestañas (Inicio, Marco, etc)
function showSection(sectionId) {
    // Ocultar todos los paneles
    var panels = document.getElementsByClassName('main-content-panel');
    for (var i = 0; i < panels.length; i++) {
        panels[i].classList.remove('active-panel');
    }
    // Desactivar botones nav
    var navs = document.getElementsByClassName('nav-button');
    for (var i = 0; i < navs.length; i++) {
        navs[i].classList.remove('active');
    }

    // Mostrar panel seleccionado
    document.getElementById(sectionId).classList.add('active-panel');
    
    // Activar botón correspondiente (Lógica simple)
    var btnIndex = 0;
    if(sectionId === 'marco') btnIndex = 1;
    if(sectionId === 'metodologia') btnIndex = 2;
    if(sectionId === 'contacto') btnIndex = 3;
    navs[btnIndex].classList.add('active');

    // Si es mapa, invalidar tamaño para evitar errores de renderizado
    if (sectionId === 'inicio' && map) {
        setTimeout(function(){ map.invalidateSize(); }, 200);
    }
}

// Función para Cargar Capas GeoJSON
function loadLayer(scaleType) {
    var statusText = document.getElementById('layer-status');
    var filename = "";
    var zoomCoords = [];
    var zoomLevel = 2;
    var layerColor = "#fcae91";

    // CONFIGURACIÓN DE RUTAS
    // Como todos los archivos están en la misma carpeta, solo ponemos el nombre.
    if (scaleType === 'mundial') {
        filename = "mundial.geojson";       // Nombre exacto del archivo
        zoomCoords = [20, 0];
        zoomLevel = 2;
        layerColor = "#5dade2"; 
    } else if (scaleType === 'nacional') {
        filename = "nacional.geojson";      // Nombre exacto del archivo
        zoomCoords = [23.6345, -102.5528];
        zoomLevel = 5;
        layerColor = "#a50f15"; 
    } else if (scaleType === 'estatal') {
        // Aquí uso denue.geojson. Si prefieres que este botón cargue "armadoras",
        // cambia "denue.geojson" por "armadoras.geojson" aquí abajo:
        filename = "denue.geojson";         
        zoomCoords = [21.0, -101.0];
        zoomLevel = 7;
        layerColor = "#f1c40f"; 
    }

    statusText.innerHTML = "Cargando " + filename + "...";

    // Limpiar capa anterior si existe
    if (currentGeoJSONLayer) {
        map.removeLayer(currentGeoJSONLayer);
    }

    // Cargar datos usando Fetch API
    fetch(filename)
        .then(response => {
            if (!response.ok) throw new Error("HTTP error " + response.status);
            return response.json();
        })
        .then(data => {
            // Estilo básico
            var geojsonStyle = {
                color: layerColor,
                weight: (scaleType === 'estatal') ? 1 : 1.5,
                opacity: 0.8,
                radius: 4, 
                fillColor: layerColor,
                fillOpacity: 0.6
            };

            // Crear capa GeoJSON
            currentGeoJSONLayer = L.geoJSON(data, {
                style: geojsonStyle,
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, geojsonStyle);
                },
                onEachFeature: function (feature, layer) {
                    var popupContent = "<b>Datos:</b><br>";
                    // Intentamos mostrar propiedades comunes si existen
                    if (feature.properties) {
                        for (var key in feature.properties) {
                            popupContent += key + ": " + feature.properties[key] + "<br>";
                        }
                    }
                    layer.bindPopup(popupContent);
                }
            }).addTo(map);

            // Mover cámara
            map.flyTo(zoomCoords, zoomLevel, { duration: 1.5 });
            statusText.innerHTML = "Capa cargada: " + scaleType.toUpperCase();
        })
        .catch(error => {
            console.error('Error cargando el GeoJSON:', error);
            statusText.innerHTML = "Error: No se encontró " + filename;
        });
}