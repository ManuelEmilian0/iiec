// ==========================================
// 1. ESCALA GLOBAL Y NACIONAL (Y MAPA BASE)
// ==========================================
// Variables Globales compartidas entre escalas
var map;
var minimap = null;
var minimapDot = null;
var currentGeoJSONLayer = null;
var armadorasLayer = null;
var isocronasLayer = null;
var agebLayer = null;
var activeData = null;

var denueRawData = null;
var armadorasRawData = null;
var isocronasRawData = null;
var agebRawData = null;
var vinculacionRawData = null;

var currentScaleType = '';
var mainChart = null;
var estratoChart = null;
var empresaChart = null;
var isocronaChart = null;
var fuenteControl = null;

const RampaRojos = ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'];
const Grosores = [1, 2, 4, 6, 8];

const CATALOGO_ZONAS_METROPOLITANAS = {
    "ZM Valle de México": ["09", "15"], // CDMX + Edomex (simplificado para abarcar ambos completos como antes)
    "ZM Tijuana": ["02004", "02003", "02005"], // Tijuana, Tecate, Playas de Rosarito
    "ZM Monterrey": ["19039", "19006", "19018", "19019", "19021", "19026", "19031", "19045", "19046", "19048", "19049", "19012", "19010", "19025", "19042"] // Principales municipios ZMM
};

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    initMap();
});

function initMap() {
    if (map !== undefined && map !== null) { map.remove(); }

    map = L.map('map', { minZoom: 2, maxZoom: 18, zoomControl: false });
    // Encuadre inicial exacto (América hasta Europa/África)
    map.fitBounds([[-55, -130], [75, 60]]);

    var cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO', subdomains: 'abcd', maxZoom: 19
    });
    var cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO', subdomains: 'abcd', maxZoom: 19
    });
    var satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &mdash; Source: Esri', maxZoom: 19
    });
    var googleMaps = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google'
    });

    satelite.addTo(map);

    // ==========================================
    // GALERÍA DE MAPAS BASE CUSTOM
    // ==========================================
    var basemapGalleryControl = L.control({ position: 'topright' });
    basemapGalleryControl.onAdd = function (map) {
        // Use standard leaflet layers classes to get the default icon
        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-layers basemap-gallery-container');

        var toggleBtn = L.DomUtil.create('a', 'leaflet-control-layers-toggle basemap-toggle-btn', container);
        toggleBtn.href = '#';
        toggleBtn.title = 'Galería de Mapas Base';
        // Remove innerHTML to let CSS background-image show the default icon

        var galleryPanel = L.DomUtil.create('div', 'basemap-gallery-panel', container);
        galleryPanel.style.display = 'none';

        var basemaps = [
            { name: "Satélite", layer: satelite, thumb: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/6/3" },
            { name: "Oscuro", layer: cartoDark, thumb: "https://a.basemaps.cartocdn.com/dark_all/4/6/3.png" },
            { name: "Claro", layer: cartoLight, thumb: "https://a.basemaps.cartocdn.com/light_all/4/6/3.png" },
            { name: "Google Maps", layer: googleMaps, thumb: "https://mt1.google.com/vt/lyrs=m&x=3&y=6&z=4" }
        ];

        var currentActiveLayer = satelite;

        basemaps.forEach(function (bm) {
            var item = L.DomUtil.create('div', 'basemap-item', galleryPanel);
            if (bm.layer === currentActiveLayer) item.classList.add('active');

            var img = L.DomUtil.create('img', 'basemap-thumb', item);
            img.src = bm.thumb;

            var label = L.DomUtil.create('span', 'basemap-label', item);
            label.innerText = bm.name;

            L.DomEvent.on(item, 'click', function () {
                if (currentActiveLayer !== bm.layer) {
                    map.removeLayer(currentActiveLayer);
                    map.addLayer(bm.layer);
                    currentActiveLayer = bm.layer;

                    window.limiteBoundaryColor = (bm.name === "Satélite" || bm.name === "Oscuro") ? '#ffffff' : '#000000';


                    if (window.limiteMunicipalLayer) {
                        window.limiteMunicipalLayer.eachLayer(l => {
                            if (l.setStyle) l.setStyle({ color: window.limiteBoundaryColor });
                            if (l._icon && l._icon.innerHTML) {
                                l._icon.innerHTML = l._icon.innerHTML.replace(/color:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/, 'color: ' + window.limiteBoundaryColor);
                            }
                        });
                    }

                    var allItems = galleryPanel.querySelectorAll('.basemap-item');
                    allItems.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                }
                galleryPanel.style.display = 'none'; // Auto cerrar al seleccionar
            });
        });

        L.DomEvent.on(toggleBtn, 'click', function (e) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            galleryPanel.style.display = galleryPanel.style.display === 'none' ? 'grid' : 'none';
        });

        // Cerrar galería si se hace clic en el mapa
        map.on('click', function () {
            galleryPanel.style.display = 'none';
        });

        L.DomEvent.disableClickPropagation(container);
        return container;
    };
    basemapGalleryControl.addTo(map);

    // ==========================================
    // CONTROL DE DESCARGAS (Left of Layers)
    // ==========================================
    var downloadControl = L.control({ position: 'topright' });
    downloadControl.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        div.innerHTML = `
            <div id="download-menu" class="download-menu-container">
                <button class="auth-hidden auth-required-btn" onclick="descargarGeoJSON()" style="display:none;" title="Requiere iniciar sesión">⬇️ Descargar GeoJSON</button>
            </div>
        `;
        L.DomEvent.disableClickPropagation(div);
        return div;
    };
    downloadControl.addTo(map);

    // Funciones globales de exportación
    window.tomarCapturaPantalla = function () {
        // html2canvas toma el body completo (dashboard + mapa)
        html2canvas(document.body, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#1a1a1a'
        }).then(function (canvas) {
            var link = document.createElement('a');
            link.download = 'dashboard_' + currentScaleType + '.png';
            link.href = canvas.toDataURL("image/png");
            link.click();
        });
    };

    window.descargarGeoJSON = function () {
        var filename = currentScaleType + '.geojson';
        // En nacional, los puntos base son armadoras.geojson, pero también hay nacional.geojson
        if (currentScaleType === 'nacional') filename = 'carto/nacional.geojson';
        var link = document.createElement('a');
        link.href = filename;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Control de Fuente dinamico
    fuenteControl = {
        update: function (texto) {
            var fDiv = document.getElementById('fuente-div');
            if (fDiv) {
                if (texto) { fDiv.innerHTML = `Fuente: ${texto}`; fDiv.style.display = 'block'; }
                else { fDiv.style.display = 'none'; }
            }
        }
    };

    setupUI();
    // Esta función está en escala_estatal.js, verificamos si existe
    if (typeof cargarArmadorasContexto === "function") cargarArmadorasContexto();
    showSection('inicio');

    setTimeout(() => { loadLayer('mundial'); }, 500);

    // Asegurar que el estado de autenticación se aplique al control recién creado
    if (typeof checkAuthUI === "function") checkAuthUI();

    // ==========================================
    // INICIALIZACIÓN DE MINIMAPA
    // ==========================================
    if (minimap !== undefined && minimap !== null) { minimap.remove(); }
    minimap = L.map('minimap', {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', maxZoom: 19
    }).addTo(minimap);

    var dotIcon = L.divIcon({
        className: '',
        iconSize: [20, 20],
        html: '<div style="width:12px; height:12px; background:#00ffff; border-radius:50%; box-shadow: 0 0 10px 5px rgba(0, 229, 255, 0.6); position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);"></div>'
    });
    minimapDot = L.marker(map.getCenter(), { icon: dotIcon }).addTo(minimap);

    function updateMinimap() {
        var center = map.getCenter();
        var zoom = map.getZoom();
        var minimapZoom = Math.max(0, zoom - 5);
        minimap.setView(center, minimapZoom, {animate: false});
        minimapDot.setLatLng(center);
    }
    
    map.on('move', updateMinimap);
    map.on('zoom', updateMinimap);
    // Para asegurar que el minimapa se posicione bien tras cargar css
    setTimeout(() => {
        if (minimap) minimap.invalidateSize();
        updateMinimap();
    }, 1000);
}

// ==========================================
// CONTROLADOR DE CAPAS (MULTIESCALAR)
// ==========================================
function loadLayer(scaleType) {
    document.body.className = document.body.className.replace(/\bscale-\S+/g, '');
    document.body.classList.add('scale-' + scaleType);

    var modulos = document.getElementById('modulos-container');
    if (modulos) modulos.style.display = 'none';

    document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
    var activeBtn = document.getElementById('btn-' + scaleType);
    if (activeBtn) activeBtn.classList.add('active');

    var metroWrapper = document.getElementById('metropolitana-filter-wrapper');
    if (metroWrapper) metroWrapper.style.display = 'none';
    var filterBox = document.getElementById('filter-container-box');
    if (filterBox) filterBox.style.display = 'block';

    if (currentGeoJSONLayer) { map.removeLayer(currentGeoJSONLayer); currentGeoJSONLayer = null; }
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
    if (isocronasLayer) { map.removeLayer(isocronasLayer); isocronasLayer = null; }
    if (agebLayer) { map.removeLayer(agebLayer); agebLayer = null; }

    if (window.limiteMunicipalLayer) { map.removeLayer(window.limiteMunicipalLayer); window.limiteMunicipalLayer = null; }

    // Remover controles de dibujo si existen
    if (map.pm) {
        map.pm.removeControls();
        map.pm.disableDraw();
        map.pm.disableGlobalEditMode();
    }

    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) {
        statsDiv.style.display = 'none';
    }

    var ianBox = document.getElementById('ian-dashboard-box');
    if (ianBox) ianBox.style.display = 'none';

    var legendDiv = document.getElementById('legend-overlay');
    if (legendDiv) legendDiv.style.display = 'none';

    var summaryDiv = document.getElementById('dynamic-summary');
    if (summaryDiv) summaryDiv.style.display = 'none';

    var summaryGlobalDiv = document.getElementById('dynamic-summary-global');
    if (summaryGlobalDiv) summaryGlobalDiv.style.display = 'none';

    var vincContainer = document.getElementById('vinculacion-charts-container');
    if (vincContainer) vincContainer.style.display = 'none';

    var muniContainer = document.getElementById('municipal-charts-container');
    if (muniContainer) muniContainer.style.display = 'none';

    var empContainer = document.getElementById('empresas-chart-container');
    if (empContainer) empContainer.style.display = 'none';

    var tgc = document.getElementById('topGlobalChartContainer');
    if (tgc) tgc.style.display = 'none';
    var tgt = document.getElementById('topGlobalChartTitle');
    if (tgt) tgt.style.display = 'none';
    var tghr = document.getElementById('topGlobalChartHr');
    if (tghr) tghr.style.display = 'none';
    var mct = document.getElementById('myChartTitle');
    if (mct) mct.style.display = 'none';
    if (window.topGlobalChartInstance) { window.topGlobalChartInstance.destroy(); window.topGlobalChartInstance = null; }

    var finOverlay = document.getElementById('fin-overlay');
    if (finOverlay) finOverlay.style.display = 'none';

    if (typeof estratoChart !== "undefined" && estratoChart) { estratoChart.destroy(); estratoChart = null; }
    if (typeof empresaChart !== "undefined" && empresaChart) { empresaChart.destroy(); empresaChart = null; }
    if (typeof isocronaChart !== "undefined" && isocronaChart) { isocronaChart.destroy(); isocronaChart = null; }
    if (typeof mainChart !== "undefined" && mainChart) { mainChart.destroy(); mainChart = null; }
    if (window.nacionalTop5Layer) { map.removeLayer(window.nacionalTop5Layer); window.nacionalTop5Layer = null; }

    currentScaleType = scaleType;

    // Controlar visibilidad de los centroides globales (Armadoras base)
    if (window.armadorasContextoGlobalLayer) {
        if (scaleType === 'nacional') {
            map.addLayer(window.armadorasContextoGlobalLayer);
        } else {
            map.removeLayer(window.armadorasContextoGlobalLayer);
        }
    }

    // Mostrar las armadoras reales (triángulos) a escala nacional
    if (scaleType === 'nacional') {
        if (window.armadorasNacionalTriangulosLayer) {
            if (!map.hasLayer(window.armadorasNacionalTriangulosLayer)) {
                map.addLayer(window.armadorasNacionalTriangulosLayer);
            }
        } else {
            fetch('carto/armadoras.geojson').then(r => r.json()).then(data => {
                window.armadorasRawData = data; // Cache
                var triangleHtml = '<svg width="24" height="24" viewBox="0 0 24 24"><polygon points="12,2 22,22 2,22" fill="#00e5ff" stroke="#fff" stroke-width="2"/></svg>';
                var triangleIcon = L.divIcon({ className: '', html: triangleHtml, iconSize: [24, 24], iconAnchor: [12, 12] });

                window.armadorasNacionalTriangulosLayer = L.geoJSON(data, {
                    pointToLayer: function (feature, latlng) {
                        return L.marker(latlng, { icon: triangleIcon });
                    },
                    onEachFeature: function (feature, layer) {
                        var armName = feature.properties.Empresa || feature.properties.NOMBRE || feature.properties.Nombre || 'Armadora';
                        var armEst = feature.properties.Estado || feature.properties.ESTADO || '';
                        layer.bindPopup(`<b style="color:#00e5ff;">${armName}</b><br><span style="font-size:11px; color:#aaa;">Armadora Automotriz</span><br><span style="font-size:11px; color:#ccc;">${armEst}</span>`, { className: 'custom-popup' });
                    }
                }).addTo(map);
            }).catch(e => console.error("Error cargando armadoras.geojson:", e));
        }
    } else {
        if (window.armadorasNacionalTriangulosLayer && map.hasLayer(window.armadorasNacionalTriangulosLayer)) {
            map.removeLayer(window.armadorasNacionalTriangulosLayer);
        }
    }

    var textoFuente = "";
    if (scaleType === 'mundial') textoFuente = "Organización para la Cooperación y el Desarrollo Económicos (OCDE) 2026";
    else if (scaleType === 'nacional') textoFuente = "Cuadros de Oferta y Utilización (COU) y Matrices Insumo-Producto (MIP), INEGI 2020";
    else if (scaleType === 'estatal') textoFuente = "DENUE; Directorio Estadístico Nacional de Unidades Económicas, INEGI (2022)";
    else if (scaleType === 'metropolitana') textoFuente = "Delimitación de las Zonas Metropolitanas de México";
    else if (scaleType === 'municipio') textoFuente = "Sistema para la Consulta de Información Censal (SCINCE), INEGI 2020";
    if (fuenteControl) fuenteControl.update(textoFuente);

    var filterBox = document.getElementById('filter-container-box');
    var btnContainer = document.getElementById('filter-buttons-container');
    if (btnContainer && !btnContainer.classList.contains('show')) {
        btnContainer.classList.add('show');
        var arrow = document.getElementById('filter-arrow');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }

    // Actualizar Panel Derecho Dinámico
    if (typeof actualizarPanelDerecho === "function") {
        actualizarPanelDerecho(scaleType);
    }

    if (typeof mostrarInstruccionEscala === "function") {
        mostrarInstruccionEscala(scaleType);
    }

    // Delegar lógica a los otros módulos (escala_estatal.js y escala_municipal.js)
    if (scaleType === 'estatal') {
        if (filterBox) {
            filterBox.style.display = 'block';
            document.getElementById('filter-buttons-container').innerHTML = "";
            document.getElementById('filter-title').innerText = "Cargando...";
        }
        if (typeof iniciarLogicaEstatal === "function") iniciarLogicaEstatal();
        return;
    }

    if (scaleType === 'metropolitana') {
        if (filterBox) {
            filterBox.style.display = 'block';
            document.getElementById('filter-buttons-container').innerHTML = "";
            document.getElementById('filter-title').innerText = "Selecciona una Zona Metropolitana";
        }
        if (typeof iniciarLogicaMetropolitana === "function") iniciarLogicaMetropolitana();
        return;
    }

    if (scaleType === 'municipio') {
        if (filterBox) {
            filterBox.style.display = 'block';
            document.getElementById('filter-buttons-container').innerHTML = "";
            document.getElementById('filter-title').innerText = "Cargando...";
        }
        if (typeof iniciarLogicaMunicipio === "function") iniciarLogicaMunicipio();
        return;
    }

    // Lógica Exclusiva para la Escala Global y Nacional
    var filename = "";
    var zoomCoords = [];
    var zoomLevel = 5;

    if (scaleType === 'mundial') {
        filename = 'carto/mundial.geojson';
        zoomCoords = [20, 0]; zoomLevel = 2;
        if (filterBox) filterBox.style.display = 'block';
    } else if (scaleType === 'nacional') {
        filename = 'carto/nacional.geojson';
        zoomCoords = [23.6345, -102.5528]; zoomLevel = 5;
        if (filterBox) filterBox.style.display = 'block';
        if (typeof cargarYRenderizarEmpresasCSV === "function") cargarYRenderizarEmpresasCSV();
    }

    fetch(filename)
        .then(response => response.json())
        .then(data => {
            activeData = data;
            map.flyTo(zoomCoords, zoomLevel, { duration: 1.5 });

            if (scaleType === 'mundial') iniciarFiltroMundial_Paso1(data);
            else if (scaleType === 'nacional') iniciarFiltroNacional_Paso1(data);
        })
        .catch(error => console.error("Error cargando datos: " + error));
}



window.limiteMunicipalLayer = null;
window.municipiosPolygonsGeoJSON = null;

window.dibujarLimiteMunicipal = function (nombreEstado) {
    window.cargarLimiteMunicipalGeoJSON().then(geo => {
        if (!geo) return;
        if (window.limiteMunicipalLayer) map.removeLayer(window.limiteMunicipalLayer);

        var estadoBusqueda = normalizarEstadoNombre(nombreEstado);
        
        if (CATALOGO_ZONAS_METROPOLITANAS[nombreEstado]) {
            var firstCode = CATALOGO_ZONAS_METROPOLITANAS[nombreEstado][0].substring(0, 2);
            if (nombreEstado === "ZM Valle de México") estadoBusqueda = "ZMVM";
            else if (firstCode === "02") estadoBusqueda = "BAJA CALIFORNIA";
            else if (firstCode === "19") estadoBusqueda = "NUEVO LEON";
        }

        if (estadoBusqueda === "ZONA METROPOLITANA DEL VALLE DE MEXICO") {
            estadoBusqueda = "ZMVM";
        }

        // Filtrar municipios
        var munFeatures = geo.features.filter(f => {
            var n = normalizarEstadoNombre(f.properties.NOMGEO || "");
            var cveMun = f.properties.cve_umun || f.properties.CVEGEO || f.properties.CVE_MUN;

            if (!n && cveMun) {
                if (cveMun.substring(0, 2) === "09") n = normalizarEstadoNombre("CIUDAD DE MEXICO");
            }

            if (CATALOGO_ZONAS_METROPOLITANAS[nombreEstado]) {
                var catalogList = CATALOGO_ZONAS_METROPOLITANAS[nombreEstado];
                var cveEnt = cveMun ? cveMun.substring(0, 2) : null;
                if (cveEnt && catalogList.includes(cveEnt)) return true;
                if (cveMun && catalogList.includes(cveMun)) return true;
                if (nombreEstado === "ZM Valle de México") {
                    return n === normalizarEstadoNombre("MEXICO") || n === normalizarEstadoNombre("CIUDAD DE MEXICO");
                }
                return false;
            }

            if (estadoBusqueda === "ZMVM") return n === normalizarEstadoNombre("MEXICO") || n === normalizarEstadoNombre("CIUDAD DE MEXICO");
            return n === estadoBusqueda;
        });

        if (munFeatures.length > 0) {
            var polyLayer = L.geoJSON(munFeatures, {
                style: {
                    color: window.limiteBoundaryColor || '#ffffff',
                    weight: 1,
                    opacity: 0.6,
                    fillOpacity: 0.0,
                    dashArray: '2, 4'
                },
                interactive: false
            });

            var layers = [polyLayer];

            // Etiquetas de los municipios
            munFeatures.forEach(f => {
                var munLayer = L.geoJSON(f);
                var center = munLayer.getBounds().getCenter();
                var nombreMun = f.properties.nom_mun || "";
                if (nombreMun) {
                    var labelMarker = L.marker(center, {
                        icon: L.divIcon({
                            className: 'mun-label-permanent',
                            html: `<div style="color: ${window.limiteBoundaryColor || '#ffffff'}; font-size: 10px; text-shadow: 1px 1px 2px #000; text-align: center; pointer-events:none;">${nombreMun}</div>`,
                            iconSize: [80, 20],
                            iconAnchor: [40, 10]
                        }),
                        interactive: false
                    });
                    layers.push(labelMarker);
                }
            });

            window.limiteMunicipalLayer = L.featureGroup(layers).addTo(map);
            window.limiteMunicipalLayer.bringToFront();
        }
    });

};

// ==========================================
// LÓGICA MUNDIAL & NACIONAL
// ==========================================
function iniciarFiltroMundial_Paso1(data) {
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";
    document.getElementById('filter-title').innerText = "Intercambios Globales";

    var opcionesIndustria = [...new Set(data.features.map(f => f.properties.Industria))].sort();

    var selectIndustria = document.createElement("select");
    selectIndustria.className = "dynamic-filter-select";
    selectIndustria.innerHTML = `<option value="" disabled selected>-- Industria --</option>`;
    opcionesIndustria.forEach(item => {
        selectIndustria.innerHTML += `<option value="${item}">${item}</option>`;
    });

    var selectOrigen = document.createElement("select");
    selectOrigen.className = "dynamic-filter-select";
    selectOrigen.style.display = 'none';

    selectIndustria.onchange = function () {
        var industriaSel = this.value;
        var datosFiltrados = data.features.filter(f => f.properties.Industria === industriaSel);

        var sumasPorOrigen = {};
        datosFiltrados.forEach(f => {
            var origen = f.properties.Pais_Orige;
            var valor = f.properties.Valor || 0;
            if (!sumasPorOrigen[origen]) sumasPorOrigen[origen] = 0;
            sumasPorOrigen[origen] += valor;
        });

        var origenes = Object.keys(sumasPorOrigen).sort((a, b) => sumasPorOrigen[b] - sumasPorOrigen[a]);

        selectOrigen.innerHTML = `<option value="" disabled selected>-- País --</option>`;
        origenes.forEach(item => {
            selectOrigen.innerHTML += `<option value="${item}">${item}</option>`;
        });
        selectOrigen.style.display = 'block';
        if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);

        var top5Origenes = origenes.slice(0, 5).map(origen => {
            return {
                properties: {
                    Pais_Orige: origen,
                    Valor: sumasPorOrigen[origen]
                }
            };
        });
        actualizarGraficaTop5Global(top5Origenes, industriaSel);
    };

    selectOrigen.onchange = function () {
        var industriaSel = selectIndustria.value;
        var origenSel = this.value;
        var finalData = data.features.filter(f => f.properties.Industria === industriaSel && f.properties.Pais_Orige === origenSel);
        renderizarMapaFlujos(finalData, 'Valor', 'MDD', 'Pais_Desti');
    };

    container.appendChild(selectIndustria);
    container.appendChild(selectOrigen);
}


// Lógica Nacional se ha movido al archivo independiente
// Lógica Nacional específica movida a escala_nacional.js


function normalizarEstadoNombre(nombre) {
    if (!nombre) return "";
    var n = nombre.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    n = n.replace(/[\ufffd\uFFFD]/g, ""); // Remove invalid chars like 

    if (n === "ESTADO DE MEXICO" || n === "MEXICO" || n === "MXICO") return "México";
    if (n === "CIUDAD DE MEXICO" || n === "DISTRITO FEDERAL" || n === "CDMX" || n === "CIUDAD DE MXICO") return "Ciudad de México";
    if (n === "VERACRUZ DE IGNACIO DE LA LLAVE") return "Veracruz";
    if (n === "COAHUILA DE ZARAGOZA") return "Coahuila";
    if (n === "MICHOACAN DE OCAMPO" || n === "MICHOACAN" || n === "MICHOACN") return "Michoacán";
    if (n === "NUEVO LEON" || n === "NUEVO LEN") return "Nuevo León";
    if (n === "QUERETARO" || n === "QUERTARO") return "Querétaro";
    if (n === "SAN LUIS POTOSI" || n === "SAN LUIS POTOS") return "San Luis Potosí";
    if (n === "YUCATAN" || n === "YUCATN") return "Yucatán";

    if (typeof FINANZAS_FEDERALES_2025 !== "undefined") {
    for (let key in FINANZAS_FEDERALES_2025) {
        let keyN = key.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (n === keyN || n === keyN.replace(/[AEIOU]/g, "")) return key;
    }
    }
    return nombre;
}




function renderizarMapaFlujos(features, campoValor, etiquetaMoneda, campoDestino) {
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);

    actualizarGrafica(features, campoDestino, campoValor, etiquetaMoneda);

    var validFeatures = features.filter(f => f.properties[campoValor] != null && !isNaN(f.properties[campoValor]));
    var valores = validFeatures.map(f => f.properties[campoValor]).sort((a, b) => a - b);
    var breaks = calcularBreaks(valores);

    var fg = L.featureGroup().addTo(map);
    currentGeoJSONLayer = fg;

    validFeatures.forEach((feature, index) => {
        var p = feature.properties;
        var val = p[campoValor];
        var clase = getClase(val, breaks);

        var coords = [];
        if (feature.geometry.type === 'LineString') {
            coords = feature.geometry.coordinates.map(c => [c[1], c[0]]);
        } else if (feature.geometry.type === 'MultiLineString') {
            coords = feature.geometry.coordinates[0].map(c => [c[1], c[0]]);
        }

        if (coords.length > 0) {
            coords.reverse();

            var polyline = L.polyline(coords, {
                color: RampaRojos[clase], weight: Grosores[clase] + 1, opacity: 0.8, className: 'flujo-animado'
            });

            var valFormatted = (val || 0).toLocaleString();
            var popupContent = `
                <div style="font-family:'Noto Sans'; font-size:13px;">
                    <strong style="color:#de2d26; font-size:14px;">${p[campoDestino]}</strong><br>
                    <hr style="border:0; border-top:1px solid #555; margin:5px 0;">
                    Valor: <b style="color:#fff">$${valFormatted}</b> <small>${etiquetaMoneda}</small>
                </div>
            `;
            polyline.bindPopup(popupContent);

            polyline.on({
                mouseover: function (e) {
                    var layer = e.target;
                    layer.setStyle({ weight: layer.options.weight + 4, color: '#ffff00' });
                    layer.bringToFront();
                },
                mouseout: function (e) {
                    var layer = e.target;
                    layer.setStyle({ weight: Grosores[clase] + 1, color: RampaRojos[clase] });
                }
            });

            fg.addLayer(polyline);

            var destCoord = coords[0];
            var marker = L.circleMarker(destCoord, {
                radius: 4,
                fillColor: RampaRojos[clase],
                color: "#fff",
                weight: 1,
                opacity: 1,
                fillOpacity: 1
            }).addTo(fg);

            marker.bindTooltip(p[campoDestino], {
                permanent: true,
                direction: 'right',
                className: 'etiqueta-destino'
            }).openTooltip();

            setTimeout(() => {
                if (polyline._path) {
                    var length = polyline._path.getTotalLength();
                    polyline._path.style.transition = polyline._path.style.WebkitTransition = 'none';
                    polyline._path.style.strokeDasharray = length + ' ' + length;
                    polyline._path.style.strokeDashoffset = length;
                    polyline._path.getBoundingClientRect();
                    var delay = index * 200;

                    setTimeout(() => {
                        polyline._path.style.transition = polyline._path.style.WebkitTransition = 'stroke-dashoffset 1.3s ease-in-out';
                        polyline._path.style.strokeDashoffset = '0';
                    }, delay);
                    setTimeout(() => {
                        if (polyline._path) {
                            polyline._path.style.transition = '';
                            polyline._path.style.WebkitTransition = '';
                            polyline._path.style.strokeDasharray = '';
                            polyline._path.style.strokeDashoffset = '';
                        }
                    }, delay + 1500);
                }
            }, 100);
        }
    });

    actualizarLeyenda(breaks, etiquetaMoneda);
}

// ==========================================
// UTILIDADES GRÁFICAS GLOBAL/NACIONAL
// ==========================================
function actualizarGraficaTop5Global(top5Origenes, industriaSel) {
    if (typeof Chart === 'undefined') return;
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var titulo = document.getElementById('stats-title-text');
    if (titulo) {
        titulo.innerHTML = `Top 5 Exportadores Mundiales<br><small style='color:#aaa; font-size:11px'>Millones de Dólares (MDD)</small>`;
    }

    var chartTitle = document.getElementById('topGlobalChartTitle');
    if (chartTitle) {
        chartTitle.style.display = 'block';
    }

    var chartContainer = document.getElementById('topGlobalChartContainer');
    if (chartContainer) chartContainer.style.display = 'block';

    var hr = document.getElementById('topGlobalChartHr');
    if (hr) hr.style.display = 'block';

    const canvas = document.getElementById('topGlobalChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    var summaryDiv = document.getElementById('dynamic-summary-global');
    if (summaryDiv && top5Origenes.length > 0) {
        var topPais = top5Origenes[0].properties.Pais_Orige;
        var topValor = (top5Origenes[0].properties.Valor || 0).toLocaleString('es-MX');
        summaryDiv.innerHTML = `A nivel global, <b>${topPais}</b> lidera las exportaciones en el sector de <b>${industriaSel}</b> con un total de <b>$${topValor} MDD</b> enviados a todo el mundo.`;
        summaryDiv.style.display = 'block';
    } else if (summaryDiv) {
        summaryDiv.style.display = 'none';
    }

    let labels = top5Origenes.map(f => f.properties.Pais_Orige);
    let dataValues = top5Origenes.map(f => f.properties.Valor);

    let coloresGradiente = ['#a50f15', '#de2d26', '#fb6a4a', '#fcae91', '#fee5d9'];
    let bgColors = dataValues.map((val, idx) => coloresGradiente[idx] || '#fee5d9');

    if (window.topGlobalChartInstance) window.topGlobalChartInstance.destroy();

    window.topGlobalChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Valor Total`,
                data: dataValues,
                backgroundColor: bgColors,
                borderColor: '#333',
                borderWidth: 1
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: '#fff',
                    anchor: 'end',
                    align: 'right',
                    font: { weight: 'bold', size: 11 },
                    formatter: function (value) {
                        return value.toLocaleString('es-MX');
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#aaa' },
                    grid: { color: '#444' }
                },
                y: {
                    ticks: { color: '#fff' },
                    grid: { display: false }
                }
            }
        }
    });

}

function actualizarGrafica(features, campoEtiqueta, campoValor, etiquetaMoneda) {
    if (typeof Chart === 'undefined') return;
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var titulo = document.getElementById('stats-title-text');
    if (titulo) {
        if (currentScaleType === 'nacional') titulo.innerHTML = "Top Intercambio por Estado<br><small style='color:#aaa; font-size:11px'>Millones de Pesos (MDP)</small>";
        else if (currentScaleType === 'mundial') titulo.innerHTML = "Análisis de Intercambio";
    }

    var chartTitle = document.getElementById('myChartTitle');
    if (chartTitle) {
        chartTitle.innerHTML = currentScaleType === 'mundial' ? 'Top 5 Destinos' : 'Top Destinos';
        chartTitle.style.display = 'block';
    }

    var chartContainer = document.getElementById('myChartContainer');
    if (chartContainer) chartContainer.style.display = 'block';

    const canvas = document.getElementById('myChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.parentElement.style.height = '240px';

    let validFeatures = features.filter(f => f.properties[campoValor] != null && !isNaN(f.properties[campoValor]));
    let topData = [...validFeatures].sort((a, b) => b.properties[campoValor] - a.properties[campoValor]).slice(0, 5);

    // --- RESUMEN DINÁMICO (MUNDIAL Y NACIONAL) ---
    var summaryDiv = document.getElementById('dynamic-summary');
    if (summaryDiv) {
        if (currentScaleType === 'mundial' && topData.length > 0) {
            var p = topData[0].properties;
            var paisOrigen = p.Pais_Orige || "El país de origen";
            var industria = p.Industria || "este sector";
            var paisDestino = p[campoEtiqueta];
            var topValor = (p[campoValor] || 0).toLocaleString('es-MX');

            var totalExportGlobal = features.reduce((sum, f) => sum + (f.properties[campoValor] || 0), 0);
            var totalExportGlobalFormatted = totalExportGlobal.toLocaleString('es-MX');

            var summaryGlobalDiv = document.getElementById('dynamic-summary-global');
            if (summaryGlobalDiv) {
                summaryGlobalDiv.innerHTML = `El total de exportación a nivel global de <b>${paisOrigen}</b> en el sector de <b>${industria}</b> asciende a <b>$${totalExportGlobalFormatted} MDD</b>.`;
                summaryGlobalDiv.style.display = 'block';
            }

            summaryDiv.innerHTML = `<b>${paisOrigen}</b> es el principal proveedor internacional en el sector de <b>${industria}</b>, exportando <b>$${topValor} MDD</b> hacia <b>${paisDestino}</b>, destinados directamente a abastecer a su <span style="color:#00a2ff; font-weight:900; text-transform:uppercase; text-shadow: 1px 1px 2px #000;">Industria Automotriz</span>.`;
            summaryDiv.style.display = 'block';

        } else if (currentScaleType === 'nacional' && topData.length > 0) {
            var p = topData[0].properties;
            var estadoOrigen = p.Edo_V || "El estado";
            var estadoDestino = p[campoEtiqueta];
            var topValor = (p[campoValor] || 0).toLocaleString('es-MX');
            // Sacamos el nombre del subsector para redactarlo
            var subsector = p.SUBSECTO_3 || p.SUBSECTO_2 || "este subsector";

            summaryDiv.innerHTML = `<b>${estadoOrigen}</b> es un proveedor nacional clave de <b>${subsector}</b>, enviando flujos con valor de <b>$${topValor} MDP</b> hacia <b>${estadoDestino}</b>, abasteciendo fuertemente a su <span style="color:#00e5ff; font-weight:900; text-transform:uppercase; text-shadow: 1px 1px 2px #000;">Industria Automotriz</span>.`;
            summaryDiv.style.display = 'block';

        } else {
            summaryDiv.style.display = 'none';
        }
    }

    let labels = topData.map(f => f.properties[campoEtiqueta]);
    let dataValues = topData.map(f => f.properties[campoValor]);

    let coloresGradiente = ['#a50f15', '#de2d26', '#fb6a4a', '#fcae91', '#fee5d9'];
    let bgColors = dataValues.map((val, idx) => coloresGradiente[idx] || '#fee5d9');

    if (mainChart) mainChart.destroy();

    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Valor`,
                data: dataValues,
                backgroundColor: bgColors,
                borderColor: '#333',
                borderWidth: 1
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                // --- SECCIÓN DE NÚMEROS (CORREGIDA) ---
                datalabels: {
                    color: '#fff',
                    anchor: 'end',
                    // ¡CAMBIO AQUÍ! De 'left' a 'right' para que el texto salga de la barra
                    align: 'right',
                    font: { weight: 'bold', size: 11 },
                    formatter: function (value) {
                        return value.toLocaleString('es-MX');
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#aaa',
                        callback: function (value) {
                            return currentScaleType === 'nacional' ? value / 1000000 : value;
                        }
                    },
                    grid: { color: '#444' }
                },
                y: {
                    ticks: { color: '#fff' },
                    grid: { display: false }
                }
            }
        }
    });

}

// ==========================================
// INTERFAZ (UI) COMPARTIDA
// ==========================================
function setupUI() {
    var leftContainer = document.getElementById('left-sidebar-container');
    if (!leftContainer) {
        leftContainer = document.createElement('div');
        leftContainer.id = 'left-sidebar-container';
        document.body.appendChild(leftContainer);

        var toggleTab = document.createElement('div');
        toggleTab.id = 'sidebar-toggle-tab';
        const svgOpen = `<svg viewBox="0 0 24 24" width="20" height="20" style="pointer-events:none;"><path d="M6,3 h9 a4,4 0 0 1 4,4 v10 a4,4 0 0 1 -4,4 h-9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M13,8 l-4,4 l4,4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        const svgClosed = `<svg viewBox="0 0 24 24" width="20" height="20" style="pointer-events:none;"><path d="M6,3 h9 a4,4 0 0 1 4,4 v10 a4,4 0 0 1 -4,4 h-9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9,8 l4,4 l-4,4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        toggleTab.innerHTML = svgOpen;
        toggleTab.title = 'Cerrar Panel Lateral';
        toggleTab.onclick = function () {
            leftContainer.classList.toggle('hidden-panel');
            this.classList.toggle('hidden-btn');
            const isClosed = leftContainer.classList.contains('hidden-panel');
            this.innerHTML = isClosed ? svgClosed : svgOpen;
            this.title = isClosed ? 'Abrir Panel Lateral' : 'Cerrar Panel Lateral';
        };
        document.body.appendChild(toggleTab);
    }

    if (!document.getElementById('scale-box')) {
        var scaleBox = document.createElement('div');
        scaleBox.id = 'scale-box'; scaleBox.className = 'dashboard-box';
        scaleBox.innerHTML = `
            <h4 class="panel-title">Análisis Multiescalar</h4>
            <div class="scale-icons-container">
                <button onclick="loadLayer('mundial')" class="scale-btn" id="btn-mundial" title="Escala Mundial">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M22 12h-20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    <span>Global</span>
                </button>
                <button onclick="loadLayer('nacional')" class="scale-btn" id="btn-nacional" title="Escala Nacional">
                    <img src="https://cdn.jsdelivr.net/gh/djaiss/mapsicon@master/all/mx/vector.svg" alt="México" style="filter: invert(1);">
                    <span>Nacional</span>
                </button>
                <button onclick="loadLayer('estatal')" class="scale-btn" id="btn-estatal" title="Escala Estatal (Clústeres)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="3" fill="currentColor"/><circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="18" cy="8" r="3" fill="currentColor"/><circle cx="8" cy="18" r="3" fill="currentColor"/><path d="M10 10l4 4M16 10l-6 6M10 16l4-4"/></svg>
                    <span>Estatal</span>
                </button>
                <button onclick="loadLayer('metropolitana')" class="scale-btn" id="btn-metropolitana" title="Escala Metropolitana">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
                        <polygon points="9 3 17 6 15 15 6 17 3 10" fill="currentColor" fill-opacity="0.2"/>
                        <polygon points="17 9 22 13 20 21 12 22 9 16" fill="currentColor" fill-opacity="0.2"/>
                        <circle cx="10" cy="10" r="2" fill="currentColor"/>
                        <circle cx="15" cy="15" r="2" fill="currentColor"/>
                    </svg>
                    <span>Metropol.</span>
                </button>
                <button onclick="loadLayer('municipio')" class="scale-btn" id="btn-municipio" title="Escala Municipal (AGEB)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 20 8 18 20 6 22 2 10" fill="currentColor" fill-opacity="0.3"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
                    <span>Municipal</span>
                </button>
            </div>
        `;
        leftContainer.appendChild(scaleBox);
    }

    if (!document.getElementById('filter-container-box')) {
        var filterBox = document.createElement('div');
        filterBox.id = 'filter-container-box'; filterBox.className = 'dashboard-box';
        filterBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('filter-content-wrapper', 'filter-arrow')" title="Ocultar/Mostrar Filtros">
                <span id="filter-title">Filtros</span> <span id="filter-arrow" class="drop-arrow">−</span>
            </h4>
            <div id="filter-content-wrapper" class="dropdown-content show">
                <div id="filter-buttons-container" style="width: 100%;"></div>
                <div id="fuente-div" class="fuente-control" style="display:none; margin-top:10px; width:100%; box-sizing:border-box;"></div>
            </div>
        `;
        leftContainer.appendChild(filterBox);
    }

    var filterButtonsContainer = document.getElementById('filter-buttons-container');
    if (filterButtonsContainer && !filterButtonsContainer._patched) {
        filterButtonsContainer._patched = true;
        const originalAppendChild = filterButtonsContainer.appendChild;
        filterButtonsContainer.appendChild = function(child) {
            var wrapper = document.createElement('div');
            wrapper.className = 'filter-item-wrapper';
            originalAppendChild.call(filterButtonsContainer, wrapper);
            wrapper.appendChild(child);
            return wrapper;
        };
    }

    if (!document.getElementById('legend-overlay')) {
        var legendBox = document.createElement('div');
        legendBox.id = 'legend-overlay'; legendBox.className = 'dashboard-box'; legendBox.style.display = 'none';
        legendBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('legend-wrapper', 'legend-arrow')" title="Ocultar/Mostrar Simbología">
                <span>Simbología</span> <span id="legend-arrow" class="drop-arrow">−</span>
            </h4>
            <div id="legend-wrapper" class="dropdown-content show">
                <div id="opacity-control" style="border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:10px; padding-bottom:10px; width: 100%;">
                    <label style="font-size:11px; color:#ddd; font-weight:bold; display:block; margin-bottom:5px; text-transform:uppercase;">Opacidad de Capas</label>
                    <input type="range" min="0.0" max="1" step="0.05" value="1" style="width:100%; cursor:pointer; pointer-events:auto;" oninput="actualizarTransparenciaGlobal(this.value)" />
                </div>
                <div id="legend-content"><small style="color:#aaa">Seleccione una escala</small></div>
            </div>
        `;
        leftContainer.appendChild(legendBox);
    }

    if (!document.getElementById('stats-overlay')) {
        var statsBox = document.createElement('div');
        statsBox.id = 'stats-overlay'; statsBox.className = 'dashboard-box'; statsBox.style.display = 'none';
        statsBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('stats-content', 'stats-arrow')" title="Ocultar/Mostrar Análisis" style="align-items:center;">
                <span id="stats-title-text">Análisis de Datos</span> <span id="stats-arrow" class="drop-arrow">−</span>
            </h4>
            <div id="stats-content" class="dropdown-content show">
                <h4 class="panel-title" id="topGlobalChartTitle" style="font-size:12px; margin-bottom:8px; display:none;">Top 5 Exportadores Mundiales</h4>
                <div style="height:240px; position:relative; width: 100%; display:none;" id="topGlobalChartContainer"><canvas id="topGlobalChart"></canvas></div>
                <div id="dynamic-summary-global" class="dynamic-summary-box" style="margin-top:10px; margin-bottom:15px; display:none; text-align: justify;"></div>
                <hr id="topGlobalChartHr" style="border:0; border-top:1px solid #444; margin:12px 0; display:none;">
                <h4 class="panel-title" id="myChartTitle" style="font-size:12px; margin-bottom:8px; display:none;">Top Destinos</h4>
                <div style="height:240px; position:relative; width: 100%; display:none;" id="myChartContainer"><canvas id="myChart"></canvas></div>
                <div id="dynamic-summary" class="dynamic-summary-box" style="text-align: justify;"></div>
                
                <!-- GRÁFICAS ESTATAL -->
                <div id="vinculacion-charts-container" style="display:none;">
                    <h4 class="panel-title" style="font-size:12px; margin-bottom:8px;">Distancia de Clústeres (Isocronas)</h4>
                    <div style="height:300px; position:relative;"><canvas id="isocronaChart"></canvas></div>
                    <div id="sintesis-isocrona" class="dynamic-summary-box" style="margin-top:10px; display:none; text-align: justify;"></div>
                </div>
                <!-- GRÁFICAS MUNICIPAL -->
                <div id="municipal-charts-container" style="display:none;">
                    <hr style="border:0; border-top:1px solid #444; margin:12px 0;">
                    <h4 class="panel-title" id="titulo-vuln" style="font-size:12px; margin-bottom:8px;">Distribución de Población por Nivel de Vulnerabilidad</h4>
                    <div style="height:240px; position:relative;"><canvas id="vulnChart"></canvas></div>
                    <div id="sintesis-vuln" class="dynamic-summary-box" style="margin-top:10px; display:none; text-align: justify;"></div>
                    <hr style="border:0; border-top:1px solid #444; margin:12px 0;">
                    <h4 class="panel-title" id="titulo-pob" style="font-size:12px; margin-bottom:8px;">Indicadores de Estructura Poblacional</h4>
                    <div style="height:240px; position:relative;"><canvas id="pobChart"></canvas></div>
                    <div id="sintesis-pob" class="dynamic-summary-box" style="margin-top:10px; display:none; text-align: justify;"></div>
                    <hr style="border:0; border-top:1px solid #444; margin:12px 0;">
                    <h4 class="panel-title" id="titulo-mun-res" style="font-size:12px; margin-bottom:8px;">Resumen por Municipio</h4>
                    <div style="height:300px; position:relative;"><canvas id="munResumenChart"></canvas></div>
                    <div id="sintesis-mun-res" class="dynamic-summary-box" style="margin-top:10px; display:none; text-align: justify;"></div>
                    <hr style="border:0; border-top:1px solid #444; margin:12px 0;" id="hr-del-res">
                    <h4 class="panel-title" id="titulo-del-res" style="font-size:12px; margin-bottom:8px;">Vulnerabilidad Cruzada por Delegación</h4>
                    <div style="height:300px; position:relative;" id="delResumenChartContainer"><canvas id="delResumenChart"></canvas></div>
                    <div id="sintesis-del-res" class="dynamic-summary-box" style="margin-top:10px; display:none; text-align: justify;"></div>
                </div>
            </div>
        `;
        leftContainer.appendChild(statsBox);
    }

    if (!document.getElementById('ian-dashboard-box')) {
        // Tablero Índice de Alineación Normativa (IAN)
        var ianBox = document.createElement('div');
        ianBox.id = 'ian-dashboard-box';
        ianBox.className = 'dashboard-box';
        ianBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('ian-dashboard-content', 'ian-arrow')" title="Ocultar/Mostrar IAN">
                <span style="font-size: 13px;">Matriz IAN (Índice de Alineación Normativa)</span> <span id="ian-arrow" class="drop-arrow">−</span>
            </h4>
            <div id="ian-dashboard-content" class="dropdown-content show">
                <!-- Se inyecta dinámicamente desde ian_dashboard.js -->
            </div>
        `;
        leftContainer.appendChild(ianBox);
    }

    if (!document.getElementById('fin-overlay')) {
        var finBox = document.createElement('div');
        finBox.id = 'fin-overlay'; finBox.className = 'dashboard-box'; finBox.style.display = 'none';
        finBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('fin-content', 'fin-arrow')" title="Ocultar/Mostrar Indicadores">
                <span id="fin-title-text" style="font-size:13px; font-weight:bold;">Indicadores Financieros Globales</span> <span id="fin-arrow" class="drop-arrow">−</span>
            </h4>
            <div id="fin-content" class="dropdown-content show">
                <!-- GRÁFICAS MUNDIAL/NACIONAL -->
                <div id="empresas-chart-container" style="display:none;">
                    <hr style="border:0; border-top:1px solid #444; margin:12px 0; display:none;">
                    <div id="indicador-container-box" style="margin-bottom:10px; position:relative;">
                        <select id="fin-indicator-select" style="background:#222; color:#fff; border:1px solid #555; border-radius:4px; padding:5px; width:100%; font-size:11px;" onchange="if(window.cambiarIndicadorFinanciero) window.cambiarIndicadorFinanciero()">
                            <option value="Activos_Millones" selected>Activos (Millones pesos)</option>
                            <option value="Capital_Accs_Millones">Capital Accs (Millones)</option>
                            <option value="Ingresos_Millones">Ingresos (Millones)</option>
                            <option value="Ingreso_%_cambio_Año_Anterior">Ingreso % cambio Año Anterior</option>
                            <option value="Utilidad_Millones">Utilidad (Millones)</option>
                            <option value="Utilidad_%_Ventas">Utilidad % Ventas</option>
                            <option value="Utilidad_%_Año_Anterior">Utilidad % Año Anterior</option>
                            <option value="Utilidad_%_Activos">Utilidad % Activos</option>
                            <option value="Valor_Mercado_Millones">Valor Mercado (Millones)</option>
                            <option value="Cambio_%_Valor_Mercado">Cambio % Valor Mercado</option>
                            <option value="Empleados">Empleados</option>
                            <option value="Ventas_empleado">Ventas por empleado</option>
                            <option value="Resultados_Empleado">Resultados Empleado</option>
                            <option value="ROE">ROE</option>
                            <option value="Rotación_Activos">Rotación Activos</option>
                            <option value="Multiplicador_Capital">Multiplicador Capital</option>
                        </select>
                    </div>
                    <h4 class="panel-title" id="empresas-chart-title" style="font-size:12px; margin-bottom:8px; text-transform:uppercase;">Empresas con mayor rendimiento del indicador que se seleccione</h4>
                    <div style="height:260px; position:relative;"><canvas id="empresasLineChart"></canvas></div>
                    <div id="sintesis-empresasLine" class="dynamic-summary-box" style="margin-top:10px; display:none;"></div>
                </div>
            </div>
        `;
        leftContainer.appendChild(finBox);
    }

    if (!document.getElementById('marco-legal-box')) {
        // Marco Legal Multiescalar
        var marcoBox = document.createElement('div');
        marcoBox.id = 'marco-legal-box';
        marcoBox.className = 'dashboard-box';
        marcoBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('marco-legal-content', 'marco-arrow')" title="Ocultar/Mostrar Marco Normativo">
                <span style="font-size: 13px;">Marco Normativo</span> <span id="marco-arrow" class="drop-arrow">−</span>
            </h4>
            <div id="marco-legal-content" class="dropdown-content show">
                <div class="marco-legal-tree" id="marco-legal-tree">
                    <!-- Se llena dinámicamente -->
                </div>
            </div>
        `;
        leftContainer.appendChild(marcoBox);
    }

    if (!document.getElementById('instrumentos-municipales-box')) {
        var instBox = document.createElement('div');
        instBox.id = 'instrumentos-municipales-box';
        instBox.className = 'dashboard-box';
        instBox.style.display = 'none'; // Inicialmente oculto
        
        var listadoInstrumentos = [
            {
                seccion: "Instrumentos de Ordenación y Planeación",
                esPrimera: true,
                items: [
                    {
                        siglas: "LGAHOTDU",
                        nombre: "Ley General de Asentamientos Humanos, Ordenamiento Territorial y Desarrollo Urbano. Establece las normas básicas para planear y regular el crecimiento, uso y conservación de los centros de población en todo el país.",
                        tag: "Planeación y Regulación | Marco Jurídico Base"
                    },
                    {
                        siglas: "LGEEPA",
                        nombre: "Ley General del Equilibrio Ecológico y la Protección al Ambiente. Regula la preservación y restauración del equilibrio ecológico, asegurando que el desarrollo urbano sea compatible con la protección ambiental.",
                        tag: "Planeación y Regulación | Marco Jurídico Base"
                    },
                    {
                        siglas: "NOM-001-SEDATU-2021",
                        nombre: "Norma Oficial Mexicana sobre espacios públicos en los asentamientos humanos. Define la terminología, contenidos y lineamientos para la gestión y diseño de espacios públicos de calidad en las ciudades.",
                        tag: "Regulación | Estándar de Gestión"
                    },
                    {
                        siglas: "NOM-002-SEDATU-2022",
                        nombre: "Norma Oficial Mexicana sobre equipamiento en los instrumentos que conforman el Sistema General de Planeación Territorial. Clasificación, terminología y aplicación.",
                        tag: "Regulación | Estándar de Gestión"
                    },
                    {
                        siglas: "NOM-003-SEDATU-2023",
                        nombre: "Norma Oficial Mexicana que establece los lineamientos para el fortalecimiento del sistema territorial para resistir, adaptarse y recuperarse ante amenazas de origen natural y del cambio climático.",
                        tag: "Regulación | Estándar de Gestión"
                    },
                    {
                        siglas: "PMDU",
                        nombre: "Programa Municipal de Desarrollo Urbano. Es el instrumento local que define los usos de suelo, densidades y metas de crecimiento para un municipio específico.",
                        tag: "Planeación | Base para Zonificación"
                    },
                    {
                        siglas: "PDUCP",
                        nombre: "Programa de Desarrollo Urbano del Centro de Población. Detalla el crecimiento futuro de una localidad urbana y la dotación de infraestructura necesaria así como su instrumentación.",
                        tag: "Planeación | Base para Zonificación"
                    },
                    {
                        siglas: "PPDU",
                        nombre: "Programas Parciales de Desarrollo Urbano, enfocados en áreas reducidas que requieren una ordenación detallada o reforma interior, permitiendo una intervención más quirúrgica en el tejido urbano.",
                        tag: "Gestión para el Desarrollo | Base para Zonificación"
                    }
                ]
            },
            {
                seccion: "Instrumentos de Gestión de Suelo y Desarrollo",
                introduccion: "Ha existido una enorme dependencia de los recursos federales (Participaciones y Aportaciones). Una alternativa para mejorar las finanzas municipales es la gestión de la valorización del suelo urbano.",
                items: [
                    {
                        siglas: "Polígonos de Actuación",
                        nombre: "Áreas delimitadas donde se permite el intercambio de potencial de desarrollo, la relotificación y la reubicación de usos. Se emplean principalmente en zonas de reciclaje urbano para optimizar el aprovechamiento del suelo.",
                        tag: "Gestión de Suelo | Zonificación Flexible"
                    },
                    {
                        siglas: "Zonificación Flotante",
                        nombre: "Área donde es posible desarrollar proyectos con requerimientos específicos de mezcla de actividades y aprovechamiento. Dicha área no está fija, sino que se mantiene “flotando” till los interesados solicitan el desarrollo.",
                        tag: "Regulación | Zonificación Flexible"
                    },
                    {
                        siglas: "Zonificación Condicional",
                        nombre: "Permite modificar la normatividad urbana mediante evaluaciones técnicas de agua, movilidad y protección civil, junto con consulta pública y pago de contraprestación. Adapta usos de suelo a nuevas necesidades.",
                        tag: "Regulación | Zonificación Flexible"
                    },
                    {
                        siglas: "Polígonos de Acción Inmediata",
                        nombre: "Zonas con gran libertad normativa diseñadas para incentivar la inversión en áreas deterioradas o desvalorizadas. Establecen temporalidades claras para evitar prácticas especulativas.",
                        tag: "Gestión para el Desarrollo | Zonificación Flexible"
                    },
                    {
                        siglas: "Permisos Especiales",
                        nombre: "Modificaciones para lo no regulado o para actividades de alto impacto que requieren mayor control por parte de la autoridad municipal. Garantizan que estas actividades especiales no afecten zonas residenciales.",
                        tag: "Regulación | Zonificación Flexible"
                    },
                    {
                        siglas: "Transferencia de Derechos",
                        nombre: "Consiste en la emisión y recepción de derechos de desarrollo entre diferentes zonas para promover la conservación y el mejoramiento de la ciudad.",
                        tag: "Gestión de Suelo | Transferencia de Derechos"
                    },
                    {
                        siglas: "Derecho de preferencia",
                        nombre: "Herramienta legal que otorga al municipio la prioridad para adquirir predios estratégicos que se pongan en venta. Permite que la autoridad asegure suelo para fines de utilidad pública.",
                        tag: "Gestión de Suelo | Grandes Intervenciones"
                    },
                    {
                        siglas: "Polígonos de Actuación Concertada",
                        nombre: "Alternativa a las reservas territoriales que facilita la consolidación del suelo regulando a los actores en un marco de seguridad jurídica. Busca el beneficio social mediante acuerdos transparentes.",
                        tag: "Gestión de Suelo | Grandes Intervenciones"
                    },
                    {
                        siglas: "Reagrupamiento parcelario",
                        nombre: "Mecanismo que permite la unificación de diversos predios para su posterior redistribución. Facilita la gestión asociada de propietarios para generar parcelas más eficientes y aptas para el desarrollo urbano.",
                        tag: "Gestión de Suelo | Grandes Intervenciones"
                    }
                ]
            }
        ];

        var htmlContent = '';
        listadoInstrumentos.forEach(sec => {
            var claseFirst = sec.esPrimera ? ' first' : '';
            htmlContent += `<h5 class="instrumento-seccion-title${claseFirst}">${sec.seccion}</h5>`;
            if (sec.introduccion) {
                htmlContent += `<div style="font-size:10px; color:#ddd; margin-bottom:10px; text-align: justify;">${sec.introduccion}</div>`;
            }
            sec.items.forEach(item => {
                htmlContent += `
                    <div class="legal-card level-municipal" style="cursor:default; margin-bottom: 8px;">
                        <b style="color:#fff;">${item.siglas}</b>
                        <div style="font-size:10px; color:#aaa; margin:4px 0; text-align: justify;">${item.nombre}</div>
                        <div style="font-size:9px; color:#00e5ff;">${item.tag}</div>
                    </div>
                `;
            });
        });

        instBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('inst-mun-content', 'inst-mun-arrow')" title="Ocultar/Mostrar">
                <span style="font-size: 13px;">Instrumentos Municipales</span> <span id="inst-mun-arrow" class="drop-arrow">−</span>
            </h4>
            <div id="inst-mun-content" class="dropdown-content show" style="max-height: 400px; overflow-y: auto; padding-right: 5px;">
                ${htmlContent}
            </div>
        `;
        leftContainer.appendChild(instBox);
    }

    if (!document.getElementById('penta-helix-box')) {
        // Penta-Hélice
        var pentaBox = document.createElement('div');
        pentaBox.id = 'penta-helix-box';
        pentaBox.className = 'dashboard-box';
        pentaBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('penta-helix-content', 'penta-arrow')" title="Ocultar/Mostrar">
                <span style="font-size: 13px;">Actores (Penta-Hélice)</span> <span id="penta-arrow" class="drop-arrow">−</span>
            </h4>
            <div id="penta-helix-content" class="dropdown-content show">
                <div class="penta-helix-container">
                    <div class="penta-center"></div>
                    <svg class="penta-lines">
                        <line x1="50%" y1="50%" x2="50%" y2="15%"></line>
                        <line x1="50%" y1="50%" x2="85%" y2="40%"></line>
                        <line x1="50%" y1="50%" x2="75%" y2="85%"></line>
                        <line x1="50%" y1="50%" x2="25%" y2="85%"></line>
                        <line x1="50%" y1="50%" x2="15%" y2="40%"></line>
                    </svg>
                    <div style="font-size:11px; color:#aaa; text-align:center; position:absolute; top:-15px; width:100%; font-style:italic;">Selecciona uno.</div>
                    
                    <div class="penta-node node-gov" id="ph-gov" onclick="mostrarModalPenta('gov')">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M12 2L2 7v2h20V7L12 2zm9 8H3v2h18v-2zm-2 3H5v6h3v-6h3v6h2v-6h3v6h3v-6zm3 7H2v2h20v-2z"/>
                        </svg>
                        <span class="penta-label">Gobierno</span>
                        <div class="penta-tooltip" id="ph-tt-gov">Gobierno</div>
                    </div>
                    <div class="penta-node node-aca" id="ph-aca" onclick="mostrarModalPenta('aca')">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M12 3L1 8l11 5 9-4.1v6.1h2V9L12 3zm0 12.2c-2.4 0-4.6-1.1-6.1-2.9L3.5 14c2 2.4 5 3.9 8.5 3.9s6.5-1.5 8.5-3.9l-2.4-1.7c-1.5 1.8-3.7 2.9-6.1 2.9z"/>
                        </svg>
                        <span class="penta-label">Academia</span>
                        <div class="penta-tooltip" id="ph-tt-aca">Academia</div>
                    </div>
                    <div class="penta-node node-pri" id="ph-pri" onclick="mostrarModalPenta('pri')">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M12 2L2.5 7.5v9L12 22l9.5-5.5v-9L12 2zm8 13.7L12 20.3l-8-4.6V8.3l8-4.6 8 4.6v7.4z"/>
                            <circle cx="12" cy="8.5" r="2.5"/>
                            <path fill-rule="evenodd" d="M12 12c-2.5 0-4.5 1.8-4.9 4.2h9.8c-.4-2.4-2.4-4.2-4.9-4.2zm0 1.2l.5 2.8h-1l.5-2.8z"/>
                        </svg>
                        <span class="penta-label">S. Privado</span>
                        <div class="penta-tooltip" id="ph-tt-pri">S. Privado</div>
                    </div>
                    <div class="penta-node node-soc" id="ph-soc" onclick="mostrarModalPenta('soc')">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <circle cx="7.5" cy="9.5" r="2.5"/>
                            <path d="M7.5 13c-1.8 0-3.3 1-3.8 2.5h7.6c-.5-1.5-2-2.5-3.8-2.5z"/>
                            <circle cx="16.5" cy="9.5" r="2.5"/>
                            <path d="M16.5 13c-1.8 0-3.3 1-3.8 2.5h7.6c-.5-1.5-2-2.5-3.8-2.5z"/>
                            <circle cx="12" cy="11" r="3" stroke="#141414" stroke-width="1.5"/>
                            <path d="M12 14.5c-2.2 0-4.1 1.2-4.6 3h9.2c-.5-1.8-2.4-3-4.6-3z" stroke="#141414" stroke-width="1.5"/>
                        </svg>
                        <span class="penta-label">Soc. Civil</span>
                        <div class="penta-tooltip" id="ph-tt-soc">Soc. Civil</div>
                    </div>
                    <div class="penta-node node-env" id="ph-env" onclick="mostrarModalPenta('env')">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <circle cx="17" cy="7" r="2.5" />
                            <path d="M17 2.5v1.5M17 10.5v1.5M12.5 7h1.5M20.5 7h1.5M13.8 3.8l1 1M19.2 9.2l1 1M13.8 10.2l1-1M19.2 4.8l1-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                            <path d="M2 19c4-3 10-4 15-1.5 3 1.5 5 3.5 5 3.5v1H2v-3z" />
                            <path d="M16 18c-1.5 1.5-2 3.5-3 5h2c.8-1.2 1.2-2.8 2.2-4.2l-1.2-.8z" fill="#141414" />
                            <path d="M8 15.5h2l-1-2h0.8l-0.8-1.5h0.6l-0.6-1.5-0.6 1.5h0.6l-0.8 1.5h0.8z M9 15.5v1.5h-1v-1.5z" />
                            <path d="M12.5 16.5h1.2l-.6-1.2h.5l-.5-1-.5 1h.5z M13 16.5v1h-.8v-1z" />
                        </svg>
                        <span class="penta-label">Ambiente</span>
                        <div class="penta-tooltip" id="ph-tt-env">Ambiente</div>
                    </div>
                </div>
            </div>
        `;
        leftContainer.appendChild(pentaBox);
    }
}

// ==========================================
// FUNCIÓN PARA ACTUALIZAR DIAGRAMAS EN PANEL DERECHO
// ==========================================
function actualizarPanelDerecho(escala) {
    var marcoTree = document.getElementById('marco-legal-tree');

    // Configuración Penta-Hélice
    var ttGov = document.getElementById('ph-tt-gov');
    var ttAca = document.getElementById('ph-tt-aca');
    var ttPri = document.getElementById('ph-tt-pri');
    var ttSoc = document.getElementById('ph-tt-soc');
    var ttEnv = document.getElementById('ph-tt-env');

    if (!marcoTree || !ttGov) return;

    var htmlLeyes = "";

    if (escala === 'mundial') {
        htmlLeyes += '<a href="https://www.wto.org/spanish/docs_s/legal_s/legal_s.htm" target="_blank" class="legal-card level-mundial">🌐 Acuerdos de la OMC<br><small>Comercio Internacional</small></a>';
        htmlLeyes += '<a href="https://www.who.int/es/about/governance/constitution" target="_blank" class="legal-card level-mundial">⚕️ Constitución de la OMS<br><small>Salud Global</small></a>';
        htmlLeyes += '<a href="https://www.nato.int/cps/en/natohq/index.htm" target="_blank" class="legal-card level-mundial">🛡️ OTAN<br><small>Seguridad Internacional</small></a>';
        htmlLeyes += '<a href="https://www.un.org/sustainabledevelopment/es/objetivos-de-desarrollo-sostenible/" target="_blank" class="legal-card level-mundial">🌎 Objetivos de Desarrollo Sostenible<br><small>Agenda 2030 (ONU)</small></a>';

        ttGov.innerHTML = "<b>Gobierno Nacional:</b><br>Secretaría de Relaciones Exteriores, Economía";
        ttAca.innerHTML = "<b>Academia:</b><br>Universidades Nacionales, IIEc UNAM";
        ttPri.innerHTML = "<b>Sector Privado:</b><br>Corporaciones Multinacionales, CONCAMIN";
        ttSoc.innerHTML = "<b>Sociedad Civil:</b><br>ONGs Internacionales";
        ttEnv.innerHTML = "<b>Ambiente:</b><br>Tratados Climáticos Globales";

    } else if (escala === 'nacional') {
        htmlLeyes += '<a href="https://www.gob.mx/t-mec" target="_blank" class="legal-card level-nacional">🤝 T-MEC<br><small>Tratado entre México, EE.UU. y Canadá</small></a>';
        htmlLeyes += '<a href="https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf" target="_blank" class="legal-card level-nacional">⚖️ Constitución Política de los E.U.M.<br><small>Artículos 25, 26, 27 y 115</small></a>';
        htmlLeyes += '<a href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LGAHOTDU_011220.pdf" target="_blank" class="legal-card level-nacional">📘 Ley General de Asentamientos Humanos<br><small>LGAHOTDU</small></a>';
        htmlLeyes += '<div style="margin-bottom: 10px;"></div>';

        ttGov.innerHTML = "<b>Gobierno Federal:</b><br>SEDATU, SEMARNAT, INEGI";
        ttAca.innerHTML = "<b>Academia:</b><br>CONAHCYT, Centros Públicos de Inv.";
        ttPri.innerHTML = "<b>Sector Privado:</b><br>Cámaras Industriales Nacionales (CANACINTRA)";
        ttSoc.innerHTML = "<b>Sociedad Civil:</b><br>Colegios de Especialistas";
        ttEnv.innerHTML = "<b>Ambiente:</b><br>LGEEPA y Normativas Federales";

    } else if (escala === 'estatal') {
        htmlLeyes += '<a href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LGAHOTDU_011220.pdf" target="_blank" class="legal-card level-nacional">📘 LGAHOTDU (Nacional)</a>';
        htmlLeyes += '<a href="https://ordenjuridico.gob.mx/" target="_blank" class="legal-card level-estatal">📙 Constitución Política del Estado<br><small>Soberanía y Ordenamiento</small></a>';
        htmlLeyes += '<a href="https://ordenjuridico.gob.mx/" target="_blank" class="legal-card level-estatal">📒 Ley Estatal de Asentamientos Humanos<br><small>Regulación Territorial</small></a>';

        ttGov.innerHTML = "<b>Gobierno Estatal:</b><br>Gobernador, Sec. de Desarrollo Urbano del Edo.";
        ttAca.innerHTML = "<b>Academia:</b><br>Universidades Estatales, Tecnológicos";
        ttPri.innerHTML = "<b>Sector Privado:</b><br>Clústeres Industriales Estatales";
        ttSoc.innerHTML = "<b>Sociedad Civil:</b><br>Sindicatos, Asociaciones Civiles Estatales";
        ttEnv.innerHTML = "<b>Ambiente:</b><br>Procuraduría Ambiental Estatal";

    } else if (escala === 'municipio') {
        htmlLeyes += '<a href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LGAHOTDU_011220.pdf" target="_blank" class="legal-card level-nacional">📘 LGAHOTDU (Nacional)</a>';
        htmlLeyes += '<a href="https://ordenjuridico.gob.mx/" target="_blank" class="legal-card level-estatal">📒 Ley Estatal de AA.HH. (Estatal)</a>';
        htmlLeyes += '<a href="https://www.gob.mx/incedm" target="_blank" class="legal-card level-municipal">📕 Bando de Policía y Gobierno<br><small>Administración Local</small></a>';
        htmlLeyes += '<a href="https://sistemas.sedatu.gob.mx/regisdocs/siga/" target="_blank" class="legal-card level-municipal">📓 P.M.D.U.<br><small>Programa Municipal de Desarrollo Urbano</small></a>';
        htmlLeyes += '<a href="https://sistemas.sedatu.gob.mx/regisdocs/siga/" target="_blank" class="legal-card level-municipal">📔 Planes Parciales / Reglamentos<br><small>Zonificación de usos de suelo</small></a>';

        ttGov.innerHTML = "<b>Gobierno Local:</b><br>Cabildo, IMPLAN, Dir. de Obras Públicas";
        ttAca.innerHTML = "<b>Academia:</b><br>Escuelas Locales, Institutos de Capacitación";
        ttPri.innerHTML = "<b>Sector Privado:</b><br>PyMES Locales, Comercio de Barrio";
        ttSoc.innerHTML = "<b>Sociedad Civil:</b><br>Comités Vecinales, Jefes de Manzana";
        ttEnv.innerHTML = "<b>Ambiente/Comunidad:</b><br>Protección Civil Municipal";
    } else if (escala === 'metropolitana') {
        htmlLeyes += '<div style="font-size:11px; color:#aaa; font-style:italic; text-align:center; padding: 20px 0;">Sin marco normativo metropolitano por ahora.</div>';
        ttGov.innerHTML = "<b>Gobierno Metropolitano:</b><br>Comisiones Metropolitanas";
        ttAca.innerHTML = "<b>Academia:</b><br>Observatorios Metropolitanos";
        ttPri.innerHTML = "<b>Sector Privado:</b><br>Clústeres inter-municipales";
        ttSoc.innerHTML = "<b>Sociedad Civil:</b><br>Consejos Consultivos Ciudadanos";
        ttEnv.innerHTML = "<b>Ambiente/Comunidad:</b><br>Coordinación Ambiental Metropolitana";
    }

    marcoTree.innerHTML = htmlLeyes;

    var instBoxRef = document.getElementById('instrumentos-municipales-box');
    if (instBoxRef) {
        if (escala === 'municipio') {
            instBoxRef.style.display = 'block';
        } else {
            instBoxRef.style.display = 'none';
        }
    }
}

function showSection(id) {
    document.querySelectorAll('.main-content-panel').forEach(p => p.style.display = 'none');
    var target = document.getElementById(id); if (target) target.style.display = 'block';
    var leftSidebar = document.getElementById('left-sidebar-container');
    var toggleTab = document.getElementById('sidebar-toggle-tab');
    if (id === 'inicio') {
        if (leftSidebar) leftSidebar.style.display = 'flex';
        if (toggleTab) toggleTab.style.display = 'flex';
        if (map) setTimeout(() => map.invalidateSize(), 200);
    } else {
        if (leftSidebar) leftSidebar.style.display = 'none';
        if (toggleTab) toggleTab.style.display = 'none';
    }
    document.querySelectorAll('.nav-button').forEach(n => {
        n.classList.remove('active');
        if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(id)) n.classList.add('active');
    });
}

function toggleDropdown(id, arrowId) {
    var content = document.getElementById(id);
    if (content) {
        content.classList.toggle('show');
        var arrow = document.getElementById(arrowId);
        if (arrow) {
            if (content.classList.contains('show')) arrow.textContent = '−';
            else arrow.textContent = '+';
        }
    }
}

function descargarDatos() {
    if (!mainChart || !mainChart.data || mainChart.data.labels.length === 0) { alert("No hay datos visibles."); return; }
    let rows = [], filename = "datos.csv";
    if (currentScaleType === 'estatal') { filename = "Analisis_Cluster.csv"; rows.push(["Sector Industrial", "Cantidad"]); }
    else { filename = `Top5_${currentScaleType.toUpperCase()}.csv`; rows.push(["Destino/Origen", "Valor"]); }
    let labels = mainChart.data.labels; let values = mainChart.data.datasets[0].data;
    labels.forEach((label, i) => { rows.push([String(label).replace(/,/g, " "), values[i]]); });
    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    let link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function capturarImagen() {
    var navBar = document.getElementById('nav-bar');
    if (navBar) navBar.style.display = 'none';
    html2canvas(document.body, { useCORS: true, allowTaint: true, scrollY: -window.scrollY }).then(canvas => {
        var link = document.createElement('a'); link.download = `Reporte_${new Date().toISOString().slice(0, 19)}.png`;
        link.href = canvas.toDataURL("image/png"); link.click();
        if (navBar) navBar.style.display = 'flex'; alert("¡Imagen guardada!");
    });
}

// ==========================================
// FUNCIONES AUXILIARES GENERALES
// ==========================================
function calcularBreaks(valores) {
    if (!valores || valores.length === 0) return [0, 0, 0, 0];
    if (valores.length < 5) return [valores[0], valores[0], valores[0], valores[0]];
    var step = Math.floor(valores.length / 5);
    return [valores[step], valores[step * 2], valores[step * 3], valores[step * 4]];
}

function getClase(valor, breaks) {
    if (valor <= breaks[0]) return 0; if (valor <= breaks[1]) return 1; if (valor <= breaks[2]) return 2; if (valor <= breaks[3]) return 3; return 4;
}

function actualizarLeyenda(breaks, moneda) {
    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content');
    if (!div || !overlay) return;

    var f = (n) => (n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
    var valorMinimo = breaks[0];
    var valorMaximo = breaks[3];
    var coloresCSS = RampaRojos.join(', ');

    var html = `
        <div id="legend-flujos">
            <div style="margin-bottom:12px; font-weight:bold; color:#ddd; font-size:14px;">Valor (${moneda})</div>
            <div style="width: 100%; padding: 0 5px; box-sizing: border-box;">
                <div style="width: 100%; height: 35px; background: linear-gradient(to right, ${coloresCSS}); clip-path: polygon(0 40%, 100% 0, 100% 100%, 0 60%);"></div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #ccc; font-weight: bold; margin-top: 5px;">
                    <span>$${f(valorMinimo)}</span>
                    <span>> $${f(valorMaximo)}</span>
                </div>
            </div>
            <div style="margin-top:10px; display:flex; align-items:center; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <span style="font-size: 11px; color: #aaa;">Opacidad Flujos:</span>
                <input type="range" min="0" max="1" step="0.1" value="0.8" style="width: 50%; cursor: pointer;" 
                    oninput="if(currentGeoJSONLayer) { currentGeoJSONLayer.eachLayer(l => { if(l instanceof L.Polyline) l.setStyle({opacity: this.value}); }); }">
            </div>
            <div style="margin-top:5px; display:flex; align-items:center; justify-content:space-between;">
                <span style="font-size: 11px; color: #aaa;">Opacidad Nodos:</span>
                <input type="range" min="0" max="1" step="0.1" value="1" style="width: 50%; cursor: pointer;" 
                    oninput="if(currentGeoJSONLayer) { currentGeoJSONLayer.eachLayer(l => { if(l instanceof L.CircleMarker) l.setStyle({fillOpacity: this.value, opacity: this.value}); }); }">
            </div>
        </div>
        <div id="legend-nodos-locales" style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px; display:none;"></div>
    `;

    div.innerHTML = html;

    if (currentScaleType === 'nacional') {
        if (window.top5NombresCache && window.coloresLineasCache) {
            window.actualizarLeyendaNodosNacionales(window.top5NombresCache, window.coloresLineasCache);
        }
    }

    overlay.style.display = 'block';
}

window.breaksProductividadActual = [];
window.claseProductividadSeleccionada = null;

window.sintesisProductividad = [
    "Clase 1: Productividad incipiente. Desarrollo industrial básico o muy rezagado en su sector.",
    "Clase 2: Productividad baja. Oportunidades de mejora en tecnificación y eficiencia.",
    "Clase 3: Productividad media. En transición hacia procesos más robustos e integrados.",
    "Clase 4: Productividad alta. Consolidación industrial notable en los subsectores evaluados.",
    "Clase 5: Productividad muy alta. Entidades líderes en innovación y máxima eficiencia sectorial."
];


window.filtrarMapaProductividad = function (clase) {
    if (window.claseProductividadSeleccionada === clase) {
        window.claseProductividadSeleccionada = null; // deseleccionar
    } else {
        window.claseProductividadSeleccionada = clase;
    }

    // Actualizar Síntesis
    var sintesisEl = document.getElementById('leyenda-sintesis');
    if (window.claseProductividadSeleccionada === null) {
        if(sintesisEl) sintesisEl.innerHTML = "Selecciona una clase para ver su interpretación espacial.";
    } else {
        if(sintesisEl) sintesisEl.innerHTML = window.sintesisProductividad[window.claseProductividadSeleccionada];
    }

    // Actualizar UI de la leyenda
    document.querySelectorAll('.legend-box').forEach(box => {
        let boxClase = parseInt(box.getAttribute('data-class'));
        if (window.claseProductividadSeleccionada === null) {
            box.style.opacity = '1';
            box.style.border = '1px solid #1a1a1a';
            box.style.transform = 'scale(1)';
        } else if (boxClase === window.claseProductividadSeleccionada) {
            box.style.opacity = '1';
            box.style.border = '2px solid #00e5ff';
            box.style.transform = 'scale(1.1)';
            box.style.zIndex = '10';
        } else {
            box.style.opacity = '0.3';
            box.style.border = '1px solid #1a1a1a';
            box.style.transform = 'scale(1)';
            box.style.zIndex = '1';
        }
    });

    // Filtrar los polígonos del mapa
    if (typeof currentGeoJSONLayer !== 'undefined' && currentGeoJSONLayer) {
        currentGeoJSONLayer.eachLayer(subGroup => {
            if (subGroup.eachLayer) {
                subGroup.eachLayer(layer => {
                    if (layer.feature && layer.feature.geometry && layer.feature.geometry.type !== 'Point') {
                        var estadoReal = normalizarEstadoNombre(
                            layer.feature.properties.name ||
                            layer.feature.properties.ESTADO ||
                            layer.feature.properties.NOMGEO
                        );

                        var pd = window.productDataActual[estadoReal];
                        if (pd && !isNaN(pd.valor)) {
                            var claseEstado = getClase(pd.valor, window.breaksProductividadActual);
                            if (window.claseProductividadSeleccionada === null || claseEstado === window.claseProductividadSeleccionada) {
                                layer.setStyle({ opacity: 1, fillOpacity: 0.8 });
                                // Restaurar eventos si estaban atenuados
                            } else {
                                layer.setStyle({ opacity: 0.2, fillOpacity: 0.1 });
                            }
                        } else {
                            layer.setStyle({ opacity: 0.2, fillOpacity: 0 });
                        }
                    } else if (layer.feature && layer.feature.geometry && layer.feature.geometry.type === 'Point') {
                        // Atenuar labels si están fuera de la clase
                        var estadoReal = normalizarEstadoNombre(
                            layer.feature.properties.name ||
                            layer.feature.properties.ESTADO ||
                            layer.feature.properties.NOMGEO
                        );
                        var pd = window.productDataActual[estadoReal];
                        if (pd && !isNaN(pd.valor)) {
                            var claseEstado = getClase(pd.valor, window.breaksProductividadActual);
                            if (window.claseProductividadSeleccionada === null || claseEstado === window.claseProductividadSeleccionada) {
                                if (layer._icon) layer._icon.style.opacity = "1";
                            } else {
                                if (layer._icon) layer._icon.style.opacity = "0.2";
                            }
                        }
                    }
                });
            }
        });
    }
};

window.breaksFinanzasActual = [];
window.claseFinanzasSeleccionada = null;

window.sintesisFinanzas = [
    "Clase 1: Autonomía Alta. Entidades con menor dependencia, indicativo de fuerte recaudación propia.",
    "Clase 2: Dependencia Baja. Capacidad fiscal suficiente con aportaciones moderadas.",
    "Clase 3: Dependencia Moderada. Contrapeso promedio entre ingresos locales y gasto federalizado.",
    "Clase 4: Dependencia Alta. Presupuesto altamente subordinado a participaciones nacionales.",
    "Clase 5: Dependencia Crítica. Finanzas operativas casi totalmente ancladas al fondo federal."
];


window.filtrarMapaFinanzas = function (clase) {
    if (window.claseFinanzasSeleccionada === clase) {
        window.claseFinanzasSeleccionada = null;
    } else {
        window.claseFinanzasSeleccionada = clase;
    }

    var sintesisEl = document.getElementById('leyenda-sintesis-fin');
    if (window.claseFinanzasSeleccionada === null) {
        if(sintesisEl) sintesisEl.innerHTML = "Selecciona una clase para ver su interpretación espacial.";
    } else {
        if(sintesisEl) sintesisEl.innerHTML = window.sintesisFinanzas[window.claseFinanzasSeleccionada];
    }

    document.querySelectorAll('.legend-box-fin').forEach(box => {
        let boxClase = parseInt(box.getAttribute('data-class'));
        if (window.claseFinanzasSeleccionada === null) {
            box.style.opacity = '1';
            box.style.border = '1px solid #1a1a1a';
            box.style.transform = 'scale(1)';
        } else if (boxClase === window.claseFinanzasSeleccionada) {
            box.style.opacity = '1';
            box.style.border = '2px solid #00e5ff';
            box.style.transform = 'scale(1.1)';
            box.style.zIndex = '10';
        } else {
            box.style.opacity = '0.3';
            box.style.border = '1px solid #1a1a1a';
            box.style.transform = 'scale(1)';
            box.style.zIndex = '1';
        }
    });

    if (typeof currentGeoJSONLayer !== 'undefined' && currentGeoJSONLayer) {
        currentGeoJSONLayer.eachLayer(subGroup => {
            if (subGroup.eachLayer) {
                subGroup.eachLayer(layer => {
                    if (layer.feature && layer.feature.geometry && layer.feature.geometry.type !== 'Point') {
                        var estadoReal = normalizarEstadoNombre(
                            layer.feature.properties.name ||
                            layer.feature.properties.ESTADO ||
                            layer.feature.properties.NOMGEO
                        );
                        
                        var val = window.finanzasDataMap && window.finanzasDataMap[estadoReal];
                        if (val !== undefined) {
                            var claseEstado = getClase(val, window.breaksFinanzasActual);
                            if (window.claseFinanzasSeleccionada === null || claseEstado === window.claseFinanzasSeleccionada) {
                                layer.setStyle({ opacity: 1, fillOpacity: 0.8 });
                            } else {
                                layer.setStyle({ opacity: 0.2, fillOpacity: 0.1 });
                            }
                        } else {
                            layer.setStyle({ opacity: 0.2, fillOpacity: 0 });
                        }
                    } else if (layer.feature && layer.feature.geometry && layer.feature.geometry.type === 'Point') {
                        var estadoReal = normalizarEstadoNombre(
                            layer.feature.properties.name ||
                            layer.feature.properties.ESTADO ||
                            layer.feature.properties.NOMGEO
                        );
                        var val = window.finanzasDataMap && window.finanzasDataMap[estadoReal];
                        if (val !== undefined) {
                            var claseEstado = getClase(val, window.breaksFinanzasActual);
                            if (window.claseFinanzasSeleccionada === null || claseEstado === window.claseFinanzasSeleccionada) {
                                if (layer._icon) layer._icon.style.opacity = "1";
                            } else {
                                if (layer._icon) layer._icon.style.opacity = "0.2";
                            }
                        }
                    }
                });
            }
        });
    }
};

// ==========================================
// MODAL PENTA-HELICE (DERECHOS Y OBLIGACIONES)
// ==========================================
function mostrarModalPenta(actorDef) {
    if (document.getElementById('penta-modal')) {
        document.getElementById('penta-modal').remove();
    }

    var info = { titulo: '', derechos: '', obligaciones: '' };

    if (currentScaleType === 'mundial' || currentScaleType === 'nacional') {
        if (actorDef === 'gov') { info.titulo = "Gobierno Central"; info.derechos = "Emitir política industrial macro; captar IED."; info.obligaciones = "Orquestar soberanía económica, seguridad nacional y conectividad logística clave."; }
        else if (actorDef === 'aca') { info.titulo = "Academia e Investigación Macro"; info.derechos = "Acceso al presupuesto y fondos nacionales."; info.obligaciones = "Fomentar innovación dura (patentes, R&D) y formación de calidad (capital humano avanzado)."; }
        else if (actorDef === 'pri') { info.titulo = "Grandes Corporativos y Transnacionales"; info.derechos = "Garantías del T-MEC, infraestructura portuaria."; info.obligaciones = "Inversiones, encadenamiento territorial transparente y sujeción a normativas federales."; }
        else if (actorDef === 'soc') { info.titulo = "Sociedad Civil Organizada"; info.derechos = "Participación e influencia en políticas públicas estructuradas."; info.obligaciones = "Auditar la gobernanza y cohesión territorial a nivel país."; }
        else if (actorDef === 'env') { info.titulo = "Medio Ambiente Federal"; info.derechos = "Amparo bajo tratados internacionales de protección (Acuerdo de París)."; info.obligaciones = "Decreto de Áreas Naturales Protegidas, garantizar soberanía energética hídrica."; }
    } else if (currentScaleType === 'estatal') {
        if (actorDef === 'gov') { info.titulo = "Gobierno Estatal"; info.derechos = "Expropiación, desarrollo de planes de infraestructura, atracción de inversión Estatal."; info.obligaciones = "Proveer movilidad regional (sistemas de transporte masivo) y Planes Estatales de AA.HH."; }
        else if (actorDef === 'aca') { info.titulo = "Universidades Estatales y Tecnológicos"; info.derechos = "Vincular programas teóricos con las armadoras o empresas tractoras."; info.obligaciones = "Ofertar especialidades y educación enfocada a la especialización regional automotriz/SEIT."; }
        else if (actorDef === 'pri') { info.titulo = "Sector Privado Regional / Clústeres"; info.derechos = "Uso de parques industriales y licitaciones estatales."; info.obligaciones = "Conectar la cadena de proveeduría multinacional con empresas locales del Estado."; }
        else if (actorDef === 'soc') { info.titulo = "Organizaciones y Sindicatos Locales"; info.derechos = "Negociación de contratos y mejoras sectoriales (salarios dignos y condiciones seguras)."; info.obligaciones = "Mitigar segregación, fortalecer calidad de vida desde el entorno asociativo."; }
        else if (actorDef === 'env') { info.titulo = "Medio Ambiente y Recursos Estatales"; info.derechos = "Defensa y legislación sobre ecosistemas críticos del Estado (ej. Sierras, bosques)."; info.obligaciones = "Amortiguar el impacto masivo por la alta necesidad hídrica de la agro/industria."; }
    } else {
        if (actorDef === 'gov') { info.titulo = "Gobierno Municipal"; info.derechos = "Cobro de predial municipal, delimitación de áreas urbanizables."; info.obligaciones = "Emisión de PMDU y Bandos de Policía; dotar agua potable, alumbrado, seguridad vial."; }
        else if (actorDef === 'aca') { info.titulo = "Educación Comunitaria y Técnica Local"; info.derechos = "Interacción e integración inmediata con el centro escolar comunitario."; info.obligaciones = "Ser núcleos de cohesión social barrial y dotar capacitaciones básicas para el mercado laboral."; }
        else if (actorDef === 'pri') { info.titulo = "Comercio Micro / Sector Privado Local"; info.derechos = "Beneficiarse del mercado de consumo de la expansión industrial e infraestructura municipal."; info.obligaciones = "Sujetarse estrictamente a usos de suelo locales (no uso industrial en residencial)."; }
        else if (actorDef === 'soc') { info.titulo = "Vecinos y Residentes del Polígono"; info.derechos = "Exigir no ser gentrificados; gozo de espacios públicos equipados, vivienda accesible."; info.obligaciones = "Responsabilidad cívica comunitaria directa (pago predial oportuno, orden vecinal)."; }
        else if (actorDef === 'env') { info.titulo = "Micro-Sustentabilidad y Barrio Verde"; info.derechos = "Disponibilidad de parques barriales y corredores verdes sanos."; info.obligaciones = "Actuar como la primera barrera contra la isla de calor y vulnerabilidad habitacional urbana."; }
    }

    var modal = document.createElement('div');
    modal.id = 'penta-modal';
    modal.style.position = 'fixed'; modal.style.top = '0'; modal.style.left = '0';
    modal.style.width = '100vw'; modal.style.height = '100vh';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
    modal.style.backdropFilter = 'blur(4px)';
    modal.style.zIndex = '99999'; modal.style.display = 'flex';
    modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';

    var box = document.createElement('div');
    box.className = 'dashboard-box';
    box.style.width = '550px'; box.style.position = 'relative'; box.style.padding = '30px';
    box.style.backgroundColor = '#141414';
    box.style.borderTop = '4px solid #00e5ff'; box.style.boxShadow = '0 10px 40px rgba(0,0,0,0.8)';
    box.innerHTML = `
        <span onclick="document.getElementById('penta-modal').remove()" style="position:absolute; right:20px; top:15px; cursor:pointer; color:#eee; font-weight:bold; font-size:24px; text-shadow: 0 0 5px rgba(0,0,0,0.5);">✕</span>
        <h3 style="color:#00e5ff; margin-top:0; text-transform:uppercase; border-bottom:1px solid #333; padding-bottom:10px; font-size:18px;">${info.titulo}</h3>
        <div style="margin-bottom: 20px; font-family: 'Noto Sans', sans-serif;">
            <b style="color:#fc9272; font-size:15px; display:block; margin-bottom: 5px;">🫴 Derechos o Facultades:</b>
            <p style="color:#ddd; font-size:14px; margin:0; line-height:1.6;">${info.derechos}</p>
        </div>
        <div style="font-family: 'Noto Sans', sans-serif;">
            <b style="color:#a1d99b; font-size:15px; display:block; margin-bottom: 5px;">⚖️ Obligaciones / Responsabilidades:</b>
            <p style="color:#ddd; font-size:14px; margin:0; line-height:1.6;">${info.obligaciones}</p>
        </div>
    `;

    modal.onclick = function (e) { if (e.target === modal) modal.remove(); };
    modal.appendChild(box);
    document.body.appendChild(modal);
}

// ==========================================
// CONTROL DE TRANSPARENCIA GENERAL
// ==========================================
window.actualizarTransparenciaGlobal = function (val) {
    if (typeof map !== 'undefined' && map !== null) {
        if (map.getPane('overlayPane')) map.getPane('overlayPane').style.opacity = val;
        if (map.getPane('markerPane')) map.getPane('markerPane').style.opacity = val;
        if (map.getPane('tooltipPane')) map.getPane('tooltipPane').style.opacity = val;
    }
};

// ==========================================
// TOOLTIP INTERACTIVO (POP-UP TUTORIAL)
// ==========================================
window.mostrarInstruccionEscala = function (escala) {
    if (document.getElementById('escala-instruccion-pop')) {
        document.getElementById('escala-instruccion-pop').remove();
    }

    var cajaFiltros = document.getElementById('filter-container-box');
    if (escala === 'metropolitana') {
        cajaFiltros = document.getElementById('metro-zm-box');
    }
    if (!cajaFiltros) return;

    var msj = "";
    if (escala === 'mundial') msj = "Comienza seleccionando un <b>Sector</b>.";
    if (escala === 'nacional') msj = "Selecciona un <b>Sector</b> para explorarlo.";
    if (escala === 'estatal') msj = "Selecciona un <b>Clúster Sectorial</b>.";
    if (escala === 'metropolitana') msj = "Selecciona Zona Metropolitana";
    if (escala === 'municipio') msj = "Elige una <b>Entidad</b> para estudiar su vulnerabilidad.";

    var pop = document.createElement('div');
    pop.id = 'escala-instruccion-pop';
    pop.innerHTML = msj;
    pop.style.position = 'absolute';
    pop.style.top = '-30px';
    pop.style.right = '20px';
    pop.style.background = '#00e5ff';
    pop.style.color = '#111';
    pop.style.padding = '8px 12px';
    pop.style.borderRadius = '8px';
    pop.style.fontWeight = 'bold';
    pop.style.fontSize = '12px';
    pop.style.boxShadow = '0 4px 15px rgba(0,229,255,0.6)';
    pop.style.zIndex = '9999';
    pop.style.animation = 'fadeInSuave 0.5s ease-out, bouncePop 2s infinite';
    pop.style.cursor = 'pointer';

    pop.innerHTML += `<div style="position:absolute; bottom:-6px; right:20px; width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:6px solid #00e5ff;"></div>`;

    pop.onclick = function () { pop.remove(); };

    cajaFiltros.style.position = 'relative';
    cajaFiltros.appendChild(pop);

    setTimeout(() => { if (document.getElementById('escala-instruccion-pop')) pop.remove(); }, 6000);
};

window.mostrarInstruccionIndicador = function () {
    if (document.getElementById('indicador-instruccion-pop')) {
        document.getElementById('indicador-instruccion-pop').remove();
    }

    var cajaIndicador = document.getElementById('indicador-container-box');
    if (!cajaIndicador) return;

    var pop = document.createElement('div');
    pop.id = 'indicador-instruccion-pop';
    pop.innerHTML = "Comienza seleccionando un <b>indicador financiero</b>.";
    pop.style.position = 'absolute';
    pop.style.top = '-32px';
    pop.style.right = '0px';
    pop.style.background = '#00e5ff';
    pop.style.color = '#111';
    pop.style.padding = '6px 10px';
    pop.style.borderRadius = '8px';
    pop.style.fontWeight = 'bold';
    pop.style.fontSize = '11px';
    pop.style.boxShadow = '0 4px 15px rgba(0,229,255,0.6)';
    pop.style.zIndex = '9999';
    pop.style.animation = 'fadeInSuave 0.5s ease-out, bouncePop 2s infinite';
    pop.style.cursor = 'pointer';

    pop.innerHTML += `<div style="position:absolute; bottom:-5px; right:15px; width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-top:5px solid #00e5ff;"></div>`;

    pop.onclick = function () { pop.remove(); };
    cajaIndicador.appendChild(pop);

    setTimeout(() => { if (document.getElementById('indicador-instruccion-pop')) pop.remove(); }, 8000);
};


window.productDataActual = {};
window.industriaActual = '';




// ==========================================
// 4. MÓDULOS DATOS DUROS
// ==========================================
const POBLACION_ESTATAL = {
    "CIUDAD DE MEXICO": 9209944,
    "ESTADO DE MEXICO": 16992418,
    "NUEVO LEON": 5784442,
    "BAJA CALIFORNIA": 3769020,
    "JALISCO": 8348151,
    "PUEBLA": 6583278,
    "GUANAJUATO": 6166934,
    "COAHUILA": 3146771,
    "SONORA": 2944840,
    "SAN LUIS POTOSI": 2822255,
    "AGUASCALIENTES": 1425607,
    "MORELOS": 1971520,
    "ZM Valle de México": 21804515,
    "ZM Tijuana": 2157853,
    "ZM Monterrey": 5341171
};

window.actualizarModulosDatosDuros = function(features, escala, nombreEstado) {
    var container = document.getElementById('modulos-container');
    if (!container) return;
    
    // Si no hay features ni nombreEstado, ocultar
    if ((!features || features.length === 0) && !nombreEstado) {
        container.style.display = 'none';
        return;
    }
    
    var totalPoblacion = 0;
    
    if (escala === "Estatal" && nombreEstado) {
        var key = normalizarEstadoNombre(nombreEstado);
        if (POBLACION_ESTATAL[nombreEstado]) totalPoblacion = POBLACION_ESTATAL[nombreEstado];
        else if (POBLACION_ESTATAL[key]) totalPoblacion = POBLACION_ESTATAL[key];
    } else {
        if (features) {
            features.forEach(f => {
                if (f.properties && f.properties.POB1_x && !isNaN(f.properties.POB1_x)) {
                    totalPoblacion += parseFloat(f.properties.POB1_x);
                }
            });
        }
    }

    var formatNum = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toLocaleString();
    };

    document.getElementById('val-mod-social').innerText = totalPoblacion > 0 ? formatNum(totalPoblacion) : "N/D";
    
    // Simulando PIB estatal basado en población (Placeholder a la espera de datos reales)
    // Se usa el PIB estatal en ambos casos como solicitó el usuario, calculándolo como proporción de población si no hay más info
    var pibSimulado = totalPoblacion * 0.15; // Placeholder
    document.getElementById('val-mod-eco').innerText = totalPoblacion > 0 ? '$' + formatNum(pibSimulado) + ' MDP' : "N/D";
    
    // Suelo simulado
    var sueloSimulado = totalPoblacion * 0.05; 
    document.getElementById('val-mod-amb').innerText = totalPoblacion > 0 ? formatNum(sueloSimulado) + ' ha' : "N/D";
    
    // Exportación simulada
    var expSimulada = totalPoblacion * 0.08; 
    document.getElementById('val-mod-exp').innerText = totalPoblacion > 0 ? '$' + formatNum(expSimulada) + ' MDP' : "N/D";
    
    // Restart animation
    container.classList.remove('animating');
    void container.offsetWidth;
    container.classList.add('animating');
    container.style.display = 'flex';
};