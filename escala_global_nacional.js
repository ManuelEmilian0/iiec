// ==========================================
// 1. ESCALA GLOBAL Y NACIONAL (Y MAPA BASE)
// ==========================================
// Variables Globales compartidas entre escalas
var map;
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
var fuenteControl = null;

const RampaRojos = ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'];
const Grosores = [1, 2, 4, 6, 8];

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    initMap();
});

function initMap() {
    if (map !== undefined && map !== null) { map.remove(); }

    map = L.map('map', { minZoom: 2, maxZoom: 18, zoomControl: false }).setView([20, 0], 2);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    var cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO', subdomains: 'abcd', maxZoom: 19
    });
    var satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &mdash; Source: Esri', maxZoom: 19
    });

    cartoDark.addTo(map);

    var mapasBase = { "Mapa Oscuro (Carto)": cartoDark, "Satélite (Esri)": satelite };
    L.control.layers(mapasBase, null, { position: 'topright' }).addTo(map);

    // Control de Fuente dinamico
    fuenteControl = L.control({ position: 'bottomright' });
    fuenteControl.onAdd = function (map) {
        this._div = L.DomUtil.create('div', 'fuente-control');
        this.update(''); return this._div;
    };
    fuenteControl.update = function (texto) {
        if (texto) { this._div.innerHTML = `Fuente: ${texto}`; this._div.style.display = 'block'; }
        else { this._div.style.display = 'none'; }
    };
    fuenteControl.addTo(map);

    setupUI();
    // Esta función está en escala_estatal.js, verificamos si existe
    if (typeof cargarArmadorasContexto === "function") cargarArmadorasContexto();
    showSection('inicio');

    setTimeout(() => { loadLayer('mundial'); }, 500);
}

// ==========================================
// CONTROLADOR DE CAPAS (MULTIESCALAR)
// ==========================================
function loadLayer(scaleType) {
    document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
    var activeBtn = document.getElementById('btn-' + scaleType);
    if (activeBtn) activeBtn.classList.add('active');

    if (currentGeoJSONLayer) { map.removeLayer(currentGeoJSONLayer); currentGeoJSONLayer = null; }
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
    if (isocronasLayer) { map.removeLayer(isocronasLayer); isocronasLayer = null; }
    if (agebLayer) { map.removeLayer(agebLayer); agebLayer = null; }

    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) {
        statsDiv.style.display = 'none';
        // Restaurar el botón de captura por defecto al cambiar de escala
        var screenshotBtn = statsDiv.querySelector('.screenshot-btn');
        if (screenshotBtn) screenshotBtn.style.display = 'flex';
    }

    var legendDiv = document.getElementById('legend-overlay');
    if (legendDiv) legendDiv.style.display = 'none';

    var summaryDiv = document.getElementById('dynamic-summary');
    if (summaryDiv) summaryDiv.style.display = 'none';

    var vincContainer = document.getElementById('vinculacion-charts-container');
    if (vincContainer) vincContainer.style.display = 'none';

    var empContainer = document.getElementById('empresas-chart-container');
    if (empContainer) empContainer.style.display = 'none';

    if (typeof estratoChart !== "undefined" && estratoChart) { estratoChart.destroy(); estratoChart = null; }
    if (typeof empresaChart !== "undefined" && empresaChart) { empresaChart.destroy(); empresaChart = null; }
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
            fetch('armadoras.geojson').then(r => r.json()).then(data => {
                window.armadorasRawData = data; // Cache
                var triangleHtml = '<svg width="24" height="24" viewBox="0 0 24 24"><polygon points="12,2 22,22 2,22" fill="#00e5ff" stroke="#fff" stroke-width="2"/></svg>';
                var triangleIcon = L.divIcon({ className: '', html: triangleHtml, iconSize: [24, 24], iconAnchor: [12, 12] });
                
                window.armadorasNacionalTriangulosLayer = L.geoJSON(data, {
                    pointToLayer: function (feature, latlng) {
                        return L.marker(latlng, { icon: triangleIcon });
                    },
                    onEachFeature: function (feature, layer) {
                        var armName = feature.properties.Empresa || feature.properties.Nombre || 'Armadora';
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
            filterBox.style.display = 'flex';
            document.getElementById('filter-buttons-container').innerHTML = "";
            document.getElementById('filter-title').innerText = "Cargando...";
        }
        if (typeof iniciarLogicaEstatal === "function") iniciarLogicaEstatal();
        return;
    }

    if (scaleType === 'municipio') {
        if (filterBox) {
            filterBox.style.display = 'flex';
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
        filename = "mundial.geojson";
        zoomCoords = [20, 0]; zoomLevel = 2;
        if (filterBox) filterBox.style.display = 'flex';
    } else if (scaleType === 'nacional') {
        filename = "nacional.geojson";
        zoomCoords = [23.6345, -102.5528]; zoomLevel = 5;
        if (filterBox) filterBox.style.display = 'flex';
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
        var origenes = [...new Set(datosFiltrados.map(f => f.properties.Pais_Orige))].sort();

        selectOrigen.innerHTML = `<option value="" disabled selected>-- País --</option>`;
        origenes.forEach(item => {
            selectOrigen.innerHTML += `<option value="${item}">${item}</option>`;
        });
        selectOrigen.style.display = 'block';
        if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
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

function iniciarFiltroNacional_Paso1(data) {
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";
    document.getElementById('filter-title').innerText = "Intercambios Nacionales";

    // 1. CLASIFICADOR: Identifica a qué grupo pertenece cada texto de subsector
    function obtenerGrupo(subsectorTexto) {
        let sub = (subsectorTexto || "").toUpperCase();
        if (sub.includes("ELÉCTRIC") || sub.includes("ELECTRIC") || sub.includes("335")) return "ELÉCTRICA";
        if (sub.includes("ELECTRÓNIC") || sub.includes("ELECTRONIC") || sub.includes("334")) return "ELECTRÓNICA";
        if (sub.includes("INFORM") || sub.includes("TELECOM") || sub.includes("SEIT") || sub.includes("51")) return "SERVICIOS SEIT";
        return "OTROS";
    }

    // Extraemos todos los subsectores únicos de la base de datos
    var todosLosSubsectores = [...new Set(data.features.map(f => f.properties.SUBSECTO_3 || f.properties.SUBSECTO_2 || ""))];

    // Sacamos los 3 Grandes Grupos
    var opcionesGrupo = [...new Set(todosLosSubsectores.map(sub => obtenerGrupo(sub)))].filter(g => g !== "OTROS").sort();

    // --- CREAMOS LAS 3 CAJAS DESPLEGABLES ---
    var selectGrupo = document.createElement("select");
    selectGrupo.className = "dynamic-filter-select";
    selectGrupo.innerHTML = `<option value="" disabled selected>-- Grupo Industrial --</option>`;
    opcionesGrupo.forEach(item => { selectGrupo.innerHTML += `<option value="${item}">${item}</option>`; });

    var selectSubsector = document.createElement("select");
    selectSubsector.className = "dynamic-filter-select";
    selectSubsector.style.display = 'none'; // Oculto al inicio

    var selectEstado = document.createElement("select");
    selectEstado.className = "dynamic-filter-select";
    selectEstado.style.display = 'none'; // Oculto al inicio

    // --- EVENTO 1: Al elegir el GRUPO ---
    selectGrupo.onchange = function () {
        var grupoSel = this.value;

        // Buscamos qué subsectores pertenecen a este grupo
        var subsectoresDelGrupo = todosLosSubsectores.filter(sub => obtenerGrupo(sub) === grupoSel).sort();

        selectSubsector.innerHTML = `<option value="" disabled selected>-- Subsector --</option>`;
        subsectoresDelGrupo.forEach(item => { selectSubsector.innerHTML += `<option value="${item}">${item}</option>`; });

        selectSubsector.style.display = 'block'; // Mostramos paso 2
        selectEstado.style.display = 'none';     // Ocultamos paso 3 por si el usuario se regresó
        if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
    };

    // --- EVENTO 2: Al elegir el SUBSECTOR ---
    selectSubsector.onchange = function () {
        var subsectorSel = this.value;

        // Buscamos qué estados tienen datos para este subsector específico
        var datosFiltrados = data.features.filter(f => (f.properties.SUBSECTO_3 === subsectorSel || f.properties.SUBSECTO_2 === subsectorSel));
        var estados = [...new Set(datosFiltrados.map(f => f.properties.Edo_V))].sort();

        selectEstado.innerHTML = `<option value="" disabled selected>-- Entidad Federativa --</option>`;
        estados.forEach(item => { selectEstado.innerHTML += `<option value="${item}">${item}</option>`; });

        selectEstado.style.display = 'block'; // Mostramos paso 3
        if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
    };

    // --- EVENTO 3: Al elegir el ESTADO (Renderizamos mapa) ---
    selectEstado.onchange = function () {
        var subsectorSel = selectSubsector.value;
        var estadoSel = this.value;

        var finalData = data.features.filter(f => (f.properties.SUBSECTO_3 === subsectorSel || f.properties.SUBSECTO_2 === subsectorSel) && f.properties.Edo_V === estadoSel);
        renderizarMapaFlujos(finalData, 'VALOR', 'MDP', 'EDO_C');
    };

    // Inyectamos las 3 cajas al panel
    container.appendChild(selectGrupo);
    container.appendChild(selectSubsector);
    container.appendChild(selectEstado);
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
function actualizarGrafica(features, campoEtiqueta, campoValor, etiquetaMoneda) {
    if (typeof Chart === 'undefined') return;
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var titulo = document.getElementById('stats-title-text');
    if (titulo) {
        if (currentScaleType === 'mundial') titulo.innerHTML = "Top 5 Intercambio Mundial<br><small style='color:#aaa; font-size:11px'>Millones de Dólares (MDD)</small>";
        else if (currentScaleType === 'nacional') titulo.innerHTML = "Top Intercambio por Estado<br><small style='color:#aaa; font-size:11px'>Millones de Pesos (MDP)</small>";
    }

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

            summaryDiv.innerHTML = `<b>${paisOrigen}</b> es el principal proveedor internacional en el sector de <b>${industria}</b>, exportando <b>$${topValor} MDD</b> hacia <b>${paisDestino}</b>, destinados directamente a abastecer a su <span style="color:#00a2ff; font-weight:900; text-transform:uppercase; text-shadow: 1px 1px 2px #000;">Industria Automotriz</span>.`;
            summaryDiv.style.display = 'block';

        } else if (currentScaleType === 'nacional' && topData.length > 0) {
            var p = topData[0].properties;
            var estadoOrigen = p.Edo_V || "El estado";
            var estadoDestino = p[campoEtiqueta];
            var topValor = (p[campoValor] || 0).toLocaleString('es-MX');
            // Sacamos el nombre del subsector para redactarlo
            var subsector = p.SUBSECTO_3 || p.SUBSECTO_2 || "este subsector";

            summaryDiv.innerHTML = `<b>${estadoOrigen}</b> es un proveedor nacional clave de <b>${subsector}</b>, enviando flujos con valor de <b>$${topValor} MDP</b> hacia <b>${estadoDestino}</b>, abasteciendo fuertemente a su <span style="color:#00a2ff; font-weight:900; text-transform:uppercase; text-shadow: 1px 1px 2px #000;">Industria Automotriz</span>.`;
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
        toggleTab.innerHTML = '◀';
        toggleTab.title = 'Mostrar/Ocultar Panel Lateral';
        toggleTab.onclick = function () {
            leftContainer.classList.toggle('hidden-panel');
            this.classList.toggle('hidden-btn');
            this.innerHTML = leftContainer.classList.contains('hidden-panel') ? '▶' : '◀';
        };
        document.body.appendChild(toggleTab);
    }

    if (!document.getElementById('scale-box')) {
        var scaleBox = document.createElement('div');
        scaleBox.id = 'scale-box'; scaleBox.className = 'dashboard-box';
        scaleBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('scale-content', 'scale-arrow')" title="Ocultar/Mostrar Sección">
                <span>Análisis Multiescalar</span> <span id="scale-arrow" class="drop-arrow">▼</span>
            </h4>
            <div id="scale-content" class="dropdown-content show">
                <div class="scale-icons-container" style="gap: 5px;">
                    <button onclick="loadLayer('mundial')" class="scale-btn" id="btn-mundial" title="Escala Mundial" style="flex-direction: column; padding: 4px; height: 55px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; margin-bottom:4px;"><circle cx="12" cy="12" r="10"/><path d="M22 12h-20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        <span style="font-size:10px; font-weight:bold;">Escala Global</span>
                    </button>
                    <button onclick="loadLayer('nacional')" class="scale-btn" id="btn-nacional" title="Escala Nacional" style="flex-direction: column; padding: 4px; height: 55px;">
                        <img src="https://cdn.jsdelivr.net/gh/djaiss/mapsicon@master/all/mx/vector.svg" alt="México" style="width: 20px; height: 20px; filter: invert(1); margin-bottom:4px;">
                        <span style="font-size:10px; font-weight:bold;">Escala Nacional</span>
                    </button>
                    <button onclick="loadLayer('estatal')" class="scale-btn" id="btn-estatal" title="Escala Estatal (Clústeres)" style="flex-direction: column; padding: 4px; height: 55px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; margin-bottom:4px;"><circle cx="16" cy="16" r="3" fill="currentColor"/><circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="18" cy="8" r="3" fill="currentColor"/><circle cx="8" cy="18" r="3" fill="currentColor"/><path d="M10 10l4 4M16 10l-6 6M10 16l4-4"/></svg>
                        <span style="font-size:10px; font-weight:bold;">Escala Estatal</span>
                    </button>
                    <button onclick="loadLayer('municipio')" class="scale-btn" id="btn-municipio" title="Escala Municipal (AGEB)" style="flex-direction: column; padding: 4px; height: 55px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="width:20px; height:20px; margin-bottom:4px;"><polygon points="12 2 20 8 18 20 6 22 2 10" fill="currentColor" fill-opacity="0.3"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
                        <span style="font-size:10px; font-weight:bold;">Escala Municipal</span>
                    </button>
                </div>
            </div>
        `;
        leftContainer.appendChild(scaleBox);
    }

    if (!document.getElementById('filter-container-box')) {
        var filterBox = document.createElement('div');
        filterBox.id = 'filter-container-box'; filterBox.className = 'dashboard-box';
        filterBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('filter-buttons-container', 'filter-arrow')" title="Ocultar/Mostrar Filtros">
                <span id="filter-title">Filtros</span> <span id="filter-arrow" class="drop-arrow">▼</span>
            </h4>
            <div id="filter-buttons-container" class="dropdown-content show" style="width: 100%;"></div>
        `;
        leftContainer.appendChild(filterBox);
    }

    if (!document.getElementById('legend-overlay')) {
        var legendBox = document.createElement('div');
        legendBox.id = 'legend-overlay'; legendBox.className = 'dashboard-box'; legendBox.style.display = 'none';
        legendBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('legend-content', 'legend-arrow')" title="Ocultar/Mostrar Simbología">
                <span>Simbología</span> <span id="legend-arrow" class="drop-arrow">▼</span>
            </h4>
            <div id="legend-content" class="dropdown-content show"><small style="color:#aaa">Seleccione una escala</small></div>
            <div id="opacity-control" class="dropdown-content show" style="border-top:1px solid rgba(255,255,255,0.1); margin-top:10px; padding-top:10px;">
                <label style="font-size:11px; color:#ddd; font-weight:bold; display:block; margin-bottom:5px; text-transform:uppercase;">Opacidad de Capas</label>
                <input type="range" min="0.0" max="1" step="0.05" value="1" style="width:100%; cursor:pointer; pointer-events:auto;" oninput="actualizarTransparenciaGlobal(this.value)" />
            </div>
        `;
        leftContainer.appendChild(legendBox);
    }

    if (!document.getElementById('marco-legal-box')) {
        // Marco Legal Multiescalar
        var marcoBox = document.createElement('div');
        marcoBox.id = 'marco-legal-box';
        marcoBox.className = 'dashboard-box';
        marcoBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('marco-legal-content', 'marco-arrow')" title="Ocultar/Mostrar">
                <span style="font-size: 13px;">Marco Normativo</span> <span id="marco-arrow" class="drop-arrow" style="transform: rotate(0deg);">▼</span>
            </h4>
            <div id="marco-legal-content" class="dropdown-content show">
                <div class="marco-legal-tree" id="marco-legal-tree">
                    <!-- Se llena dinámicamente -->
                </div>
            </div>
        `;
        leftContainer.appendChild(marcoBox);
    }

    if (!document.getElementById('penta-helix-box')) {
        // Pentágono Multi-Hélice
        var pentaBox = document.createElement('div');
        pentaBox.id = 'penta-helix-box';
        pentaBox.className = 'dashboard-box';
        pentaBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('penta-helix-content', 'penta-arrow')" title="Ocultar/Mostrar">
                <span style="font-size: 13px;">Actores (Penta-Hélice)</span> <span id="penta-arrow" class="drop-arrow" style="transform: rotate(0deg);">▼</span>
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
                    
                    <div class="penta-node node-gov" id="ph-gov" onclick="mostrarModalPenta('gov')"><i>🏛️</i><span class="penta-label">Gobierno</span><div class="penta-tooltip" id="ph-tt-gov">Gobierno</div></div>
                    <div class="penta-node node-aca" id="ph-aca" onclick="mostrarModalPenta('aca')"><i>🎓</i><span class="penta-label">Academia</span><div class="penta-tooltip" id="ph-tt-aca">Academia</div></div>
                    <div class="penta-node node-pri" id="ph-pri" onclick="mostrarModalPenta('pri')"><i>🏢</i><span class="penta-label">S. Privado</span><div class="penta-tooltip" id="ph-tt-pri">S. Privado</div></div>
                    <div class="penta-node node-soc" id="ph-soc" onclick="mostrarModalPenta('soc')"><i>👥</i><span class="penta-label">Soc. Civil</span><div class="penta-tooltip" id="ph-tt-soc">Soc. Civil</div></div>
                    <div class="penta-node node-env" id="ph-env" onclick="mostrarModalPenta('env')"><i>🌱</i><span class="penta-label">Ambiente</span><div class="penta-tooltip" id="ph-tt-env">Ambiente</div></div>
                </div>
            </div>
        `;
        leftContainer.appendChild(pentaBox);
    }

    if (!document.getElementById('stats-overlay')) {
        var statsBox = document.createElement('div');
        statsBox.id = 'stats-overlay'; statsBox.className = 'dashboard-box'; statsBox.style.display = 'none';
        statsBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('stats-content', 'stats-arrow')" title="Ocultar/Mostrar Análisis" style="align-items:center;">
                <span id="stats-title-text">Análisis de Datos</span> <span id="stats-arrow" class="drop-arrow">▼</span>
            </h4>
            <div id="stats-content" class="dropdown-content show">
                <div style="height:240px; position:relative; width: 100%;"><canvas id="myChart"></canvas></div>
                <div id="dynamic-summary" class="dynamic-summary-box"></div>
                
                <!-- GRÁFICAS MUNDIAL/NACIONAL -->
                <div id="empresas-chart-container" style="display:none;">
                    <hr style="border:0; border-top:1px solid #444; margin:12px 0;">
                    <h4 class="panel-title" style="font-size:12px; margin-bottom:8px; text-transform:uppercase;">Top de empresas con mayor rendimiento en activos en millones de pesos</h4>
                    <div style="height:260px; position:relative;"><canvas id="empresasLineChart"></canvas></div>
                    <div id="sintesis-empresasLine" class="dynamic-summary-box" style="margin-top:10px; display:none;"></div>
                </div>

                <!-- GRÁFICAS ESTATAL -->
                <div id="vinculacion-charts-container" style="display:none;">
                    <hr style="border:0; border-top:1px solid #444; margin:12px 0;">
                    <h4 class="panel-title" style="font-size:12px; margin-bottom:8px;">Distribución por Estrato</h4>
                    <div style="height:240px; position:relative;"><canvas id="estratoChart"></canvas></div>
                    <div id="sintesis-estrato" class="dynamic-summary-box" style="margin-top:10px; display:none;"></div>
                    <hr style="border:0; border-top:1px solid #444; margin:12px 0;">
                    <h4 class="panel-title" style="font-size:12px; margin-bottom:8px;">Unidades Económicas por Empresa</h4>
                    <div style="height:400px; position:relative;"><canvas id="empresaChart"></canvas></div>
                    <div id="sintesis-empresa" class="dynamic-summary-box" style="margin-top:10px; display:none;"></div>
                </div>
            </div>
        `;
        leftContainer.appendChild(statsBox);
    }

    // Se ha movido el contenido a leftContainer
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
        htmlLeyes += '<a href="https://www.gob.mx/t-mec" target="_blank" class="legal-card level-mundial">📜 T-MEC<br><small>Tratado entre México, EE.UU. y Canadá</small></a>';
        htmlLeyes += '<a href="https://www.un.org/sustainabledevelopment/es/objetivos-de-desarrollo-sostenible/" target="_blank" class="legal-card level-mundial">🌎 Objetivos de Desarrollo Sostenible<br><small>Agenda 2030 (ONU)</small></a>';

        ttGov.innerHTML = "<b>Gobierno Nacional:</b><br>Secretaría de Relaciones Exteriores, Economía";
        ttAca.innerHTML = "<b>Academia:</b><br>Universidades Nacionales, IIEc UNAM";
        ttPri.innerHTML = "<b>Sector Privado:</b><br>Corporaciones Multinacionales, CONCAMIN";
        ttSoc.innerHTML = "<b>Sociedad Civil:</b><br>ONGs Internacionales";
        ttEnv.innerHTML = "<b>Ambiente:</b><br>Tratados Climáticos Globales";

    } else if (escala === 'nacional') {
        htmlLeyes += '<a href="https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf" target="_blank" class="legal-card level-nacional">⚖️ Constitución Política de los E.U.M.<br><small>Artículos 25, 26, 27 y 115</small></a>';
        htmlLeyes += '<a href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LGAHOTDU_011220.pdf" target="_blank" class="legal-card level-nacional">📘 Ley General de Asentamientos Humanos<br><small>LGAHOTDU</small></a>';
        htmlLeyes += '<a href="https://www.dof.gob.mx/nota_detalle.php?codigo=5643444&fecha=22/02/2022" target="_blank" class="legal-card level-nacional">📗 NOM-001-SEDATU-2021<br><small>Espacios Públicos</small></a>';

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
    }

    marcoTree.innerHTML = htmlLeyes;
}

function showSection(id) {
    document.querySelectorAll('.main-content-panel').forEach(p => p.style.display = 'none');
    var target = document.getElementById(id); if (target) target.style.display = 'block';
    var leftSidebar = document.getElementById('left-sidebar-container');
    if (id === 'inicio') {
        if (leftSidebar) leftSidebar.style.display = 'flex';
        if (map) setTimeout(() => map.invalidateSize(), 200);
    } else {
        if (leftSidebar) leftSidebar.style.display = 'none';
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
            if (content.classList.contains('show')) arrow.style.transform = 'rotate(0deg)';
            else arrow.style.transform = 'rotate(-90deg)';
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
        <div style="margin-bottom:12px; font-weight:bold; color:#ddd; font-size:14px;">Valor (${moneda})</div>
        <div style="width: 100%; padding: 0 5px; box-sizing: border-box;">
            <div style="width: 100%; height: 35px; background: linear-gradient(to right, ${coloresCSS}); clip-path: polygon(0 40%, 100% 0, 100% 100%, 0 60%);"></div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #ccc; font-weight: bold; margin-top: 5px;">
                <span>$${f(valorMinimo)}</span>
                <span>> $${f(valorMaximo)}</span>
            </div>
        </div>
    `;
    div.innerHTML = html;
    overlay.style.display = 'block';
}

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
    if (!cajaFiltros) return;

    var msj = "";
    if (escala === 'mundial') msj = "Comienza seleccionando un <b>Sector</b>.";
    if (escala === 'nacional') msj = "Selecciona un <b>Sector</b> para explorarlo.";
    if (escala === 'estatal') msj = "Selecciona un <b>Clúster Sectorial</b>.";
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

// ==========================================
// GRÁFICA TEMPORAL TOP 5 EMPRESAS (NACIONAL)
// ==========================================
window.empresasCSVDataCache = null;

window.cargarYRenderizarEmpresasCSV = function () {
    var chartContainer = document.getElementById('empresas-chart-container');
    if (chartContainer) chartContainer.style.display = 'block';

    if (window.empresasCSVDataCache) {
        procesarDatosEmpresas(window.empresasCSVDataCache);
    } else {
        fetch('empresas.csv')
            .then(res => res.text())
            .then(csvText => {
                window.empresasCSVDataCache = parsearCSVEmpresas(csvText);
                procesarDatosEmpresas(window.empresasCSVDataCache);
            })
            .catch(err => console.error("Error cargando empresas.csv:", err));
    }
};

window.parsearCSVEmpresas = function (str) {
    var lineas = str.trim().split('\n');
    var resultado = [];
    var headers = lineas[0].split(',');

    for (var i = 1; i < lineas.length; i++) {
        var obj = {};
        var currentline = lineas[i].split(',');
        for (var j = 0; j < headers.length; j++) {
            if (headers[j]) {
                obj[headers[j].trim()] = currentline[j] ? currentline[j].trim() : null;
            }
        }
        resultado.push(obj);
    }
    return resultado;
};

window.procesarDatosEmpresas = function (datos) {
    var ingresosPorEmpresa = {};
    datos.forEach(d => {
        var nombre = d['Empresa'];
        if (!nombre) return;
        var ingreso = parseFloat(d['Ingresos_Millones']) || 0;
        if (!ingresosPorEmpresa[nombre]) ingresosPorEmpresa[nombre] = 0;
        ingresosPorEmpresa[nombre] += ingreso;
    });

    var top5Nombres = Object.keys(ingresosPorEmpresa)
        .sort((a, b) => ingresosPorEmpresa[b] - ingresosPorEmpresa[a])
        .slice(0, 5);

    var aniosSet = new Set();
    datos.forEach(d => { if (d['Año']) aniosSet.add(d['Año']); });
    var anios = Array.from(aniosSet).sort((a, b) => parseInt(a) - parseInt(b));

    var datasetsClasificados = [];
    var coloresLineas = ['#00e5ff', '#ff3366', '#d59f0f', '#00e676', '#d500f9'];

    top5Nombres.forEach((empresaNombre, index) => {
        var dataValues = [];
        anios.forEach(anio => {
            var registro = datos.find(d => d['Empresa'] === empresaNombre && d['Año'] === anio);
            if (registro) {
                dataValues.push(parseFloat(registro['Ingresos_Millones']) || 0);
            } else {
                dataValues.push(null);
            }
        });

        datasetsClasificados.push({
            label: empresaNombre,
            data: dataValues,
            borderColor: coloresLineas[index % coloresLineas.length],
            backgroundColor: coloresLineas[index % coloresLineas.length],
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#222'
        });
    });

    const canvasObj = document.getElementById('empresasLineChart');
    if (!canvasObj) return;
    const ctx = canvasObj.getContext('2d');

    if (window.empresasLineChartInstance) {
        window.empresasLineChartInstance.destroy();
    }

    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    window.empresasLineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: anios,
            datasets: datasetsClasificados
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: '#ccc', font: { size: 10 }, boxWidth: 12 }
                },
                datalabels: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(20,20,20,0.95)',
                    titleColor: '#00e5ff',
                    bodyColor: '#fff',
                    borderColor: '#555',
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += '$' + context.parsed.y.toLocaleString('es-MX') + ' M';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#aaa' }, grid: { color: '#333' } },
                y: {
                    ticks: {
                        color: '#aaa',
                        callback: function (value) { return '$' + value; }
                    },
                    grid: { color: '#333', borderDash: [2, 2] }
                }
            }
        }
    });

    if (top5Nombres.length > 0) {
        var winnerName = top5Nombres[0];
        var winnerRecord = datos.filter(d => d['Empresa'] === winnerName).sort((a, b) => parseFloat(b['Ingresos_Millones']) - parseFloat(a['Ingresos_Millones']))[0];
        var maxWinnerIngreso = window.Intl ? new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(winnerRecord['Ingresos_Millones']) : winnerRecord['Ingresos_Millones'];
        var winnerModel = winnerRecord['Vía de desarrollo'] || "Alta Tecnología";

        var sintesisDiv = document.getElementById('sintesis-empresasLine');
        if (sintesisDiv) {
            sintesisDiv.innerHTML = `El dominio corporativo a escala nacional está encabezado históricamente por <b style="color:#00e5ff;">${winnerName}</b>, alcanzando picos de <b>$${maxWinnerIngreso} Millones</b>. Esto cimienta firmemente la ruta de <span style="text-shadow: 1px 1px 2px #000;">${winnerModel}</span> dentro de la red industrial y de flujos interregionales mostrada en el mapa.`;
            sintesisDiv.style.display = 'block';
        }

        // --- LÓGICA DE ILUMINACIÓN TOP 5 EN EL MAPA ---
        if (typeof window.iluminarTop5Nacional === 'function') {
            window.iluminarTop5Nacional(top5Nombres, coloresLineas);
        }
    }
};

window.nacionalTop5Layer = null;

window.iluminarTop5Nacional = function (top5Nombres, colores) {
    if (window.nacionalTop5Layer) {
        map.removeLayer(window.nacionalTop5Layer);
        window.nacionalTop5Layer = null;
    }

    var normalizar = (str) => {
        if (!str) return "";
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    };

    var top5Norm = top5Nombres.map(n => normalizar(n));

    var cargarLayer = function (data) {
        var top5Features = data.features.filter(f => {
            var n1 = normalizar(f.properties['Nombre de empresa'] || "");
            var n2 = normalizar(f.properties['Razón Social'] || "");
            return top5Norm.some(t => {
                if (t === "AAM MAQUILADORA MEXICO" && (n1.includes("AAM MAQUILADORA") || n2.includes("AAM MAQUILADORA") || n2.includes("METALDYNE"))) return true;
                if (t === "ACTIA DE MEXICO" && (n1.includes("ACTIA") || n2.includes("ACTIA"))) return true;
                return (n1 && n1.includes(t)) || (n2 && n2.includes(t)) || (t && t.includes(n1) && n1.length > 3);
            });
        });

        window.nacionalTop5Layer = L.geoJSON(top5Features, {
            pointToLayer: function (feature, latlng) {
                var n1 = normalizar(feature.properties['Nombre de empresa'] || "");
                var n2 = normalizar(feature.properties['Razón Social'] || "");
                
                var index = top5Norm.findIndex(t => {
                   if (t === "AAM MAQUILADORA MEXICO" && (n1.includes("AAM MAQUILADORA") || n2.includes("AAM MAQUILADORA") || n2.includes("METALDYNE"))) return true;
                   if (t === "ACTIA DE MEXICO" && (n1.includes("ACTIA") || n2.includes("ACTIA"))) return true;
                   return (n1 && n1.includes(t)) || (n2 && n2.includes(t)) || (t && t.includes(n1) && n1.length > 3);
                });
                
                var colorHex = (index !== -1 && colores[index]) ? colores[index] : '#fff';

                var estratoStr = (feature.properties['Estrato'] || '').toString().toLowerCase();
                var size = 4;
                if (estratoStr.includes('0 a 5') || estratoStr.includes('6 a 10')) size = 5;
                if (estratoStr.includes('11 a 30') || estratoStr.includes('31 a 50')) size = 7;
                if (estratoStr.includes('51 a 100') || estratoStr.includes('101 a 250')) size = 10;
                if (estratoStr.includes('251 y más')) size = 14;

                return L.circleMarker(latlng, {
                    radius: size,
                    fillColor: colorHex,
                    color: '#1a1a1a',
                    weight: 1.5,
                    opacity: 1,
                    fillOpacity: 0.9,
                    className: 'top5-marker-pulse'
                });
            },
            onEachFeature: function (feature, layer) {
                var nombre = feature.properties['Nombre de empresa'] || feature.properties['Razón Social'] || 'Unidad Económica';
                var estrato = feature.properties['Estrato'] || 'Desconocido';
                var mpo = feature.properties['Municipio'] || '';
                var ent = feature.properties['Entidad'] || '';
                layer.bindPopup(`<div style="text-align:center;">
                                    <b style="color:#00e5ff; font-size:14px;">${nombre}</b><br>
                                    <span style="font-size:11px; color:#ddd;">Top 5 Nacional</span><br>
                                    <span style="font-size:11px; color:#aaa;">${mpo}, ${ent}</span><br>
                                    <span style="font-size:11px; color:#aaa;">Estrato: ${estrato}</span>
                                 </div>`);
            }
        });

        window.nacionalTop5Layer.addTo(map);
    };

    if (window.denueRawData) {
        cargarLayer(window.denueRawData);
    } else {
        fetch('denue.geojson').then(r => r.json()).then(data => {
            window.denueRawData = data;
            cargarLayer(data);
        }).catch(e => console.error("Error al cargar denue.geojson para el top 5:", e));
    }
};
