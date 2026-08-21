/**
 * onboarding.js
 * Tour guiado de contextualización de la interfaz. Se muestra una sola vez
 * (guardado en localStorage) después de que se cierra la portada, y puede
 * reabrirse en cualquier momento con el botón "?" que este módulo inyecta
 * en la barra de navegación.
 *
 * 100% autocontenido: no requiere editar index.html ni otros scripts.
 */

var ONBOARDING_STORAGE_KEY = 'geovisor_onboarding_v1';

var ONBOARDING_TARGETS = [
    { id: 'scale-box', lado: 'right', texto: 'Cambia la escala de análisis: Mundial, Nacional, Estatal, Metropolitana o Municipal.' },
    { id: 'filter-container-box', lado: 'right', texto: 'Elige aquí qué datos e indicadores quieres visualizar en la escala activa.' },
    { selector: '.basemap-gallery-container', lado: 'left', texto: 'Cambia el mapa base: satélite, oscuro, claro o Google Maps.' },
    { id: 'minimap-container', lado: 'left', texto: 'Minimapa de referencia: ubica en qué parte del mundo te encuentras.' }
];

var _onboarding = {
    overlay: null,
    svg: null,
    resizeHandler: null
};

function _onboardingYaVisto() {
    try { return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'; }
    catch (e) { return false; }
}

function _onboardingMarcarVisto() {
    try { localStorage.setItem(ONBOARDING_STORAGE_KEY, '1'); }
    catch (e) { /* localStorage no disponible; no es crítico */ }
}

function cerrarOnboarding() {
    // Desbloquea el selector de escala de inmediato, sin esperar el fade-out
    // del overlay: en cuanto se da "Entendido" (o la X) ya se puede elegir escala.
    document.body.classList.remove('onboarding-activo');

    if (_onboarding.resizeHandler) {
        window.removeEventListener('resize', _onboarding.resizeHandler);
        _onboarding.resizeHandler = null;
    }
    if (_onboarding.overlay) {
        _onboarding.overlay.classList.remove('visible');
        setTimeout(function () {
            if (_onboarding.overlay && _onboarding.overlay.parentNode) {
                _onboarding.overlay.parentNode.removeChild(_onboarding.overlay);
            }
            _onboarding.overlay = null;
            // El SVG con las líneas punteadas vive fuera de #onboarding-overlay
            // (se agrega directamente a <body> para cubrir toda la pantalla) y
            // por eso se quedaba pegado si solo se quitaba el overlay.
            if (_onboarding.svg && _onboarding.svg.parentNode) {
                _onboarding.svg.parentNode.removeChild(_onboarding.svg);
            }
            _onboarding.svg = null;
        }, 350);
    } else if (_onboarding.svg && _onboarding.svg.parentNode) {
        _onboarding.svg.parentNode.removeChild(_onboarding.svg);
        _onboarding.svg = null;
    }
    _onboardingMarcarVisto();
}

function _crearIconoMouse() {
    return (
        '<svg class="onboarding-mouse-icon" viewBox="0 0 60 90" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="4" y="4" width="52" height="82" rx="26" fill="none" stroke="#fff" stroke-width="3"/>' +
        '<line x1="30" y1="4" x2="30" y2="30" stroke="#fff" stroke-width="3"/>' +
        '<g class="onboarding-scroll-arrow up">' +
        '<polyline points="18,18 30,6 42,18" fill="none" stroke="#00e5ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</g>' +
        '<g class="onboarding-scroll-arrow down">' +
        '<polyline points="18,66 30,80 42,66" fill="none" stroke="#00e5ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</g>' +
        '</svg>'
    );
}

function _resolverElemento(target) {
    if (target.id) return document.getElementById(target.id);
    if (target.selector) return document.querySelector(target.selector);
    return null;
}

function _posicionarCallouts() {
    if (!_onboarding.overlay || !_onboarding.svg) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // Limpiar líneas previas
    while (_onboarding.svg.firstChild) _onboarding.svg.removeChild(_onboarding.svg.firstChild);

    ONBOARDING_TARGETS.forEach(function (target, idx) {
        var el = _resolverElemento(target);
        var callout = document.getElementById('onboarding-callout-' + idx);
        if (!el || !callout) { if (callout) callout.style.display = 'none'; return; }

        var rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) { callout.style.display = 'none'; return; }
        callout.style.display = 'block';

        var calloutRect = callout.getBoundingClientRect();
        var targetCenterY = rect.top + rect.height / 2;
        var top = Math.min(Math.max(targetCenterY - calloutRect.height / 2, 48), vh - calloutRect.height - 16);
        var anchorX, anchorY = Math.min(Math.max(targetCenterY, 48), vh - 16);

        if (target.lado === 'right') {
            var left = Math.min(rect.right + 70, vw - calloutRect.width - 16);
            callout.style.left = left + 'px';
            callout.style.top = top + 'px';
            anchorX = left;
        } else {
            var right = Math.min(vw - rect.left + 70, vw - 16);
            callout.style.right = right + 'px';
            callout.style.top = top + 'px';
            anchorX = vw - right;
        }

        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', anchorX);
        line.setAttribute('y1', anchorY);
        line.setAttribute('x2', rect.left + rect.width / 2);
        line.setAttribute('y2', rect.top + rect.height / 2);
        _onboarding.svg.appendChild(line);
    });
}

window.mostrarOnboarding = function () {
    if (_onboarding.overlay) return; // ya está abierto

    // Bloquea la selección de escala mientras la guía esté activa — solo se
    // libera al cerrar con "Entendido" (o la X), ver cerrarOnboarding().
    document.body.classList.add('onboarding-activo');

    var overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'onboarding-svg';

    var closeBtn = document.createElement('div');
    closeBtn.id = 'onboarding-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Cerrar guía';
    closeBtn.onclick = cerrarOnboarding;

    var ctaBtn = document.createElement('button');
    ctaBtn.id = 'onboarding-cta';
    ctaBtn.textContent = 'Entendido';
    ctaBtn.onclick = cerrarOnboarding;

    var mouseTip = document.createElement('div');
    mouseTip.id = 'onboarding-mouse-tip';
    mouseTip.innerHTML = _crearIconoMouse() +
        '<div class="onboarding-mouse-label">Desplaza la rueda del mouse para acercar o alejar la vista.</div>';

    overlay.appendChild(closeBtn);
    overlay.appendChild(mouseTip);
    overlay.appendChild(ctaBtn);

    ONBOARDING_TARGETS.forEach(function (target, idx) {
        var callout = document.createElement('div');
        callout.id = 'onboarding-callout-' + idx;
        callout.className = 'onboarding-callout align-' + target.lado;
        callout.innerHTML = '<span class="onboarding-dot"></span>' + target.texto;
        overlay.appendChild(callout);
    });

    document.body.appendChild(overlay);
    document.body.appendChild(svg);

    _onboarding.overlay = overlay;
    _onboarding.svg = svg;

    // A propósito NO se cierra al hacer click fuera de los callouts: la guía
    // debe permanecer activa hasta que se cierre a propósito (botón
    // "Entendido" o la X), para asegurar que se haya leído antes de apagarla.

    // setTimeout en vez de requestAnimationFrame: rAF se pausa en pestañas
    // sin foco/no visibles (frecuente en pruebas automatizadas y en algunos
    // navegadores en segundo plano), lo que dejaría la guía invisible.
    setTimeout(function () {
        overlay.classList.add('visible');
        _posicionarCallouts();
    }, 20);

    _onboarding.resizeHandler = function () { _posicionarCallouts(); };
    window.addEventListener('resize', _onboarding.resizeHandler);
};

function _inyectarBotonAyuda() {
    if (document.getElementById('onboarding-help-btn')) return;
    var container = document.querySelector('.nav-buttons-container');
    if (!container) return;

    var helpBtn = document.createElement('button');
    helpBtn.id = 'onboarding-help-btn';
    helpBtn.textContent = '?';
    helpBtn.title = 'Ver guía rápida de la interfaz';
    helpBtn.onclick = window.mostrarOnboarding;

    // Se coloca justo después de "Contacto" (no junto a "Iniciar Sesión")
    // para que no se sobreponga con ese botón. Antes se colocaba después de
    // "Metodología", pero ese era el sibling del separador flex-grow (no de
    // "Contacto"), así que quedaba pegado a Metodología en vez de a Contacto.
    var contactoBtn = Array.from(container.querySelectorAll('.nav-button'))
        .find(function (b) { return b.textContent.trim() === 'Contacto'; });

    if (contactoBtn && contactoBtn.nextSibling) {
        container.insertBefore(helpBtn, contactoBtn.nextSibling);
    } else if (contactoBtn) {
        container.appendChild(helpBtn);
    } else {
        container.appendChild(helpBtn);
    }
}

// Se dispara automáticamente al cerrar la portada (#splash-screen), como
// pidió el usuario. El tour señala elementos que viven DENTRO del panel
// lateral ("Dashboard": scale-box/filter-container-box, ver
// ONBOARDING_TARGETS arriba) — como ese panel arranca cerrado (setupUI en
// escala_global.js), esos objetivos no tendrían una posición real todavía.
// Por eso, en vez de llamar a mostrarOnboarding() directamente, se simula
// el clic de #sidebar-toggle-tab: ese botón ya abre el panel Y dispara
// mostrarOnboarding() si no se ha visto (ver su onclick en setupUI), así
// que reutilizamos esa misma ruta en vez de duplicar la lógica aquí.
function _activarGuiaAlIniciar() {
    if (_onboardingYaVisto()) return;
    var leftContainer = document.getElementById('left-sidebar-container');
    var toggleTab = document.getElementById('sidebar-toggle-tab');
    if (leftContainer && toggleTab && leftContainer.classList.contains('hidden-panel')) {
        toggleTab.click();
    } else if (typeof window.mostrarOnboarding === 'function') {
        // El panel ya estaba abierto por alguna otra razón — mostrar
        // directamente, sin togglear (eso lo cerraría).
        window.mostrarOnboarding();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    _inyectarBotonAyuda();

    var splash = document.getElementById('splash-screen');
    if (!splash) {
        setTimeout(_activarGuiaAlIniciar, 800);
        return;
    }

    var observer = new MutationObserver(function () {
        if (!document.getElementById('splash-screen')) {
            observer.disconnect();
            setTimeout(_activarGuiaAlIniciar, 500);
        }
    });
    observer.observe(document.body, { childList: true });
});
