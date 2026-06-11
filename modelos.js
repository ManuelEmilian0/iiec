/* =============================================================
   MODELOS.JS — Módulo de Modelos de red (Louvain) para el Geovisor IIEC
   Vanilla JS · Leaflet.js · Colores continentales
   ============================================================= */

// ---------------------------------------------------------
// CONSTANTES
// ---------------------------------------------------------

const MODELOS_API_BASE = 'http://localhost:8000';

/**
 * Mapeo de países a continentes para colorear nodos y aristas.
 * Asia = rojo, Europa = azul, América = verde, Otros = gris.
 */
const CONTINENT_MAP = {
    // Asia (Rojo)
    'BGD': 'asia', 'BRN': 'asia', 'CHN': 'asia', 'HKG': 'asia',
    'IDN': 'asia', 'IND': 'asia', 'JPN': 'asia', 'KAZ': 'asia',
    'KHM': 'asia', 'KOR': 'asia', 'LAO': 'asia', 'MMR': 'asia',
    'MYS': 'asia', 'PAK': 'asia', 'PHL': 'asia', 'SGP': 'asia',
    'THA': 'asia', 'TWN': 'asia', 'VNM': 'asia',
    // Europa (Azul)
    'AUT': 'europe', 'BEL': 'europe', 'BGR': 'europe', 'BLR': 'europe',
    'CHE': 'europe', 'CYP': 'europe', 'CZE': 'europe', 'DEU': 'europe',
    'DNK': 'europe', 'ESP': 'europe', 'EST': 'europe', 'FIN': 'europe',
    'FRA': 'europe', 'GBR': 'europe', 'GRC': 'europe', 'HRV': 'europe',
    'HUN': 'europe', 'IRL': 'europe', 'ISL': 'europe', 'ITA': 'europe',
    'LTU': 'europe', 'LUX': 'europe', 'LVA': 'europe', 'MLT': 'europe',
    'NLD': 'europe', 'NOR': 'europe', 'POL': 'europe', 'PRT': 'europe',
    'ROU': 'europe', 'RUS': 'europe', 'SVK': 'europe', 'SVN': 'europe',
    'SWE': 'europe', 'TUR': 'europe', 'UKR': 'europe',
    // América (Verde)
    'ARG': 'america', 'BRA': 'america', 'CAN': 'america', 'CHL': 'america',
    'COL': 'america', 'CRI': 'america', 'MEX': 'america', 'PER': 'america',
    'USA': 'america',
    // Otros (Gris) — Medio Oriente, África, ROW
    'AGO': 'other', 'ARE': 'other', 'CIV': 'other', 'CMR': 'other',
    'COD': 'other', 'EGY': 'other', 'ISR': 'other', 'JOR': 'other',
    'MAR': 'other', 'NGA': 'other', 'SAU': 'other', 'SEN': 'other',
    'STP': 'other', 'TUN': 'other', 'ZAF': 'other', 'ROW': 'other',
};

const CONTINENT_COLORS = {
    'asia':    '#d62728',  // Rojo
    'europe':  '#1f77b4',  // Azul
    'america': '#2ca02c',  // Verde
    'other':   '#888888',  // Gris
};

const CONTINENT_NAMES = {
    'asia':    'Asia',
    'europe':  'Europa',
    'america': 'América',
    'other':   'Otros',
};

/**
 * Industrias vendedoras disponibles para selección.
 * Cada opción puede mapear a uno o más códigos de sector ICIO.
 */
const INDUSTRIAS_VENDEDORAS = [
    { id: 'ELCTRI', label: 'Eléctrica',   sectors: ['ELCTRI'] },
    { id: 'ELCTRO', label: 'Electrónica', sectors: ['ELCTRO'] },
    { id: 'SEIT',   label: 'SEIT (Serv. Información y Telecom)', sectors: ['ITSERV', 'TELECO'] },
];

/** Industria compradora fija */
const INDUSTRIA_COMPRADORA = { id: 'AUTOMO', label: 'Automotriz', sectors: ['AUTOMO'] };


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
};


// ---------------------------------------------------------
// DROPDOWN — Toggle del menú desplegable "Modelos"
// ---------------------------------------------------------

function toggleModelosDropdown(event) {
    if (event) event.stopPropagation();

    var dropdown = document.getElementById('modelos-dropdown');
    if (!dropdown) return;

    var isOpen = dropdown.classList.contains('open');

    document.querySelectorAll('.nav-dropdown.open').forEach(function(d) {
        d.classList.remove('open');
    });

    if (!isOpen) {
        var btn = dropdown.querySelector('.nav-button');
        var content = dropdown.querySelector('.nav-dropdown-content');
        if (btn && content) {
            var rect = btn.getBoundingClientRect();
            content.style.top = rect.bottom + 'px';
            content.style.left = rect.left + 'px';
        }
        dropdown.classList.add('open');
        setTimeout(function() {
            document.addEventListener('click', _cerrarDropdownFuera);
        }, 0);
    } else {
        document.removeEventListener('click', _cerrarDropdownFuera);
    }
}

function _cerrarDropdownFuera(e) {
    var dropdown = document.getElementById('modelos-dropdown');
    if (!dropdown) return;
    var content = dropdown.querySelector('.nav-dropdown-content');
    if (!dropdown.contains(e.target) && (!content || !content.contains(e.target))) {
        dropdown.classList.remove('open');
        document.removeEventListener('click', _cerrarDropdownFuera);
    }
}


// ---------------------------------------------------------
// ACTIVAR MODELO LOUVAIN
// ---------------------------------------------------------

function activarModeloLouvain() {
    // Cerrar dropdown
    var dropdown = document.getElementById('modelos-dropdown');
    if (dropdown) dropdown.classList.remove('open');
    document.removeEventListener('click', _cerrarDropdownFuera);

    // Mostrar mapa
    if (typeof showSection === 'function') {
        showSection('inicio');
    }

    // Si ya está activo, no duplicar
    if (window._modelosState.isActive && document.getElementById('modelos-control-panel')) {
        mostrarToastModelos('El panel de Louvain ya está abierto', 'info');
        return;
    }

    // Crear panel y auto-ejecutar
    crearPanelControlModelos();
    window._modelosState.isActive = true;

    // Auto-ejecutar con año 2022
    setTimeout(function() {
        ejecutarModeloLouvain();
    }, 300);
}


// ---------------------------------------------------------
// CREAR PANEL DE CONTROL (Insumo-Producto)
// ---------------------------------------------------------

function crearPanelControlModelos() {
    var prev = document.getElementById('modelos-control-panel');
    if (prev) prev.remove();

    var panel = document.createElement('div');
    panel.id = 'modelos-control-panel';
    panel.className = 'dashboard-box';

    // --- Título ---
    var titulo = document.createElement('h4');
    titulo.className = 'panel-title';
    titulo.textContent = '🔬 Modelo de Louvain';
    panel.appendChild(titulo);

    // --- Slider de año ---
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

        // Auto-ejecutar con debounce
        clearTimeout(window._modelosState._debounceTimer);
        window._modelosState._debounceTimer = setTimeout(function() {
            ejecutarModeloLouvain();
        }, 400);
    });
    yearContainer.appendChild(yearInput);
    panel.appendChild(yearContainer);

    // --- Industria Vendedora (3 checkboxes) ---
    var vendGroup = document.createElement('div');
    vendGroup.className = 'modelos-select-group';

    var vendLabel = document.createElement('label');
    vendLabel.textContent = 'Industria Vendedora';
    vendGroup.appendChild(vendLabel);

    var vendList = document.createElement('div');
    vendList.className = 'modelos-multi-select';
    vendList.id = 'modelos-vendedoras-list';

    INDUSTRIAS_VENDEDORAS.forEach(function(ind) {
        var item = document.createElement('div');
        item.className = 'modelos-checkbox-item';

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = ind.id;
        cb.id = 'modelos-vend-' + ind.id;
        cb.checked = true; // Todas pre-seleccionadas
        cb.dataset.sectors = ind.sectors.join(',');

        var lbl = document.createElement('label');
        lbl.htmlFor = 'modelos-vend-' + ind.id;
        lbl.textContent = ind.label;

        item.appendChild(cb);
        item.appendChild(lbl);
        vendList.appendChild(item);
    });

    vendGroup.appendChild(vendList);
    panel.appendChild(vendGroup);

    // --- Industria Compradora (bloqueada) ---
    var compGroup = document.createElement('div');
    compGroup.className = 'modelos-select-group';

    var compLabel = document.createElement('label');
    compLabel.textContent = 'Industria Compradora';
    compGroup.appendChild(compLabel);

    var compLocked = document.createElement('div');
    compLocked.className = 'modelos-locked-industry';
    compLocked.innerHTML = '<span class="lock-icon">🔒</span> ' + INDUSTRIA_COMPRADORA.label + ' (' + INDUSTRIA_COMPRADORA.id + ')';
    compGroup.appendChild(compLocked);

    panel.appendChild(compGroup);

    // --- Selector de métrica ---
    var metricaGroup = document.createElement('div');
    metricaGroup.className = 'modelos-select-group';

    var metricaLabel = document.createElement('label');
    metricaLabel.textContent = 'Métrica';
    metricaGroup.appendChild(metricaLabel);

    var metricaSelect = document.createElement('select');
    metricaSelect.id = 'modelos-metrica';
    metricaSelect.className = 'modelos-select';

    var optEXP = document.createElement('option');
    optEXP.value = 'EXP';
    optEXP.textContent = 'Exportaciones (EXP)';
    metricaSelect.appendChild(optEXP);

    var optVA = document.createElement('option');
    optVA.value = 'VA';
    optVA.textContent = 'Valor Agregado (VA)';
    metricaSelect.appendChild(optVA);

    metricaSelect.value = window._modelosState.metrica;
    metricaSelect.addEventListener('change', function() {
        window._modelosState.metrica = this.value;
    });

    metricaGroup.appendChild(metricaSelect);
    panel.appendChild(metricaGroup);

    // --- Botón Ejecutar ---
    var execBtn = document.createElement('button');
    execBtn.className = 'modelos-execute-btn';
    execBtn.id = 'modelos-exec-btn';
    execBtn.innerHTML = '⚡ Ejecutar Modelo';
    execBtn.addEventListener('click', ejecutarModeloLouvain);
    panel.appendChild(execBtn);

    // --- Botón Cerrar ---
    var closeBtn = document.createElement('button');
    closeBtn.className = 'modelos-close-btn';
    closeBtn.innerHTML = '✕ Cerrar Modelos';
    closeBtn.addEventListener('click', cerrarModelos);
    panel.appendChild(closeBtn);

    // --- Insertar ANTES de filter-container-box (encima de INTERCAMBIOS GLOBALES) ---
    var filterBox = document.getElementById('filter-container-box');
    if (filterBox && filterBox.parentNode) {
        filterBox.parentNode.insertBefore(panel, filterBox);
    } else {
        var sidebar = document.getElementById('left-sidebar-container');
        if (sidebar) {
            sidebar.prepend(panel);
        } else {
            document.body.appendChild(panel);
        }
    }

    window._modelosState.controlPanel = panel;
}


// ---------------------------------------------------------
// OBTENER SECTORES SELECCIONADOS
// ---------------------------------------------------------

function _getSectoresSeleccionados() {
    var sectores = [];
    var checkboxes = document.querySelectorAll('#modelos-vendedoras-list input[type="checkbox"]:checked');
    checkboxes.forEach(function(cb) {
        var secs = cb.dataset.sectors.split(',');
        secs.forEach(function(s) {
            if (sectores.indexOf(s) === -1) sectores.push(s);
        });
    });
    // Siempre incluir la industria compradora
    INDUSTRIA_COMPRADORA.sectors.forEach(function(s) {
        if (sectores.indexOf(s) === -1) sectores.push(s);
    });
    return sectores;
}


// ---------------------------------------------------------
// COLOR POR CONTINENTE
// ---------------------------------------------------------

function _getColorPais(countryCode) {
    var continent = CONTINENT_MAP[countryCode] || 'other';
    return CONTINENT_COLORS[continent] || CONTINENT_COLORS['other'];
}

function _getContinente(countryCode) {
    return CONTINENT_MAP[countryCode] || 'other';
}


// ---------------------------------------------------------
// OVERLAY DE CARGA SOBRE EL MAPA
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
    var overlay = document.getElementById('modelos-loading-overlay');
    if (overlay) overlay.remove();
}


// ---------------------------------------------------------
// EJECUTAR MODELO LOUVAIN
// ---------------------------------------------------------

function ejecutarModeloLouvain() {
    // Evitar ejecuciones simultáneas
    if (window._modelosState._isLoading) return;

    // Obtener parámetros
    var yearInput = document.getElementById('modelos-year-input');
    var year = yearInput ? parseInt(yearInput.value, 10) : window._modelosState.currentYear;
    var sectores = _getSectoresSeleccionados();
    var metricaSelect = document.getElementById('modelos-metrica');
    var metrica = metricaSelect ? metricaSelect.value : window._modelosState.metrica;

    // Validar mínimo 1 industria vendedora
    var vendChecked = document.querySelectorAll('#modelos-vendedoras-list input[type="checkbox"]:checked');
    if (vendChecked.length < 1) {
        mostrarToastModelos('Selecciona al menos 1 industria vendedora', 'error');
        return;
    }

    // Mostrar carga
    window._modelosState._isLoading = true;
    _mostrarOverlayCarga();
    var btn = document.getElementById('modelos-exec-btn');
    if (btn) {
        btn.classList.add('loading');
        btn.innerHTML = '<span class="modelos-spinner"></span> Procesando…';
    }

    // Actualizar estado
    window._modelosState.currentYear = year;
    window._modelosState.metrica = metrica;

    // Fetch
    var url = MODELOS_API_BASE + '/api/modelo-louvain/' + year +
              '?sectores=' + sectores.join(',') +
              '&metrica=' + metrica;

    fetch(url)
        .then(function(res) {
            if (!res.ok) throw new Error('Error del servidor: ' + res.status);
            return res.json();
        })
        .then(function(data) {
            limpiarCapaModelos();
            dibujarEdgesLouvain(data);
            dibujarNodosLouvain(data);
            actualizarLeyendaModelos(data);
            mostrarToastModelos(year + ' — ' + (data.nodes ? data.nodes.length : 0) + ' países', 'success');
        })
        .catch(function(err) {
            console.error('[Modelos] Error:', err);
            mostrarToastModelos('Error: ' + err.message, 'error');
        })
        .finally(function() {
            window._modelosState._isLoading = false;
            _ocultarOverlayCarga();
            if (btn) {
                btn.classList.remove('loading');
                btn.innerHTML = '⚡ Ejecutar Modelo';
            }
        });
}


// ---------------------------------------------------------
// DIBUJAR NODOS — Coloreados por continente
// ---------------------------------------------------------

function dibujarNodosLouvain(data) {
    if (!data || !data.nodes || data.nodes.length === 0) return;

    var group = L.featureGroup();
    window._modelosState.layer = group;

    var metricLabel = window._modelosState.metrica === 'VA' ? 'Valor Agregado' : 'Exportaciones';

    data.nodes.forEach(function(node) {
        // Escalar radio: 80-300 → 6-20 px
        var minSize = 80, maxSize = 300, minR = 6, maxR = 20;
        var clamped = Math.max(minSize, Math.min(maxSize, node.size || 100));
        var radius = minR + ((clamped - minSize) / (maxSize - minSize)) * (maxR - minR);

        // Color por continente
        var color = _getColorPais(node.id);
        var continente = _getContinente(node.id);
        var continenteNombre = CONTINENT_NAMES[continente] || 'Otros';

        var marker = L.circleMarker([node.lat, node.lon], {
            radius: radius,
            fillColor: color,
            color: '#fff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.85,
        });

        marker._modelosData = node;
        marker._baseRadius = radius;

        // Popup
        var value = node.size || 0;
        var popupHTML =
            '<div style="font-family:\'Noto Sans\',sans-serif; font-size:13px; color:#222; min-width:160px;">' +
                '<strong style="color:' + color + '; font-size:14px;">' + (node.label || node.id) + '</strong>' +
                ' <span style="color:#666;">(' + node.id + ')</span><br>' +
                '<hr style="border:0; border-top:1px solid #ccc; margin:5px 0;">' +
                'Región: <b style="color:' + color + '">' + continenteNombre + '</b><br>' +
                'Comunidad Louvain: <b>' + (node.community + 1) + '</b><br>' +
                metricLabel + ': <b>$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' MDD</b>' +
            '</div>';
        marker.bindPopup(popupHTML, { maxWidth: 280 });

        // Tooltip permanente
        marker.bindTooltip(node.id, {
            permanent: true,
            direction: 'top',
            offset: [0, -radius],
            className: 'modelos-tooltip',
            opacity: 0.85,
        });

        // Hover: agrandar
        marker.on('mouseover', function() {
            this.setRadius(this._baseRadius * 1.4);
            this.setStyle({ weight: 2.5, fillOpacity: 1 });
            this.bringToFront();
        });
        marker.on('mouseout', function() {
            this.setRadius(this._baseRadius);
            this.setStyle({ weight: 1.5, fillOpacity: 0.85 });
        });

        group.addLayer(marker);
    });

    group.addTo(map);
    map.fitBounds(group.getBounds(), { padding: [40, 40] });
}


// ---------------------------------------------------------
// DIBUJAR ARISTAS — Color continental + grosor por peso
// ---------------------------------------------------------

function dibujarEdgesLouvain(data) {
    if (!data || !data.edges || data.edges.length === 0) return;

    var edgesGroup = L.featureGroup();
    window._modelosState.edgesLayer = edgesGroup;

    // Índice de nodos
    var nodeIndex = {};
    if (data.nodes) {
        data.nodes.forEach(function(n) { nodeIndex[n.id] = n; });
    }

    // Calcular rango de pesos para normalizar grosor
    var weights = data.edges.map(function(e) { return e.weight || 0; });
    var maxW = Math.max.apply(null, weights);
    var minW = Math.min.apply(null, weights);
    var rangeW = maxW - minW || 1;

    data.edges.forEach(function(edge) {
        var src = nodeIndex[edge.source];
        var tgt = nodeIndex[edge.target];
        if (!src || !tgt) return;

        // Color del nodo fuente (por continente)
        var srcColor = _getColorPais(edge.source);

        // Grosor normalizado: 1px (menor peso) a 6px (mayor peso)
        var normalized = (edge.weight - minW) / rangeW;
        var weight = 1 + normalized * 5;

        var line = L.polyline(
            [[src.lat, src.lon], [tgt.lat, tgt.lon]],
            {
                color: srcColor,
                weight: weight,
                opacity: 0.4,
                interactive: true,
            }
        );

        line._edgeData = edge;
        line._baseWeight = weight;
        line._baseOpacity = 0.4;

        // Tooltip con valor
        line.bindTooltip(
            edge.source + ' → ' + edge.target + ': $' +
            Number(edge.weight).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' MDD',
            { sticky: true, className: 'modelos-tooltip' }
        );

        // Hover: resaltar
        line.on('mouseover', function() {
            this.setStyle({ opacity: 0.8, weight: this._baseWeight * 1.8 });
            this.bringToFront();
        });
        line.on('mouseout', function() {
            this.setStyle({ opacity: this._baseOpacity, weight: this._baseWeight });
        });

        edgesGroup.addLayer(line);
    });

    edgesGroup.addTo(map);

    // Nodos al frente
    if (window._modelosState.layer) {
        window._modelosState.layer.bringToFront();
    }
}


// ---------------------------------------------------------
// LEYENDA — Por continente
// ---------------------------------------------------------

function actualizarLeyendaModelos(data) {
    var prev = document.getElementById('modelos-legend');
    if (prev) prev.remove();

    if (!data || !data.nodes || data.nodes.length === 0) return;

    // Contar nodos por continente
    var conteo = { asia: 0, europe: 0, america: 0, other: 0 };
    data.nodes.forEach(function(n) {
        var c = _getContinente(n.id);
        conteo[c] = (conteo[c] || 0) + 1;
    });

    var legend = document.createElement('div');
    legend.id = 'modelos-legend';
    legend.className = 'dashboard-box';

    // Título
    var title = document.createElement('div');
    title.className = 'legend-title';
    title.textContent = 'Regiones — ' + window._modelosState.currentYear;
    legend.appendChild(title);

    // Metadata
    var meta = document.createElement('div');
    meta.className = 'legend-meta';
    var metricName = window._modelosState.metrica === 'VA' ? 'Valor Agregado' : 'Exportaciones';
    meta.textContent = metricName + ' · ' + data.nodes.length + ' países · ' +
                       data.communities_count + ' comunidades Louvain';
    legend.appendChild(meta);

    // Items por continente
    var orden = ['asia', 'europe', 'america', 'other'];
    orden.forEach(function(key) {
        if (conteo[key] === 0) return;

        var item = document.createElement('div');
        item.className = 'legend-item';

        var dot = document.createElement('span');
        dot.className = 'legend-dot';
        dot.style.backgroundColor = CONTINENT_COLORS[key];

        var label = document.createTextNode(CONTINENT_NAMES[key]);

        var count = document.createElement('span');
        count.className = 'legend-count';
        count.textContent = conteo[key] + ' países';

        item.appendChild(dot);
        item.appendChild(label);
        item.appendChild(count);
        legend.appendChild(item);
    });

    // Insertar después del panel de control
    var controlPanel = document.getElementById('modelos-control-panel');
    if (controlPanel && controlPanel.parentNode) {
        controlPanel.parentNode.insertBefore(legend, controlPanel.nextSibling);
    } else {
        var sidebar = document.getElementById('left-sidebar-container');
        if (sidebar) sidebar.appendChild(legend);
    }
}


// ---------------------------------------------------------
// LIMPIAR CAPAS
// ---------------------------------------------------------

function limpiarCapaModelos() {
    if (window._modelosState.layer) {
        map.removeLayer(window._modelosState.layer);
        window._modelosState.layer = null;
    }
    if (window._modelosState.edgesLayer) {
        map.removeLayer(window._modelosState.edgesLayer);
        window._modelosState.edgesLayer = null;
    }
    var legend = document.getElementById('modelos-legend');
    if (legend) legend.remove();
}


// ---------------------------------------------------------
// CERRAR MODELOS
// ---------------------------------------------------------

function cerrarModelos() {
    clearTimeout(window._modelosState._debounceTimer);
    limpiarCapaModelos();
    _ocultarOverlayCarga();

    var panel = document.getElementById('modelos-control-panel');
    if (panel) panel.remove();

    window._modelosState.isActive = false;
    window._modelosState.controlPanel = null;
    window._modelosState._isLoading = false;

    mostrarToastModelos('Modelos cerrado', 'info');
}


// ---------------------------------------------------------
// TOAST NOTIFICATION
// ---------------------------------------------------------

function mostrarToastModelos(message, type) {
    type = type || 'info';

    var prevToast = document.querySelector('.modelos-toast');
    if (prevToast) prevToast.remove();

    var toast = document.createElement('div');
    toast.className = 'modelos-toast ' + type;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function() {
        toast.classList.add('dismiss');
        setTimeout(function() {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 3000);
}


// ---------------------------------------------------------
// LOG
// ---------------------------------------------------------
console.log('[Modelos] Módulo de Modelos de red cargado correctamente.');
