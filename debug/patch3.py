import io

with io.open(r'c:\Users\Admin\Downloads\Prueba-main\escala_global_nacional.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''        var winnerInd = winnerRecord['Industria'] || "su sector";

        var sintesisDiv = document.getElementById('sintesis-empresasLine');
        if (sintesisDiv) {
            sintesisDiv.innerHTML = `Liderando en la industria de <b>${winnerInd}</b>, la empresa <b style="color:#00e5ff;">${winnerName}</b> encabeza la métrica de <b>${indicadorText}</b> con un valor destacado de <b>${valDisplay}</b>. Esto fortalece su posición bajo la ruta de <span style="text-shadow: 1px 1px 2px #000; color:#fff; font-weight:bold;">${winnerModel}</span> dentro de los nodos industriales geolocalizados.`;'''

replacement = '''        var winnerInd = winnerRecord['Industria'] || "su sector";
        var descInd = "";
        if (winnerInd === "OEM") descInd = " (Fabricante de Equipos Originales / Ensambladora)";
        else if (winnerInd === "My/oS electrónicos") descInd = " (Micro y Opto Semiconductores)";
        else if (winnerInd === "Autopartes") descInd = " (Componentes Automotrices)";
        else if (winnerInd === "Autopartes electrónicas") descInd = " (Componentes Electrónicos Automotrices)";
        else if (winnerInd === "Semiconductores") descInd = " (Microchips y Circuitos Integrados)";

        var sintesisDiv = document.getElementById('sintesis-empresasLine');
        if (sintesisDiv) {
            sintesisDiv.innerHTML = `Liderando en la industria de <b>${winnerInd}</b><span style="font-size: 0.95em; color: #ccc;">${descInd}</span>, la empresa <b style="color:#00e5ff;">${winnerName}</b> encabeza la métrica de <b>${indicadorText}</b> con un valor destacado de <b>${valDisplay}</b>. Esto fortalece su posición bajo la ruta de <span style="text-shadow: 1px 1px 2px #000; color:#fff; font-weight:bold;">${winnerModel}</span> dentro de los nodos industriales geolocalizados.`;'''

target1 = target.replace('\n', '\r\n')
replacement1 = replacement.replace('\n', '\r\n')

if target1 in content:
    content = content.replace(target1, replacement1)
    print('Replaced CRLF')
elif target in content:
    content = content.replace(target, replacement)
    print('Replaced LF')
else:
    print('Target not found')

with io.open(r'c:\Users\Admin\Downloads\Prueba-main\escala_global_nacional.js', 'w', encoding='utf-8') as f:
    f.write(content)
