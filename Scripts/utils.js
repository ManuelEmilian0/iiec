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

window.cargarLimiteMunicipalGeoJSON = function() {
    if (window.municipiosPolygonsGeoJSON) {
        return Promise.resolve(window.municipiosPolygonsGeoJSON);
    }
    return Promise.all([
        fetch('carto/Limite_municipal_opt.geojson').then(res => res.json()),
        fetch('carto/Limite_municipal_CDMX.geojson').then(res => res.json()).catch(e => ({ type: "FeatureCollection", features: [] }))
    ]).then(([geoOpt, geoCdmx]) => {
        geoOpt.features = geoOpt.features.concat(geoCdmx.features);
        window.municipiosPolygonsGeoJSON = geoOpt;
        return geoOpt;
    }).catch(e => {
        console.error("Error al cargar limites municipales:", e);
        return null;
    });
};
