// ============================================================================
// VISOR INSTITUCIONAL — cruce calculado de indicadores por entidad
// ============================================================================
// Pantalla nueva, separada del visor público, disponible solo con sesión
// iniciada (ver showSection('institucional') en escala_global.js, gateado
// por sessionStorage 'geodash_role' de auth.js). Primera versión: cruza
// "Índice de crecimiento compuesto" (Tablas/IC_<industria>.csv) con
// "Población titulada" (Tablas/Indice_superior_temporal.csv), ambos por
// entidad federativa, en una coropleta bivariada 2x2 (mediana de cada
// variable define Alto/Bajo) — no son dos geometrías distintas que se
// solapan espacialmente, así que el "cruce calculado" es una clasificación
// combinada por entidad, no una intersección de polígonos.

var mapInstitucional = null;
var institucionalLayer = null;
window._institucionalIndiceCache = {}; // "INDUSTRIA_ANIO" -> {estado: valor}
window._institucionalTituladosCache = null; // {estado: totalTitulados}, agrega TODOS los ciclos/campos — se carga una sola vez
window._institucionalPoligonos = null; // geojson de estados (comparte caché con el visor público si ya lo cargó)

var BIVAR_COLORES = {
    bajoBajo: '#3a3a3a',   // gris oscuro — bajo en ambos
    altoBajo: '#c0392b',   // rojo — alto en índice, bajo en titulados
    bajoAlto: '#2980b9',   // azul — bajo en índice, alto en titulados
    altoAlto: '#8e44ad'    // morado — alto en ambos
};

function iniciarVisorInstitucional() {
    if (!mapInstitucional) {
        mapInstitucional = L.map('map-institucional', { minZoom: 4, maxZoom: 10, zoomControl: false });
        mapInstitucional.setView([23.6345, -102.5528], 5);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO', subdomains: 'abcd', maxZoom: 19
        }).addTo(mapInstitucional);

        var chkIndice = document.getElementById('inst-chk-indice');
        var chkTitulados = document.getElementById('inst-chk-titulados');
        var selIndustria = document.getElementById('inst-select-industria');
        var selAnio = document.getElementById('inst-select-anio');
        var opcionesIndice = document.getElementById('inst-indice-opciones');

        chkIndice.onchange = function () {
            opcionesIndice.style.display = this.checked ? 'block' : 'none';
            actualizarVisorInstitucional();
        };
        chkTitulados.onchange = actualizarVisorInstitucional;
        selIndustria.onchange = function () { if (chkIndice.checked) actualizarVisorInstitucional(); };
        selAnio.onchange = function () { if (chkIndice.checked) actualizarVisorInstitucional(); };
    } else {
        // El mapa se crea una sola vez; al volver a esta sección solo hay
        // que recalcular su tamaño (estuvo con display:none, Leaflet no
        // mide bien un contenedor invisible).
        setTimeout(function () { mapInstitucional.invalidateSize(); }, 200);
    }
}

function _cargarPoligonosEstados() {
    if (window._institucionalPoligonos) return Promise.resolve(window._institucionalPoligonos);
    if (window.estadosPolygonsGeoJSON) {
        // El visor público (Finanzas/Productividad/Censo, en
        // escala_nacional_v1.js) puede haberlo cargado ya — se reusa en
        // vez de descargarlo otra vez.
        window._institucionalPoligonos = window.estadosPolygonsGeoJSON;
        return Promise.resolve(window._institucionalPoligonos);
    }
    return AppData.load('https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json').then(function (geo) {
        window._institucionalPoligonos = geo;
        window.estadosPolygonsGeoJSON = geo;
        return geo;
    });
}

// Mismo parseo que renderizarMapaProductividad (escala_nacional_v1.js) —
// Tablas/IC_<industria>.csv: columna 0 = entidad, resto = años.
function _cargarIndiceCompuesto(industria, anio) {
    var clave = industria + '_' + anio;
    if (window._institucionalIndiceCache[clave]) {
        return Promise.resolve(window._institucionalIndiceCache[clave]);
    }
    return AppData.load('Tablas/' + industria + '.csv').then(function (csvText) {
        var rows = csvText.split('\n');
        var headers = rows[0].split(',');
        var anioIdx = headers.findIndex(function (h) { return h.trim() === anio; });

        var datos = {};
        for (var i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            var rawCols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            var cols = rawCols.map(function (c) {
                var cleaned = c.trim();
                if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
                return cleaned.replace(',', '.');
            });
            var estado = normalizarEstadoNombre(cols[0]);
            var val = parseFloat(cols[anioIdx]);
            if (estado && !isNaN(val)) datos[estado] = val;
        }
        window._institucionalIndiceCache[clave] = datos;
        return datos;
    });
}

// Tablas/Indice_superior_temporal.csv (~50k filas, una por registro de
// titulación) — se agrega "Titulados Total" por entidad, ignorando
// municipio/campo/ciclo escolar (para esta primera versión se cruza el
// acumulado completo, no un ciclo específico).
function _cargarTituladosPorEntidad() {
    if (window._institucionalTituladosCache) return Promise.resolve(window._institucionalTituladosCache);
    return AppData.load('Tablas/Indice_superior_temporal.csv').then(function (csvText) {
        var lineas = csvText.trim().split('\n');
        var headers = lineas[0].split(',').map(function (h, idx) {
            var limpio = h.trim().replace(/\r/, '');
            return idx === 0 ? limpio.replace(/^\uFEFF/, '') : limpio;
        });
        var idxEntidad = headers.indexOf('ENTIDAD FEDERATIVA');
        var idxTotal = headers.indexOf('Titulados Total');

        var totales = {};
        for (var i = 1; i < lineas.length; i++) {
            if (!lineas[i].trim()) continue;
            var cols = [];
            var linea = lineas[i];
            var inQuote = false, current = '';
            for (var c = 0; c < linea.length; c++) {
                if (linea[c] === '"') { inQuote = !inQuote; }
                else if (linea[c] === ',' && !inQuote) { cols.push(current.trim()); current = ''; }
                else { current += linea[c]; }
            }
            cols.push(current.trim());

            var entidadRaw = cols[idxEntidad] ? cols[idxEntidad].replace(/\r/, '').trim() : '';
            if (!entidadRaw) continue;
            var estado = normalizarEstadoNombre(entidadRaw);
            var total = parseInt(cols[idxTotal]) || 0;
            totales[estado] = (totales[estado] || 0) + total;
        }
        window._institucionalTituladosCache = totales;
        return totales;
    });
}

function actualizarVisorInstitucional() {
    var chkIndice = document.getElementById('inst-chk-indice');
    var chkTitulados = document.getElementById('inst-chk-titulados');
    var resultado = document.getElementById('inst-resultado');

    if (institucionalLayer) { mapInstitucional.removeLayer(institucionalLayer); institucionalLayer = null; }

    if (!chkIndice.checked && !chkTitulados.checked) {
        resultado.innerHTML = '';
        return;
    }

    resultado.innerHTML = '<div style="color:#aaa;">Cargando datos…</div>';

    var industria = document.getElementById('inst-select-industria').value;
    var anio = document.getElementById('inst-select-anio').value;

    Promise.all([
        _cargarPoligonosEstados(),
        chkIndice.checked ? _cargarIndiceCompuesto(industria, anio) : Promise.resolve(null),
        chkTitulados.checked ? _cargarTituladosPorEntidad() : Promise.resolve(null)
    ]).then(function (res) {
        var geo = res[0], datosIndice = res[1], datosTitulados = res[2];
        if (chkIndice.checked && chkTitulados.checked) {
            _dibujarCruceBivariado(geo, datosIndice, datosTitulados);
        } else if (chkIndice.checked) {
            _dibujarUnaVariable(geo, datosIndice, 'Índice de crecimiento compuesto', false);
        } else {
            _dibujarUnaVariable(geo, datosTitulados, 'Población titulada', true);
        }
    }).catch(function (e) {
        console.error('Error en Visor Institucional:', e);
        resultado.innerHTML = '<div style="color:#ff5252;">Error al cargar los datos.</div>';
    });
}

function _dibujarUnaVariable(geo, datos, etiqueta, esEntero) {
    var valores = Object.keys(datos).map(function (k) { return datos[k]; }).filter(function (v) { return !isNaN(v); });
    valores.sort(function (a, b) { return a - b; });
    var breaks = calcularBreaks(valores);

    institucionalLayer = L.geoJSON(geo, {
        style: function (feature) {
            var estado = normalizarEstadoNombre(feature.properties.name || feature.properties.ESTADO || feature.properties.NOMGEO);
            var val = datos[estado];
            var color = '#333', op = 0.35;
            if (val !== undefined && !isNaN(val)) { color = RampaRojos[getClase(val, breaks)] || '#333'; op = 0.82; }
            return { fillColor: color, fillOpacity: op, color: 'white', weight: 1 };
        },
        onEachFeature: function (feature, layer) {
            var estado = normalizarEstadoNombre(feature.properties.name || feature.properties.ESTADO || feature.properties.NOMGEO);
            var val = datos[estado];
            var valTxt = (val !== undefined && !isNaN(val))
                ? (esEntero ? Math.round(val).toLocaleString('es-MX') : val.toLocaleString('es-MX', { maximumFractionDigits: 3 }))
                : 'Sin dato';
            layer.bindTooltip('<b>' + estado + '</b><br>' + etiqueta + ': ' + valTxt, { sticky: true, className: 'custom-tooltip' });
        }
    }).addTo(mapInstitucional);

    document.getElementById('inst-resultado').innerHTML =
        '<div>Mostrando: <b style="color:#00e5ff;">' + etiqueta + '</b>.</div>' +
        '<div style="color:#888; margin-top:4px;">Activa la otra capa para calcular el cruce entre ambos indicadores.</div>';
}

function _dibujarCruceBivariado(geo, datosIndice, datosTitulados) {
    // Solo las entidades con AMBOS valores entran a la clasificación —
    // Índice de crecimiento compuesto no siempre cubre las 32 entidades
    // igual de completo según la industria elegida.
    var entidadesConAmbos = Object.keys(datosIndice).filter(function (k) {
        return datosTitulados[k] !== undefined && !isNaN(datosTitulados[k]);
    });

    if (entidadesConAmbos.length === 0) {
        document.getElementById('inst-resultado').innerHTML = '<div style="color:#ff5252;">No hay entidades con datos en ambos indicadores para calcular el cruce.</div>';
        return;
    }

    var valoresIndice = entidadesConAmbos.map(function (k) { return datosIndice[k]; }).sort(function (a, b) { return a - b; });
    var valoresTitulados = entidadesConAmbos.map(function (k) { return datosTitulados[k]; }).sort(function (a, b) { return a - b; });
    var medianaIndice = _mediana(valoresIndice);
    var medianaTitulados = _mediana(valoresTitulados);

    var clasificacion = {};
    var conteos = { altoAlto: 0, altoBajo: 0, bajoAlto: 0, bajoBajo: 0 };
    entidadesConAmbos.forEach(function (estado) {
        var altoIndice = datosIndice[estado] >= medianaIndice;
        var altoTitulados = datosTitulados[estado] >= medianaTitulados;
        var clase = altoIndice ? (altoTitulados ? 'altoAlto' : 'altoBajo') : (altoTitulados ? 'bajoAlto' : 'bajoBajo');
        clasificacion[estado] = clase;
        conteos[clase]++;
    });

    institucionalLayer = L.geoJSON(geo, {
        style: function (feature) {
            var estado = normalizarEstadoNombre(feature.properties.name || feature.properties.ESTADO || feature.properties.NOMGEO);
            var clase = clasificacion[estado];
            return {
                fillColor: clase ? BIVAR_COLORES[clase] : '#1a1a1a',
                fillOpacity: clase ? 0.82 : 0.2,
                color: 'white', weight: 1
            };
        },
        onEachFeature: function (feature, layer) {
            var estado = normalizarEstadoNombre(feature.properties.name || feature.properties.ESTADO || feature.properties.NOMGEO);
            if (!clasificacion[estado]) {
                layer.bindTooltip('<b>' + estado + '</b><br>Sin dato en uno de los dos indicadores', { sticky: true, className: 'custom-tooltip' });
                return;
            }
            var textoClase = {
                altoAlto: 'Alto en ambos', altoBajo: 'Alto en índice, bajo en titulados',
                bajoAlto: 'Bajo en índice, alto en titulados', bajoBajo: 'Bajo en ambos'
            }[clasificacion[estado]];
            layer.bindTooltip(
                '<b>' + estado + '</b><br>' +
                'Índice: ' + datosIndice[estado].toLocaleString('es-MX', { maximumFractionDigits: 3 }) + '<br>' +
                'Titulados: ' + Math.round(datosTitulados[estado]).toLocaleString('es-MX') + '<br>' +
                '<i>' + textoClase + '</i>',
                { sticky: true, className: 'custom-tooltip' }
            );
        }
    }).addTo(mapInstitucional);

    try { mapInstitucional.fitBounds(institucionalLayer.getBounds(), { padding: [20, 20] }); } catch (e) { }

    var nombresPorClase = { altoAlto: [], altoBajo: [], bajoAlto: [], bajoBajo: [] };
    Object.keys(clasificacion).forEach(function (estado) { nombresPorClase[clasificacion[estado]].push(estado); });

    var faltantes = 32 - entidadesConAmbos.length;
    document.getElementById('inst-resultado').innerHTML =
        '<div style="font-weight:bold; color:#00e5ff; margin-bottom:6px;">CRUCE CALCULADO (mediana de cada indicador)</div>' +
        _filaLeyendaBivariada(BIVAR_COLORES.altoAlto, 'Alto en ambos', conteos.altoAlto, nombresPorClase.altoAlto) +
        _filaLeyendaBivariada(BIVAR_COLORES.altoBajo, 'Alto índice · bajo titulados', conteos.altoBajo, nombresPorClase.altoBajo) +
        _filaLeyendaBivariada(BIVAR_COLORES.bajoAlto, 'Bajo índice · alto titulados', conteos.bajoAlto, nombresPorClase.bajoAlto) +
        _filaLeyendaBivariada(BIVAR_COLORES.bajoBajo, 'Bajo en ambos', conteos.bajoBajo, nombresPorClase.bajoBajo) +
        (faltantes > 0 ? '<div style="color:#888; margin-top:8px;">' + faltantes + ' entidad(es) sin dato en alguno de los dos indicadores, excluida(s) de la clasificación.</div>' : '');
}

function _filaLeyendaBivariada(color, etiqueta, conteo, nombres) {
    return '<div style="display:flex; align-items:flex-start; gap:6px; margin-bottom:6px;">' +
        '<div style="width:12px; height:12px; background:' + color + '; border:1px solid #555; border-radius:2px; flex-shrink:0; margin-top:2px;"></div>' +
        '<div><b>' + etiqueta + '</b> (' + conteo + ')<br><span style="color:#999; font-size:10px;">' + (nombres.length ? nombres.slice().sort().join(', ') : '—') + '</span></div>' +
        '</div>';
}

function _mediana(valoresOrdenados) {
    var n = valoresOrdenados.length;
    if (n === 0) return 0;
    var mid = Math.floor(n / 2);
    return n % 2 === 0 ? (valoresOrdenados[mid - 1] + valoresOrdenados[mid]) / 2 : valoresOrdenados[mid];
}
