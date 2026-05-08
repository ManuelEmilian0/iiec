import re

with open(r'c:\Users\Admin\Downloads\Prueba-main\escala_global_nacional.js', 'r', encoding='utf-8') as f:
    content = f.read()

sintesis = """    // Agregar síntesis dinámica
    var summaryDiv = document.getElementById('dynamic-summary-global');
    if (summaryDiv && anioSeleccionado) {
        var indText = window.industriaActual || "la industria";
        if (indText === 'IC_ELECTRICA') indText = "Automotriz";
        if (indText === 'IC_ELECTRONICA') indText = "Electrónica";
        if (indText === 'IC_SEIT') indText = "Servicios SEIT";

        var anioInicio = anios[0];
        
        if (estadosArreglo.length > 1) {
            var top1 = estadosArreglo[0];
            var top2 = estadosArreglo[1] || "";
            var top3 = estadosArreglo[2] || "";
            
            var valTop1Inicio = productData[top1].historial[anioInicio];
            var valTop1Fin = productData[top1].historial[anioSeleccionado];
            var crecTop1 = valTop1Inicio ? ((valTop1Fin - valTop1Inicio) / Math.abs(valTop1Inicio) * 100).toFixed(1) : 0;
            
            var tendenciaTop1 = (valTop1Fin > valTop1Inicio) ? `ha consolidado su liderazgo con un incremento del ${crecTop1}% desde ${anioInicio}` : `ha sostenido su posición estratégica ajustando su ritmo respecto a ${anioInicio}`;
            
            var textoTop23 = (top2 && top3) ? `Al mismo tiempo, la trayectoria de entidades como <b style="color:#fff">${top2}</b> y <b style="color:#fff">${top3}</b> refleja una competencia histórica por captar mayor especialización e infraestructura, presionando fuertemente el balance del Top 5.` : "";

            summaryDiv.innerHTML = `En el ciclo <b>${anioSeleccionado}</b> para la industria <b>${indText}</b>, se aprecia una continua evolución territorial. Destaca que <b style="color:#00e5ff">${top1}</b> ${tendenciaTop1}. ${textoTop23} Esta dinámica confirma que la productividad regional no es estática, demostrando cómo los principales actores estatales transforman sus bases industriales año con año para mantenerse vigentes en el mercado.`;
            summaryDiv.style.display = 'block';
        } else {
            var estadoStr = estadosArreglo[0];
            var valInicio = productData[estadoStr].historial[anioInicio];
            var valAnio = productData[estadoStr].historial[anioSeleccionado];
            var direccion = valAnio >= valInicio ? "un avance positivo" : "una fluctuación";
            
            summaryDiv.innerHTML = `Al examinar el comportamiento de <b style="color:#00e5ff">${estadoStr}</b> hasta el <b>${anioSeleccionado}</b> en el sector <b>${indText}</b>, la trayectoria muestra ${direccion} en su índice respecto a ${anioInicio}, ilustrando su capacidad de adaptación a las dinámicas cambiantes de la industria.`;
            summaryDiv.style.display = 'block';
        }
    } else if (summaryDiv) {
        summaryDiv.style.display = 'none';
    }
}"""

target = "        }\n    });\n}"
replacement = "        }\n    });\n\n" + sintesis
content = content.replace(target, replacement)
target2 = "        }\r\n    });\r\n}"
replacement2 = "        }\r\n    });\r\n\r\n" + sintesis.replace('\n', '\r\n')
content = content.replace(target2, replacement2)

with open(r'c:\Users\Admin\Downloads\Prueba-main\escala_global_nacional.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
