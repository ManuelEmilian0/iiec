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

    // Ocultar el panel de estadísticas en la escala municipal ya que no hay gráficos
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'none';

    var summaryDiv = document.getElementById('dynamic-summary');
    if (summaryDiv) summaryDiv.style.display = 'none';
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
        imageName = 'Vuln_infraestructura.png';
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
            <div style="display: flex; width: 100%; height: 22px; border-radius: 4px; border: 1px solid #555; overflow: hidden; cursor: crosshair; text-align: center; line-height: 22px; font-size: 12px; font-weight: bold; color: #111;">
                <div style="flex: 1; background-color: #fee5d9;" title="Muy Bajo">${cMB > 0 ? cMB : ''}</div>
                <div style="flex: 1; background-color: #fcae91;" title="Bajo">${cB > 0 ? cB : ''}</div>
                <div style="flex: 1; background-color: #fb6a4a;" title="Medio">${cM > 0 ? cM : ''}</div>
                <div style="flex: 1; background-color: #de2d26; color: #fff;" title="Alto">${cA > 0 ? cA : ''}</div>
                <div style="flex: 1; background-color: #a50f15; color: #fff;" title="Muy Alto">${cMA > 0 ? cMA : ''}</div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #ccc; font-weight: bold; margin-top: 8px;">
                <span>Muy Bajo</span><span>Muy Alto</span>
            </div>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 12px; color: #eee;">
            <span style="width: 16px; height: 16px; margin-right: 10px; border-radius: 4px; border: 1px solid #777; background: #444444;" title="Polígonos sin información disponible"></span> Sin dato (${conteo['Sin dato'] || 0})
        </div>
        <div style="margin-top:14px; font-weight:bold; color:#ddd; font-size: 13px; margin-bottom: 8px;">Infraestructura Industrial</div>
        <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 12px; color: #eee;">
            <span style="width: 16px; height: 16px; margin-right: 10px; border-radius: 50%; border: 2px solid white; background: #00e5ff;"></span> Planta Armadora
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

    var img = document.createElement('img');
    img.src = imageName;
    img.style.maxWidth = '90%';
    img.style.maxHeight = '90%';
    img.style.borderRadius = '8px';
    img.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.5)';
    img.style.cursor = 'default';

    // Prevent closing when clicking the image itself
    img.onclick = function (e) {
        e.stopPropagation();
    };

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

    modal.appendChild(img);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);
}
