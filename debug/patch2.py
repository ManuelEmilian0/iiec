import io

with io.open(r'c:\Users\Admin\Downloads\Prueba-main\escala_global_nacional.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''            var tendenciaTop1 = (valTop1Fin > valTop1Inicio) ? `ha consolidado su liderazgo con un incremento del ${crecTop1}% desde ${anioInicio}` : `ha sostenido su posición estratégica ajustando su ritmo respecto a ${anioInicio}`;

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
        }'''

replacement = '''            var tendenciaTop1 = (valTop1Fin > valTop1Inicio) ? `creciendo un ${crecTop1}% desde ${anioInicio}` : `ajustando su índice respecto a ${anioInicio}`;

            var textoTop23 = (top2 && top3) ? `Por su parte, <b style="color:#fff">${top2}</b> y <b style="color:#fff">${top3}</b> mantienen una fuerte competencia, reconfigurando constantemente el Top 5.` : "";

            summaryDiv.innerHTML = `En <b>${anioSeleccionado}</b> (industria <b>${indText}</b>), <b style="color:#00e5ff">${top1}</b> consolida su liderazgo ${tendenciaTop1}. ${textoTop23} Esto refleja cómo la productividad regional se transforma año con año.`;
            summaryDiv.style.textAlign = 'justify';
            summaryDiv.style.display = 'block';
        } else {
            var estadoStr = estadosArreglo[0];
            var valInicio = productData[estadoStr].historial[anioInicio];
            var valAnio = productData[estadoStr].historial[anioSeleccionado];
            var direccion = valAnio >= valInicio ? "un avance" : "una fluctuación";

            summaryDiv.innerHTML = `Para <b>${anioSeleccionado}</b> en la industria <b>${indText}</b>, <b style="color:#00e5ff">${estadoStr}</b> muestra ${direccion} en su índice respecto a ${anioInicio}, reflejando su adaptación a los ciclos del sector.`;
            summaryDiv.style.textAlign = 'justify';
            summaryDiv.style.display = 'block';
        }'''

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
