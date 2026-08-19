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
        <option value="productividad">Índice de crecimiento complejo (Evolución temporal)</option>
        <option value="censo">Censo Económico 2024</option>
        <option value="financiero">Indicadores Financieros Globales</option>
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
        }
    };

    container.appendChild(modoWrapper);
    container.appendChild(flujosContainer);
    container.appendChild(finanzasContainer);
    container.appendChild(productividadContainer);
    container.appendChild(censoContainer);
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

function dibujarGraficaEvolucion(estadosSeleccionados, anioDestacado) {
    if (typeof Chart === 'undefined') return;

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
        var lider = estadosSeleccionados[0];
        var primerAnio = labels[0] || "";
        var ultimoAnio = labels[labels.length - 1] || "";
        
        var indNombre = "la industria seleccionada";
        if (window.industriaActual === "IC_AUTOMOTRIZ") indNombre = "la industria automotriz";
        else if (window.industriaActual === "IC_ELECTRICA") indNombre = "la industria eléctrica";
        else if (window.industriaActual === "IC_ELECTRONICA") indNombre = "la industria electrónica";
        else if (window.industriaActual === "IC_SEIT") indNombre = "los servicios SEIT";
        
        var texto = `A lo largo del periodo analizado (${primerAnio} - ${ultimoAnio}), el estado de <b style="color:#00e5ff;">${lider}</b> se ha mantenido como el nodo más competitivo en <b style="color:#fcae91;">${indNombre}</b>, liderando la eficiencia del sector a nivel nacional. Las variaciones en la curva reflejan su resiliencia y adaptabilidad a los ciclos económicos globales.`;

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
// crecimiento complejo (actualizarLeyendaProductividad) y Finanzas
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
        var lider = estadosSeleccionados[0];
        var primerAnio = labels[0] || "";
        var ultimoAnio = labels[labels.length - 1] || "";

        var texto = `A lo largo del periodo analizado (${primerAnio} - ${ultimoAnio}), el estado de <b style="color:#00e5ff;">${lider}</b> se ha mantenido como el nodo más relevante en <b style="color:#fcae91;">${metricaLabel.toLowerCase()}</b> dentro del Censo Económico (sectores Electrónica, SEIT, Telecom y Medios).`;

        summaryDiv.innerHTML = texto;
        summaryDiv.style.display = 'block';
    }
}
