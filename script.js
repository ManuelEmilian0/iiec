// ==========================================
// 1. VARIABLES GLOBALES Y CONFIGURACIÓN
// ==========================================
var map;
var currentGeoJSONLayer = null; // Capa dinámica (Mundial/Nacional/Estatal)
var armadorasLayer = null;      // Capa de contexto (Puntos blancos fijos)
var activeData = null;          // Almacena los datos crudos para filtrar
var currentScaleType = '';      

// Paleta de colores (Rojos) y Grosores
const RampaRojos = ['#fee5d9','#fcae91','#fb6a4a','#de2d26','#a50f15'];
const Grosores = [1, 2, 4, 6, 8];

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initMap();
});

function initMap() {
    // 1. Configurar Mapa
    map = L.map('map', {
        minZoom: 2, maxZoom: 18, zoomControl: false
    }).setView([23.6345, -102.5528], 5);

    // Zoom abajo a la derecha
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Mapa base oscuro
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // 2. CONFIGURAR PANELES (Mover a la derecha)
    setupRightPanel();
    
    // 3. CARGAR CAPA DE CONTEXTO (Esta es la función que faltaba)
    cargarArmadorasContexto();
}

// Función para reestructurar el HTML y crear el panel derecho unificado
function setupRightPanel() {
    // Crear el contenedor principal a la derecha si no existe
    if (!document.getElementById('right-sidebar-container')) {
        var rightContainer = document.createElement('div');
        rightContainer.id = 'right-sidebar-container';
        document.body.appendChild(rightContainer);

        // Mover el Dashboard existente (Escalas) dentro del contenedor
        var dashboard = document.getElementById('dashboard-overlay');
        if (dashboard) {
            rightContainer.appendChild(dashboard);
        }

        // Crear la Leyenda (Simbología) debajo del dashboard
        var legendDiv = document.createElement('div');
        legendDiv.id = 'legend-overlay';
        legendDiv.innerHTML = '<h4>Simbología</h4><div id="legend-content"><small style="color:#aaa">Seleccione una escala</small></div>';
        rightContainer.appendChild(legendDiv);
    }
}

// Carga Armadoras como fondo fijo (Puntos blancos tenues)
function cargarArmadorasContexto() {
    fetch('armadoras.geojson')
        .then(r => r.json())
        .then(data => {
            armadorasLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 2, fillColor: "#fff", color: "#fff", weight: 0, opacity: 0.3, fillOpacity: 0.3
                    });
                }
            }).addTo(map);
        })
        .catch(e => console.log("Fondo armadoras no encontrado (revisa el nombre del archivo .geojson)"));
}

// ==========================================
// 3. CONTROLADOR DE CAPAS
// ==========================================
function loadLayer(scaleType) {
    var statusText = document.getElementById('layer-status');
    var filterPanel = document.getElementById('filter-panel');
    var filterContainer = document.getElementById('filter-buttons-container');
    
    // Resetear UI
    if(filterContainer) filterContainer.innerHTML = ""; 
    
    // Limpiar capa activa anterior (pero NO la de armadorasLayer)
    if (currentGeoJSONLayer) { map.removeLayer(currentGeoJSONLayer); }
    
    // Resetear leyenda
    var legendContent = document.getElementById('legend-content');
    if(legendContent) legendContent.innerHTML = "<small style='color:#aaa'>Use el panel lateral para filtrar datos</small>";

    currentScaleType = scaleType;
    var filename = "";
    var zoomCoords = [];
    var zoomLevel = 5;

    // Configuración según botón presionado
    if (scaleType === 'mundial') {
        filename = "mundial.geojson";
        zoomCoords = [20, 0]; zoomLevel = 2;
        if(filterPanel) filterPanel.style.display = 'flex';
        
    } else if (scaleType === 'nacional') {
        filename = "nacional.geojson";
        zoomCoords = [23.6345, -102.5528]; zoomLevel = 5;
        if(filterPanel) filterPanel.style.display = 'flex';
        
    } else if (scaleType === 'estatal') {
        filename = "denue.geojson"; 
        zoomCoords = [21.0, -101.0]; zoomLevel = 7;
        if(filterPanel) filterPanel.style.display = 'flex'; 
    }

    if(statusText) statusText.innerHTML = "Cargando datos...";

    fetch(filename)
        .then(response => response.json())
        .then(data => {
            activeData = data; 
            if(statusText) statusText.innerHTML = "Escala: " + scaleType.toUpperCase();
            map.flyTo(zoomCoords, zoomLevel, { duration: 1.5 });

            // INICIAR EL PRIMER NIVEL DE FILTROS
            if (scaleType === 'mundial') {
                iniciarFiltroMundial_Paso1(data);
            } else if (scaleType === 'nacional') {
                iniciarFiltroNacional_Paso1(data);
            } else if (scaleType === 'estatal') {
                iniciarFiltroEstatal_Paso1(data);
            }
        })
        .catch(error => console.error("Error cargando datos: " + error));
}

// ==========================================
// 4. LÓGICA MUNDIAL (Industria -> Pais_Orige -> Mapa MDD)
// ==========================================
function iniciarFiltroMundial_Paso1(data) {
    document.getElementById('filter-title').innerText = "1. Seleccione Industria";
    var opciones = [...new Set(data.features.map(f => f.properties.Industria))].sort();
    
    crearBotones(opciones, (industriaSel) => {
        iniciarFiltroMundial_Paso2(data, industriaSel);
    });
}

function iniciarFiltroMundial_Paso2(data, industriaSel) {
    document.getElementById('filter-title').innerText = "2. Seleccione Origen";
    
    var datosFiltrados = data.features.filter(f => f.properties.Industria === industriaSel);
    var origenes = [...new Set(datosFiltrados.map(f => f.properties.Pais_Orige))].sort();

    crearBotones(origenes, (origenSel) => {
        var finalData = datosFiltrados.filter(f => f.properties.Pais_Orige === origenSel);
        renderizarMapaFlujos(finalData, 'Valor', 'MDD', 'Pais_Desti');
    }, () => iniciarFiltroMundial_Paso1(data)); 
}

// ==========================================
// 5. LÓGICA NACIONAL (Subsector -> Edo_V -> Mapa MDP)
// ==========================================
function iniciarFiltroNacional_Paso1(data) {
    document.getElementById('filter-title').innerText = "1. Seleccione Subsector";
    var opciones = [...new Set(data.features.map(f => f.properties.SUBSECTO_3 || f.properties.SUBSECTO_2))].sort();
    
    crearBotones(opciones, (subsectorSel) => {
        iniciarFiltroNacional_Paso2(data, subsectorSel);
    });
}

function iniciarFiltroNacional_Paso2(data, subsectorSel) {
    document.getElementById('filter-title').innerText = "2. Seleccione Estado Origen";
    
    var datosFiltrados = data.features.filter(f => (f.properties.SUBSECTO_3 === subsectorSel || f.properties.SUBSECTO_2 === subsectorSel));
    var origenes = [...new Set(datosFiltrados.map(f => f.properties.Edo_V))].sort();

    crearBotones(origenes, (origenSel) => {
        var finalData = datosFiltrados.filter(f => f.properties.Edo_V === origenSel);
        renderizarMapaFlujos(finalData, 'VALOR', 'MDP', 'EDO_C');
    }, () => iniciarFiltroNacional_Paso1(data));
}

// ==========================================
// 6. LÓGICA ESTATAL (Ensamblado -> Conjunto -> Puntos)
// ==========================================
function iniciarFiltroEstatal_Paso1(data) {
    document.getElementById('filter-title').innerText = "1. Seleccione Ensambladora";
    var opciones = [...new Set(data.features.map(f => f.properties.Ensamblado).filter(x => x))].sort();
    
    crearBotones(opciones, (ensambladoSel) => {
        iniciarFiltroEstatal_Paso2(data, ensambladoSel);
    });
}

function iniciarFiltroEstatal_Paso2(data, ensambladoSel) {
    document.getElementById('filter-title').innerText = "2. Seleccione Conjunto";
    
    var datosFiltrados = data.features.filter(f => f.properties.Ensamblado === ensambladoSel);
    var conjuntos = [...new Set(datosFiltrados.map(f => f.properties.Conjunto).filter(x => x))].sort();

    crearBotones(conjuntos, (conjuntoSel) => {
        var finalData = datosFiltrados.filter(f => f.properties.Conjunto === conjuntoSel);
        renderizarMapaPuntos(finalData);
    }, () => iniciarFiltroEstatal_Paso1(data));
}

// ==========================================
// 7. RENDERIZADO DE MAPAS
// ==========================================

// Renderizado Genérico para Flujos (Mundial y Nacional)
function renderizarMapaFlujos(features, campoValor, etiquetaMoneda, campoDestino) {
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);

    var valores = features.map(f => f.properties[campoValor]).sort((a,b) => a - b);
    var breaks = calcularBreaks(valores);

    currentGeoJSONLayer = L.geoJSON(features, {
        style: function(feature) {
            var val = feature.properties[campoValor];
            var clase = getClase(val, breaks);
            return { color: RampaRojos[clase], weight: Grosores[clase], opacity: 0.9 };
        },
        onEachFeature: function(feature, layer) {
            var p = feature.properties;
            var popup = `<b>Destino:</b> ${p[campoDestino]}<br>
                         <b>Valor:</b> $${p[campoValor].toLocaleString()} ${etiquetaMoneda}`;
            layer.bindPopup(popup);
        }
    }).addTo(map);

    actualizarLeyenda(breaks, etiquetaMoneda);
}

// Renderizado de Puntos (Estatal)
function renderizarMapaPuntos(features) {
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);

    currentGeoJSONLayer = L.geoJSON(features, {
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 6,
                fillColor: "#ffff00", 
                color: "#333",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.9
            });
        },
        onEachFeature: function(feature, layer) {
            var p = feature.properties;
            var popup = `<b>Empresa:</b> ${p.Empresa}<br>
                         <b>Conjunto:</b> ${p.Conjunto}<br>
                         <b>Ensambla para:</b> ${p.Ensamblado}`;
            layer.bindPopup(popup);
        }
    }).addTo(map);
    
    // Leyenda simple para puntos (apuntando al nuevo panel)
    var legendDiv = document.getElementById('legend-content');
    if(legendDiv) {
        legendDiv.innerHTML = 
            `<div class="legend-item"><span class="legend-color" style="background:#ffff00; border-radius:50%"></span>Proveedores DENUE</div>
             <div class="legend-item"><span class="legend-color" style="background:#ffffff; border-radius:50%"></span>Todas las Armadoras</div>`;
    }
}

// ==========================================
// 8. UTILIDADES
// ==========================================

function crearBotones(lista, callback, backCallback) {
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";

    if(backCallback) {
        var btnBack = document.createElement("button");
        btnBack.innerText = "⬅ Volver / Cambiar Filtro";
        btnBack.className = "back-btn"; 
        btnBack.onclick = backCallback;
        container.appendChild(btnBack);
    }

    if(lista.length === 0) {
        container.innerHTML += "<p style='padding:10px; color:#aaa'>No hay datos disponibles.</p>";
        return;
    }

    lista.forEach(item => {
        var btn = document.createElement("button");
        btn.innerText = item;
        btn.className = "dynamic-filter-btn";
        btn.onclick = function() {
             var siblings = container.querySelectorAll('.dynamic-filter-btn');
             siblings.forEach(s => s.classList.remove('active'));
             this.classList.add('active');
             callback(item);
        };
        container.appendChild(btn);
    });
}

function calcularBreaks(valores) {
    if (!valores || valores.length === 0) return [0,0,0,0];
    if (valores.length < 5) return [valores[0], valores[0], valores[0], valores[0]];
    var step = Math.floor(valores.length / 5);
    return [valores[step], valores[step*2], valores[step*3], valores[step*4]];
}

function getClase(valor, breaks) {
    if (valor <= breaks[0]) return 0;
    if (valor <= breaks[1]) return 1;
    if (valor <= breaks[2]) return 2;
    if (valor <= breaks[3]) return 3;
    return 4;
}

function actualizarLeyenda(breaks, moneda) {
    var div = document.getElementById('legend-content');
    if(!div) return;

    var f = (n) => n.toLocaleString('es-MX', {maximumFractionDigits: 0});
    
    var html = `<div style="margin-bottom:8px; font-weight:bold; color:#ddd">Valor (${moneda})</div>`;
    html += `<div class="legend-item"><span class="legend-color" style="background:${RampaRojos[0]};"></span> &le; $${f(breaks[0])}</div>`;
    html += `<div class="legend-item"><span class="legend-color" style="background:${RampaRojos[1]};"></span> $${f(breaks[0])} - $${f(breaks[1])}</div>`;
    html += `<div class="legend-item"><span class="legend-color" style="background:${RampaRojos[2]};"></span> $${f(breaks[1])} - $${f(breaks[2])}</div>`;
    html += `<div class="legend-item"><span class="legend-color" style="background:${RampaRojos[3]};"></span> $${f(breaks[2])} - $${f(breaks[3])}</div>`;
    html += `<div class="legend-item"><span class="legend-color" style="background:${RampaRojos[4]};"></span> &gt; $${f(breaks[3])}</div>`;
    
    div.innerHTML = html;
}

function showSection(id) {
    var panels = document.querySelectorAll('.main-content-panel');
    panels.forEach(p => p.style.display = 'none');
    
    var target = document.getElementById(id);
    if(target) {
        target.style.display = 'block';
        if(id === 'inicio' && map) setTimeout(() => map.invalidateSize(), 200);
    }
    
    // Actualizar botones nav (lógica simple)
    var navs = document.querySelectorAll('.nav-button');
    navs.forEach(n => n.classList.remove('active'));
    // Aquí podrías agregar lógica para activar el botón correspondiente si tienen IDs
}

// ==========================================
// FIX: FUNCIONES DE INTERFAZ Y ERRORES
// ==========================================

// 1. Corrige el error "closeFilters is not defined"
function closeFilters() {
    var panel = document.getElementById('filter-panel');
    if (panel) {
        panel.style.display = 'none';
        
        // Opcional: Limpiar el mapa al cerrar filtros si lo deseas
        // if(currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
        // document.getElementById('legend-content').innerHTML = '<small>Filtros cerrados</small>';
    }
}

// 2. Asegurar que el panel derecho existe y tiene la leyenda
// (Esta función se llama en initMap, pero la reforzamos aquí por si acaso)
function setupRightPanel() {
    var containerId = 'right-sidebar-container';
    var container = document.getElementById(containerId);

    // Si no existe el contenedor principal, créalo
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
    }

    // Mover el Dashboard (Escalas) adentro
    var dashboard = document.getElementById('dashboard-overlay');
    if (dashboard && dashboard.parentNode !== container) {
        container.appendChild(dashboard);
    }

    // Crear o Mover la Leyenda (Simbología)
    var legend = document.getElementById('legend-overlay');
    if (!legend) {
        legend = document.createElement('div');
        legend.id = 'legend-overlay';
        // Contenido por defecto para que se vea algo aunque no haya datos
        legend.innerHTML = `
            <h4>Simbología</h4>
            <div id="legend-content">
                <small style="color:#aaa; font-style:italic;">
                    Seleccione una escala<br>para ver datos.
                </small>
            </div>`;
        container.appendChild(legend);
    } else if (legend.parentNode !== container) {
        container.appendChild(legend);
    }
}