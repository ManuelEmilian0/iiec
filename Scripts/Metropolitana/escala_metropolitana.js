// ==========================================
// 4. ESCALA METROPOLITANA (ACCESIBILIDAD Y VULNERABILIDAD)
// ==========================================

// Estilo de las isócronas de accesibilidad (0-15/15-30/30-60 min), reusando
// la misma paleta que Estatal (getColorIsocrona, en escala_estatal.js) para
// que ambas vistas se lean igual. No existía — activarAccesibilidad() la
// llamaba pero nunca estuvo definida (ReferenceError silencioso dentro de
// la promesa, sin .catch, por lo que el botón "activaba" sin dibujar nada).
function getIsocronaStyle(minutos) {
    var color = getColorIsocrona(minutos);
    return { color: color, fillColor: color, weight: 1.5, opacity: 0.9, fillOpacity: minutos <= 15 ? 0.35 : (minutos <= 30 ? 0.25 : 0.18) };
}

// Controles independientes de transparencia/visibilidad para Armadoras y
// Unidades Económicas (DENUE) en Accesibilidad — antes no existía ninguno,
// solo el toggle general del modo.
window.currentArmadorasOpacityMetro = 1;
window.actualizarVisibilidadArmadorasMetro = function () {
    var chk = document.getElementById('chk-armadoras-metro');
    var visible = chk ? chk.checked : true;
    var op = visible ? parseFloat(window.currentArmadorasOpacityMetro !== undefined ? window.currentArmadorasOpacityMetro : 1) : 0;
    if (window._metroArmadorasLayer) {
        window._metroArmadorasLayer.eachLayer(function (l) {
            if (l.setOpacity) l.setOpacity(op);
        });
    }
};

window.currentEmpresasOpacityMetro = 0.85;
window.actualizarVisibilidadEmpresasMetro = function () {
    var chk = document.getElementById('chk-empresas-metro');
    var visible = chk ? chk.checked : true;
    var op = visible ? parseFloat(window.currentEmpresasOpacityMetro !== undefined ? window.currentEmpresasOpacityMetro : 0.85) : 0;
    if (window._metroEmpresasLayer) {
        window._metroEmpresasLayer.eachLayer(function (l) {
            if (l.setStyle) l.setStyle({ opacity: visible ? 1 : 0, fillOpacity: op });
        });
    }
};

function iniciarLogicaMetropolitana() {
    // 1. Limpiar capas previas
    if (currentGeoJSONLayer) { map.removeLayer(currentGeoJSONLayer); currentGeoJSONLayer = null; }
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
    if (isocronasLayer) { map.removeLayer(isocronasLayer); isocronasLayer = null; }
    if (agebLayer) { map.removeLayer(agebLayer); agebLayer = null; }
    if (window.equipamientoLayer) { map.removeLayer(window.equipamientoLayer); window.equipamientoLayer = null; }
    if (window.equipamientoBufferLayer) { map.removeLayer(window.equipamientoBufferLayer); window.equipamientoBufferLayer = null; }
    if (window.limiteDelegacionalLayer) { map.removeLayer(window.limiteDelegacionalLayer); window.limiteDelegacionalLayer = null; }
    if (window.levantamientoLayer) { map.removeLayer(window.levantamientoLayer); window.levantamientoLayer = null; }
    if (window.limiteMunicipalLayer) { map.removeLayer(window.limiteMunicipalLayer); window.limiteMunicipalLayer = null; }
    if (window.nacionalTop5Layer) { map.removeLayer(window.nacionalTop5Layer); window.nacionalTop5Layer = null; }
    if (window._metroArmadorasLayer) { map.removeLayer(window._metroArmadorasLayer); window._metroArmadorasLayer = null; }

    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'none';

    var legendDiv = document.getElementById('legend-overlay');
    if (legendDiv) legendDiv.style.display = 'none';

    // 2. Ocultar la caja de filtros original de la escala global/nacional/estatal
    var originalFilterBox = document.getElementById('filter-container-box');
    if (originalFilterBox) originalFilterBox.style.display = 'none';

    // 3. Crear o mostrar el contenedor metropolitano
    var leftContainer = document.getElementById('left-sidebar-container');
    var metroWrapper = document.getElementById('metropolitana-filter-wrapper');
    if (!metroWrapper) {
        metroWrapper = document.createElement('div');
        metroWrapper.id = 'metropolitana-filter-wrapper';
        if (originalFilterBox) {
            leftContainer.insertBefore(metroWrapper, originalFilterBox.nextSibling);
        } else {
            leftContainer.appendChild(metroWrapper);
        }
    }
    metroWrapper.style.display = 'block';
    metroWrapper.innerHTML = ""; // Limpiar estructura previa

    // 4. Cargar datos necesarios en paralelo
    Promise.all([
        AppData.load('carto/denue.geojson'),
        AppData.load('carto/armadoras.geojson'),
        AppData.load('carto/isocronas.geojson'),
        AppData.load('carto/Vinculacion_empresas_DENUE_2026.geojson')
    ]).then(([denueData, armadorasData, isocronasData, vinculacionData]) => {
        window.denueRawData = denueData;
        window.armadorasRawData = armadorasData;
        window.isocronasRawData = isocronasData;
        window.vinculacionRawData = vinculacionData;

        // Construir interfaz metropolitana
        generarMenuMetropolitana(metroWrapper);

        if (typeof window.mostrarInstruccionEscala === "function") {
            window.mostrarInstruccionEscala('metropolitana');
        }

        var legendContent = document.getElementById('legend-content');
        if (legendContent) legendContent.innerHTML = "<small>Seleccione una Zona Metropolitana</small>";
        map.flyTo([23.6345, -102.5528], 5);
    }).catch(err => console.error("Error cargando datos para Metropolitana:", err));
}

function generarMenuMetropolitana(wrapper) {
    // --- CAJA 0: TIPO DE ANÁLISIS (mismo patrón que Nacional/Estatal) ---
    var modoBox = document.createElement("div");
    modoBox.id = "metro-modo-box";
    modoBox.className = "dashboard-box";
    modoBox.innerHTML = `
        <h4 class="panel-title">Análisis</h4>
        <div class="filter-item-wrapper">
            <small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Tipo de Análisis:</small>
            <select id="select-modo-metro" class="dynamic-filter-select">
                <option value="" disabled selected>-- Selección de análisis --</option>
                <option value="accesibilidad">Accesibilidad a la Armadora Automotriz</option>
                <option value="vulnerabilidad">Vulnerabilidad multicriterio</option>
            </select>
        </div>
    `;
    wrapper.appendChild(modoBox);
    var selectModoMetro = modoBox.querySelector("#select-modo-metro");

    // --- CAJA 1: SELECTOR ZONA METROPOLITANA ---
    // Antes "accesibilidad" quedaba implícitamente seleccionado y esta caja se
    // veía de entrada sin que el usuario hubiera elegido ningún Tipo de
    // Análisis — ahora arranca oculta, se revela desde selectModoMetro.onchange.
    var zmBox = document.createElement("div");
    zmBox.id = "metro-zm-box";
    zmBox.className = "dashboard-box";
    zmBox.style.display = "none";
    zmBox.innerHTML = `
        <h4 class="panel-title" id="metro-zm-title">Zona Metropolitana</h4>
        <div class="filter-item-wrapper">
            <select id="select-zm-metro" class="dynamic-filter-select">
                <option value="" disabled selected>-- Selecciona Zona Metropolitana --</option>
            </select>
        </div>
    `;
    wrapper.appendChild(zmBox);

    var selectZm = zmBox.querySelector("#select-zm-metro");
    Object.keys(CATALOGO_ZONAS_METROPOLITANAS).forEach(zm => {
        var opt = document.createElement("option");
        opt.value = zm;
        opt.innerText = zm;
        selectZm.appendChild(opt);
    });

    // --- PLANTAS ARMADORAS (independiente del Tipo de Análisis) ---
    // Antes vivía dentro de accBox (solo visible en modo "Accesibilidad a la
    // Armadora Automotriz"): al elegir "Vulnerabilidad multicriterio" la capa
    // se apagaba sin forma de volver a prenderla. Ahora es un control
    // persistente que se muestra en cuanto se elige una Zona Metropolitana,
    // sin importar el tipo de análisis activo (ver
    // actualizarArmadorasPersistenteMetro).
    var armadorasBoxMetro = document.createElement("div");
    armadorasBoxMetro.id = "metro-armadoras-box";
    armadorasBoxMetro.className = "dashboard-box";
    armadorasBoxMetro.style.display = "none";
    armadorasBoxMetro.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
            <input type="checkbox" id="chk-armadoras-metro" checked onchange="if(window.actualizarVisibilidadArmadorasMetro) window.actualizarVisibilidadArmadorasMetro();">
            <svg width="18" height="18" viewBox="0 0 24 24"><polygon points="12,2 22,22 2,22" fill="rgba(0,229,255,0.8)" stroke="#fff" stroke-width="2"/></svg>
            <span style="font-size:12px; color:#ccc; font-weight:bold;">Plantas Armadoras</span>
        </div>
        <div style="margin-top:8px; display:flex; align-items:center; justify-content:space-between;">
            <span style="font-size: 11px; color: #aaa;">Opacidad Armadoras:</span>
            <input type="range" min="0" max="1" step="0.1" value="1" style="width: 55%; cursor: pointer;"
                oninput="window.currentArmadorasOpacityMetro = this.value; if(window.actualizarVisibilidadArmadorasMetro) window.actualizarVisibilidadArmadorasMetro();">
        </div>
    `;
    wrapper.appendChild(armadorasBoxMetro);

    // --- CAJA 2: ACCESIBILIDAD A LA ARMADORA AUTOMOTRIZ (ESTATAL) ---
    var accBox = document.createElement("div");
    accBox.id = "metro-acc-box";
    accBox.className = "dashboard-box";
    accBox.style.display = "none";
    accBox.innerHTML = `
        <h4 class="panel-title toggleable" onclick="toggleDropdown('metro-acc-content', 'metro-acc-arrow')">
            <span style="font-size: 13px;">Accesibilidad a la Armadora Automotriz</span>
            <span id="metro-acc-arrow" class="drop-arrow">−</span>
        </h4>
        <div id="metro-acc-content" class="dropdown-content show">
            <!-- El botón "Accesibilidad Activa" / "Ver Accesibilidad a la Armadora"
                 se quitó: era redundante — elegir este Tipo de Análisis y la Zona
                 Metropolitana ya activa la accesibilidad automáticamente
                 (aplicarModoMetro / selectZm.onchange). El control de Plantas
                 Armadoras se movió fuera de esta caja (ver armadorasBoxMetro
                 arriba) — ya no depende de este modo. -->
            <div style="display:flex; align-items:center; gap:6px;">
                <input type="checkbox" id="chk-empresas-metro" checked onchange="if(window.actualizarVisibilidadEmpresasMetro) window.actualizarVisibilidadEmpresasMetro();">
                <span style="font-size:11px; color:#ccc;">Unidades Económicas (DENUE)</span>
            </div>
            <div style="margin-top:6px; display:flex; align-items:center; justify-content:space-between;">
                <span style="font-size: 11px; color: #aaa;">Opacidad Empresas:</span>
                <input type="range" min="0" max="1" step="0.1" value="0.85" style="width: 50%; cursor: pointer;"
                    oninput="window.currentEmpresasOpacityMetro = this.value; if(window.actualizarVisibilidadEmpresasMetro) window.actualizarVisibilidadEmpresasMetro();">
            </div>
        </div>
    `;
    wrapper.appendChild(accBox);

    // --- CAJA 3: VULNERABILIDAD MULTIVARIADA (MUNICIPAL) ---
    var vulnBox = document.createElement("div");
    vulnBox.id = "metro-vuln-box";
    vulnBox.className = "dashboard-box";
    vulnBox.style.display = "none";
    vulnBox.innerHTML = `
        <h4 class="panel-title toggleable" onclick="toggleDropdown('metro-vuln-content', 'metro-vuln-arrow')">
            <span style="font-size: 13px;">Vulnerabilidad multicriterio</span>
            <span id="metro-vuln-arrow" class="drop-arrow">+</span>
        </h4>
        <div id="metro-vuln-content" class="dropdown-content">
            <select id="select-indice-metro" class="dynamic-filter-select" style="margin-top: 5px;">
                <option value="" selected>-- Selecciona un Índice --</option>
            </select>
            <div id="opacity-control-metro" style="margin-top: 12px; width: 100%; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                <span style="font-size: 11px; color: #aaa;">Opacidad Capas:</span>
                <input type="range" id="metro-opacity" min="0" max="1" step="0.1" value="0.85" style="width: 55%; cursor: pointer;">
            </div>
        </div>
    `;
    wrapper.appendChild(vulnBox);

    var selectIndice = vulnBox.querySelector("#select-indice-metro");
    var opcionesAgeb = [
        { id: 'g_espacial', label: 'Vulnerabilidad en Hogar' },
        { id: 'g_urbano', label: 'Deficiencias en Infraestructura' },
        { id: 'g_socioeco', label: 'Sin Oportunidades' },
        { id: 'G_INDICE', label: 'Índice Global' }
    ];
    opcionesAgeb.forEach(opc => {
        var opt = document.createElement("option"); opt.value = opc.id; opt.innerText = opc.label;
        selectIndice.appendChild(opt);
    });

    var opacityInput = vulnBox.querySelector("#metro-opacity");

    // Filtra armadoras.geojson por Zona Metropolitana (misma lógica de
    // estadoBusqueda que usa activarAccesibilidad) y dibuja/actualiza
    // window._metroArmadorasLayer directamente sobre el mapa — independiente
    // del Tipo de Análisis activo, para que las plantas armadoras puedan
    // verse tanto en "Accesibilidad" como en "Vulnerabilidad multicriterio".
    function actualizarArmadorasPersistenteMetro(zmName) {
        var box = document.getElementById('metro-armadoras-box');
        if (window._metroArmadorasLayer) { map.removeLayer(window._metroArmadorasLayer); window._metroArmadorasLayer = null; }
        if (!zmName || !armadorasRawData) { if (box) box.style.display = 'none'; return; }
        if (box) box.style.display = 'block';

        var catalogList = CATALOGO_ZONAS_METROPOLITANAS[zmName];
        var estadoBusqueda = obtenerNombreEstandarEstado(zmName);
        var firstCode = catalogList ? catalogList[0].substring(0, 2) : '';
        if (zmName === "ZM Valle de México") estadoBusqueda = "ZMVM";
        else if (firstCode === "02") estadoBusqueda = "BAJA CALIFORNIA";
        else if (firstCode === "19") estadoBusqueda = "NUEVO LEON";

        var armadorasEstado = armadorasRawData.features.filter(f => {
            var estadoArmadora = obtenerNombreEstandarEstado(f.properties.Estado || f.properties.ESTADO || f.properties.NOMGEO);
            if (estadoBusqueda === "ZMVM") return estadoArmadora === "MEXICO" || estadoArmadora === "CIUDAD DE MEXICO" || estadoArmadora.includes("MEXICO") || estadoArmadora.includes("CIUDAD DE MEXICO");
            if (estadoBusqueda === "BAJA CALIFORNIA" && estadoArmadora.includes("SUR")) return false;
            return estadoArmadora === estadoBusqueda || estadoArmadora.includes(estadoBusqueda) || estadoBusqueda.includes(estadoArmadora);
        }).filter(f => f.geometry && f.geometry.coordinates);

        if (armadorasEstado.length === 0) return;

        var chk = document.getElementById('chk-armadoras-metro');
        var visible = chk ? chk.checked : true;
        var op = visible ? (window.currentArmadorasOpacityMetro !== undefined ? parseFloat(window.currentArmadorasOpacityMetro) : 1) : 0;

        var triangleHtml = '<svg width="16" height="16" viewBox="0 0 24 24"><polygon points="12,2 22,22 2,22" fill="rgba(0, 229, 255, 0.6)" stroke="#fff" stroke-width="2"/></svg>';
        var triangleIcon = L.divIcon({ className: '', html: triangleHtml, iconSize: [16, 16], iconAnchor: [8, 8] });
        window._metroArmadorasLayer = L.geoJSON(armadorasEstado, {
            pointToLayer: function (feature, latlng) { return L.marker(latlng, { icon: triangleIcon, opacity: op }); },
            onEachFeature: function (feature, layer) {
                var props = feature.properties;
                layer.bindTooltip(`<b>${props.Empresa || props.EMPRESA || props.Nombre || props.NOMBRE || 'Armadora'}</b><br>Estado: ${props.Estado || props.ESTADO}<br>Municipio: ${props.Municipio || props.MUNICIPIO}<br>Empleos: ${props.Empleos || props.EMPLEOS || 'N/A'}`);
            }
        }).addTo(map);
    }

    // LÓGICA DE INTERACCIONES Y CAPAS
    function activarAccesibilidad(zmName) {
        selectIndice.value = ""; // Deseleccionar índice municipal

        // Limpiar capas de vulnerabilidad (AGEB) si existen
        if (agebLayer) { map.removeLayer(agebLayer); agebLayer = null; }
        if (window.equipamientoLayer) { map.removeLayer(window.equipamientoLayer); window.equipamientoLayer = null; }
        if (window.equipamientoBufferLayer) { map.removeLayer(window.equipamientoBufferLayer); window.equipamientoBufferLayer = null; }
        if (window.limiteDelegacionalLayer) { map.removeLayer(window.limiteDelegacionalLayer); window.limiteDelegacionalLayer = null; }
        if (window.levantamientoLayer) { map.removeLayer(window.levantamientoLayer); window.levantamientoLayer = null; }

        var statsDiv = document.getElementById('stats-overlay');
        if (statsDiv) statsDiv.style.display = 'none';

        var muniContainer = document.getElementById('municipal-charts-container');
        if (muniContainer) muniContainer.style.display = 'none';

        // Activar leyenda e isocronas con filtro metropolitano (M4)
        // Antes apuntaba a "carto/muni_2018gw.geojson", un archivo que nunca existió en
        // el proyecto (404 silencioso, sin .catch, por lo que el botón cambiaba de
        // texto pero jamás dibujaba nada). Se reemplaza por el mismo loader ya usado
        // en Municipal/escala_municipal.js (window.cargarLimiteMunicipalGeoJSON), que
        // sí existe y está cacheado. Ese archivo usa "cve_umun" (5 dígitos) como
        // identificador real de municipio — "CVEGEO"/"NOMGEO" ahí guardan datos del
        // ESTADO, no del municipio (ver nota en escala_municipal.js). El catálogo de
        // ZM Valle de México usa códigos de 2 dígitos (todo el estado, "09"/"15"),
        // mientras que Tijuana/Monterrey usan códigos de 5 dígitos (municipio
        // específico) — se soportan ambos formatos.
        window.cargarLimiteMunicipalGeoJSON().then(muniData => {
            if (!muniData) throw new Error('No se pudo cargar Limite_municipal_opt/CDMX.geojson');
            var catalogList = CATALOGO_ZONAS_METROPOLITANAS[zmName];
            var zmPolygonFeatures = muniData.features.filter(f => catalogList.some(function (code) {
                return code.length <= 2 ? f.properties.cve_ent === code : f.properties.cve_umun === code;
            }));
            var zmMultipolygon = null;

            if (typeof turf !== 'undefined' && zmPolygonFeatures.length > 0) {
                zmMultipolygon = zmPolygonFeatures[0];
                for (var i = 1; i < zmPolygonFeatures.length; i++) {
                    try { zmMultipolygon = turf.union(zmMultipolygon, zmPolygonFeatures[i]); } catch (e) { }
                }
            }

            var estadoBusqueda = obtenerNombreEstandarEstado(zmName);
            var firstCode = catalogList[0].substring(0, 2);
            if (zmName === "ZM Valle de México") estadoBusqueda = "ZMVM";
            else if (firstCode === "02") estadoBusqueda = "BAJA CALIFORNIA";
            else if (firstCode === "19") estadoBusqueda = "NUEVO LEON";

            var denueEstado = denueRawData.features.filter(f => {
                let n = obtenerNombreEstandarEstado(f.properties.NOMGEO || f.properties.Entidad || f.properties.ENTIDAD || f.properties.ESTADO);
                if (estadoBusqueda === "ZMVM") return n === "MEXICO" || n === "CIUDAD DE MEXICO";
                return n === estadoBusqueda;
            });

            if (zmMultipolygon && typeof turf !== 'undefined') {
                // Algunos puntos de DENUE traen geometry: null (geocodificación fallida
                // en la fuente) — sin este guard, .coordinates sobre null tiraba
                // TypeError sin capturar dentro del .then(), abortando TODO el render
                // (isócronas, marcadores, leyenda) para cualquier ZM que topara con uno
                // de estos puntos — es lo que se veía como "error al cargar la ZM".
                denueEstado = denueEstado.filter(f => {
                    if (!f.geometry || !f.geometry.coordinates) return false;
                    try { return turf.booleanPointInPolygon(f.geometry.coordinates, zmMultipolygon); } catch (e) { return false; }
                });
            }

            var armadorasEstado = armadorasRawData.features.filter(f => {
                var estadoArmadora = obtenerNombreEstandarEstado(f.properties.Estado || f.properties.ESTADO || f.properties.NOMGEO);
                if (estadoBusqueda === "ZMVM") return estadoArmadora === "MEXICO" || estadoArmadora === "CIUDAD DE MEXICO" || estadoArmadora.includes("MEXICO") || estadoArmadora.includes("CIUDAD DE MEXICO");
                if (estadoBusqueda === "BAJA CALIFORNIA" && estadoArmadora.includes("SUR")) return false;
                return estadoArmadora === estadoBusqueda || estadoArmadora.includes(estadoBusqueda) || estadoBusqueda.includes(estadoArmadora);
            });

            if (zmMultipolygon && typeof turf !== 'undefined') {
                armadorasEstado = armadorasEstado.filter(f => {
                    if (!f.geometry || !f.geometry.coordinates) return false;
                    try { return turf.booleanPointInPolygon(f.geometry.coordinates, zmMultipolygon); } catch (e) { return false; }
                });
            }

            var isocronasRawList = isocronasRawData.features.filter(f => {
                let n = obtenerNombreEstandarEstado(f.properties.NOMGEO || f.properties.Entidad || f.properties.Estado || f.properties.ESTADO || f.properties.ENTIDAD);
                if (estadoBusqueda === "ZMVM") return n === "MEXICO" || n === "CIUDAD DE MEXICO";
                return n === estadoBusqueda;
            });

            var isocronasEstado = procesarYUnirIsocronas(isocronasRawList);
            isocronasEstado.sort((a, b) => parseInt(b.properties.AA_MINS || 0) - parseInt(a.properties.AA_MINS || 0));

            if (isocronasLayer) map.removeLayer(isocronasLayer);
            // Los checkboxes de la leyenda (chk-iso-15/30/60, en
            // actualizarLeyendaIsocronas) prenden/apagan las isócronas a través de
            // window.actualizarVisibilidadIsocronas(), que itera sobre
            // window.animIso15/30/60 — arrays que antes solo llenaba Estatal
            // (filtrarPorEstado). Esta capa nunca se registraba ahí, así que los
            // checkboxes no tenían nada que prender/apagar en Metropolitana.
            window.animIso15 = []; window.animIso30 = []; window.animIso60 = [];
            isocronasLayer = L.geoJSON(isocronasEstado, {
                style: function (feature) {
                    return getIsocronaStyle(parseInt(feature.properties.AA_MINS || 0));
                },
                onEachFeature: function (feature, layer) {
                    var mins = parseInt(feature.properties.AA_MINS || 0);
                    if (mins <= 15) window.animIso15.push(layer);
                    else if (mins <= 30) window.animIso30.push(layer);
                    else window.animIso60.push(layer);
                }
            }).addTo(map);

            if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
            var fg = L.featureGroup();
            // El plugin Leaflet.markercluster (L.markerClusterGroup) nunca se cargó en
            // este proyecto (no hay <script> para él en index.html ni se usa en ninguna
            // otra escala — Estatal dibuja los mismos puntos DENUE con L.geoJSON simple,
            // sin clusterizar). Antes esto tiraba "L.markerClusterGroup is not a
            // function" dentro de la promesa sin .catch, dejando el botón "activado"
            // sin dibujar nada. Se usa L.geoJSON simple, igual que Estatal
            // (filtrarPorEstado), lo que además permite clasificar por sector abajo.
            var denueValido = denueEstado.filter(f => f.geometry && f.geometry.coordinates);
            var armadorasValido = armadorasEstado.filter(f => f.geometry && f.geometry.coordinates);

            // Las plantas armadoras ya NO se dibujan aquí — son un control
            // independiente del Tipo de Análisis (ver
            // actualizarArmadorasPersistenteMetro, disparado directamente desde
            // selectZm.onchange), para que puedan estar activas también en
            // "Vulnerabilidad multicriterio". window._metroArmadorasLayer ya
            // está actualizado para cuando este código corre (ver más abajo).

            // Clasificación por sector (Conjunto/"Industrias agrupadas") con la misma
            // paleta getColorConjunto que ya usan Estatal y el pastel de
            // actualizarPanelEstatal — antes todos los puntos DENUE se pintaban del
            // mismo amarillo plano, sin relación con la leyenda/gráfica de sectores.
            var markers = denueValido.length > 0 ? L.geoJSON(denueValido, {
                pointToLayer: function (feature, latlng) {
                    var sector = feature.properties.Conjunto || feature.properties['Industrias agrupadas'] || "Otros";
                    if (sector === "Actividades SEIT") sector = "Servicios SEIT";
                    // Radio por Estrato (tamaño de empresa por personal ocupado) —
                    // igual que Estatal (getRadioEstrato), en vez de un radio fijo
                    // que no distinguía unidades grandes de pequeñas.
                    return L.circleMarker(latlng, { radius: getRadioEstrato(feature.properties.Estrato), fillColor: getColorConjunto(sector), color: "#fff", weight: 1, opacity: 1, fillOpacity: 0.85 });
                },
                onEachFeature: function (feature, layer) {
                    var p = feature.properties;
                    var sector = p.Conjunto || p['Industrias agrupadas'] || 'Otros';
                    layer.bindTooltip(`<b>${p.Nombre || p.Empresa || p['Nombre de empresa'] || 'Empresa'}</b><br><small>${sector}</small><br><small>Estrato: ${typeof normalizarEstrato === 'function' ? normalizarEstrato(p.Estrato) : (p.Estrato || 'N/D')}</small>`);
                }
            }) : L.featureGroup();

            // Referencia global para que el checkbox/slider de opacidad de
            // Unidades Económicas (fuera del closure de activarAccesibilidad)
            // pueda controlarla. Las armadoras usan su propia referencia
            // (window._metroArmadorasLayer), ya actualizada por
            // actualizarArmadorasPersistenteMetro antes de llegar aquí.
            window._metroEmpresasLayer = markers;
            if (typeof window.actualizarVisibilidadEmpresasMetro === 'function') window.actualizarVisibilidadEmpresasMetro();

            fg.addLayer(markers);
            currentGeoJSONLayer = fg.addTo(map);

            // Encuadrar en la zona de estudio seleccionada — antes se quedaba en la
            // vista general de México (el flyTo de iniciarLogicaMetropolitana) y
            // nunca se movía hacia la ZM activa.
            try {
                if (armadorasValido.length > 0 && window._metroArmadorasLayer) {
                    map.flyToBounds(window._metroArmadorasLayer.getBounds(), { padding: [100, 100], maxZoom: 11 });
                } else if (isocronasEstado.length > 0 && isocronasLayer) {
                    map.flyToBounds(isocronasLayer.getBounds(), { padding: [50, 50] });
                } else if (denueValido.length > 0) {
                    map.flyToBounds(markers.getBounds(), { padding: [50, 50] });
                } else if (zmMultipolygon) {
                    map.flyToBounds(L.geoJSON(zmMultipolygon).getBounds(), { padding: [30, 30] });
                }
            } catch (e) { }

            if (typeof actualizarPanelEstatal === "function") {
                actualizarPanelEstatal(zmName, denueEstado, armadorasEstado, isocronasEstado);
            }

            if (typeof actualizarLeyendaIsocronas === "function") {
                actualizarLeyendaIsocronas();
                var legendDiv = document.getElementById('legend-overlay');
                if (legendDiv) legendDiv.style.display = 'block';
                // Aplica de una vez el estado "todo prendido" de los checkboxes recién
                // creados sobre las capas que acabamos de registrar arriba.
                if (typeof window.actualizarVisibilidadIsocronas === 'function') window.actualizarVisibilidadIsocronas();
            }

            // Límites municipales — dibujarLimiteMunicipal ya sabe filtrar por ZM
            // (rama CATALOGO_ZONAS_METROPOLITANAS en escala_global.js), igual que lo
            // usa Estatal (filtrarPorEstado), pero esta escala nunca la invocaba, así
            // que los límites no se "activaban" nunca al elegir una ZM.
            if (typeof window.dibujarLimiteMunicipal === 'function') {
                window.dibujarLimiteMunicipal(zmName);
            }
        }).catch(function (err) {
            console.error('Error activando Accesibilidad a la Armadora en Metropolitana:', err);
        });
    }

    function activarVulnerabilidad(zmName, indiceId, labelNombre) {
        // Limpiar capas de accesibilidad
        if (isocronasLayer) { map.removeLayer(isocronasLayer); isocronasLayer = null; }
        if (currentGeoJSONLayer) { map.removeLayer(currentGeoJSONLayer); currentGeoJSONLayer = null; }
        if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }

        // Ocultar gráficas de vinculación estatal
        var vincContainer = document.getElementById('vinculacion-charts-container');
        if (vincContainer) vincContainer.style.display = 'none';

        // Cargar y mostrar AGEBs
        var regionToLoad = "Region Centro"; // Default ZMVM
        var firstCode = CATALOGO_ZONAS_METROPOLITANAS[zmName][0].substring(0, 2);
        if (firstCode === "02") regionToLoad = "Region Norte";
        else if (firstCode === "19") regionToLoad = "Region Norte";

        var archivoGeojson = REGIONES_AGEB[regionToLoad] || 'carto/agebmex.geojson';

        if (typeof cargarAgebEstadoRegional === "function") {
            cargarAgebEstadoRegional(zmName, archivoGeojson, selectIndice, opcionesAgeb);

            setTimeout(() => {
                if (typeof renderizarMapaAgeb === "function") {
                    renderizarMapaAgeb(indiceId, labelNombre, zmName);
                    var legendDiv = document.getElementById('legend-overlay');
                    if (legendDiv) legendDiv.style.display = 'block';
                }
            }, 500);
        }
    }

    // CONTROLADORES DE EVENTOS

    // Muestra solo la caja del modo activo (mismo patrón que Estatal/Nacional:
    // "Tipo de Análisis" decide qué contenedor se ve), y dispara el render
    // correspondiente si ya hay una ZM elegida.
    function aplicarModoMetro(zm) {
        var modo = selectModoMetro.value;
        accBox.style.display = modo === 'accesibilidad' ? 'block' : 'none';
        vulnBox.style.display = modo === 'vulnerabilidad' ? 'block' : 'none';

        // Limpieza inmediata de la simbología del modo contrario, sin esperar
        // a que además haya ZM/índice elegidos — antes, cambiar de "Tipo de
        // Análisis" sin completar la selección de abajo dejaba pegada la
        // simbología del modo anterior (activarAccesibilidad/
        // activarVulnerabilidad solo limpiaban al ejecutarse ellas mismas).
        var legendOverlay = document.getElementById('legend-overlay');
        if (legendOverlay) legendOverlay.style.display = 'none';

        if (modo === 'accesibilidad') {
            if (agebLayer) { map.removeLayer(agebLayer); agebLayer = null; }
            if (window.equipamientoLayer) { map.removeLayer(window.equipamientoLayer); window.equipamientoLayer = null; }
            if (window.equipamientoBufferLayer) { map.removeLayer(window.equipamientoBufferLayer); window.equipamientoBufferLayer = null; }
            if (window.limiteDelegacionalLayer) { map.removeLayer(window.limiteDelegacionalLayer); window.limiteDelegacionalLayer = null; }
            if (window.levantamientoLayer) { map.removeLayer(window.levantamientoLayer); window.levantamientoLayer = null; }
        } else if (modo === 'vulnerabilidad') {
            if (isocronasLayer) { map.removeLayer(isocronasLayer); isocronasLayer = null; }
            if (currentGeoJSONLayer) { map.removeLayer(currentGeoJSONLayer); currentGeoJSONLayer = null; }
            if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
            if (window.limiteMunicipalLayer) { map.removeLayer(window.limiteMunicipalLayer); window.limiteMunicipalLayer = null; }
        }

        if (!zm) return;
        if (modo === 'accesibilidad') {
            activarAccesibilidad(zm);
        } else if (selectIndice.value) {
            var label = selectIndice.options[selectIndice.selectedIndex].text;
            activarVulnerabilidad(zm, selectIndice.value, label);
        }
    }

    selectModoMetro.onchange = function () {
        zmBox.style.display = this.value ? 'block' : 'none';
        aplicarModoMetro(selectZm.value);
    };

    selectZm.onchange = function () {
        var zm = this.value;
        if (zm) {
            var pop = document.getElementById('escala-instruccion-pop');
            if (pop) pop.remove();

            // Actualizar título de la caja superior
            document.getElementById('metro-zm-title').innerText = "Zona Metropolitana: " + zm;

            aplicarModoMetro(zm);
            // Independiente del Tipo de Análisis elegido — ver el bloque
            // "PLANTAS ARMADORAS" arriba.
            actualizarArmadorasPersistenteMetro(zm);
            // Módulos de datos duros (esferas sobre el minimapa) — antes
            // nunca se activaban en esta escala. POBLACION_ESTATAL
            // (Tablas/poblacion_estatal.json) ya trae las 3 ZM con su
            // propia clave ("ZM Valle de México"/"ZM Tijuana"/"ZM
            // Monterrey"), independiente del Tipo de Análisis elegido.
            if (typeof window.actualizarModulosDatosDuros === 'function') {
                window.actualizarModulosDatosDuros([], "Metropolitana", zm);
            }
        } else {
            document.getElementById('metro-zm-title').innerText = "Zona Metropolitana";
            accBox.style.display = "none";
            vulnBox.style.display = "none";
            actualizarArmadorasPersistenteMetro(null);
            if (typeof window.actualizarModulosDatosDuros === 'function') {
                window.actualizarModulosDatosDuros(null, null, null);
            }
        }
    };

    // El selector de índice sigue funcionando igual que antes (no se tocó su
    // lógica ya verificada); solo se sincroniza el selector de "Tipo de
    // Análisis" para que no quede desfasado si se usa directamente en vez del
    // selector nuevo.
    selectIndice.onchange = function () {
        var zm = selectZm.value;
        if (zm && this.value) {
            selectModoMetro.value = 'vulnerabilidad';
            var label = this.options[this.selectedIndex].text;
            activarVulnerabilidad(zm, this.value, label);
        }
    };

    opacityInput.oninput = function () {
        var val = this.value;
        window.currentDenueOpacity = val;
        if (window.actualizarVisibilidadIsocronas) window.actualizarVisibilidadIsocronas();
        if (window.agebLayer) {
            window.agebLayer.eachLayer(l => {
                if (l.options.interactive) l.setStyle({ fillOpacity: val });
            });
        }
    };
}
