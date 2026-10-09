/**
 * red_proveeduria.js
 * Sección "Red de proveeduría" del VISOR INSTITUCIONAL (debajo de "Cruce de Indicadores").
 * Fuente: Modelos/codigos/red_proveeduria.py -> Modelos/carto/red_proveeduria_*.geojson
 * Marcado HTML: index.html (#rp-seccion dentro de #institucional-panel).
 * Mapa: mapInstitucional (institucional.js), que se crea la primera vez que se abre la sección;
 * la red se dibuja en un pane propio por encima de la coropleta del cruce.
 */
(function () {
    'use strict';

    var RUTA_ENLACES = 'Modelos/carto/red_proveeduria_enlaces_top5.geojson';
    var RUTA_NODOS = 'Modelos/carto/red_proveeduria_nodos.geojson';
    var PANE = 'redProveeduriaPane';

    var COLOR_ENLACE = { 'T1-T0': '#ff6d00', 'T2-T1': '#ffd600', 'T3-T2': '#90a4ae' };
    var COLOR_TIER = { '0': '#00e5ff', '1': '#ff6d00', '2': '#ffd600', '3': '#90a4ae' };
    var OPAC_CONF = { alta: 0.9, media: 0.6, baja: 0.3 };
    var RANGO_CONF = { baja: 0, media: 1, alta: 2 };
    var ESCALA_TIPO = { 'T1-T0': 1.0, 'T2-T1': 0.55, 'T3-T2': 0.55 };
    var ORDEN_TIPO = { 'T3-T2': 0, 'T2-T1': 1, 'T1-T0': 2 };   // T1->OEM encima

    var st = {
        mapa: null, enlaces: null, nodos: null, capaEnlaces: null, capaNodos: null,
        renderer: null, activo: false, maxLogFlujo: 1, maxPR: 1, ligado: false
    };

    // ------------------------------------------------------------------ estilos
    (function inyectarCSS() {
        var css = '' +
            '#rp-seccion .rp-fila{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;margin:3px 0;}' +
            '#rp-seccion .rp-linea{display:inline-block;width:18px;height:3px;flex:none;}' +
            '#rp-seccion .rp-punteada{background:repeating-linear-gradient(90deg,#90a4ae 0 4px,transparent 4px 7px);}' +
            '#rp-seccion .rp-leyenda{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;margin-top:8px;}' +
            '#rp-seccion .rp-leyenda i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px;}' +
            '#rp-seccion .rp-kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0;}' +
            '#rp-seccion .rp-kpi div{background:#1c1c1c;border:1px solid #333;border-radius:4px;padding:5px;text-align:center;}' +
            '#rp-seccion .rp-kpi b{display:block;font-size:14px;color:#fff;}' +
            '#rp-seccion .rp-top{margin:4px 0 0 0;padding-left:16px;}' +
            '#rp-seccion .rp-top li{margin:2px 0;}';
        var tag = document.createElement('style');
        tag.textContent = css;
        document.head.appendChild(tag);
    })();

    // ------------------------------------------------------------------ utilidades
    function fmt(n, d) { return (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: d === undefined ? 2 : d }); }
    function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function $(id) { return document.getElementById(id); }
    function grosor(flujo, tipo) { return (0.6 + 4.4 * Math.log1p(flujo) / st.maxLogFlujo) * (ESCALA_TIPO[tipo] || 1); }

    function filtros() {
        return {
            tipos: ['T1-T0', 'T2-T1', 'T3-T2'].filter(function (t) { return $('rp-' + t).checked; }),
            oem: $('rp-oem').value,
            conf: $('rp-conf').value || 'baja',
            nodos: $('rp-nodos').checked
        };
    }

    /** Con OEM elegido: T1->OEM y T2->(esos T1) = cadena del fabricante. */
    function enlacesFiltrados(f) {
        var feats = st.enlaces.features.filter(function (x) {
            var p = x.properties;
            return f.tipos.indexOf(p.enlace) !== -1 && RANGO_CONF[p.confiabilidad] >= RANGO_CONF[f.conf];
        });
        if (!f.oem) return feats;
        var t1 = {}, salida = [];
        feats.forEach(function (x) {
            var p = x.properties;
            if (p.enlace === 'T1-T0' && p.oem_grupo === f.oem) { t1[p.id_proveedor] = true; salida.push(x); }
        });
        feats.forEach(function (x) {
            var p = x.properties;
            if (p.enlace === 'T2-T1' && t1[p.id_comprador]) salida.push(x);
        });
        return salida;
    }

    // ------------------------------------------------------------------ popups
    function popupEnlace(p) {
        var dist = p.coord_corregida
            ? fmt(p.distancia_km_corregida, 1) + ' km <span style="color:#e65100">(corregida; el modelo usó ' + fmt(p.distancia_km, 0) + ')</span>'
            : fmt(p.distancia_km, 1) + ' km';
        return '<div style="min-width:230px;font-size:12px">' +
            '<b>' + esc(p.proveedor) + '</b> <span style="color:#888">(T' + p.tier_proveedor + ')</span><br>' +
            '&darr; ' + esc(p.enlace) + '<br>' +
            '<b>' + esc(p.comprador) + '</b> <span style="color:#888">(T' + p.tier_comprador + ')</span>' +
            (p.oem_grupo ? ' · OEM <b>' + esc(p.oem_grupo) + '</b>' : '') +
            '<hr style="margin:5px 0;border:0;border-top:1px solid #ccc">' +
            esc(p.entidad_p) + ' &rarr; ' + esc(p.entidad_c) + '<br>' +
            'Distancia: ' + dist + '<br>' +
            'Flujo estimado: ' + fmt(p.flujo_estimado, 4) + '<br>' +
            'Participación en compras del cliente: ' + fmt(p.participacion_comprador * 100, 1) + '%<br>' +
            'Confiabilidad nodal: <b>' + esc(p.confiabilidad) + '</b> · Enlace: <i>' + esc(p.confianza_enlace) + '</i></div>';
    }

    function popupNodo(p) {
        return '<div style="min-width:220px;font-size:12px">' +
            '<b>' + esc(p.nombre) + '</b><br>' +
            'Tier ' + esc(p.tier_red) + (p.oem_grupo ? ' · OEM <b>' + esc(p.oem_grupo) + '</b>' : '') +
            (p.es_planta_ensamble === false ? ' <span style="color:#e65100">(no es planta de ensamble)</span>' : '') + '<br>' +
            'SCIAN ' + esc(p.codigo_scian) + '<br>' + esc(p.municipio) + ', ' + esc(p.entidad) + '<br>' +
            'Clientes: ' + p.n_clientes + ' · Proveedores: ' + p.n_proveedores + '<br>' +
            'PageRank de proveeduría: ' + fmt(p.pagerank_proveeduria, 4) + '<br>' +
            'Respaldo institucional: ' + esc(p.nivel_inst) + '</div>';
    }

    // ------------------------------------------------------------------ resumen en el panel
    function resumen(feats, f) {
        var info = $('rp-info');
        if (!info) return;
        var t1 = {}, t2 = {}, ent = {}, nAlta = 0, porProv = {};
        feats.forEach(function (x) {
            var p = x.properties;
            if (p.confiabilidad === 'alta') nAlta++;
            if (p.tier_proveedor === 1) { t1[p.id_proveedor] = true; ent[p.entidad_p] = true; }
            if (p.tier_proveedor === 2) t2[p.id_proveedor] = true;
            if (p.enlace === 'T1-T0') {
                porProv[p.proveedor] = (porProv[p.proveedor] || 0) + p.flujo_estimado;
            }
        });
        var n = function (o) { return Object.keys(o).length; };
        var top = Object.keys(porProv).sort(function (a, b) { return porProv[b] - porProv[a]; }).slice(0, 5);
        info.innerHTML =
            '<div style="font-weight:bold;color:#00e5ff;">' + (f.oem ? 'CADENA DE ' + esc(f.oem.toUpperCase()) : 'RED NACIONAL') + '</div>' +
            '<div class="rp-kpi">' +
            '<div><b>' + fmt(feats.length, 0) + '</b>enlaces</div>' +
            '<div><b>' + n(t1) + '</b>prov. Tier 1</div>' +
            '<div><b>' + n(t2) + '</b>prov. Tier 2</div></div>' +
            '<div>Entidades con proveedores Tier 1: <b>' + n(ent) + '</b></div>' +
            '<div>Enlaces con confiabilidad alta: <b>' + fmt(feats.length ? nAlta / feats.length * 100 : 0, 0) + '%</b></div>' +
            (top.length ? '<div style="margin-top:6px;color:#aaa;">Principales proveedores Tier 1 (flujo al OEM)</div><ol class="rp-top">' +
                top.map(function (k) { return '<li>' + esc(k) + ' <span style="color:#888">' + fmt(porProv[k], 2) + '</span></li>'; }).join('') + '</ol>' : '');
    }

    // ------------------------------------------------------------------ dibujo
    function limpiar() {
        if (!st.mapa) return;
        if (st.capaEnlaces) { st.mapa.removeLayer(st.capaEnlaces); st.capaEnlaces = null; }
        if (st.capaNodos) { st.mapa.removeLayer(st.capaNodos); st.capaNodos = null; }
    }

    function dibujar() {
        limpiar();
        if (!st.mapa || !st.enlaces || !st.activo) { if ($('rp-info') && !st.activo) $('rp-info').innerHTML = ''; return; }
        var f = filtros();
        var feats = enlacesFiltrados(f).slice().sort(function (a, b) {
            var d = ORDEN_TIPO[a.properties.enlace] - ORDEN_TIPO[b.properties.enlace];
            return d !== 0 ? d : a.properties.flujo_estimado - b.properties.flujo_estimado;
        });

        st.capaEnlaces = L.geoJSON({ type: 'FeatureCollection', features: feats }, {
            pane: PANE, renderer: st.renderer,
            style: function (x) {
                var p = x.properties;
                return {
                    color: COLOR_ENLACE[p.enlace] || '#fff',
                    weight: grosor(p.flujo_estimado, p.enlace),
                    opacity: (OPAC_CONF[p.confiabilidad] || 0.5) * (p.enlace === 'T1-T0' ? 1 : 0.75),
                    dashArray: p.enlace === 'T3-T2' ? '4 4' : null
                };
            },
            onEachFeature: function (x, lyr) {
                lyr.bindPopup(popupEnlace(x.properties));
                lyr.on('mouseover', function () { lyr.setStyle({ weight: grosor(x.properties.flujo_estimado, x.properties.enlace) + 3, opacity: 1 }); });
                lyr.on('mouseout', function () { if (st.capaEnlaces) st.capaEnlaces.resetStyle(lyr); });
            }
        }).addTo(st.mapa);

        var ids = {};
        feats.forEach(function (x) { ids[x.properties.id_proveedor] = true; ids[x.properties.id_comprador] = true; });
        if (f.nodos && st.nodos) {
            st.capaNodos = L.geoJSON({
                type: 'FeatureCollection',
                features: st.nodos.features.filter(function (n) { return ids[n.properties.id_unidad]; })
            }, {
                pane: PANE,
                pointToLayer: function (n, ll) {
                    var p = n.properties, t = String(p.tier_red).split('/')[0];
                    var r = t === '0' ? 7 : 2.5 + 6 * Math.sqrt((p.pagerank_proveeduria || 0) / st.maxPR);
                    return L.circleMarker(ll, {
                        pane: PANE, renderer: st.renderer, radius: r, color: '#111', weight: t === '0' ? 1.5 : 0.5,
                        fillColor: COLOR_TIER[t] || '#fff', fillOpacity: 0.9
                    });
                },
                onEachFeature: function (n, lyr) { lyr.bindPopup(popupNodo(n.properties)); }
            }).addTo(st.mapa);
        }
        resumen(feats, f);
        if (f.oem && feats.length) st.mapa.fitBounds(st.capaEnlaces.getBounds(), { paddingTopLeft: [40, 40], paddingBottomRight: [360, 40], maxZoom: 8 });  // 360 = ancho del panel institucional
    }

    // ------------------------------------------------------------------ datos
    function cargar() {
        if (st.enlaces) return Promise.resolve();
        $('rp-info').innerHTML = '<span style="color:#888">Cargando red…</span>';
        return Promise.all([AppData.load(RUTA_ENLACES), AppData.load(RUTA_NODOS)]).then(function (r) {
            st.enlaces = r[0]; st.nodos = r[1];
            var maxF = 0, maxPR = 0, oems = {};
            st.enlaces.features.forEach(function (x) {
                var p = x.properties;
                if (p.flujo_estimado > maxF) maxF = p.flujo_estimado;
                if (p.oem_grupo) oems[p.oem_grupo] = (oems[p.oem_grupo] || 0) + p.flujo_estimado;
            });
            st.nodos.features.forEach(function (n) {
                var p = n.properties;
                if (String(p.tier_red) !== '0' && p.pagerank_proveeduria > maxPR) maxPR = p.pagerank_proveeduria;
            });
            st.maxLogFlujo = Math.log1p(maxF) || 1;
            st.maxPR = maxPR || 1;
            var sel = $('rp-oem');
            while (sel.options.length > 1) sel.remove(1);
            Object.keys(oems).sort(function (a, b) { return oems[b] - oems[a]; }).forEach(function (o) {
                var op = document.createElement('option'); op.value = o; op.textContent = o; sel.appendChild(op);
            });
        }).catch(function (e) {
            console.error('[red_proveeduria]', e);
            $('rp-info').innerHTML = '<span style="color:#ff5252">No se encontró la red. Ejecute Modelos/codigos/red_proveeduria.py</span>';
            throw e;
        });
    }

    // ------------------------------------------------------------------ enlace con el visor institucional
    function prepararMapa(m) {
        st.mapa = m;
        if (!m.getPane(PANE)) {
            m.createPane(PANE);
            m.getPane(PANE).style.zIndex = 450;   // encima de la coropleta (overlayPane = 400), debajo de popups
        }
        st.renderer = L.canvas({ pane: PANE, padding: 0.5 });
        if (st.activo) cargar().then(dibujar).catch(function () { });
    }

    function ligarControles() {
        if (st.ligado || !$('rp-seccion')) return;
        st.ligado = true;
        $('rp-activo').addEventListener('change', function () {
            st.activo = this.checked;
            $('rp-opciones').style.display = st.activo ? 'block' : 'none';
            if (!st.activo) { dibujar(); return; }
            cargar().then(dibujar).catch(function () { });
        });
        ['rp-T1-T0', 'rp-T2-T1', 'rp-T3-T2', 'rp-oem', 'rp-conf', 'rp-nodos'].forEach(function (id) {
            $(id).addEventListener('change', dibujar);
        });
    }

    window.RedProveeduria = {
        activar: function (on) { var c = $('rp-activo'); if (c) { c.checked = on !== false; c.dispatchEvent(new Event('change')); } },
        estado: st
    };

    document.addEventListener('DOMContentLoaded', ligarControles);
    // mapInstitucional se crea al abrir la sección "Institucional" (iniciarVisorInstitucional)
    setInterval(function () {
        ligarControles();
        var m = window.mapInstitucional;
        if (m && m !== st.mapa && m._container) prepararMapa(m);
    }, 700);
})();
