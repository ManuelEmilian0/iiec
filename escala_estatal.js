// ==========================================
// 2. ESCALA ESTATAL (CLÚSTERES + ISOCRONAS)
// ==========================================

function cargarArmadorasContexto() {
    fetch('armadoras.geojson').then(r => r.json()).then(data => {
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
        fetch('denue.geojson').then(r => r.json()),
        fetch('armadoras.geojson').then(r => r.json()),
        fetch('isocronas.geojson').then(r => r.json()),
        fetch('Vinculacion_empresas_DENUE_2026.geojson').then(r => r.json())
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
    if (title) title.innerText = "Accesibilidad a la Armadora Automotriz";

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
                    if (nombreMostrar === "ESTADO DE MEXICO" || nombreMostrar === "MEXICO" || nombreMostrar === "ESTADO DE MÉXICO" || nombreMostrar === "MÉXICO") nombreMostrar = "MÉXICO";
                    estadosMap.set(nameNorm, nombreMostrar);
                }
            }
        }
    });
    var estados = Array.from(estadosMap.values()).sort();

    var select = document.createElement("select");
    select.className = "dynamic-filter-select";

    var defaultOption = document.createElement("option");
    defaultOption.innerText = "-- Entidad Federativa --";
    defaultOption.value = ""; defaultOption.disabled = true; defaultOption.selected = true;
    select.appendChild(defaultOption);

    estados.forEach(estado => {
        var opt = document.createElement("option"); opt.value = estado; opt.innerText = estado;
        select.appendChild(opt);
    });

    select.onchange = function () { if (this.value) filtrarPorEstado(this.value); };
    container.appendChild(select);
}

function normalizarTexto(texto) {
    if (!texto) return "";
    return texto.toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function obtenerNombreEstandarEstado(nombre) {
    let n = normalizarTexto(nombre);
    if (n === "VERACRUZ DE IGNACIO DE LA LLAVE") return "VERACRUZ";
    if (n === "MICHOACAN DE OCAMPO") return "MICHOACAN";
    if (n === "COAHUILA DE ZARAGOZA") return "COAHUILA";
    if (n === "ESTADO DE MEXICO") return "MEXICO";
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
            unido.properties = { AA_MINS: minutos };
            featuresUnidas.push(unido);
        } catch (e) { featuresUnidas.push(...lista); }
    };
    unirGrupo(grupos[15], 15); unirGrupo(grupos[30], 30); unirGrupo(grupos[60], 60);
    return featuresUnidas;
}

function filtrarPorEstado(nombreEstado) {
    var estadoBusqueda = obtenerNombreEstandarEstado(nombreEstado);

    var denueEstado = denueRawData.features.filter(f => obtenerNombreEstandarEstado(f.properties.NOMGEO || f.properties.Entidad || f.properties.ENTIDAD || f.properties.ESTADO) === estadoBusqueda);
    var armadorasEstado = armadorasRawData.features.filter(f => {
        var estadoArmadora = obtenerNombreEstandarEstado(f.properties.Estado || f.properties.ESTADO || f.properties.NOMGEO);
        if (estadoBusqueda === "BAJA CALIFORNIA" && estadoArmadora.includes("SUR")) return false;
        return estadoArmadora === estadoBusqueda || estadoArmadora.includes(estadoBusqueda) || estadoBusqueda.includes(estadoArmadora);
    });
    var isocronasRawList = isocronasRawData.features.filter(f => obtenerNombreEstandarEstado(f.properties.NOMGEO || f.properties.Entidad || f.properties.Estado || f.properties.ESTADO || f.properties.ENTIDAD) === estadoBusqueda);
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
        var triangleHtml = '<svg width="24" height="24" viewBox="0 0 24 24"><polygon points="12,2 22,22 2,22" fill="#00e5ff" stroke="#fff" stroke-width="2"/></svg>';
        var triangleIcon = L.divIcon({ className: '', html: triangleHtml, iconSize: [24, 24], iconAnchor: [12, 12] });
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
}

function dibujarArmadorasPuntos(features) {
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
    if (!features || features.length === 0) return;
    var triangleHtml = '<svg width="24" height="24" viewBox="0 0 24 24"><polygon points="12,2 22,22 2,22" fill="#00e5ff" stroke="#fff" stroke-width="2"/></svg>';
    var triangleIcon = L.divIcon({ className: '', html: triangleHtml, iconSize: [24, 24], iconAnchor: [12, 12] });
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
function normalizarEstadoVinculacion(nombre) {
    return nombre ? nombre.toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";
}

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
    var featuresEstado = vinculacionRawData.features.filter(f => {
        var entidad = obtenerNombreEstandarEstado(f.properties.Entidad);
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
            type: 'pie',
            data: { labels: estratoLabels, datasets: [{ data: estratoValues, backgroundColor: coloresEstrato.slice(0, estratoLabels.length), borderColor: '#222', borderWidth: 1 }] },
            plugins: [ChartDataLabels],
            options: {
                responsive: true, maintainAspectRatio: false, layout: { padding: 5 },
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { color: '#ccc', font: { size: 10 }, boxWidth: 12, padding: 6 } },
                    datalabels: {
                        color: '#fff', font: { weight: 'bold', size: 12 }, textShadowBlur: 3, textShadowColor: '#000',
                        formatter: function (value, context) {
                            var total = context.dataset.data.reduce((a, b) => a + b, 0); var pct = ((value / total) * 100).toFixed(1);
                            return pct > 5 ? value + '\n(' + pct + '%)' : '';
                        }
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
    var topEmpresas = empresasTotales.slice(0, 20);

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
        sintesisEmpresa.innerHTML = `<span style="color:#00a2ff; font-weight:bold;">${topEmpresaData.nombre}</span> destaca como el principal actor corporativo dentro de esta red a nivel estatal, articulando <b>${topEmpresaData.total}</b> unidades económicas.`;
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
                    // Turf requiere un Feature<Polygon|MultiPolygon> para booleanPointInPolygon
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

        var tiposArray = Array.from(tiposSet).sort();
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

        <div style="margin-top:10px; display:flex; align-items:center; justify-content:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" style="margin-right:8px;"><polygon points="12,2 22,22 2,22" fill="#00e5ff" stroke="#fff" stroke-width="2"/></svg>
            <span style="color:#fff; font-weight:bold; font-size:12px;">Planta Armadora</span>
        </div>
    `;
    overlay.style.display = 'block';
}

// Global function to handle toggling isochrones visibility and their points
window.actualizarVisibilidadIsocronas = function() {
    var show15 = document.getElementById('chk-iso-15') ? document.getElementById('chk-iso-15').checked : true;
    var show30 = document.getElementById('chk-iso-30') ? document.getElementById('chk-iso-30').checked : true;
    var show60 = document.getElementById('chk-iso-60') ? document.getElementById('chk-iso-60').checked : true;
    var showOut = document.getElementById('chk-iso-out') ? document.getElementById('chk-iso-out').checked : true;

    if (window.animIso15) window.animIso15.forEach(l => l.setStyle({ opacity: show15 ? 1 : 0, fillOpacity: show15 ? 0.8 : 0 }));
    if (window.animIso30) window.animIso30.forEach(l => l.setStyle({ opacity: show30 ? 1 : 0, fillOpacity: show30 ? 0.4 : 0 }));
    if (window.animIso60) window.animIso60.forEach(l => l.setStyle({ opacity: show60 ? 1 : 0, fillOpacity: show60 ? 0.25 : 0 }));

    if (window.animDenue) {
        window.animDenue.forEach(l => {
            var mins = l.feature._isocrona || 999;
            var visible = false;
            if (mins <= 15 && show15) visible = true;
            else if (mins > 15 && mins <= 30 && show30) visible = true;
            else if (mins > 30 && mins <= 60 && show60) visible = true;
            else if (mins > 60 && showOut) visible = true;

            if (visible) {
                l.setStyle({ opacity: 1, fillOpacity: 0.9 });
            } else {
                l.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        });
    }
};
