import os
import re

scripts_dir = 'Scripts'
for filename in os.listdir(scripts_dir):
    if not filename.endswith('.js'):
        continue
    filepath = os.path.join(scripts_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Update geojson fetches: fetch('file.geojson') -> fetch('carto/file.geojson')
    # and "file.geojson" -> "carto/file.geojson" where appropriate.
    # Actually, let's just do a specific regex for fetch
    content = re.sub(r"fetch\(['\"]([^'\"]+\.geojson)['\"]\)", r"fetch('carto/\1')", content)
    # also handle fetch(`...`) if there are any
    content = re.sub(r"fetch\(`([^`]+\.geojson)`\)", r"fetch(`carto/\1`)", content)
    
    # Update csv fetches
    content = re.sub(r"fetch\(['\"]([^'\"]+\.csv)['\"]\)", r"fetch('Tablas/\1')", content)
    
    # Update PNG assignments: imageName = 'Vuln_hogar.png' -> 'assets/Vuln_hogar.png'
    content = re.sub(r"(['\"])(Vuln_hogar\.png|Vuln_Urbana\.png|Vuln_oportunidades\.png)(['\"])", r"\1assets/\2\3", content, flags=re.IGNORECASE)
    
    # Update json fetches, like mexicoHigh.json, wait, those are http urls. Only local.
    # Check if there are any local fetch for .geojson that might have missed
    
    # Update other fetch like "limite_delegacional_Tijuana.geojson"
    
    # In escala_municipal.js, REGIONES_AGEB = { "14": "carto/agebmex.geojson", etc?
    # No, it says archivoGeojson = REGIONES_AGEB[regionKey] || "agebmex.geojson"; fetch(archivoGeojson)
    # We should make sure "agebmex.geojson" and such are fetched from carto.
    content = re.sub(r"(['\"])([a-zA-Z0-9_]+\.geojson)(['\"])", r"'carto/\2'", content)
    # Fix double carto/carto/
    content = content.replace("carto/carto/", "carto/")
    # Fix http urls that got mangled (if any .geojson in http url)
    content = re.sub(r"carto/https:", "https:", content)

    # Let's save the file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {filename}")
