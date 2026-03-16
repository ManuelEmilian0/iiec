// ==========================================
// 1. VARIABLES GLOBALES Y CONFIGURACIÓN
// ==========================================
var map;
var currentGeoJSONLayer = null; 
var armadorasLayer = null;      
var isocronasLayer = null;      
var agebLayer = null;           
var activeData = null;          

var denueRawData = null;        
var armadorasRawData = null;
var isocronasRawData = null;
var agebRawData = null;         

var currentScaleType = '';      
var mainChart = null;           
var fuenteControl = null;       // <--- NUEVO: Control de Fuente

const RampaRojos = ['#fee5d9','#fcae91','#fb6a4a','#de2d26','#a50f15'];
const Grosores = [1, 2, 4, 6, 8];

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initMap();
});

function initMap() {
    // Evitar error de recarga rápida
    if (map !== undefined && map !== null) {
        map.remove(); 
    }

    // 1. Arranque en Escala Mundial
    map = L.map('map', {
        minZoom: 2, maxZoom: 18, zoomControl: false
    }).setView([20, 0], 2);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    var cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    });

    var satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &mdash; Source: Esri',
        maxZoom: 19
    });

    cartoDark.addTo(map);

    var mapasBase = {
        "Mapa Oscuro (Carto)": cartoDark,
        "Satélite (Esri)": satelite
    };

    L.control.layers(mapasBase, null, { position: 'topright' }).addTo(map);

    // --- NUEVO: CONTROL DE FUENTE EN ESQUINA INFERIOR IZQUIERDA ---
    fuenteControl = L.control({ position: 'bottomleft' });
    fuenteControl.onAdd = function (map) {
        this._div = L.DomUtil.create('div', 'fuente-control');
        this.update('');
        return this._div;
    };
    fuenteControl.update = function (texto) {
        if (texto) {
            this._div.innerHTML = `Fuente: ${texto}`;
            this._div.style.display = 'block';
        } else {
            this._div.style.display = 'none';
        }
    };
    fuenteControl.addTo(map);

    setupUI();
    cargarArmadorasContexto();
    showSection('inicio');
    
    // Carga mundial automáticamente después de medio segundo
    setTimeout(() => {
        loadLayer('mundial');
    }, 500);
}

function cargarArmadorasContexto() {
    fetch('armadoras.geojson')
        .then(r => r.json())
        .then(data => {
            L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 2, fillColor: "#fff", color: "#fff", weight: 0, opacity: 0.3, fillOpacity: 0.3
                    });
                }
            }).addTo(map);
        })
        .catch(e => console.log("Fondo armadoras no encontrado."));
}

// ==========================================
// 3. CONTROLADOR DE CAPAS (LOAD LAYER)
// ==========================================
function loadLayer(scaleType) {
    document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
    var activeBtn = document.getElementById('btn-' + scaleType);
    if(activeBtn) activeBtn.classList.add('active');

    if (currentGeoJSONLayer) { map.removeLayer(currentGeoJSONLayer); currentGeoJSONLayer = null; }
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
    if (isocronasLayer) { map.removeLayer(isocronasLayer); isocronasLayer = null; }
    if (agebLayer) { map.removeLayer(agebLayer); agebLayer = null; }
    
    var statsDiv = document.getElementById('stats-overlay');
    if(statsDiv) statsDiv.style.display = 'none';

    var legendDiv = document.getElementById('legend-overlay');
    if(legendDiv) legendDiv.style.display = 'none';

    var summaryDiv = document.getElementById('dynamic-summary');
    if (summaryDiv) summaryDiv.style.display = 'none';

    currentScaleType = scaleType;
    
    // --- ACTUALIZAR FUENTE SEGÚN ESCALA ---
    var textoFuente = "";
    if (scaleType === 'mundial') textoFuente = "Organización para la Cooperación y el Desarrollo Económicos (OCDE) 2026";
    else if (scaleType === 'nacional') textoFuente = "Cuadros de Oferta y Utilización (COU) y Matrices Insumo-Producto (MIP), INEGI 2020";
    else if (scaleType === 'estatal') textoFuente = "DENUE; Directorio Estadístico Nacional de Unidades Económicas, INEGI (2022)";
    else if (scaleType === 'municipio') textoFuente = "Sistema para la Consulta de Información Censal (SCINCE), INEGI 2020";
    if (fuenteControl) fuenteControl.update(textoFuente);

    var filename = "";
    var zoomCoords = [];
    var zoomLevel = 5;

    var filterBox = document.getElementById('filter-container-box');
    
    // Auto-desplegar filtros al cambiar de escala
    var btnContainer = document.getElementById('filter-buttons-container');
    if (btnContainer && !btnContainer.classList.contains('show')) {
        btnContainer.classList.add('show');
        var arrow = document.getElementById('filter-arrow');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }

    if (scaleType === 'estatal') {
        if(filterBox) {
            filterBox.style.display = 'flex';
            document.getElementById('filter-buttons-container').innerHTML = "";
            document.getElementById('filter-title').innerText = "Cargando...";
        }
        iniciarLogicaEstatal(); 
        return; 
    }

    if (scaleType === 'municipio') {
        if(filterBox) {
            filterBox.style.display = 'flex';
            document.getElementById('filter-buttons-container').innerHTML = "";
            document.getElementById('filter-title').innerText = "Cargando...";
        }
        iniciarLogicaMunicipio();
        return;
    }

    if (scaleType === 'mundial') {
        filename = "mundial.geojson";
        zoomCoords = [20, 0]; zoomLevel = 2;
        if(filterBox) filterBox.style.display = 'flex';
    } else if (scaleType === 'nacional') {
        filename = "nacional.geojson";
        zoomCoords = [23.6345, -102.5528]; zoomLevel = 5;
        if(filterBox) filterBox.style.display = 'flex';
    }

    fetch(filename)
        .then(response => response.json())
        .then(data => {
            activeData = data; 
            map.flyTo(zoomCoords, zoomLevel, { duration: 1.5 });

            if (scaleType === 'mundial') iniciarFiltroMundial_Paso1(data);
            else if (scaleType === 'nacional') iniciarFiltroNacional_Paso1(data);
        })
        .catch(error => console.error("Error cargando datos: " + error));
}

// ==========================================
// 4. LÓGICA MUNDIAL & NACIONAL (Textos limpios)
// ==========================================
function iniciarFiltroMundial_Paso1(data) {
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";
    document.getElementById('filter-title').innerText = "Redes Globales";

    var opcionesIndustria = [...new Set(data.features.map(f => f.properties.Industria))].sort();
    
    var selectIndustria = document.createElement("select");
    selectIndustria.className = "dynamic-filter-select";
    selectIndustria.innerHTML = `<option value="" disabled selected>-- Industria --</option>`;
    opcionesIndustria.forEach(item => {
        selectIndustria.innerHTML += `<option value="${item}">${item}</option>`;
    });

    var selectOrigen = document.createElement("select");
    selectOrigen.className = "dynamic-filter-select";
    selectOrigen.style.display = 'none'; 
    
    selectIndustria.onchange = function() {
        var industriaSel = this.value;
        var datosFiltrados = data.features.filter(f => f.properties.Industria === industriaSel);
        var origenes = [...new Set(datosFiltrados.map(f => f.properties.Pais_Orige))].sort();
        
        selectOrigen.innerHTML = `<option value="" disabled selected>-- País --</option>`;
        origenes.forEach(item => {
            selectOrigen.innerHTML += `<option value="${item}">${item}</option>`;
        });
        selectOrigen.style.display = 'block'; 
        if(currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
    };

    selectOrigen.onchange = function() {
        var industriaSel = selectIndustria.value;
        var origenSel = this.value;
        var finalData = data.features.filter(f => f.properties.Industria === industriaSel && f.properties.Pais_Orige === origenSel);
        renderizarMapaFlujos(finalData, 'Valor', 'MDD', 'Pais_Desti');
    };

    container.appendChild(selectIndustria);
    container.appendChild(selectOrigen);
}

function iniciarFiltroNacional_Paso1(data) {
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";
    document.getElementById('filter-title').innerText = "Intercambio multirregional";

    var opcionesSubsector = [...new Set(data.features.map(f => f.properties.SUBSECTO_3 || f.properties.SUBSECTO_2))].sort();
    
    var selectSubsector = document.createElement("select");
    selectSubsector.className = "dynamic-filter-select";
    selectSubsector.innerHTML = `<option value="" disabled selected>-- Subsector --</option>`;
    opcionesSubsector.forEach(item => {
        selectSubsector.innerHTML += `<option value="${item}">${item}</option>`;
    });

    var selectEstado = document.createElement("select");
    selectEstado.className = "dynamic-filter-select";
    selectEstado.style.display = 'none'; 
    
    selectSubsector.onchange = function() {
        var subsectorSel = this.value;
        var datosFiltrados = data.features.filter(f => (f.properties.SUBSECTO_3 === subsectorSel || f.properties.SUBSECTO_2 === subsectorSel));
        var estados = [...new Set(datosFiltrados.map(f => f.properties.Edo_V))].sort();
        
        selectEstado.innerHTML = `<option value="" disabled selected>-- Entidad Federativa --</option>`;
        estados.forEach(item => {
            selectEstado.innerHTML += `<option value="${item}">${item}</option>`;
        });
        selectEstado.style.display = 'block'; 
        if(currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
    };

    selectEstado.onchange = function() {
        var subsectorSel = selectSubsector.value;
        var estadoSel = this.value;
        var finalData = data.features.filter(f => (f.properties.SUBSECTO_3 === subsectorSel || f.properties.SUBSECTO_2 === subsectorSel) && f.properties.Edo_V === estadoSel);
        renderizarMapaFlujos(finalData, 'VALOR', 'MDP', 'EDO_C');
    };

    container.appendChild(selectSubsector);
    container.appendChild(selectEstado);
}

// ==========================================
// 5. LÓGICA ESTATAL (CLÚSTERES + ISOCRONAS)
// ==========================================
function iniciarLogicaEstatal() {
    Promise.all([
        fetch('denue.geojson').then(r => r.json()),
        fetch('armadoras.geojson').then(r => r.json()),
        fetch('isocronas.geojson').then(r => r.json()) 
    ]).then(([denueData, armadorasData, isocronasData]) => {
        denueRawData = denueData;
        armadorasRawData = armadorasData;
        isocronasRawData = isocronasData;
        generarMenuEstados(denueData);
        var legendContent = document.getElementById('legend-content');
        if(legendContent) legendContent.innerHTML = "<small>Seleccione un Estado</small>";
        map.flyTo([23.6345, -102.5528], 5);
    }).catch(err => console.error("Error cargando datos:", err));
}

function generarMenuEstados(data) {
    var container = document.getElementById('filter-buttons-container');
    var title = document.getElementById('filter-title');
    if (container) container.innerHTML = "";
    if (title) title.innerText = "Entidad federativa";

    var estados = [...new Set(data.features.map(f => f.properties.NOMGEO || "Desconocido"))].sort();
    
    var select = document.createElement("select");
    select.className = "dynamic-filter-select";
    
    var defaultOption = document.createElement("option");
    defaultOption.innerText = "-- Entidad Federativa --";
    defaultOption.value = "";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    estados.forEach(estado => {
        if(!estado) return; 
        var opt = document.createElement("option");
        opt.value = estado;
        opt.innerText = estado;
        select.appendChild(opt);
    });

    select.onchange = function() {
        if (this.value) {
            filtrarPorEstado(this.value);
        }
    };
    
    container.appendChild(select);
}

function normalizarTexto(texto) {
    if (!texto) return "";
    return texto.toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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
    var estadoBusqueda = normalizarTexto(nombreEstado);

    var denueEstado = denueRawData.features.filter(f => normalizarTexto(f.properties.NOMGEO || f.properties.ENTIDAD || f.properties.ESTADO) === estadoBusqueda);
    
    var armadorasEstado = armadorasRawData.features.filter(f => {
        var estadoArmadora = normalizarTexto(f.properties.Estado || f.properties.ESTADO || f.properties.NOMGEO);
        if (estadoBusqueda === "BAJA CALIFORNIA" && estadoArmadora.includes("SUR")) return false;
        return estadoArmadora === estadoBusqueda || estadoArmadora.includes(estadoBusqueda) || estadoBusqueda.includes(estadoArmadora);
    });

    var isocronasRawList = isocronasRawData.features.filter(f => normalizarTexto(f.properties.NOMGEO || f.properties.Estado || f.properties.ESTADO || f.properties.ENTIDAD) === estadoBusqueda);
    var isocronasEstado = procesarYUnirIsocronas(isocronasRawList);

    isocronasEstado.sort((a, b) => parseInt(b.properties.AA_MINS || 0) - parseInt(a.properties.AA_MINS || 0));

    if (isocronasLayer) map.removeLayer(isocronasLayer);
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
    if (armadorasLayer) map.removeLayer(armadorasLayer);

    var animIso15 = [], animIso30 = [], animIso60 = [];
    var animDenue = [];
    var animArmadoras = [];

    if (isocronasEstado.length > 0) {
        isocronasLayer = L.geoJSON(isocronasEstado, {
            style: function() {
                return { opacity: 0, fillOpacity: 0, weight: 1.5, className: 'sin-interaccion' };
            },
            onEachFeature: function(feature, layer) {
                var mins = parseInt(feature.properties.AA_MINS || 0);
                if (mins <= 15) animIso15.push(layer);
                else if (mins <= 30) animIso30.push(layer);
                else animIso60.push(layer);
            }
        }).addTo(map);
        isocronasLayer.bringToBack();
    }

    if (denueEstado.length > 0) {
        currentGeoJSONLayer = L.geoJSON(denueEstado, {
            pointToLayer: function (feature, latlng) {
                var sector = feature.properties.Conjunto || "Otros";
                if(sector === "Actividades SEIT") sector = "Servicios SEIT";
                return L.circleMarker(latlng, {
                    radius: 5, fillColor: getColorConjunto(sector), color: "#ffffff", weight: 0.8, opacity: 0, fillOpacity: 0 
                });
            },
            onEachFeature: function(feature, layer) {
                animDenue.push(layer);
                var empresa = feature.properties.Nombre || feature.properties.Empresa;
                var sector = feature.properties.Conjunto;
                layer.bindPopup(`<b>${empresa}</b><br><small>${sector}</small>`);
            }
        }).addTo(map);
    }

    if (armadorasEstado.length > 0) {
        armadorasLayer = L.geoJSON(armadorasEstado, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 12, fillColor: "#00e5ff", color: "#fff", weight: 3, opacity: 0, fillOpacity: 0 
                });
            },
            onEachFeature: function(feature, layer) {
                animArmadoras.push(layer);
            }
        }).addTo(map);
    }

    function ejecutarAnimacion() {
        animDenue.sort(() => Math.random() - 0.5);
        let tercio = Math.floor(animDenue.length / 3);
        let denue1 = animDenue.slice(0, tercio);
        let denue2 = animDenue.slice(tercio, tercio * 2);
        let denue3 = animDenue.slice(tercio * 2);

        setTimeout(() => {
            animIso15.forEach(l => l.setStyle({opacity: 1, fillOpacity: 0.8, color: getColorIsocrona(15), fillColor: getColorIsocrona(15)}));
            animArmadoras.forEach(l => {
                l.setStyle({opacity: 1, fillOpacity: 1}); 
                var nombre = l.feature.properties.NOMBRE || l.feature.properties.Nombre || "Planta";
                l.bindTooltip(nombre, { permanent: true, direction: 'top', className: 'etiqueta-armadora', offset: [0, -15] });
            });
            denue1.forEach(l => l.setStyle({opacity: 1, fillOpacity: 0.9})); 
        }, 100);

        setTimeout(() => {
            animIso30.forEach(l => l.setStyle({opacity: 1, fillOpacity: 0.4, color: getColorIsocrona(30), fillColor: getColorIsocrona(30)}));
            denue2.forEach(l => l.setStyle({opacity: 1, fillOpacity: 0.9}));
        }, 800);

        setTimeout(() => {
            animIso60.forEach(l => l.setStyle({opacity: 1, fillOpacity: 0.25, color: getColorIsocrona(60), fillColor: getColorIsocrona(60)}));
            denue3.forEach(l => l.setStyle({opacity: 1, fillOpacity: 0.9}));
        }, 1500);
    }

    try {
        if (armadorasEstado.length > 0) {
            var latlngs = armadorasEstado.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
            map.flyToBounds(latlngs, { padding: [100, 100], duration: 1.5, maxZoom: 11 });
            map.once('moveend', ejecutarAnimacion);
        } else if (isocronasEstado.length > 0) {
            map.flyToBounds(isocronasLayer.getBounds(), { padding: [50, 50] });
            map.once('moveend', ejecutarAnimacion);
        } else if (currentGeoJSONLayer && denueEstado.length > 0) {
            map.flyToBounds(currentGeoJSONLayer.getBounds(), { padding: [50, 50] });
            map.once('moveend', ejecutarAnimacion);
        } else {
            ejecutarAnimacion(); 
        }
    } catch (e) { 
        console.error("Error zoom:", e); 
        ejecutarAnimacion();
    }

    actualizarPanelEstatal(nombreEstado, denueEstado, armadorasEstado);
    actualizarLeyendaIsocronas(); 
}

function dibujarArmadorasPuntos(features) {
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
    if (!features || features.length === 0) return;

    armadorasLayer = L.geoJSON(features, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 12, fillColor: "#00e5ff", color: "#fff", weight: 3, opacity: 1, fillOpacity: 1
            });
        },
        onEachFeature: function(feature, layer) {
            var nombre = feature.properties.NOMBRE || feature.properties.Nombre || "Planta";
            layer.bindTooltip(nombre, { permanent: true, direction: 'top', className: 'etiqueta-armadora', offset: [0, -15] });
        }
    }).addTo(map);
}

// ==========================================
// 6. LÓGICA MUNICIPIO (AGEB)
// ==========================================
function iniciarLogicaMunicipio() {
    if (agebLayer) { map.removeLayer(agebLayer); agebLayer = null; }
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; } 
    agebRawData = null; 
    
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";
    document.getElementById('filter-title').innerText = "AGEB";

    var estadosAgeb = [
        { nombre: "Aguascalientes", archivo: "agebags.geojson" },
        { nombre: "Baja California", archivo: "agebbc.geojson" },
        { nombre: "Coahuila", archivo: "agebcoah.geojson" },
        { nombre: "Estado de México", archivo: "agebmex.geojson" },
        { nombre: "Guanajuato", archivo: "agebgto.geojson" },
        { nombre: "Jalisco", archivo: "agebjal.geojson" },
        { nombre: "Morelos", archivo: "agebmor.geojson" },
        { nombre: "Nuevo León", archivo: "agebnl.geojson" },
        { nombre: "Puebla", archivo: "agebpue.geojson" },
        { nombre: "San Luis Potosí", archivo: "agebslp.geojson" },
        { nombre: "Sonora", archivo: "agebson.geojson" }
    ];

    var selectEstado = document.createElement("select");
    selectEstado.className = "dynamic-filter-select";
    selectEstado.innerHTML = `<option value="" disabled selected>-- Entidad Federativa --</option>`;
    estadosAgeb.forEach(estado => {
        selectEstado.innerHTML += `<option value="${estado.archivo}">${estado.nombre}</option>`;
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

    selectEstado.onchange = function() {
        if(this.value) {
            var nombreEst = this.options[this.selectedIndex].text;
            document.getElementById('filter-title').innerText = "Cargando " + nombreEst + "...";
            cargarAgebEstadoAcumulativo(nombreEst, this.value, selectIndice, opcionesAgeb);
        }
    };

    selectIndice.onchange = function() {
        if(this.value) {
            var labelNombre = this.options[this.selectedIndex].text;
            renderizarMapaAgeb(this.value, labelNombre);
        }
    };
    
    container.appendChild(selectEstado);
    container.appendChild(selectIndice);
    
    var legendContent = document.getElementById('legend-content');
    if(legendContent) legendContent.innerHTML = "<small>Seleccione un estado primero</small>";
}

function cargarAgebEstadoAcumulativo(nombreEstado, archivoGeojson, selectIndice, opcionesAgeb) {
    Promise.all([
        fetch(archivoGeojson).then(r => r.json()),
        fetch('armadoras.geojson').then(r => r.json())
    ])
    .then(([agebData, armadorasData]) => {
        document.getElementById('filter-title').innerText = "AGEB";
        agebRawData = agebData; 
        armadorasRawData = armadorasData;

        var estadoBusqueda = normalizarTexto(nombreEstado);
        var armadorasFiltradas = armadorasRawData.features.filter(f => {
            var estadoArmadora = normalizarTexto(f.properties.Estado || f.properties.ESTADO || f.properties.NOMGEO);
            if (estadoBusqueda === "BAJA CALIFORNIA" && estadoArmadora.includes("SUR")) return false;
            return estadoArmadora === estadoBusqueda || estadoArmadora.includes(estadoBusqueda) || estadoBusqueda.includes(estadoArmadora);
        });

        dibujarArmadorasPuntos(armadorasFiltradas);

        var bounds = L.geoJSON(agebData).getBounds();
        map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });

        selectIndice.innerHTML = `<option value="" disabled>-- Índice --</option>`;
        opcionesAgeb.forEach((opc, idx) => {
            var sel = idx === 3 ? "selected" : "";
            selectIndice.innerHTML += `<option value="${opc.id}" ${sel}>${opc.label}</option>`;
        });
        selectIndice.style.display = 'block';
        
        renderizarMapaAgeb('G_INDICE', 'Índice Global');
    })
    .catch(err => {
        console.error("Error cargando capas:", err);
        document.getElementById('filter-title').innerText = "Error cargando " + nombreEstado;
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

function renderizarMapaAgeb(atributo, labelNombre) {
    if (agebLayer) map.removeLayer(agebLayer);

    agebLayer = L.geoJSON(agebRawData, {
        style: function(feature) {
            var valorCategoria = feature.properties[atributo] || "Sin dato";
            return {
                color: "#111",           
                weight: 0.5,             
                fillColor: getColorVulnerabilidad(valorCategoria), 
                fillOpacity: 0.85,       
                className: 'flujo-interactivo'
            };
        },
        onEachFeature: function(feature, layer) {
            var p = feature.properties;
            var popupContent = `
                <div style="font-family:'Noto Sans'; font-size:13px;">
                    <strong style="color:#de2d26; font-size:14px;">Análisis AGEB</strong><br>
                    <hr style="border:0; border-top:1px solid #555; margin:5px 0;">
                    <b>${labelNombre}:</b> <span style="color:#fff">${p[atributo] || "Sin dato"}</span><br><br>
                    <small style="color:#aaa; line-height: 1.4;">
                        ▸ Espacial (Hogar): ${p.g_espacial || "N/A"}<br>
                        ▸ Urbano (Infraestructura): ${p.g_urbano || "N/A"}<br>
                        ▸ Socioeconómico: ${p.g_socioeco || "N/A"}
                    </small>
                </div>
            `;
            layer.bindPopup(popupContent);
            
            layer.on({
                mouseover: function(e) { 
                    e.target.setStyle({ weight: 2, color: '#fff' }); 
                    e.target.bringToFront(); 
                },
                mouseout: function(e) { agebLayer.resetStyle(e.target); }
            });
        }
    }).addTo(map);

    agebLayer.bringToBack(); 
    if (armadorasLayer) armadorasLayer.bringToFront();

    actualizarLeyendaAgebCategorica(labelNombre);
    actualizarGraficaAgeb(atributo, labelNombre);
}

// ==========================================
// RENDERIZADO DE MAPAS (MUNDIAL/NACIONAL)
// ==========================================
function renderizarMapaFlujos(features, campoValor, etiquetaMoneda, campoDestino) {
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);

    actualizarGrafica(features, campoDestino, campoValor, etiquetaMoneda);

    var validFeatures = features.filter(f => f.properties[campoValor] != null && !isNaN(f.properties[campoValor]));
    var valores = validFeatures.map(f => f.properties[campoValor]).sort((a,b) => a - b);
    var breaks = calcularBreaks(valores);

    var fg = L.featureGroup().addTo(map);
    currentGeoJSONLayer = fg;

    validFeatures.forEach((feature, index) => {
        var p = feature.properties;
        var val = p[campoValor];
        var clase = getClase(val, breaks);
        
        var coords = [];
        if (feature.geometry.type === 'LineString') {
            coords = feature.geometry.coordinates.map(c => [c[1], c[0]]);
        } else if (feature.geometry.type === 'MultiLineString') {
            coords = feature.geometry.coordinates[0].map(c => [c[1], c[0]]);
        }

        if (coords.length > 0) {
            coords.reverse();

            var polyline = L.polyline(coords, {
                color: RampaRojos[clase],
                weight: Grosores[clase] + 1,
                opacity: 0.8,
                className: 'flujo-animado'
            });

            var valFormatted = (val || 0).toLocaleString(); 
            var popupContent = `
                <div style="font-family:'Noto Sans'; font-size:13px;">
                    <strong style="color:#de2d26; font-size:14px;">${p[campoDestino]}</strong><br>
                    <hr style="border:0; border-top:1px solid #555; margin:5px 0;">
                    Valor: <b style="color:#fff">$${valFormatted}</b> <small>${etiquetaMoneda}</small>
                </div>
            `;
            polyline.bindPopup(popupContent);
            
            polyline.on({
                mouseover: function(e) { 
                    var layer = e.target;
                    layer.setStyle({ weight: layer.options.weight + 4, color: '#ffff00' });
                    layer.bringToFront();
                },
                mouseout: function(e) { 
                    var layer = e.target;
                    layer.setStyle({ weight: Grosores[clase] + 1, color: RampaRojos[clase] });
                }
            });

            fg.addLayer(polyline);

            setTimeout(() => {
                if (polyline._path) {
                    var length = polyline._path.getTotalLength();
                    polyline._path.style.transition = polyline._path.style.WebkitTransition = 'none';
                    polyline._path.style.strokeDasharray = length + ' ' + length;
                    polyline._path.style.strokeDashoffset = length;
                    
                    polyline._path.getBoundingClientRect(); 
                    
                    var delay = index * 200; 
                    
                    setTimeout(() => {
                        polyline._path.style.transition = polyline._path.style.WebkitTransition = 'stroke-dashoffset 1.3s ease-in-out';
                        polyline._path.style.strokeDashoffset = '0';
                    }, delay);
                    
                    setTimeout(() => {
                        if (polyline._path) {
                            polyline._path.style.transition = '';
                            polyline._path.style.WebkitTransition = '';
                            polyline._path.style.strokeDasharray = '';
                            polyline._path.style.strokeDashoffset = '';
                        }
                    }, delay + 1500);
                }
            }, 100);
        }
    });

    actualizarLeyenda(breaks, etiquetaMoneda);
}

// ==========================================
// INTERFAZ (UI) Y GRÁFICAS
// ==========================================
function setupUI() {
    var leftContainer = document.getElementById('left-sidebar-container');
    if (!leftContainer) {
        leftContainer = document.createElement('div');
        leftContainer.id = 'left-sidebar-container';
        document.body.appendChild(leftContainer);
    }

    if (!document.getElementById('scale-box')) {
        var scaleBox = document.createElement('div');
        scaleBox.id = 'scale-box';
        scaleBox.className = 'dashboard-box';
        scaleBox.innerHTML = `
            <h4 class="panel-title">Análisis Multiescalar</h4>
            <div class="scale-icons-container">
                <button onclick="loadLayer('mundial')" class="scale-btn" id="btn-mundial" title="Escala Mundial">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M22 12h-20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </button>
                <button onclick="loadLayer('nacional')" class="scale-btn" id="btn-nacional" title="Escala Nacional">
                    <img src="https://cdn.jsdelivr.net/gh/djaiss/mapsicon@master/all/mx/vector.svg" alt="México" style="width: 22px; height: 22px; filter: invert(1);">
                </button>
                <button onclick="loadLayer('estatal')" class="scale-btn" id="btn-estatal" title="Escala Estatal (Clústeres)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="3" fill="currentColor"/><circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="18" cy="8" r="3" fill="currentColor"/><circle cx="8" cy="18" r="3" fill="currentColor"/><path d="M10 10l4 4M16 10l-6 6M10 16l4-4"/></svg>
                </button>
                <button onclick="loadLayer('municipio')" class="scale-btn" id="btn-municipio" title="Escala Municipal (AGEB)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 20 8 18 20 6 22 2 10" fill="currentColor" fill-opacity="0.3"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
                </button>
            </div>
        `;
        leftContainer.appendChild(scaleBox);
    }

    // --- PANEL DE FILTROS DESPLEGABLE ANIMADO ---
    if (!document.getElementById('filter-container-box')) {
        var filterBox = document.createElement('div');
        filterBox.id = 'filter-container-box';
        filterBox.className = 'dashboard-box';
        filterBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('filter-buttons-container')" title="Ocultar/Mostrar Filtros">
                <span id="filter-title">Filtros</span>
                <span id="filter-arrow" style="display:inline-block; transition: transform 0.3s; font-size: 12px;">▼</span>
            </h4>
            <div id="filter-buttons-container" class="dropdown-content show" style="width: 100%;"></div>
        `;
        leftContainer.appendChild(filterBox);
    }

    if (!document.getElementById('legend-overlay')) {
        var legendBox = document.createElement('div');
        legendBox.id = 'legend-overlay';
        legendBox.className = 'dashboard-box';
        legendBox.style.display = 'none';
        legendBox.innerHTML = `<h4 class="panel-title">Simbología</h4><div id="legend-content"><small style="color:#aaa">Seleccione una escala</small></div>`;
        leftContainer.appendChild(legendBox); 
    }

    if (!document.getElementById('stats-overlay')) {
        var statsBox = document.createElement('div');
        statsBox.id = 'stats-overlay';
        statsBox.className = 'dashboard-box';
        statsBox.style.display = 'none';
        // --- SE AGREGA EL DIV DYNAMIC-SUMMARY ---
        statsBox.innerHTML = `
            <h4 class="panel-title">Análisis de Datos</h4>
            <div style="height:180px; position:relative;"><canvas id="myChart"></canvas></div>
            <div id="dynamic-summary" class="dynamic-summary-box"></div>
            <button onclick="capturarImagen()" class="screenshot-btn">📸 Guardar Reporte (Img)</button>
        `;
        leftContainer.appendChild(statsBox); 
    }
}

function actualizarPanelEstatal(nombreEstado, denueEstado, armadorasEstado) {
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var conteo = {};
    denueEstado.forEach(f => {
        var ramo = f.properties.Conjunto || "Otros";
        if (ramo === "Actividades SEIT") ramo = "Servicios SEIT";
        conteo[ramo] = (conteo[ramo] || 0) + 1;
    });

    var titulo = statsDiv.querySelector('.panel-title');
    if(titulo) {
        var subtitulo = armadorasEstado.length > 0 
            ? `<span style="color:#00e5ff; font-size:12px">🏭 Plantas Armadoras Presentes</span>`
            : `<span style="color:#aaa; font-size:12px">Sin planta armadora</span>`;

        titulo.innerHTML = `
            <span style="font-size:18px; font-weight:bold; text-transform:uppercase">${nombreEstado}</span><br>
            <span style="font-size:13px; color:#ddd">Total Empresas: <b>${denueEstado.length}</b></span><br>
            ${subtitulo}
        `;
    }

    var canvas = document.getElementById('myChart');
    if (!canvas) return;

    canvas.parentElement.style.height = '150px';

    var labels = Object.keys(conteo);
    var dataValues = Object.values(conteo);
    var colores = labels.map(l => getColorConjunto(l));

    if (mainChart) mainChart.destroy();
    if(dataValues.length === 0) return;

    mainChart = new Chart(canvas.getContext('2d'), {
        type: 'pie',
        data: { 
            labels: labels, 
            datasets: [{ 
                label: 'Empresas', 
                data: dataValues, 
                backgroundColor: colores, 
                borderColor: '#222', 
                borderWidth: 1 
            }] 
        },
        // --- ACTIVAMOS LOS NÚMEROS ---
        plugins: [ChartDataLabels],
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: {
                padding: { top: 5, bottom: 5, left: 5, right: 5 } 
            },
            plugins: { 
                legend: { display: false },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 14 },
                    formatter: function(value) {
                        return value > 0 ? value : ''; 
                    }
                }
            }
        }
    });
}

function actualizarGrafica(features, campoEtiqueta, campoValor, etiquetaMoneda) {
    if (typeof Chart === 'undefined') return;
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var titulo = statsDiv.querySelector('.panel-title'); 
    if (titulo) {
        if (currentScaleType === 'mundial') titulo.innerHTML = "Top 5 Intercambio Mundial<br><small style='color:#aaa; font-size:11px'>Millones de Dólares (MDD)</small>";
        else if (currentScaleType === 'nacional') titulo.innerHTML = "Top Intercambio por Estado<br><small style='color:#aaa; font-size:11px'>Millones de Pesos (MDP)</small>";
    }

    const canvas = document.getElementById('myChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    canvas.parentElement.style.height = '180px';
    
    let validFeatures = features.filter(f => f.properties[campoValor] != null && !isNaN(f.properties[campoValor]));
    let topData = [...validFeatures].sort((a, b) => b.properties[campoValor] - a.properties[campoValor]).slice(0, 5);
    
    // --- RESUMEN DINÁMICO (Se mantiene corregido) ---
    var summaryDiv = document.getElementById('dynamic-summary');
    if (summaryDiv) {
        if (currentScaleType === 'mundial' && topData.length > 0) {
            var topPais = topData[0].properties[campoEtiqueta]; 
            var topValor = (topData[0].properties[campoValor] || 0).toLocaleString('es-MX');
            summaryDiv.innerHTML = `<b>${topPais}</b>, siendo este el país con mayor intercambio, exporta <b>$${topValor} MDD</b>.`;
            summaryDiv.style.display = 'block';
        } else {
            summaryDiv.style.display = 'none';
        }
    }

    let labels = topData.map(f => f.properties[campoEtiqueta]);
    let dataValues = topData.map(f => f.properties[campoValor]);

    let coloresGradiente = ['#a50f15', '#de2d26', '#fb6a4a', '#fcae91', '#fee5d9'];
    let bgColors = dataValues.map((val, idx) => coloresGradiente[idx] || '#fee5d9');

    if (mainChart) mainChart.destroy();
    
    mainChart = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: labels, 
            datasets: [{ 
                label: `Valor`, 
                data: dataValues, 
                backgroundColor: bgColors, 
                borderColor: '#333', 
                borderWidth: 1 
            }] 
        },
        plugins: [ChartDataLabels],
        options: { 
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                // --- SECCIÓN DE NÚMEROS (CORREGIDA) ---
                datalabels: {
                    color: '#fff',
                    anchor: 'end',
                    // ¡CAMBIO AQUÍ! De 'left' a 'right' para que el texto salga de la barra
                    align: 'right', 
                    font: { weight: 'bold', size: 11 },
                    formatter: function(value) {
                        return value.toLocaleString('es-MX'); 
                    }
                }
            }, 
            scales: { 
                x: { 
                    ticks: { 
                        color: '#aaa',
                        callback: function(value) {
                            return currentScaleType === 'nacional' ? value / 1000000 : value;
                        }
                    }, 
                    grid: { color:'#444' } 
                }, 
                y: { 
                    ticks: { color: '#fff' }, 
                    grid: { display:false } 
                } 
            } 
        }
    });
}

// ==========================================
// NUEVA FUNCIÓN: GRÁFICA PARA ESCALA MUNICIPAL (AGEB)
// ==========================================
function actualizarGraficaAgeb(atributo, labelNombre) {
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var summaryDiv = document.getElementById('dynamic-summary');
    if (summaryDiv) summaryDiv.style.display = 'none'; // Ocultamos el texto de la escala mundial

    // 1. Contador de categorías (Forzamos el orden de Muy Alto a Sin Dato)
    var conteo = { 'Muy Alto': 0, 'Alto': 0, 'Medio': 0, 'Bajo': 0, 'Muy Bajo': 0, 'Sin dato': 0 };

    agebRawData.features.forEach(f => {
        var val = f.properties[atributo];
        if (!val) val = "Sin dato";
        var v = val.toString().trim().toUpperCase();
        
        if (v === 'MUY ALTO') conteo['Muy Alto']++;
        else if (v === 'ALTO') conteo['Alto']++;
        else if (v === 'MEDIO') conteo['Medio']++;
        else if (v === 'BAJO') conteo['Bajo']++;
        else if (v === 'MUY BAJO') conteo['Muy Bajo']++;
        else conteo['Sin dato']++;
    });

    var labels = [];
    var dataValues = [];
    var colores = [];

    // Solo agregamos a la gráfica los que tengan más de 0 AGEBs
    Object.keys(conteo).forEach(key => {
        if (conteo[key] > 0) {
            labels.push(key);
            dataValues.push(conteo[key]);
            colores.push(getColorVulnerabilidad(key)); // Usamos tu función de colores
        }
    });

    // 2. Título de la tarjeta
    var titulo = statsDiv.querySelector('.panel-title');
    if(titulo) {
        titulo.innerHTML = `Distribución de AGEBs<br><span style="font-size:12px; color:#ddd">${labelNombre}</span>`;
    }

    var canvas = document.getElementById('myChart');
    if (!canvas) return;
    canvas.parentElement.style.height = '160px'; 

    if (mainChart) mainChart.destroy();

    // 3. Dibujamos la Dona
    mainChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { 
            labels: labels, 
            datasets: [{ 
                data: dataValues, 
                backgroundColor: colores, 
                borderColor: '#222', 
                borderWidth: 1 
            }] 
        },
        plugins: [ChartDataLabels],
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            cutout: '50%', // Qué tan gruesa es la dona
            layout: { padding: 5 },
            plugins: { 
                legend: { display: false },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 13 },
                    textShadowBlur: 4,        // Sombra para que el blanco resalte...
                    textShadowColor: '#000',  // ...incluso en los colores claros como "Muy Bajo"
                    formatter: function(value) {
                        return value > 0 ? value : ''; 
                    }
                }
            }
        }
    });
}

function descargarDatos() {
    if (!mainChart || !mainChart.data || mainChart.data.labels.length === 0) { alert("No hay datos visibles."); return; }
    let rows = [], filename = "datos.csv";
    if (currentScaleType === 'estatal') { filename = "Analisis_Cluster.csv"; rows.push(["Sector Industrial", "Cantidad"]); } 
    else { filename = `Top5_${currentScaleType.toUpperCase()}.csv`; rows.push(["Destino/Origen", "Valor"]); }
    let labels = mainChart.data.labels; let values = mainChart.data.datasets[0].data;
    labels.forEach((label, i) => { rows.push([String(label).replace(/,/g, " "), values[i]]); });
    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    let link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function capturarImagen() {
    var navBar = document.getElementById('nav-bar');
    if(navBar) navBar.style.display = 'none';
    html2canvas(document.body, { useCORS: true, allowTaint: true, scrollY: -window.scrollY }).then(canvas => {
        var link = document.createElement('a'); link.download = `Reporte_${new Date().toISOString().slice(0,19)}.png`;
        link.href = canvas.toDataURL("image/png"); link.click();
        if(navBar) navBar.style.display = 'flex'; alert("¡Imagen guardada!");
    });
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
    if (m <= 15) return '#00ff00'; 
    if (m <= 30) return '#ffff00'; 
    if (m <= 60) return '#ff4500'; 
    return '#808080'; 
}

function calcularBreaks(valores) {
    if (!valores || valores.length === 0) return [0,0,0,0];
    if (valores.length < 5) return [valores[0], valores[0], valores[0], valores[0]];
    var step = Math.floor(valores.length / 5);
    return [valores[step], valores[step*2], valores[step*3], valores[step*4]];
}

function getClase(valor, breaks) {
    if (valor <= breaks[0]) return 0; if (valor <= breaks[1]) return 1; if (valor <= breaks[2]) return 2; if (valor <= breaks[3]) return 3; return 4;
}

// ==========================================
// LEYENDAS (Fuentes removidas porque ahora están en el control inferior izquierdo)
// ==========================================
function actualizarLeyenda(breaks, moneda) {
    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content'); 
    if(!div || !overlay) return;
    
    var f = (n) => (n || 0).toLocaleString('es-MX', {maximumFractionDigits: 0}); 
    var valorMinimo = breaks[0];
    var valorMaximo = breaks[3];
    var coloresCSS = RampaRojos.join(', ');
    
    var html = `
        <div style="margin-bottom:12px; font-weight:bold; color:#ddd; font-size:14px;">Valor (${moneda})</div>
        <div style="width: 100%; padding: 0 5px; box-sizing: border-box;">
            <div style="width: 100%; height: 35px; background: linear-gradient(to right, ${coloresCSS}); clip-path: polygon(0 40%, 100% 0, 100% 100%, 0 60%);"></div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #ccc; font-weight: bold; margin-top: 5px;">
                <span>$${f(valorMinimo)}</span>
                <span>> $${f(valorMaximo)}</span>
            </div>
        </div>
    `;
    
    div.innerHTML = html;
    overlay.style.display = 'block';
}

function actualizarLeyendaIsocronas() {
    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content');
    if(!div || !overlay) return;

    div.innerHTML = `
        <div style="margin-bottom:8px; font-weight:bold; color:#00e5ff">Accesibilidad (Tiempo)</div>
        <div class="legend-item"><span class="legend-color" style="background:rgba(0, 255, 0, 0.8); border:1px solid #00ff00"></span> 0 - 15 Minutos (Cerca)</div>
        <div class="legend-item"><span class="legend-color" style="background:rgba(255, 255, 0, 0.6); border:1px solid #ffff00"></span> 15 - 30 Minutos (Medio)</div>
        <div class="legend-item"><span class="legend-color" style="background:rgba(255, 69, 0, 0.3); border:1px solid #ff4500"></span> 30 - 60 Minutos (Lejos)</div>
        
        <div style="margin:10px 0 5px 0; font-weight:bold; color:#ddd">Proveedores</div>
        <div class="legend-item"><span class="legend-color" style="background:#ff3333; border:1px solid #fff; border-radius:50%"></span> Automotriz</div>
        <div class="legend-item"><span class="legend-color" style="background:#2196f3; border:1px solid #fff; border-radius:50%"></span> Electrónica</div>
        <div class="legend-item"><span class="legend-color" style="background:#9c27b0; border:1px solid #fff; border-radius:50%"></span> Servicios SEIT</div>
        <div class="legend-item"><span class="legend-color" style="background:#ffc107; border:1px solid #fff; border-radius:50%"></span> Eléctrica</div>
        
        <div style="margin-top:8px" class="legend-item"><span class="legend-color" style="background:#00e5ff; border-radius:50%; border:2px solid white"></span> Planta Armadora</div>
    `;
    overlay.style.display = 'block';
}

function actualizarLeyendaAgebCategorica(titulo) {
    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content'); 
    if(!div || !overlay) return;
    
    var html = `
        <div style="margin-bottom:12px; font-weight:bold; color:#ddd; font-size:14px;">${titulo}</div>
        
        <div style="width: 100%; padding: 0 5px; box-sizing: border-box; margin-bottom: 15px;">
            <div style="display: flex; width: 100%; height: 18px; border-radius: 4px; border: 1px solid #555; overflow: hidden; cursor: crosshair;">
                <div style="flex: 1; background-color: #fee5d9;" title="Muy Bajo"></div>
                <div style="flex: 1; background-color: #fcae91;" title="Bajo"></div>
                <div style="flex: 1; background-color: #fb6a4a;" title="Medio"></div>
                <div style="flex: 1; background-color: #de2d26;" title="Alto"></div>
                <div style="flex: 1; background-color: #a50f15;" title="Muy Alto"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #ccc; font-weight: bold; margin-top: 8px;">
                <span>Muy Bajo</span>
                <span>Muy Alto</span>
            </div>
        </div>

        <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 12px; color: #eee;">
            <span style="width: 16px; height: 16px; margin-right: 10px; border-radius: 4px; border: 1px solid #777; background: #444444;" title="Polígonos sin información disponible"></span> Sin dato
        </div>
        
        <div style="margin-top:14px; font-weight:bold; color:#ddd; font-size: 13px; margin-bottom: 8px;">Infraestructura Industrial</div>
        
        <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 12px; color: #eee;">
            <span style="width: 16px; height: 16px; margin-right: 10px; border-radius: 50%; border: 2px solid white; background: #00e5ff;"></span> Planta Armadora
        </div>
    `;
    
    div.innerHTML = html;
    overlay.style.display = 'block';
}

function showSection(id) {
    document.querySelectorAll('.main-content-panel').forEach(p => p.style.display = 'none');
    var target = document.getElementById(id); if(target) target.style.display = 'block';
    var leftSidebar = document.getElementById('left-sidebar-container');
    var rightSidebar = document.getElementById('right-sidebar-container');
    if (id === 'inicio') {
        if(leftSidebar) leftSidebar.style.display = 'flex';
        if(rightSidebar) rightSidebar.style.display = 'flex';
        if(map) setTimeout(() => map.invalidateSize(), 200);
    } else {
        if(leftSidebar) leftSidebar.style.display = 'none';
        if(rightSidebar) rightSidebar.style.display = 'none';
    }
    document.querySelectorAll('.nav-button').forEach(n => {
        n.classList.remove('active');
        if(n.getAttribute('onclick') && n.getAttribute('onclick').includes(id)) n.classList.add('active');
    });
}

function toggleDropdown(id) {
    var content = document.getElementById(id);
    if (content) {
        content.classList.toggle('show');
        if (id === 'filter-buttons-container') {
            var arrow = document.getElementById('filter-arrow');
            if (arrow) {
                if (content.classList.contains('show')) {
                    arrow.style.transform = 'rotate(0deg)';
                } else {
                    arrow.style.transform = 'rotate(-90deg)';
                }
            }
        }
    }
}