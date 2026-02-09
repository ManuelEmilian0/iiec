// ==========================================
// 1. VARIABLES GLOBALES Y CONFIGURACIÓN
// ==========================================
var map;
var currentGeoJSONLayer = null; // Capa dinámica (Mundial/Nacional/Estatal)
var armadorasLayer = null;      // Capa de armadoras (Estatal)
var circleLayer = null;         // Capa del radio de 20km
var activeData = null;          // Almacena datos crudos
var currentScaleType = '';      // 'mundial', 'nacional', 'estatal'

// VARIABLES DE ANÁLISIS
var mainChart = null;           // <--- ESTA ES LA QUE FALTABA
var denueRawData = null;        // Datos del DENUE para Turf.js

// Paleta de colores (Rojos) y Grosores
const RampaRojos = ['#fee5d9','#fcae91','#fb6a4a','#de2d26','#a50f15'];
const Grosores = [1, 2, 4, 6, 8];

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initMap();
});

function initMap() {
    // 1. Configurar Mapa
    map = L.map('map', {
        minZoom: 2, maxZoom: 18, zoomControl: false
    }).setView([23.6345, -102.5528], 5);

    // Zoom abajo a la derecha
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Mapa base oscuro
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // 2. CONFIGURAR PANELES (Interfaz de Usuario)
    setupUI();
    
    // 3. CARGAR CAPA DE CONTEXTO (Puntos blancos tenues)
    cargarArmadorasContexto();

    // 4. INICIALIZAR VISIBILIDAD (¡IMPORTANTE!)
    // Esto asegura que el mapa se vea y los paneles estén activos al cargar
    showSection('inicio');
}

// Función para reestructurar el HTML y crear el panel derecho unificado
// --- script.js ---

function setupRightPanel() {
    var containerId = 'right-sidebar-container';
    var container = document.getElementById(containerId);

    // 1. Si no existe el contenedor derecho, LO CREAMOS
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container); // <--- Aquí se corrige el error "null"
    }

    // 2. Mover el DASHBOARD (Escalas) al panel derecho
    var dashboard = document.getElementById('dashboard-overlay');
    if (dashboard) {
        // Lo movemos dentro del contenedor derecho
        container.appendChild(dashboard);
        dashboard.style.display = 'block'; // Aseguramos que se vea
    } else {
        console.warn("Aviso: No se encontró el elemento dashboard-overlay en el HTML");
    }

    // 3. Crear/Mover el Panel de ESTADÍSTICAS (Gráfica)
    var statsDiv = document.getElementById('stats-overlay');
    if (!statsDiv) {
        statsDiv = document.createElement('div');
        statsDiv.id = 'stats-overlay';
        statsDiv.style.display = 'none'; // Oculto al inicio hasta que haya datos
        statsDiv.innerHTML = `
            <h4 style="margin:0 0 10px 0; color:#fcae91; border-bottom:1px solid #555; font-size:14px;">Top 5 Destinos</h4>
            <div style="height:160px; position:relative;">
                <canvas id="myChart"></canvas>
            </div>
        `;
        container.appendChild(statsDiv);
    }

    // 4. Mover la LEYENDA al final
    var legend = document.getElementById('legend-overlay');
    if (legend) {
        container.appendChild(legend);
    } else {
        // Si no existe la creamos
        legend = document.createElement('div');
        legend.id = 'legend-overlay';
        legend.innerHTML = '<h4>Simbología</h4><div id="legend-content"><small>Seleccione una escala</small></div>';
        container.appendChild(legend);
    }
}

// Carga Armadoras como fondo fijo (Puntos blancos tenues)
function cargarArmadorasContexto() {
    fetch('armadoras.geojson')
        .then(r => r.json())
        .then(data => {
            armadorasLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 2, fillColor: "#fff", color: "#fff", weight: 0, opacity: 0.3, fillOpacity: 0.3
                    });
                }
            }).addTo(map);
        })
        .catch(e => console.log("Fondo armadoras no encontrado (revisa el nombre del archivo .geojson)"));
}

// ==========================================
// 3. CONTROLADOR DE CAPAS (LOAD LAYER)
// ==========================================
function loadLayer(scaleType) {
    // 1. Gestionar estilo de botones activos
    document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
    var activeBtn = document.getElementById('btn-' + scaleType);
    if(activeBtn) activeBtn.classList.add('active');

    // 2. LIMPIEZA PROFUNDA (¡ESTO ES LO NUEVO!)
    // Antes de cargar nada, borramos TODAS las capas posibles para que no se encimen
    if (currentGeoJSONLayer) { 
        map.removeLayer(currentGeoJSONLayer); 
        currentGeoJSONLayer = null; 
    }
    if (armadorasLayer) { 
        map.removeLayer(armadorasLayer); 
        armadorasLayer = null; // Importante resetear la variable
    }
    if (circleLayer) { 
        map.removeLayer(circleLayer); 
        circleLayer = null; 
    }
    
    // Ocultar gráfica anterior
    var statsDiv = document.getElementById('stats-overlay');
    if(statsDiv) statsDiv.style.display = 'none';

    // Resetear leyenda
    var legendContent = document.getElementById('legend-content');
    if(legendContent) legendContent.innerHTML = "<small style='color:#aaa'>Cargando datos...</small>";

    currentScaleType = scaleType;
    var filename = "";
    var zoomCoords = [];
    var zoomLevel = 5;

    // 3. Configuración según la escala seleccionada
    var filterBox = document.getElementById('filter-container-box');
    var statusText = document.getElementById('layer-status'); // Si tienes este elemento
    
    // CASO A: ESTATAL (CLÚSTERES)
    if (scaleType === 'estatal') {
        // Mostramos el panel de filtros (Lista de Armadoras)
        if(filterBox) {
            filterBox.style.display = 'flex';
            document.getElementById('filter-buttons-container').innerHTML = ""; // Limpiar lista anterior
            document.getElementById('filter-title').innerText = "Cargando...";
        }
        
        // Iniciamos la lógica especial
        iniciarLogicaEstatal(); 
        return; // Salimos aquí porque 'estatal' tiene su propio flujo de carga
    }

    // CASO B: MUNDIAL O NACIONAL (FLUJOS)
    if (scaleType === 'mundial') {
        filename = "mundial.geojson";
        zoomCoords = [20, 0]; zoomLevel = 2;
        if(filterBox) filterBox.style.display = 'flex';
        
    } else if (scaleType === 'nacional') {
        filename = "nacional.geojson";
        zoomCoords = [23.6345, -102.5528]; zoomLevel = 5;
        if(filterBox) filterBox.style.display = 'flex';
    }

    // Cargar datos (Fetch estándar)
    fetch(filename)
        .then(response => response.json())
        .then(data => {
            activeData = data; 
            map.flyTo(zoomCoords, zoomLevel, { duration: 1.5 });

            // Iniciar filtros correspondientes
            if (scaleType === 'mundial') {
                iniciarFiltroMundial_Paso1(data);
            } else if (scaleType === 'nacional') {
                iniciarFiltroNacional_Paso1(data);
            }
        })
        .catch(error => console.error("Error cargando datos: " + error));
}

// ==========================================
// 4. LÓGICA MUNDIAL (Industria -> Pais_Orige -> Mapa MDD)
// ==========================================
function iniciarFiltroMundial_Paso1(data) {
    document.getElementById('filter-title').innerText = "1. Seleccione Industria";
    var opciones = [...new Set(data.features.map(f => f.properties.Industria))].sort();
    
    crearBotones(opciones, (industriaSel) => {
        iniciarFiltroMundial_Paso2(data, industriaSel);
    });
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

// ==========================================
// 5. LÓGICA NACIONAL (Subsector -> Edo_V -> Mapa MDP)
// ==========================================
function iniciarFiltroNacional_Paso1(data) {
    document.getElementById('filter-title').innerText = "1. Seleccione Subsector";
    var opciones = [...new Set(data.features.map(f => f.properties.SUBSECTO_3 || f.properties.SUBSECTO_2))].sort();
    
    crearBotones(opciones, (subsectorSel) => {
        iniciarFiltroNacional_Paso2(data, subsectorSel);
    });
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
// 6. LÓGICA ESTATAL (CORREGIDA Y BLINDADA)
// ==========================================

var armadorasRawData = null; 

function iniciarLogicaEstatal() {
    // 1. Limpieza de capas previas
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
    if (armadorasLayer) map.removeLayer(armadorasLayer);
    if (circleLayer) map.removeLayer(circleLayer);
    
    // Ocultar gráfica anterior
    var statsDiv = document.getElementById('stats-overlay');
    if(statsDiv) statsDiv.style.display = 'none';

    // 2. Cargar Datos
    Promise.all([
        fetch('denue.geojson').then(r => r.json()),
        fetch('armadoras.geojson').then(r => r.json())
    ]).then(([denueData, armadorasData]) => {
        
        denueRawData = denueData;
        armadorasRawData = armadorasData;

        // 3. Generar Menú
        generarMenuEstados(denueData);

        // Mensaje inicial
        var legendContent = document.getElementById('legend-content');
        if(legendContent) legendContent.innerHTML = "<small>Seleccione un Estado de la lista</small>";
        
        // Vista general
        map.flyTo([23.6345, -102.5528], 5);
    })
    .catch(err => console.error("Error cargando datos estatales:", err));
}

function generarMenuEstados(data) {
    var container = document.getElementById('filter-buttons-container');
    var title = document.getElementById('filter-title');
    
    if (container) container.innerHTML = "";
    if (title) title.innerText = "Seleccione Estado";

    // Extraer nombres únicos
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

// Función auxiliar local para evitar conflictos
function limpiarTexto(texto) {
    if (!texto) return "";
    return texto.toString().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function filtrarPorEstado(nombreEstado) {
    console.log("Filtrando estado:", nombreEstado);
    var estadoBusqueda = limpiarTexto(nombreEstado);

    // 1. Filtrar DENUE
    var denueEstado = denueRawData.features.filter(f => {
        var p = f.properties;
        var nom = p.NOMGEO || p.ENTIDAD || p.ESTADO || ""; 
        return limpiarTexto(nom) === estadoBusqueda;
    });

    // 2. Filtrar ARMADORAS
    var armadorasEstado = armadorasRawData.features.filter(f => {
        var p = f.properties;
        var estadoArmadora = limpiarTexto(p.Estado || p.ESTADO || p.NOMGEO);
        return estadoArmadora.includes(estadoBusqueda) || estadoBusqueda.includes(estadoArmadora);
    });

    console.log(`Encontrados -> Denue: ${denueEstado.length}, Armadoras: ${armadorasEstado.length}`);

    // 3. Dibujar DENUE (Puntos de colores)
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);

    if (denueEstado.length > 0) {
        currentGeoJSONLayer = L.geoJSON(denueEstado, {
            pointToLayer: function (feature, latlng) {
                var sector = feature.properties.Conjunto || "Otros";
                if(sector === "Actividades SEIT") sector = "Servicios SEIT";
                
                return L.circleMarker(latlng, {
                    radius: 5, 
                    fillColor: getColorConjunto(sector), 
                    color: "#222", weight: 1, opacity: 1, fillOpacity: 0.9
                });
            },
            onEachFeature: function(feature, layer) {
                var empresa = feature.properties.Nombre || feature.properties.Empresa || "Empresa";
                var sector = feature.properties.Conjunto;
                layer.bindPopup(`<b>${empresa}</b><br><small>${sector}</small>`);
            }
        }).addTo(map);
    } else {
        alert("No se encontraron empresas para: " + nombreEstado);
    }

    // 4. Dibujar RED (Araña)
    // Esto se llama DESPUÉS de dibujar el DENUE para que las líneas tengan a dónde conectarse
    dibujarArmadorasConRadio(armadorasEstado);

    // 5. Zoom Inteligente (Corregido)
    try {
        if (armadorasEstado.length > 0) {
            // Prioridad: Zoom a las armadoras
            var latlngs = [];
            armadorasEstado.forEach(f => {
                if(f.geometry && f.geometry.coordinates) {
                    latlngs.push([f.geometry.coordinates[1], f.geometry.coordinates[0]]);
                }
            });
            if (latlngs.length > 0) {
                map.flyToBounds(latlngs, { padding: [100, 100], duration: 1.5, maxZoom: 11 });
            }
        } else if (currentGeoJSONLayer && denueEstado.length > 0) {
            // Si no hay armadoras, zoom a todo el estado (usando la capa ya dibujada)
            map.flyToBounds(currentGeoJSONLayer.getBounds(), { padding: [50, 50], duration: 1.5 });
        }
    } catch (e) { console.error("Error zoom:", e); }

    // 6. Actualizar Panel
    actualizarPanelEstatal(nombreEstado, denueEstado, armadorasEstado);
}

// ==========================================
// FUNCIÓN DE RED DE ARAÑA (CON DIAGNÓSTICO)
// ==========================================
function dibujarArmadorasConRadio(features) {
    console.log("--- Iniciando Red Araña ---");
    
    // 1. Limpiar capas previas
    if (armadorasLayer) { map.removeLayer(armadorasLayer); armadorasLayer = null; }
    if (circleLayer) { map.removeLayer(circleLayer); circleLayer = null; }

    // Validación inicial
    if (!features || features.length === 0) {
        console.log("No hay armadoras para dibujar.");
        return;
    }

    var capasFondo = [];
    var contadorLineas = 0;

    // 2. Recorrer cada Armadora
    features.forEach(f => {
        // Aseguramos que sean números (parseFloat)
        var lat = parseFloat(f.geometry.coordinates[1]);
        var lng = parseFloat(f.geometry.coordinates[0]);
        
        // Si las coordenadas no sirven, saltamos
        if (isNaN(lat) || isNaN(lng)) return;

        var coordsArmadora = [lat, lng];

        // 3. Conectar con Proveedores (DENUE)
        if (currentGeoJSONLayer) {
            currentGeoJSONLayer.eachLayer(layerDenue => {
                
                // A) BLINDAJE: ¿Es un marcador válido?
                if (typeof layerDenue.getLatLng !== 'function') {
                    return; 
                }

                // B) Extracción segura de coordenadas del proveedor
                var latD = parseFloat(layerDenue.getLatLng().lat);
                var lngD = parseFloat(layerDenue.getLatLng().lng);

                if (isNaN(latD) || isNaN(lngD)) return;

                // C) Obtener color (Si falla, usa blanco visible para probar)
                var colorLinea = '#888'; 
                if(layerDenue.options && layerDenue.options.fillColor) {
                    colorLinea = layerDenue.options.fillColor;
                }

                // D) Crear la línea
                var linea = L.polyline([coordsArmadora, [latD, lngD]], {
                    color: colorLinea,
                    weight: 0.5,        // Fina
                    opacity: 0.6,       // Visible
                    className: 'sin-interaccion', 
                    interactive: false
                });
                
                capasFondo.push(linea);
                contadorLineas++;
            });
        } else {
            console.warn("No existe currentGeoJSONLayer (DENUE) para conectar.");
        }
    });

    console.log(`Se generaron ${contadorLineas} líneas de conexión.`);

    // 4. Agregar líneas al mapa (AL FONDO)
    if (capasFondo.length > 0) {
        circleLayer = L.layerGroup(capasFondo).addTo(map);
        circleLayer.bringToBack(); 
    }

    // 5. Dibujar Armadoras (ENCIMA)
    armadorasLayer = L.geoJSON(features, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 12, 
                fillColor: "#00e5ff", 
                color: "#fff", 
                weight: 3, 
                opacity: 1, 
                fillOpacity: 1
            });
        },
        onEachFeature: function(feature, layer) {
            var nombre = feature.properties.NOMBRE || feature.properties.Nombre || "Planta";
            layer.bindTooltip(nombre, {
                permanent: true, 
                direction: 'top', 
                className: 'etiqueta-armadora', 
                offset: [0, -15]
            });
        }
    }).addTo(map);
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
            ? `<span style="color:#00e5ff; font-size:12px">🏭 Red de Proveeduría Activa</span>`
            : `<span style="color:#aaa; font-size:12px">Diagnóstico Estatal</span>`;

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
    
    // Validamos que exista la función de color, si no usamos gris
    var colores = labels.map(l => (typeof getColorConjunto === 'function') ? getColorConjunto(l) : '#888');

    if (mainChart) mainChart.destroy();
    
    if(dataValues.length === 0) return;

    mainChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Empresas', data: dataValues, backgroundColor: colores, borderColor: '#333', borderWidth: 1 }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid:{color:'#444'}, ticks:{color:'#aaa'} }, y: { ticks:{color:'#fff', font:{size:10}}, grid:{display:false} } }
        }
    });
}

// ==========================================
// 7. RENDERIZADO DE MAPAS
// ==========================================

function renderizarMapaFlujos(features, campoValor, etiquetaMoneda, campoDestino) {
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);

    // --- NUEVO: Actualizar la gráfica con los datos que estamos viendo ---
    actualizarGrafica(features, campoDestino, campoValor, etiquetaMoneda);

    var valores = features.map(f => f.properties[campoValor]).sort((a,b) => a - b);
    var breaks = calcularBreaks(valores);

    currentGeoJSONLayer = L.geoJSON(features, {
        style: function(feature) {
            var val = feature.properties[campoValor];
            var clase = getClase(val, breaks);
            return { 
                color: RampaRojos[clase], 
                weight: Grosores[clase], 
                opacity: 0.9,
                className: 'flujo-interactivo' // Clase para CSS si se necesita
            };
        },
        onEachFeature: function(feature, layer) {
            var p = feature.properties;
            
            // Popup mejorado con HTML más limpio
            var popupContent = `
                <div style="font-family:'Noto Sans'; font-size:13px;">
                    <strong style="color:#de2d26; font-size:14px;">${p[campoDestino]}</strong><br>
                    <hr style="border:0; border-top:1px solid #555; margin:5px 0;">
                    Valor: <b style="color:#fff">$${p[campoValor].toLocaleString()}</b> <small>${etiquetaMoneda}</small>
                </div>
            `;
            layer.bindPopup(popupContent);

            // --- NUEVO: Efectos de Hover (Interacción) ---
            layer.on({
                mouseover: function(e) {
                    var l = e.target;
                    l.setStyle({
                        weight: 10,  // Se hace más grueso
                        color: '#ffff00', // Se pone amarillo
                        opacity: 1
                    });
                    l.bringToFront(); // Se trae al frente
                },
                mouseout: function(e) {
                    currentGeoJSONLayer.resetStyle(e.target); // Vuelve a la normalidad
                }
            });
        }
    }).addTo(map);

    actualizarLeyenda(breaks, etiquetaMoneda);
}

// Renderizado de Puntos (Estatal)
function renderizarMapaPuntos(features) {
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);

    currentGeoJSONLayer = L.geoJSON(features, {
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 6,
                fillColor: "#ffff00", 
                color: "#333",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.9
            });
        },
        onEachFeature: function(feature, layer) {
            var p = feature.properties;
            var popup = `<b>Empresa:</b> ${p.Empresa}<br>
                         <b>Conjunto:</b> ${p.Conjunto}<br>
                         <b>Ensambla para:</b> ${p.Ensamblado}`;
            layer.bindPopup(popup);
        }
    }).addTo(map);
    
    // Leyenda simple para puntos (apuntando al nuevo panel)
    var legendDiv = document.getElementById('legend-content');
    if(legendDiv) {
        legendDiv.innerHTML = 
            `<div class="legend-item"><span class="legend-color" style="background:#ffff00; border-radius:50%"></span>Proveedores DENUE</div>
             <div class="legend-item"><span class="legend-color" style="background:#ffffff; border-radius:50%"></span>Todas las Armadoras</div>`;
    }
}

// ==========================================
// 8. UTILIDADES
// ==========================================

function crearBotones(lista, callback, backCallback) {
    var container = document.getElementById('filter-buttons-container');
    container.innerHTML = "";

    if(backCallback) {
        var btnBack = document.createElement("button");
        btnBack.innerText = "⬅ Volver / Cambiar Filtro";
        btnBack.className = "back-btn"; 
        btnBack.onclick = backCallback;
        container.appendChild(btnBack);
    }

    if(lista.length === 0) {
        container.innerHTML += "<p style='padding:10px; color:#aaa'>No hay datos disponibles.</p>";
        return;
    }

    lista.forEach(item => {
        var btn = document.createElement("button");
        btn.innerText = item;
        btn.className = "dynamic-filter-btn";
        btn.onclick = function() {
             var siblings = container.querySelectorAll('.dynamic-filter-btn');
             siblings.forEach(s => s.classList.remove('active'));
             this.classList.add('active');
             callback(item);
        };
        container.appendChild(btn);
    });
}

function calcularBreaks(valores) {
    if (!valores || valores.length === 0) return [0,0,0,0];
    if (valores.length < 5) return [valores[0], valores[0], valores[0], valores[0]];
    var step = Math.floor(valores.length / 5);
    return [valores[step], valores[step*2], valores[step*3], valores[step*4]];
}

function getClase(valor, breaks) {
    if (valor <= breaks[0]) return 0;
    if (valor <= breaks[1]) return 1;
    if (valor <= breaks[2]) return 2;
    if (valor <= breaks[3]) return 3;
    return 4;
}

function actualizarLeyenda(breaks, moneda) {
    var div = document.getElementById('legend-content');
    if(!div) return;

    var f = (n) => n.toLocaleString('es-MX', {maximumFractionDigits: 0});
    
    var html = `<div style="margin-bottom:8px; font-weight:bold; color:#ddd">Valor (${moneda})</div>`;
    html += `<div class="legend-item"><span class="legend-color" style="background:${RampaRojos[0]};"></span> &le; $${f(breaks[0])}</div>`;
    html += `<div class="legend-item"><span class="legend-color" style="background:${RampaRojos[1]};"></span> $${f(breaks[0])} - $${f(breaks[1])}</div>`;
    html += `<div class="legend-item"><span class="legend-color" style="background:${RampaRojos[2]};"></span> $${f(breaks[1])} - $${f(breaks[2])}</div>`;
    html += `<div class="legend-item"><span class="legend-color" style="background:${RampaRojos[3]};"></span> $${f(breaks[2])} - $${f(breaks[3])}</div>`;
    html += `<div class="legend-item"><span class="legend-color" style="background:${RampaRojos[4]};"></span> &gt; $${f(breaks[3])}</div>`;
    
    div.innerHTML = html;
}

// ==========================================
// CONTROL DE SECCIONES (TABS)
// ==========================================
function showSection(id) {
    // 1. Ocultar todos los paneles de contenido (Inicio, Marco, etc.)
    var panels = document.querySelectorAll('.main-content-panel');
    panels.forEach(p => p.style.display = 'none');
    
    // 2. Mostrar la sección seleccionada
    var target = document.getElementById(id);
    if(target) {
        target.style.display = 'block';
    }
    
    // 3. LÓGICA DE PANELES FLOTANTES (Solo visibles en 'inicio')
    var leftSidebar = document.getElementById('left-sidebar-container');
    var rightSidebar = document.getElementById('right-sidebar-container');
    
    if (id === 'inicio') {
        // Si estamos en el mapa, mostramos los controles
        if(leftSidebar) leftSidebar.style.display = 'flex';
        if(rightSidebar) rightSidebar.style.display = 'flex';
        
        // Recalcular tamaño del mapa para evitar gris
        if(map) setTimeout(() => map.invalidateSize(), 200);
    } else {
        // Si estamos en texto (Marco, Contacto), ocultamos los controles del mapa
        if(leftSidebar) leftSidebar.style.display = 'none';
        if(rightSidebar) rightSidebar.style.display = 'none';
    }

    // 4. Actualizar estado visual de los botones del menú superior
    var navs = document.querySelectorAll('.nav-button');
    navs.forEach(n => {
        n.classList.remove('active');
        // Si el botón llama a esta sección, lo activamos
        if(n.getAttribute('onclick') && n.getAttribute('onclick').includes(id)) {
            n.classList.add('active');
        }
    });
}

// ==========================================
// FIX: FUNCIONES DE INTERFAZ Y ERRORES
// ==========================================

// 1. Corrige el error "closeFilters is not defined"
function closeFilters() {
    var panel = document.getElementById('filter-panel');
    if (panel) {
        panel.style.display = 'none';
        
        // Opcional: Limpiar el mapa al cerrar filtros si lo deseas
        // if(currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
        // document.getElementById('legend-content').innerHTML = '<small>Filtros cerrados</small>';
    }
}

// ==========================================
// GRÁFICA DE BARRAS (Mundial/Nacional)
// ==========================================
function actualizarGrafica(features, campoEtiqueta, campoValor, etiquetaMoneda) {
    if (typeof Chart === 'undefined') return;

    // 1. Mostrar Panel y BUSCAR EL TÍTULO
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    var titulo = statsDiv.querySelector('.panel-title'); // Buscamos la clase del título
    
    // 2. ACTUALIZAR TÍTULO SEGÚN LA ESCALA
    if (titulo) {
        if (currentScaleType === 'mundial') {
            titulo.innerHTML = "Top 5 Intercambio Mundial<br><small style='color:#aaa; font-size:11px'>Millones de Dólares (MDD)</small>";
        } else if (currentScaleType === 'nacional') {
            titulo.innerHTML = "Top Intercambio por Estado<br><small style='color:#aaa; font-size:11px'>Millones de Pesos (MDP)</small>";
        } else {
            titulo.innerText = "Análisis de Datos";
        }
    }

    const canvas = document.getElementById('myChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 3. Procesar datos (Top 5)
    let topData = [...features]
        .sort((a, b) => b.properties[campoValor] - a.properties[campoValor])
        .slice(0, 5);

    let labels = topData.map(f => f.properties[campoEtiqueta]);
    let dataValues = topData.map(f => f.properties[campoValor]);

    // 4. Crear Gráfica
    if (mainChart) mainChart.destroy();

    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Valor`,
                data: dataValues,
                backgroundColor: 'rgba(222, 45, 38, 0.8)',
                borderColor: '#a50f15',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#aaa', font:{size:10} }, grid: { color:'#444' } },
                y: { ticks: { color: '#fff', font:{size:11} }, grid: { display:false } }
            }
        }
    });
}

// ==========================================
// CONFIGURACIÓN DE LA INTERFAZ (UI) - VERSIÓN FINAL
// ==========================================
function setupUI() {
    // --- 1. PANEL IZQUIERDO: CONTROLES ---
    var leftContainer = document.getElementById('left-sidebar-container');
    if (!leftContainer) {
        leftContainer = document.createElement('div');
        leftContainer.id = 'left-sidebar-container';
        document.body.appendChild(leftContainer);

        // A) SELECTOR DE ESCALAS
        var scaleBox = document.createElement('div');
        scaleBox.className = 'dashboard-box';
        scaleBox.innerHTML = `
            <h4 class="panel-title">Escalas de Análisis</h4>
            <button onclick="loadLayer('mundial')" class="scale-btn" id="btn-mundial">🌎 Escala Mundial</button>
            <button onclick="loadLayer('nacional')" class="scale-btn" id="btn-nacional">🇲🇽 Escala Nacional</button>
            <button onclick="loadLayer('estatal')" class="scale-btn" id="btn-estatal">🏭 Estatal (Clústeres)</button>
        `;
        leftContainer.appendChild(scaleBox);

        // B) FILTROS
        var filterBox = document.createElement('div');
        filterBox.id = 'filter-container-box';
        filterBox.className = 'dashboard-box';
        filterBox.innerHTML = `
            <h4 id="filter-title" class="panel-title">Filtros</h4>
            <div id="filter-buttons-container"></div>
        `;
        leftContainer.appendChild(filterBox);
    }

    // --- 2. PANEL DERECHO: RESULTADOS ---
    var rightContainer = document.getElementById('right-sidebar-container');
    if (!rightContainer) {
        rightContainer = document.createElement('div');
        rightContainer.id = 'right-sidebar-container';
        document.body.appendChild(rightContainer);

        // A) GRÁFICA + DESCARGA + FOTO (Todo en una caja)
        var statsBox = document.createElement('div');
        statsBox.id = 'stats-overlay';
        statsBox.className = 'dashboard-box';
        statsBox.style.display = 'none'; // Se oculta si no hay datos
        statsBox.innerHTML = `
            <h4 class="panel-title">Análisis de Datos</h4>
            
            <div style="height:180px; position:relative;">
                <canvas id="myChart"></canvas>
            </div>
            
            <button onclick="descargarDatos()" class="download-btn">⬇ Descargar CSV</button>
            
            <button onclick="capturarImagen()" class="screenshot-btn">📸 Guardar Reporte (Img)</button>
        `;
        rightContainer.appendChild(statsBox);

        // B) SIMBOLOGÍA (¡AQUÍ ESTÁ LA PARTE QUE FALTABA!)
        var legendBox = document.createElement('div');
        legendBox.id = 'legend-overlay';
        legendBox.className = 'dashboard-box';
        legendBox.innerHTML = `
             <h4 class="panel-title">Simbología</h4>
             <div id="legend-content"><small style="color:#aaa">Seleccione una escala</small></div>
        `;
        rightContainer.appendChild(legendBox);
    }
}

// ==========================================
// FUNCIÓN DE DESCARGA INTELIGENTE
// ==========================================
function descargarDatos() {
    // Verificar si hay gráfica
    if (!mainChart || !mainChart.data || mainChart.data.labels.length === 0) {
        alert("No hay datos visibles para descargar.");
        return;
    }

    let rows = [];
    let filename = "datos.csv";

    // CASO A: ESTATAL (Gráfica de Dona)
    if (currentScaleType === 'estatal') {
        filename = "Analisis_Cluster_20km.csv";
        rows.push(["Sector Industrial", "Cantidad de Proveedores"]); 
    } 
    // CASO B: MUNDIAL/NACIONAL (Gráfica de Barras)
    else {
        filename = `Top5_${currentScaleType.toUpperCase()}.csv`;
        rows.push(["Destino/Origen", "Valor Económico"]);
    }

    // Extraer datos de la gráfica actual
    let labels = mainChart.data.labels;
    let values = mainChart.data.datasets[0].data;

    labels.forEach((label, i) => {
        // Limpiamos comas para no romper el CSV
        let cleanLabel = String(label).replace(/,/g, " "); 
        rows.push([cleanLabel, values[i]]);
    });

    // Generar link de descarga
    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    let encodedUri = encodeURI(csvContent);
    
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// GRÁFICA DE DONA (CLÚSTER ESTATAL)
// ==========================================
function actualizarGraficaCluster(nombreArmadora, conteoObj) {
    var statsDiv = document.getElementById('stats-overlay');
    if (statsDiv) statsDiv.style.display = 'block';

    // 1. ACTUALIZAR TÍTULO (Ahora dinámico)
    var titulo = statsDiv.querySelector('.panel-title');
    if(titulo) {
        titulo.innerHTML = `Prov. a 20km de:<br><span style="color:#00e5ff">${nombreArmadora}</span>`;
    }

    var canvas = document.getElementById('myChart');
    if (!canvas) return;

    // 2. Procesar datos
    var labels = Object.keys(conteoObj);
    var data = Object.values(conteoObj);
    
    // Usamos la función de colores que definimos antes
    var backgroundColors = labels.map(label => getColorConjunto(label));

    // 3. Crear Gráfica de Dona
    if (mainChart) mainChart.destroy();

    mainChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderColor: '#222',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#ddd', boxWidth: 10, font: {size: 11} } }
            }
        }
    });
}

// ==========================================
// AUXILIAR: COLORES POR SECTOR (Por si se borró también)
// ==========================================
function getColorConjunto(conjunto) {
    const c = (conjunto || '').toString().trim();
    if (c.includes('Automo')) return '#FF6384';
    if (c.includes('Electrónica')) return '#36A2EB';
    if (c.includes('Eléctrica')) return '#FFCE56';
    // Agregar el nuevo nombre
    if (c.includes('SEIT') || c.includes('Servicios')) return '#4BC0C0'; 
    // ... resto de colores
    return '#888888';
}

// ==========================================
// FUNCIÓN DE CAPTURA DE PANTALLA (FOTO)
// ==========================================
function capturarImagen() {
    // 1. Ocultar elementos que no queremos en la foto (Opcional)
    // Por ejemplo, ocultamos la barra de navegación para que se vea más "mapa"
    var navBar = document.getElementById('nav-bar');
    if(navBar) navBar.style.display = 'none';

    // 2. Ejecutar la captura
    // Capturamos el body entero para que salga todo lo visible
    html2canvas(document.body, {
        useCORS: true,       // VITAL: Permite capturar las imágenes del mapa (CartoDB)
        allowTaint: true,    // Permite "manchar" el canvas con imágenes externas
        scrollY: -window.scrollY // Corrige desplazamientos si los hay
    }).then(canvas => {
        // 3. Crear enlace de descarga
        var link = document.createElement('a');
        // Nombre del archivo con fecha/hora para que no se repita
        var timestamp = new Date().toISOString().slice(0,19).replace(/:/g,"-");
        link.download = `Reporte_Industrial_${timestamp}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();

        // 4. Restaurar la interfaz (Volver a mostrar lo que ocultamos)
        if(navBar) navBar.style.display = 'flex';
        alert("¡Reporte guardado como imagen!");
    }).catch(err => {
        console.error("Error al capturar:", err);
        if(navBar) navBar.style.display = 'flex'; // Restaurar si falla
        alert("Hubo un error al generar la imagen. Revisa la consola.");
    });
}

// ==========================================
// AUXILIAR: FORMATEAR NÚMEROS (Ej: 1,200)
// ==========================================
function formatearNumero(valor) {
    if (valor === undefined || valor === null) return "0";
    return new Intl.NumberFormat('es-MX', { 
        maximumFractionDigits: 0 
    }).format(valor);
}
