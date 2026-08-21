// ============================================================================
// 2. ESCALA NACIONAL (LÓGICA ESPECÍFICA)
// ============================================================================

// Antes vivía hardcodeado aquí; ahora se carga de Tablas/finanzas_federales_2025.json
// (actualizar el dato es editar el JSON, no el código). Se dispara la carga de una vez
// al analizar este script, muy por delante de que el usuario llegue al modo "Finanzas".
var FINANZAS_FEDERALES_2025 = {};
AppData.load('Tablas/finanzas_federales_2025.json').then(function (data) {
    FINANZAS_FEDERALES_2025 = data;
}).catch(function (e) {
    console.error('No se pudo cargar finanzas_federales_2025.json:', e);
});

window.estadosPolygonsGeoJSON = null;

function iniciarFiltroNacional_Paso1(data) {
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";

    var modoWrapper = document.createElement("div");
    modoWrapper.style.marginBottom = "15px";
    modoWrapper.innerHTML = `<small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Tipo de Análisis:</small>`;

    var selectModo = document.createElement("select");
    selectModo.className = "dynamic-filter-select";
    selectModo.innerHTML = `
        <option value="" disabled selected>-- Selección de análisis --</option>
        <option value="flujos">Intercambios (Flujos Industriales)</option>
        <option value="finanzas">Finanzas Públicas (Dependencia Federal)</option>
        <option value="productividad">Índice de crecimiento compuesto (Evolución temporal)</option>
        <option value="censo">Censo Económico 2024</option>
        <option value="financiero">Indicadores Financieros Globales</option>
        <option value="regionalizacion">Regionalización</option>
    `;
    modoWrapper.appendChild(selectModo);

    // Antes "flujos" quedaba implícitamente seleccionado (primer <option> del
    // <select>, sin "selected" explícito) y este contenedor se veía de entrada
    // sin que el usuario hubiera elegido nada — ahora el placeholder de arriba
    // arranca sin ningún tipo activo, así que también debe arrancar oculto.
    var flujosContainer = document.createElement("div");
    flujosContainer.style.display = "none";
    var finanzasContainer = document.createElement("div");
    finanzasContainer.style.display = "none";
    
    var censoContainer = document.createElement("div");
    censoContainer.style.display = "none";

    document.getElementById('filter-title').innerText = "Análisis";

    // --- FLUJOS LOGIC ---
    function obtenerGrupo(subsectorTexto) {
        let sub = (subsectorTexto || "").toUpperCase();
        if (sub.includes("PROCESAMIENTO ELECTRONICO") || sub.includes("PROCESAMIENTO ELECTRÓNICO")) return "SERVICIOS SEIT";
        if (sub.includes("ELÉCTRIC") || sub.includes("ELECTRIC") || sub.includes("335")) return "ELÉCTRICA";
        if (sub.includes("ELECTRÓNIC") || sub.includes("ELECTRONIC") || sub.includes("334")) return "ELECTRÓNICA";
        if (sub.includes("INFORM") || sub.includes("TELECOM") || sub.includes("SEIT") || sub.includes("51")) return "SERVICIOS SEIT";
        return "OTROS";
    }

    var todosLosSubsectores = [...new Set(data.features.map(f => f.properties.SUBSECTO_3 || f.properties.SUBSECTO_2 || ""))];
    var opcionesGrupo = [...new Set(todosLosSubsectores.map(sub => obtenerGrupo(sub)))].filter(g => g !== "OTROS").sort();

    var selectGrupo = document.createElement("select");
    selectGrupo.className = "dynamic-filter-select";
    selectGrupo.innerHTML = `<option value="" disabled selected>-- Grupo Industrial --</option>`;
    opcionesGrupo.forEach(item => { selectGrupo.innerHTML += `<option value="${item}">${item}</option>`; });

    var selectSubsector = document.createElement("select");
    selectSubsector.className = "dynamic-filter-select";
    selectSubsector.style.display = 'none';

    var selectEstado = document.createElement("select");
    selectEstado.className = "dynamic-filter-select";
    selectEstado.style.display = 'none';

    selectGrupo.onchange = function () {
        var grupoSel = this.value;
        var subsectoresDelGrupo = todosLosSubsectores.filter(sub => obtenerGrupo(sub) === grupoSel).sort();
        selectSubsector.innerHTML = `<option value="" disabled selected>-- Subsector --</option>`;
        subsectoresDelGrupo.forEach(item => { selectSubsector.innerHTML += `<option value="${item}">${item}</option>`; });
        selectSubsector.style.display = 'block';
        selectEstado.style.display = 'none';
        if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
    };

    selectSubsector.onchange = function () {
        var estados = [...new Set(data.features.map(f => f.properties.Edo_V))].filter(Boolean).sort();
        selectEstado.innerHTML = `<option value="" disabled selected>-- Entidad Federativa --</option>`;
        estados.forEach(item => { selectEstado.innerHTML += `<option value="${item}">${item}</option>`; });
        selectEstado.style.display = 'block';
        if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
    };

    selectEstado.onchange = function () {
        var subsectorSel = selectSubsector.value;
        var estadoSel = this.value;
        var finalData = data.features.filter(f => (f.properties.SUBSECTO_3 === subsectorSel || f.properties.SUBSECTO_2 === subsectorSel) && f.properties.Edo_V === estadoSel);
        renderizarMapaFlujos(finalData, 'VALOR', 'MDP', 'EDO_C');
        if (typeof window.actualizarModulosDatosDuros === 'function') {
            window.actualizarModulosDatosDuros([], "Estatal", estadoSel);
        }
    };

    var flujosTitle = document.createElement("div");
    flujosTitle.innerHTML = `<small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Parámetros de Intercambio:</small>`;
    flujosContainer.appendChild(flujosTitle);

    flujosContainer.appendChild(selectGrupo);
    flujosContainer.appendChild(selectSubsector);
    flujosContainer.appendChild(selectEstado);

    // --- FINANZAS LOGIC ---
    var finanzasWrapper = document.createElement("div");
    finanzasWrapper.innerHTML = `<small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Fondo Federal (2025):</small>`;

    var selectFinanzas = document.createElement("select");
    selectFinanzas.className = "dynamic-filter-select";
    selectFinanzas.innerHTML = `
        <option value="" disabled selected>-- Seleccione Fondo --</option>
        <option value="R28">Ramo 28 (Participaciones)</option>
        <option value="R33">Ramo 33 (Aportaciones)</option>
        <option value="TOTAL">Total (R28 + R33)</option>
    `;

    selectFinanzas.onchange = function () {
        renderizarMapaFinanzas(this.value);
    };
    finanzasWrapper.appendChild(selectFinanzas);
    finanzasContainer.appendChild(finanzasWrapper);

    // --- PRODUCTIVIDAD LOGIC ---
    var productividadContainer = document.createElement("div");
    productividadContainer.style.display = "none";

    var prodWrapper = document.createElement("div");
    prodWrapper.innerHTML = `<small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Industria:</small>`;

    var selectIndustriaCSV = document.createElement("select");
    selectIndustriaCSV.className = "dynamic-filter-select";
    selectIndustriaCSV.innerHTML = `
        <option value="" disabled selected>-- Seleccione Industria --</option>
        <option value="IC_AUTOMOTRIZ">Automotriz</option>
        <option value="IC_ELECTRICA">Eléctrica</option>
        <option value="IC_ELECTRONICA">Electrónica</option>
        <option value="IC_SEIT">Servicios SEIT</option>
    `;

    var anioWrapper = document.createElement("div");
    anioWrapper.style.marginTop = "10px";
    anioWrapper.innerHTML = `<small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Año de Corte:</small>`;

    var selectAnio = document.createElement("select");
    selectAnio.className = "dynamic-filter-select";
    selectAnio.innerHTML = `
        <option value="2023" selected>2023</option>
        <option value="2018">2018</option>
        <option value="2013">2013</option>
        <option value="2008">2008</option>
        <option value="2003">2003</option>
    `;

    prodWrapper.appendChild(selectIndustriaCSV);
    anioWrapper.appendChild(selectAnio);
    productividadContainer.appendChild(prodWrapper);
    productividadContainer.appendChild(anioWrapper);

    selectIndustriaCSV.onchange = function () {
        if (selectIndustriaCSV.value) renderizarMapaProductividad(selectIndustriaCSV.value, selectAnio.value);
    };
    selectAnio.onchange = function () {
        if (selectIndustriaCSV.value) renderizarMapaProductividad(selectIndustriaCSV.value, selectAnio.value);
    };

    // --- CENSO LOGIC ---
    var censoWrapper = document.createElement("div");
    censoWrapper.innerHTML = `<small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Variable Censal:</small>`;
    var selectCenso = document.createElement("select");
    selectCenso.className = "dynamic-filter-select";
    selectCenso.innerHTML = `
        <option value="A131A Valor agregado censal bruto (millones de pesos)" selected>Valor agregado bruto (MDP)</option>
        <option value="A111A Producción bruta total (millones de pesos)">Producción bruta total (MDP)</option>
        <option value="H001A Personal ocupado total">Personal ocupado total</option>
        <option value="UE Unidades económicas">Unidades económicas</option>
    `;

    var censoAnioWrapper = document.createElement("div");
    censoAnioWrapper.style.marginTop = "10px";
    censoAnioWrapper.innerHTML = `<small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Año Censal:</small>`;
    var selectCensoAnio = document.createElement("select");
    selectCensoAnio.className = "dynamic-filter-select";
    selectCensoAnio.innerHTML = `
        <option value="2023" selected>2023</option>
        <option value="2018">2018</option>
        <option value="2013">2013</option>
        <option value="2008">2008</option>
        <option value="2003">2003</option>
    `;

    selectCenso.onchange = function () {
        renderizarMapaCensoNacional(this.value, selectCensoAnio.value);
    };
    selectCensoAnio.onchange = function () {
        renderizarMapaCensoNacional(selectCenso.value, this.value);
    };
    censoWrapper.appendChild(selectCenso);
    censoAnioWrapper.appendChild(selectCensoAnio);
    censoContainer.appendChild(censoWrapper);
    censoContainer.appendChild(censoAnioWrapper);

    // --- REGIONALIZACIÓN LOGIC ---
    // A diferencia de los demás tipos (que colorean por un valor numérico
    // continuo), aquí la coropleta es CATEGÓRICA: cada entidad se colorea
    // según su "REGION" (carto/Region_nacional_2026.geojson, 32 entidades /
    // 8 regiones). El selector de Región funciona como filtro: "-- Todo el
    // país --" agrega los 15 atributos demográficos/socioeconómicos a nivel
    // nacional; elegir una región los reagrega solo con sus entidades.
    var regionalizacionContainer = document.createElement("div");
    regionalizacionContainer.style.display = "none";

    var regionWrapper = document.createElement("div");
    regionWrapper.innerHTML = `<small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Región:</small>`;
    var selectRegion = document.createElement("select");
    selectRegion.id = "select-region-nacional";
    selectRegion.className = "dynamic-filter-select";
    selectRegion.innerHTML = `<option value="" selected>-- Todo el país (Nacional) --</option>`;
    regionWrapper.appendChild(selectRegion);
    regionalizacionContainer.appendChild(regionWrapper);

    selectRegion.onchange = function () {
        renderizarMapaRegionalizacion(this.value || null, null);
    };

    // --- MODO TOGGLE LOGIC ---
    selectModo.onchange = function () {
        // Limpieza completa de simbología del tipo anterior — antes solo se
        // quitaba currentGeoJSONLayer, pero window.nacionalTop5Layer (los
        // "Nodos Locales" que dibuja Indicadores Financieros Globales) es una
        // capa APARTE que nunca se removía al cambiar de tipo: si se entraba a
        // "financiero" y luego a "censo"/"productividad", los círculos del
        // top-5 de empresas se quedaban pegados sobre la nueva coropleta.
        if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
        if (window.nacionalTop5Layer) { map.removeLayer(window.nacionalTop5Layer); window.nacionalTop5Layer = null; }
        map.eachLayer(l => {
            if (l.options && (l.options.className === 'flujo-animado' || l.options.className === 'etiqueta-destino')) {
                map.removeLayer(l);
            }
        });
        var statsDiv = document.getElementById('stats-overlay');
        if (statsDiv) statsDiv.style.display = 'none';

        // La leyenda (clases, checkboxes de armadoras/nodos locales, etc.) se
        // oculta siempre al cambiar de tipo; cada rama la vuelve a mostrar y
        // reconstruir solo si de verdad tiene algo que representar — evitar
        // esto dejaba la leyenda de un tipo anterior visible aunque ya no
        // correspondiera a nada en el mapa.
        var legendOverlay = document.getElementById('legend-overlay');
        if (legendOverlay) legendOverlay.style.display = 'none';

        // El panel de "Indicadores Financieros Globales" (#fin-overlay,
        // construido en setupUI de escala_global.js) vive fuera de este
        // container — se oculta explícitamente salvo cuando ese tipo está
        // activo, para que no quede pegado al cambiar a otro análisis.
        var finOverlay = document.getElementById('fin-overlay');

        flujosContainer.style.display = this.value === 'flujos' ? 'block' : 'none';
        finanzasContainer.style.display = this.value === 'finanzas' ? 'block' : 'none';
        productividadContainer.style.display = this.value === 'productividad' ? 'block' : 'none';
        censoContainer.style.display = this.value === 'censo' ? 'block' : 'none';
        regionalizacionContainer.style.display = this.value === 'regionalizacion' ? 'block' : 'none';
        if (this.value !== 'financiero' && finOverlay) finOverlay.style.display = 'none';

        document.getElementById('filter-title').innerText = "Análisis";

        if (this.value === 'finanzas') {
            selectFinanzas.value = "";
        } else if (this.value === 'productividad') {
            selectIndustriaCSV.value = "";
        } else if (this.value === 'censo') {
            renderizarMapaCensoNacional(selectCenso.value, selectCensoAnio.value);
        } else if (this.value === 'financiero') {
            if (typeof cargarYRenderizarEmpresasCSV === "function") cargarYRenderizarEmpresasCSV();
        } else if (this.value === 'regionalizacion') {
            selectRegion.value = "";
            if (typeof iniciarRegionalizacion === "function") iniciarRegionalizacion(selectRegion);
        }
    };

    container.appendChild(modoWrapper);
    container.appendChild(flujosContainer);
    container.appendChild(finanzasContainer);
    container.appendChild(productividadContainer);
    container.appendChild(censoContainer);
    container.appendChild(regionalizacionContainer);
}

function renderizarMapaFinanzas(tipo) {
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);

    var filterTitle = document.getElementById('filter-title');
    filterTitle.innerText = "Cargando cartografía...";

    if (!window.estadosPolygonsGeoJSON) {
        AppData.load('https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json')
            .then(geo => {
                window.estadosPolygonsGeoJSON = geo;
                filterTitle.innerText = "Análisis";
                dibujarCoropletaFinanzas(tipo);
            }).catch(e => {
                console.error("No se pudo cargar el geojson de México", e);
                filterTitle.innerText = "Error cargando mapa";
            });
    } else {
        filterTitle.innerText = "Análisis";
        dibujarCoropletaFinanzas(tipo);
    }
}

const ABREVIATURAS_ESTADOS = {
    "Aguascalientes": "Ags.", "Baja California": "B.C.", "Baja California Sur": "B.C.S.",
    "Campeche": "Camp.", "Coahuila": "Coah.", "Colima": "Col.", "Chiapas": "Chis.",
    "Chihuahua": "Chih.", "Ciudad de México": "CDMX", "Durango": "Dgo.",
    "Guanajuato": "Gto.", "Guerrero": "Gro.", "Hidalgo": "Hgo.", "Jalisco": "Jal.",
    "México": "Edomex", "Michoacán": "Mich.", "Morelos": "Mor.", "Nayarit": "Nay.",
    "Nuevo León": "N.L.", "Oaxaca": "Oax.", "Puebla": "Pue.", "Querétaro": "Qro.",
    "Quintana Roo": "Q.R.", "San Luis Potosí": "S.L.P.", "Sinaloa": "Sin.",
    "Sonora": "Son.", "Tabasco": "Tab.", "Tamaulipas": "Tamps.", "Tlaxcala": "Tlax.",
    "Veracruz": "Ver.", "Yucatán": "Yuc.", "Zacatecas": "Zac."
};

function dibujarCoropletaFinanzas(tipo) {
    var valores = [];
    var stateDataMap = {};

    window.estadosPolygonsGeoJSON.features.forEach(f => {
        var estadoReal = normalizarEstadoNombre(f.properties.name || f.properties.ESTADO || f.properties.NOMGEO);
        if (FINANZAS_FEDERALES_2025[estadoReal]) {
            let data = FINANZAS_FEDERALES_2025[estadoReal];
            let val = tipo === 'TOTAL' ? (data.R28 + data.R33) : data[tipo];
            valores.push(val);
            stateDataMap[estadoReal] = val;
        }
    });

    valores.sort((a, b) => a - b);
    var breaks = calcularBreaks(valores);

    var labelsArray = [];

    var layer_geo = L.geoJSON(window.estadosPolygonsGeoJSON, {
        style: function (feature) {
            var estadoReal = normalizarEstadoNombre(feature.properties.name || feature.properties.ESTADO || feature.properties.NOMGEO);
            var val = stateDataMap[estadoReal];
            var color = '#333';
            var opacity = 0.5;
            if (val !== undefined) {
                color = RampaRojos[getClase(val, breaks)] || '#333';
                opacity = 0.8;
            }
            return { fillColor: color, weight: 1, opacity: 1, color: 'white', fillOpacity: opacity };
        },
        onEachFeature: function (feature, layer) {
            var estadoReal = normalizarEstadoNombre(feature.properties.name || feature.properties.ESTADO || feature.properties.NOMGEO);
            if (FINANZAS_FEDERALES_2025[estadoReal]) {
                let data = FINANZAS_FEDERALES_2025[estadoReal];
                let r28Str = data.R28.toLocaleString('es-MX');
                let r33Str = data.R33.toLocaleString('es-MX');
                let totalStr = (data.R28 + data.R33).toLocaleString('es-MX');

                var tooltipContent = `
                    <div style="font-size:12px; font-weight:bold; color:#00e5ff; margin-bottom:5px;">${estadoReal}</div>
                    <div style="font-size:11px; color:#fff;">Participaciones (R28): $${r28Str} MDP</div>
                    <div style="font-size:11px; color:#fff;">Aportaciones (R33): $${r33Str} MDP</div>
                    <div style="font-size:11px; color:#fcae91; font-weight:bold; margin-top:3px;">Total Federal: $${totalStr} MDP</div>
                    <hr style="border-top:1px solid #444; margin:5px 0;">
                    <div style="font-size:10px; font-style:italic; color:#ccc;">Altamente dependiente de recursos federales. Se recomienda captura de valor de suelo municipal.</div>
                `;

                layer.bindTooltip(tooltipContent, {
                    sticky: true,
                    className: 'custom-tooltip'
                });

                layer.on({
                    mouseover: function (e) {
                        var l = e.target;
                        l.setStyle({ weight: 3, color: '#00e5ff' });
                        l.bringToFront();
                    },
                    mouseout: function (e) {
                        layer_geo.resetStyle(e.target);
                    }
                });

                // Añadir etiqueta permanente
                var labelCenter = layer.getBounds().getCenter();
                var nombreAcotado = ABREVIATURAS_ESTADOS[estadoReal] || estadoReal;
                var labelMarker = L.marker(labelCenter, {
                    icon: L.divIcon({
                        className: 'state-label-permanent',
                        html: `<div style="color: #fff; font-size: 10px; font-weight: bold; text-shadow: 1px 1px 2px #000; text-align: center;">${nombreAcotado}</div>`,
                        iconSize: [80, 20]
                    }),
                    interactive: false
                });
                labelsArray.push(labelMarker);
            }
        }
    });

    var labelsGroup = L.featureGroup(labelsArray);
    var combinedGroup = L.featureGroup([layer_geo, labelsGroup]).addTo(map);
    combinedGroup.bringToBack();
    currentGeoJSONLayer = combinedGroup;

    window.finanzasDataMap = stateDataMap; // Guardar para el filtrado
    actualizarLeyendaFinanzas(breaks);
    actualizarGraficaFinanzas(tipo);
}

function actualizarGraficaFinanzas(tipo) {
    if (typeof Chart === 'undefined') return;
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var titulo = document.getElementById('stats-title-text');
    let tipoText = tipo === 'R28' ? 'Ramo 28' : (tipo === 'R33' ? 'Ramo 33' : 'Total de Recursos');
    if (titulo) {
        titulo.innerHTML = `Top 10 Entidades: ${tipoText}<br><small style='color:#aaa; font-size:11px'>Millones de Pesos (MDP) en 2025</small>`;
    }

    var chartTitle = document.getElementById('topGlobalChartTitle');
    if (chartTitle) {
        chartTitle.innerHTML = 'DEPENDENCIAS FEDERALES 2025';
        chartTitle.style.display = 'block';
    }

    var chartContainer = document.getElementById('topGlobalChartContainer');
    if (chartContainer) chartContainer.style.display = 'block';

    var hr = document.getElementById('topGlobalChartHr');
    if (hr) hr.style.display = 'block';

    // Ocultar elementos de flujos
    var summaryDiv = document.getElementById('dynamic-summary-global');
    if (summaryDiv) summaryDiv.style.display = 'none';
    var summaryDiv2 = document.getElementById('dynamic-summary');
    if (summaryDiv2) summaryDiv2.style.display = 'none';
    var chartTitle2 = document.getElementById('myChartTitle');
    if (chartTitle2) chartTitle2.style.display = 'none';
    var chartContainer2 = document.getElementById('myChartContainer');
    if (chartContainer2) chartContainer2.style.display = 'none';

    // Ordenar Top 10
    var statesArr = Object.keys(FINANZAS_FEDERALES_2025).map(k => {
        let d = FINANZAS_FEDERALES_2025[k];
        return { name: k, R28: d.R28, R33: d.R33, TOTAL: d.R28 + d.R33 };
    });

    statesArr.sort((a, b) => b[tipo] - a[tipo]);
    var top10 = statesArr.slice(0, 10);

    const canvas = document.getElementById('topGlobalChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let labels = top10.map(f => f.name);
    let dataR28 = top10.map(f => f.R28);
    let dataR33 = top10.map(f => f.R33);

    if (window.topGlobalChartInstance) {
        window.topGlobalChartInstance.destroy();
    }

    window.topGlobalChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ramo 28',
                    data: dataR28,
                    backgroundColor: '#0277bd',
                    borderWidth: 0
                },
                {
                    label: 'Ramo 33',
                    data: dataR33,
                    backgroundColor: '#de2d26',
                    borderWidth: 0
                }
            ]
        },
        options: {
            indexAxis: 'x',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    ticks: { color: '#ccc', font: { size: 10, weight: 'bold' }, maxRotation: 45, minRotation: 45 },
                    grid: { display: false }
                },
                y: {
                    stacked: true,
                    ticks: { color: '#ccc', font: { size: 10 }, callback: function (value) { return '$' + value.toLocaleString(); } },
                    grid: { color: '#333' }
                }
            },
            plugins: {
                legend: { display: true, labels: { color: '#fff', font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            return ctx.dataset.label + ': $' + ctx.raw.toLocaleString() + ' MDP';
                        }
                    }
                }
            }
        }
    });
}

// ==========================================
// GRÁFICA TEMPORAL TOP 5 EMPRESAS (NACIONAL)
// ==========================================
window.empresasCSVDataCache = null;

window.cambiarIndicadorFinanciero = function () {
    if (window.empresasCSVDataCache) {
        var selector = document.getElementById('fin-indicator-select');
        var indicador = selector ? selector.value : 'Activos_Millones';
        window.procesarDatosEmpresas(window.empresasCSVDataCache, indicador);
    }
};

window.cargarYRenderizarEmpresasCSV = function () {
    var chartContainer = document.getElementById('empresas-chart-container');
    if (chartContainer) chartContainer.style.display = 'block';

    var finOverlay = document.getElementById('fin-overlay');
    if (finOverlay) finOverlay.style.display = 'block';

    AppData.load('Tablas/empresas.csv')
        .then(csvText => {
            window.empresasCSVDataCache = window.empresasCSVDataCache || parsearCSVEmpresas(csvText);
            window.cambiarIndicadorFinanciero();
            window.mostrarInstruccionIndicador();
        })
        .catch(err => console.error("Error cargando empresas.csv:", err));
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

window.procesarDatosEmpresas = function (dataRows, indicador = 'Activos_Millones') {
    var selector = document.getElementById('fin-indicator-select');
    var indicadorText = selector && selector.options[selector.selectedIndex] ? selector.options[selector.selectedIndex].text : indicador;

    var titleEl = document.getElementById('empresas-chart-title');
    if (titleEl) {
        titleEl.innerHTML = `Top de empresas por: ${indicadorText}`;
    }

    var valoresPorEmpresa = {};
    dataRows.forEach(d => {
        var nombre = d['Empresa'];
        if (!nombre) return;
        var valor = parseFloat(d[indicador]) || 0;
        if (!valoresPorEmpresa[nombre]) valoresPorEmpresa[nombre] = 0;
        valoresPorEmpresa[nombre] += valor;
    });

    var top5Nombres = Object.keys(valoresPorEmpresa)
        .sort((a, b) => valoresPorEmpresa[b] - valoresPorEmpresa[a])
        .slice(0, 5);

    var aniosSet = new Set();
    dataRows.forEach(d => { if (d['Año']) aniosSet.add(d['Año']); });
    var anios = Array.from(aniosSet).sort((a, b) => parseInt(a) - parseInt(b));

    var datasetsClasificados = [];
    var coloresLineas = ['#00e5ff', '#ff3366', '#d59f0f', '#00e676', '#d500f9'];

    top5Nombres.forEach((empresaNombre, index) => {
        var dataValues = [];
        anios.forEach(anio => {
            var registro = dataRows.find(d => d['Empresa'] === empresaNombre && d['Año'] === anio);
            if (registro) {
                dataValues.push(parseFloat(registro[indicador]) || 0);
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
                                let valString = context.parsed.y.toLocaleString('es-MX', { maximumFractionDigits: 2 });
                                label += indicador.includes('%') || indicador === 'ROE' || indicador === 'Rotación_Activos' || indicador === 'Multiplicador_Capital' || indicador === 'Empleados' ? valString : '$' + valString;
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
                        callback: function (value) { return indicador.includes('%') || indicador === 'ROE' || indicador === 'Rotación_Activos' || indicador === 'Multiplicador_Capital' || indicador === 'Empleados' ? value : '$' + value; }
                    },
                    grid: { color: '#333', borderDash: [2, 2] }
                }
            }
        }
    });

    if (top5Nombres.length > 0) {
        var winnerName = top5Nombres[0];
        var winnerRecord = dataRows.filter(d => d['Empresa'] === winnerName).sort((a, b) => (parseFloat(b[indicador]) || 0) - (parseFloat(a[indicador]) || 0))[0];
        var maxWinnerValRaw = parseFloat(winnerRecord[indicador]) || 0;
        var maxWinnerVal = window.Intl ? new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(maxWinnerValRaw) : maxWinnerValRaw;

        var isPercentage = indicador.includes('%') || indicador === 'ROE' || indicador === 'Rotación_Activos' || indicador === 'Multiplicador_Capital' || indicador === 'Empleados';
        var valDisplay = isPercentage ? `${maxWinnerVal}` : `$${maxWinnerVal}`;

        var winnerModel = winnerRecord['Vía de desarrollo'] || "Alta Tecnología";
        var winnerInd = winnerRecord['Industria'] || "su sector";
        var descInd = "";
        if (winnerInd === "OEM") descInd = " (Fabricante de Equipos Originales / Ensambladora)";
        else if (winnerInd === "My/oS electrónicos") descInd = " (Micro y Opto Semiconductores)";
        else if (winnerInd === "Autopartes") descInd = " (Componentes Automotrices)";
        else if (winnerInd === "Autopartes electrónicas") descInd = " (Componentes Electrónicos Automotrices)";
        else if (winnerInd === "Semiconductores") descInd = " (Microchips y Circuitos Integrados)";

        var sintesisDiv = document.getElementById('sintesis-empresasLine');
        if (sintesisDiv) {
            sintesisDiv.innerHTML = `Liderando en la industria de <b>${winnerInd}</b><span style="font-size: 0.95em; color: #ccc;">${descInd}</span>, la empresa <b style="color:#00e5ff;">${winnerName}</b> encabeza la métrica de <b>${indicadorText}</b> con un valor destacado de <b>${valDisplay}</b>. Esto fortalece su position bajo la ruta de <span style="text-shadow: 1px 1px 2px #000; color:#fff; font-weight:bold;">${winnerModel}</span> dentro de los nodos industriales geolocalizados.`;
            sintesisDiv.style.display = 'block';
        }

        if (typeof window.iluminarTop5Nacional === 'function') {
            window.iluminarTop5Nacional(top5Nombres, coloresLineas);
        }
    }
};

window.top5NombresCache = null;
window.coloresLineasCache = null;

// Control independiente de las armadoras (triángulos) a escala Nacional —
// antes no tenían ningún control de prender/apagar ni de opacidad.
window.currentArmadorasOpacityNacional = 1;
window.actualizarVisibilidadArmadorasNacional = function () {
    var chk = document.getElementById('chk-armadoras-nacional');
    var visible = chk ? chk.checked : true;
    var op = visible ? (window.currentArmadorasOpacityNacional !== undefined ? parseFloat(window.currentArmadorasOpacityNacional) : 1) : 0;
    if (window.armadorasNacionalTriangulosLayer) {
        window.armadorasNacionalTriangulosLayer.eachLayer(function (l) {
            if (l.setOpacity) l.setOpacity(op);
        });
    }
};

// Control independiente de los "Nodos Locales" (top 5 empresas) — antes
// solo la gráfica/leyenda reaccionaba al indicador financiero elegido, sin
// forma de ocultar los puntos del mapa si no se querían ver.
window.actualizarVisibilidadNodosTop5 = function () {
    var chk = document.getElementById('chk-nodos-top5');
    var visible = chk ? chk.checked : true;
    if (window.nacionalTop5Layer) {
        window.nacionalTop5Layer.eachLayer(function (l) {
            if (l.setStyle) l.setStyle({ opacity: visible ? 1 : 0, fillOpacity: visible ? 0.9 : 0 });
        });
    }
};

window.actualizarLeyendaNodosNacionales = function (top5Nombres, colores) {
    if (currentScaleType !== 'nacional') return;

    window.top5NombresCache = top5Nombres;
    window.coloresLineasCache = colores;

    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content');
    if (!div || !overlay) return;

    var divNodos = document.getElementById('legend-nodos-locales');
    if (!divNodos) {
        var ext = document.getElementById('legend-flujos');
        if (!ext) {
            div.innerHTML = `<div id="legend-flujos" style="display:none;"></div><div id="legend-nodos-locales" style="margin-top:5px; padding-top:5px;"></div>`;
        } else {
            div.innerHTML += `<div id="legend-nodos-locales" style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;"></div>`;
        }
        divNodos = document.getElementById('legend-nodos-locales');
    }

    if (!divNodos) return;

    var htmlItems = '';
    if (top5Nombres && top5Nombres.length > 0) {
        top5Nombres.forEach((nombre, index) => {
            var color = colores[index] || '#fff';
            htmlItems += `
                <div style="display:flex; align-items:center; margin-bottom:5px;">
                    <div style="width:16px; height:16px; margin-right:8px; display:flex; justify-content:center; align-items:center;">
                        <div style="width:10px; height:10px; background:${color}; border-radius:50%; border:1px solid #1a1a1a; box-shadow: 0 0 5px ${color};"></div>
                    </div>
                    <span style="font-size:11px; color:#ddd;" title="${nombre}">${nombre.length > 30 ? nombre.substring(0, 30) + '...' : nombre}</span>
                </div>
            `;
        });
    }

    divNodos.innerHTML = `
        <div style="margin-bottom: 8px; font-weight:bold; color:#00e5ff; font-size:12px; text-transform:uppercase;">Nodos Locales</div>
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
            <input type="checkbox" id="chk-armadoras-nacional" checked onchange="if(window.actualizarVisibilidadArmadorasNacional) window.actualizarVisibilidadArmadorasNacional();">
            <svg width="20" height="20" viewBox="0 0 24 24">
                <polygon points="12,2 22,22 2,22" fill="#00e5ff" stroke="#fff" stroke-width="2"/>
            </svg>
            <span style="font-size:11px; color:#ccc;">Planta Armadora Automotriz</span>
        </div>
        <div style="margin-bottom:10px; display:flex; align-items:center; justify-content:space-between;">
            <span style="font-size:10px; color:#888;">Opacidad:</span>
            <input type="range" min="0" max="1" step="0.1" value="1" style="width:55%; cursor:pointer;"
                oninput="window.currentArmadorasOpacityNacional = this.value; if(window.actualizarVisibilidadArmadorasNacional) window.actualizarVisibilidadArmadorasNacional();">
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin-bottom: 6px;">
            <input type="checkbox" id="chk-nodos-top5" checked onchange="if(window.actualizarVisibilidadNodosTop5) window.actualizarVisibilidadNodosTop5();">
            <span style="font-weight:bold; color:#aaa; font-size:10px; text-transform:uppercase;">Mayor Rendimiento (Top 5)</span>
        </div>
        ${htmlItems}
    `;

    divNodos.style.display = 'block';
    overlay.style.display = 'block';
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
        window.actualizarLeyendaNodosNacionales(top5Nombres, colores);
    };

    AppData.load('carto/denue.geojson').then(data => {
        window.denueRawData = data;
        cargarLayer(data);
    }).catch(e => console.error("Error al cargar denue.geojson para el top 5:", e));
};

window.productDataActual = {};
window.industriaActual = '';

function renderizarMapaProductividad(industria, anio) {
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);

    var filterTitle = document.getElementById('filter-title');
    filterTitle.innerText = "Cargando datos CSV...";

    var filename = 'Tablas/' + industria + '.csv';

    AppData.load(filename)
        .then(csvText => {
            var rows = csvText.split('\n');
            var headers = rows[0].split(',');
            var anioIdx = headers.findIndex(h => h.trim() === anio);

            if (anioIdx === -1) {
                alert("Año " + anio + " no encontrado en el archivo " + filename);
                return;
            }

            var productData = {};
            for (var i = 1; i < rows.length; i++) {
                if (!rows[i].trim()) continue;
                var rawCols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                var cols = rawCols.map(c => {
                    let cleaned = c.trim();
                    if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
                    return cleaned.replace(',', '.');
                });
                var estado = normalizarEstadoNombre(cols[0]);
                var val = parseFloat(cols[anioIdx]);

                var historial = {};
                headers.forEach((h, idx) => {
                    if (idx > 0 && h.trim() && cols[idx] !== undefined) {
                        historial[h.trim()] = parseFloat(cols[idx]);
                    }
                });

                productData[estado] = {
                    valor: val,
                    historial: historial
                };
            }

            window.productDataActual = productData;
            window.industriaActual = industria;

            if (!window.estadosPolygonsGeoJSON) {
                AppData.load('https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json')
                    .then(geo => {
                        window.estadosPolygonsGeoJSON = geo;
                        dibujarCoropletaProductividad(anio);
                    }).catch(e => {
                        console.error(e);
                        filterTitle.innerText = "Error cargando mapa";
                    });
            } else {
                dibujarCoropletaProductividad(anio);
            }
        })
        .catch(err => {
            console.error(err);
            filterTitle.innerText = "Error: " + err.message;
        });
}

function dibujarCoropletaProductividad(anio) {
    var valores = [];
    var productData = window.productDataActual;

    window.estadosPolygonsGeoJSON.features.forEach(f => {
        var estadoReal = normalizarEstadoNombre(
            f.properties.name ||
            f.properties.ESTADO ||
            f.properties.NOMGEO
        );

        if (productData[estadoReal] && !isNaN(productData[estadoReal].valor)) {
            valores.push(productData[estadoReal].valor);
        }
    });

    valores.sort((a, b) => a - b);
    var breaks = calcularBreaks(valores);

    var labelsArray = [];

    var layer_geo = L.geoJSON(window.estadosPolygonsGeoJSON, {
        style: function (feature) {
            var estadoReal = normalizarEstadoNombre(
                feature.properties.name ||
                feature.properties.ESTADO ||
                feature.properties.NOMGEO
            );

            var color = '#333';
            var opacity = 0.5;

            if (productData[estadoReal] && !isNaN(productData[estadoReal].valor)) {
                color = RampaRojos[getClase(productData[estadoReal].valor, breaks)] || '#333';
                opacity = 0.8;
            }

            return {
                fillColor: color,
                weight: 1,
                opacity: 1,
                color: window.limiteBoundaryColor || 'white',
                fillOpacity: opacity
            };
        },
        onEachFeature: function (feature, layer) {
            var estadoReal = normalizarEstadoNombre(
                feature.properties.name ||
                feature.properties.ESTADO ||
                feature.properties.NOMGEO
            );

            if (productData[estadoReal] && !isNaN(productData[estadoReal].valor)) {
                var valStr = productData[estadoReal].valor.toFixed(4);

                var tooltipContent = `
                    <div style="font-size:12px; font-weight:bold; color:#00e5ff; margin-bottom:5px;">
                        ${estadoReal}
                    </div>
                    <div style="font-size:11px; color:#fff;">
                        Índice Productividad (${anio}): ${valStr}
                    </div>
                `;

                layer.bindTooltip(tooltipContent, {
                    sticky: true,
                    className: 'custom-tooltip'
                });

                layer.on({
                    mouseover: function (e) {
                        e.target.setStyle({ weight: 3, color: '#00e5ff' });
                        e.target.bringToFront();
                    },
                    mouseout: function (e) {
                        layer_geo.resetStyle(e.target);
                    },
                    click: function (e) {
                        dibujarGraficaEvolucion([estadoReal], anio);
                    }
                });
            }
        }
    });

    layer_geo.eachLayer(function (layer) {
        var estadoReal = normalizarEstadoNombre(
            layer.feature.properties.name ||
            layer.feature.properties.ESTADO ||
            layer.feature.properties.NOMGEO
        );

        var labelCenter = layer.getBounds().getCenter();
        var nombreAcotado = ABREVIATURAS_ESTADOS[estadoReal] || estadoReal;

        var labelMarker = L.marker(labelCenter, {
            icon: L.divIcon({
                className: 'state-label-permanent',
                html: `<div style="color: #fff; font-size: 10px; font-weight: bold; text-shadow: 1px 1px 2px #000; text-align: center;">
                        ${nombreAcotado}
                       </div>`,
                iconSize: [80, 20]
            }),
            interactive: false
        });

        labelsArray.push(labelMarker);
    });

    var labelsGroup = L.featureGroup(labelsArray);
    var combinedGroup = L.featureGroup([layer_geo, labelsGroup]).addTo(map);

    combinedGroup.bringToBack();
    currentGeoJSONLayer = combinedGroup;

    document.getElementById('filter-title').innerText = "Análisis";

    actualizarLeyendaProductividad(breaks);

    var top5 = Object.keys(productData)
        .filter(k => !isNaN(productData[k].valor))
        .sort((a, b) => productData[b].valor - productData[a].valor)
        .slice(0, 5);

    dibujarGraficaEvolucion(top5, anio);
}

// Antes el cuadro de texto afirmaba que el estado con el valor más alto en
// el AÑO CLICADO había "liderado" y sido "resiliente" a lo largo de TODO el
// periodo, sin comprobar nada de eso contra la propia serie de datos — una
// interpretación editorializada, no respaldada por los números. Esta
// función solo describe lo que la serie realmente muestra: en cuántos años
// esa entidad tuvo de hecho el valor más alto a nivel nacional (no solo el
// año seleccionado), y cómo cambió su valor entre el primer y el último año
// disponible, sin adjetivos de "competitividad"/"eficiencia" no verificables.
function _generarInterpretacionObjetiva(dataSource, estadosSeleccionados, labels, indNombreHtml) {
    if (!estadosSeleccionados || !estadosSeleccionados.length || !labels || !labels.length) return "";
    var lider = estadosSeleccionados[0];
    if (!dataSource || !dataSource[lider]) return "";

    // Serie propia del líder (solo años con dato numérico válido)
    var serieLider = labels
        .map(function (a) { return { anio: a, val: dataSource[lider].historial ? dataSource[lider].historial[a] : undefined }; })
        .filter(function (p) { return typeof p.val === 'number' && !isNaN(p.val); });

    // ¿En cuántos años de la serie esta entidad tuvo REALMENTE el valor más
    // alto a nivel nacional (no solo en el año que el usuario clicó)?
    var aniosLider = 0;
    labels.forEach(function (anio) {
        var maxVal = -Infinity, maxEdo = null;
        Object.keys(dataSource).forEach(function (edo) {
            var v = dataSource[edo] && dataSource[edo].historial ? dataSource[edo].historial[anio] : undefined;
            if (typeof v === 'number' && !isNaN(v) && v > maxVal) { maxVal = v; maxEdo = edo; }
        });
        if (maxEdo === lider) aniosLider++;
    });

    var fraseLiderazgo;
    if (aniosLider === labels.length) {
        fraseLiderazgo = 'mantuvo el valor más alto del país en ' + indNombreHtml + ' durante los ' + labels.length + ' años de la serie (' + labels[0] + '-' + labels[labels.length - 1] + ')';
    } else if (aniosLider >= labels.length / 2) {
        fraseLiderazgo = 'concentró el valor más alto del país en ' + indNombreHtml + ' en ' + aniosLider + ' de los ' + labels.length + ' años de la serie, aunque no de forma ininterrumpida';
    } else if (aniosLider > 1) {
        fraseLiderazgo = 'solo encabezó la lista nacional en ' + aniosLider + ' de los ' + labels.length + ' años de la serie en ' + indNombreHtml + ' — su posición como líder no es constante';
    } else {
        fraseLiderazgo = 'encabeza la lista en ' + indNombreHtml + ' únicamente en el año seleccionado; en el resto de la serie (' + (labels.length - aniosLider) + ' de ' + labels.length + ' años) el mayor valor nacional correspondió a otra entidad';
    }

    var fraseTendencia = "";
    if (serieLider.length >= 2) {
        var primerVal = serieLider[0].val;
        var ultimoVal = serieLider[serieLider.length - 1].val;
        if (primerVal !== 0) {
            var cambioPct = ((ultimoVal - primerVal) / Math.abs(primerVal)) * 100;
            if (Math.abs(cambioPct) < 5) {
                fraseTendencia = ' Entre ' + serieLider[0].anio + ' y ' + serieLider[serieLider.length - 1].anio + ' su valor se mantuvo prácticamente sin cambio (' + (cambioPct >= 0 ? '+' : '') + cambioPct.toFixed(1) + '%), por lo que no puede hablarse de una tendencia de crecimiento sostenido.';
            } else if (cambioPct > 0) {
                fraseTendencia = ' Entre ' + serieLider[0].anio + ' y ' + serieLider[serieLider.length - 1].anio + ' su valor aumentó ' + cambioPct.toFixed(1) + '%.';
            } else {
                fraseTendencia = ' Entre ' + serieLider[0].anio + ' y ' + serieLider[serieLider.length - 1].anio + ' su valor disminuyó ' + Math.abs(cambioPct).toFixed(1) + '%, pese a conservar el primer lugar en el año seleccionado.';
            }
        }
    }

    return '<b style="color:#00e5ff;">' + lider + '</b> ' + fraseLiderazgo + '.' + fraseTendencia;
}

function dibujarGraficaEvolucion(estadosSeleccionados, anioDestacado) {
    if (typeof Chart === 'undefined') return;

    // Módulos de datos duros: se refinan con la entidad líder del año
    // clicado (misma que encabeza la gráfica de evolución).
    if (estadosSeleccionados.length > 0 && typeof window.actualizarModulosDatosDuros === 'function') {
        window.actualizarModulosDatosDuros([], "Estatal", estadosSeleccionados[0]);
    }

    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var statsContent = document.getElementById('stats-content');
    if (statsContent && !statsContent.classList.contains('show')) {
        statsContent.classList.add('show');
    }

    var chartContainer = document.getElementById('topGlobalChartContainer');
    if (chartContainer) chartContainer.style.display = 'block';

    var indFriendly = "SECTOR";
    if (window.industriaActual === "IC_AUTOMOTRIZ") indFriendly = "AUTOMOTRIZ";
    else if (window.industriaActual === "IC_ELECTRICA") indFriendly = "ELÉCTRICA";
    else if (window.industriaActual === "IC_ELECTRONICA") indFriendly = "ELECTRÓNICA";
    else if (window.industriaActual === "IC_SEIT") indFriendly = "SERVICIOS SEIT";

    var chartTitle = document.getElementById('topGlobalChartTitle');
    if (chartTitle) {
        chartTitle.innerHTML = 'EVOLUCIÓN TEMPORAL: CRECIMIENTO EN ' + indFriendly;
        chartTitle.style.display = 'block';
    }

    var hr = document.getElementById('topGlobalChartHr');
    if (hr) hr.style.display = 'block';

    var canvas = document.getElementById('topGlobalChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    if (window.topGlobalChartInstance) {
        window.topGlobalChartInstance.destroy();
    }

    var labelsSet = new Set();
    estadosSeleccionados.forEach(edo => {
        if (window.productDataActual[edo] && window.productDataActual[edo].historial) {
            Object.keys(window.productDataActual[edo].historial).forEach(anio => labelsSet.add(anio));
        }
    });

    var labels = Array.from(labelsSet).sort((a, b) => parseInt(a) - parseInt(b));

    var colores = ['#00e5ff', '#ff3366', '#d59f0f', '#00e676', '#d500f9'];
    var datasets = [];

    estadosSeleccionados.forEach((edo, index) => {
        var dataValues = [];
        labels.forEach(anio => {
            var val = window.productDataActual[edo]?.historial[anio];
            dataValues.push(val !== undefined ? val : null);
        });

        datasets.push({
            label: edo,
            data: dataValues,
            borderColor: colores[index % colores.length],
            backgroundColor: colores[index % colores.length],
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#222'
        });
    });

    window.topGlobalChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
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
                                label += context.parsed.y.toLocaleString('es-MX', { maximumFractionDigits: 4 });
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
                        callback: function (value) { return value.toLocaleString('es-MX', { maximumFractionDigits: 4 }); }
                    },
                    grid: { color: '#333', borderDash: [2, 2] }
                }
            }
        }
    });

    var summaryDiv = document.getElementById('dynamic-summary-global');
    if (summaryDiv && estadosSeleccionados.length > 0) {
        var indNombre = "la industria seleccionada";
        if (window.industriaActual === "IC_AUTOMOTRIZ") indNombre = "la industria automotriz";
        else if (window.industriaActual === "IC_ELECTRICA") indNombre = "la industria eléctrica";
        else if (window.industriaActual === "IC_ELECTRONICA") indNombre = "la industria electrónica";
        else if (window.industriaActual === "IC_SEIT") indNombre = "los servicios SEIT";
        
        var texto = _generarInterpretacionObjetiva(window.productDataActual, estadosSeleccionados, labels, '<b style="color:#fcae91;">' + indNombre + '</b>');

        summaryDiv.innerHTML = texto;
        summaryDiv.style.display = 'block';
    }
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

function actualizarLeyendaProductividad(breaks) {
    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content');
    if (!div || !overlay) return;

    window.breaksProductividadActual = breaks;
    window.claseProductividadSeleccionada = null;

    var f = (n) => (n || 0).toLocaleString('es-MX', { maximumFractionDigits: 4 });
    var colores = RampaRojos;

    var html = `
        <div id="legend-flujos">
            <div style="margin-bottom:12px; font-weight:bold; color:#ddd; font-size:14px; text-transform:uppercase;">CLASES</div>
            <div style="font-size:11px; color:#aaa; margin-bottom:10px;">Selecciona un cuadrante para filtrar entidades</div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 4px; margin-top: 5px;">
    `;

    var conteos = [0, 0, 0, 0, 0];
    if (window.productDataActual) {
        Object.keys(window.productDataActual).forEach(estado => {
            var pd = window.productDataActual[estado];
            if (pd && !isNaN(pd.valor)) {
                conteos[getClase(pd.valor, breaks)]++;
            }
        });
    }

    var rangos = [
        `Menor o igual a ${f(breaks[0])}`,
        `${f(breaks[0])} - ${f(breaks[1])}`,
        `${f(breaks[1])} - ${f(breaks[2])}`,
        `${f(breaks[2])} - ${f(breaks[3])}`,
        `Mayor a ${f(breaks[3])}`
    ];

    for (let i = 0; i < 5; i++) {
        html += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                <div class="legend-box" data-class="${i}" 
                     style="background: ${colores[i]}; width: 100%; height: 25px; cursor: pointer; border: 1px solid #1a1a1a; transition: all 0.2s ease; border-radius: 2px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; color:#fff; text-shadow:1px 1px 2px #000;" 
                     onclick="filtrarMapaProductividad(${i})" title="${rangos[i]}">${conteos[i]}</div>
                <div style="font-size: 9px; color: #ccc; margin-top: 4px; text-align: center;">Clase ${i + 1}</div>
            </div>
        `;
    }

    html += `
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #ccc; font-weight: bold; margin-top: 5px;">
                <span>Min</span>
                <span>Max</span>
            </div>
            <div id="leyenda-sintesis" style="margin-top:10px; font-size:11px; color:#00e5ff; font-style:italic; text-align: justify;">Selecciona una clase para ver su interpretación espacial.</div>
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

window.filtrarMapaProductividad = function (clase) {
    if (window.claseProductividadSeleccionada === clase) {
        window.claseProductividadSeleccionada = null;
    } else {
        window.claseProductividadSeleccionada = clase;
    }

    var sintesisEl = document.getElementById('leyenda-sintesis');
    if (window.claseProductividadSeleccionada === null) {
        if(sintesisEl) sintesisEl.innerHTML = "Selecciona una clase para ver su interpretación espacial.";
    } else {
        if(sintesisEl) sintesisEl.innerHTML = window.sintesisProductividad[window.claseProductividadSeleccionada];
    }

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

function actualizarLeyendaFinanzas(breaks) {
    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content');
    if (!div || !overlay) return;

    window.breaksFinanzasActual = breaks;
    window.claseFinanzasSeleccionada = null;

    var f = (n) => "$" + (n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 }) + " MDP";
    var colores = RampaRojos;

    var html = `
        <div id="legend-flujos">
            <div style="margin-bottom:12px; font-weight:bold; color:#ddd; font-size:14px; text-transform:uppercase;">CLASES (FINANZAS)</div>
            <div style="font-size:11px; color:#aaa; margin-bottom:10px;">Selecciona un cuadrante para filtrar entidades</div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 4px; margin-top: 5px;">
    `;

    var conteos = [0, 0, 0, 0, 0];
    if (window.finanzasDataMap) {
        Object.keys(window.finanzasDataMap).forEach(estado => {
            var val = window.finanzasDataMap[estado];
            if (val !== undefined && !isNaN(val)) {
                conteos[getClase(val, breaks)]++;
            }
        });
    }

    var rangos = [
        `Menor o igual a ${f(breaks[0])}`,
        `${f(breaks[0])} - ${f(breaks[1])}`,
        `${f(breaks[1])} - ${f(breaks[2])}`,
        `${f(breaks[2])} - ${f(breaks[3])}`,
        `Mayor a ${f(breaks[3])}`
    ];

    for (let i = 0; i < 5; i++) {
        html += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                <div class="legend-box-fin" data-class="${i}" 
                     style="background: ${colores[i]}; width: 100%; height: 25px; cursor: pointer; border: 1px solid #1a1a1a; transition: all 0.2s ease; border-radius: 2px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; color:#fff; text-shadow:1px 1px 2px #000;" 
                     onclick="filtrarMapaFinanzas(${i})" title="${rangos[i]}">${conteos[i]}</div>
                <div style="font-size: 9px; color: #ccc; margin-top: 4px; text-align: center;">Clase ${i + 1}</div>
            </div>
        `;
    }

    html += `
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #ccc; font-weight: bold; margin-top: 5px;">
                <span>Min</span>
                <span>Max</span>
            </div>
            <div id="leyenda-sintesis-fin" style="margin-top:10px; font-size:11px; color:#fcae91; font-style:italic; text-align: justify;">Selecciona una clase para ver su interpretación espacial.</div>
        </div>
        <div id="legend-nodos-locales" style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px; display:none;"></div>
    `;

    div.innerHTML = html;
    overlay.style.display = 'block';
}

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

window._censoDataGlobal = null;

// Etiquetas amigables por variable censal (las llaves son los encabezados
// reales del CSV, usados tal cual como <option value="..."> del selector).
var CENSO_VARIABLE_LABELS = {
    'UE Unidades económicas': 'Unidades Económicas',
    'H001A Personal ocupado total': 'Personal Ocupado Total',
    'A111A Producción bruta total (millones de pesos)': 'Producción Bruta Total (MDP)',
    'A131A Valor agregado censal bruto (millones de pesos)': 'Valor Agregado Censal Bruto (MDP)'
};
var CENSO_VARIABLES_TODAS = Object.keys(CENSO_VARIABLE_LABELS);

// Parser CSV con soporte de comillas (algunas "Actividad económica" traen
// comas dentro de comillas) y saltos de línea reales (\r\n en el archivo
// fuente) — antes se hacía split('\\n') (dos caracteres literales, no un
// salto de línea real), lo que dejaba todo el CSV en una sola "línea" y
// nunca producía filas: por eso el mapa nunca se iluminaba.
function _parsearCSVCenso(csvText) {
    var lines = csvText.split(/\r?\n/);
    var headers = lines[0].split(',').map(function (h) { return h.trim(); });
    var parsed = [];
    for (var i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        var inQuote = false, cols = [], current = '';
        var linea = lines[i];
        for (var c = 0; c < linea.length; c++) {
            var ch = linea[c];
            if (ch === '"') inQuote = !inQuote;
            else if (ch === ',' && !inQuote) { cols.push(current.trim()); current = ''; }
            else current += ch;
        }
        cols.push(current.trim());
        var obj = {};
        headers.forEach(function (h, idx) { obj[h] = cols[idx]; });
        parsed.push(obj);
    }
    return parsed;
}

// Agrega el CSV (que trae una fila por Entidad+Año+Actividad económica) en
// {estadoReal: {anio: {variable: valorSumado}}}, sumando todas las
// actividades económicas del sector (Electrónica/SEIT/Telecom/Medios) para
// cada entidad y año.
function _construirCensoAgregado(csvData) {
    var agregado = {};
    csvData.forEach(function (d) {
        var entRaw = d['Entidad'];
        if (!entRaw || entRaw.indexOf('Total Nacional') !== -1 || entRaw.indexOf('No distribuible') !== -1) return;
        var anioRow = (d['Año Censal'] || '').trim();
        if (!anioRow) return;

        // El código antes usaba /^\\d+\\s*/ (regex que busca un BACKSLASH
        // literal seguido de "d", no dígitos) y nunca quitaba el prefijo
        // "01 ", "02 ", etc. — dejando nombres de estado corruptos que no
        // hacían match contra el geojson. Aquí sí es \d (clase de dígito).
        var entLimpia = entRaw.replace(/^\d+\s*/, '').trim();
        var estadoReal = normalizarEstadoNombre(entLimpia);

        if (!agregado[estadoReal]) agregado[estadoReal] = {};
        if (!agregado[estadoReal][anioRow]) {
            agregado[estadoReal][anioRow] = {};
            CENSO_VARIABLES_TODAS.forEach(function (v) { agregado[estadoReal][anioRow][v] = 0; });
        }
        CENSO_VARIABLES_TODAS.forEach(function (v) {
            var raw = d[v] || '0';
            var val = parseFloat(raw.replace(/,/g, '')) || 0;
            agregado[estadoReal][anioRow][v] += val;
        });
    });
    return agregado;
}

function renderizarMapaCensoNacional(variable, anio) {
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);

    var filterTitle = document.getElementById('filter-title');
    filterTitle.innerText = "Cargando datos del Censo...";

    function conAgregadoYPoligonos() {
        if (!window.estadosPolygonsGeoJSON) {
            AppData.load('https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json')
                .then(function (geo) {
                    window.estadosPolygonsGeoJSON = geo;
                    dibujarCoropletaCenso(variable, anio);
                }).catch(function (e) {
                    console.error(e);
                    filterTitle.innerText = "Error cargando mapa";
                });
        } else {
            dibujarCoropletaCenso(variable, anio);
        }
    }

    if (!window._censoAgregado) {
        AppData.load('Tablas/Censo_economico_2024.csv').then(function (csvText) {
            var parsed = _parsearCSVCenso(csvText);
            window._censoAgregado = _construirCensoAgregado(parsed);
            conAgregadoYPoligonos();
        }).catch(function (err) {
            console.error(err);
            filterTitle.innerText = "Error: " + err.message;
        });
    } else {
        conAgregadoYPoligonos();
    }
}

function dibujarCoropletaCenso(variable, anio) {
    var filterTitle = document.getElementById('filter-title');
    var agregado = window._censoAgregado;

    var valores = [];
    var stateDataMap = {};
    Object.keys(agregado).forEach(function (estadoReal) {
        var datosAnio = agregado[estadoReal][anio];
        var val = datosAnio ? (datosAnio[variable] || 0) : 0;
        var historial = {};
        Object.keys(agregado[estadoReal]).forEach(function (y) {
            historial[y] = agregado[estadoReal][y][variable] || 0;
        });
        stateDataMap[estadoReal] = { valor: val, historial: historial };
        if (val > 0) valores.push(val);
    });

    valores.sort(function (a, b) { return a - b; });
    var breaks = calcularBreaks(valores);

    window.censoDataActual = stateDataMap;
    window.censoVariableActual = variable;
    window.breaksCensoActual = breaks;

    var labelsArray = [];
    var layer_geo = L.geoJSON(window.estadosPolygonsGeoJSON, {
        style: function (feature) {
            var estadoReal = normalizarEstadoNombre(feature.properties.name || feature.properties.ESTADO || feature.properties.NOMGEO);
            var entrada = stateDataMap[estadoReal];
            var color = '#333', opacity = 0.5;
            if (entrada && entrada.valor > 0) {
                color = RampaRojos[getClase(entrada.valor, breaks)] || '#333';
                opacity = 0.82;
            }
            return { fillColor: color, weight: 1, opacity: 1, color: window.limiteBoundaryColor || 'white', fillOpacity: opacity };
        },
        onEachFeature: function (feature, layer) {
            var estadoReal = normalizarEstadoNombre(feature.properties.name || feature.properties.ESTADO || feature.properties.NOMGEO);
            var entrada = stateDataMap[estadoReal];
            if (!entrada || !(entrada.valor > 0)) return;

            var metricaLabel = CENSO_VARIABLE_LABELS[variable] || variable;
            var tooltipContent = `
                <div style="font-size:12px; font-weight:bold; color:#00e5ff; margin-bottom:5px;">${estadoReal}</div>
                <div style="font-size:11px; color:#fff;">${metricaLabel} (${anio}): ${entrada.valor.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</div>
            `;
            layer.bindTooltip(tooltipContent, { sticky: true, className: 'custom-tooltip' });

            layer.on({
                mouseover: function (e) { e.target.setStyle({ weight: 3, color: '#00e5ff' }); e.target.bringToFront(); },
                mouseout: function (e) { layer_geo.resetStyle(e.target); },
                click: function (e) { dibujarGraficaEvolucionCenso([estadoReal], anio, variable); }
            });
        }
    });

    layer_geo.eachLayer(function (layer) {
        var estadoReal = normalizarEstadoNombre(layer.feature.properties.name || layer.feature.properties.ESTADO || layer.feature.properties.NOMGEO);
        var labelCenter = layer.getBounds().getCenter();
        var nombreAcotado = ABREVIATURAS_ESTADOS[estadoReal] || estadoReal;
        var labelMarker = L.marker(labelCenter, {
            icon: L.divIcon({
                className: 'state-label-permanent',
                html: `<div style="color:#fff; font-size:10px; font-weight:bold; text-shadow:1px 1px 2px #000; text-align:center;">${nombreAcotado}</div>`,
                iconSize: [80, 20]
            }),
            interactive: false
        });
        labelsArray.push(labelMarker);
    });

    var labelsGroup = L.featureGroup(labelsArray);
    var combinedGroup = L.featureGroup([layer_geo, labelsGroup]).addTo(map);
    combinedGroup.bringToBack();
    currentGeoJSONLayer = combinedGroup;

    filterTitle.innerText = "Análisis";

    actualizarLeyendaCenso(breaks, variable, anio);

    var top5 = Object.keys(stateDataMap)
        .filter(function (k) { return stateDataMap[k].valor > 0; })
        .sort(function (a, b) { return stateDataMap[b].valor - stateDataMap[a].valor; })
        .slice(0, 5);

    dibujarGraficaEvolucionCenso(top5, anio, variable);
}

window.breaksCensoActual = [];
window.claseCensoSeleccionada = null;

window.sintesisCenso = [
    "Clase 1: Actividad incipiente. Presencia muy reducida del sector Electrónica/SEIT/Telecom/Medios.",
    "Clase 2: Actividad baja. Participación modesta dentro del Censo Económico para esta variable.",
    "Clase 3: Actividad media. Posición intermedia respecto al resto de las entidades.",
    "Clase 4: Actividad alta. Concentración relevante de unidades económicas y valor generado.",
    "Clase 5: Actividad muy alta. Entidades líderes en el sector para la variable seleccionada."
];

// Leyenda con clases clicables (prender/apagar), igual que el Índice de
// crecimiento compuesto (actualizarLeyendaProductividad) y Finanzas
// (actualizarLeyendaFinanzas) — antes era una franja de color estática sin
// interacción.
function actualizarLeyendaCenso(breaks, variable, anio) {
    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content');
    if (!div || !overlay) return;

    window.breaksCensoActual = breaks;
    window.claseCensoSeleccionada = null;

    var metricaLabel = CENSO_VARIABLE_LABELS[variable] || variable;
    var f = function (n) { return (n || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 }); };
    var colores = RampaRojos;

    var html = `
        <div id="legend-flujos">
            <div style="margin-bottom:6px; font-weight:bold; color:#00e5ff; font-size:12px; text-transform:uppercase; border-bottom:1px solid rgba(0,229,255,0.3); padding-bottom:3px;">Censo Económico ${anio}</div>
            <div style="font-size:11px; color:#ccc; margin-bottom:8px;">${metricaLabel} · Sectores: Electrónica, SEIT, Telecom, Medios.</div>
            <div style="margin-bottom:12px; font-weight:bold; color:#ddd; font-size:14px; text-transform:uppercase;">CLASES</div>
            <div style="font-size:11px; color:#aaa; margin-bottom:10px;">Selecciona una clase para filtrar entidades</div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 4px; margin-top: 5px;">
    `;

    var conteos = [0, 0, 0, 0, 0];
    if (window.censoDataActual) {
        Object.keys(window.censoDataActual).forEach(function (estado) {
            var entrada = window.censoDataActual[estado];
            if (entrada && entrada.valor > 0) conteos[getClase(entrada.valor, breaks)]++;
        });
    }

    var rangos = [
        `Menor o igual a ${f(breaks[0])}`,
        `${f(breaks[0])} - ${f(breaks[1])}`,
        `${f(breaks[1])} - ${f(breaks[2])}`,
        `${f(breaks[2])} - ${f(breaks[3])}`,
        `Mayor a ${f(breaks[3])}`
    ];

    for (var i = 0; i < 5; i++) {
        html += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                <div class="legend-box-censo" data-class="${i}"
                     style="background: ${colores[i]}; width: 100%; height: 25px; cursor: pointer; border: 1px solid #1a1a1a; transition: all 0.2s ease; border-radius: 2px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; color:#fff; text-shadow:1px 1px 2px #000;"
                     onclick="filtrarMapaCenso(${i})" title="${rangos[i]}">${conteos[i]}</div>
                <div style="font-size: 9px; color: #ccc; margin-top: 4px; text-align: center;">Clase ${i + 1}</div>
            </div>
        `;
    }

    html += `
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #ccc; font-weight: bold; margin-top: 5px;">
                <span>Min</span>
                <span>Max</span>
            </div>
            <div id="leyenda-sintesis-censo" style="margin-top:10px; font-size:11px; color:#00e5ff; font-style:italic; text-align: justify;">Da clic en una entidad del mapa para ver su evolución temporal (2003-2023) en la gráfica inferior, o en una clase para filtrar entidades.</div>
        </div>
        <div id="legend-nodos-locales" style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px; display:none;"></div>
    `;

    div.innerHTML = html;
    overlay.style.display = 'block';
}

window.filtrarMapaCenso = function (clase) {
    if (window.claseCensoSeleccionada === clase) {
        window.claseCensoSeleccionada = null;
    } else {
        window.claseCensoSeleccionada = clase;
    }

    var sintesisEl = document.getElementById('leyenda-sintesis-censo');
    if (window.claseCensoSeleccionada === null) {
        if (sintesisEl) sintesisEl.innerHTML = "Da clic en una entidad del mapa para ver su evolución temporal (2003-2023) en la gráfica inferior, o en una clase para filtrar entidades.";
    } else {
        if (sintesisEl) sintesisEl.innerHTML = window.sintesisCenso[window.claseCensoSeleccionada];
    }

    document.querySelectorAll('.legend-box-censo').forEach(function (box) {
        var boxClase = parseInt(box.getAttribute('data-class'));
        if (window.claseCensoSeleccionada === null) {
            box.style.opacity = '1';
            box.style.border = '1px solid #1a1a1a';
            box.style.transform = 'scale(1)';
        } else if (boxClase === window.claseCensoSeleccionada) {
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
        currentGeoJSONLayer.eachLayer(function (subGroup) {
            if (subGroup.eachLayer) {
                subGroup.eachLayer(function (layer) {
                    if (layer.feature && layer.feature.geometry && layer.feature.geometry.type !== 'Point') {
                        var estadoReal = normalizarEstadoNombre(
                            layer.feature.properties.name || layer.feature.properties.ESTADO || layer.feature.properties.NOMGEO
                        );
                        var entrada = window.censoDataActual && window.censoDataActual[estadoReal];
                        if (entrada && entrada.valor > 0) {
                            var claseEstado = getClase(entrada.valor, window.breaksCensoActual);
                            if (window.claseCensoSeleccionada === null || claseEstado === window.claseCensoSeleccionada) {
                                layer.setStyle({ opacity: 1, fillOpacity: 0.82 });
                            } else {
                                layer.setStyle({ opacity: 0.2, fillOpacity: 0.1 });
                            }
                        } else {
                            layer.setStyle({ opacity: 0.2, fillOpacity: 0 });
                        }
                    }
                });
            }
        });
    }
};

function dibujarGraficaEvolucionCenso(estadosSeleccionados, anioDestacado, variable) {
    if (typeof Chart === 'undefined') return;

    // Módulos de datos duros: se refinan con la entidad líder del año
    // clicado (misma que encabeza la gráfica de evolución del Censo).
    if (estadosSeleccionados.length > 0 && typeof window.actualizarModulosDatosDuros === 'function') {
        window.actualizarModulosDatosDuros([], "Estatal", estadosSeleccionados[0]);
    }

    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var statsContent = document.getElementById('stats-content');
    if (statsContent && !statsContent.classList.contains('show')) {
        statsContent.classList.add('show');
    }

    var chartContainer = document.getElementById('topGlobalChartContainer');
    if (chartContainer) chartContainer.style.display = 'block';

    var metricaLabel = CENSO_VARIABLE_LABELS[variable] || variable;

    var chartTitle = document.getElementById('topGlobalChartTitle');
    if (chartTitle) {
        chartTitle.innerHTML = 'EVOLUCIÓN TEMPORAL: ' + metricaLabel.toUpperCase();
        chartTitle.style.display = 'block';
    }

    var hr = document.getElementById('topGlobalChartHr');
    if (hr) hr.style.display = 'block';

    var canvas = document.getElementById('topGlobalChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    if (window.topGlobalChartInstance) {
        window.topGlobalChartInstance.destroy();
    }

    var labelsSet = new Set();
    estadosSeleccionados.forEach(function (edo) {
        var entrada = window.censoDataActual[edo];
        if (entrada && entrada.historial) {
            Object.keys(entrada.historial).forEach(function (anio) { labelsSet.add(anio); });
        }
    });

    var labels = Array.from(labelsSet).sort(function (a, b) { return parseInt(a) - parseInt(b); });

    var colores = ['#00e5ff', '#ff3366', '#d59f0f', '#00e676', '#d500f9'];
    var datasets = [];

    estadosSeleccionados.forEach(function (edo, index) {
        var entrada = window.censoDataActual[edo];
        var dataValues = labels.map(function (anio) {
            var val = entrada && entrada.historial ? entrada.historial[anio] : undefined;
            return val !== undefined ? val : null;
        });

        datasets.push({
            label: edo,
            data: dataValues,
            borderColor: colores[index % colores.length],
            backgroundColor: colores[index % colores.length],
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#222'
        });
    });

    window.topGlobalChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: '#ccc', font: { size: 10 }, boxWidth: 12 }
                },
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
                                label += context.parsed.y.toLocaleString('es-MX', { maximumFractionDigits: 2 });
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
                        callback: function (value) { return value.toLocaleString('es-MX', { maximumFractionDigits: 0 }); }
                    },
                    grid: { color: '#333', borderDash: [2, 2] }
                }
            }
        }
    });

    var summaryDiv = document.getElementById('dynamic-summary-global');
    if (summaryDiv && estadosSeleccionados.length > 0) {
        var texto = _generarInterpretacionObjetiva(window.censoDataActual, estadosSeleccionados, labels, '<b style="color:#fcae91;">' + metricaLabel.toLowerCase() + '</b> dentro del Censo Económico (sectores Electrónica, SEIT, Telecom y Medios)');

        summaryDiv.innerHTML = texto;
        summaryDiv.style.display = 'block';
    }
}

// ============================================================================
// REGIONALIZACIÓN NACIONAL (carto/Region_nacional_2026.geojson)
// ============================================================================
// A diferencia de los demás tipos de análisis de esta escala (coropleta por
// un valor numérico continuo con calcularBreaks/getClase), aquí la
// coropleta es CATEGÓRICA: cada una de las 32 entidades se colorea según su
// atributo "REGION" (8 regiones). El dashboard agrega (suma) el resto de
// los atributos numéricos a nivel nacional por defecto, y se reagrega solo
// con las entidades de la región elegida en cuanto se selecciona una — vía
// el selector de Región o haciendo clic directo en el mapa/leyenda.

var REGION_NOMBRE_DISPLAY = {
    "Centro occidente": "Centro Occidente",
    "Centro sur": "Centro Sur",
    "Golfo de Mexico": "Golfo de México",
    "Noreste": "Noreste",
    "Noroeste": "Noroeste",
    "Norte": "Norte",
    "Pacifico Sur": "Pacífico Sur",
    "Peninsula de Yucatan": "Península de Yucatán"
};

// Antes usaba una paleta "arcoíris" (cian/verde/morado/naranja) que no se
// parecía en nada a la simbología del resto de la plataforma. Se homologa a
// la misma familia de rojos que RampaRojos (usada en TODAS las coropletas
// numéricas: Productividad, Censo, Finanzas, Índice Educación Superior,
// AGEB) extendida de 5 a 8 tonos — Regionalización es categórica (8
// regiones sin orden entre sí, a diferencia de las 5 clases numéricas de
// RampaRojos), pero así su coropleta se lee como parte de la misma familia
// visual en vez de una paleta aparte.
var REGION_COLORES = {
    "Centro occidente": "#fee0d2",
    "Centro sur": "#fcbba1",
    "Golfo de Mexico": "#fc9272",
    "Noreste": "#fb6a4a",
    "Noroeste": "#ef3b2c",
    "Norte": "#cb181d",
    "Pacifico Sur": "#a50f15",
    "Peninsula de Yucatan": "#67000d"
};

// Atributos numéricos agregables, con su etiqueta amigable. INDI1 no tiene
// una descripción oficial documentada en el proyecto (mismo caso que en
// carto/Limites_Municipales.geojson) — se muestra de todas formas, marcado
// como tal, en vez de inventarle un significado.
var REGIONALIZACION_METRICAS = [
    { key: 'POB_TOTAL', label: 'Población Total' },
    { key: 'POB_NINOS', label: 'Población Niños' },
    { key: 'POB_ADULTOS', label: 'Población Adultos' },
    { key: 'POB_MAYORES', label: 'Población Mayores' },
    { key: 'POB_FEM', label: 'Población Femenina' },
    { key: 'POB_MASC', label: 'Población Masculina' },
    { key: 'INDI1', label: 'Población Indígena' },
    { key: 'DISC1', label: 'Población con Discapacidad' },
    { key: 'ANALFABETA', label: 'Población Analfabeta' },
    { key: 'EDU_SUPERIOR', label: 'Población con Educación Superior' },
    { key: 'SALUD1', label: 'Población Afiliada al Seguro Social' },
    { key: 'POB_OCUPADA', label: 'Población Ocupada' },
    { key: 'VIV_HABITADAS', label: 'Viviendas Habitadas' },
    { key: 'VIV_SIN_SERV', label: 'Viviendas sin Servicios Básicos' },
    { key: 'VIV_INTERNET', label: 'Viviendas con Internet' }
];

window._regionalizacionEntidadClickeada = null;

function iniciarRegionalizacion(selectRegionEl) {
    var filterTitle = document.getElementById('filter-title');
    if (filterTitle) filterTitle.innerText = "Cargando regionalización...";

    function conDatos() {
        if (filterTitle) filterTitle.innerText = "Análisis";
        // Poblar el select de Región solo la primera vez (option[0] es
        // siempre el placeholder "-- Todo el país --").
        if (selectRegionEl && selectRegionEl.options.length === 1) {
            var regiones = Array.from(new Set(window._regionalizacionGeoJSON.features.map(function (f) { return f.properties.REGION; })))
                .sort(function (a, b) { return (REGION_NOMBRE_DISPLAY[a] || a).localeCompare(REGION_NOMBRE_DISPLAY[b] || b); });
            regiones.forEach(function (r) {
                var opt = document.createElement('option');
                opt.value = r;
                opt.innerText = REGION_NOMBRE_DISPLAY[r] || r;
                selectRegionEl.appendChild(opt);
            });
        }
        window._regionalizacionEntidadClickeada = null;
        renderizarMapaRegionalizacion(null, null);
    }

    if (window._regionalizacionGeoJSON) {
        conDatos();
    } else {
        AppData.load('carto/Region_nacional_2026.geojson').then(function (geo) {
            window._regionalizacionGeoJSON = geo;
            conDatos();
        }).catch(function (e) {
            console.error('Error cargando Region_nacional_2026.geojson:', e);
            if (filterTitle) filterTitle.innerText = "Error cargando regionalización";
        });
    }
}

function renderizarMapaRegionalizacion(regionSel, entidadClickeada) {
    if (currentGeoJSONLayer) { map.removeLayer(currentGeoJSONLayer); currentGeoJSONLayer = null; }
    var geo = window._regionalizacionGeoJSON;
    if (!geo) return;

    // entidadClickeada llega explícitamente como null (no undefined) cuando
    // se elige desde el <select> o se deselecciona una región desde la
    // leyenda — en ese caso sí debe borrar cualquier estado resaltado antes.
    if (entidadClickeada !== undefined) window._regionalizacionEntidadClickeada = entidadClickeada;

    // Al cambiar de región (incluida la vuelta a "todo el país") se resetea
    // la selección de entidades activas del desglose interactivo — si no,
    // exclusiones hechas en una región se arrastrarían a la siguiente.
    if (regionSel !== window._regionalizacionUltimaRegion) {
        window._regionalizacionEntidadesActivas = null;
        window._regionalizacionUltimaRegion = regionSel;
    }

    var layer_geo = L.geoJSON(geo, {
        style: function (feature) {
            var region = feature.properties.REGION;
            var nomgeo = feature.properties.NOMGEO;
            var color = REGION_COLORES[region] || '#666';
            var esRegionActiva = !regionSel || region === regionSel;
            var esSeleccionada = window._regionalizacionEntidadClickeada === nomgeo;
            // Dentro de la región activa, una entidad puede además estar
            // "desmarcada" del desglose interactivo (checkbox de la leyenda) —
            // se ve atenuada, distinto a las de otras regiones.
            var excluidaPorCheckbox = regionSel && region === regionSel &&
                window._regionalizacionEntidadesActivas && !window._regionalizacionEntidadesActivas.has(nomgeo);
            var fillOpacity = !esRegionActiva ? 0.12 : (excluidaPorCheckbox ? 0.25 : 0.78);
            return {
                fillColor: color,
                weight: esSeleccionada ? 3 : 1,
                color: esSeleccionada ? '#fff' : '#222',
                fillOpacity: fillOpacity,
                opacity: esRegionActiva ? 1 : 0.3
            };
        },
        onEachFeature: function (feature, layer) {
            var p = feature.properties;
            layer.bindTooltip(
                '<b>' + p.NOMGEO + '</b><br>Región: ' + (REGION_NOMBRE_DISPLAY[p.REGION] || p.REGION) +
                '<br>Población: ' + Math.round(p.POB_TOTAL || 0).toLocaleString('es-MX'),
                { sticky: true, className: 'custom-tooltip' }
            );
            layer.on({
                mouseover: function (e) { e.target.setStyle({ weight: 3 }); e.target.bringToFront(); },
                mouseout: function (e) { layer_geo.resetStyle(e.target); },
                click: function () {
                    var sel = document.getElementById('select-region-nacional');
                    if (sel) sel.value = p.REGION;
                    renderizarMapaRegionalizacion(p.REGION, p.NOMGEO);
                }
            });
        }
    }).addTo(map);

    currentGeoJSONLayer = layer_geo;

    actualizarLeyendaRegionalizacion(regionSel);
    actualizarGraficasRegionalizacion(regionSel, window._regionalizacionEntidadClickeada);
}

// Leyenda con clases (regiones) clicables, mismo mecanismo de
// prender/apagar que window.filtrarMapaProductividad / filtrarMapaCenso,
// pero categórica (por nombre de región) en vez de por umbral numérico.
function actualizarLeyendaRegionalizacion(regionSel) {
    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content');
    if (!div || !overlay) return;
    var geo = window._regionalizacionGeoJSON;
    if (!geo) return;

    var conteos = {};
    geo.features.forEach(function (f) {
        var r = f.properties.REGION;
        conteos[r] = (conteos[r] || 0) + 1;
    });

    var regiones = Object.keys(REGION_COLORES);

    var html = '<div style="margin: 4px 0 6px 0; font-weight:bold; color:#00e5ff; font-size:12px; text-transform:uppercase; border-bottom:1px solid rgba(0,229,255,0.3); padding-bottom:3px;">Regionalización Nacional</div>';
    html += '<div style="font-size:11px; color:#aaa; margin-bottom:8px;">Da clic en una región o en una entidad del mapa</div>';

    regiones.forEach(function (r) {
        var activo = !regionSel || regionSel === r;
        html += '<div class="legend-box-region" data-region="' + r + '" onclick="window.filtrarMapaRegionalizacion(\'' + r + '\')" ' +
            'style="display:flex; align-items:center; gap:6px; margin-bottom:5px; cursor:pointer; opacity:' + (activo ? '1' : '0.35') + ';">' +
            '<div style="width:14px; height:14px; background:' + REGION_COLORES[r] + '; border:1px solid #1a1a1a; border-radius:2px; flex-shrink:0;' + (regionSel === r ? ' box-shadow:0 0 0 2px #fff;' : '') + '"></div>' +
            '<span style="font-size:11px; color:#ddd;">' + (REGION_NOMBRE_DISPLAY[r] || r) + ' (' + conteos[r] + ')</span>' +
            '</div>';
    });

    // Desglose interactivo de las entidades de la región activa — solo
    // aparece con una región elegida (no en la vista "todo el país", donde
    // serían 32 filas). El checkbox incluye/excluye del agregado que
    // calculan las gráficas; el nombre resalta esa entidad sola (mismo
    // efecto que hacer clic en el mapa).
    if (regionSel) {
        var entidadesRegion = geo.features
            .filter(function (f) { return f.properties.REGION === regionSel; })
            .map(function (f) { return f.properties.NOMGEO; })
            .sort();

        html += '<div style="margin-top:12px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.15);">';
        html += '<div style="font-size:11px; color:#00e5ff; font-weight:bold; text-transform:uppercase; margin-bottom:4px;">Entidades de ' + (REGION_NOMBRE_DISPLAY[regionSel] || regionSel) + '</div>';
        html += '<div style="font-size:10px; color:#888; margin-bottom:6px;">Casilla: incluir/excluir del agregado. Nombre: ver solo esa entidad.</div>';
        entidadesRegion.forEach(function (nom) {
            var activa = !window._regionalizacionEntidadesActivas || window._regionalizacionEntidadesActivas.has(nom);
            var esDrill = window._regionalizacionEntidadClickeada === nom;
            var nomEscapado = nom.replace(/'/g, "\\'");
            html += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">' +
                '<input type="checkbox" ' + (activa ? 'checked' : '') + ' onchange="window.toggleEntidadActivaRegionalizacion(\'' + nomEscapado + '\', this.checked)" style="cursor:pointer;">' +
                '<span onclick="window.drillEntidadRegionalizacion(\'' + nomEscapado + '\')" style="font-size:11px; color:' + (esDrill ? '#00e5ff' : '#ccc') + '; font-weight:' + (esDrill ? 'bold' : 'normal') + '; cursor:pointer;' + (esDrill ? ' text-decoration:underline;' : '') + '">' + nom + '</span>' +
                '</div>';
        });
        html += '</div>';
    }

    div.innerHTML = html;
    overlay.style.display = 'block';
}

window.filtrarMapaRegionalizacion = function (region) {
    var actual = document.getElementById('select-region-nacional');
    var yaEstaActiva = actual && actual.value === region;
    var nuevoValor = yaEstaActiva ? '' : region;
    if (actual) actual.value = nuevoValor;
    renderizarMapaRegionalizacion(nuevoValor || null, null);
};

// Checkbox de la leyenda: incluye/excluye una entidad del agregado que
// calculan las gráficas para la región activa, sin cambiar el "drill" (si
// había una entidad resaltada individualmente, se limpia — el usuario está
// pidiendo ver el agregado del conjunto que dejó marcado, no una sola).
window.toggleEntidadActivaRegionalizacion = function (nomgeo, checked) {
    var sel = document.getElementById('select-region-nacional');
    var regionActual = sel ? sel.value : null;
    if (!window._regionalizacionEntidadesActivas) {
        var geo = window._regionalizacionGeoJSON;
        window._regionalizacionEntidadesActivas = new Set(
            geo.features.filter(function (f) { return f.properties.REGION === regionActual; })
                .map(function (f) { return f.properties.NOMGEO; })
        );
    }
    if (checked) window._regionalizacionEntidadesActivas.add(nomgeo);
    else window._regionalizacionEntidadesActivas.delete(nomgeo);

    renderizarMapaRegionalizacion(regionActual || null, null);
};

// Nombre de la leyenda: aísla esa entidad en las gráficas (mismo mecanismo
// que hacer clic en su polígono). Clic de nuevo sobre la misma regresa al
// agregado de la región.
window.drillEntidadRegionalizacion = function (nomgeo) {
    var sel = document.getElementById('select-region-nacional');
    var regionActual = sel ? sel.value : null;
    var yaEstaDrill = window._regionalizacionEntidadClickeada === nomgeo;
    renderizarMapaRegionalizacion(regionActual || null, yaEstaDrill ? null : nomgeo);
};

function actualizarGraficasRegionalizacion(regionSel, entidadClickeada) {
    if (typeof Chart === 'undefined') return;
    var geo = window._regionalizacionGeoJSON;
    if (!geo) return;

    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    // Alcance: una sola entidad si hay drill activo; si no, las entidades
    // "activas" (checkboxes) de la región elegida; si no hay región, las 32.
    var featuresRegion = regionSel ? geo.features.filter(function (f) { return f.properties.REGION === regionSel; }) : geo.features;
    var totalEntidadesRegion = featuresRegion.length;
    var featuresScope;
    if (entidadClickeada) {
        featuresScope = geo.features.filter(function (f) { return f.properties.NOMGEO === entidadClickeada; });
    } else if (regionSel) {
        featuresScope = featuresRegion.filter(function (f) {
            return !window._regionalizacionEntidadesActivas || window._regionalizacionEntidadesActivas.has(f.properties.NOMGEO);
        });
    } else {
        featuresScope = geo.features;
    }

    var totales = {};
    REGIONALIZACION_METRICAS.forEach(function (m) { totales[m.key] = 0; });
    featuresScope.forEach(function (f) {
        REGIONALIZACION_METRICAS.forEach(function (m) {
            totales[m.key] += (f.properties[m.key] || 0);
        });
    });

    var totalNacionalPob = geo.features.reduce(function (s, f) { return s + (f.properties.POB_TOTAL || 0); }, 0);
    // Población de TODA la región (sin excluir por checkbox) — para poder
    // decir qué tanto pesa la entidad drillada dentro de su propia región,
    // no solo dentro del país.
    var totalRegionPob = featuresRegion.reduce(function (s, f) { return s + (f.properties.POB_TOTAL || 0); }, 0);

    var titulo = document.getElementById('stats-title-text');
    if (titulo) {
        var nombreScope = entidadClickeada ? entidadClickeada : (regionSel ? (REGION_NOMBRE_DISPLAY[regionSel] || regionSel) : 'Nacional (32 entidades)');
        var pctNacional = totalNacionalPob > 0 ? ((totales.POB_TOTAL / totalNacionalPob) * 100).toFixed(1) : '0';
        var pctRegion = totalRegionPob > 0 ? ((totales.POB_TOTAL / totalRegionPob) * 100).toFixed(1) : '0';
        var lineaAlcance = entidadClickeada
            ? '1 entidad individual (clic de nuevo en su nombre/polígono para volver al agregado de la región)'
            : (featuresScope.length + ' de ' + totalEntidadesRegion + ' entidad' + (totalEntidadesRegion === 1 ? '' : 'es') + ' en este alcance' + (regionSel && featuresScope.length < totalEntidadesRegion ? ' (' + (totalEntidadesRegion - featuresScope.length) + ' excluida(s) con el checkbox)' : ''));
        // Al drillear una entidad se muestran DOS referencias junto a su
        // población: qué tanto pesa dentro del país y, además, dentro de su
        // propia región (regionSel) — antes solo se veía el % nacional.
        var referenciaPct = entidadClickeada
            ? (' (' + pctNacional + '% del país · ' + pctRegion + '% de ' + (REGION_NOMBRE_DISPLAY[regionSel] || regionSel) + ')')
            : (regionSel ? (' (' + pctNacional + '% del país)') : '');
        titulo.innerHTML = '<span style="font-size:16px; font-weight:bold; text-transform:uppercase;">' + nombreScope + '</span><br>' +
            '<span style="font-size:12px; color:#ddd">Población Total: <b>' + Math.round(totales.POB_TOTAL).toLocaleString('es-MX') + '</b>' +
            referenciaPct + '</span><br>' +
            '<span style="font-size:11px; color:#aaa">' + lineaAlcance + '</span>';
    }

    // --- Gráfica 1 (myChart): composición demográfica ---
    var canvasMyChart = document.getElementById('myChart');
    var myChartTitle = document.getElementById('myChartTitle');
    var myChartContainer = document.getElementById('myChartContainer');
    if (myChartContainer) myChartContainer.style.display = 'block';
    if (myChartTitle) {
        myChartTitle.innerHTML = 'COMPOSICIÓN DEMOGRÁFICA POR EDAD';
        myChartTitle.style.display = 'block';
    }
    if (canvasMyChart) {
        canvasMyChart.parentElement.style.height = '220px';
        if (mainChart) mainChart.destroy();

        // Gráfica de pastel con los 3 grupos de edad reales del geojson
        // (Niños/Adultos/Mayores) — se dejó de usar la pirámide porque exigía
        // ESTIMAR el cruce edad×género (el dato no trae esa combinación), y
        // esta versión evita esa suposición: son las cifras tal cual vienen.
        var gruposEdad = ['Niños', 'Adultos', 'Mayores'];
        var valoresEdad = [totales.POB_NINOS, totales.POB_ADULTOS, totales.POB_MAYORES];
        var totalEdadConocida = valoresEdad.reduce(function (a, b) { return a + b; }, 0);

        mainChart = new Chart(canvasMyChart.getContext('2d'), {
            type: 'pie',
            data: {
                labels: gruposEdad,
                datasets: [{
                    data: valoresEdad,
                    // Misma paleta RampaRojos que usan todas las coropletas
                    // numéricas del proyecto (antes cian/verde/dorado, sin
                    // relación con el resto de la simbología).
                    backgroundColor: [RampaRojos[0], RampaRojos[2], RampaRojos[4]],
                    borderWidth: 1, borderColor: '#222'
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { color: '#ccc', font: { size: 9 }, boxWidth: 10 } },
                    tooltip: {
                        backgroundColor: 'rgba(20,20,20,0.95)',
                        titleColor: '#00e5ff', bodyColor: '#fff', borderColor: '#555', borderWidth: 1,
                        callbacks: {
                            label: function (ctx) { return ctx.label + ': ' + Math.round(ctx.parsed).toLocaleString('es-MX'); }
                        }
                    },
                    datalabels: {
                        // Texto oscuro sobre la rebanada clara (Niños), claro
                        // sobre las oscuras (Adultos/Mayores) — con la paleta
                        // de rojos ya no todas las rebanadas son igual de
                        // claras, a diferencia de la paleta anterior.
                        color: function (ctx) {
                            var bg = ctx.dataset.backgroundColor[ctx.dataIndex];
                            var r = parseInt(bg.substring(1, 3), 16), g = parseInt(bg.substring(3, 5), 16), b = parseInt(bg.substring(5, 7), 16);
                            var luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                            return luminancia > 0.55 ? '#111' : '#fff';
                        },
                        font: { weight: 'bold', size: 10 },
                        formatter: function (value) { return totalEdadConocida > 0 ? ((value / totalEdadConocida) * 100).toFixed(1) + '%' : ''; }
                    }
                }
            }
        });
    }

    // --- Gráfica 2 (topGlobalChart): otros indicadores ---
    var topGlobalContainer = document.getElementById('topGlobalChartContainer');
    var topGlobalTitle = document.getElementById('topGlobalChartTitle');
    var topGlobalHr = document.getElementById('topGlobalChartHr');
    if (topGlobalContainer) topGlobalContainer.style.display = 'block';
    if (topGlobalTitle) { topGlobalTitle.innerHTML = 'OTROS INDICADORES'; topGlobalTitle.style.display = 'block'; }
    if (topGlobalHr) topGlobalHr.style.display = 'block';

    var otrosKeys = ['INDI1', 'DISC1', 'ANALFABETA', 'EDU_SUPERIOR', 'POB_OCUPADA', 'VIV_HABITADAS', 'VIV_SIN_SERV', 'VIV_INTERNET', 'SALUD1'];
    var otrosLabels = otrosKeys.map(function (k) {
        var m = REGIONALIZACION_METRICAS.find(function (x) { return x.key === k; });
        var l = m ? m.label : k;
        return l.length > 22 ? l.substring(0, 21) + '…' : l;
    });

    var canvasTemporal = document.getElementById('topGlobalChart');
    if (canvasTemporal) {
        if (window.topGlobalChartInstance) window.topGlobalChartInstance.destroy();

        // Estos indicadores difieren en varios órdenes de magnitud dentro del
        // mismo alcance (p. ej. Viviendas sin Servicios en cientos vs.
        // Población Afiliada en cientos de miles) — en un eje lineal
        // compartido, las barras chicas se veían "apagadas"/invisibles
        // aunque su valor fuera real y distinto de cero. Eje logarítmico +
        // etiqueta con la cifra exacta al final de cada barra para que se
        // puedan comparar todas a la vez sin que ninguna desaparezca.
        var otrosValores = otrosKeys.map(function (k) { return Math.max(totales[k], 0); });

        window.topGlobalChartInstance = new Chart(canvasTemporal.getContext('2d'), {
            type: 'bar',
            data: {
                labels: otrosLabels,
                datasets: [{
                    label: 'Total',
                    data: otrosValores,
                    backgroundColor: '#00e5ff',
                    borderWidth: 1, borderColor: '#222'
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#fff', font: { weight: 'bold', size: 9 },
                        anchor: 'end', align: 'end', clamp: true,
                        formatter: function (value) { return value > 0 ? value.toLocaleString('es-MX', { maximumFractionDigits: 0 }) : '0'; }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(20,20,20,0.95)',
                        titleColor: '#00e5ff', bodyColor: '#fff', borderColor: '#555', borderWidth: 1,
                        callbacks: {
                            label: function (ctx) { return ctx.parsed.x.toLocaleString('es-MX', { maximumFractionDigits: 0 }); }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'logarithmic',
                        ticks: {
                            color: '#aaa', font: { size: 9 },
                            callback: function (value) {
                                var log = Math.log10(value);
                                if (Math.abs(log - Math.round(log)) > 1e-9) return '';
                                return value.toLocaleString('es-MX');
                            }
                        },
                        grid: { color: '#333' }
                    },
                    y: { ticks: { color: '#ddd', font: { size: 9 } }, grid: { display: false } }
                }
            }
        });
    }

    // --- Síntesis descriptiva ---
    var summaryDiv = document.getElementById('dynamic-summary-global');
    if (summaryDiv) {
        var pctNinos = totales.POB_TOTAL > 0 ? ((totales.POB_NINOS / totales.POB_TOTAL) * 100).toFixed(1) : '0';
        var pctAdultos = totales.POB_TOTAL > 0 ? ((totales.POB_ADULTOS / totales.POB_TOTAL) * 100).toFixed(1) : '0';
        var pctMayores = totales.POB_TOTAL > 0 ? ((totales.POB_MAYORES / totales.POB_TOTAL) * 100).toFixed(1) : '0';
        var pctFem = totales.POB_TOTAL > 0 ? ((totales.POB_FEM / totales.POB_TOTAL) * 100).toFixed(1) : '0';
        var promedioEntidad = featuresScope.length > 0 ? Math.round(totales.POB_TOTAL / featuresScope.length) : 0;

        var texto = 'De la población de este alcance, <b>' + pctNinos + '%</b> son niños, <b>' + pctAdultos + '%</b> adultos y <b>' + pctMayores + '%</b> personas mayores; <b>' + pctFem + '%</b> corresponde a mujeres. ' +
            (entidadClickeada ? '' : ('En promedio, cada entidad de este alcance concentra <b>' + promedioEntidad.toLocaleString('es-MX') + '</b> habitantes.'));

        // Ficha de la entidad clickeada (campos cualitativos, no agregables:
        // ACT_PRIM/ACT_SECU/ACT_TERC/ESTRATEGIA).
        if (entidadClickeada) {
            var featEnt = geo.features.find(function (f) { return f.properties.NOMGEO === entidadClickeada; });
            if (featEnt) {
                var p = featEnt.properties;
                texto += '<hr style="border-top:1px solid #444; margin:8px 0;">' +
                    '<b style="color:#00e5ff;">' + p.NOMGEO + '</b><br>' +
                    '<span style="font-size:11px;"><b>Actividad primaria:</b> ' + (p.ACT_PRIM || 'Sin dato') + '</span><br>' +
                    '<span style="font-size:11px;"><b>Actividad secundaria:</b> ' + (p.ACT_SECU || 'Sin dato') + '</span><br>' +
                    '<span style="font-size:11px;"><b>Actividad terciaria:</b> ' + (p.ACT_TERC || 'Sin dato') + '</span><br>' +
                    '<span style="font-size:11px; color:#fcae91;"><b>Estrategia:</b> ' + (p.ESTRATEGIA || 'Sin dato') + '</span>';
            }
        }

        summaryDiv.innerHTML = texto;
        summaryDiv.style.display = 'block';
    }

    // Módulos de datos duros (esferas sobre el minimapa) — se refinan con la
    // población exacta del alcance actual (entidad drillada, región, o país
    // completo), ya calculada arriba como totales.POB_TOTAL.
    if (typeof window.actualizarModulosDatosDuros === 'function') {
        var etiquetaModulos = entidadClickeada ? entidadClickeada : (regionSel ? (REGION_NOMBRE_DISPLAY[regionSel] || regionSel) : 'México');
        window.actualizarModulosDatosDuros(null, 'Nacional', etiquetaModulos, totales.POB_TOTAL);
    }
}
