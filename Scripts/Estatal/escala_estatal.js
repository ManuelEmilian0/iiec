// ==========================================
// 2. ESCALA ESTATAL (CLÚSTERES + ISOCRONAS)
// ==========================================

function cargarArmadorasContexto() {
    AppData.load('carto/armadoras.geojson').then(data => {
        window.armadorasContextoGlobalLayer = L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, { radius: 2, fillColor: "#fff", color: "#fff", weight: 0, opacity: 0.3, fillOpacity: 0.3 });
            }
        });
        if (currentScaleType === 'nacional') {
            window.armadorasContextoGlobalLayer.addTo(map);
        }
    }).catch(e => console.log("Fondo armadoras no encontrado."));
}

function iniciarLogicaEstatal() {
    Promise.all([
        AppData.load('carto/denue.geojson'),
        AppData.load('carto/armadoras.geojson'),
        AppData.load('carto/isocronas.geojson'),
        AppData.load('carto/Vinculacion_empresas_DENUE_2026.geojson')
    ]).then(([denueData, armadorasData, isocronasData, vinculacionData]) => {
        denueRawData = denueData;
        armadorasRawData = armadorasData;
        isocronasRawData = isocronasData;
        vinculacionRawData = vinculacionData;
        generarMenuEstados(denueData);
        var legendContent = document.getElementById('legend-content');
        if (legendContent) legendContent.innerHTML = "<small>Seleccione un Estado</small>";
        map.flyTo([23.6345, -102.5528], 5);
    }).catch(err => console.error("Error cargando datos:", err));
}

function generarMenuEstados(data) {
    var container = document.getElementById('filter-buttons-container');
    var title = document.getElementById('filter-title');
    if (container) container.innerHTML = "";
    if (title) title.innerText = "Análisis";

    var estadosMap = new Map();
    data.features.forEach(f => {
        let nameRaw = f.properties.NOMGEO || f.properties.Entidad || f.properties.ENTIDAD;
        if (nameRaw && nameRaw !== "Desconocido") {
            let nameTrimmed = nameRaw.toString().trim();
            let nameNorm = obtenerNombreEstandarEstado(nameTrimmed);
            if (nameNorm && nameNorm !== "" && nameNorm !== "DESCONOCIDO") {
                if (!estadosMap.has(nameNorm)) {
                    let nombreMostrar = nameTrimmed.toUpperCase();
                    if (nombreMostrar.includes("IGNACIO DE LA LLAVE")) nombreMostrar = "VERACRUZ";
                    if (nombreMostrar.includes("DE OCAMPO")) nombreMostrar = "MICHOACÁN";
                    if (nombreMostrar.includes("DE ZARAGOZA")) nombreMostrar = "COAHUILA";
                    if (nombreMostrar.includes("DE ARTEAGA")) nombreMostrar = "QUERÉTARO";
                    if (nombreMostrar === "ESTADO DE MEXICO" || nombreMostrar === "MEXICO" || nombreMostrar === "ESTADO DE MÉXICO" || nombreMostrar === "MÉXICO") nombreMostrar = "ESTADO DE MÉXICO";
                    if (nombreMostrar === "CIUDAD DE MEXICO" || nombreMostrar === "CIUDAD DE MÉXICO") nombreMostrar = "CIUDAD DE MÉXICO";
                    estadosMap.set(nameNorm, nombreMostrar);
                }
            }
        }
    });
    var estados = Array.from(estadosMap.values()).sort();

    // --- SELECTOR TIPO DE ANÁLISIS ---
    var modoWrapper = document.createElement('div');
    modoWrapper.style.marginBottom = '10px';
    modoWrapper.innerHTML = `<small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Tipo de Análisis:</small>`;
    var selectModo = document.createElement('select');
    selectModo.id = 'estatal-modo-select';
    selectModo.className = 'dynamic-filter-select';
    selectModo.innerHTML = `
        <option value="" disabled selected>-- Selección de análisis --</option>
        <option value="accesibilidad">Accesibilidad a la Armadora Automotriz</option>
        <option value="superior_temporal">Índice Educación Superior</option>
    `;
    modoWrapper.appendChild(selectModo);
    container.appendChild(modoWrapper);

    // --- SELECTOR ENTIDAD ---
    // Antes "accesibilidad" quedaba implícitamente seleccionado (tenía
    // "selected") y este selector se veía de entrada sin que el usuario
    // hubiera elegido ningún Tipo de Análisis — ahora arranca oculto y se
    // revela desde selectModo.onchange en cuanto se elige un tipo real.
    var estadoWrapper = document.createElement('div');
    estadoWrapper.style.display = 'none';
    estadoWrapper.innerHTML = `<small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Entidad Federativa:</small>`;
    var select = document.createElement("select");
    select.id = 'estatal-estado-select';
    select.className = "dynamic-filter-select";
    var defaultOption = document.createElement("option");
    defaultOption.innerText = "-- Entidad Federativa --";
    defaultOption.value = ""; defaultOption.disabled = true; defaultOption.selected = true;
    select.appendChild(defaultOption);
    estados.forEach(estado => {
        var opt = document.createElement("option"); opt.value = estado; opt.innerText = estado;
        select.appendChild(opt);
    });
    estadoWrapper.appendChild(select);
    container.appendChild(estadoWrapper);

    // --- CONTENEDORES DE MODO ---
    var accContainer = document.createElement('div');
    accContainer.id = 'estatal-acc-container';
    accContainer.style.display = 'none';

    var supContainer = document.createElement('div');
    supContainer.id = 'estatal-sup-container';
    supContainer.style.display = 'none';
    supContainer.innerHTML = `
        <div style="margin-top:10px;">
            <small style="color:#aaa; font-size:10px; display:block; margin-bottom:4px;">Seleccione entidad para cargar municipios.</small>
        </div>
    `;

    container.appendChild(accContainer);
    container.appendChild(supContainer);

    // Opacidad empresas (solo en modo accesibilidad)
    window.currentDenueOpacity = 0.9;
    var opacityControl = document.createElement('div');
    opacityControl.id = 'estatal-opacity-control';
    opacityControl.style.cssText = "margin-top: 10px; width: 100%; display: flex; align-items: center; justify-content: space-between;";
    opacityControl.innerHTML = `
        <span style="font-size: 11px; color: #aaa;">Opacidad Empresas:</span>
        <input type="range" min="0" max="1" step="0.1" value="0.9" style="width: 55%; cursor: pointer;"
            oninput="window.currentDenueOpacity = this.value; if(window.actualizarVisibilidadIsocronas) window.actualizarVisibilidadIsocronas();">
    `;
    accContainer.appendChild(opacityControl);

    // --- LÓGICA DE MODO ---
    function limpiarCapasAccesibilidad() {
        if (isocronasLayer) { map.removeLayer(isocronasLayer); isocronasLayer = null; }
        if (currentGeoJSONLayer) { map.removeLayer(currentGeoJSONLayer); currentGeoJSONLayer = null; }
        if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
    }

    function aplicarModo(estado) {
        var modo = selectModo.value;
        accContainer.style.display = modo === 'accesibilidad' ? 'block' : 'none';
        supContainer.style.display = modo === 'superior_temporal' ? 'block' : 'none';

        // Oculta la leyenda del tipo anterior de una vez — cada rama la vuelve
        // a mostrar solo si tiene algo real que representar. Antes, cambiar de
        // tipo sin tener aún una entidad elegida dejaba la leyenda (y sus
        // clases/checkboxes) del tipo previo visible sin corresponder a nada.
        var legendOverlay = document.getElementById('legend-overlay');
        if (legendOverlay) legendOverlay.style.display = 'none';

        if (modo === 'accesibilidad') {
            limpiarCapasAccesibilidad();
            if (estado) filtrarPorEstado(estado);
        } else if (modo === 'superior_temporal') {
            limpiarCapasAccesibilidad();
            if (estado) iniciarIndiceTemporalEstatal(estado);
        }
    }

    selectModo.onchange = function() {
        estadoWrapper.style.display = this.value ? 'block' : 'none';
        var estadoSel = document.getElementById('estatal-estado-select') ? document.getElementById('estatal-estado-select').value : '';
        aplicarModo(estadoSel || null);
    };

    select.onchange = function () {
        if (this.value) {
            aplicarModo(this.value);
        }
    };
}

function obtenerNombreEstandarEstado(nombre) {
    if (nombre === "ZMVM") return "ZMVM";
    var normalized = normalizarEstadoNombre(nombre);
    var n = normalized.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (n === "QUERETARO DE ARTEAGA") return "QUERETARO";
    return n;
}

function procesarYUnirIsocronas(features) {
    if (typeof turf === 'undefined') return features;
    var grupos = { 15: [], 30: [], 60: [] };
    features.forEach(f => {
        var m = parseInt(f.properties.AA_MINS || 0);
        if (m <= 15) grupos[15].push(f);
        else if (m <= 30) grupos[30].push(f);
        else if (m <= 60) grupos[60].push(f);
    });
    var featuresUnidas = [];
    const unirGrupo = (lista, minutos) => {
        if (lista.length === 0) return;
        try {
            var unido = lista[0];
            for (var i = 1; i < lista.length; i++) unido = turf.union(unido, lista[i]);
            // Si el grupo tenía una sola isócrona, turf.union nunca corrió y
            // `unido` sigue siendo el MISMO objeto que vive en isocronasRawData.
            // Clonarlo antes de reemplazar sus properties evita corromper el
            // feature original (perdería Entidad/NOMGEO) para la próxima vez
            // que se filtre el mismo estado — le pasó a la vista nueva de Red
            // de Proveeduría al reusar el estado ya consultado por Accesibilidad.
            if (lista.length === 1) {
                unido = { type: 'Feature', geometry: unido.geometry, properties: {} };
            }
            unido.properties = { AA_MINS: minutos };
            featuresUnidas.push(unido);
        } catch (e) { featuresUnidas.push(...lista); }
    };
    unirGrupo(grupos[15], 15); unirGrupo(grupos[30], 30); unirGrupo(grupos[60], 60);
    return featuresUnidas;
}

function filtrarPorEstado(nombreEstado) {
    var estadoBusqueda = obtenerNombreEstandarEstado(nombreEstado);

    if (CATALOGO_ZONAS_METROPOLITANAS[nombreEstado]) {
        var firstCode = CATALOGO_ZONAS_METROPOLITANAS[nombreEstado][0].substring(0, 2);
        if (nombreEstado === "ZM Valle de México") estadoBusqueda = "ZMVM";
        else if (firstCode === "02") estadoBusqueda = "BAJA CALIFORNIA";
        else if (firstCode === "19") estadoBusqueda = "NUEVO LEON";
    }

    var denueEstado = denueRawData.features.filter(f => {
        let n = obtenerNombreEstandarEstado(f.properties.NOMGEO || f.properties.Entidad || f.properties.ENTIDAD || f.properties.ESTADO);
        if (estadoBusqueda === "ZMVM") return n === "MEXICO" || n === "CIUDAD DE MEXICO";
        return n === estadoBusqueda;
    });
    var armadorasEstado = armadorasRawData.features.filter(f => {
        var estadoArmadora = obtenerNombreEstandarEstado(f.properties.Estado || f.properties.ESTADO || f.properties.NOMGEO);
        if (estadoBusqueda === "ZMVM") return estadoArmadora === "MEXICO" || estadoArmadora === "CIUDAD DE MEXICO" || estadoArmadora.includes("MEXICO") || estadoArmadora.includes("CIUDAD DE MEXICO");
        if (estadoBusqueda === "BAJA CALIFORNIA" && estadoArmadora.includes("SUR")) return false;
        return estadoArmadora === estadoBusqueda || estadoArmadora.includes(estadoBusqueda) || estadoBusqueda.includes(estadoArmadora);
    });
    var isocronasRawList = isocronasRawData.features.filter(f => {
        let n = obtenerNombreEstandarEstado(f.properties.NOMGEO || f.properties.Entidad || f.properties.Estado || f.properties.ESTADO || f.properties.ENTIDAD);
        if (estadoBusqueda === "ZMVM") return n === "MEXICO" || n === "CIUDAD DE MEXICO";
        return n === estadoBusqueda;
    });
    var isocronasEstado = procesarYUnirIsocronas(isocronasRawList);

    isocronasEstado.sort((a, b) => parseInt(b.properties.AA_MINS || 0) - parseInt(a.properties.AA_MINS || 0));

    if (isocronasLayer) map.removeLayer(isocronasLayer);
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
    if (armadorasLayer) map.removeLayer(armadorasLayer);

    window.animIso15 = []; window.animIso30 = []; window.animIso60 = [];
    window.animDenue = []; window.animArmadoras = [];

    if (isocronasEstado.length > 0) {
        isocronasLayer = L.geoJSON(isocronasEstado, {
            style: function () { return { opacity: 0, fillOpacity: 0, weight: 1.5, className: 'sin-interaccion' }; },
            onEachFeature: function (feature, layer) {
                var mins = parseInt(feature.properties.AA_MINS || 0);
                if (mins <= 15) window.animIso15.push(layer); else if (mins <= 30) window.animIso30.push(layer); else window.animIso60.push(layer);
            }
        }).addTo(map);
        isocronasLayer.bringToBack();
    }

    if (denueEstado.length > 0) {
        // Pre-clasificar denueEstado
        denueEstado.forEach(f => {
            var pt;
            try { pt = turf.point(f.geometry.coordinates); } catch(e) { return; }
            var mins = 999;
            for(let i=0; i<isocronasEstado.length; i++) {
                var iso = isocronasEstado[i];
                try {
                    if (turf.booleanPointInPolygon(pt, iso)) {
                        let minIso = parseInt(iso.properties.AA_MINS || 999);
                        if (minIso < mins) mins = minIso;
                    }
                } catch(e) {}
            }
            f.properties._isocrona = mins;
        });
        
        denueEstado.sort((a, b) => getRadioEstrato(b.properties.Estrato) - getRadioEstrato(a.properties.Estrato));
        currentGeoJSONLayer = L.geoJSON(denueEstado, {
            pointToLayer: function (feature, latlng) {
                var sector = feature.properties.Conjunto || feature.properties['Industrias agrupadas'] || "Otros"; if (sector === "Actividades SEIT") sector = "Servicios SEIT";
                var radio = getRadioEstrato(feature.properties.Estrato);
                return L.circleMarker(latlng, { radius: radio, fillColor: getColorConjunto(sector), color: "#ffffff", weight: 0.8, opacity: 0, fillOpacity: 0 });
            },
            onEachFeature: function (feature, layer) {
                layer.feature._isocrona = feature.properties._isocrona || 999;
                window.animDenue.push(layer);
                layer.bindPopup(`<b>${feature.properties.Nombre || feature.properties.Empresa || feature.properties['Nombre de empresa']}</b><br><small>${feature.properties.Conjunto || feature.properties['Industrias agrupadas'] || 'Otros'}</small><br><small>Estrato: ${normalizarEstrato(feature.properties.Estrato)}</small>`);
            }
        }).addTo(map);
    }

    if (armadorasEstado.length > 0) {
        var triangleHtml = '<svg width="16" height="16" viewBox="0 0 24 24"><polygon points="12,2 22,22 2,22" fill="rgba(0, 229, 255, 0.6)" stroke="#fff" stroke-width="2"/></svg>';
        var triangleIcon = L.divIcon({ className: '', html: triangleHtml, iconSize: [16, 16], iconAnchor: [8, 8] });
        armadorasLayer = L.geoJSON(armadorasEstado, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng, { icon: triangleIcon, opacity: 0 });
            },
            onEachFeature: function (feature, layer) { window.animArmadoras.push(layer); }
        }).addTo(map);
    }

    function ejecutarAnimacion() {
        var ad = window.animDenue;
        if(ad) ad.sort(() => Math.random() - 0.5);
        let tercio = Math.floor(ad.length / 3);
        let denue1 = ad.slice(0, tercio);
        let denue2 = ad.slice(tercio, tercio * 2);
        let denue3 = ad.slice(tercio * 2);

        setTimeout(() => {
            window.animIso15.forEach(l => l.setStyle({ opacity: 1, fillOpacity: 0.8, color: getColorIsocrona(15), fillColor: getColorIsocrona(15) }));
            window.animArmadoras.forEach(l => {
                if (l.setStyle) l.setStyle({ opacity: 1, fillOpacity: 1 });
                if (l.setOpacity) l.setOpacity(1);
                l.bindTooltip(l.feature.properties.NOMBRE || l.feature.properties.Nombre || "Planta", { permanent: true, direction: 'top', className: 'etiqueta-armadora', offset: [0, -15] });
            });
            denue1.forEach(l => l.setStyle({ opacity: 1, fillOpacity: 0.9 }));
            if(window.actualizarVisibilidadIsocronas) window.actualizarVisibilidadIsocronas();
        }, 100);
        setTimeout(() => {
            window.animIso30.forEach(l => l.setStyle({ opacity: 1, fillOpacity: 0.4, color: getColorIsocrona(30), fillColor: getColorIsocrona(30) }));
            denue2.forEach(l => l.setStyle({ opacity: 1, fillOpacity: 0.9 }));
            if(window.actualizarVisibilidadIsocronas) window.actualizarVisibilidadIsocronas();
        }, 800);
        setTimeout(() => {
            window.animIso60.forEach(l => l.setStyle({ opacity: 1, fillOpacity: 0.25, color: getColorIsocrona(60), fillColor: getColorIsocrona(60) }));
            denue3.forEach(l => l.setStyle({ opacity: 1, fillOpacity: 0.9 }));
            if(window.actualizarVisibilidadIsocronas) window.actualizarVisibilidadIsocronas();
        }, 1500);
    }

    try {
        if (armadorasEstado.length > 0) {
            let latlngs = armadorasEstado.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
            map.flyToBounds(latlngs, { padding: [100, 100], duration: 1.5, maxZoom: 11 }); map.once('moveend', ejecutarAnimacion);
        } else if (isocronasEstado.length > 0) {
            map.flyToBounds(isocronasLayer.getBounds(), { padding: [50, 50] }); map.once('moveend', ejecutarAnimacion);
        } else if (currentGeoJSONLayer && denueEstado.length > 0) {
            map.flyToBounds(currentGeoJSONLayer.getBounds(), { padding: [50, 50] }); map.once('moveend', ejecutarAnimacion);
        } else { ejecutarAnimacion(); }
    } catch (e) { ejecutarAnimacion(); }

    actualizarPanelEstatal(nombreEstado, denueEstado, armadorasEstado, isocronasEstado);
    actualizarLeyendaIsocronas();

    if (typeof window.dibujarLimiteMunicipal === 'function') {
        window.dibujarLimiteMunicipal(nombreEstado);
    }

    if (typeof window.actualizarModulosDatosDuros === 'function') {
        window.actualizarModulosDatosDuros([], "Estatal", nombreEstado);
    }
}

function dibujarArmadorasPuntos(features) {
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
    if (!features || features.length === 0) return;
    var triangleHtml = '<svg width="16" height="16" viewBox="0 0 24 24"><polygon points="12,2 22,22 2,22" fill="rgba(0, 229, 255, 0.6)" stroke="#fff" stroke-width="2"/></svg>';
    var triangleIcon = L.divIcon({ className: '', html: triangleHtml, iconSize: [16, 16], iconAnchor: [8, 8] });
    armadorasLayer = L.geoJSON(features, {
        pointToLayer: function (feature, latlng) { return L.marker(latlng, { icon: triangleIcon, opacity: 1 }); },
        onEachFeature: function (feature, layer) { layer.bindTooltip(feature.properties.NOMBRE || feature.properties.Nombre || "Planta", { permanent: true, direction: 'top', className: 'etiqueta-armadora', offset: [0, -15] }); }
    }).addTo(map);
}

function actualizarPanelEstatal(nombreEstado, denueEstado, armadorasEstado, isocronasEstado) {
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var conteo = {};
    denueEstado.forEach(f => {
        var ramo = f.properties.Conjunto || f.properties['Industrias agrupadas'] || "Otros"; if (ramo === "Actividades SEIT") ramo = "Servicios SEIT";
        conteo[ramo] = (conteo[ramo] || 0) + 1;
    });

    var titulo = document.getElementById('stats-title-text');
    if (titulo) {
        var subtitulo = armadorasEstado.length > 0
            ? `<span style="color:#00e5ff; font-size:12px">🏭 Plantas Armadoras Presentes</span>` : `<span style="color:#aaa; font-size:12px">Sin planta armadora</span>`;
        titulo.innerHTML = `
            <span style="font-size:18px; font-weight:bold; text-transform:uppercase">${nombreEstado}</span><br>
            <span style="font-size:13px; color:#ddd">Total Empresas: <b>${denueEstado.length}</b></span><br>${subtitulo}
        `;
    }

    var canvas = document.getElementById('myChart');
    if (!canvas) return; canvas.parentElement.style.height = '150px';

    var labels = Object.keys(conteo); var dataValues = Object.values(conteo);
    var colores = labels.map(l => getColorConjunto(l));

    if (mainChart) mainChart.destroy();
    if (dataValues.length === 0) return;

    mainChart = new Chart(canvas.getContext('2d'), {
        type: 'pie',
        data: { labels: labels, datasets: [{ label: 'Empresas', data: dataValues, backgroundColor: colores, borderColor: '#222', borderWidth: 1 }] },
        plugins: [ChartDataLabels],
        options: {
            responsive: true, maintainAspectRatio: false, layout: { padding: { top: 5, bottom: 5, left: 5, right: 5 } },
            plugins: {
                legend: { display: false },
                datalabels: { color: '#fff', font: { weight: 'bold', size: 14 }, formatter: function (value) { return value > 0 ? value : ''; } }
            }
        }
    });

    actualizarGraficasVinculacion(nombreEstado, isocronasEstado);
}

// ==========================================
// VINCULACIÓN EMPRESAS
// ==========================================
function normalizarEstrato(estrato) {
    if (!estrato) return "Sin dato";
    var s = estrato.toString().trim().replace(/\s+$/, '');
    var upper = s.toUpperCase();
    if (upper === 'MICRO' || s === '0 a 5 personas') return 'Micro (0-5 personas ocupadas)';
    if (upper === 'PEQUEÑA' || s === '6 a 10 personas') return 'Pequeña (6-10 personas ocupadas)';
    if (s === '11 a 30 personas') return 'Pequeña (11-30 personas ocupadas)';
    if (s === '31 a 50 personas') return 'Mediana (31-50 personas ocupadas)';
    if (upper === 'MEDIANA' || s === '51 a 100 personas') return 'Mediana (51-100 personas ocupadas)';
    if (s === '101 a 250 personas') return 'Grande (101-250 personas ocupadas)';
    if (upper === 'GRANDE' || s === '251 y más personas') return 'Grande (251 y más personas ocupadas)';
    return s || 'Sin dato';
}

function actualizarGraficasVinculacion(nombreEstado, isocronasEstado) {
    var container = document.getElementById('vinculacion-charts-container');
    if (!container || !vinculacionRawData || !vinculacionRawData.features) { if (container) container.style.display = 'none'; return; }

    var estadoBusqueda = obtenerNombreEstandarEstado(nombreEstado);

    if (CATALOGO_ZONAS_METROPOLITANAS[nombreEstado]) {
        var firstCode = CATALOGO_ZONAS_METROPOLITANAS[nombreEstado][0].substring(0, 2);
        if (nombreEstado === "ZM Valle de México") estadoBusqueda = "ZMVM";
        else if (firstCode === "02") estadoBusqueda = "BAJA CALIFORNIA";
        else if (firstCode === "19") estadoBusqueda = "NUEVO LEON";
    }

    var featuresEstado = vinculacionRawData.features.filter(f => {
        var entidad = obtenerNombreEstandarEstado(f.properties.Entidad);
        if (estadoBusqueda === "ZMVM") return entidad === "MEXICO" || entidad === "CIUDAD DE MEXICO";
        if (estadoBusqueda === "BAJA CALIFORNIA" && entidad.includes("SUR")) return false;
        return entidad === estadoBusqueda || entidad.includes(estadoBusqueda) || estadoBusqueda.includes(entidad);
    });

    if (featuresEstado.length === 0) { container.style.display = 'none'; return; }
    container.style.display = 'block';

    var conteoEstrato = {};
    featuresEstado.forEach(f => { var est = normalizarEstrato(f.properties.Estrato); conteoEstrato[est] = (conteoEstrato[est] || 0) + 1; });

    var ordenEstratos = ['Micro (0-5 personas ocupadas)', 'Pequeña (6-10 personas ocupadas)', 'Pequeña (11-30 personas ocupadas)', 'Mediana (31-50 personas ocupadas)', 'Mediana (51-100 personas ocupadas)', 'Grande (101-250 personas ocupadas)', 'Grande (251 y más personas ocupadas)', 'Sin dato'];
    var estratoLabels = [], estratoValues = [];
    ordenEstratos.forEach(key => { if (conteoEstrato[key] > 0) { estratoLabels.push(key); estratoValues.push(conteoEstrato[key]); } });
    Object.keys(conteoEstrato).forEach(key => { if (!ordenEstratos.includes(key) && conteoEstrato[key] > 0) { estratoLabels.push(key); estratoValues.push(conteoEstrato[key]); } });

    var coloresEstrato = ['#fee5d9', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d', '#555555'];
    var canvasEstrato = document.getElementById('estratoChart');
    if (canvasEstrato) {
        if (estratoChart) estratoChart.destroy();
        estratoChart = new Chart(canvasEstrato.getContext('2d'), {
            type: 'bar',
            data: { labels: estratoLabels, datasets: [{ label: 'Empresas', data: estratoValues, backgroundColor: coloresEstrato.slice(0, estratoLabels.length), borderColor: '#222', borderWidth: 1 }] },
            plugins: [ChartDataLabels],
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false, layout: { padding: 5 },
                scales: {
                    x: { ticks: { color: '#aaa', font: { size: 10 } }, grid: { color: '#444' } },
                    y: { ticks: { color: '#ddd', font: { size: 10 } }, grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#fff', font: { weight: 'bold', size: 10 }, textShadowBlur: 2, textShadowColor: '#000',
                        formatter: function (value) { return value > 0 ? value : ''; }
                    }
                }
            }
        });
    }

    var empresaEstrato = {};
    featuresEstado.forEach(f => {
        var emp = (f.properties['Nombre de empresa'] || 'Sin nombre').trim(); var est = normalizarEstrato(f.properties.Estrato);
        if (!empresaEstrato[emp]) empresaEstrato[emp] = {};
        empresaEstrato[emp][est] = (empresaEstrato[emp][est] || 0) + 1;
    });

    var empresasTotales = Object.keys(empresaEstrato).map(emp => ({ nombre: emp, total: Object.values(empresaEstrato[emp]).reduce((a, b) => a + b, 0) }));
    empresasTotales.sort((a, b) => b.total - a.total);
    
    var sinNombreIndex = empresasTotales.findIndex(e => e.nombre.toUpperCase() === 'SIN NOMBRE');
    var sinNombreData = null;
    if (sinNombreIndex !== -1) {
        sinNombreData = empresasTotales.splice(sinNombreIndex, 1)[0];
    }
    
    var topEmpresas = empresasTotales.slice(0, 19);
    if (sinNombreData) {
        topEmpresas.push(sinNombreData);
    }

    var estratosPresentes = new Set();
    topEmpresas.forEach(e => Object.keys(empresaEstrato[e.nombre]).forEach(est => estratosPresentes.add(est)));

    var coloresBarrasEstrato = { 'Micro (0-5 personas ocupadas)': '#fee5d9', 'Pequeña (6-10 personas ocupadas)': '#fcbba1', 'Pequeña (11-30 personas ocupadas)': '#fc9272', 'Mediana (31-50 personas ocupadas)': '#fb6a4a', 'Mediana (51-100 personas ocupadas)': '#ef3b2c', 'Grande (101-250 personas ocupadas)': '#cb181d', 'Grande (251 y más personas ocupadas)': '#99000d', 'Sin dato': '#555555' };
    var datasets = [];
    ordenEstratos.forEach(est => {
        if (estratosPresentes.has(est)) datasets.push({ label: est, data: topEmpresas.map(e => empresaEstrato[e.nombre][est] || 0), backgroundColor: coloresBarrasEstrato[est] || '#888', borderColor: '#333', borderWidth: 0.5 });
    });
    estratosPresentes.forEach(est => {
        if (!ordenEstratos.includes(est)) datasets.push({ label: est, data: topEmpresas.map(e => empresaEstrato[e.nombre][est] || 0), backgroundColor: '#888', borderColor: '#333', borderWidth: 0.5 });
    });

    var empresaLabels = topEmpresas.map(e => e.nombre.length > 18 ? e.nombre.substring(0, 17) + '…' : e.nombre);
    var canvasEmpresaParent = document.getElementById('empresaChart');
    if (canvasEmpresaParent) {
        var alturaBarras = Math.max(300, topEmpresas.length * 28);
        canvasEmpresaParent.parentElement.style.height = alturaBarras + 'px';
        if (empresaChart) empresaChart.destroy();
        empresaChart = new Chart(canvasEmpresaParent.getContext('2d'), {
            type: 'bar', data: { labels: empresaLabels, datasets: datasets }, plugins: [ChartDataLabels],
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true, ticks: { color: '#aaa', font: { size: 10 } }, grid: { color: '#444' }, title: { display: true, text: 'Unidades Económicas', color: '#aaa', font: { size: 11 } } }, y: { stacked: true, ticks: { color: '#ddd', font: { size: 10 } }, grid: { display: false } } },
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { color: '#ccc', font: { size: 9 }, boxWidth: 10, padding: 5 } },
                    datalabels: { display: function (context) { return context.dataset.data[context.dataIndex] > 0; }, color: '#fff', font: { weight: 'bold', size: 9 }, textShadowBlur: 2, textShadowColor: '#000', formatter: function (value) { return value > 0 ? value : ''; } },
                    tooltip: { callbacks: { title: function (context) { return topEmpresas[context[0].dataIndex].nombre; } } }
                }
            }
        });
    }

    // --- SÍNTESIS DINÁMICA: ESTRATO ---
    var sintesisEstrato = document.getElementById('sintesis-estrato');
    if (sintesisEstrato && estratoLabels.length > 0) {
        var maxVal = 0, topEstrato = '';
        for (var i = 0; i < estratoLabels.length; i++) {
            if (estratoValues[i] > maxVal) { maxVal = estratoValues[i]; topEstrato = estratoLabels[i]; }
        }
        var totalUnidades = estratoValues.reduce((a, b) => a + b, 0);
        var porcentaje = ((maxVal / totalUnidades) * 100).toFixed(1);
        sintesisEstrato.innerHTML = `En <b>${nombreEstado}</b>, la mayor concentración pertenece al estrato <span style="color:#00a2ff; font-weight:bold;">${topEstrato}</span> con <b>${maxVal}</b> establecimientos, que representan el <b>${porcentaje}%</b> de la red de proveeduría vinculada.`;
        sintesisEstrato.style.display = 'block';
    } else if (sintesisEstrato) {
        sintesisEstrato.style.display = 'none';
    }

    // --- SÍNTESIS DINÁMICA: EMPRESA ---
    var sintesisEmpresa = document.getElementById('sintesis-empresa');
    if (sintesisEmpresa && topEmpresas.length > 0) {
        var topEmpresaData = topEmpresas[0];
        if (topEmpresaData.nombre.toUpperCase() === 'SIN NOMBRE') {
             sintesisEmpresa.innerHTML = `Existen <b>${topEmpresaData.total}</b> unidades económicas sin un nombre registrado.`;
        } else {
             var textoExtra = "";
             if (sinNombreData && sinNombreData.total > 0) {
                 textoExtra = ` Adicionalmente, existen <b>${sinNombreData.total}</b> unidades económicas sin un nombre registrado.`;
             }
             sintesisEmpresa.innerHTML = `<span style="color:#00a2ff; font-weight:bold;">${topEmpresaData.nombre}</span> destaca como el principal actor corporativo dentro de esta red a nivel estatal, articulando <b>${topEmpresaData.total}</b> unidades económicas.${textoExtra}`;
        }
        sintesisEmpresa.style.display = 'block';
    } else if (sintesisEmpresa) {
        sintesisEmpresa.style.display = 'none';
    }

    // --- NUEVA GRÁFICA: DISTANCIA DE CLÚSTERES (ISOCRONAS) ---
    var isocronaChartCanvas = document.getElementById('isocronaChart');
    if (isocronaChartCanvas && isocronasEstado && isocronasEstado.length > 0) {
        var datosPorIsocrona = { '0-15 min': {}, '15-30 min': {}, '30-60 min': {}, 'Más de 60 min': {} };
        var tiposSet = new Set();

        featuresEstado.forEach(f => {
            var pt;
            try { pt = turf.point(f.geometry.coordinates); } catch(e) { return; }
            var tipo = f.properties.Conjunto || f.properties['Industrias agrupadas'] || "Otros";
            if (tipo === "Actividades SEIT") tipo = "Servicios SEIT";
            tiposSet.add(tipo);

            var mins = 999;
            for(let i=0; i<isocronasEstado.length; i++) {
                var iso = isocronasEstado[i];
                try {
                    if (turf.booleanPointInPolygon(pt, iso)) {
                        let minIso = parseInt(iso.properties.AA_MINS || 999);
                        if (minIso < mins) mins = minIso;
                    }
                } catch(e) {}
            }

            var isocronaStr = 'Más de 60 min';
            if (mins <= 15) isocronaStr = '0-15 min';
            else if (mins <= 30) isocronaStr = '15-30 min';
            else if (mins <= 60) isocronaStr = '30-60 min';

            datosPorIsocrona[isocronaStr][tipo] = (datosPorIsocrona[isocronaStr][tipo] || 0) + 1;
        });

        // Guardar datos completos para actualización dinámica
        window._isocronaChartData = { datosPorIsocrona: datosPorIsocrona, tiposArray: Array.from(tiposSet).sort() };

        var tiposArray = window._isocronaChartData.tiposArray;
        var labelsIso = ['0-15 min', '15-30 min', '30-60 min'];
        var datasetsIso = [];

        tiposArray.forEach(tipo => {
            datasetsIso.push({
                label: tipo,
                data: labelsIso.map(lbl => datosPorIsocrona[lbl][tipo] || 0),
                backgroundColor: getColorConjunto(tipo),
                borderColor: '#333',
                borderWidth: 0.5
            });
        });

        if (typeof isocronaChart !== "undefined" && isocronaChart) isocronaChart.destroy();
        isocronaChart = new Chart(isocronaChartCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labelsIso,
                datasets: datasetsIso
            },
            plugins: [ChartDataLabels, {
                id: 'topTotals',
                afterDatasetsDraw: function(chart) {
                    var ctx = chart.ctx;
                    chart.data.labels.forEach((label, index) => {
                        var total = 0;
                        var lastMeta = null;
                        chart.data.datasets.forEach((dataset, i) => {
                            var meta = chart.getDatasetMeta(i);
                            if (!meta.hidden) {
                                var val = dataset.data[index];
                                if (val > 0) {
                                    total += val;
                                    lastMeta = meta;
                                }
                            }
                        });
                        if (total > 0 && lastMeta) {
                            var element = lastMeta.data[index];
                            if (element) {
                                ctx.save();
                                ctx.fillStyle = '#18d4e6';
                                ctx.font = 'bold 12px sans-serif';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                ctx.shadowColor = '#000';
                                ctx.shadowBlur = 3;
                                ctx.fillText(total, element.x, element.y - 4);
                                ctx.restore();
                            }
                        }
                    });
                }
            }],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: '#aaa', font: { size: 10 } },
                        grid: { color: '#444' }
                    },
                    y: {
                        stacked: true,
                        ticks: { color: '#ddd', font: { size: 10 } },
                        grid: { color: '#444' },
                        title: { display: true, text: 'Unidades Económicas', color: '#aaa', font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { color: '#ccc', font: { size: 9 }, boxWidth: 10, padding: 5 } },
                    datalabels: {
                        display: function(context) { return context.dataset.data[context.dataIndex] > 0; },
                        color: '#fff', font: { weight: 'bold', size: 9 },
                        textShadowBlur: 2, textShadowColor: '#000',
                        formatter: function(value) { return value > 0 ? value : ''; }
                    }
                }
            }
        });

        var sintesisIsocrona = document.getElementById('sintesis-isocrona');
        if (sintesisIsocrona) {
            var totalEnRango15 = 0;
            var maxTipo15 = { nombre: '', cant: 0 };
            
            tiposArray.forEach(t => {
                let c = datosPorIsocrona['0-15 min'][t] || 0;
                totalEnRango15 += c;
                if (c > maxTipo15.cant) { maxTipo15.cant = c; maxTipo15.nombre = t; }
            });

            if (totalEnRango15 > 0) {
                sintesisIsocrona.innerHTML = `A nivel interestatal, resaltan <b>${totalEnRango15}</b> unidades económicas en el núcleo más inmediato (0-15 min) que abastecen a la armadora, predominando el sector <b>${maxTipo15.nombre}</b>.`;
                sintesisIsocrona.style.display = 'block';
            } else {
                sintesisIsocrona.innerHTML = `No se detectaron unidades económicas en el núcleo inmediato de 0-15 min.`;
                sintesisIsocrona.style.display = 'block';
            }
        }
    } else if (document.getElementById('isocronaChart')) {
        if (typeof isocronaChart !== "undefined" && isocronaChart) isocronaChart.destroy();
        var sintesisIsocrona = document.getElementById('sintesis-isocrona');
        if (sintesisIsocrona) sintesisIsocrona.style.display = 'none';
    }

}

// ==========================================
// UTILIDADES ESTATALES
// ==========================================
function getRadioEstrato(estrato) {
    var e = normalizarEstrato(estrato);
    if (e.includes('Micro')) return 4;
    if (e.includes('Pequeña')) return 6;
    if (e.includes('Mediana')) return 9;
    if (e.includes('Grande')) return 13;
    return 4;
}

function getColorConjunto(conjunto) {
    const c = (conjunto || '').toString().trim();
    if (c.includes('Automo')) return '#ff3333';
    if (c.includes('Electrónica')) return '#2196f3';
    if (c.includes('Eléctrica')) return '#ffc107';
    if (c.includes('SEIT') || c.includes('Servicios')) return '#9c27b0';
    return '#bbbbbb';
}

function getColorIsocrona(minutos) {
    var m = parseInt(minutos);
    if (m <= 15) return '#00ff00'; if (m <= 30) return '#ffff00'; if (m <= 60) return '#ff4500';
    return '#808080';
}

function actualizarLeyendaIsocronas() {
    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content');
    if (!div || !overlay) return;

    div.innerHTML = `
        <div style="margin: 4px 0 6px 0; font-weight:bold; color:#00e5ff; font-size:12px; text-transform:uppercase; border-bottom:1px solid rgba(0,229,255,0.3); padding-bottom:3px;">Tiempo en Auto</div>
        
        <label style="color:#fff; font-size:12px; display:flex; align-items:center; gap:5px; cursor:pointer; margin-bottom:4px;">
            <input type="checkbox" id="chk-iso-15" checked onchange="if(window.actualizarVisibilidadIsocronas) window.actualizarVisibilidadIsocronas()"> <span class="legend-color" style="background:rgba(0, 255, 0, 0.8); border:1px solid #00ff00"></span> 0 - 15 Minutos
        </label>
        <label style="color:#fff; font-size:12px; display:flex; align-items:center; gap:5px; cursor:pointer; margin-bottom:4px;">
            <input type="checkbox" id="chk-iso-30" checked onchange="if(window.actualizarVisibilidadIsocronas) window.actualizarVisibilidadIsocronas()"> <span class="legend-color" style="background:rgba(255, 255, 0, 0.6); border:1px solid #ffff00"></span> 15 - 30 Minutos
        </label>
        <label style="color:#fff; font-size:12px; display:flex; align-items:center; gap:5px; cursor:pointer; margin-bottom:4px;">
            <input type="checkbox" id="chk-iso-60" checked onchange="if(window.actualizarVisibilidadIsocronas) window.actualizarVisibilidadIsocronas()"> <span class="legend-color" style="background:rgba(255, 69, 0, 0.3); border:1px solid #ff4500"></span> 30 - 60 Minutos
        </label>
        <label style="color:#fff; font-size:12px; display:flex; align-items:center; gap:5px; cursor:pointer; margin-bottom:4px;">
            <input type="checkbox" id="chk-iso-out" checked onchange="if(window.actualizarVisibilidadIsocronas) window.actualizarVisibilidadIsocronas()"> <span class="legend-color" style="background:transparent; border:1px dashed #aaa"></span> Fuera de Isócronas
        </label>
        
        <div style="margin-top:10px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
            <span style="font-size: 11px; color: #aaa;">Opacidad Isócronas:</span>
            <input type="range" min="0" max="1" step="0.1" value="1" style="width: 50%; cursor: pointer;" 
                oninput="window.currentIsoOpacityMult = this.value; if(window.actualizarVisibilidadIsocronas) window.actualizarVisibilidadIsocronas();">
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:10px; gap: 10px;">
            <div style="flex:1;">
                <div style="margin:0 0 6px 0; font-weight:bold; color:#00e5ff; font-size:12px; text-transform:uppercase; border-bottom:1px solid rgba(0,229,255,0.3); padding-bottom:3px;">Proveedores</div>
                <div class="legend-item"><span class="legend-color" style="background:#ff3333; border:1px solid #fff; border-radius:50%"></span> Automotriz</div>
                <div class="legend-item"><span class="legend-color" style="background:#2196f3; border:1px solid #fff; border-radius:50%"></span> Electrónica</div>
                <div class="legend-item"><span class="legend-color" style="background:#9c27b0; border:1px solid #fff; border-radius:50%"></span> Servicios SEIT</div>
                <div class="legend-item"><span class="legend-color" style="background:#ffc107; border:1px solid #fff; border-radius:50%"></span> Eléctrica</div>
            </div>
            <div style="flex:1;">
                <div style="margin:0 0 6px 0; font-weight:bold; color:#00e5ff; font-size:12px; text-transform:uppercase; border-bottom:1px solid rgba(0,229,255,0.3); padding-bottom:3px;">Tamaño de Empresa</div>
                <div class="legend-item" style="display:flex; align-items:center; margin-bottom:4px;">
                    <div style="width:26px; display:flex; justify-content:center;"><span style="display:inline-block; width:8px; height:8px; background:#bbb; border-radius:50%"></span></div>
                    <span style="font-size:11px; color:#ccc;">Micro (0-5 personas ocupadas)</span>
                </div>
                <div class="legend-item" style="display:flex; align-items:center; margin-bottom:4px;">
                    <div style="width:26px; display:flex; justify-content:center;"><span style="display:inline-block; width:12px; height:12px; background:#bbb; border-radius:50%"></span></div>
                    <span style="font-size:11px; color:#ccc;">Pequeña (6-30 personas ocupadas)</span>
                </div>
                <div class="legend-item" style="display:flex; align-items:center; margin-bottom:4px;">
                    <div style="width:26px; display:flex; justify-content:center;"><span style="display:inline-block; width:18px; height:18px; background:#bbb; border-radius:50%"></span></div>
                    <span style="font-size:11px; color:#ccc;">Mediana (31-100 personas ocupadas)</span>
                </div>
                <div class="legend-item" style="display:flex; align-items:center; margin-bottom:4px;">
                    <div style="width:26px; display:flex; justify-content:center;"><span style="display:inline-block; width:26px; height:26px; background:#bbb; border-radius:50%"></span></div>
                    <span style="font-size:11px; color:#ccc;">Grande (101 y más personas ocupadas)</span>
                </div>
            </div>
        </div>

        ${currentScaleType === 'metropolitana' ? '' : `
        <div style="margin-top:10px; display:flex; align-items:center; justify-content:center; gap:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
            <input type="checkbox" id="chk-armadoras" checked onchange="if(window.actualizarOpacidadArmadoras) window.actualizarOpacidadArmadoras();">
            <svg width="20" height="20" viewBox="0 0 24 24"><polygon points="12,2 22,22 2,22" fill="#00e5ff" stroke="#fff" stroke-width="2"/></svg>
            <span style="color:#fff; font-weight:bold; font-size:12px;">Planta Armadora</span>
        </div>

        <div style="margin-top:10px; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
            <span style="font-size: 11px; color: #aaa;">Opacidad Armadoras:</span>
            <input type="range" min="0" max="1" step="0.1" value="1" style="width: 50%; cursor: pointer;"
                oninput="window.currentArmadorasOpacity = this.value; if(window.actualizarOpacidadArmadoras) window.actualizarOpacidadArmadoras();">
        </div>
        `}
    `;
    // Metropolitana ya trae su propio control individual de armadoras
    // (chk-armadoras-metro + slider, en el accBox de escala_metropolitana.js)
    // que sí controla la capa real que usa esa escala
    // (window._metroArmadorasLayer) — el checkbox/slider de arriba solo
    // controla window.animArmadoras/armadorasLayer (variables de Estatal), así
    // que en Metropolitana era un control repetido y no funcional. Se deja
    // solo el individual.
    overlay.style.display = 'block';
}

// Global function to handle toggling isochrones visibility and their points
window.actualizarVisibilidadIsocronas = function() {
    var show15 = document.getElementById('chk-iso-15') ? document.getElementById('chk-iso-15').checked : true;
    var show30 = document.getElementById('chk-iso-30') ? document.getElementById('chk-iso-30').checked : true;
    var show60 = document.getElementById('chk-iso-60') ? document.getElementById('chk-iso-60').checked : true;
    var showOut = document.getElementById('chk-iso-out') ? document.getElementById('chk-iso-out').checked : true;

    var isoMult = window.currentIsoOpacityMult !== undefined ? window.currentIsoOpacityMult : 1;
    if (window.animIso15) window.animIso15.forEach(l => l.setStyle({ opacity: show15 ? isoMult : 0, fillOpacity: show15 ? 0.8 * isoMult : 0 }));
    if (window.animIso30) window.animIso30.forEach(l => l.setStyle({ opacity: show30 ? isoMult : 0, fillOpacity: show30 ? 0.4 * isoMult : 0 }));
    if (window.animIso60) window.animIso60.forEach(l => l.setStyle({ opacity: show60 ? isoMult : 0, fillOpacity: show60 ? 0.25 * isoMult : 0 }));

    var denueOp = window.currentDenueOpacity !== undefined ? window.currentDenueOpacity : 0.9;
    if (window.animDenue) {
        window.animDenue.forEach(l => {
            var mins = l.feature._isocrona || 999;
            var visible = false;
            if (mins <= 15 && show15) visible = true;
            else if (mins > 15 && mins <= 30 && show30) visible = true;
            else if (mins > 30 && mins <= 60 && show60) visible = true;
            else if (mins > 60 && showOut) visible = true;

            if (visible) {
                l.setStyle({ opacity: denueOp > 0 ? 1 : 0, fillOpacity: denueOp });
            } else {
                l.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        });
    }

    // E4: Actualizar gráfica de clústeres dinámicamente
    if (window.actualizarGraficaIsocrona) window.actualizarGraficaIsocrona();
};

// G1: Actualizar opacidad de triángulos de armadoras
window.actualizarOpacidadArmadoras = function() {
    var chkArmadoras = document.getElementById('chk-armadoras');
    var visibles = chkArmadoras ? chkArmadoras.checked : true;
    var op = visibles ? (window.currentArmadorasOpacity !== undefined ? parseFloat(window.currentArmadorasOpacity) : 1) : 0;
    if (window.animArmadoras) {
        window.animArmadoras.forEach(l => {
            if (l.setOpacity) l.setOpacity(op);
            if (l._icon) l._icon.style.opacity = op;
        });
    }
    // También afecta armadoras en escala municipal/extra
    if (armadorasLayer) {
        armadorasLayer.eachLayer(l => {
            if (l.setOpacity) l.setOpacity(op);
            if (l._icon) l._icon.style.opacity = op;
        });
    }
};

// E4: Actualizar gráfica de Distancia de Clústeres según isócronas activas
window.actualizarGraficaIsocrona = function() {
    var isocronaChartCanvas = document.getElementById('isocronaChart');
    if (!isocronaChartCanvas || !window._isocronaChartData) return;

    var show15 = document.getElementById('chk-iso-15') ? document.getElementById('chk-iso-15').checked : true;
    var show30 = document.getElementById('chk-iso-30') ? document.getElementById('chk-iso-30').checked : true;
    var show60 = document.getElementById('chk-iso-60') ? document.getElementById('chk-iso-60').checked : true;

    var datosPorIsocrona = window._isocronaChartData.datosPorIsocrona;
    var tiposArray = window._isocronaChartData.tiposArray;

    // Filtrar solo isócronas activas
    var labelsActivos = [];
    if (show15) labelsActivos.push('0-15 min');
    if (show30) labelsActivos.push('15-30 min');
    if (show60) labelsActivos.push('30-60 min');

    if (labelsActivos.length === 0) {
        if (typeof isocronaChart !== 'undefined' && isocronaChart) {
            isocronaChart.data.labels = [];
            isocronaChart.data.datasets = [];
            isocronaChart.update();
        }
        // Actualizar síntesis
        var sintesisIsocrona = document.getElementById('sintesis-isocrona');
        if (sintesisIsocrona) {
            sintesisIsocrona.innerHTML = 'No hay isócronas activas seleccionadas.';
            sintesisIsocrona.style.display = 'block';
        }
        return;
    }

    var datasetsIso = [];
    tiposArray.forEach(tipo => {
        datasetsIso.push({
            label: tipo,
            data: labelsActivos.map(lbl => datosPorIsocrona[lbl][tipo] || 0),
            backgroundColor: getColorConjunto(tipo),
            borderColor: '#333',
            borderWidth: 0.5
        });
    });

    if (typeof isocronaChart !== 'undefined' && isocronaChart) {
        isocronaChart.data.labels = labelsActivos;
        isocronaChart.data.datasets = datasetsIso;
        isocronaChart.update();
    }

    // Actualizar síntesis con la primera isócrona activa
    var sintesisIsocrona = document.getElementById('sintesis-isocrona');
    if (sintesisIsocrona && labelsActivos.length > 0) {
        var primerLabel = labelsActivos[0];
        var totalEnRango = 0;
        var maxTipo = { nombre: '', cant: 0 };
        tiposArray.forEach(t => {
            let c = datosPorIsocrona[primerLabel][t] || 0;
            totalEnRango += c;
            if (c > maxTipo.cant) { maxTipo.cant = c; maxTipo.nombre = t; }
        });
        if (totalEnRango > 0) {
            sintesisIsocrona.innerHTML = `En la isócrona <b>${primerLabel}</b>, se detectan <b>${totalEnRango}</b> unidades económicas, predominando el sector <b>${maxTipo.nombre}</b>.`;
        } else {
            sintesisIsocrona.innerHTML = `No se detectaron unidades en la isócrona <b>${primerLabel}</b>.`;
        }
        sintesisIsocrona.style.display = 'block';
    }
};

// ==========================================
// E3: ÍNDICE SUPERIOR TEMPORAL — ESCALA ESTATAL
// ==========================================
window._indiceCSVCache = null;

function iniciarIndiceTemporalEstatal(nombreEstado) {
    var supContainer = document.getElementById('estatal-sup-container');
    if (!supContainer) return;

    supContainer.innerHTML = `<small style="color:#aaa; font-size:10px;">Cargando datos (~15 MB)...</small>`;

    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var titulo = document.getElementById('stats-title-text');
    if (titulo) titulo.innerHTML = `<span style="font-size:16px; font-weight:bold; text-transform:uppercase">${nombreEstado}</span><br><small style="color:#ddd; font-size:11px">Índice Educación Superior</small>`;

    // Ocultar gráficas de flujos y financieras
    var chartContainer2 = document.getElementById('myChartContainer');
    if (chartContainer2) chartContainer2.style.display = 'none';
    var topGlobalContainer = document.getElementById('topGlobalChartContainer');
    if (topGlobalContainer) topGlobalContainer.style.display = 'none';
    var chartContainerFin = document.getElementById('empresas-chart-container');
    if (chartContainerFin) chartContainerFin.style.display = 'none';
    var finOverlay = document.getElementById('fin-overlay');
    if (finOverlay) finOverlay.style.display = 'none';

    function parsearCSVIndice(texto) {
        var lineas = texto.trim().split('\n');
        var headers = lineas[0].split(',').map(h => h.trim().replace(/\r/, ''));
        var resultado = [];
        for (var i = 1; i < lineas.length; i++) {
            if (!lineas[i].trim()) continue;
            // Manejar campos con comillas
            var cols = [];
            var linea = lineas[i];
            var inQuote = false;
            var current = '';
            for (var c = 0; c < linea.length; c++) {
                if (linea[c] === '"') { inQuote = !inQuote; }
                else if (linea[c] === ',' && !inQuote) { cols.push(current.trim()); current = ''; }
                else { current += linea[c]; }
            }
            cols.push(current.trim());
            var obj = {};
            headers.forEach((h, j) => { obj[h] = cols[j] ? cols[j].replace(/\r/, '').trim() : ''; });
            resultado.push(obj);
        }
        return resultado;
    }

    // Estado -> código INEGI de entidad (para filtrar Limite_municipal_opt.geojson /
    // Limite_municipal_CDMX.geojson por "cve_ent"). Es un catálogo propio de las 32
    // entidades porque el CVE_ENT_ESTADOS de escala_municipal.js solo cubre un
    // subconjunto reducido de estados (los de esa vista).
    var CVE_ENT_INDICE_SUPERIOR = {
        "AGUASCALIENTES": "01", "BAJA CALIFORNIA": "02", "BAJA CALIFORNIA SUR": "03",
        "CAMPECHE": "04", "COAHUILA": "05", "COLIMA": "06", "CHIAPAS": "07",
        "CHIHUAHUA": "08", "CIUDAD DE MEXICO": "09", "DURANGO": "10",
        "GUANAJUATO": "11", "GUERRERO": "12", "HIDALGO": "13", "JALISCO": "14",
        "MEXICO": "15", "MICHOACAN": "16", "MORELOS": "17", "NAYARIT": "18",
        "NUEVO LEON": "19", "OAXACA": "20", "PUEBLA": "21", "QUERETARO": "22",
        "QUINTANA ROO": "23", "SAN LUIS POTOSI": "24", "SINALOA": "25",
        "SONORA": "26", "TABASCO": "27", "TAMAULIPAS": "28", "TLAXCALA": "29",
        "VERACRUZ": "30", "YUCATAN": "31", "ZACATECAS": "32"
    };

    // cveEnt (código oficial INEGI, arriba) -> archivo regional que lo trae
    // (carto/Limites_Municipales_<Región>.geojson, cruce de
    // Tablas/REGIONES.csv contra Limites_Municipales.geojson — cubre los 32
    // estados con geometría de municipio completa). Independiente de
    // escala_municipal.js: esa escala usa su PROPIO sistema de AGEB (12
    // estados, 4 regiones distintas) para su propio análisis, así que no se
    // reutilizan sus constantes aquí.
    var REGION_GEOJSON_POR_CVE_ENT = {
        "01": "carto/Limites_Municipales_Suroeste.geojson",
        "02": "carto/Limites_Municipales_Oriente.geojson",
        "03": "carto/Limites_Municipales_Oriente.geojson",
        "04": "carto/Limites_Municipales_Centrosur.geojson",
        "05": "carto/Limites_Municipales_Sureste.geojson",
        "06": "carto/Limites_Municipales_Suroeste.geojson",
        "07": "carto/Limites_Municipales_Occidente.geojson",
        "08": "carto/Limites_Municipales_Suroeste.geojson",
        "09": "carto/Limites_Municipales_Occidente.geojson",
        "10": "carto/Limites_Municipales_Oriente.geojson",
        "11": "carto/Limites_Municipales_Noroeste.geojson",
        "12": "carto/Limites_Municipales_Oriente.geojson",
        "13": "carto/Limites_Municipales_Centronorte.geojson",
        "14": "carto/Limites_Municipales_Centronorte.geojson",
        "15": "carto/Limites_Municipales_Noroeste.geojson",
        "16": "carto/Limites_Municipales_Noreste.geojson",
        "17": "carto/Limites_Municipales_Centronorte.geojson",
        "18": "carto/Limites_Municipales_Noreste.geojson",
        "19": "carto/Limites_Municipales_Noroeste.geojson",
        "20": "carto/Limites_Municipales_Noreste.geojson",
        "21": "carto/Limites_Municipales_Centrosur.geojson",
        "22": "carto/Limites_Municipales_Occidente.geojson",
        "23": "carto/Limites_Municipales_Noroeste.geojson",
        "24": "carto/Limites_Municipales_Centronorte.geojson",
        "25": "carto/Limites_Municipales_Sureste.geojson",
        "26": "carto/Limites_Municipales_Centrosur.geojson",
        "27": "carto/Limites_Municipales_Sureste.geojson",
        "28": "carto/Limites_Municipales_Centronorte.geojson",
        "29": "carto/Limites_Municipales_Sureste.geojson",
        "30": "carto/Limites_Municipales_Occidente.geojson",
        "31": "carto/Limites_Municipales_Noroeste.geojson",
        "32": "carto/Limites_Municipales_Noroeste.geojson"
    };

    function _normalizarNombreMunicipio(nombre) {
        return (nombre || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    }

    var municipiosIndiceLayer = null;

    // Colorea los municipios de la entidad seleccionada según su ranking de
    // Titulados Total (coropleta), reusando RampaRojos/calcularBreaks/getClase
    // igual que las demás coropletas del proyecto.
    function _renderizarMunicipiosIndiceEducacion(datosEstado, municipioSeleccionado) {
        var cveEnt = CVE_ENT_INDICE_SUPERIOR[obtenerNombreEstandarEstado(nombreEstado)];
        if (!cveEnt) return;

        var totalesPorMunicipio = {};
        datosEstado.forEach(function (d) {
            var muniNorm = _normalizarNombreMunicipio(d['MUNICIPIO']);
            if (!muniNorm) return;
            totalesPorMunicipio[muniNorm] = (totalesPorMunicipio[muniNorm] || 0) + (parseInt(d['Titulados Total']) || 0);
        });

        // Antes usaba window.cargarLimiteMunicipalGeoJSON() (Limite_municipal_opt/
        // CDMX.geojson) — ese archivo no cubre bien todas las entidades/municipios
        // (varios quedaban sin encender en el mapa). Se usa en su lugar el
        // archivo regional correspondiente (carto/Limites_Municipales_
        // <Región>.geojson, cruce de Tablas/REGIONES.csv), con cobertura
        // completa y verificada de los 32 estados.
        var archivoRegion = REGION_GEOJSON_POR_CVE_ENT[cveEnt];
        if (!archivoRegion) {
            console.error('No se encontró el archivo regional para la entidad (cveEnt=' + cveEnt + ')');
            return;
        }

        AppData.load(archivoRegion).then(function (muniGeo) {
            if (!muniGeo) return;
            var featuresEstado = muniGeo.features.filter(function (f) { return f.properties.CVE_ENT === cveEnt; });
            if (featuresEstado.length === 0) return;

            var valores = Object.keys(totalesPorMunicipio).map(function (k) { return totalesPorMunicipio[k]; }).filter(function (v) { return v > 0; });
            valores.sort(function (a, b) { return a - b; });
            var breaks = calcularBreaks(valores);

            if (municipiosIndiceLayer) { map.removeLayer(municipiosIndiceLayer); municipiosIndiceLayer = null; }
            if (currentGeoJSONLayer) { map.removeLayer(currentGeoJSONLayer); currentGeoJSONLayer = null; }

            var muniSelNorm = municipioSeleccionado ? _normalizarNombreMunicipio(municipioSeleccionado) : null;

            var layer_geo = L.geoJSON({ type: "FeatureCollection", features: featuresEstado }, {
                style: function (feature) {
                    var muniNorm = _normalizarNombreMunicipio(feature.properties.NOMMUN);
                    var val = totalesPorMunicipio[muniNorm] || 0;
                    var esSeleccionado = muniSelNorm && muniNorm === muniSelNorm;
                    var color = '#333', opacity = 0.35;
                    if (val > 0) { color = RampaRojos[getClase(val, breaks)] || '#333'; opacity = 0.78; }
                    return {
                        fillColor: color, fillOpacity: opacity,
                        color: esSeleccionado ? '#00e5ff' : 'white',
                        weight: esSeleccionado ? 3 : 1, opacity: 1
                    };
                },
                onEachFeature: function (feature, layer) {
                    var muniNorm = _normalizarNombreMunicipio(feature.properties.NOMMUN);
                    var val = totalesPorMunicipio[muniNorm] || 0;
                    layer.bindTooltip(
                        '<b>' + feature.properties.NOMMUN + '</b><br>Titulados: ' + val.toLocaleString('es-MX'),
                        { sticky: true, className: 'custom-tooltip' }
                    );
                    layer.on({
                        mouseover: function (e) { e.target.setStyle({ weight: 3 }); e.target.bringToFront(); },
                        mouseout: function (e) { layer_geo.resetStyle(e.target); },
                        click: function (e) {
                            var muniSelect = document.getElementById('indice-municipio-select');
                            if (!muniSelect) return;
                            var opt = Array.from(muniSelect.options).find(function (o) {
                                return _normalizarNombreMunicipio(o.value) === muniNorm;
                            });
                            if (opt) {
                                muniSelect.value = opt.value;
                                muniSelect.dispatchEvent(new Event('change'));
                            }
                        }
                    });
                }
            });

            municipiosIndiceLayer = layer_geo.addTo(map);
            currentGeoJSONLayer = municipiosIndiceLayer;

            // Si hay un municipio elegido, centrar en SU geometría (no en todo el
            // estado) — antes siempre encuadraba el estado completo aunque ya
            // hubiera un municipio seleccionado en el dropdown.
            var boundsObjetivo = null;
            if (muniSelNorm) {
                layer_geo.eachLayer(function (l) {
                    if (_normalizarNombreMunicipio(l.feature.properties.NOMMUN) === muniSelNorm) boundsObjetivo = l.getBounds();
                });
            }
            try {
                if (boundsObjetivo) map.flyToBounds(boundsObjetivo, { padding: [60, 60], maxZoom: 11 });
                else map.flyToBounds(layer_geo.getBounds(), { padding: [30, 30], maxZoom: 10 });
            } catch (e) { }

            // Exponer referencias globales para que la leyenda clicable (clases
            // prender/apagar) pueda filtrar esta capa desde onclick="..." (fuera
            // del closure de iniciarIndiceTemporalEstatal).
            window._municipiosIndiceLayerRef = municipiosIndiceLayer;
            window._totalesPorMunicipioIndiceActual = totalesPorMunicipio;
            window._breaksMunicipiosIndiceActual = breaks;

            _actualizarLeyendaMunicipiosIndice(breaks, municipioSeleccionado);
        }).catch(function (e) {
            console.error('Error cargando municipios para Índice Educación Superior:', e);
        });
    }

    // Misma simbología "por clase" (cajas clicables que prenden/apagan) que
    // usan los análisis a escala Nacional (actualizarLeyendaProductividad /
    // actualizarLeyendaCenso) — antes esta leyenda era una franja de color
    // estática sin interacción.
    function _actualizarLeyendaMunicipiosIndice(breaks, municipioSeleccionado) {
        var overlay = document.getElementById('legend-overlay');
        var div = document.getElementById('legend-content');
        if (!div || !overlay) return;

        window._claseMunicipiosIndiceSeleccionada = null;

        var f = function (n) { return (n || 0).toLocaleString('es-MX'); };
        var colores = RampaRojos;
        var totales = window._totalesPorMunicipioIndiceActual || {};

        var conteos = [0, 0, 0, 0, 0];
        Object.keys(totales).forEach(function (m) {
            if (totales[m] > 0) conteos[getClase(totales[m], breaks)]++;
        });

        var rangos = [
            'Menor o igual a ' + f(breaks[0]),
            f(breaks[0]) + ' - ' + f(breaks[1]),
            f(breaks[1]) + ' - ' + f(breaks[2]),
            f(breaks[2]) + ' - ' + f(breaks[3]),
            'Mayor a ' + f(breaks[3])
        ];

        var html = `
            <div id="legend-flujos">
                <div style="margin: 4px 0 6px 0; font-weight:bold; color:#00e5ff; font-size:12px; text-transform:uppercase; border-bottom:1px solid rgba(0,229,255,0.3); padding-bottom:3px;">Municipios — Titulados</div>
                <div style="font-size:11px; color:#ccc; margin-bottom:8px;">Ranking de Titulados Total (Índice Educación Superior)${municipioSeleccionado ? ' · Seleccionado: <b>' + municipioSeleccionado + '</b>' : ''}</div>
                <div style="margin-bottom:12px; font-weight:bold; color:#ddd; font-size:14px; text-transform:uppercase;">CLASES</div>
                <div style="font-size:11px; color:#aaa; margin-bottom:10px;">Selecciona una clase para filtrar municipios</div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 4px; margin-top: 5px;">
        `;

        for (var i = 0; i < 5; i++) {
            html += `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <div class="legend-box-muni-indice" data-class="${i}"
                         style="background: ${colores[i]}; width: 100%; height: 25px; cursor: pointer; border: 1px solid #1a1a1a; transition: all 0.2s ease; border-radius: 2px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; color:#fff; text-shadow:1px 1px 2px #000;"
                         onclick="filtrarMapaMunicipiosIndice(${i})" title="${rangos[i]}">${conteos[i]}</div>
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
                <div id="leyenda-sintesis-muni-indice" style="margin-top:10px; font-size:11px; color:#00e5ff; font-style:italic; text-align: justify;">Da clic en un municipio del mapa o en una clase para filtrar.</div>
            </div>
        `;

        div.innerHTML = html;
        overlay.style.display = 'block';
    }

    function mostrarSelectorMunicipio(datos, estadoNorm) {
        // Solo municipios con AL MENOS un titulado registrado — antes se listaban
        // todos los municipios presentes en el CSV aunque su suma fuera 0 (sin
        // información real que mostrar ni en la coropleta ni en las gráficas).
        var totalesTmp = {};
        datos.forEach(function (d) {
            var m = (d['MUNICIPIO'] || '').trim();
            if (!m) return;
            totalesTmp[m] = (totalesTmp[m] || 0) + (parseInt(d['Titulados Total']) || 0);
        });
        var municipios = Object.keys(totalesTmp).filter(function (m) { return totalesTmp[m] > 0; }).sort();

        supContainer.innerHTML = `
            <div style="margin-top:10px;">
                <small style="color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;">Municipio:</small>
                <select id="indice-municipio-select" class="dynamic-filter-select">
                    <option value="" selected>-- Todos los municipios --</option>
                    ${municipios.map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
            </div>
        `;

        // Renderizar con todos los municipios al inicio
        renderizarGraficasIndiceTemporal(datos, estadoNorm, null);
        _renderizarMunicipiosIndiceEducacion(datos, null);

        document.getElementById('indice-municipio-select').onchange = function() {
            var mun = this.value || null;
            renderizarGraficasIndiceTemporal(datos, estadoNorm, mun);
            _renderizarMunicipiosIndiceEducacion(datos, mun);
        };
    }

    function procesarIndice(todosDatos) {
        // Normalizar el nombre del estado para comparar con el CSV (en mayúsculas)
        var estadoNormCSV = nombreEstado.toUpperCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/MICHOACAN DE OCAMPO/i, 'MICHOACAN')
            .replace(/COAHUILA DE ZARAGOZA/i, 'COAHUILA')
            .replace(/QUERETARO DE ARTEAGA/i, 'QUERETARO')
            .replace(/VERACRUZ DE IGNACIO DE LA LLAVE/i, 'VERACRUZ')
            .trim();

        var datosFiltrados = todosDatos.filter(d => {
            var entCSV = (d['ENTIDAD FEDERATIVA'] || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            return entCSV === estadoNormCSV || entCSV.includes(estadoNormCSV) || estadoNormCSV.includes(entCSV);
        });

        if (datosFiltrados.length === 0) {
            supContainer.innerHTML = `<small style="color:#ff5252; font-size:10px;">No se encontraron datos para <b>${nombreEstado}</b> en el Índice Educación Superior.</small>`;
            return;
        }

        mostrarSelectorMunicipio(datosFiltrados, estadoNormCSV);
    }

    if (window._indiceCSVCache) {
        procesarIndice(window._indiceCSVCache);
    } else {
        AppData.load('Tablas/Indice_superior_temporal.csv').then(csvText => {
            window._indiceCSVCache = parsearCSVIndice(csvText);
            procesarIndice(window._indiceCSVCache);
        }).catch(err => {
            console.error('Error cargando Indice_superior_temporal.csv:', err);
            if (supContainer) supContainer.innerHTML = `<small style="color:#ff5252;">Error al cargar el CSV.</small>`;
        });
    }
}

// Toggle de clase para la coropleta de municipios de "Índice Educación
// Superior" — mismo mecanismo que window.filtrarMapaProductividad /
// window.filtrarMapaCenso en escala_nacional_v1.js. Vive en scope global
// (no dentro del closure de iniciarIndiceTemporalEstatal) porque el
// onclick="filtrarMapaMunicipiosIndice(i)" de la leyenda se resuelve contra
// el scope global.
window._claseMunicipiosIndiceSeleccionada = null;

function _normalizarNombreMunicipioGlobal(nombre) {
    return (nombre || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

window.filtrarMapaMunicipiosIndice = function (clase) {
    if (window._claseMunicipiosIndiceSeleccionada === clase) {
        window._claseMunicipiosIndiceSeleccionada = null;
    } else {
        window._claseMunicipiosIndiceSeleccionada = clase;
    }

    var sintesisEl = document.getElementById('leyenda-sintesis-muni-indice');
    if (sintesisEl) {
        sintesisEl.innerHTML = window._claseMunicipiosIndiceSeleccionada === null
            ? "Da clic en un municipio del mapa o en una clase para filtrar."
            : "Clase " + (window._claseMunicipiosIndiceSeleccionada + 1) + " seleccionada.";
    }

    document.querySelectorAll('.legend-box-muni-indice').forEach(function (box) {
        var boxClase = parseInt(box.getAttribute('data-class'));
        if (window._claseMunicipiosIndiceSeleccionada === null) {
            box.style.opacity = '1'; box.style.border = '1px solid #1a1a1a'; box.style.transform = 'scale(1)';
        } else if (boxClase === window._claseMunicipiosIndiceSeleccionada) {
            box.style.opacity = '1'; box.style.border = '2px solid #00e5ff'; box.style.transform = 'scale(1.1)'; box.style.zIndex = '10';
        } else {
            box.style.opacity = '0.3'; box.style.border = '1px solid #1a1a1a'; box.style.transform = 'scale(1)'; box.style.zIndex = '1';
        }
    });

    var layer = window._municipiosIndiceLayerRef;
    var totales = window._totalesPorMunicipioIndiceActual;
    var breaks = window._breaksMunicipiosIndiceActual;
    if (layer && totales && breaks) {
        layer.eachLayer(function (l) {
            var muniNorm = _normalizarNombreMunicipioGlobal(l.feature.properties.NOMMUN);
            var val = totales[muniNorm] || 0;
            if (val > 0) {
                var claseMuni = getClase(val, breaks);
                if (window._claseMunicipiosIndiceSeleccionada === null || claseMuni === window._claseMunicipiosIndiceSeleccionada) {
                    l.setStyle({ opacity: 1, fillOpacity: 0.78 });
                } else {
                    l.setStyle({ opacity: 0.2, fillOpacity: 0.1 });
                }
            } else {
                l.setStyle({ opacity: 0.2, fillOpacity: 0.15 });
            }
        });
    }
};

function renderizarGraficasIndiceTemporal(datos, estadoNorm, municipio) {
    // Filtrar por municipio si se especifica
    var df = municipio ? datos.filter(d => d['MUNICIPIO'] === municipio) : datos;

    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    // --- Conteos generales ---
    var totalTitulados = df.reduce((s, d) => s + (parseInt(d['Titulados Total']) || 0), 0);
    var totalMujeres = df.reduce((s, d) => s + (parseInt(d['Titulados Mujeres']) || 0), 0);
    var totalHombres = df.reduce((s, d) => s + (parseInt(d['Titulados Hombres']) || 0), 0);

    var titulo = document.getElementById('stats-title-text');
    if (titulo) {
        var lugar = municipio ? municipio : (estadoNorm || 'Estado');
        titulo.innerHTML = `<span style="font-size:16px; font-weight:bold">${lugar}</span><br>
            <span style="font-size:12px; color:#ddd">Total Titulados: <b>${totalTitulados.toLocaleString('es-MX')}</b></span><br>
            <span style="font-size:11px; color:#aaa">♀ Mujeres: <b>${totalMujeres.toLocaleString('es-MX')}</b> | ♂ Hombres: <b>${totalHombres.toLocaleString('es-MX')}</b></span>`;
    }

    // --- Gráfica 1: Titulados por Campo Amplio de Formación ---
    var porCampo = {};
    df.forEach(d => {
        var campo = d['CAMPO AMPLIO DE FORMACIÓN'] || 'Sin dato';
        var total = parseInt(d['Titulados Total']) || 0;
        porCampo[campo] = (porCampo[campo] || 0) + total;
    });
    var camposOrdenados = Object.keys(porCampo).sort((a, b) => porCampo[b] - porCampo[a]).slice(0, 12);

    var canvasMyChart = document.getElementById('myChart');
    if (canvasMyChart) {
        canvasMyChart.parentElement.style.height = '200px';
        if (mainChart) mainChart.destroy();
        mainChart = new Chart(canvasMyChart.getContext('2d'), {
            type: 'bar',
            data: {
                labels: camposOrdenados.map(c => c.length > 25 ? c.substring(0, 24) + '…' : c),
                datasets: [{
                    label: 'Titulados',
                    data: camposOrdenados.map(c => porCampo[c]),
                    backgroundColor: ['#00e5ff','#ff3366','#d59f0f','#00e676','#d500f9','#ff6d00','#76ff03','#651fff','#00b0ff','#f50057','#69f0ae','#ffd740'],
                    borderWidth: 1,
                    borderColor: '#222'
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#aaa', font: { size: 9 } }, grid: { color: '#444' } },
                    y: { ticks: { color: '#ddd', font: { size: 9 } }, grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        display: function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; },
                        color: '#fff', font: { weight: 'bold', size: 8 },
                        formatter: function(value) { return value > 0 ? value.toLocaleString('es-MX') : ''; }
                    }
                }
            }
        });
    }

    // --- Gráfica 2: Evolución temporal por Ciclo Escolar ---
    var porCiclo = {};
    df.forEach(d => {
        var ciclo = d['CICLO ESCOLAR'] || 'Sin dato';
        var total = parseInt(d['Titulados Total']) || 0;
        porCiclo[ciclo] = (porCiclo[ciclo] || 0) + total;
    });
    var ciclosOrdenados = Object.keys(porCiclo).sort();

    var topGlobalContainer = document.getElementById('topGlobalChartContainer');
    var topGlobalTitle = document.getElementById('topGlobalChartTitle');
    var topGlobalHr = document.getElementById('topGlobalChartHr');
    if (topGlobalContainer) {
        topGlobalContainer.style.display = 'block';
        if (topGlobalTitle) { topGlobalTitle.innerHTML = 'EVOLUCIÓN TEMPORAL DE TITULADOS'; topGlobalTitle.style.display = 'block'; }
        if (topGlobalHr) topGlobalHr.style.display = 'block';

        var canvasTemporal = document.getElementById('topGlobalChart');
        if (canvasTemporal) {
            if (window.topGlobalChartInstance) window.topGlobalChartInstance.destroy();
            window.topGlobalChartInstance = new Chart(canvasTemporal.getContext('2d'), {
                type: 'line',
                data: {
                    labels: ciclosOrdenados,
                    datasets: [{
                        label: 'Total Titulados',
                        data: ciclosOrdenados.map(c => porCiclo[c]),
                        borderColor: '#00e5ff',
                        backgroundColor: 'rgba(0,229,255,0.15)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#222'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(20,20,20,0.95)',
                            titleColor: '#00e5ff', bodyColor: '#fff', borderColor: '#555', borderWidth: 1
                        }
                    },
                    scales: {
                        x: { ticks: { color: '#aaa', font: { size: 9 }, maxRotation: 45 }, grid: { color: '#333' } },
                        y: { ticks: { color: '#aaa', font: { size: 9 } }, grid: { color: '#333' } }
                    }
                }
            });
        }
    }

    // --- Síntesis ---
    var summaryDiv = document.getElementById('dynamic-summary-global');
    if (summaryDiv) {
        var topCampo = camposOrdenados[0] || 'N/A';
        summaryDiv.innerHTML = `En <b>${municipio || estadoNorm}</b>, se registran <b>${totalTitulados.toLocaleString('es-MX')}</b> titulados totales. El campo de mayor concentración es <b style="color:#00e5ff">${topCampo}</b> con <b>${(porCampo[topCampo] || 0).toLocaleString('es-MX')}</b> titulados.`;
        summaryDiv.style.display = 'block';
    }
}
