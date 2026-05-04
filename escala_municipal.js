// ==========================================
// 3. ESCALA MUNICIPAL (AGEB) Y REGIONAL
// ==========================================

// Diccionario de los nuevos archivos regionales (Lazy Loading structure).
const REGIONES_AGEB = {
    "Region Norte": "region_Norte.geojson",
    "Region Centro": "region_Centro.geojson",
    "Region Occidente": "region_Occidente.geojson"
};

// Mapeo inverso de qué estados le tocan a qué región.
const ESTADOS_POR_REGION = {
    "Baja California": "Region Norte",
    "Coahuila": "Region Norte",
    "Nuevo León": "Region Norte",
    "San Luis Potosí": "Region Norte",
    "Sonora": "Region Norte",
    "Estado de México": "Region Centro",
    "Morelos": "Region Centro",
    "Puebla": "Region Centro",
    "Aguascalientes": "Region Occidente",
    "Guanajuato": "Region Occidente",
    "Jalisco": "Region Occidente"
};

// Mapeo de Códigos de Entidad (CVE_ENT) proporcionado
const CVE_ENT_ESTADOS = {
    "Aguascalientes": "01",
    "Baja California": "02",
    "Coahuila": "05",
    "Nuevo León": "19",
    "San Luis Potosí": "24",
    "Sonora": "26",
    "Estado de México": "15",
    "Morelos": "17",
    "Puebla": "21",
    "Guanajuato": "11",
    "Jalisco": "14"
};

function iniciarLogicaMunicipio() {
    if (agebLayer) { map.removeLayer(agebLayer); agebLayer = null; }
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
    agebRawData = null;

    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";
    document.getElementById('filter-title').innerText = "Vulnerabilidad Multivariada";

    // Mantenemos la lista visual de todos los estados para el usuario final
    var nombresEstados = Object.keys(ESTADOS_POR_REGION).sort();

    var selectEstado = document.createElement("select");
    selectEstado.className = "dynamic-filter-select";
    selectEstado.innerHTML = `<option value="" disabled selected>-- Entidad Federativa --</option>`;
    nombresEstados.forEach(nombre => {
        // En vez de guardar un solo archivo `.geojson`, guardamos la clave de la región para cargarlo
        var regionAsociada = ESTADOS_POR_REGION[nombre];
        selectEstado.innerHTML += `<option value="${regionAsociada}">${nombre}</option>`;
    });

    var selectIndice = document.createElement("select");
    selectIndice.className = "dynamic-filter-select";
    selectIndice.style.display = 'none';

    var opcionesAgeb = [
        { id: 'g_espacial', label: 'Vulnerabilidad en Hogar' },
        { id: 'g_urbano', label: 'Deficiencias en Infraestructura' },
        { id: 'g_socioeco', label: 'Sin Oportunidades' },
        { id: 'G_INDICE', label: 'Índice Global' }
    ];

    selectEstado.onchange = function () {
        if (this.value) {
            var nombreEst = this.options[this.selectedIndex].text;
            var regionKey = this.value;
            // Busca el archivo asignado en el diccionario
            var archivoGeojson = REGIONES_AGEB[regionKey] || "agebmex.geojson"; // Puedes dejar uno por defecto por si falla
            document.getElementById('filter-title').innerText = "Cargando " + nombreEst + "...";
            cargarAgebEstadoRegional(nombreEst, archivoGeojson, selectIndice, opcionesAgeb);
        }
    };

    selectIndice.onchange = function () {
        if (this.value) {
            var labelNombre = this.options[this.selectedIndex].text;
            renderizarMapaAgeb(this.value, labelNombre, document.querySelector('#filter-buttons-container select').options[document.querySelector('#filter-buttons-container select').selectedIndex].text);
        }
    };

    container.appendChild(selectEstado);
    container.appendChild(selectIndice);



    // ==========================================
    // HERRAMIENTA DE DIBUJO (PARTICIPATIVA)
    // ==========================================
    if (map.pm) {
        // Habilitar controles de dibujo de Leaflet-Geoman
        map.pm.addControls({
            position: 'topright',
            drawCircle: false,
            drawCircleMarker: false,
            drawText: false,
            cutPolygon: false,
            editMode: true,
            dragMode: true,
            removalMode: true
        });

        // Asegurarse de que no haya múltiples listeners
        map.off('pm:create');

        map.on('pm:create', function (e) {
            var layer = e.layer;

            // Extraer la geometría en formato GeoJSON de forma legible
            var geojsonObj = layer.toGeoJSON().geometry;
            var geojsonStr = JSON.stringify(geojsonObj);

            // Reemplaza esta URL con tu enlace completo de Google Forms o MS Forms
            var formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfrjJrtuq0PMRqzGjPuu1YiTlI_sr9jQcaeKUu88pv89NlVCg/viewform?usp=publish-editor';

            var popupContent = `
                <div style="font-family:'Noto Sans'; font-size:13px; min-width: 250px;">
                    <strong style="color:#0277bd; font-size:14px; display:flex; align-items:center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right:6px;"><path fill="currentColor" d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z"/></svg> 
                        Geometría Participativa
                    </strong>
                    <hr style="border:0; border-top:1px solid #555; margin:5px 0;">
                    
                    <p style="margin: 5px 0; color:#ddd; font-size:12px;">Copia las coordenadas y pégalas en el formulario Excel:</p>
                    <textarea id="coord-textarea" style="width: 100%; height: 50px; background: #222; color: #00e5ff; border: 1px solid #444; border-radius: 4px; font-size: 11px; padding: 4px; resize: none; margin-bottom: 5px;" readonly>${geojsonStr}</textarea>
                    
                    <button onclick="document.getElementById('coord-textarea').select(); document.execCommand('copy'); alert('¡Coordenadas copiadas al portapapeles!');" style="width: 100%; background: #444; color: #fff; border: 1px solid #666; padding: 5px; border-radius: 4px; cursor: pointer; margin-bottom: 10px; font-size: 12px; transition: background 0.2s;">📋 Copiar Coordenadas</button>
                    
                    <hr style="border:0; border-top:1px solid #555; margin:10px 0;">
                    <button onclick="window.open('${formUrl}', '_blank');" style="width: 100%; background: #0277bd; color: #fff; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; transition: background 0.2s;" onmouseover="this.style.background='#01579b'" onmouseout="this.style.background='#0277bd'">📊 Abrir Formulario / Excel</button>
                </div>
            `;

            layer.bindPopup(popupContent, { minWidth: 260 }).openPopup();

            // Cambiar color de la capa dibujada
            if (layer.setStyle) {
                layer.setStyle({ color: '#00e5ff', fillColor: '#00e5ff', fillOpacity: 0.3, weight: 3 });
            }
        });
    }

    var legendContent = document.getElementById('legend-content');
    if (legendContent) legendContent.innerHTML = "<small>Seleccione un estado primero</small>";
}

// Global scope tracker so we don't fetch the same region repeatedly
var currentRegionCache = null;

function cargarAgebEstadoRegional(nombreEstado, archivoGeojson, selectIndice, opcionesAgeb) {
    var promises = [];

    // Lazy Loading: Solo descarga si la región en caché es diferente a la solicitada
    // Así aprovechamos que agrupaste los GeoJSON!
    var necesitaDescargaGeojson = !currentRegionCache || currentRegionCache.filename !== archivoGeojson;

    if (necesitaDescargaGeojson) {
        promises.push(fetch(archivoGeojson).then(r => r.json()));
    } else {
        promises.push(Promise.resolve(currentRegionCache.data));
    }

    // Armadoras siempre lo cargamos o lo abstraemos también
    promises.push(fetch('armadoras.geojson').then(r => r.json()));

    Promise.all(promises)
        .then(([agebDataRegional, armadorasData]) => {
            document.getElementById('filter-title').innerText = "Vulnerabilidad";

            // Guardamos en caché
            if (necesitaDescargaGeojson) {
                currentRegionCache = { filename: archivoGeojson, data: agebDataRegional };
            }

            // Filtramos de forma INTELIGENTE para quedarnos solo con el Estado que eligió el usuario
            var estadoBusqueda = (typeof normalizarTexto !== 'undefined') ? normalizarTexto(nombreEstado) : nombreEstado.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            // Obtenemos la clave numérica del estado (05, 19, etc) desde nuestro diccionario
            var cveEntBusqueda = CVE_ENT_ESTADOS[nombreEstado];

            // Filtramos para aislar los AGEB de ESTE ESTADO especifico y no pintar toda la región
            var featuresFiltradas = agebDataRegional.features.filter(f => {
                // Evaluamos la coincidencia exacta por el identificador numérico (05, 19, etc)
                var cveNum = f.properties.CVE_ENT || (f.properties.CVEGEO ? f.properties.CVEGEO.substring(0, 2) : null);
                if (cveNum && cveEntBusqueda && cveNum === cveEntBusqueda) return true;

                // Respaldo (Failsafe): Búsqueda tradicional por su nombre de tabla de atributos
                var propEstado = f.properties.NOM_ENT || f.properties.ENTIDAD || f.properties.NOMGEO || "Desconocido";
                var normalizado = (typeof normalizarTexto !== 'undefined') ? normalizarTexto(propEstado) : propEstado.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                return normalizado === estadoBusqueda || propEstado.includes(estadoBusqueda);
            });

            // Si por alguna razón los GeoJSON agrupados ya NO pueden dividirse, enviamos toda la región
            if (featuresFiltradas.length === 0) {
                featuresFiltradas = agebDataRegional.features;
            }

            // Simular un nuevo feature collection base para agebRawData
            agebRawData = { type: "FeatureCollection", features: featuresFiltradas };

            armadorasRawData = armadorasData;

            var armadorasFiltradas = armadorasRawData.features.filter(f => {
                var estadoArmadora = (typeof normalizarTexto !== 'undefined') ? normalizarTexto(f.properties.Estado || f.properties.ESTADO || f.properties.NOMGEO) : (f.properties.Estado || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                if (estadoBusqueda === "BAJA CALIFORNIA" && estadoArmadora.includes("SUR")) return false;
                return estadoArmadora === estadoBusqueda || estadoArmadora.includes(estadoBusqueda) || estadoBusqueda.includes(estadoArmadora);
            });

            if (typeof dibujarArmadorasPuntos === "function") dibujarArmadorasPuntos(armadorasFiltradas);

            var bounds = L.geoJSON(agebRawData).getBounds();
            // Calcula el zoom ideal y fuerza un nivel adicional de acercamiento (+1)
            var zoomProfundo = map.getBoundsZoom(bounds) + 1;
            map.flyTo(bounds.getCenter(), zoomProfundo, { duration: 1.5 });

            selectIndice.innerHTML = `<option value="" disabled>-- Índice --</option>`;
            opcionesAgeb.forEach((opc, idx) => {
                var sel = idx === 3 ? "selected" : "";
                selectIndice.innerHTML += `<option value="${opc.id}" ${sel}>${opc.label}</option>`;
            });
            selectIndice.style.display = 'block';

            renderizarMapaAgeb('G_INDICE', 'Índice Global', nombreEstado);
        })
        .catch(err => {
            console.error("Error cargando capas regionales:", err);
            document.getElementById('filter-title').innerText = "Archivo " + archivoGeojson + " Inexistente";
        });
}

function getColorVulnerabilidad(valorTexto) {
    if (!valorTexto) return '#333333';
    var v = valorTexto.toString().trim().toUpperCase();
    if (v === 'MUY ALTO') return '#a50f15';
    if (v === 'ALTO') return '#de2d26';
    if (v === 'MEDIO') return '#fb6a4a';
    if (v === 'BAJO') return '#fcae91';
    if (v === 'MUY BAJO') return '#fee5d9';
    return '#444444';
}

function renderizarMapaAgeb(atributo, labelNombre, nombreEstado) {
    if (agebLayer) map.removeLayer(agebLayer);
    window.filtroAgebNiveles = new Set(); // Reset filter

    agebLayer = L.geoJSON(agebRawData, {
        style: function (feature) {
            var valorCategoria = feature.properties[atributo] || "Sin dato";
            return {
                color: "#111",
                weight: 0.5,
                fillColor: getColorVulnerabilidad(valorCategoria),
                fillOpacity: 0.85,
                className: 'flujo-interactivo'
            };
        },
        onEachFeature: function (feature, layer) {
            var p = feature.properties;
            var popupContent = `
                <div style="font-family:'Noto Sans'; font-size:13px;">
                    <strong style="color:#de2d26; font-size:14px;">Análisis AGEB</strong><br>
                    <hr style="border:0; border-top:1px solid #555; margin:5px 0;">
                    <b>${labelNombre}:</b> <span style="color:#fff">${p[atributo] || "Sin dato"}</span><br><br>
                    <small style="color:#aaa; line-height: 1.5;">
                        ▸ Población Total: ${p.POB1_x ? Number(p.POB1_x).toLocaleString('en-US') : "N/A"}<br>
                        ▸ Población con Discapacidad: ${p.DISC1 ? Number(p.DISC1).toLocaleString('en-US') : "N/A"}<br>
                        ▸ Población Especializada: ${p.EDU46 ? Number(p.EDU46).toLocaleString('en-US') : "N/A"}<br>
                        ▸ Población Ocupada: ${p.ECO4 ? Number(p.ECO4).toLocaleString('en-US') : "N/A"}
                    </small>
                </div>
            `;
            layer.bindPopup(popupContent);

            layer.on({
                mouseover: function (e) { e.target.setStyle({ weight: 2, color: '#fff' }); e.target.bringToFront(); },
                mouseout: function (e) { agebLayer.resetStyle(e.target); }
            });
        }
    }).addTo(map);

    agebLayer.bringToBack();
    if (armadorasLayer) armadorasLayer.bringToFront();

    // Calcular frecuencias para leyenda
    var conteo = { 'Muy Alto': 0, 'Alto': 0, 'Medio': 0, 'Bajo': 0, 'Muy Bajo': 0, 'Sin dato': 0 };
    if (agebRawData && agebRawData.features) {
        agebRawData.features.forEach(f => {
            var val = f.properties[atributo]; if (!val) val = "Sin dato";
            var v = val.toString().trim().toUpperCase();
            if (v === 'MUY ALTO') conteo['Muy Alto']++; else if (v === 'ALTO') conteo['Alto']++;
            else if (v === 'MEDIO') conteo['Medio']++; else if (v === 'BAJO') conteo['Bajo']++;
            else if (v === 'MUY BAJO') conteo['Muy Bajo']++; else conteo['Sin dato']++;
        });
    }

    actualizarLeyendaAgebCategorica(labelNombre, conteo);

    var summaryDiv = document.getElementById('dynamic-summary');
    if (summaryDiv) summaryDiv.style.display = 'none';

    actualizarGraficasMunicipal(nombreEstado, atributo);
}

function actualizarGraficasMunicipal(nombreEstado, atributo) {
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var titleDiv = document.getElementById('stats-title-text');
    if (titleDiv) titleDiv.innerHTML = `<span style="font-size:18px; font-weight:bold; text-transform:uppercase">${nombreEstado}</span><br><span style="font-size:13px; color:#ddd">Resumen Demográfico</span>`;

    var topGlobalContainer = document.getElementById('topGlobalChartContainer');
    if (topGlobalContainer) topGlobalContainer.style.display = 'none';
    var topGlobalTitle = document.getElementById('topGlobalChartTitle');
    if (topGlobalTitle) topGlobalTitle.style.display = 'none';
    var topGlobalHr = document.getElementById('topGlobalChartHr');
    if (topGlobalHr) topGlobalHr.style.display = 'none';
    var myChartContainer = document.getElementById('myChartContainer');
    if (myChartContainer) myChartContainer.style.display = 'none';
    var myChartTitle = document.getElementById('myChartTitle');
    if (myChartTitle) myChartTitle.style.display = 'none';
    var vinculacionContainer = document.getElementById('vinculacion-charts-container');
    if (vinculacionContainer) vinculacionContainer.style.display = 'none';

    var municipalContainer = document.getElementById('municipal-charts-container');
    if (municipalContainer) municipalContainer.style.display = 'block';

    var summaryDivGlobal = document.getElementById('dynamic-summary-global');
    if (summaryDivGlobal) summaryDivGlobal.style.display = 'none';
    var summaryDiv = document.getElementById('dynamic-summary');
    if (summaryDiv) summaryDiv.style.display = 'none';

    if (!agebRawData || !agebRawData.features) return;

    // Chart 1: Población Total por Tipo de Vulnerabilidad
    var pobPorVuln = { 'Muy Bajo': 0, 'Bajo': 0, 'Medio': 0, 'Alto': 0, 'Muy Alto': 0, 'Sin dato': 0 };

    // Chart 2: Estructura Poblacional
    var totalPob = 0;
    var totalDisc = 0;
    var totalEdu = 0;
    var totalEco = 0;

    agebRawData.features.forEach(f => {
        var p = f.properties;
        var valCat = p[atributo] || "Sin dato";
        var v = valCat.toString().trim().toUpperCase();
        var nivel = "Sin dato";
        if (v === 'MUY ALTO') nivel = 'Muy Alto';
        else if (v === 'ALTO') nivel = 'Alto';
        else if (v === 'MEDIO') nivel = 'Medio';
        else if (v === 'BAJO') nivel = 'Bajo';
        else if (v === 'MUY BAJO') nivel = 'Muy Bajo';

        var pobFeature = parseFloat(p.POB1_x) || 0;
        if (pobPorVuln[nivel] !== undefined) {
            pobPorVuln[nivel] += pobFeature;
        }

        totalPob += pobFeature;
        totalDisc += parseFloat(p.DISC1) || 0;
        totalEdu += parseFloat(p.EDU46) || 0;
        totalEco += parseFloat(p.ECO4) || 0;
    });

    var canvasVuln = document.getElementById('vulnChart');
    if (canvasVuln) {
        var ctxVuln = canvasVuln.getContext('2d');
        if (window.vulnChartInstance) window.vulnChartInstance.destroy();

        var labelsVuln = ['Muy Bajo', 'Bajo', 'Medio', 'Alto', 'Muy Alto'];
        var dataVuln = labelsVuln.map(l => pobPorVuln[l]);
        var colorsVuln = ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'];

        window.vulnChartInstance = new Chart(ctxVuln, {
            type: 'pie',
            data: {
                labels: labelsVuln,
                datasets: [{
                    label: 'Población',
                    data: dataVuln,
                    backgroundColor: colorsVuln,
                    borderColor: '#222',
                    borderWidth: 1
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'right', labels: { color: '#ccc', font: { size: 10 }, boxWidth: 12, padding: 6 } },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 11 },
                        textShadowBlur: 3, textShadowColor: '#000',
                        formatter: function (value, context) {
                            var total = context.dataset.data.reduce((a, b) => a + b, 0); 
                            var pct = ((value / total) * 100).toFixed(1);
                            return pct > 5 ? pct + '%' : '';
                        }
                    }
                }
            }
        });
    }

    var canvasPob = document.getElementById('pobChart');
    if (canvasPob) {
        var ctxPob = canvasPob.getContext('2d');
        if (window.pobChartInstance) window.pobChartInstance.destroy();

        var labelsPob = ['Ocupada', 'Especializada', 'Discapacidad'];
        var dataPob = [totalEco, totalEdu, totalDisc];
        var colorsPob = ['#00e5ff', '#ff9800', '#f44336'];

        window.pobChartInstance = new Chart(ctxPob, {
            type: 'bar',
            data: {
                labels: labelsPob,
                datasets: [{
                    label: 'Habitantes',
                    data: dataPob,
                    backgroundColor: colorsPob,
                    borderRadius: 4,
                    borderWidth: 0
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#fff',
                        align: 'end',
                        anchor: 'end',
                        font: { weight: 'bold', size: 10 },
                        formatter: function (value) { 
                            if(totalPob > 0 && value > 0) {
                                return value.toLocaleString('en-US') + ' (' + ((value/totalPob)*100).toFixed(1) + '%)'; 
                            }
                            return value > 0 ? value.toLocaleString('en-US') : '';
                        }
                    }
                },
                scales: {
                    x: { display: false, max: totalPob },
                    y: { ticks: { color: '#ccc', font: { size: 11 } }, grid: { display: false }, border: {display: false} }
                },
                layout: {
                    padding: { right: 80 }
                }
            }
        });
    }

    // --- SÍNTESIS VULNERABILIDAD ---
    var sintesisVuln = document.getElementById('sintesis-vuln');
    if (sintesisVuln) {
        var maxVulnVal = 0;
        var maxVulnNivel = '';
        for (let i = 0; i < labelsVuln.length; i++) {
            if (dataVuln[i] > maxVulnVal) {
                maxVulnVal = dataVuln[i];
                maxVulnNivel = labelsVuln[i];
            }
        }
        if (totalPob > 0 && maxVulnVal > 0) {
            var pctVuln = ((maxVulnVal / totalPob) * 100).toFixed(1);
            sintesisVuln.innerHTML = `De una población total de <b>${totalPob.toLocaleString('en-US')}</b> habitantes, la mayor concentración se encuentra en el nivel de vulnerabilidad <span style="color:#00a2ff; font-weight:bold;">${maxVulnNivel}</span> con <b>${maxVulnVal.toLocaleString('en-US')}</b> personas, representando el <b>${pctVuln}%</b> del total.`;
            sintesisVuln.style.display = 'block';
        } else {
            sintesisVuln.style.display = 'none';
        }
    }

    // --- SÍNTESIS ESTRUCTURA POBLACIONAL ---
    var sintesisPob = document.getElementById('sintesis-pob');
    if (sintesisPob) {
        if (totalPob > 0) {
            var subData = [
                { nombre: 'Ocupada', val: totalEco },
                { nombre: 'Especializada', val: totalEdu },
                { nombre: 'con Discapacidad', val: totalDisc }
            ];
            subData.sort((a, b) => b.val - a.val);
            var maxPob = subData[0];

            if (maxPob.val > 0) {
                var pctPob = ((maxPob.val / totalPob) * 100).toFixed(1);
                sintesisPob.innerHTML = `Dentro de la estructura demográfica, resalta la población <span style="color:#00a2ff; font-weight:bold;">${maxPob.nombre}</span> con <b>${maxPob.val.toLocaleString('en-US')}</b> habitantes, abarcando el <b>${pctPob}%</b> de la población total.`;
                sintesisPob.style.display = 'block';
            } else {
                sintesisPob.style.display = 'none';
            }
        } else {
            sintesisPob.style.display = 'none';
        }
    }
}

function actualizarLeyendaAgebCategorica(titulo, conteo = {}) {
    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content');
    if (!div || !overlay) return;

    var cMB = conteo['Muy Bajo'] || 0;
    var cB = conteo['Bajo'] || 0;
    var cM = conteo['Medio'] || 0;
    var cA = conteo['Alto'] || 0;
    var cMA = conteo['Muy Alto'] || 0;

    var infoButtonHtml = '';
    var imageName = '';

    var tituloLimpio = titulo.trim();
    if (tituloLimpio === 'Vulnerabilidad en Hogar' || tituloLimpio === 'Vulnerabilidad en el hogar') {
        imageName = 'Vuln_hogar.png';
    } else if (tituloLimpio === 'Deficiencias en Infraestructura' || tituloLimpio === 'Deficiencia de infraestructura') {
        imageName = 'Vuln_Urbana.png';
    } else if (tituloLimpio === 'Sin Oportunidades' || tituloLimpio === 'Sin oportunidades') {
        imageName = 'Vuln_oportunidades.png';
    }

    if (imageName) {
        infoButtonHtml = `
            <span 
                onclick="mostrarImagenInfo('${imageName}')" 
                title="Ver ponderación de variables"
                style="display:inline-flex; align-items:center; justify-content:center; width: 18px; height: 18px; border-radius: 50%; background: #00e5ff; color: #111; font-size: 13px; font-weight: bold; cursor: pointer; margin-left: 8px; box-shadow: 0 0 5px rgba(0,229,255,0.6); line-height: 1;"
            >i</span>
        `;
    }

    var html = `
        <div style="display:flex; align-items:center; margin-bottom:12px; font-weight:bold; color:#ddd; font-size:14px;">
            ${titulo} ${infoButtonHtml}
        </div>
        <div style="width: 100%; padding: 0 5px; box-sizing: border-box; margin-bottom: 15px;">
            <div style="display: flex; width: 100%; height: 22px; border-radius: 4px; border: 1px solid #555; overflow: hidden; text-align: center; line-height: 22px; font-size: 12px; font-weight: bold; color: #111;">
                <div class="ageb-legend-item" data-nivel="Muy Bajo" onclick="window.toggleAgebNivel('Muy Bajo')" style="flex: 1; background-color: #fee5d9; cursor:pointer;" title="Click para aislar Muy Bajo">${cMB > 0 ? cMB : ''}</div>
                <div class="ageb-legend-item" data-nivel="Bajo" onclick="window.toggleAgebNivel('Bajo')" style="flex: 1; background-color: #fcae91; cursor:pointer;" title="Click para aislar Bajo">${cB > 0 ? cB : ''}</div>
                <div class="ageb-legend-item" data-nivel="Medio" onclick="window.toggleAgebNivel('Medio')" style="flex: 1; background-color: #fb6a4a; cursor:pointer;" title="Click para aislar Medio">${cM > 0 ? cM : ''}</div>
                <div class="ageb-legend-item" data-nivel="Alto" onclick="window.toggleAgebNivel('Alto')" style="flex: 1; background-color: #de2d26; color: #fff; cursor:pointer;" title="Click para aislar Alto">${cA > 0 ? cA : ''}</div>
                <div class="ageb-legend-item" data-nivel="Muy Alto" onclick="window.toggleAgebNivel('Muy Alto')" style="flex: 1; background-color: #a50f15; color: #fff; cursor:pointer;" title="Click para aislar Muy Alto">${cMA > 0 ? cMA : ''}</div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #ccc; font-weight: bold; margin-top: 8px;">
                <span>Muy Bajo</span><span>Muy Alto</span>
            </div>
        </div>
        <div class="ageb-legend-item" data-nivel="Sin dato" onclick="window.toggleAgebNivel('Sin dato')" style="display: flex; align-items: center; margin-bottom: 6px; font-size: 12px; color: #eee; cursor:pointer; width:max-content; padding:2px;">
            <span style="width: 16px; height: 16px; margin-right: 10px; border-radius: 4px; border: 1px solid #777; background: #444444;" title="Polígonos sin información disponible"></span> Sin dato (${conteo['Sin dato'] || 0})
        </div>
        <div style="margin-top:14px; font-weight:bold; color:#ddd; font-size: 13px; margin-bottom: 8px;">Infraestructura Industrial</div>
        <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 12px; color: #eee;">
            <svg width="20" height="20" viewBox="0 0 24 24" style="margin-right:8px;">
                <polygon points="12,2 22,22 2,22" fill="#00e5ff" stroke="#fff" stroke-width="2"/>
            </svg> Planta Armadora
        </div>
    `;
    div.innerHTML = html;
    overlay.style.display = 'block';
}

function mostrarImagenInfo(imageName) {
    if (document.getElementById('imagen-info-modal')) {
        document.getElementById('imagen-info-modal').remove();
    }
    var modal = document.createElement('div');
    modal.id = 'imagen-info-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.cursor = 'pointer';
    modal.style.animation = 'fadeInSuave 0.3s ease-in-out forwards';

    var contentWrapper = document.createElement('div');
    contentWrapper.style.display = 'flex';
    contentWrapper.style.flexDirection = 'column';
    contentWrapper.style.alignItems = 'center';
    contentWrapper.style.maxWidth = '900px';
    contentWrapper.style.maxHeight = '95vh';
    contentWrapper.style.overflowY = 'auto';
    contentWrapper.style.padding = '20px';
    contentWrapper.style.cursor = 'default';

    // Prevent closing when clicking inside the content
    contentWrapper.onclick = function (e) {
        e.stopPropagation();
    };

    var img = document.createElement('img');
    img.src = imageName;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '65vh';
    img.style.borderRadius = '8px';
    img.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.5)';
    contentWrapper.appendChild(img);

    var textResumen = "";
    var conclusion = "La combinación de estos indicadores produjo un Índice de Vulnerabilidad Global que distingue con precisión los territorios consolidados con cualidades a atender.";

    if (imageName === 'Vuln_hogar.png') {
        textResumen = "La Físico-Espacial igual a “Vulnerabilidad en Hogar” refleja las condiciones materiales y de ocupación del territorio. Se construyó a partir de variables como: nuevas áreas de crecimiento urbano, la pavimentación, el alumbrado público, la densidad de vivienda, las viviendas deshabitadas y el hacinamiento. Los resultados de esta vulnerabilidad evidencian procesos de dispersión y vaciamiento urbano que afectan la eficiencia territorial. También mayores riesgos, asociados a carencias en infraestructura doméstica, inseguridad y pérdida de cohesión social.<br><br><b>" + conclusion + "</b>";
    } else if (imageName === 'Vuln_Urbana.png') {
        textResumen = "La Urbana igual a “Deficiencia en Infraestructura” se compone en tres variables ponderadas: Vivienda sin drenaje, asociadas a riesgos sanitarios y contaminación ambiental, vivienda sin agua entubada, refleja la desigualdad en el acceso al recurso más esencial para la salud pública y el bienestar doméstico y vivienda sin electricidad que representa la carencia más crítica, limita la integración productiva, educativa y social de los hogares.<br><br><b>" + conclusion + "</b>";
    } else if (imageName === 'Vuln_oportunidades.png') {
        textResumen = "La dimensión Socioeconómica igual a “Sin oportunidades” se calculó a partir de la ponderación de siete variables, se identificaron zonas con alta densidad poblacional, nivel de ingresos, población con dependencia económica, población sin afiliación a servicios de salud, población desocupada, población con discapacidad y bajo grado promedio de escolaridad. Permitió identificar áreas con mayor fragilidad social y económica.<br><br><b>" + conclusion + "</b>";
    }

    if (textResumen) {
        var textDiv = document.createElement('div');
        textDiv.innerHTML = textResumen;
        textDiv.style.marginTop = '20px';
        textDiv.style.color = '#ddd';
        textDiv.style.fontSize = '14.5px';
        textDiv.style.lineHeight = '1.6';
        textDiv.style.textAlign = 'justify';
        textDiv.style.backgroundColor = 'rgba(20,20,20,0.9)';
        textDiv.style.padding = '18px';
        textDiv.style.borderRadius = '8px';
        textDiv.style.borderLeft = '4px solid #00e5ff';
        textDiv.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
        contentWrapper.appendChild(textDiv);
    }

    modal.onclick = function () {
        modal.remove();
    };

    var closeBtn = document.createElement('div');
    closeBtn.innerHTML = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '25px';
    closeBtn.style.right = '35px';
    closeBtn.style.color = '#fff';
    closeBtn.style.fontSize = '30px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.textShadow = '0 2px 5px rgba(0,0,0,0.5)';
    closeBtn.onclick = function () {
        modal.remove();
    };

    modal.appendChild(contentWrapper);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);
}

// ==========================================
// FILTRO INTERACTIVO DE LEYENDA MUNICIPAL
// ==========================================
window.filtroAgebNiveles = new Set();
window.toggleAgebNivel = function (nivelText) {
    if (window.filtroAgebNiveles.has(nivelText)) {
        window.filtroAgebNiveles.delete(nivelText);
    } else {
        window.filtroAgebNiveles.add(nivelText);
    }

    var aplicarFiltro = window.filtroAgebNiveles.size > 0;

    var selects = document.querySelectorAll("#filter-buttons-container select");
    var selectIndice = selects.length > 1 ? selects[1] : null;
    var atributo = selectIndice ? selectIndice.value : 'G_INDICE';

    if (agebLayer) {
        agebLayer.eachLayer(function (layer) {
            var valCat = layer.feature.properties[atributo] || "Sin dato";
            var normalizado = "";
            var v = valCat.toString().trim().toUpperCase();
            if (v === 'MUY ALTO') normalizado = 'Muy Alto';
            else if (v === 'ALTO') normalizado = 'Alto';
            else if (v === 'MEDIO') normalizado = 'Medio';
            else if (v === 'BAJO') normalizado = 'Bajo';
            else if (v === 'MUY BAJO') normalizado = 'Muy Bajo';
            else normalizado = 'Sin dato';

            if (aplicarFiltro && !window.filtroAgebNiveles.has(normalizado)) {
                // Feature Oculto
                layer.setStyle({ opacity: 0, fillOpacity: 0, weight: 0 });
                layer.options.interactive = false;
            } else {
                // Feature Visible Default
                layer.setStyle({
                    color: "#111", weight: 0.5, opacity: 1,
                    fillColor: getColorVulnerabilidad(valCat), fillOpacity: 0.85
                });
                layer.options.interactive = true;
            }
        });
    }

    // Estilo Visual de la Leyenda
    var legendItems = document.querySelectorAll('.ageb-legend-item');
    legendItems.forEach(item => {
        var nivel = item.getAttribute('data-nivel');
        if (!aplicarFiltro || window.filtroAgebNiveles.has(nivel)) {
            item.style.opacity = '1';
            item.style.filter = 'grayscale(0%)';
        } else {
        }
    });
};

