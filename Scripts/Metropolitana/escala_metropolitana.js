// ==========================================
// 4. ESCALA METROPOLITANA (ACCESIBILIDAD Y VULNERABILIDAD)
// ==========================================

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
        (window.denueRawData ? Promise.resolve(window.denueRawData) : fetch('carto/denue.geojson').then(r => r.json())),
        (window.armadorasRawData ? Promise.resolve(window.armadorasRawData) : fetch('carto/armadoras.geojson').then(r => r.json())),
        (window.isocronasRawData ? Promise.resolve(window.isocronasRawData) : fetch('carto/isocronas.geojson').then(r => r.json())),
        (window.vinculacionRawData ? Promise.resolve(window.vinculacionRawData) : fetch('carto/Vinculacion_empresas_DENUE_2026.geojson').then(r => r.json()))
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
    // --- CAJA 1: SELECTOR ZONA METROPOLITANA ---
    var zmBox = document.createElement("div");
    zmBox.id = "metro-zm-box";
    zmBox.className = "dashboard-box";
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
            <button id="metro-acc-btn" class="scale-btn active" style="width: 100%; height: 36px; margin-top: 5px; border-radius: 4px; display: flex; flex-direction: row; gap: 8px; font-size: 11px; align-items: center; justify-content: center;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="3" fill="currentColor"/><circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="18" cy="8" r="3" fill="currentColor"/><circle cx="8" cy="18" r="3" fill="currentColor"/><path d="M10 10l4 4M16 10l-6 6M10 16l4-4"/></svg>
                <span>Accesibilidad Activa</span>
            </button>
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
            <span style="font-size: 13px;">Vulnerabilidad Multivariada</span>
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

    var toggleAccBtn = accBox.querySelector("#metro-acc-btn");
    var opacityInput = vulnBox.querySelector("#metro-opacity");

    // LÓGICA DE INTERACCIONES Y CAPAS
    function activarAccesibilidad(zmName) {
        // Estilos de UI
        toggleAccBtn.classList.add('active');
        toggleAccBtn.querySelector('span').innerText = "Accesibilidad Activa";
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

        // Activar leyenda e isocronas
        if (typeof filtrarPorEstado === "function") {
            filtrarPorEstado(zmName);
            if (typeof actualizarLeyendaIsocronas === "function") {
                actualizarLeyendaIsocronas();
                var legendDiv = document.getElementById('legend-overlay');
                if (legendDiv) legendDiv.style.display = 'block';
            }
        }
    }

    function activarVulnerabilidad(zmName, indiceId, labelNombre) {
        // Estilos de UI
        toggleAccBtn.classList.remove('active');
        toggleAccBtn.querySelector('span').innerText = "Ver Accesibilidad a la Armadora";

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
    selectZm.onchange = function () {
        var zm = this.value;
        if (zm) {
            var pop = document.getElementById('escala-instruccion-pop');
            if (pop) pop.remove();

            // Actualizar título de la caja superior
            document.getElementById('metro-zm-title').innerText = "Zona Metropolitana: " + zm;
            
            // Mostrar las cajas subordinadas
            accBox.style.display = "block";
            vulnBox.style.display = "block";

            // Activar por defecto Accesibilidad
            activarAccesibilidad(zm);
        } else {
            document.getElementById('metro-zm-title').innerText = "Zona Metropolitana";
            accBox.style.display = "none";
            vulnBox.style.display = "none";
        }
    };

    toggleAccBtn.onclick = function () {
        var zm = selectZm.value;
        if (zm) {
            activarAccesibilidad(zm);
        }
    };

    selectIndice.onchange = function () {
        var zm = selectZm.value;
        if (zm && this.value) {
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
