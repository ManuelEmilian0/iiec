// ==========================================
// 3. ESCALA MUNICIPAL (AGEB) Y REGIONAL
// ==========================================

// Diccionario de los nuevos archivos regionales (Lazy Loading structure).
const REGIONES_AGEB = {
    "Region Norte": 'carto/region_Norte.geojson',
    "Region Centro": 'carto/region_Centro.geojson',
    "Region Occidente": 'carto/region_Occidente.geojson',
    "CDMX": 'carto/CDMX.geojson'
};

// Mapeo inverso de qué estados le tocan a qué región.
const ESTADOS_POR_REGION = {
    "Baja California": "Region Norte",
    "Coahuila": "Region Norte",
    "Nuevo León": "Region Norte",
    "San Luis Potosí": "Region Norte",
    "Sonora": "Region Norte",
    "Estado de México": "Region Centro",
    "Ciudad de México": "CDMX",
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
    "Ciudad de México": "09",
    "Morelos": "17",
    "Puebla": "21",
    "Guanajuato": "11",
    "Jalisco": "14"
};

function iniciarLogicaMunicipio() {
    if (agebLayer) { map.removeLayer(agebLayer); agebLayer = null; }
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
    if (window.equipamientoLayer) { map.removeLayer(window.equipamientoLayer); window.equipamientoLayer = null; }
    if (window.equipamientoBufferLayer) { map.removeLayer(window.equipamientoBufferLayer); window.equipamientoBufferLayer = null; }
    if (window.limiteDelegacionalLayer) { map.removeLayer(window.limiteDelegacionalLayer); window.limiteDelegacionalLayer = null; }
    if (window.levantamientoLayer) { map.removeLayer(window.levantamientoLayer); window.levantamientoLayer = null; }
    agebRawData = null;

    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";
    document.getElementById('filter-title').innerText = "Vulnerabilidad Multivariada";

    // Mantenemos la lista visual de todos los estados para el usuario final
    var nombresEstados = Object.keys(ESTADOS_POR_REGION).sort();

    var estadoContainer = document.createElement("div");
    estadoContainer.style.display = "flex";
    estadoContainer.style.alignItems = "center";
    estadoContainer.style.width = "100%";
    estadoContainer.style.gap = "10px";

    var selectEstado = document.createElement("select");
    selectEstado.className = "dynamic-filter-select";
    selectEstado.style.flex = "1";
    selectEstado.style.marginBottom = "0"; // Override if any
    selectEstado.innerHTML = `<option value="" disabled selected>-- Entidad Federativa --</option>`;
    nombresEstados.forEach(nombre => {
        var regionAsociada = ESTADOS_POR_REGION[nombre];
        selectEstado.innerHTML += `<option value="${regionAsociada}">${nombre}</option>`;
    });

    var insigniaBadge = document.createElement("div");
    insigniaBadge.id = "insignia-badge";
    insigniaBadge.style.cssText = "display:none; background:#111; border:1px solid #00e5ff; color:#fff; font-size:10px; font-weight:bold; padding:4px 8px; border-radius:4px; text-transform:uppercase; box-shadow:0 0 5px rgba(0,229,255,0.4); white-space: nowrap; cursor: pointer;";
    insigniaBadge.innerHTML = `<span style="-webkit-text-stroke: 1px #00e5ff; color: black; font-size: 14px; margin-right: 4px; vertical-align: bottom;">★</span>Proyecto Ensignia`;

    insigniaBadge.onclick = function() {
        var modal = document.getElementById("ensignia-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "ensignia-modal";
            modal.className = "dashboard-box";
            modal.style.cssText = "display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:9999; max-width:500px; width:90%; padding:20px; box-shadow:0 0 20px rgba(0,229,255,0.6); background:rgba(20,20,20,0.95); border:1px solid #00e5ff; border-radius:8px;";
            modal.innerHTML = `
                <h3 style="color:#00e5ff; margin-top:0; border-bottom:1px solid #444; padding-bottom:10px; font-size:16px;">
                    <span style="-webkit-text-stroke: 1px #00e5ff; color: black; font-size: 18px; margin-right: 6px;">★</span>Proyecto Ensignia: Síntesis
                </h3>
                <div style="font-size:12px; color:#ddd; line-height:1.5; text-align:justify; max-height:60vh; overflow-y:auto; padding-right:5px;">
                    <p><strong style="color:#e53935;">Resultado Cuantitativo:</strong> Análisis integral de cientos de AGEBs, procesamiento de múltiples variables censales e integración con el Directorio Estadístico Nacional de Unidades Económicas (DENUE). Cuantificación exacta de población y vivienda expuesta en diferentes niveles de riesgo espacial.</p>
                    <p><strong style="color:#fdd835;">Resultado Cualitativo:</strong> Identificación precisa de patrones de vulnerabilidad territorial, segregación socioespacial y déficits en infraestructura básica. Se evidencia la interacción entre la forma urbana y la fragilidad social para una focalización estratégica de recursos.</p>
                    <p><strong style="color:#4caf50;">Resultado Normativo:</strong> Evaluación multiescalar del territorio que permite sustentar planes de desarrollo y verificar el cumplimiento de normas de accesibilidad, ofreciendo evidencia cartográfica sólida para la intervención gubernamental e inversión privada.</p>
                </div>
                <div style="text-align:right; margin-top:20px;">
                    <button onclick="document.getElementById('ensignia-modal').style.display='none';" style="background:#000; color:#00e5ff; border:1px solid #00e5ff; padding:6px 20px; cursor:pointer; font-weight:bold; border-radius:4px; transition:0.3s;" onmouseover="this.style.background='#00e5ff'; this.style.color='#000';" onmouseout="this.style.background='#000'; this.style.color='#00e5ff';">Cerrar</button>
                </div>
            `;
            document.body.appendChild(modal);
        }
        modal.style.display = "block";
    };

    var selectZm = document.createElement("select");
    selectZm.className = "dynamic-filter-select";
    selectZm.id = "select-zm-muni";
    var defaultZmMuni = document.createElement("option");
    defaultZmMuni.innerText = "-- Zona Metropolitana --";
    defaultZmMuni.value = ""; defaultZmMuni.disabled = true; defaultZmMuni.selected = true;
    selectZm.appendChild(defaultZmMuni);

    Object.keys(CATALOGO_ZONAS_METROPOLITANAS).forEach(zm => {
        var opt = document.createElement("option"); 
        opt.value = zm; 
        opt.innerText = zm;
        selectZm.appendChild(opt);
    });

    selectZm.onchange = function () {
        if (this.value) {
            selectEstado.value = ""; // Deseleccionar entidad federativa
            var regionToLoad = "Region Centro"; // Default para ZMVM
            var firstCode = CATALOGO_ZONAS_METROPOLITANAS[this.value][0].substring(0, 2);
            if (firstCode === "02") regionToLoad = "Region Norte"; // ZM Tijuana -> BC -> Norte
            else if (firstCode === "19") regionToLoad = "Region Norte"; // ZM Monterrey -> NL -> Norte

            cargarAgebEstadoRegional(this.value, REGIONES_AGEB[regionToLoad] || 'carto/agebmex.geojson', selectIndice, opcionesAgeb);
        }
    };

    estadoContainer.appendChild(selectEstado);
    estadoContainer.appendChild(selectZm);
    estadoContainer.appendChild(insigniaBadge);

    var selectIndice = document.createElement("select");
    selectIndice.className = "dynamic-filter-select";
    selectIndice.style.display = 'none';

    var opcionesAgeb = [
        { id: 'g_espacial', label: 'Vulnerabilidad en Hogar' },
        { id: 'g_urbano', label: 'Deficiencias en Infraestructura' },
        { id: 'g_socioeco', label: 'Sin Oportunidades' },
        { id: 'G_INDICE', label: 'Índice Global' }
    ];

    var equipWrapper = document.createElement("div");
    equipWrapper.id = "equip-wrapper";
    equipWrapper.style.display = "none";
    equipWrapper.style.marginTop = "15px";
    equipWrapper.style.paddingTop = "10px";
    equipWrapper.style.borderTop = "1px solid #444";

    selectEstado.onchange = function () {
        if (!this.value) return;
        var regionFile = this.value;
        var nombreEst = this.options[this.selectedIndex].text;
        
        var zmSel = document.getElementById("select-zm-muni");
        if(zmSel) zmSel.value = "";

        if (nombreEst === "Baja California") {
            equipWrapper.style.display = "block";
            if (equipWrapper.innerHTML === "") {
                // Inicializar controles de equipamiento
                var lbl = document.createElement("small");
                lbl.style.cssText = "color:#00e5ff; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; display:block;";
                lbl.innerText = "Equipamiento Tijuana";

                    var toggleEquip = document.createElement("select");
                    toggleEquip.className = "dynamic-filter-select";
                    toggleEquip.innerHTML = `
                        <option value="off" selected>Apagado</option>
                        <option value="on">Encender Equipamiento</option>
                    `;

                    var controlesAdicionales = document.createElement("div");
                    controlesAdicionales.style.display = "none";

                    if (!document.getElementById('delegacion-style')) {
                        var style = document.createElement('style');
                        style.id = 'delegacion-style';
                        style.innerHTML = '.delegacion-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; color: #aaa; font-size: 11px; font-weight: bold; text-shadow: 1px 1px 2px #000; text-align: center; pointer-events: none; }';
                        document.head.appendChild(style);
                    }
                    
                    if (!window.limiteDelegacionalLayer) {
                        fetch('carto/limite_delegacional_Tijuana.geojson')
                            .then(r => r.json())
                            .then(data => {
                                window.limiteDelegacionalLayer = L.geoJSON(data, {
                                    interactive: false,
                                    style: { color: '#000000', weight: 3, fillOpacity: 0.05, opacity: 0.5, dashArray: '5, 15' },
                                    onEachFeature: function(feature, layer) {
                                        var nom = feature.properties.Nombre || feature.properties.name || feature.properties.NOMGEO || "";
                                        if (nom) {
                                            layer.bindTooltip(nom, {
                                                permanent: true,
                                                direction: 'center',
                                                className: 'delegacion-tooltip'
                                            });
                                        }
                                    }
                                }).addTo(map);
                                window.limiteDelegacionalLayer.bringToFront();
                            });
                    } else {
                        window.limiteDelegacionalLayer.addTo(map);
                        window.limiteDelegacionalLayer.bringToFront();
                    }

                    toggleEquip.onchange = function () {
                        if (this.value === "on") {
                            controlesAdicionales.style.display = "block";
                            renderizarEquipamientoTijuana(controlesAdicionales);
                        } else {
                            controlesAdicionales.style.display = "none";
                            if (window.equipamientoLayer) { map.removeLayer(window.equipamientoLayer); window.equipamientoLayer = null; }
                            if (window.equipamientoBufferLayer) { map.removeLayer(window.equipamientoBufferLayer); window.equipamientoBufferLayer = null; }
                            
                            var legDiv = document.getElementById('legend-content');
                            if (legDiv) {
                                var eqLeg = document.getElementById('eq-legend-content');
                                if (eqLeg) eqLeg.remove();
                            }
                            var chartContainer = document.getElementById('equipamiento-chart-container');
                            if (chartContainer) chartContainer.style.display = 'none';
                        }
                    };

                    equipWrapper.appendChild(lbl);
                    equipWrapper.appendChild(toggleEquip);
                    equipWrapper.appendChild(controlesAdicionales);
                    
                    // Cartografía Participativa
                    var lblLev = document.createElement("small");
                    lblLev.style.cssText = "color:#ff9800; font-weight:bold; font-size:10px; text-transform:uppercase; margin-bottom:4px; margin-top:15px; display:block;";
                    lblLev.innerText = "Cartografía Participativa";

                    var toggleLev = document.createElement("select");
                    toggleLev.className = "dynamic-filter-select";
                    toggleLev.innerHTML = `
                        <option value="off" selected>Apagado</option>
                        <option value="on">Mostrar Levantamiento</option>
                    `;
                    
                    toggleLev.onchange = function() {
                        if (this.value === "on") {
                            fetch('carto/levantamiento.geojson')
                                .then(r => r.json())
                                .then(data => {
                                    if (window.levantamientoLayer) map.removeLayer(window.levantamientoLayer);
                                    window.levantamientoLayer = L.geoJSON(data, {
                                        pointToLayer: function(feature, latlng) {
                                            var situacion = feature.properties['Situación'] || '';
                                            var pColor = '#ff9800'; // default naranja
                                            if (situacion === 'Riesgo geológico y falta de servicios') pColor = '#e53935'; // rojo
                                            else if (situacion === 'Asentamiento irregular y falta de servicios') pColor = '#8e24aa'; // morado
                                            else if (situacion === 'Inseguridad') pColor = '#1e88e5'; // azul
                                            else if (situacion === 'Inseguridad y falta de servicios') pColor = '#3949ab'; // indigo
                                            else if (situacion === 'Sin transporte') pColor = '#fdd835'; // amarillo

                                            return L.circleMarker(latlng, {
                                                radius: 6,
                                                fillColor: pColor,
                                                color: '#fff',
                                                weight: 1,
                                                opacity: 1,
                                                fillOpacity: 0.8
                                            });
                                        },
                                        onEachFeature: function(feature, layer) {
                                            var content = `<div style="font-family:'Noto Sans'; font-size:12px; max-height: 200px; overflow-y: auto;">`;
                                            content += `<strong style="color:#ff9800; font-size:14px;">Levantamiento</strong><hr style="border:0; border-top:1px solid #555; margin:5px 0;">`;
                                            for(var key in feature.properties) {
                                                if(feature.properties[key]) {
                                                    content += `<b>${key}:</b> ${feature.properties[key]}<br>`;
                                                }
                                            }
                                            content += `</div>`;
                                            layer.bindPopup(content);
                                        }
                                    }).addTo(map);

                                    var legDiv = document.getElementById('legend-content');
                                    if (legDiv && !document.getElementById('lev-legend-content')) {
                                        var levLeg = document.createElement('div');
                                        levLeg.id = 'lev-legend-content';
                                        levLeg.style.marginTop = "15px";
                                        levLeg.style.paddingTop = "10px";
                                        levLeg.style.borderTop = "1px solid #444";
                                        levLeg.innerHTML = `
                                            <div style="font-size:13px; font-weight:bold; color:#ddd; margin-bottom:10px;">Cartografía Participativa</div>
                                            <div style="display:flex; align-items:center; margin-bottom:5px;"><div style="width:14px; height:14px; border-radius:50%; background:#e53935; border:1px solid #fff; margin-right:8px;"></div><span style="color:#ccc; font-size:12px;">Riesgo geológico y falta de servicios</span></div>
                                            <div style="display:flex; align-items:center; margin-bottom:5px;"><div style="width:14px; height:14px; border-radius:50%; background:#8e24aa; border:1px solid #fff; margin-right:8px;"></div><span style="color:#ccc; font-size:12px;">Asentamiento irregular y falta de servicios</span></div>
                                            <div style="display:flex; align-items:center; margin-bottom:5px;"><div style="width:14px; height:14px; border-radius:50%; background:#1e88e5; border:1px solid #fff; margin-right:8px;"></div><span style="color:#ccc; font-size:12px;">Inseguridad</span></div>
                                            <div style="display:flex; align-items:center; margin-bottom:5px;"><div style="width:14px; height:14px; border-radius:50%; background:#3949ab; border:1px solid #fff; margin-right:8px;"></div><span style="color:#ccc; font-size:12px;">Inseguridad y falta de servicios</span></div>
                                            <div style="display:flex; align-items:center; margin-bottom:5px;"><div style="width:14px; height:14px; border-radius:50%; background:#fdd835; border:1px solid #fff; margin-right:8px;"></div><span style="color:#ccc; font-size:12px;">Sin transporte</span></div>
                                            <div style="margin-top:10px; display:flex; align-items:center; justify-content:space-between;">
                                                <span style="font-size: 11px; color: #aaa;">Opacidad:</span>
                                                <input type="range" min="0" max="1" step="0.1" value="0.8" style="width: 50%; cursor: pointer;" 
                                                    oninput="if(window.levantamientoLayer) { window.levantamientoLayer.eachLayer(l => l.setStyle({fillOpacity: this.value, opacity: this.value})); }">
                                            </div>
                                        `;
                                        legDiv.appendChild(levLeg);
                                    }
                                });
                        } else {
                            if (window.levantamientoLayer) { map.removeLayer(window.levantamientoLayer); window.levantamientoLayer = null; }
                            var levLeg = document.getElementById('lev-legend-content');
                            if (levLeg) levLeg.remove();
                        }
                    };
                    
                    equipWrapper.appendChild(lblLev);
                    equipWrapper.appendChild(toggleLev);
                }
            } else {
                equipWrapper.style.display = "none";
                if (window.equipamientoLayer) { map.removeLayer(window.equipamientoLayer); window.equipamientoLayer = null; }
                if (window.equipamientoBufferLayer) { map.removeLayer(window.equipamientoBufferLayer); window.equipamientoBufferLayer = null; }
                if (window.levantamientoLayer) { map.removeLayer(window.levantamientoLayer); window.levantamientoLayer = null; }
                if (window.limiteDelegacionalLayer) { map.removeLayer(window.limiteDelegacionalLayer); window.limiteDelegacionalLayer = null; }
                var eqLeg = document.getElementById('eq-legend-content');
                if (eqLeg) eqLeg.remove();
                var levLeg = document.getElementById('lev-legend-content');
                if (levLeg) levLeg.remove();
                
                // Reset select dropdowns visually if user comes back
                var selects = equipWrapper.getElementsByTagName('select');
                for(var i=0; i<selects.length; i++){
                    selects[i].value = "off";
                }
                var chartContainer = document.getElementById('equipamiento-chart-container');
                if (chartContainer) chartContainer.style.display = 'none';
                if (typeof munWrapper !== 'undefined' && munWrapper) munWrapper.style.display = "block";
            }

            if (nombreEst === "Baja California") {
                insigniaBadge.style.display = "block";
            } else {
                insigniaBadge.style.display = "none";
            }

            var regionKey = this.value;
            var archivoGeojson = REGIONES_AGEB[regionKey] || 'carto/agebmex.geojson';
            document.getElementById('filter-title').innerText = "Cargando " + nombreEst + "...";
            cargarAgebEstadoRegional(nombreEst, archivoGeojson, selectIndice, opcionesAgeb);
    };

    selectIndice.onchange = function () {
        if (this.value) {
            var labelNombre = this.options[this.selectedIndex].text;
            renderizarMapaAgeb(this.value, labelNombre, selectEstado.options[selectEstado.selectedIndex].text);
            if (window.equipamientoLayer) window.equipamientoLayer.bringToFront();
        }
    };

    container.appendChild(selectZm);
    container.appendChild(selectEstado);
    container.appendChild(selectIndice);

    var opacityControl = document.createElement('div');
    opacityControl.style.cssText = "margin-top: 10px; width: 100%; display: flex; align-items: center; justify-content: space-between;";
    opacityControl.innerHTML = `
        <span style="font-size: 11px; color: #aaa;">Opacidad Base:</span>
        <input type="range" id="ageb-opacity" min="0" max="1" step="0.1" value="0.85" style="width: 60%; cursor: pointer;" 
            oninput="if(window.agebLayer) { window.agebLayer.eachLayer(l => { if(l.options.interactive) l.setStyle({fillOpacity: this.value}); }); }">
    `;
    container.appendChild(opacityControl);

    container.appendChild(equipWrapper);



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
        if (map._events && map._events['pm:create']) {
            delete map._events['pm:create'];
        }

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

    var necesitaDescargaGeojson = !currentRegionCache || currentRegionCache.filename !== archivoGeojson;

    if (necesitaDescargaGeojson) {
        if (nombreEstado === "ZM Valle de México") {
            promises.push(
                Promise.all([
                    fetch(archivoGeojson).then(r => r.json()),
                    fetch('carto/CDMX.geojson').then(r => r.json())
                ]).then(results => {
                    var mergedFeatures = results[0].features.concat(results[1].features);
                    return { type: "FeatureCollection", features: mergedFeatures };
                })
            );
        } else {
            promises.push(fetch(archivoGeojson).then(r => r.json()));
        }
    } else {
        promises.push(Promise.resolve(currentRegionCache.data));
    }

    // Armadoras siempre lo cargamos o lo abstraemos también
    promises.push(fetch('carto/armadoras.geojson').then(r => r.json()));

    // Cargar Limite_municipal.geojson sincrónicamente para los gráficos
    promises.push(
        window.municipiosPolygonsGeoJSON ? Promise.resolve(window.municipiosPolygonsGeoJSON) :
            Promise.all([
                fetch('carto/Limite_municipal_opt.geojson').then(r => r.json()),
                fetch('carto/Limite_municipal_CDMX.geojson').then(r => r.json()).catch(e => ({ type: "FeatureCollection", features: [] }))
            ]).then(([geoOpt, geoCdmx]) => {
                geoOpt.features = geoOpt.features.concat(geoCdmx.features);
                window.municipiosPolygonsGeoJSON = geoOpt;
                return geoOpt;
            }).catch(e => null)
    );

    Promise.all(promises)
        .then(([agebDataRegional, armadorasData]) => {
            document.getElementById('filter-title').innerText = "Vulnerabilidad";

            // Guardamos en caché
            if (necesitaDescargaGeojson) {
                currentRegionCache = { filename: archivoGeojson, data: agebDataRegional };
            }

            // Filtramos de forma INTELIGENTE para quedarnos solo con el Estado que eligió el usuario
            var estadoBusqueda = (typeof normalizarTexto !== 'undefined') ? normalizarTexto(nombreEstado) : nombreEstado.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            var cveEntBusqueda = CVE_ENT_ESTADOS[nombreEstado];

            // Filtramos para aislar los AGEB de ESTE ESTADO o ZM especifico y no pintar toda la región
            var featuresFiltradas = agebDataRegional.features.filter(f => {
                if (archivoGeojson === 'carto/CDMX.geojson') return true; // CDMX.geojson ya viene filtrado

                var cveNum = f.properties.CVE_ENT || (f.properties.CVEGEO ? f.properties.CVEGEO.substring(0, 2) : null);
                var cveMun = f.properties.CVEGEO ? f.properties.CVEGEO.substring(0, 5) : null;

                if (CATALOGO_ZONAS_METROPOLITANAS[nombreEstado]) {
                    var catalogList = CATALOGO_ZONAS_METROPOLITANAS[nombreEstado];
                    if (cveNum && catalogList.includes(cveNum)) return true;
                    if (cveMun && catalogList.includes(cveMun)) return true;
                    
                    // Fallback para nombres
                    var propEstado = f.properties.NOM_ENT || f.properties.ENTIDAD || f.properties.NOMGEO || "Desconocido";
                    var normalizado = (typeof normalizarTexto !== 'undefined') ? normalizarTexto(propEstado) : propEstado.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                    if (nombreEstado === "ZM Valle de México") {
                        return normalizado.includes("MEXICO") || normalizado.includes("CIUDAD DE MEXICO");
                    }
                    return false;
                }

                if (cveNum && cveEntBusqueda && cveNum === cveEntBusqueda) return true;

                // Respaldo (Failsafe): Búsqueda tradicional por su nombre de tabla de atributos
                var propEstado = f.properties.NOM_ENT || f.properties.ENTIDAD || f.properties.NOMGEO || "Desconocido";
                var normalizado = (typeof normalizarTexto !== 'undefined') ? normalizarTexto(propEstado) : propEstado.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                return normalizado === estadoBusqueda || propEstado.includes(estadoBusqueda);
            });

            // Si por alguna razón los GeoJSON agrupados ya NO pueden dividirse, enviamos toda la región
            if (featuresFiltradas.length === 0 && estadoBusqueda !== "CIUDAD DE MEXICO" && !CATALOGO_ZONAS_METROPOLITANAS[nombreEstado]) {
                // Sólo hacemos fallback si NO es CDMX para evitar pintar Puebla accidentalmente.
                featuresFiltradas = agebDataRegional.features;
            }

            // Simular un nuevo feature collection base para agebRawData
            agebRawData = { type: "FeatureCollection", features: featuresFiltradas };

            armadorasRawData = armadorasData;

            var armadorasFiltradas = armadorasRawData.features.filter(f => {
                var estadoArmadora = (typeof normalizarTexto !== 'undefined') ? normalizarTexto(f.properties.Estado || f.properties.ESTADO || f.properties.NOMGEO) : (f.properties.Estado || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                if (cveEntBusqueda === "ZMVM") return estadoArmadora.includes("MEXICO") || estadoArmadora.includes("CIUDAD DE MEXICO");
                if (estadoBusqueda === "BAJA CALIFORNIA" && estadoArmadora.includes("SUR")) return false;
                return estadoArmadora === estadoBusqueda || estadoArmadora.includes(estadoBusqueda) || estadoBusqueda.includes(estadoArmadora);
            });

            if (typeof dibujarArmadorasPuntos === "function") dibujarArmadorasPuntos(armadorasFiltradas);

            if (agebRawData.features.length > 0) {
                var bounds = L.geoJSON(agebRawData).getBounds();
                if (bounds.isValid()) {
                    var zoomProfundo = map.getBoundsZoom(bounds) + 1;
                    map.flyTo(bounds.getCenter(), zoomProfundo, { duration: 1.5 });
                }
            } else {
                console.warn("No se encontraron AGEBs para el filtro seleccionado.");
            }

            if (typeof window.actualizarModulosDatosDuros === 'function') {
                window.actualizarModulosDatosDuros(featuresFiltradas);
            }

            selectIndice.innerHTML = `<option value="" disabled>-- Índice --</option>`;
            opcionesAgeb.forEach((opc, idx) => {
                var sel = idx === 3 ? "selected" : "";
                selectIndice.innerHTML += `<option value="${opc.id}" ${sel}>${opc.label}</option>`;
            });
            selectIndice.style.display = 'block';

            renderizarMapaAgeb('G_INDICE', 'Índice Global', nombreEstado);


            if (typeof window.dibujarLimiteMunicipal === 'function') {
                window.dibujarLimiteMunicipal(nombreEstado);
            }
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
                color: "transparent",
                weight: 0,
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
                mouseover: function (e) { 
                    e.target.setStyle({ weight: 2, color: '#fff' }); 
                    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                        e.target.bringToFront();
                    }
                    if (window.limiteDelegacionalLayer) window.limiteDelegacionalLayer.bringToFront();
                    if (armadorasLayer) armadorasLayer.bringToFront();
                },
                mouseout: function (e) { 
                    agebLayer.resetStyle(e.target); 
                    if (window.limiteDelegacionalLayer) window.limiteDelegacionalLayer.bringToFront();
                    if (armadorasLayer) armadorasLayer.bringToFront();
                }
            });
        }
    }).addTo(map);

    agebLayer.bringToBack();
    if (window.limiteDelegacionalLayer) window.limiteDelegacionalLayer.bringToFront();
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

    var ianBox = document.getElementById('ian-dashboard-box');
    if (ianBox) {
        if (nombreEstado === "Baja California" || nombreEstado === "Baja_California") {
            ianBox.style.display = 'block';
        } else {
            ianBox.style.display = 'none';
        }
    }

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
        // CDMX.geojson lacks DISC1, EDU46, ECO4, fallback to POB24, POB42, POB84 based on data mapping
        totalDisc += parseFloat(p.DISC1) || parseFloat(p.POB24) || 0;
        totalEdu += parseFloat(p.EDU46) || parseFloat(p.POB42) || 0;
        totalEco += parseFloat(p.ECO4) || parseFloat(p.POB84) || 0;
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
                            if (totalPob > 0 && value > 0) {
                                return value.toLocaleString('en-US') + ' (' + ((value / totalPob) * 100).toFixed(1) + '%)';
                            }
                            return value > 0 ? value.toLocaleString('en-US') : '';
                        }
                    }
                },
                scales: {
                    x: { display: false, max: totalPob },
                    y: { ticks: { color: '#ccc', font: { size: 11 } }, grid: { display: false }, border: { display: false } }
                },
                layout: {
                    padding: { right: 80 }
                }
            }
        });
    }

    // Chart 3: Resumen por Municipio (Población, AGEBs, Vulnerabilidad Promedio)
    var canvasMunRes = document.getElementById('munResumenChart');
    if (canvasMunRes) {
        var ctxMunRes = canvasMunRes.getContext('2d');
        if (window.munResumenChartInstance) window.munResumenChartInstance.destroy();

        var munData = {};
        var cveToName = {};
        if (window.municipiosPolygonsGeoJSON && window.municipiosPolygonsGeoJSON.features) {
            window.municipiosPolygonsGeoJSON.features.forEach(f => {
                if (f.properties.cve_umun && f.properties.nom_mun) {
                    cveToName[f.properties.cve_umun] = f.properties.nom_mun;
                }
            });
        }

        agebRawData.features.forEach(f => {
            var p = f.properties;
            var cvegeo = p.CVEGEO || "";
            var cve_umun = cvegeo.substring(0, 5);

            if (cve_umun.length === 5) {
                if (!munData[cve_umun]) {
                    munData[cve_umun] = {
                        name: cveToName[cve_umun] || ("Mun " + cve_umun),
                        agebs: 0,
                        pob: 0,
                        vulnSum: 0,
                        vulnValidos: 0
                    };
                }

                munData[cve_umun].agebs++;
                munData[cve_umun].pob += parseFloat(p.POB1_x) || 0;

                var valCat = p[atributo] || "Sin dato";
                var vStr = valCat.toString().trim().toUpperCase();
                var numVul = 0;
                if (vStr === 'MUY ALTO') numVul = 5;
                else if (vStr === 'ALTO') numVul = 4;
                else if (vStr === 'MEDIO') numVul = 3;
                else if (vStr === 'BAJO') numVul = 2;
                else if (vStr === 'MUY BAJO') numVul = 1;

                if (numVul > 0) {
                    munData[cve_umun].vulnSum += numVul;
                    munData[cve_umun].vulnValidos++;
                }
            }
        });

        var sortedMuns = Object.values(munData).sort((a, b) => b.pob - a.pob);
        if (sortedMuns.length > 15) sortedMuns = sortedMuns.slice(0, 15);

        var labelsMun = sortedMuns.map(m => m.name);
        var dataAgebsMun = sortedMuns.map(m => m.agebs);
        var dataVulnMun = sortedMuns.map(m => m.vulnValidos > 0 ? parseFloat((m.vulnSum / m.vulnValidos).toFixed(1)) : 0);

        window.munResumenChartInstance = new Chart(ctxMunRes, {
            type: 'bar',
            data: {
                labels: labelsMun,
                datasets: [
                    {
                        label: 'AGEBs Analizados',
                        data: dataAgebsMun,
                        backgroundColor: '#0277bd',
                        yAxisID: 'y'
                    },
                    {
                        label: 'Vuln. Promedio',
                        data: dataVulnMun,
                        backgroundColor: '#d59f0f',
                        yAxisID: 'y1'
                    }
                ]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#ddd', font: { size: 10 } }, position: 'bottom' },
                    datalabels: {
                        color: '#fff', font: { size: 9 },
                        formatter: function (val, ctx) { return val > 0 ? val : ""; },
                        anchor: 'end',
                        align: 'end'
                    }
                },
                scales: {
                    x: { ticks: { color: '#ccc', font: { size: 9 } }, grid: { display: false } },
                    y: {
                        type: 'linear', display: true, position: 'left',
                        ticks: { color: '#ccc', font: { size: 10 } }, grid: { color: '#333' },
                        title: { display: true, text: 'Total AGEBs', color: '#0277bd' }
                    },
                    y1: {
                        type: 'linear', display: true, position: 'right',
                        ticks: { color: '#ccc', font: { size: 10 } },
                        title: { display: true, text: 'Vuln. (1-5)', color: '#d59f0f' },
                        grid: { drawOnChartArea: false },
                        min: 0, max: 5
                    }
                }
            }
        });

        var sumMun = document.getElementById('sintesis-mun-res');
        if (sumMun) {
            sumMun.style.display = 'block';
            sumMun.innerHTML = `Muestra los principales municipios. Las barras azules indican la cantidad de AGEBs, y las amarillas el nivel de vulnerabilidad promedio (1-5).`;
        }
    }

    // Chart 4: Delegacional Vulnerabilidad Cruzada
    var hrDelRes = document.getElementById('hr-del-res');
    var tituloDelRes = document.getElementById('titulo-del-res');
    var delResContainer = document.getElementById('delResumenChartContainer');
    var canvasDelRes = document.getElementById('delResumenChart');
    var sintesisDelRes = document.getElementById('sintesis-del-res');
    
    if (hrDelRes) hrDelRes.style.display = 'none';
    if (tituloDelRes) tituloDelRes.style.display = 'none';
    if (delResContainer) delResContainer.style.display = 'none';
    if (sintesisDelRes) sintesisDelRes.style.display = 'none';

    // Verify if limiteDelegacionalLayer exists and we are in Tijuana
    if (window.limiteDelegacionalLayer && typeof turf !== 'undefined' && nombreEstado === 'Baja California') {
        if (hrDelRes) hrDelRes.style.display = 'block';
        if (tituloDelRes) tituloDelRes.style.display = 'block';
        if (delResContainer) delResContainer.style.display = 'block';

        if (canvasDelRes) {
            var ctxDel = canvasDelRes.getContext('2d');
            if (window.delResumenChartInstance) window.delResumenChartInstance.destroy();

            var delData = {};
            
            // Loop through delegaciones
            window.limiteDelegacionalLayer.eachLayer(function(delLayer) {
                var delNom = delLayer.feature.properties.Nombre || delLayer.feature.properties.name || delLayer.feature.properties.NOMGEO || "Desconocida";
                delData[delNom] = { agebs: 0, pob: 0, vulnSum: 0, vulnValidos: 0, poly: delLayer.feature };
            });

            // Associate each AGEB with a delegation using Turf.js
            agebRawData.features.forEach(f => {
                try {
                    var centroid = turf.centroid(f);
                    var assignedDel = null;
                    for (var delNom in delData) {
                        if (turf.booleanPointInPolygon(centroid, delData[delNom].poly)) {
                            assignedDel = delNom;
                            break;
                        }
                    }
                    if (assignedDel) {
                        var p = f.properties;
                        delData[assignedDel].agebs++;
                        delData[assignedDel].pob += parseFloat(p.POB1_x) || 0;
                        
                        var valCat = p[atributo] || "Sin dato";
                        var vStr = valCat.toString().trim().toUpperCase();
                        var numVul = 0;
                        if (vStr === 'MUY ALTO') numVul = 5;
                        else if (vStr === 'ALTO') numVul = 4;
                        else if (vStr === 'MEDIO') numVul = 3;
                        else if (vStr === 'BAJO') numVul = 2;
                        else if (vStr === 'MUY BAJO') numVul = 1;

                        if (numVul > 0) {
                            delData[assignedDel].vulnSum += numVul;
                            delData[assignedDel].vulnValidos++;
                        }
                    }
                } catch(e) { } // Ignore geometries that turf can't process
            });

            var sortedDels = Object.keys(delData).map(k => { return { name: k, agebs: delData[k].agebs, pob: delData[k].pob, vulnSum: delData[k].vulnSum, vulnValidos: delData[k].vulnValidos }; }).filter(d => d.agebs > 0).sort((a, b) => b.pob - a.pob);

            var labelsDel = sortedDels.map(d => d.name);
            var dataAgebsDel = sortedDels.map(d => d.agebs);
            var dataPobDel = sortedDels.map(d => d.pob);
            var dataVulnDel = sortedDels.map(d => d.vulnValidos > 0 ? parseFloat((d.vulnSum / d.vulnValidos).toFixed(1)) : 0);

            window.delResumenChartInstance = new Chart(ctxDel, {
                type: 'bar',
                data: {
                    labels: labelsDel,
                    datasets: [
                        {
                            label: 'Población Total',
                            data: dataPobDel,
                            backgroundColor: '#0277bd',
                            yAxisID: 'y'
                        },
                        {
                            label: 'Vuln. Promedio',
                            data: dataVulnDel,
                            backgroundColor: '#e53935',
                            yAxisID: 'y1'
                        }
                    ]
                },
                plugins: [ChartDataLabels],
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#ddd', font: { size: 10 } }, position: 'bottom' },
                        datalabels: {
                            display: false
                        }
                    },
                    scales: {
                        x: { ticks: { color: '#ccc', font: { size: 9 } }, grid: { display: false } },
                        y: {
                            type: 'linear', display: true, position: 'left',
                            ticks: { color: '#ccc', font: { size: 10 } }, grid: { color: '#333' },
                            title: { display: true, text: 'Población', color: '#0277bd' }
                        },
                        y1: {
                            type: 'linear', display: true, position: 'right',
                            ticks: { color: '#ccc', font: { size: 10 } },
                            title: { display: true, text: 'Vuln. (1-5)', color: '#e53935' },
                            grid: { drawOnChartArea: false },
                            min: 0, max: 5
                        }
                    }
                }
            });

            if (sintesisDelRes && sortedDels.length > 0) {
                sintesisDelRes.style.display = 'block';
                var delMax = sortedDels[0];
                sintesisDelRes.innerHTML = `La delegación <b>${delMax.name}</b> concentra la mayor población analizada con <b>${delMax.pob.toLocaleString('en-US')}</b> habitantes distribuidos en <b>${delMax.agebs}</b> AGEBs, presentando un nivel de vulnerabilidad promedio de <b>${(delMax.vulnValidos > 0 ? (delMax.vulnSum/delMax.vulnValidos).toFixed(1) : "N/A")}</b>.`;
            }
        }
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
        imageName = 'assets/Vuln_hogar.png';
    } else if (tituloLimpio === 'Deficiencias en Infraestructura' || tituloLimpio === 'Deficiencia de infraestructura') {
        imageName = 'assets/Vuln_Urbana.png';
    } else if (tituloLimpio === 'Sin Oportunidades' || tituloLimpio === 'Sin oportunidades') {
        imageName = 'assets/Vuln_oportunidades.png';
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

    var totalAgebs = cMB + cB + cM + cA + cMA + (conteo['Sin dato'] || 0);

    var html = `
        <div style="display:flex; align-items:center; margin-bottom:4px; font-weight:bold; color:#ddd; font-size:14px;">
            ${titulo} ${infoButtonHtml}
        </div>
        <div style="font-size: 12px; color: #aaa; margin-bottom: 12px; font-weight: normal;">
            Total de AGEBs: <b>${totalAgebs}</b>
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

    if (imageName === 'assets/Vuln_hogar.png') {
        textResumen = "La Físico-Espacial igual a “Vulnerabilidad en Hogar” refleja las condiciones materiales y de ocupación del territorio. Se construyó a partir de variables como: nuevas áreas de crecimiento urbano, la pavimentación, el alumbrado público, la densidad de vivienda, las viviendas deshabitadas y el hacinamiento. Los resultados de esta vulnerabilidad evidencian procesos de dispersión y vaciamiento urbano que afectan la eficiencia territorial. También mayores riesgos, asociados a carencias en infraestructura doméstica, inseguridad y pérdida de cohesión social.<br><br><b>" + conclusion + "</b>";
    } else if (imageName === 'assets/Vuln_Urbana.png') {
        textResumen = "La Urbana igual a “Deficiencia en Infraestructura” se compone en tres variables ponderadas: Vivienda sin drenaje, asociadas a riesgos sanitarios y contaminación ambiental, vivienda sin agua entubada, refleja la desigualdad en el acceso al recurso más esencial para la salud pública y el bienestar doméstico y vivienda sin electricidad que representa la carencia más crítica, limita la integración productiva, educativa y social de los hogares.<br><br><b>" + conclusion + "</b>";
    } else if (imageName === 'assets/Vuln_oportunidades.png') {
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
                layer.setStyle({ opacity: 0, fillOpacity: 0, weight: 0, color: 'transparent' });
                layer.options.interactive = false;
            } else {
                // Feature Visible Default
                layer.setStyle({
                    color: "transparent", weight: 0, opacity: 1,
                    fillColor: getColorVulnerabilidad(valCat), fillOpacity: 0.85
                });
                layer.options.interactive = true;
            }
        });
    }

    if (window.limiteDelegacionalLayer) window.limiteDelegacionalLayer.bringToFront();
    if (armadorasLayer) armadorasLayer.bringToFront();

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

// ==========================================
// NUEVO MÓDULO: EQUIPAMIENTO TIJUANA
// ==========================================
window.equipamientoLayer = null;
window.equipamientoBufferLayer = null;
window.chartEquipamientoInstance = null;

function renderizarEquipamientoTijuana(wrapper) {
    if (window.equipamientoDataCache) {
        configurarUIEquipamiento(wrapper, window.equipamientoDataCache);
        return;
    }

    fetch('carto/Equipamiento_Tijuana.geojson')
        .then(r => r.json())
        .then(data => {
            window.equipamientoDataCache = data;
            configurarUIEquipamiento(wrapper, data);
        })
        .catch(e => {
            console.error("Error cargando Equipamiento:", e);
            document.getElementById('filter-title').innerText = "Error cargando archivo";
        });
}

function configurarUIEquipamiento(wrapper, data) {
    wrapper.innerHTML = "";

    var tipos = [...new Set(data.features.map(f => f.properties.Tipo || "Otro"))].sort();

    // Cultural - Amarrillo, Deportivo - Verde, Educativo - Azul y Salud - Rosa
    window.tipoEquipColorMap = {
        'Cultural': '#ffcc00', // Amarillo
        'Deportivo': '#2ca02c', // Verde
        'Educativo': '#1f77b4', // Azul
        'Salud': '#ff69b4'      // Rosa
    };

    var selectTipo = document.createElement("select");
    selectTipo.className = "dynamic-filter-select";
    selectTipo.innerHTML = `<option value="TODOS">Todos los Tipos</option>`;
    tipos.forEach(t => {
        selectTipo.innerHTML += `<option value="${t}">${t}</option>`;
    });

    selectTipo.onchange = function () {
        pintarEquipamientoEnMapa(data, this.value);
    };

    wrapper.appendChild(selectTipo);

    // Render inicial
    pintarEquipamientoEnMapa(data, "TODOS");
    generarGraficaEquipamiento(data);
}

function pintarEquipamientoEnMapa(data, tipoFiltro) {
    if (window.equipamientoLayer) { map.removeLayer(window.equipamientoLayer); window.equipamientoLayer = null; }
    if (window.equipamientoBufferLayer) { map.removeLayer(window.equipamientoBufferLayer); window.equipamientoBufferLayer = null; }

    var features = tipoFiltro === "TODOS" ? data.features : data.features.filter(f => f.properties.Tipo === tipoFiltro);
    if (features.length === 0) return;

    // Crear layer de puntos
    window.equipamientoLayer = L.geoJSON({ type: "FeatureCollection", features: features }, {
        pointToLayer: function (feature, latlng) {
            var t = feature.properties.Tipo || "Otro";
            var color = window.tipoEquipColorMap[t] || '#999';
            return L.circleMarker(latlng, {
                radius: 6,
                fillColor: color,
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.9
            });
        },
        onEachFeature: function (feature, layer) {
            var props = feature.properties;
            var tooltipHtml = `
                <div style="font-family:'Noto Sans'; font-size:12px; min-width: 150px;">
                    <div style="font-weight:bold; color:#00e5ff; margin-bottom:5px;">${props.Nombre || "Sin nombre"}</div>
                    <table style="width:100%; color:#fff; font-size:11px;">
                        <tr><td style="color:#aaa; padding-right:10px;">Tipo:</td><td><strong>${props.Tipo || "N/A"}</strong></td></tr>
                        <tr><td style="color:#aaa; padding-right:10px;">Clasificac:</td><td>${props.Clasificac || "N/A"}</td></tr>
                        <tr><td style="color:#aaa; padding-right:10px;">Dependen:</td><td>${props.Dependen || "N/A"}</td></tr>
                    </table>
                </div>
            `;
            layer.bindTooltip(tooltipHtml, { sticky: true, className: 'custom-tooltip' });
        }
    }).addTo(map);

    // Generar Buffer de impacto usando Turf si un tipo especifico es seleccionado
    if (tipoFiltro !== "TODOS" && typeof turf !== 'undefined') {
        try {
            var color = window.tipoEquipColorMap[tipoFiltro] || '#fff';
            // Buffer de 1.5 kilometros
            var bufferGeom = turf.buffer({ type: "FeatureCollection", features: features }, 1.5, { units: 'kilometers' });
            window.equipamientoBufferLayer = L.geoJSON(bufferGeom, {
                style: {
                    color: color,
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.2,
                    dashArray: '5, 5'
                }
            }).addTo(map);
            // Colocar los puntos arriba de los buffers
            window.equipamientoLayer.bringToFront();
        } catch (e) {
            console.warn("Turf.js buffer error:", e);
        }
    }

    // Sobreponer a capa AGEB
    if (agebLayer) {
        if (window.equipamientoBufferLayer) window.equipamientoBufferLayer.bringToFront();
        if (window.equipamientoLayer) window.equipamientoLayer.bringToFront();
    }

    // Actualizar leyenda adicional de equipamiento
    var equipLegend = document.getElementById('equip-legend-content');
    if (!equipLegend) {
        equipLegend = document.createElement('div');
        equipLegend.id = 'equip-legend-content';
        equipLegend.style.marginTop = "15px";
        equipLegend.style.paddingTop = "10px";
        equipLegend.style.borderTop = "1px solid #444";
        var div = document.getElementById('legend-content');
        if (div) div.appendChild(equipLegend);
    }

    if (equipLegend) {
        equipLegend.innerHTML = `<div style="font-size:13px; font-weight:bold; color:#ddd; margin-bottom:10px;">Equipamiento (${tipoFiltro})</div>`;
        if (tipoFiltro !== "TODOS") {
            equipLegend.innerHTML += `
                <div style="display:flex; align-items:center; margin-bottom:5px;">
                    <div style="width:14px; height:14px; border-radius:50%; background:${window.tipoEquipColorMap[tipoFiltro]}; border:1px solid #fff; margin-right:8px;"></div>
                    <span style="color:#ccc; font-size:12px;">Puntos (${features.length})</span>
                </div>
                <div style="display:flex; align-items:center;">
                    <div style="width:14px; height:14px; background:${window.tipoEquipColorMap[tipoFiltro]}44; border:2px dashed ${window.tipoEquipColorMap[tipoFiltro]}; margin-right:8px;"></div>
                    <span style="color:#ccc; font-size:12px;">Área de Impacto (1.5 km)</span>
                </div>
                <div style="margin-top:10px; display:flex; align-items:center; justify-content:space-between;">
                    <span style="font-size: 11px; color: #aaa;">Opacidad Puntos:</span>
                    <input type="range" min="0" max="1" step="0.1" value="0.9" style="width: 50%; cursor: pointer;" 
                        oninput="if(window.equipamientoLayer) { window.equipamientoLayer.eachLayer(l => l.setStyle({fillOpacity: this.value, opacity: this.value})); }">
                </div>
                <div style="margin-top:5px; display:flex; align-items:center; justify-content:space-between;">
                    <span style="font-size: 11px; color: #aaa;">Opacidad Área:</span>
                    <input type="range" min="0" max="1" step="0.1" value="0.2" style="width: 50%; cursor: pointer;" 
                        oninput="if(window.equipamientoBufferLayer) { window.equipamientoBufferLayer.eachLayer(l => l.setStyle({fillOpacity: this.value, opacity: this.value})); }">
                </div>
            `;
        } else {
            Object.keys(window.tipoEquipColorMap).forEach(t => {
                var c = window.tipoEquipColorMap[t];
                var n = features.filter(f => f.properties.Tipo === t).length;
                equipLegend.innerHTML += `
                    <div style="display:flex; align-items:center; margin-bottom:5px;">
                        <div style="width:14px; height:14px; border-radius:50%; background:${c}; border:1px solid #fff; margin-right:8px;"></div>
                        <span style="color:#ccc; font-size:12px;">${t} (${n})</span>
                    </div>
                `;
            });
            equipLegend.innerHTML += `
                <div style="margin-top:10px; display:flex; align-items:center; justify-content:space-between;">
                    <span style="font-size: 11px; color: #aaa;">Opacidad Puntos:</span>
                    <input type="range" min="0" max="1" step="0.1" value="0.9" style="width: 50%; cursor: pointer;" 
                        oninput="if(window.equipamientoLayer) { window.equipamientoLayer.eachLayer(l => l.setStyle({fillOpacity: this.value, opacity: this.value})); }">
                </div>
            `;
        }
    }
}

function generarGraficaEquipamiento(data) {
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var chartContainer = document.getElementById('equipamiento-chart-container');
    if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.id = 'equipamiento-chart-container';
        chartContainer.style.marginTop = "20px";
        chartContainer.style.paddingTop = "10px";
        chartContainer.style.borderTop = "1px solid #333";
        var parentDiv = document.getElementById('municipal-charts-container');
        if (parentDiv) parentDiv.appendChild(chartContainer);
    }
    chartContainer.style.display = 'block';

    chartContainer.innerHTML = `
        <h4 style="color:#fff; font-size:12px; margin-bottom:10px; text-transform: uppercase;">Inventario por Tipo de Equipamiento</h4>
        <div style="height:220px; position:relative; width: 100%;">
            <canvas id="equipChart"></canvas>
        </div>
    `;

    var conteos = {};
    data.features.forEach(f => {
        var t = f.properties.Tipo || "Otro";
        conteos[t] = (conteos[t] || 0) + 1;
    });

    var labels = Object.keys(conteos).sort((a, b) => conteos[b] - conteos[a]);
    var vals = labels.map(l => conteos[l]);
    var bgColors = labels.map(l => window.tipoEquipColorMap[l] || '#999');

    var ctx = document.getElementById('equipChart');
    if (!ctx) return;
    ctx = ctx.getContext('2d');

    if (window.chartEquipamientoInstance) window.chartEquipamientoInstance.destroy();

    window.chartEquipamientoInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: vals,
                backgroundColor: bgColors,
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: '#fff',
                    anchor: 'end',
                    align: 'right',
                    font: { size: 10, weight: 'bold' },
                    formatter: function (val) { return val; }
                }
            },
            scales: {
                x: { ticks: { color: '#ccc' }, grid: { color: '#333' }, suggestedMax: Math.max(...vals) * 1.2 },
                y: { ticks: { color: '#ccc', font: { size: 11 } }, grid: { display: false } }
            }
        },
        plugins: [ChartDataLabels]
    });
}

