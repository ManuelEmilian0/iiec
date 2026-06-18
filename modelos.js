/* =============================================================
   MODELOS.JS — Módulo de Modelos de red para el Geovisor IIEC
   Se inyecta como filter-item-wrapper dentro del sidebar Global.
   100% Frontend · Carga GeoJSON estáticos · Sin backend
   ============================================================= */

// ---------------------------------------------------------
// CONSTANTES
// ---------------------------------------------------------

var GEOJSON_BASE = 'Modelos/carto';

var CONTINENT_MAP = {
    'BGD':'asia','BRN':'asia','CHN':'asia','HKG':'asia',
    'IDN':'asia','IND':'asia','JPN':'asia','KAZ':'asia',
    'KHM':'asia','KOR':'asia','LAO':'asia','MMR':'asia',
    'MYS':'asia','PAK':'asia','PHL':'asia','SGP':'asia',
    'THA':'asia','TWN':'asia','VNM':'asia',
    'AUT':'europe','BEL':'europe','BGR':'europe','BLR':'europe',
    'CHE':'europe','CYP':'europe','CZE':'europe','DEU':'europe',
    'DNK':'europe','ESP':'europe','EST':'europe','FIN':'europe',
    'FRA':'europe','GBR':'europe','GRC':'europe','HRV':'europe',
    'HUN':'europe','IRL':'europe','ISL':'europe','ITA':'europe',
    'LTU':'europe','LUX':'europe','LVA':'europe','MLT':'europe',
    'NLD':'europe','NOR':'europe','POL':'europe','PRT':'europe',
    'ROU':'europe','RUS':'europe','SVK':'europe','SVN':'europe',
    'SWE':'europe','TUR':'europe','UKR':'europe',
    'ARG':'america','BRA':'america','CAN':'america','CHL':'america',
    'COL':'america','CRI':'america','MEX':'america','PER':'america',
    'USA':'america',
    'AGO':'other','ARE':'other','CIV':'other','CMR':'other',
    'COD':'other','EGY':'other','ISR':'other','JOR':'other',
    'MAR':'other','NGA':'other','SAU':'other','SEN':'other',
    'STP':'other','TUN':'other','ZAF':'other','ROW':'other'
};

var CONTINENT_COLORS = {
    'asia':'#d62728','europe':'#1f77b4','america':'#2ca02c','other':'#888888'
};

var CONTINENT_NAMES = {
    'asia':'Asia','europe':'Europa','america':'América','other':'Otros'
};

/** Sectores fijos (bloqueados) — vendedoras + compradora */
var SECTORES_FIJOS = ['ELCTRI', 'ELCTRO', 'ITSERV', 'TELECO', 'AUTOMO'];


// ---------------------------------------------------------
// ESTADO GLOBAL
// ---------------------------------------------------------

window._modelosState = {
    layer: null,
    edgesLayer: null,
    controlPanel: null,
    isActive: false,
    currentYear: 2022,
    metrica: 'EXP',
    _debounceTimer: null,
    _isLoading: false,
    _geojsonCache: {},
    _selectorInyectado: false
};


// ---------------------------------------------------------
// HOOK: Envolver showSection para limpiar modelos al ir a INICIO
// ---------------------------------------------------------

(function() {
    function _esperarYEnvolver() {
        if (typeof window.showSection === 'function' && !window.showSection._modelosWrapped) {
            var _orig = window.showSection;
            window.showSection = function(id) {
                // Limpiar modelos al ir a INICIO
                if (id === 'inicio') {
                    _resetearModelos();
                }
                _orig.call(this, id);
            };
            window.showSection._modelosWrapped = true;
        }
        // Envolver iniciarFiltroMundial_Paso1 para inyectar selector
        if (typeof window.iniciarFiltroMundial_Paso1 === 'function' && !window.iniciarFiltroMundial_Paso1._modelosWrapped) {
            var _origFiltro = window.iniciarFiltroMundial_Paso1;
            window.iniciarFiltroMundial_Paso1 = function(data) {
                _origFiltro.call(this, data);
                // Inyectar selector de modelos después de los filtros mundiales
                setTimeout(function() { inyectarSelectorModelos(); }, 50);
            };
            window.iniciarFiltroMundial_Paso1._modelosWrapped = true;
        }
    }

    // Intentar envolver ahora y también cuando el DOM esté listo
    _esperarYEnvolver();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            _esperarYEnvolver();
            // Inyectar si el sidebar ya existe
            setTimeout(function() { inyectarSelectorModelos(); }, 500);
        });
    } else {
        setTimeout(function() {
            _esperarYEnvolver();
            inyectarSelectorModelos();
        }, 500);
    }
})();


// ---------------------------------------------------------
// RESETEAR MODELOS (al hacer clic en INICIO)
// ---------------------------------------------------------

function _resetearModelos() {
    clearTimeout(window._modelosState._debounceTimer);
    limpiarCapaModelos();
    _ocultarOverlayCarga();

    var panel = document.getElementById('modelos-control-panel');
    if (panel) panel.remove();

    window._modelosState.isActive = false;
    window._modelosState.controlPanel = null;
    window._modelosState._isLoading = false;

    // Reset selector
    var sel = document.getElementById('modelos-tipo-select');
    if (sel) sel.selectedIndex = 0;
}


// ---------------------------------------------------------
// INYECTAR SELECTOR DE MODELOS en filter-buttons-container
// ---------------------------------------------------------

function inyectarSelectorModelos() {
    // No duplicar
    if (document.getElementById('modelos-tipo-select')) return;

    var container = document.getElementById('filter-buttons-container');
    if (!container) return;

    // Crear el <select>
    var select = document.createElement('select');
    select.id = 'modelos-tipo-select';
    select.className = 'dynamic-filter-select';

    var optDefault = document.createElement('option');
    optDefault.value = '';
    optDefault.disabled = true;
    optDefault.selected = true;
    optDefault.textContent = '-- Seleccione tipo de modelo --';
    select.appendChild(optDefault);

    var optLouvain = document.createElement('option');
    optLouvain.value = 'louvain';
    optLouvain.textContent = 'Louvain';
    select.appendChild(optLouvain);

    var optWard = document.createElement('option');
    optWard.value = 'ward';
    optWard.disabled = true;
    optWard.textContent = 'Ward de Clusterización (Próximamente)';
    select.appendChild(optWard);

    var optDendro = document.createElement('option');
    optDendro.value = 'dendrograma';
    optDendro.disabled = true;
    optDendro.textContent = 'Dendrogramas (Próximamente)';
    select.appendChild(optDendro);

    select.addEventListener('change', function() {
        if (this.value === 'louvain') {
            activarModeloLouvain();
        }
    });

    // Insertar en el container (el monkey-patch lo envuelve en filter-item-wrapper)
    container.appendChild(select);

    window._modelosState._selectorInyectado = true;
}


// ---------------------------------------------------------
// ACTIVAR MODELO LOUVAIN
// ---------------------------------------------------------

function activarModeloLouvain() {
    if (typeof showSection === 'function') {
        // No llamar showSection para evitar resetear; solo asegurar que mapa visible
        var inicio = document.getElementById('inicio');
        if (inicio) inicio.style.display = 'block';
        if (typeof map !== 'undefined' && map) {
            setTimeout(function() { map.invalidateSize(); }, 200);
        }
    }

    if (window._modelosState.isActive && document.getElementById('modelos-control-panel')) {
        return;
    }

    crearPanelControlModelos();
    window._modelosState.isActive = true;

    // Auto-ejecutar con año 2022
    setTimeout(function() {
        ejecutarModeloLouvain();
    }, 300);
}


// ---------------------------------------------------------
// CREAR PANEL DE CONTROL (industrias bloqueadas)
// ---------------------------------------------------------

function crearPanelControlModelos() {
    var prev = document.getElementById('modelos-control-panel');
    if (prev) prev.remove();

    var panel = document.createElement('div');
    panel.id = 'modelos-control-panel';
    panel.className = 'dashboard-box';

    // Título
    var titulo = document.createElement('h4');
    titulo.className = 'panel-title';
    titulo.textContent = 'Modelo de Louvain';
    panel.appendChild(titulo);

    // Slider de año
    var yearContainer = document.createElement('div');
    yearContainer.className = 'modelos-year-slider';
    var yearLabel = document.createElement('label');
    yearLabel.innerHTML = 'Año: <span id="modelos-year-value" class="year-display">' +
        window._modelosState.currentYear + '</span>';
    yearContainer.appendChild(yearLabel);

    var yearInput = document.createElement('input');
    yearInput.type = 'range';
    yearInput.id = 'modelos-year-input';
    yearInput.min = '1995';
    yearInput.max = '2022';
    yearInput.value = String(window._modelosState.currentYear);
    yearInput.addEventListener('input', function() {
        var val = this.value;
        window._modelosState.currentYear = parseInt(val, 10);
        var display = document.getElementById('modelos-year-value');
        if (display) display.textContent = val;
        clearTimeout(window._modelosState._debounceTimer);
        window._modelosState._debounceTimer = setTimeout(function() {
            ejecutarModeloLouvain();
        }, 400);
    });
    yearContainer.appendChild(yearInput);
    panel.appendChild(yearContainer);

    // ── Industrias vendedoras (bloqueadas) ──
    var vendGroup = document.createElement('div');
    vendGroup.className = 'modelos-select-group';
    var vendLabel = document.createElement('label');
    vendLabel.textContent = 'Industria Vendedora';
    vendGroup.appendChild(vendLabel);

    var vendList = document.createElement('div');
    vendList.className = 'modelos-locked-list';

    var vendedoras = [
        { label: 'Eléctrica', code: 'ELCTRI' },
        { label: 'Electrónica', code: 'ELCTRO' },
        { label: 'SEIT (Serv. Información y Telecom)', code: 'ITSERV+TELECO' }
    ];
    vendedoras.forEach(function(v) {
        var item = document.createElement('div');
        item.className = 'modelos-locked-industry';
        item.innerHTML = '<span class="lock-icon">🔒</span> ' + v.label +
            ' <span class="lock-code">(' + v.code + ')</span>';
        vendList.appendChild(item);
    });
    vendGroup.appendChild(vendList);
    panel.appendChild(vendGroup);

    // ── Industria compradora (bloqueada) ──
    var compGroup = document.createElement('div');
    compGroup.className = 'modelos-select-group';
    var compLabel = document.createElement('label');
    compLabel.textContent = 'Industria Compradora';
    compGroup.appendChild(compLabel);
    var compLocked = document.createElement('div');
    compLocked.className = 'modelos-locked-industry';
    compLocked.innerHTML = '<span class="lock-icon">🔒</span> Automotriz <span class="lock-code">(AUTOMO)</span>';
    compGroup.appendChild(compLocked);
    panel.appendChild(compGroup);

    // ── Selector de métrica ──
    var metricaGroup = document.createElement('div');
    metricaGroup.className = 'modelos-select-group';
    var metricaLabel = document.createElement('label');
    metricaLabel.textContent = 'Métrica';
    metricaGroup.appendChild(metricaLabel);
    var metricaSelect = document.createElement('select');
    metricaSelect.id = 'modelos-metrica';
    metricaSelect.className = 'modelos-select';
    var optEXP = document.createElement('option');
    optEXP.value = 'EXP'; optEXP.textContent = 'Exportaciones (EXP)';
    metricaSelect.appendChild(optEXP);
    var optVA = document.createElement('option');
    optVA.value = 'VA'; optVA.textContent = 'Valor Agregado (VA)';
    metricaSelect.appendChild(optVA);
    metricaSelect.value = window._modelosState.metrica;
    metricaSelect.addEventListener('change', function() {
        window._modelosState.metrica = this.value;
    });
    metricaGroup.appendChild(metricaSelect);
    panel.appendChild(metricaGroup);

    // ── Botón Ejecutar ──
    var execBtn = document.createElement('button');
    execBtn.className = 'modelos-execute-btn';
    execBtn.id = 'modelos-exec-btn';
    execBtn.innerHTML = '⚡ Ejecutar Modelo';
    execBtn.addEventListener('click', ejecutarModeloLouvain);
    panel.appendChild(execBtn);

    // ── Botón Cerrar ──
    var closeBtn = document.createElement('button');
    closeBtn.className = 'modelos-close-btn';
    closeBtn.innerHTML = '✕ Cerrar Modelo';
    closeBtn.addEventListener('click', function() {
        _resetearModelos();
        mostrarToastModelos('Modelo cerrado', 'info');
    });
    panel.appendChild(closeBtn);

    // Insertar ANTES del filter-container-box (encima de INTERCAMBIOS GLOBALES)
    var filterBox = document.getElementById('filter-container-box');
    if (filterBox && filterBox.parentNode) {
        filterBox.parentNode.insertBefore(panel, filterBox);
    } else {
        var sidebar = document.getElementById('left-sidebar-container');
        if (sidebar) { sidebar.prepend(panel); }
        else { document.body.appendChild(panel); }
    }

    window._modelosState.controlPanel = panel;
}


// ---------------------------------------------------------
// COLORES
// ---------------------------------------------------------

function _getColorPais(code) {
    return CONTINENT_COLORS[CONTINENT_MAP[code] || 'other'] || CONTINENT_COLORS['other'];
}

function _getContinente(code) {
    return CONTINENT_MAP[code] || 'other';
}


// ---------------------------------------------------------
// OVERLAY DE CARGA
// ---------------------------------------------------------

function _mostrarOverlayCarga() {
    if (document.getElementById('modelos-loading-overlay')) return;
    var mapEl = document.getElementById('map');
    if (!mapEl) return;
    var overlay = document.createElement('div');
    overlay.id = 'modelos-loading-overlay';
    overlay.innerHTML =
        '<div class="modelos-loading-content">' +
        '<span class="modelos-spinner large"></span>' +
        '<div style="margin-top:12px;">Ejecutando modelo, por favor espere...</div>' +
        '</div>';
    mapEl.appendChild(overlay);
}

function _ocultarOverlayCarga() {
    var el = document.getElementById('modelos-loading-overlay');
    if (el) el.remove();
}


// ---------------------------------------------------------
// CARGAR GEOJSON (con cache)
// ---------------------------------------------------------

function _cargarGeoJSON(year) {
    if (window._modelosState._geojsonCache[year]) {
        return Promise.resolve(window._modelosState._geojsonCache[year]);
    }
    var url = GEOJSON_BASE + '/ICIO_DATA_' + year + '.geojson';
    return fetch(url)
        .then(function(res) {
            if (!res.ok) throw new Error('No se encontró GeoJSON para ' + year);
            return res.json();
        })
        .then(function(data) {
            window._modelosState._geojsonCache[year] = data;
            return data;
        });
}


// ---------------------------------------------------------
// CONSTRUIR GRAFO (client-side)
// ---------------------------------------------------------

function _construirGrafo(geojson, sectores, metrica, topN) {
    topN = topN || 30;

    var countryData = {};
    geojson.features.forEach(function(f) {
        var p = f.properties;
        var id = p.id;
        var total = 0;
        var sectorValues = {};
        sectores.forEach(function(s) {
            var val = p[s + '_' + metrica] || 0;
            total += val;
            sectorValues[s] = val;
        });
        countryData[id] = { total: total, sectors: sectorValues, feature: f };
    });

    var sorted = Object.keys(countryData)
        .filter(function(c) { return countryData[c].total > 0; })
        .sort(function(a, b) { return countryData[b].total - countryData[a].total; })
        .slice(0, topN);

    if (sorted.length === 0) return { nodes: [], edges: [] };

    // Aristas: Σ min(valor_i, valor_j) por sector compartido
    var allEdges = [];
    for (var i = 0; i < sorted.length; i++) {
        for (var j = i + 1; j < sorted.length; j++) {
            var ci = sorted[i], cj = sorted[j], weight = 0;
            sectores.forEach(function(s) {
                var vi = countryData[ci].sectors[s] || 0;
                var vj = countryData[cj].sectors[s] || 0;
                if (vi > 0 && vj > 0) weight += Math.min(vi, vj);
            });
            if (weight > 0) allEdges.push({ source: ci, target: cj, weight: Math.round(weight * 100) / 100 });
        }
    }

    // Top 5 aristas por nodo
    var edgesByNode = {};
    allEdges.forEach(function(e) {
        if (!edgesByNode[e.source]) edgesByNode[e.source] = [];
        if (!edgesByNode[e.target]) edgesByNode[e.target] = [];
        edgesByNode[e.source].push(e);
        edgesByNode[e.target].push(e);
    });
    var selectedKeys = {};
    Object.keys(edgesByNode).forEach(function(node) {
        edgesByNode[node].sort(function(a, b) { return b.weight - a.weight; }).slice(0, 5)
            .forEach(function(e) { selectedKeys[[e.source, e.target].sort().join('|')] = e; });
    });
    var edges = Object.keys(selectedKeys).map(function(k) { return selectedKeys[k]; })
        .sort(function(a, b) { return b.weight - a.weight; });

    // Normalizar tamaños [80, 300]
    var totals = sorted.map(function(c) { return countryData[c].total; });
    var minT = Math.min.apply(null, totals);
    var maxT = Math.max.apply(null, totals);
    var rangeT = maxT - minT || 1;

    var nodes = sorted.map(function(c) {
        var f = countryData[c].feature;
        return {
            id: c,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            label: f.properties.name,
            size: Math.round((80 + ((countryData[c].total - minT) / rangeT) * 220) * 100) / 100,
            continent: f.properties.continent || _getContinente(c)
        };
    });

    return { nodes: nodes, edges: edges };
}


// ---------------------------------------------------------
// EJECUTAR MODELO
// ---------------------------------------------------------

function ejecutarModeloLouvain() {
    if (window._modelosState._isLoading) return;

    var yearInput = document.getElementById('modelos-year-input');
    var year = yearInput ? parseInt(yearInput.value, 10) : window._modelosState.currentYear;
    var metricaSelect = document.getElementById('modelos-metrica');
    var metrica = metricaSelect ? metricaSelect.value : window._modelosState.metrica;

    window._modelosState._isLoading = true;
    _mostrarOverlayCarga();
    var btn = document.getElementById('modelos-exec-btn');
    if (btn) { btn.classList.add('loading'); btn.innerHTML = '<span class="modelos-spinner"></span> Procesando…'; }

    window._modelosState.currentYear = year;
    window._modelosState.metrica = metrica;

    _cargarGeoJSON(year)
        .then(function(geojson) {
            var result = _construirGrafo(geojson, SECTORES_FIJOS, metrica);
            limpiarCapaModelos();
            dibujarEdgesLouvain(result);
            dibujarNodosLouvain(result);
            actualizarLeyendaModelos(result);
            mostrarToastModelos(year + ' — ' + result.nodes.length + ' países', 'success');
        })
        .catch(function(err) {
            console.error('[Modelos] Error:', err);
            mostrarToastModelos('Error: ' + err.message, 'error');
        })
        .finally(function() {
            window._modelosState._isLoading = false;
            _ocultarOverlayCarga();
            if (btn) { btn.classList.remove('loading'); btn.innerHTML = '⚡ Ejecutar Modelo'; }
        });
}


// ---------------------------------------------------------
// DIBUJAR NODOS
// ---------------------------------------------------------

function dibujarNodosLouvain(data) {
    if (!data || !data.nodes || data.nodes.length === 0) return;

    var group = L.featureGroup();
    window._modelosState.layer = group;
    var metricLabel = window._modelosState.metrica === 'VA' ? 'Valor Agregado' : 'Exportaciones';

    // Determinar qué países muestran label permanente:
    // Top 10 por tamaño + obligatorios (USA, CHN, MEX, JPN)
    var OBLIGATORIOS = ['USA', 'CHN', 'MEX', 'JPN'];
    var sortedBySize = data.nodes.slice().sort(function(a, b) { return b.size - a.size; });
    var top10Ids = {};
    sortedBySize.slice(0, 10).forEach(function(n) { top10Ids[n.id] = true; });
    OBLIGATORIOS.forEach(function(id) { top10Ids[id] = true; });

    data.nodes.forEach(function(node) {
        var minS = 80, maxS = 300, minR = 6, maxR = 20;
        var clamped = Math.max(minS, Math.min(maxS, node.size || 100));
        var radius = minR + ((clamped - minS) / (maxS - minS)) * (maxR - minR);
        var color = _getColorPais(node.id);
        var contNombre = CONTINENT_NAMES[_getContinente(node.id)] || 'Otros';

        var marker = L.circleMarker([node.lat, node.lon], {
            radius: radius, fillColor: color, color: '#fff',
            weight: 1.5, opacity: 1, fillOpacity: 0.85
        });
        marker._baseRadius = radius;

        marker.bindPopup(
            '<div style="font-family:\'Noto Sans\',sans-serif;font-size:13px;min-width:160px;">' +
            '<strong style="color:' + color + ';font-size:14px;">' + (node.label || node.id) + '</strong>' +
            ' <span style="color:#888;">(' + node.id + ')</span><br>' +
            '<hr style="border:0;border-top:1px solid #ccc;margin:5px 0;">' +
            'Región: <b style="color:' + color + '">' + contNombre + '</b><br>' +
            metricLabel + ': <b>$' + Number(node.size).toLocaleString('en-US', {maximumFractionDigits:1}) + ' MDD</b></div>',
            { maxWidth: 280 }
        );

        // Label permanente solo para top 10 + obligatorios; el resto aparece al hover
        var esPermanente = !!top10Ids[node.id];
        marker.bindTooltip(node.id, {
            permanent: esPermanente, direction: 'top', offset: [0, -radius],
            className: 'modelos-tooltip', opacity: 0.85
        });

        marker.on('mouseover', function() { this.setRadius(this._baseRadius * 1.4); this.setStyle({weight:2.5,fillOpacity:1}); this.bringToFront(); });
        marker.on('mouseout', function() { this.setRadius(this._baseRadius); this.setStyle({weight:1.5,fillOpacity:0.85}); });

        group.addLayer(marker);
    });

    group.addTo(map);
    map.fitBounds(group.getBounds(), { padding: [40, 40] });
}


// ---------------------------------------------------------
// DIBUJAR ARISTAS
// ---------------------------------------------------------

function dibujarEdgesLouvain(data) {
    if (!data || !data.edges || data.edges.length === 0) return;

    var edgesGroup = L.featureGroup();
    window._modelosState.edgesLayer = edgesGroup;

    var nodeIndex = {};
    if (data.nodes) data.nodes.forEach(function(n) { nodeIndex[n.id] = n; });

    var weights = data.edges.map(function(e) { return e.weight || 0; });
    var maxW = Math.max.apply(null, weights);
    var minW = Math.min.apply(null, weights);
    var rangeW = maxW - minW || 1;

    data.edges.forEach(function(edge) {
        var src = nodeIndex[edge.source], tgt = nodeIndex[edge.target];
        if (!src || !tgt) return;

        var srcColor = _getColorPais(edge.source);
        var normalized = (edge.weight - minW) / rangeW;
        var w = 1 + normalized * 5;

        var line = L.polyline([[src.lat, src.lon], [tgt.lat, tgt.lon]], {
            color: srcColor, weight: w, opacity: 0.4, interactive: true
        });
        line._baseWeight = w;

        line.bindTooltip(
            edge.source + ' → ' + edge.target + ': $' +
            Number(edge.weight).toLocaleString('en-US', {maximumFractionDigits:0}) + ' MDD',
            { sticky: true, className: 'modelos-tooltip' }
        );

        line.on('mouseover', function() { this.setStyle({opacity:0.8,weight:this._baseWeight*1.8}); this.bringToFront(); });
        line.on('mouseout', function() { this.setStyle({opacity:0.4,weight:this._baseWeight}); });

        edgesGroup.addLayer(line);
    });

    edgesGroup.addTo(map);
    if (window._modelosState.layer) window._modelosState.layer.bringToFront();
}


// ---------------------------------------------------------
// LEYENDA
// ---------------------------------------------------------

function actualizarLeyendaModelos(data) {
    var prev = document.getElementById('modelos-legend');
    if (prev) prev.remove();
    if (!data || !data.nodes || data.nodes.length === 0) return;

    var conteo = { asia:0, europe:0, america:0, other:0 };
    data.nodes.forEach(function(n) { var c = _getContinente(n.id); conteo[c] = (conteo[c]||0) + 1; });

    var legend = document.createElement('div');
    legend.id = 'modelos-legend';
    legend.className = 'dashboard-box';

    var title = document.createElement('div');
    title.className = 'legend-title';
    title.textContent = 'Regiones — ' + window._modelosState.currentYear;
    legend.appendChild(title);

    var meta = document.createElement('div');
    meta.className = 'legend-meta';
    meta.textContent = (window._modelosState.metrica === 'VA' ? 'Valor Agregado' : 'Exportaciones') +
        ' · ' + data.nodes.length + ' países';
    legend.appendChild(meta);

    ['asia','europe','america','other'].forEach(function(key) {
        if (conteo[key] === 0) return;
        var item = document.createElement('div');
        item.className = 'legend-item';
        var dot = document.createElement('span');
        dot.className = 'legend-dot';
        dot.style.backgroundColor = CONTINENT_COLORS[key];
        item.appendChild(dot);
        item.appendChild(document.createTextNode(CONTINENT_NAMES[key]));
        var count = document.createElement('span');
        count.className = 'legend-count';
        count.textContent = conteo[key] + ' países';
        item.appendChild(count);
        legend.appendChild(item);
    });

    var controlPanel = document.getElementById('modelos-control-panel');
    if (controlPanel && controlPanel.parentNode) {
        controlPanel.parentNode.insertBefore(legend, controlPanel.nextSibling);
    } else {
        var sidebar = document.getElementById('left-sidebar-container');
        if (sidebar) sidebar.appendChild(legend);
    }
}


// ---------------------------------------------------------
// LIMPIAR / CERRAR
// ---------------------------------------------------------

function limpiarCapaModelos() {
    if (window._modelosState.layer) { map.removeLayer(window._modelosState.layer); window._modelosState.layer = null; }
    if (window._modelosState.edgesLayer) { map.removeLayer(window._modelosState.edgesLayer); window._modelosState.edgesLayer = null; }
    var legend = document.getElementById('modelos-legend');
    if (legend) legend.remove();
}


// ---------------------------------------------------------
// TOAST
// ---------------------------------------------------------

function mostrarToastModelos(message, type) {
    type = type || 'info';
    var prev = document.querySelector('.modelos-toast');
    if (prev) prev.remove();
    var toast = document.createElement('div');
    toast.className = 'modelos-toast ' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.classList.add('dismiss');
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
    }, 3000);
}


// ---------------------------------------------------------
console.log('[Modelos] Módulo cargado — selector se inyecta en sidebar Global.');
