// ==========================================
// 1. VARIABLES GLOBALES Y CONFIGURACIÓN
// ==========================================
var map;
var currentGeoJSONLayer = null; 
var armadorasLayer = null;      
var isocronasLayer = null;      
var agebLayer = null;           // <--- NUEVA CAPA PARA MUNICIPIO (AGEB)
var activeData = null;          

// Variables de Datos Crudos
var denueRawData = null;        
var armadorasRawData = null;
var isocronasRawData = null;
var agebRawData = null;         // <--- NUEVOS DATOS AGEB

var currentScaleType = '';      
var mainChart = null;           

// Paletas de Colores
const RampaRojos = ['#fee5d9','#fcae91','#fb6a4a','#de2d26','#a50f15'];
const Grosores = [1, 2, 4, 6, 8];

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initMap();
});

function initMap() {
    map = L.map('map', {
        minZoom: 2, maxZoom: 18, zoomControl: false
    }).setView([23.6345, -102.5528], 5);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    setupUI();
    cargarArmadorasContexto();
    showSection('inicio');
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

    var legendContent = document.getElementById('legend-content');
    if(legendContent) legendContent.innerHTML = "<small style='color:#aaa'>Cargando datos...</small>";

    currentScaleType = scaleType;
    var filename = "";
    var zoomCoords = [];
    var zoomLevel = 5;

    var filterBox = document.getElementById('filter-container-box');
    
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
// 4. LÓGICA MUNDIAL & NACIONAL
// ==========================================
function iniciarFiltroMundial_Paso1(data) {
    document.getElementById('filter-title').innerText = "1. Seleccione Industria";
    var opciones = [...new Set(data.features.map(f => f.properties.Industria))].sort();
    crearBotones(opciones, (sel) => iniciarFiltroMundial_Paso2(data, sel));
}

function iniciarFiltroMundial_Paso2(data, industriaSel) {
    document.getElementById('filter-title').innerText = "2. Seleccione Origen";
    var datosFiltrados = data.features.filter(f => f.properties.Industria === industriaSel);
    var origenes = [...new Set(datosFiltrados.map(f => f.properties.Pais_Orige))].sort();
    crearBotones(origenes, (origenSel) => {
        var finalData = datosFiltrados.filter(f => f.properties.Pais_Orige === origenSel);
        renderizarMapaFlujos(finalData, 'Valor', 'MDD', 'Pais_Desti');
    }, () => iniciarFiltroMundial_Paso1(data)); 
}

function iniciarFiltroNacional_Paso1(data) {
    document.getElementById('filter-title').innerText = "1. Seleccione Subsector";
    var opciones = [...new Set(data.features.map(f => f.properties.SUBSECTO_3 || f.properties.SUBSECTO_2))].sort();
    crearBotones(opciones, (sel) => iniciarFiltroNacional_Paso2(data, sel));
}

function iniciarFiltroNacional_Paso2(data, subsectorSel) {
    document.getElementById('filter-title').innerText = "2. Seleccione Estado Origen";
    var datosFiltrados = data.features.filter(f => (f.properties.SUBSECTO_3 === subsectorSel || f.properties.SUBSECTO_2 === subsectorSel));
    var origenes = [...new Set(datosFiltrados.map(f => f.properties.Edo_V))].sort();
    crearBotones(origenes, (origenSel) => {
        var finalData = datosFiltrados.filter(f => f.properties.Edo_V === origenSel);
        renderizarMapaFlujos(finalData, 'VALOR', 'MDP', 'EDO_C');
    }, () => iniciarFiltroNacional_Paso1(data));
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
    if (title) title.innerText = "Seleccione Estado";

    var estados = [...new Set(data.features.map(f => f.properties.NOMGEO || "Desconocido"))].sort();
    estados.forEach(estado => {
        if(!estado) return; 
        var btn = document.createElement("button");
        btn.className = "dynamic-filter-btn";
        btn.innerHTML = `<b>${estado}</b>`;
        btn.onclick = function() {
            document.querySelectorAll('.dynamic-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filtrarPorEstado(estado);
        };
        container.appendChild(btn);
    });
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

    // 1. Filtrar DENUE
    var denueEstado = denueRawData.features.filter(f => {
        var nom = f.properties.NOMGEO || f.properties.ENTIDAD || f.properties.ESTADO || ""; 
        return normalizarTexto(nom) === estadoBusqueda;
    });

    // 2. Filtrar ARMADORAS (¡CORRECCIÓN BAJA CALIFORNIA SUR!)
    var armadorasEstado = armadorasRawData.features.filter(f => {
        var estadoArmadora = normalizarTexto(f.properties.Estado || f.properties.ESTADO || f.properties.NOMGEO);
        // Si el usuario busca "BAJA CALIFORNIA", evitamos que coincida con "SUR"
        if (estadoBusqueda === "BAJA CALIFORNIA" && estadoArmadora.includes("SUR")) {
            return false;
        }
        return estadoArmadora === estadoBusqueda || estadoArmadora.includes(estadoBusqueda) || estadoBusqueda.includes(estadoArmadora);
    });

    // 3. Filtrar ISOCRONAS
    var isocronasRawList = isocronasRawData.features.filter(f => {
        var est = f.properties.NOMGEO || f.properties.Estado || f.properties.ESTADO || f.properties.ENTIDAD || f.properties.entidad || "";
        return normalizarTexto(est) === estadoBusqueda;
    });

    var isocronasEstado = procesarYUnirIsocronas(isocronasRawList);

    isocronasEstado.sort((a, b) => {
        return (b.properties.AA_MINS || 0) - (a.properties.AA_MINS || 0);
    });

    // A) ISOCRONAS (FONDO)
    if (isocronasLayer) map.removeLayer(isocronasLayer);
    if (isocronasEstado.length > 0) {
        isocronasLayer = L.geoJSON(isocronasEstado, {
            style: function(feature) {
                var mins = parseInt(feature.properties.AA_MINS || 0);
                var opacidadRelleno = 0.3; 
                if (mins <= 30) opacidadRelleno = 0.6; 
                if (mins <= 15) opacidadRelleno = 0.8; 

                return {
                    color: getColorIsocrona(mins),      
                    fillColor: getColorIsocrona(mins),  
                    weight: 1, opacity: 1, fillOpacity: opacidadRelleno,
                    className: 'sin-interaccion'
                };
            }
        }).addTo(map);
        isocronasLayer.bringToBack();
    }

    // B) DENUE (MEDIO)
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
    if (denueEstado.length > 0) {
        currentGeoJSONLayer = L.geoJSON(denueEstado, {
            pointToLayer: function (feature, latlng) {
                var sector = feature.properties.Conjunto || "Otros";
                if(sector === "Actividades SEIT") sector = "Servicios SEIT";
                return L.circleMarker(latlng, {
                    radius: 5, fillColor: getColorConjunto(sector), 
                    color: "#ffffff", weight: 0.8, opacity: 1, fillOpacity: 0.9
                });
            },
            onEachFeature: function(feature, layer) {
                var empresa = feature.properties.Nombre || feature.properties.Empresa;
                var sector = feature.properties.Conjunto;
                layer.bindPopup(`<b>${empresa}</b><br><small>${sector}</small>`);
            }
        }).addTo(map);
    }

    // C) ARMADORAS (ARRIBA)
    dibujarArmadorasPuntos(armadorasEstado);

    try {
        if (armadorasEstado.length > 0) {
            var latlngs = armadorasEstado.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
            map.flyToBounds(latlngs, { padding: [100, 100], duration: 1.5, maxZoom: 11 });
        } else if (isocronasEstado.length > 0) {
            map.flyToBounds(isocronasLayer.getBounds(), { padding: [50, 50] });
        } else if (currentGeoJSONLayer && denueEstado.length > 0) {
            map.flyToBounds(currentGeoJSONLayer.getBounds(), { padding: [50, 50] });
        }
    } catch (e) { console.error("Error zoom:", e); }

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
// 6. LÓGICA MUNICIPIO (AGEB) - DOS PASOS + ARMADORAS
// ==========================================

// PASO 1: Menú para elegir Estado (Optimizado para múltiples estados)
function iniciarLogicaMunicipio() {
    // Limpiamos capas previas al entrar o al regresar al menú
    if (agebLayer) { map.removeLayer(agebLayer); agebLayer = null; }
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; } 
    agebRawData = null; 
    
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";
    document.getElementById('filter-title').innerText = "1. Seleccione Estado";

    // --- LISTA MAESTRA DE ESTADOS Y SUS ARCHIVOS ---
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

    // Generar los botones automáticamente usando la lista
    estadosAgeb.forEach(estado => {
        var btn = document.createElement("button");
        btn.className = "dynamic-filter-btn";
        btn.innerHTML = `<b>${estado.nombre}</b>`;
        btn.onclick = function() {
            // Al hacer clic, carga el archivo correspondiente a ese estado
            cargarAgebEstado(estado.nombre, estado.archivo);
        };
        container.appendChild(btn);
    });
    
    var legendContent = document.getElementById('legend-content');
    if(legendContent) legendContent.innerHTML = "<small>Seleccione un estado primero</small>";
}

// PASO 2: Descargar archivo AGEB + Armadoras
function cargarAgebEstado(nombreEstado, archivoGeojson) {
    document.getElementById('filter-title').innerText = "Cargando " + nombreEstado + "...";
    document.getElementById('filter-buttons-container').innerHTML = "<p style='color:#00e5ff; padding:10px; font-weight:bold;'>Descargando datos espaciales, por favor espere...</p>";

    // Descargar AMBOS archivos al mismo tiempo
    Promise.all([
        fetch(archivoGeojson).then(r => r.json()),
        fetch('armadoras.geojson').then(r => r.json())
    ])
    .then(([agebData, armadorasData]) => {
        agebRawData = agebData; 
        armadorasRawData = armadorasData; // Guardamos las armadoras globalmente

        // --- FILTRAR Y DIBUJAR ARMADORAS ---
        var estadoBusqueda = normalizarTexto(nombreEstado);
        var armadorasFiltradas = armadorasRawData.features.filter(f => {
            var estadoArmadora = normalizarTexto(f.properties.Estado || f.properties.ESTADO || f.properties.NOMGEO);
            // Prevenir bug de Baja California Sur
            if (estadoBusqueda === "BAJA CALIFORNIA" && estadoArmadora.includes("SUR")) return false;
            return estadoArmadora === estadoBusqueda || estadoArmadora.includes(estadoBusqueda) || estadoBusqueda.includes(estadoArmadora);
        });

        dibujarArmadorasPuntos(armadorasFiltradas); // Función que ya teníamos, dibuja los puntos cyan

        // --- ZOOM A LOS AGEB ---
        var bounds = L.geoJSON(agebData).getBounds();
        map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });

        // Mostrar menú de vulnerabilidad
        mostrarFiltrosIndices(nombreEstado);
    })
    .catch(err => {
        console.error("Error cargando capas:", err);
        document.getElementById('filter-title').innerText = "Error de Carga";
        document.getElementById('filter-buttons-container').innerHTML = `<p style='color:#ff3333;'>No se pudieron cargar los datos de <b>${nombreEstado}</b>.</p>`;
    });
}

// PASO 3: Menú de los 4 índices de Vulnerabilidad
function mostrarFiltrosIndices(nombreEstado) {
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";
    document.getElementById('filter-title').innerText = `2. Índice (${nombreEstado})`;

    var btnBack = document.createElement("button");
    btnBack.innerText = "⬅ Cambiar Estado";
    btnBack.className = "back-btn";
    btnBack.onclick = iniciarLogicaMunicipio;
    container.appendChild(btnBack);

    var opcionesAgeb = [
        { id: 'g_espacial', label: 'Vulnerabilidad en Hogar' },
        { id: 'g_urbano', label: 'Deficiencias en Infraestructura' },
        { id: 'g_socioeco', label: 'Sin Oportunidades' },
        { id: 'G_INDICE', label: 'Índice de Vulnerabilidad Global' }
    ];

    opcionesAgeb.forEach((opc, index) => {
        var btn = document.createElement("button");
        btn.className = "dynamic-filter-btn" + (index === 3 ? " active" : "");
        btn.innerText = opc.label;
        btn.onclick = function() {
            document.querySelectorAll('#filter-buttons-container .dynamic-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderizarMapaAgeb(opc.id, opc.label);
        };
        container.appendChild(btn);
    });

    renderizarMapaAgeb('G_INDICE', 'Índice de Vulnerabilidad Global');
}

// Función auxiliar de colores
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

// Dibuja los polígonos AGEB
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

    // --- ¡TRUCO DE ORDEN DE CAPAS! ---
    // Mandamos los polígonos de calor al fondo, para que las armadoras queden encima y no se tapen
    agebLayer.bringToBack(); 
    if (armadorasLayer) armadorasLayer.bringToFront();

    actualizarLeyendaAgebCategorica(labelNombre);
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
// PASO 3: Menú de los 4 índices de Vulnerabilidad
function mostrarFiltrosIndices(nombreEstado) {
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";
    document.getElementById('filter-title').innerText = `2. Índice (${nombreEstado})`;

    // Botón para regresar a seleccionar otro estado
    var btnBack = document.createElement("button");
    btnBack.innerText = "⬅ Cambiar Estado";
    btnBack.className = "back-btn";
    btnBack.onclick = iniciarLogicaMunicipio;
    container.appendChild(btnBack);

    var opcionesAgeb = [
        { id: 'g_espacial', label: 'Vulnerabilidad en Hogar' },
        { id: 'g_urbano', label: 'Deficiencias en Infraestructura' },
        { id: 'g_socioeco', label: 'Sin Oportunidades' },
        { id: 'G_INDICE', label: 'Índice de Vulnerabilidad Global' }
    ];

    opcionesAgeb.forEach((opc, index) => {
        var btn = document.createElement("button");
        btn.className = "dynamic-filter-btn" + (index === 3 ? " active" : "");
        btn.innerText = opc.label;
        btn.onclick = function() {
            document.querySelectorAll('#filter-buttons-container .dynamic-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderizarMapaAgeb(opc.id, opc.label);
        };
        container.appendChild(btn);
    });

    // Pintar el mapa con el índice general (G_INDICE) por defecto
    renderizarMapaAgeb('G_INDICE', 'Índice de Vulnerabilidad Global');
}

// Función auxiliar de colores
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

// Dibuja los polígonos AGEB
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

    actualizarLeyendaAgebCategorica(labelNombre);
}


// Función auxiliar para obtener color por texto
function getColorVulnerabilidad(valorTexto) {
    if (!valorTexto) return '#333333'; // Gris oscuro para vacíos
    
    var v = valorTexto.toString().trim().toUpperCase();
    
    // Paleta de colores para vulnerabilidad (Rojos/Naranjas)
    if (v === 'MUY ALTO') return '#a50f15'; // Rojo muy oscuro
    if (v === 'ALTO') return '#de2d26';     // Rojo intenso
    if (v === 'MEDIO') return '#fb6a4a';    // Naranja
    if (v === 'BAJO') return '#fcae91';     // Salmón claro
    if (v === 'MUY BAJO') return '#fee5d9'; // Casi blanco/crema
    
    return '#444444'; // Gris si dice "Sin dato" u otro valor
}

function renderizarMapaAgeb(atributo, labelNombre) {
    if (agebLayer) map.removeLayer(agebLayer);

    agebLayer = L.geoJSON(agebRawData, {
        style: function(feature) {
            // Obtenemos el texto exacto (ej. "Bajo", "Alto")
            var valorCategoria = feature.properties[atributo] || "Sin dato";
            
            return {
                color: "#111",           // Borde del AGEB (negro)
                weight: 0.5,             // Borde muy fino
                fillColor: getColorVulnerabilidad(valorCategoria), // Color según la categoría
                fillOpacity: 0.8,        // Opacidad alta para que se vea el calor
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
            
            // Hover (Se pone blanco al pasar el mouse)
            layer.on({
                mouseover: function(e) { 
                    e.target.setStyle({ weight: 2, color: '#fff' }); 
                    e.target.bringToFront(); 
                },
                mouseout: function(e) { agebLayer.resetStyle(e.target); }
            });
        }
    }).addTo(map);

    actualizarLeyendaAgebCategorica(labelNombre);
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

    currentGeoJSONLayer = L.geoJSON(validFeatures, {
        style: function(feature) {
            var val = feature.properties[campoValor];
            var clase = getClase(val, breaks);
            return { color: RampaRojos[clase], weight: Grosores[clase], opacity: 0.9, className: 'flujo-interactivo' };
        },
        onEachFeature: function(feature, layer) {
            var p = feature.properties;
            var valFormatted = (p[campoValor] || 0).toLocaleString(); 
            var popupContent = `
                <div style="font-family:'Noto Sans'; font-size:13px;">
                    <strong style="color:#de2d26; font-size:14px;">${p[campoDestino]}</strong><br>
                    <hr style="border:0; border-top:1px solid #555; margin:5px 0;">
                    Valor: <b style="color:#fff">$${valFormatted}</b> <small>${etiquetaMoneda}</small>
                </div>
            `;
            layer.bindPopup(popupContent);
            layer.on({
                mouseover: function(e) { e.target.setStyle({ weight: 10, color: '#ffff00' }); e.target.bringToFront(); },
                mouseout: function(e) { currentGeoJSONLayer.resetStyle(e.target); }
            });
        }
    }).addTo(map);

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

        var scaleBox = document.createElement('div');
        scaleBox.className = 'dashboard-box';
        scaleBox.innerHTML = `
            <h4 class="panel-title toggleable" onclick="toggleDropdown('escala-dropdown')">Escalas de Análisis <span>▼</span></h4>
            <div id="escala-dropdown" class="dropdown-content">
                <button onclick="loadLayer('mundial')" class="scale-btn" id="btn-mundial">🌎 Escala Mundial</button>
                <button onclick="loadLayer('nacional')" class="scale-btn" id="btn-nacional">🇲🇽 Escala Nacional</button>
                <button onclick="loadLayer('estatal')" class="scale-btn" id="btn-estatal">🏭 Estatal (Clústeres)</button>
                <button onclick="loadLayer('municipio')" class="scale-btn" id="btn-municipio">🏘️ Municipio (AGEB)</button>
            </div>
        `;
        leftContainer.appendChild(scaleBox);

        var filterBox = document.createElement('div');
        filterBox.id = 'filter-container-box';
        filterBox.className = 'dashboard-box';
        filterBox.innerHTML = `<h4 id="filter-title" class="panel-title">Filtros</h4><div id="filter-buttons-container"></div>`;
        leftContainer.appendChild(filterBox);
    }

    var rightContainer = document.getElementById('right-sidebar-container');
    if (!rightContainer) {
        rightContainer = document.createElement('div');
        rightContainer.id = 'right-sidebar-container';
        document.body.appendChild(rightContainer);

        var statsBox = document.createElement('div');
        statsBox.id = 'stats-overlay';
        statsBox.className = 'dashboard-box';
        statsBox.style.display = 'none';
        statsBox.innerHTML = `
            <h4 class="panel-title">Análisis de Datos</h4>
            <div style="height:180px; position:relative;"><canvas id="myChart"></canvas></div>
            <button onclick="descargarDatos()" class="download-btn">⬇ Descargar CSV</button>
            <button onclick="capturarImagen()" class="screenshot-btn">📸 Guardar Reporte (Img)</button>
        `;
        rightContainer.appendChild(statsBox);

        var legendBox = document.createElement('div');
        legendBox.id = 'legend-overlay';
        legendBox.className = 'dashboard-box';
        legendBox.style.display = 'none';
        legendBox.innerHTML = `<h4 class="panel-title">Simbología</h4><div id="legend-content"><small style="color:#aaa">Seleccione una escala</small></div>`;
        rightContainer.appendChild(legendBox);
    }
}

function crearBotones(lista, callback, backCallback) {
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";
    if(backCallback) {
        var btnBack = document.createElement("button");
        btnBack.innerText = "⬅ Volver"; btnBack.className = "back-btn"; btnBack.onclick = backCallback;
        container.appendChild(btnBack);
    }
    if(lista.length === 0) { container.innerHTML += "<p style='color:#aaa'>No hay datos.</p>"; return; }
    lista.forEach(item => {
        var btn = document.createElement("button");
        btn.innerText = item; btn.className = "dynamic-filter-btn";
        btn.onclick = function() {
             container.querySelectorAll('.dynamic-filter-btn').forEach(s => s.classList.remove('active'));
             this.classList.add('active'); callback(item);
        };
        container.appendChild(btn);
    });
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

    var labels = Object.keys(conteo);
    var dataValues = Object.values(conteo);
    var colores = labels.map(l => getColorConjunto(l));

    if (mainChart) mainChart.destroy();
    if(dataValues.length === 0) return;

    mainChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Empresas', data: dataValues, backgroundColor: colores, borderColor: '#333', borderWidth: 1 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid:{color:'#444'}, ticks:{color:'#aaa'} }, y: { ticks:{color:'#fff', font:{size:10}}, grid:{display:false} } } }
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
    
    let validFeatures = features.filter(f => f.properties[campoValor] != null && !isNaN(f.properties[campoValor]));
    let topData = [...validFeatures].sort((a, b) => b.properties[campoValor] - a.properties[campoValor]).slice(0, 5);
    
    let labels = topData.map(f => f.properties[campoEtiqueta]);
    let dataValues = topData.map(f => f.properties[campoValor]);

    if (mainChart) mainChart.destroy();
    mainChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: `Valor`, data: dataValues, backgroundColor: 'rgba(222, 45, 38, 0.8)', borderColor: '#a50f15', borderWidth: 1 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#aaa' }, grid: { color:'#444' } }, y: { ticks: { color: '#fff' }, grid: { display:false } } } }
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

function actualizarLeyenda(breaks, moneda) {
    var overlay = document.getElementById('legend-overlay');
    var div = document.getElementById('legend-content'); 
    if(!div || !overlay) return;
    
    // Función para formatear números con comas
    var f = (n) => (n || 0).toLocaleString('es-MX', {maximumFractionDigits: 0}); 
    
    // Extraemos el valor mínimo y máximo de tus cortes
    var valorMinimo = breaks[0];
    var valorMaximo = breaks[3];
    
    // Convertimos tu arreglo RampaRojos en una cadena separada por comas para el CSS
    var coloresCSS = RampaRojos.join(', ');
    
    // Construimos el HTML con un contenedor de gradiente (linear-gradient)
    var html = `
        <div style="margin-bottom:12px; font-weight:bold; color:#ddd; font-size:14px;">Valor (${moneda})</div>
        <div style="width: 100%; padding: 0 5px; box-sizing: border-box;">
            <div style="width: 100%; height: 18px; border-radius: 4px; border: 1px solid #555; background: linear-gradient(to right, ${coloresCSS});"></div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #ccc; font-weight: bold; margin-top: 8px;">
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
    }
}