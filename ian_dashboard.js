const datosIAN = [
    { nombre: "Plan México 2025", short: "Plan México", eco: 3, ord: 1, equ: 1, inf: 2, gob: 1 },
    { nombre: "LGAHOTDU", short: "LGAHOTDU", eco: 2, ord: 3, equ: 3, inf: 2, gob: 3 },
    { nombre: "PED BC 2022-2027", short: "PED BC", eco: 3, ord: 2, equ: 2, inf: 2, gob: 2 },
    { nombre: "PMDU Tijuana 2025-2027", short: "PMDU", eco: 2, ord: 1, equ: 2, inf: 2, gob: 2 },
    { nombre: "PDUCP Tijuana 2010-2030", short: "PDUCP", eco: 2, ord: 3, equ: 0, inf: 2, gob: 1 }
];

function calcularIANPromedio(inst) {
    return ((inst.eco + inst.ord + inst.equ + inst.inf + inst.gob) / 5).toFixed(1);
}

function getColorForIAN(value) {
    if (value === 3) return "#2e7d32"; // Verde
    if (value === 2) return "#ff8f00"; // Naranja
    if (value === 1) return "#c62828"; // Rojo
    if (value === 0) return "#7f0000"; // Rojo oscuro
    return "#333";
}

function getTextColorForIAN(value) {
    if (value === 3 || value === 2) return "#fff";
    return "#fff";
}

function inicializarTableroIAN() {
    var container = document.getElementById("ian-dashboard-content");
    if (!container) return;

    // Si ya tiene contenido, no lo volvemos a generar
    if (container.innerHTML.trim() !== "" && !container.innerHTML.includes("<!-- Se inyecta")) return;

    var html = `
        <div style="overflow-x: auto; font-family: 'Noto Sans', sans-serif; padding-bottom: 10px;">
            <div style="text-align: center; margin-bottom: 6px; font-weight: bold; color: #00e5ff; font-size: 13px; text-transform: uppercase;">Municipio de Tijuana, B.C.</div>
            
            <div style="font-size: 9px; color: #ccc; margin-bottom: 10px; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; border-left: 2px solid #00e5ff; line-height: 1.3;">
                <div style="text-align: center; margin-bottom: 4px;"><b>Ejes de Evaluación:</b></div>
                <div style="text-align: justify;">
                    <b>Eco</b> (Económico): Competitividad industrial y atracción de inversión.<br>
                    <b>Ord</b> (Ordenamiento): Aplicación de instrumentos de uso de suelo.<br>
                    <b>Equ</b> (Equidad): Distribución equitativa de cargas y beneficios del desarrollo.<br>
                    <b>Inf</b> (Infraestructura): Provisión de servicios públicos y equipamiento urbano.<br>
                    <b>Gob</b> (Gobernanza): Coordinación institucional y mecanismos de participación.
                </div>
            </div>

            <table style="width: 100%; border-collapse: separate; border-spacing: 1px; text-align: center; color: #fff; font-size: 11px;">
                <thead>
                    <tr style="background: #111; color: #ccc;">
                        <th style="padding: 8px 4px; text-align: left; border-bottom: 1px solid #444;">Instrumento</th>
                        <th title="Económico" style="padding: 8px 2px; border-bottom: 1px solid #444;">Eco</th>
                        <th title="Ordenamiento Territorial" style="padding: 8px 2px; border-bottom: 1px solid #444;">Ord</th>
                        <th title="Equidad Socioespacial" style="padding: 8px 2px; border-bottom: 1px solid #444;">Equ</th>
                        <th title="Infraestructura" style="padding: 8px 2px; border-bottom: 1px solid #444;">Inf</th>
                        <th title="Gobernanza" style="padding: 8px 2px; border-bottom: 1px solid #444;">Gob</th>
                        <th style="padding: 8px 2px; color: #00e5ff; border-bottom: 1px solid #444;">IAN</th>
                    </tr>
                </thead>
                <tbody>
    `;

    datosIAN.forEach(inst => {
        var prom = calcularIANPromedio(inst);
        html += `
            <tr class="ian-row">
                <td style="padding: 6px 4px; text-align: left; font-weight: bold; background: #222;">${inst.short}</td>
                <td style="padding: 6px 2px; background: ${getColorForIAN(inst.eco)}; color: ${getTextColorForIAN(inst.eco)};">${inst.eco}</td>
                <td style="padding: 6px 2px; background: ${getColorForIAN(inst.ord)}; color: ${getTextColorForIAN(inst.ord)};">${inst.ord}</td>
                <td style="padding: 6px 2px; background: ${getColorForIAN(inst.equ)}; color: ${getTextColorForIAN(inst.equ)};">${inst.equ}</td>
                <td style="padding: 6px 2px; background: ${getColorForIAN(inst.inf)}; color: ${getTextColorForIAN(inst.inf)};">${inst.inf}</td>
                <td style="padding: 6px 2px; background: ${getColorForIAN(inst.gob)}; color: ${getTextColorForIAN(inst.gob)};">${inst.gob}</td>
                <td style="padding: 6px 2px; font-weight: bold; color: #fff; background: #000; border-left: 1px solid #333;">${prom}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            
            <div style="font-size: 9px; color: #aaa; margin-top: 8px; text-align: justify; padding: 4px; border-bottom: 1px dotted #444; padding-bottom: 8px;">
                <b>Escala:</b> 0 = Ausente | 1 = Declarado sin operacionalizar | 2 = Operacionalizado sin implementación | 3 = Explicitado, operacionalizado e implementado.
            </div>

            <div style="font-size: 10px; color: #ddd; margin-top: 10px; line-height: 1.4; padding: 6px; background: #1a1a1a; border-radius: 4px;">
                <div style="text-align: center; margin-bottom: 6px;"><b style="color: #00e5ff;">Síntesis Analítica:</b></div>
                <ul style="margin: 0 0 0 16px; padding: 0; text-align: justify;">
                    <li style="margin-bottom: 4px;"><b>Plan México 2025:</b> Fuerte política económica (3), pero débil anclaje territorial (1 en Ordenamiento, Equidad y Gob.).</li>
                    <li style="margin-bottom: 4px;"><b>LGAHOTDU:</b> IAN más alto (2.6). Explicita facultades municipales, pero al ser un marco general no garantiza su implementación efectiva.</li>
                    <li style="margin-bottom: 4px;"><b>PED BC:</b> Coherencia intermedia (2.2). Bisagra articuladora de competitividad, pero con limitada incidencia y transferencia de recursos para la equidad.</li>
                    <li><b>Brecha Estructural (PDUCP vs PMDU):</b> El PDUCP, siendo el instrumento de mayor incidencia directa territorial (zonificación), contrasta severamente al obtener un <b>0 en Equidad</b>. Esto confirma empíricamente que se planea de forma reactiva: se describen ideales superiores sin mecanismos para transformarlos en realidad territorial, diagnosticando así la principal brecha normativa del municipio.</li>
                </ul>
            </div>

        </div>
    `;

    container.innerHTML = html;
}

// Inicializar cuando el DOM esté listo o mutado
document.addEventListener('DOMContentLoaded', function() {
    var checkExist = setInterval(function() {
        if (document.getElementById('ian-dashboard-content')) {
            inicializarTableroIAN();
            clearInterval(checkExist);
        }
    }, 500);
});

// Como setupUI() puede correr después del DOMContentLoaded (o ser llamado dinámicamente),
// añadimos un MutationObserver al body para detectar cuando se inserta #ian-dashboard-content
var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.addedNodes) {
            for (var i = 0; i < mutation.addedNodes.length; i++) {
                var node = mutation.addedNodes[i];
                if (node.id === 'ian-dashboard-box' || (node.querySelector && node.querySelector('#ian-dashboard-content'))) {
                    inicializarTableroIAN();
                }
            }
        }
    });
});
observer.observe(document.body, { childList: true, subtree: true });
