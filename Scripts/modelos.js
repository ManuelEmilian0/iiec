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

/** Paleta fija para los 4 clústeres del modelo de Ward */
var WARD_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f5a623'];
var WARD_N_CLUSTERS = 4;


// ---------------------------------------------------------
// ESTADO GLOBAL
// ---------------------------------------------------------

window._modelosState = {
    layer: null,
    edgesLayer: null,
    controlPanel: null,
    isActive: false,
    tipoActivo: null, // 'louvain' | 'ward'
    currentYear: 2022,
    metrica: 'EXP',
    _debounceTimer: null,
    _isLoading: false,
    _geojsonCache: {},
    _selectorInyectado: false,
    _dendroHitRegions: null
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

    // Contenedor propio, oculto hasta que se elija "Modelos Matemáticos" en el
    // selector de Tipo de Análisis (misma clase "mundial-modo-container" que
    // usa el contenedor de Flujos en escala_global.js para que ambos se
    // oculten entre sí desde ese mismo onchange).
    var modelosContainer = document.createElement('div');
    modelosContainer.id = 'modelos-container-mundial';
    modelosContainer.className = 'mundial-modo-container';
    modelosContainer.style.display = 'none';

    var selectModoMundial = document.getElementById('select-modo-mundial');
    if (selectModoMundial) {
        selectModoMundial.addEventListener('change', function () {
            modelosContainer.style.display = (this.value === 'modelos') ? 'block' : 'none';
            if (this.value !== 'modelos') _resetearModelos();
        });
    }

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
    optWard.textContent = 'Ward de Clusterización';
    select.appendChild(optWard);

    var optDendro = document.createElement('option');
    optDendro.value = 'dendrograma';
    optDendro.textContent = 'Dendrogramas';
    select.appendChild(optDendro);

    select.addEventListener('change', function() {
        if (this.value === 'louvain') {
            activarModeloLouvain();
        } else if (this.value === 'ward') {
            activarModeloWard();
        } else if (this.value === 'dendrograma') {
            activarModeloDendrograma();
        }
    });

    modelosContainer.appendChild(select);
    container.appendChild(modelosContainer);

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

    if (window._modelosState.isActive && window._modelosState.tipoActivo === 'louvain' && document.getElementById('modelos-control-panel')) {
        return;
    }

    window._modelosState.tipoActivo = 'louvain';
    crearPanelControlModelos();
    window._modelosState.isActive = true;

    // Auto-ejecutar con año 2022
    setTimeout(function() {
        ejecutarModeloLouvain();
    }, 300);
}


// ---------------------------------------------------------
// ACTIVAR MODELO WARD (Clusterización jerárquica)
// ---------------------------------------------------------

function activarModeloWard() {
    if (typeof showSection === 'function') {
        var inicio = document.getElementById('inicio');
        if (inicio) inicio.style.display = 'block';
        if (typeof map !== 'undefined' && map) {
            setTimeout(function() { map.invalidateSize(); }, 200);
        }
    }

    if (window._modelosState.isActive && window._modelosState.tipoActivo === 'ward' && document.getElementById('modelos-control-panel')) {
        return;
    }

    window._modelosState.tipoActivo = 'ward';
    crearPanelControlWard();
    window._modelosState.isActive = true;

    setTimeout(function() {
        ejecutarModeloWard();
    }, 300);
}


// ---------------------------------------------------------
// ACTIVAR MODELO DENDROGRAMA (árbol jerárquico completo de Ward)
// ---------------------------------------------------------

function activarModeloDendrograma() {
    if (typeof showSection === 'function') {
        var inicio = document.getElementById('inicio');
        if (inicio) inicio.style.display = 'block';
        if (typeof map !== 'undefined' && map) {
            setTimeout(function() { map.invalidateSize(); }, 200);
        }
    }

    if (window._modelosState.isActive && window._modelosState.tipoActivo === 'dendrograma' && document.getElementById('modelos-control-panel')) {
        return;
    }

    window._modelosState.tipoActivo = 'dendrograma';
    crearPanelControlDendrograma();
    window._modelosState.isActive = true;

    setTimeout(function() {
        ejecutarModeloDendrograma();
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
// CREAR PANEL DE CONTROL — WARD
// ---------------------------------------------------------

function crearPanelControlWard() {
    var prev = document.getElementById('modelos-control-panel');
    if (prev) prev.remove();

    var panel = document.createElement('div');
    panel.id = 'modelos-control-panel';
    panel.className = 'dashboard-box';

    var titulo = document.createElement('h4');
    titulo.className = 'panel-title';
    titulo.textContent = 'Ward de Clusterización';
    panel.appendChild(titulo);

    var nota = document.createElement('div');
    nota.style.cssText = 'font-size:11px; color:#aaa; margin-bottom:10px; line-height:1.4;';
    nota.textContent = 'Agrupa países en ' + WARD_N_CLUSTERS + ' clústeres según su similitud en Exportaciones (EXP) y Valor Agregado (VA), usando clusterización jerárquica de Ward.';
    panel.appendChild(nota);

    // Slider de año (mismo rango que Louvain)
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
            ejecutarModeloWard();
        }, 400);
    });
    yearContainer.appendChild(yearInput);
    panel.appendChild(yearContainer);

    // ── Industrias consideradas (mismas que Louvain, bloqueadas) ──
    var vendGroup = document.createElement('div');
    vendGroup.className = 'modelos-select-group';
    var vendLabel = document.createElement('label');
    vendLabel.textContent = 'Industrias consideradas';
    vendGroup.appendChild(vendLabel);

    var vendList = document.createElement('div');
    vendList.className = 'modelos-locked-list';

    var industrias = [
        { label: 'Eléctrica', code: 'ELCTRI' },
        { label: 'Electrónica', code: 'ELCTRO' },
        { label: 'SEIT (Serv. Información y Telecom)', code: 'ITSERV+TELECO' },
        { label: 'Automotriz', code: 'AUTOMO' }
    ];
    industrias.forEach(function(v) {
        var item = document.createElement('div');
        item.className = 'modelos-locked-industry';
        item.innerHTML = '<span class="lock-icon">🔒</span> ' + v.label +
            ' <span class="lock-code">(' + v.code + ')</span>';
        vendList.appendChild(item);
    });
    vendGroup.appendChild(vendList);
    panel.appendChild(vendGroup);

    // ── Botón Ejecutar ──
    var execBtn = document.createElement('button');
    execBtn.className = 'modelos-execute-btn';
    execBtn.id = 'modelos-exec-btn';
    execBtn.innerHTML = '⚡ Ejecutar Modelo';
    execBtn.addEventListener('click', ejecutarModeloWard);
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
// CREAR PANEL DE CONTROL — DENDROGRAMA
// ---------------------------------------------------------

function crearPanelControlDendrograma() {
    var prev = document.getElementById('modelos-control-panel');
    if (prev) prev.remove();

    var panel = document.createElement('div');
    panel.id = 'modelos-control-panel';
    panel.className = 'dashboard-box';

    var titulo = document.createElement('h4');
    titulo.className = 'panel-title';
    titulo.textContent = 'Dendrograma Jerárquico';
    panel.appendChild(titulo);

    var nota = document.createElement('div');
    nota.style.cssText = 'font-size:11px; color:#aaa; margin-bottom:10px; line-height:1.4;';
    nota.textContent = 'Muestra el árbol completo de agrupamiento de Ward: qué países se parecen más entre sí (se unen abajo) y cuáles son más distintos al resto (se unen hasta arriba), según Exportaciones y Valor Agregado.';
    panel.appendChild(nota);

    // Slider de año (mismo rango que Louvain/Ward)
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
            ejecutarModeloDendrograma();
        }, 400);
    });
    yearContainer.appendChild(yearInput);
    panel.appendChild(yearContainer);

    // ── Industrias consideradas (mismas que Louvain/Ward, bloqueadas) ──
    var vendGroup = document.createElement('div');
    vendGroup.className = 'modelos-select-group';
    var vendLabel = document.createElement('label');
    vendLabel.textContent = 'Industrias consideradas';
    vendGroup.appendChild(vendLabel);

    var vendList = document.createElement('div');
    vendList.className = 'modelos-locked-list';

    var industrias = [
        { label: 'Eléctrica', code: 'ELCTRI' },
        { label: 'Electrónica', code: 'ELCTRO' },
        { label: 'SEIT (Serv. Información y Telecom)', code: 'ITSERV+TELECO' },
        { label: 'Automotriz', code: 'AUTOMO' }
    ];
    industrias.forEach(function(v) {
        var item = document.createElement('div');
        item.className = 'modelos-locked-industry';
        item.innerHTML = '<span class="lock-icon">🔒</span> ' + v.label +
            ' <span class="lock-code">(' + v.code + ')</span>';
        vendList.appendChild(item);
    });
    vendGroup.appendChild(vendList);
    panel.appendChild(vendGroup);

    // ── Botón Ejecutar ──
    var execBtn = document.createElement('button');
    execBtn.className = 'modelos-execute-btn';
    execBtn.id = 'modelos-exec-btn';
    execBtn.innerHTML = '⚡ Ejecutar Modelo';
    execBtn.addEventListener('click', ejecutarModeloDendrograma);
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
    return AppData.load(url)
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
// PREPARAR DATOS PARA WARD (client-side)
// Adaptación del script de clusterización jerárquica (demanda_final /
// demanda_intermedia por país-industria-país) a los datos ICIO ya
// disponibles en el proyecto: en vez de esas dos variables, se usan
// Exportaciones (EXP) y Valor Agregado (VA) totales por país en las
// mismas industrias fijas que usa Louvain.
// ---------------------------------------------------------

function _prepararDatosWard(geojson, sectores, topN) {
    topN = topN || 30;
    var datos = [];

    geojson.features.forEach(function(f) {
        var p = f.properties;
        var expTotal = 0, vaTotal = 0;
        sectores.forEach(function(s) {
            expTotal += p[s + '_EXP'] || 0;
            vaTotal += p[s + '_VA'] || 0;
        });
        if (expTotal <= 0 && vaTotal <= 0) return;
        datos.push({
            id: p.id,
            label: p.name,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            expTotal: expTotal,
            vaTotal: vaTotal
        });
    });

    datos.sort(function(a, b) { return (b.expTotal + b.vaTotal) - (a.expTotal + a.vaTotal); });
    return datos.slice(0, topN);
}

/** Escala cada eje de una lista de puntos [x,y] al rango [0,1] (equivalente a MinMaxScaler). */
function _escalarMinMax(puntos) {
    var xs = puntos.map(function(p) { return p[0]; });
    var ys = puntos.map(function(p) { return p[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var rangeX = (maxX - minX) || 1, rangeY = (maxY - minY) || 1;
    return puntos.map(function(p) {
        return [(p[0] - minX) / rangeX, (p[1] - minY) / rangeY];
    });
}

/**
 * Clusterización jerárquica aglomerativa con criterio de Ward (equivalente a
 * scipy/sklearn linkage="ward"), implementada en JS puro para poder correr
 * 100% en el cliente. En cada paso fusiona el par de clústeres que produce el
 * menor incremento en la suma de cuadrados dentro de clúster:
 *   costo(i,j) = (n_i * n_j) / (n_i + n_j) * distancia_euclidiana²(centroide_i, centroide_j)
 * hasta llegar a k clústeres. Con ~30 países (n³ ≈ 27,000) el costo es trivial.
 */
function _wardClustering(puntos, k) {
    var clusters = puntos.map(function(p, i) {
        return { members: [i], size: 1, centroid: p.slice() };
    });

    function dist2(a, b) {
        var dx = a[0] - b[0], dy = a[1] - b[1];
        return dx * dx + dy * dy;
    }

    while (clusters.length > k) {
        var bi = -1, bj = -1, bestCost = Infinity;
        for (var i = 0; i < clusters.length; i++) {
            for (var j = i + 1; j < clusters.length; j++) {
                var ni = clusters[i].size, nj = clusters[j].size;
                var costo = (ni * nj / (ni + nj)) * dist2(clusters[i].centroid, clusters[j].centroid);
                if (costo < bestCost) { bestCost = costo; bi = i; bj = j; }
            }
        }
        var ci = clusters[bi], cj = clusters[bj];
        var nuevoSize = ci.size + cj.size;
        var nuevoCentroide = [
            (ci.centroid[0] * ci.size + cj.centroid[0] * cj.size) / nuevoSize,
            (ci.centroid[1] * ci.size + cj.centroid[1] * cj.size) / nuevoSize
        ];
        var fusionado = { members: ci.members.concat(cj.members), size: nuevoSize, centroid: nuevoCentroide };
        clusters.splice(bj, 1);
        clusters.splice(bi, 1);
        clusters.push(fusionado);
    }

    var labels = new Array(puntos.length);
    clusters.forEach(function(c, idx) {
        c.members.forEach(function(m) { labels[m] = idx; });
    });
    return labels;
}

/**
 * Igual que _wardClustering, pero sin detenerse en k clústeres: fusiona hasta
 * llegar a un solo clúster, registrando cada fusión (historial de enlaces,
 * equivalente a la matriz "linkage" de scipy) para poder dibujar el árbol
 * completo del dendrograma.
 */
function _wardLinkageCompleto(puntos) {
    var n = puntos.length;
    var clusters = puntos.map(function(p, i) {
        return { id: i, size: 1, centroid: p.slice() };
    });
    var siguienteId = n;
    var fusiones = []; // { a, b, dist, size, id }

    function dist2(a, b) {
        var dx = a[0] - b[0], dy = a[1] - b[1];
        return dx * dx + dy * dy;
    }

    while (clusters.length > 1) {
        var bi = -1, bj = -1, bestCost = Infinity;
        for (var i = 0; i < clusters.length; i++) {
            for (var j = i + 1; j < clusters.length; j++) {
                var ni = clusters[i].size, nj = clusters[j].size;
                var costo = (ni * nj / (ni + nj)) * dist2(clusters[i].centroid, clusters[j].centroid);
                if (costo < bestCost) { bestCost = costo; bi = i; bj = j; }
            }
        }
        var ci = clusters[bi], cj = clusters[bj];
        var nuevoSize = ci.size + cj.size;
        var nuevoCentroide = [
            (ci.centroid[0] * ci.size + cj.centroid[0] * cj.size) / nuevoSize,
            (ci.centroid[1] * ci.size + cj.centroid[1] * cj.size) / nuevoSize
        ];
        var nuevoId = siguienteId++;
        fusiones.push({ a: ci.id, b: cj.id, dist: Math.sqrt(bestCost), size: nuevoSize, id: nuevoId });

        clusters.splice(bj, 1);
        clusters.splice(bi, 1);
        clusters.push({ id: nuevoId, size: nuevoSize, centroid: nuevoCentroide });
    }

    return fusiones;
}

/**
 * Convierte el historial de fusiones en un árbol binario navegable y calcula
 * la posición horizontal (x) de cada hoja/nodo, evitando que las ramas se
 * crucen (recorrido en orden del árbol, igual que hace scipy internamente).
 */
function _construirArbolDendro(datos, fusiones) {
    var n = datos.length;
    var nodos = {};
    for (var i = 0; i < n; i++) {
        nodos[i] = {
            id: i, esHoja: true, height: 0, label: datos[i].id,
            nombreCompleto: datos[i].label || datos[i].id, leafIndex: i
        };
    }
    fusiones.forEach(function(f) {
        nodos[f.id] = {
            id: f.id, esHoja: false, height: f.dist,
            left: nodos[f.a], right: nodos[f.b]
        };
    });

    var raiz = nodos[fusiones[fusiones.length - 1].id];

    var ordenHojas = [];
    (function recorrer(nodo) {
        if (nodo.esHoja) { ordenHojas.push(nodo); return; }
        recorrer(nodo.left);
        recorrer(nodo.right);
    })(raiz);
    ordenHojas.forEach(function(nodo, idx) { nodo.x = idx; });

    (function calcularX(nodo) {
        if (nodo.esHoja) return nodo.x;
        var xIzq = calcularX(nodo.left);
        var xDer = calcularX(nodo.right);
        nodo.x = (xIzq + xDer) / 2;
        return nodo.x;
    })(raiz);

    (function propagarLeafIndex(nodo) {
        if (nodo.esHoja) return nodo.leafIndex;
        nodo.leafIndex = propagarLeafIndex(nodo.left);
        propagarLeafIndex(nodo.right);
        return nodo.leafIndex;
    })(raiz);

    return { raiz: raiz, n: n, ordenHojas: ordenHojas };
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

function ejecutarModeloWard() {
    if (window._modelosState._isLoading) return;

    var yearInput = document.getElementById('modelos-year-input');
    var year = yearInput ? parseInt(yearInput.value, 10) : window._modelosState.currentYear;

    window._modelosState._isLoading = true;
    _mostrarOverlayCarga();
    var btn = document.getElementById('modelos-exec-btn');
    if (btn) { btn.classList.add('loading'); btn.innerHTML = '<span class="modelos-spinner"></span> Procesando…'; }

    window._modelosState.currentYear = year;

    _cargarGeoJSON(year)
        .then(function(geojson) {
            var datos = _prepararDatosWard(geojson, SECTORES_FIJOS, 30);
            if (datos.length < WARD_N_CLUSTERS) {
                throw new Error('Datos insuficientes para ' + year + ' (se necesitan al menos ' + WARD_N_CLUSTERS + ' países con datos).');
            }

            var puntosEscalados = _escalarMinMax(datos.map(function(d) { return [d.expTotal, d.vaTotal]; }));
            var labels = _wardClustering(puntosEscalados, WARD_N_CLUSTERS);
            datos.forEach(function(d, i) { d.cluster = labels[i]; });

            limpiarCapaModelos();
            dibujarNodosWard(datos);
            actualizarLeyendaWard(datos, year);
            dibujarScatterWard(datos, year);
            mostrarToastModelos(year + ' — ' + datos.length + ' países en ' + WARD_N_CLUSTERS + ' clústeres', 'success');
        })
        .catch(function(err) {
            console.error('[Modelos-Ward] Error:', err);
            mostrarToastModelos('Error: ' + err.message, 'error');
        })
        .finally(function() {
            window._modelosState._isLoading = false;
            _ocultarOverlayCarga();
            if (btn) { btn.classList.remove('loading'); btn.innerHTML = '⚡ Ejecutar Modelo'; }
        });
}

function ejecutarModeloDendrograma() {
    if (window._modelosState._isLoading) return;

    var yearInput = document.getElementById('modelos-year-input');
    var year = yearInput ? parseInt(yearInput.value, 10) : window._modelosState.currentYear;

    window._modelosState._isLoading = true;
    _mostrarOverlayCarga();
    var btn = document.getElementById('modelos-exec-btn');
    if (btn) { btn.classList.add('loading'); btn.innerHTML = '<span class="modelos-spinner"></span> Procesando…'; }

    window._modelosState.currentYear = year;

    _cargarGeoJSON(year)
        .then(function(geojson) {
            var datos = _prepararDatosWard(geojson, SECTORES_FIJOS, 30);
            if (datos.length < WARD_N_CLUSTERS) {
                throw new Error('Datos insuficientes para ' + year + ' (se necesitan al menos ' + WARD_N_CLUSTERS + ' países con datos).');
            }

            var puntosEscalados = _escalarMinMax(datos.map(function(d) { return [d.expTotal, d.vaTotal]; }));
            var labels = _wardClustering(puntosEscalados, WARD_N_CLUSTERS);
            datos.forEach(function(d, i) { d.cluster = labels[i]; });

            var fusiones = _wardLinkageCompleto(puntosEscalados);
            var arbol = _construirArbolDendro(datos, fusiones);

            limpiarCapaModelos();
            dibujarDendrograma(datos, arbol, fusiones, year);
            mostrarToastModelos(year + ' — árbol de ' + datos.length + ' países', 'success');
        })
        .catch(function(err) {
            console.error('[Modelos-Dendrograma] Error:', err);
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
// DIBUJAR NODOS — WARD (sin aristas: son clústeres, no una red)
// ---------------------------------------------------------

function dibujarNodosWard(datos) {
    if (!datos || datos.length === 0) return;

    var group = L.featureGroup();
    window._modelosState.layer = group;

    var magnitudes = datos.map(function(d) { return d.expTotal + d.vaTotal; });
    var minM = Math.min.apply(null, magnitudes);
    var maxM = Math.max.apply(null, magnitudes);
    var rangeM = (maxM - minM) || 1;
    var minR = 6, maxR = 20;

    datos.forEach(function(d) {
        var m = d.expTotal + d.vaTotal;
        var radius = minR + ((m - minM) / rangeM) * (maxR - minR);
        var color = WARD_COLORS[d.cluster];

        var marker = L.circleMarker([d.lat, d.lon], {
            radius: radius, fillColor: color, color: '#fff',
            weight: 1.5, opacity: 1, fillOpacity: 0.85
        });
        marker._baseRadius = radius;

        marker.bindPopup(
            '<div style="font-family:\'Noto Sans\',sans-serif;font-size:13px;min-width:170px;">' +
            '<strong style="color:' + color + ';font-size:14px;">' + (d.label || d.id) + '</strong>' +
            ' <span style="color:#888;">(' + d.id + ')</span><br>' +
            '<hr style="border:0;border-top:1px solid #ccc;margin:5px 0;">' +
            'Clúster: <b style="color:' + color + '">' + (d.cluster + 1) + '</b><br>' +
            'Exportaciones: <b>$' + Math.round(d.expTotal).toLocaleString('en-US') + ' MDD</b><br>' +
            'Valor Agregado: <b>$' + Math.round(d.vaTotal).toLocaleString('en-US') + ' MDD</b></div>',
            { maxWidth: 280 }
        );

        marker.bindTooltip(d.id, {
            permanent: false, direction: 'top', offset: [0, -radius],
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
// LEYENDA — WARD (color por clúster + promedios para interpretación)
// ---------------------------------------------------------

function actualizarLeyendaWard(datos, year) {
    var prev = document.getElementById('modelos-legend');
    if (prev) prev.remove();
    if (!datos || datos.length === 0) return;

    var porCluster = [];
    for (var c = 0; c < WARD_N_CLUSTERS; c++) porCluster.push([]);
    datos.forEach(function(d) { porCluster[d.cluster].push(d); });

    var legend = document.createElement('div');
    legend.id = 'modelos-legend';
    legend.className = 'dashboard-box';

    var title = document.createElement('div');
    title.className = 'legend-title';
    title.textContent = 'Clústeres (Ward) — ' + year;
    legend.appendChild(title);

    var meta = document.createElement('div');
    meta.className = 'legend-meta';
    meta.textContent = datos.length + ' países · Ejes: Exportaciones y Valor Agregado';
    legend.appendChild(meta);

    porCluster.forEach(function(grupo, idx) {
        if (grupo.length === 0) return;
        var avgExp = grupo.reduce(function(s, d) { return s + d.expTotal; }, 0) / grupo.length;
        var avgVa = grupo.reduce(function(s, d) { return s + d.vaTotal; }, 0) / grupo.length;

        var item = document.createElement('div');
        item.className = 'legend-item';
        var dot = document.createElement('span');
        dot.className = 'legend-dot';
        dot.style.backgroundColor = WARD_COLORS[idx];
        item.appendChild(dot);
        item.appendChild(document.createTextNode('Clúster ' + (idx + 1)));
        var count = document.createElement('span');
        count.className = 'legend-count';
        count.textContent = grupo.length + ' países · EXP≈$' + Math.round(avgExp).toLocaleString('en-US') +
            ' · VA≈$' + Math.round(avgVa).toLocaleString('en-US') + ' MDD';
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
// DISPERSIÓN (Chart.js) — WARD
// Reutiliza el panel de estadísticas (#stats-overlay/#topGlobalChart) que
// ya usan las escalas Nacional/Estatal, siguiendo el mismo patrón de
// reutilización de contenedores compartidos que ya existe en el proyecto.
// ---------------------------------------------------------

/**
 * Texto interpretativo de la dispersión de Ward: qué representan los ejes y
 * por qué unos países quedan más alejados que otros. Se recalcula cada vez
 * que cambia el año (ver ejecutarModeloWard).
 */
function _generarSintesisWard(datos, year) {
    var porCluster = [];
    for (var c = 0; c < WARD_N_CLUSTERS; c++) porCluster.push([]);
    datos.forEach(function(d) { porCluster[d.cluster].push(d); });

    var grupos = porCluster
        .map(function(grupo, idx) { return { idx: idx, grupo: grupo }; })
        .filter(function(g) { return g.grupo.length > 0; })
        .sort(function(a, b) { return b.grupo.length - a.grupo.length; });

    var mayoritario = grupos[0];
    var atipicos = grupos.filter(function(g) { return g.grupo.length <= 2 && g !== mayoritario; });

    var texto = 'Cada punto es un país, ubicado según sus <b>Exportaciones</b> (eje X) y su <b>Valor Agregado</b> (eje Y) en <b>' + year +
        '</b>, sumando las industrias Eléctrica, Electrónica, SEIT y Automotriz. El color agrupa países con una combinación similar de ambas variables (clusterización de Ward). ';

    if (atipicos.length > 0) {
        var nombresAtipicos = atipicos
            .map(function(g) { return g.grupo.map(function(d) { return d.label || d.id; }).join(' y '); })
            .join(', ');
        var totalAtipicos = atipicos.reduce(function(s, g) { return s + g.grupo.length; }, 0);
        texto += '<b>' + nombresAtipicos + '</b> aparece' + (totalAtipicos > 1 ? 'n' : '') + ' separado' + (totalAtipicos > 1 ? 's' : '') +
            ' del resto porque su magnitud económica es mucho mayor a la de los demás ' + datos.length +
            ' países analizados — la distancia entre puntos refleja diferencia de escala económica, no cercanía geográfica. ';
    }

    if (mayoritario) {
        texto += 'El grupo más numeroso (<b>Clúster ' + (mayoritario.idx + 1) + '</b>, ' + mayoritario.grupo.length +
            ' países) concentra economías de magnitud más parecida entre sí, por lo que se ven agrupadas cerca del origen de la gráfica.';
    }

    return texto;
}

function dibujarScatterWard(datos, year) {
    var statsDiv = document.getElementById('stats-overlay');
    var statsContent = document.getElementById('stats-content');
    var titleText = document.getElementById('stats-title-text');
    var chartTitle = document.getElementById('topGlobalChartTitle');
    var chartContainer = document.getElementById('topGlobalChartContainer');
    var chartHr = document.getElementById('topGlobalChartHr');
    var canvas = document.getElementById('topGlobalChart');
    if (!statsDiv || !canvas || typeof Chart === 'undefined') return;

    statsDiv.style.display = 'block';
    if (statsContent) statsContent.classList.add('show');
    if (titleText) titleText.textContent = 'Dispersión de Clústeres';
    if (chartTitle) { chartTitle.style.display = 'block'; chartTitle.textContent = 'Exportaciones vs. Valor Agregado'; }
    if (chartHr) chartHr.style.display = 'block';
    if (chartContainer) chartContainer.style.display = 'block';

    if (window.topGlobalChartInstance) { window.topGlobalChartInstance.destroy(); window.topGlobalChartInstance = null; }

    var datasets = [];
    for (var idx = 0; idx < WARD_N_CLUSTERS; idx++) {
        var grupo = datos.filter(function(d) { return d.cluster === idx; });
        if (grupo.length === 0) continue;
        datasets.push({
            label: 'Clúster ' + (idx + 1),
            data: grupo.map(function(d) { return { x: d.expTotal, y: d.vaTotal, id: d.id }; }),
            backgroundColor: WARD_COLORS[idx],
            pointRadius: 5,
            pointHoverRadius: 7
        });
    }

    window.topGlobalChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#eee', font: { size: 10 } } },
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            var d = ctx.raw;
                            return d.id + ': EXP $' + Math.round(d.x).toLocaleString('en-US') +
                                'M · VA $' + Math.round(d.y).toLocaleString('en-US') + 'M';
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Exportaciones (MDD)', color: '#ccc' },
                    ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.08)' }
                },
                y: {
                    title: { display: true, text: 'Valor Agregado (MDD)', color: '#ccc' },
                    ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.08)' }
                }
            }
        }
    });

    var summaryDiv = document.getElementById('dynamic-summary-global');
    if (summaryDiv) {
        summaryDiv.innerHTML = _generarSintesisWard(datos, year || window._modelosState.currentYear);
        summaryDiv.style.display = 'block';
    }
}


// ---------------------------------------------------------
// DIBUJAR DENDROGRAMA (canvas 2D directo, sin Chart.js — un dendrograma
// no es un tipo de gráfica estándar de Chart.js)
// ---------------------------------------------------------

function dibujarDendrograma(datos, arbol, fusiones, year) {
    var statsDiv = document.getElementById('stats-overlay');
    var statsContent = document.getElementById('stats-content');
    var titleText = document.getElementById('stats-title-text');
    var chartTitle = document.getElementById('topGlobalChartTitle');
    var chartContainer = document.getElementById('topGlobalChartContainer');
    var chartHr = document.getElementById('topGlobalChartHr');
    var canvas = document.getElementById('topGlobalChart');
    if (!statsDiv || !canvas) return;

    statsDiv.style.display = 'block';
    if (statsContent) statsContent.classList.add('show');
    if (titleText) titleText.textContent = 'Árbol de Similitud';
    if (chartTitle) { chartTitle.style.display = 'block'; chartTitle.textContent = 'Dendrograma (Ward) — quién se parece a quién'; }
    if (chartHr) chartHr.style.display = 'block';
    if (chartContainer) chartContainer.style.display = 'block';

    // El canvas pudo haber quedado en manos de Chart.js (Ward); limpiarCapaModelos
    // ya destruye esa instancia antes de llegar aquí, pero se asegura de nuevo.
    if (window.topGlobalChartInstance) { window.topGlobalChartInstance.destroy(); window.topGlobalChartInstance = null; }

    var n = arbol.n;
    var dpr = window.devicePixelRatio || 1;
    var parent = canvas.parentElement;
    var wCss = parent.clientWidth || 300;
    var hCss = parent.clientHeight || 240;
    canvas.width = Math.round(wCss * dpr);
    canvas.height = Math.round(hCss * dpr);
    canvas.style.width = wCss + 'px';
    canvas.style.height = hCss + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, wCss, hCss);

    var margin = { top: 10, right: 10, bottom: 46, left: 32 };
    var plotW = Math.max(10, wCss - margin.left - margin.right);
    var plotH = Math.max(10, hCss - margin.top - margin.bottom);
    var maxHeight = arbol.raiz.height || 1;

    function pxX(x) { return margin.left + (n <= 1 ? plotW / 2 : (x / (n - 1)) * plotW); }
    function pxY(h) { return margin.top + plotH - (h / maxHeight) * plotH; }

    // Altura de corte equivalente a los mismos WARD_N_CLUSTERS que usa el modelo de Ward
    var corteHeight = null;
    if (fusiones.length >= WARD_N_CLUSTERS) {
        var idxUltimaAplicada = n - WARD_N_CLUSTERS - 1;
        var idxSiguiente = n - WARD_N_CLUSTERS;
        if (idxUltimaAplicada >= 0 && idxSiguiente < fusiones.length) {
            corteHeight = (fusiones[idxUltimaAplicada].dist + fusiones[idxSiguiente].dist) / 2;
        }
    }

    // ── Eje Y (líneas guía de distancia), dibujado primero como fondo ──
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.fillStyle = '#888';
    ctx.font = '8px "Noto Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.lineWidth = 1;
    var pasos = 4;
    for (var t = 0; t <= pasos; t++) {
        var hVal = (maxHeight / pasos) * t;
        var yLinea = pxY(hVal);
        ctx.beginPath();
        ctx.moveTo(margin.left, yLinea);
        ctx.lineTo(margin.left + plotW, yLinea);
        ctx.stroke();
        ctx.fillText(hVal.toFixed(2), margin.left - 4, yLinea + 3);
    }

    // ── Ramas del árbol (recursivo), coloreadas por clúster debajo del corte ──
    ctx.lineWidth = 1.3;
    (function dibujarNodo(nodo) {
        if (nodo.esHoja) return;
        var leftX = pxX(nodo.left.x), rightX = pxX(nodo.right.x);
        var y = pxY(nodo.height);
        var leftY = pxY(nodo.left.height || 0);
        var rightY = pxY(nodo.right.height || 0);

        var color = '#8a94a3'; // por encima del corte: neutral
        if (corteHeight !== null && nodo.height < corteHeight) {
            var d = datos[nodo.leafIndex];
            if (d && typeof d.cluster === 'number') color = WARD_COLORS[d.cluster] || color;
        }
        ctx.strokeStyle = color;

        ctx.beginPath();
        ctx.moveTo(leftX, leftY);
        ctx.lineTo(leftX, y);
        ctx.lineTo(rightX, y);
        ctx.lineTo(rightX, rightY);
        ctx.stroke();

        dibujarNodo(nodo.left);
        dibujarNodo(nodo.right);
    })(arbol.raiz);

    // ── Línea de corte (misma agrupación en 4 clústeres que Ward) ──
    if (corteHeight !== null) {
        var yCorte = pxY(corteHeight);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin.left, yCorte);
        ctx.lineTo(margin.left + plotW, yCorte);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#00e5ff';
        ctx.font = '9px "Noto Sans", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('corte en ' + WARD_N_CLUSTERS + ' clústeres', margin.left + plotW, yCorte - 3);
    }

    // ── Etiquetas de hojas (código de país), rotadas para que quepan ──
    ctx.fillStyle = '#ccc';
    ctx.font = '7px monospace';
    ctx.textAlign = 'right';
    arbol.ordenHojas.forEach(function(hoja) {
        var x = pxX(hoja.x);
        var yBase = margin.top + plotH;
        ctx.save();
        ctx.translate(x, yBase + 4);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(hoja.label, 0, 0);
        ctx.restore();
    });

    // ── Zonas interactivas: al pasar el mouse por una hoja o una barra de
    // fusión, se muestra qué país(es) representa — el dendrograma por sí solo
    // no deja ver esto con solo mirar el árbol (sin representarlo en el mapa).
    var hitRegions = [];
    arbol.ordenHojas.forEach(function(hoja) {
        var x = pxX(hoja.x);
        hitRegions.push({
            tipo: 'hoja', x1: x - 6, x2: x + 6, y1: margin.top, y2: margin.top + plotH,
            titulo: hoja.nombreCompleto + ' (' + hoja.label + ')', detalle: null
        });
    });
    (function recolectarNodos(nodo) {
        if (nodo.esHoja) return;
        var leftX = pxX(nodo.left.x), rightX = pxX(nodo.right.x);
        var y = pxY(nodo.height);
        var nombres = _recolectarNombres(nodo);
        hitRegions.push({
            tipo: 'nodo', x1: Math.min(leftX, rightX), x2: Math.max(leftX, rightX), y1: y - 5, y2: y + 5,
            titulo: nombres.length + ' países se agrupan aquí:', detalle: nombres
        });
        recolectarNodos(nodo.left);
        recolectarNodos(nodo.right);
    })(arbol.raiz);

    window._modelosState._dendroHitRegions = hitRegions;
    _activarHoverDendrograma(canvas);

    var summaryDiv = document.getElementById('dynamic-summary-global');
    if (summaryDiv) {
        summaryDiv.innerHTML = _generarSintesisDendrograma(datos, fusiones, year || window._modelosState.currentYear);
        summaryDiv.style.display = 'block';
    }
}

/** Recolecta recursivamente los nombres completos de todas las hojas bajo un nodo. */
function _recolectarNombres(nodo) {
    if (nodo.esHoja) return [nodo.nombreCompleto || nodo.label];
    return _recolectarNombres(nodo.left).concat(_recolectarNombres(nodo.right));
}

/**
 * Activa (una sola vez por canvas) un tooltip flotante que responde al mouse:
 * sobre una hoja muestra el país; sobre una barra de fusión, todos los países
 * que agrupa esa rama. Lee las zonas activas de window._modelosState._dendroHitRegions,
 * que se reemplazan cada vez que se redibuja el árbol (cambio de año).
 */
function _activarHoverDendrograma(canvas) {
    if (canvas._dendroHoverAttached) return;
    canvas._dendroHoverAttached = true;

    var tooltip = document.createElement('div');
    tooltip.id = 'modelos-dendro-tooltip';
    tooltip.style.cssText = 'position:fixed; z-index:10700; background:rgba(17,17,17,0.95); ' +
        'border:1px solid #00e5ff; color:#eee; font-family:"Noto Sans",sans-serif; font-size:11px; ' +
        'padding:6px 9px; border-radius:5px; max-width:230px; pointer-events:none; display:none; ' +
        'box-shadow:0 2px 8px rgba(0,0,0,0.5); line-height:1.4;';
    document.body.appendChild(tooltip);

    canvas.addEventListener('mousemove', function (e) {
        var regiones = window._modelosState._dendroHitRegions;
        if (!regiones) { tooltip.style.display = 'none'; return; }

        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;

        // Las hojas (columnas verticales) tienen prioridad por ser más específicas.
        var candidato = regiones.find(function (r) {
            return r.tipo === 'hoja' && mx >= r.x1 && mx <= r.x2 && my >= r.y1 && my <= r.y2;
        });

        if (!candidato) {
            var mejorDist = 8; // tolerancia en px
            regiones.forEach(function (r) {
                if (r.tipo !== 'nodo') return;
                if (mx < r.x1 - 2 || mx > r.x2 + 2) return;
                var centroY = (r.y1 + r.y2) / 2;
                var d = Math.abs(my - centroY);
                if (d < mejorDist) { mejorDist = d; candidato = r; }
            });
        }

        if (candidato) {
            var html = '<b style="color:#00e5ff;">' + candidato.titulo + '</b>';
            if (candidato.detalle) {
                var lista = candidato.detalle.slice(0, 10).join(', ') +
                    (candidato.detalle.length > 10 ? ', …' : '');
                html += '<br>' + lista;
            }
            tooltip.innerHTML = html;
            tooltip.style.left = (e.clientX + 14) + 'px';
            tooltip.style.top = (e.clientY + 14) + 'px';
            tooltip.style.display = 'block';
            canvas.style.cursor = 'pointer';
        } else {
            tooltip.style.display = 'none';
            canvas.style.cursor = 'default';
        }
    });

    canvas.addEventListener('mouseleave', function () {
        tooltip.style.display = 'none';
    });
}

/**
 * Texto interpretativo del dendrograma: qué significa la altura de cada
 * fusión, cuál es el par de países más parecido (primera fusión del árbol)
 * y cuáles son los más distintos (los que se unen hasta arriba).
 */
function _generarSintesisDendrograma(datos, fusiones, year) {
    var n = datos.length;

    var porCluster = [];
    for (var c = 0; c < WARD_N_CLUSTERS; c++) porCluster.push([]);
    datos.forEach(function(d) { porCluster[d.cluster].push(d); });
    var grupos = porCluster
        .map(function(grupo, idx) { return { idx: idx, grupo: grupo }; })
        .filter(function(g) { return g.grupo.length > 0; })
        .sort(function(a, b) { return b.grupo.length - a.grupo.length; });
    var atipicos = grupos.slice(1).filter(function(g) { return g.grupo.length <= 2; });

    var texto = 'Este árbol agrupa a los ' + n + ' países de abajo hacia arriba: entre más bajo se unen dos ramas, más parecidos son esos países en Exportaciones y Valor Agregado en <b>' + year +
        '</b>; entre más alto se unen, más distintos son entre sí. ';

    var primeraFusion = fusiones[0];
    if (primeraFusion) {
        var paisA = datos[primeraFusion.a] ? (datos[primeraFusion.a].label || datos[primeraFusion.a].id) : null;
        var paisB = datos[primeraFusion.b] ? (datos[primeraFusion.b].label || datos[primeraFusion.b].id) : null;
        if (paisA && paisB) {
            texto += 'El par más parecido es <b>' + paisA + '</b> y <b>' + paisB + '</b>, la primera rama que se fusiona por tener una combinación casi idéntica de ambas variables. ';
        }
    }

    if (atipicos.length > 0) {
        var nombres = atipicos
            .map(function(g) { return g.grupo.map(function(d) { return d.label || d.id; }).join(' y '); })
            .join(', ');
        texto += '<b>' + nombres + '</b> se ' + (atipicos.reduce(function(s, g) { return s + g.grupo.length; }, 0) > 1 ? 'unen' : 'une') +
            ' hasta arriba del árbol porque su magnitud económica es muy distinta a la del resto — por eso su rama llega hasta el punto más alto. ';
    }

    texto += 'La línea punteada marca el mismo corte en ' + WARD_N_CLUSTERS + ' clústeres que usa el modelo de Ward.';

    return texto;
}


// ---------------------------------------------------------
// LIMPIAR / CERRAR
// ---------------------------------------------------------

function limpiarCapaModelos() {
    if (window._modelosState.layer) { map.removeLayer(window._modelosState.layer); window._modelosState.layer = null; }
    if (window._modelosState.edgesLayer) { map.removeLayer(window._modelosState.edgesLayer); window._modelosState.edgesLayer = null; }
    var legend = document.getElementById('modelos-legend');
    if (legend) legend.remove();

    // Limpiar la gráfica (Ward/Dendrograma, si estaba activa) y el panel de
    // estadísticas que se le pidió prestado a las escalas Nacional/Estatal.
    if (window.topGlobalChartInstance) { window.topGlobalChartInstance.destroy(); window.topGlobalChartInstance = null; }
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'none';
    var summaryDiv = document.getElementById('dynamic-summary-global');
    if (summaryDiv) summaryDiv.style.display = 'none';
    var canvas = document.getElementById('topGlobalChart');
    if (canvas) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Desactivar el hover del dendrograma (si estaba activo) para que no
    // queden zonas interactivas fantasma sobre un canvas ya vacío.
    window._modelosState._dendroHitRegions = null;
    var dendroTooltip = document.getElementById('modelos-dendro-tooltip');
    if (dendroTooltip) dendroTooltip.style.display = 'none';
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
