# Auditoría — `Tablas/red_proveeduria_estimada_v2.csv`

Fecha: 29-sep-2026 · Script: `Modelos/codigos/red_proveeduria.py` (función `auditar_red`) · Detalle en `auditoria_red_proveeduria_v2.json`

## Dictamen: VIABLE PARCIAL — la red sirve para Tier 0–1–2; el Tier 3 no está conectado

La base es íntegra a nivel técnico: sin nulos, sin duplicados, con los ids resueltos al 100 % y las distancias reproducibles. Se puede usar en el geovisualizador **después de filtrarla** y con estos cuatro ajustes pendientes en el modelo.

| # | Prueba | Estado | Hallazgo |
|---|---|---|---|
| 1 | Esquema / nulos | OK | 95 368 enlaces, 9 columnas, 0 nulos |
| 2 | Integridad referencial | OK | `id_proveedor`/`id_comprador` = `id_ue` de *DENUE Enriquecido.csv* (735 proveedores, 635 compradores, 0 huérfanos) |
| 3 | SCIAN | OK | El SCIAN del enlace coincide con el de DENUE en el 100 % de los casos |
| 4 | Distancias | OK | Haversine reproducible (error máx. 0.00014 km) |
| 5 | Coordenadas | ADVERTENCIA | 4 UE con longitud sin punto decimal (Honeywell Juárez ×3, Panasonic Mexicali). **209 enlaces** se calcularon con distancias de ~2 000 km, así que su flujo está subestimado. El módulo corrige las coordenadas (`distancia_km_corregida`), pero el flujo solo se arregla re-ejecutando gravedad+RAS |
| 6 | Duplicados / autoenlaces / flujo ≤ 0 | OK | 0 |
| 7 | Jerarquía | OK | Solo pares T1→T0 (22 363), T2→T1 (70 113) y T3→T2 (2 892) |
| 8 | **Continuidad de la cadena** | **CRÍTICO** | T1: 501/501 compradores venden a T0 ✔. **T2: 0/87 compradores venden a T1.** Los "Tier 2" que compran al T3 (SCIAN 336320/336360, clasificados Tier 2 en DENUE) no son los mismos que venden al T1 (SCIAN 334410/335920/336370). Por eso **el T3 es una isla** y no llega a ningún OEM |
| 9 | Tier 0 vs DENUE | ADVERTENCIA | Las 47 UE Tier 0 (SCIAN 336110/336120) aparecen en DENUE como Tier 2 (33), Tier 1 (7) y Sin información (7). El tier de la red mezcla dos criterios: el SCIAN para T0 y la columna DENUE para T1–T3 |
| 10 | Densidad | ADVERTENCIA | Existe el 86–98 % de los pares posibles y la distancia mediana es de 778 km. Sin filtro, la red no se puede leer en un mapa |
| 11 | Concentración | OK | El 13.4 % de los enlaces concentra el 80 % del flujo, lo que justifica filtrar por top-N o por participación |
| 12 | Confiabilidad | ADVERTENCIA | Alta 34 %, media 49 %, baja 17 %. Es respaldo **nodal** (IMMEX/ALTEX/PROSEC), no confirmación del vínculo. Todos los enlaces quedan como `confianza_enlace = inferido` |
| 13 | Trazabilidad | ADVERTENCIA | Faltan `coeficiente_tecnico`, `beta_usado`, `masa_p` y `masa_c`, por lo que el resultado no puede reproducirse solo con el CSV |
| 14 | Cobertura OEM (Resumen 2026) | ADVERTENCIA | Audi, GAC, Honda y Mazda no tienen UE Tier 0. GM Ramos Arizpe tampoco aparece |
| 15 | Tier 0 que no son planta | ADVERTENCIA | 21 de las 47 UE están a más de 5 km de una planta INEGI: corporativos en CDMX (GM, Nissan, Stellantis), pesados (Daimler, Dina, Foton, Volvo) y otras |

## Ajustes recomendados al modelo (`red_proveeduria_gravedad_ras.py`)
1. Usar **un solo criterio de tier**. Si T2 y T3 dependen de DENUE, los compradores del T3 deben ser los mismos nodos que venden al T1. La alternativa es dejar que el T3 venda a los proveedores T2 por SCIAN (334410/336370).
2. Corregir la longitud de las 4 UE en *DENUE Enriquecido.csv* y volver a ejecutar gravedad+RAS.
3. Exportar `coeficiente_tecnico`, `beta_usado`, `masa_p` y `masa_c` en v3.
4. Aplicar `distancia_maxima_km` o un umbral de participación dentro del modelo.
5. En `metricas_red()`, la intermediación usa el flujo como distancia (más flujo = más lejos). El módulo nuevo usa `costo = 1/flujo`.
6. Cargar vínculos confirmados (DENUE × B2B) con `--vinculos` para calibrar β y marcar enlaces `confirmado`.

## Productos generados
- `Modelos/data/red_proveeduria_enlaces.parquet` — red completa enriquecida (nombres, entidad, CVEGEO, OEM, participación)
- `Modelos/data/red_proveeduria_enlaces_top5.parquet` + `Modelos/carto/red_proveeduria_enlaces_top5.geojson` — 3 175 enlaces (LineString)
- `Modelos/data/red_proveeduria_nodos.parquet` + `Modelos/carto/red_proveeduria_nodos.geojson` — 762 nodos con métricas
- `Modelos/data/cat_oem.csv` — relación UE Tier 0 → grupo OEM → planta INEGI
- `Modelos/data/resumen_red_por_oem.csv` — proveedores T1/T2 por OEM, cruzados con los modelos ICE/HEV/BEV
- `Modelos/docs/diagrama_ER_dataset.png|svg|dot`

Ejecución: `python Modelos/codigos/red_proveeduria.py --top-n 5 [--solo-plantas] [--vinculos ruta.csv]`
