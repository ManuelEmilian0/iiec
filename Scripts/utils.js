/**
 * utils.js
 * Utilidades compartidas y componentes base para el geovisualizador.
 * (Controles Leaflet, Paletas de colores, Funciones de descarga)
 */

window.AppUtils = {
    // Aquí se migrarán basemapGalleryControl, downloadControl, etc.
    // Se ha inicializado el archivo para comenzar la migración progresiva
    // asegurando que no se rompa la referencia de variables locales actuales.
    
    init: function() {
        console.log("AppUtils inicializado.");
    }
};

document.addEventListener('DOMContentLoaded', function() {
    AppUtils.init();
});

/**
 * AppData.load(ruta)
 * Único punto de fetch del proyecto para archivos estáticos (GeoJSON/CSV/JSON).
 * Cachea la PROMESA (no solo el resultado) por ruta, así que si dos módulos de
 * escala piden el mismo archivo casi al mismo tiempo (ej. carto/armadoras.geojson
 * desde Global, Estatal y Metropolitana), solo se dispara una petición de red real.
 * El día que esto se sirva desde un backend, solo cambia la ruta que se le pasa aquí.
 */
window.AppData = window.AppData || {};
window.AppData._cache = {};
window.AppData.load = function(ruta, opts) {
    opts = opts || {};
    if (window.AppData._cache[ruta]) return window.AppData._cache[ruta];

    var esTexto = opts.text || /\.csv$/i.test(ruta);
    var promesa = fetch(ruta).then(function(res) {
        if (!res.ok) throw new Error('No se pudo cargar ' + ruta + ' (HTTP ' + res.status + ')');
        return esTexto ? res.text() : res.json();
    }).catch(function(err) {
        delete window.AppData._cache[ruta]; // permitir reintentar si falló
        throw err;
    });

    window.AppData._cache[ruta] = promesa;
    return promesa;
};

window.cargarLimiteMunicipalGeoJSON = function() {
    if (window.municipiosPolygonsGeoJSON) {
        return Promise.resolve(window.municipiosPolygonsGeoJSON);
    }
    return Promise.all([
        AppData.load('carto/Limite_municipal_opt.geojson'),
        AppData.load('carto/Limite_municipal_CDMX.geojson').catch(e => ({ type: "FeatureCollection", features: [] }))
    ]).then(([geoOpt, geoCdmx]) => {
        geoOpt.features = geoOpt.features.concat(geoCdmx.features);
        window.municipiosPolygonsGeoJSON = geoOpt;
        return geoOpt;
    }).catch(e => {
        console.error("Error al cargar limites municipales:", e);
        return null;
    });
};
