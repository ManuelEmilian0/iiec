# -*- coding: utf-8 -*-
"""
red_proveeduria.py
================================================================================
Fuente "Red de proveeduría automotriz (Tier 0-3)" dentro de la arquitectura
Dataset/ del Geovisualizador IIEC.

Consume la SALIDA del modelo de gravedad + RAS (red_proveeduria_gravedad_ras.py):
    Tablas/red_proveeduria_estimada_v2.csv       -> enlaces proveedor -> comprador
y la integra con:
    Tablas/DENUE Enriquecido.csv                  -> nodos (id_ue = id_proveedor/id_comprador)
    Tablas/Resumen_OEM_Automotriz_Mexico_2026.xlsx-> contexto OEM (modelos ICE/HEV/BEV)
    Tablas/INEGI_DENUE_14092026.xlsx [ARMADORAS]  -> plantas oficiales de ensamble

Productos (misma convención que ICIO: parquet en Modelos/data, geojson en Modelos/carto):
    Modelos/data/red_proveeduria_enlaces.parquet      red completa enriquecida
    Modelos/data/red_proveeduria_enlaces_topN.parquet red filtrada (top-N por comprador)
    Modelos/data/red_proveeduria_nodos.parquet        nodos + métricas de red
    Modelos/data/cat_oem.csv                          catálogo OEM (unidad DENUE -> grupo OEM)
    Modelos/data/resumen_red_por_oem.csv              cadena Tier 1-2-3 por grupo OEM
    Modelos/carto/red_proveeduria_enlaces_topN.geojson LineString (lon/lat, CRS84)
    Modelos/carto/red_proveeduria_nodos.geojson        Point (CRS84)
    Modelos/docs/auditoria_red_proveeduria_v2.json     resultado de auditar_red()

Uso:
    python red_proveeduria.py              # top-5 proveedores por comprador
    python red_proveeduria.py --top-n 3 --solo-plantas
================================================================================
NOTA: la red es INFERIDA (gravedad + RAS). v2 sólo trae confiabilidad NODAL
(respaldo institucional IMMEX/ALTEX/PROSEC de cada nodo); ningún enlace está
confirmado a nivel par. Por eso `confianza_enlace` = "inferido" salvo que se
pase un archivo de vínculos conocidos (cruce DENUE x B2B / evidencia).
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import networkx as nx

# -----------------------------------------------------------------------------
# Rutas (relativas a Dataset/, portables entre equipos)
# -----------------------------------------------------------------------------
BASE = Path(__file__).resolve().parents[2]
TABLAS = BASE / "Tablas"
MOD_DATA = BASE / "Modelos" / "data"
MOD_CARTO = BASE / "Modelos" / "carto"
MOD_DOCS = BASE / "Modelos" / "docs"

RUTA_RED = TABLAS / "red_proveeduria_estimada_v2.csv"
RUTA_DENUE = TABLAS / "DENUE Enriquecido.csv"
RUTA_RESUMEN_OEM = TABLAS / "Resumen_OEM_Automotriz_Mexico_2026.xlsx"
RUTA_INEGI_ARMADORAS = TABLAS / "INEGI_DENUE_14092026.xlsx"

COLUMNAS_RED = [
    "tier_proveedor", "tier_comprador", "id_proveedor", "id_comprador",
    "scian_proveedor", "scian_comprador", "distancia_km", "flujo_estimado",
    "confiabilidad_nodal",
]
SCIAN_OEM = {"336110": "ligero", "336120": "pesado"}

# Nombre en DENUE -> grupo OEM del Resumen 2026 (None = fuera del resumen)
MAPEO_OEM = {
    "GENERAL MOTORS": "General Motors",
    "FORD MOTOR COMPANY": "Ford",
    "STELLANTIS": "Stellantis",
    "NISSAN": "Nissan",
    "COMPAS": "Nissan",            # COMPAS: JV Nissan–Mercedes-Benz (Aguascalientes)
    "TOYOTA": "Toyota",
    "VOLKSWAGEN": "Volkswagen",
    "KIA": "KIA / Hyundai",
    "HYUNDAI": "KIA / Hyundai",
    "BMW": "BMW",
    "FAW CAR": "JAC",              # planta Tepeapulco (Giant Motors Latinoamérica)
    # Vehículo pesado: no forman parte del resumen de vehículo ligero
    "DAIMLER": None, "DINA": None, "FOTON": None, "VOLVO BUSES": None,
    "AUTO CAMIONES DE MEXICO": None, "AMERICAN COACH DE MEXICO": None,
    "BMB LATAM": None,
}
ORDEN_CONFIABILIDAD = {"baja": 0, "media": 1, "alta": 2}


# =============================================================================
# 1. CARGA
# =============================================================================
def _leer_csv(ruta: Path, **kw) -> pd.DataFrame:
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return pd.read_csv(ruta, encoding=enc, **kw)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError(f"No se pudo decodificar {ruta}")


def _estrato_a_personal(txt: str) -> float:
    """'51 a 100 personas' -> 75.5 ; '251 y más personas' -> 400 (supuesto)."""
    nums = [int(n) for n in re.findall(r"\d+", str(txt))]
    if len(nums) >= 2:
        return (nums[0] + nums[1]) / 2
    if len(nums) == 1:
        return 400.0 if nums[0] >= 251 else float(nums[0])
    return np.nan


def cargar_unidades_denue(ruta: Path = RUTA_DENUE) -> pd.DataFrame:
    """Nodos de la red. id_unidad = int(id_ue) (llave de id_proveedor/id_comprador)."""
    d = _leer_csv(ruta, dtype=str)
    out = pd.DataFrame({
        "id_unidad": pd.to_numeric(d["id_ue"], errors="coerce").astype("Int64"),
        "id_ue": d["id_ue"],
        "nombre": d["Nombre de empresa"].str.strip(),
        "razon_social": d["Razón Social"],
        "codigo_scian": d["SCIAN"].str.zfill(6),
        "nombre_scian": d["Nombre SCIAN"],
        "clasif_denue": d["Clasificación en proveeduría"],
        "estrato": d["Estrato"],
        "capital_origen": d["Capital de origen"].str.strip(),
        "cve_ent": d["Cve. Entidad"].str.zfill(2),
        "entidad": d["Entidad"],
        "cve_mun": d["Cve. Municipio"].str.zfill(3),
        "municipio": d["Municipio"],
        "latitud": pd.to_numeric(d["latitud"], errors="coerce"),
        "longitud": pd.to_numeric(d["longitud"], errors="coerce"),
        "industria": d["Industrias agrupadas"],
        "nivel_inst": d["nivel_inst_parcial"],
    })
    out["cvegeo_mun"] = out["cve_ent"] + out["cve_mun"]   # llave a Limites_Municipales*.geojson
    out = corregir_coordenadas(out)
    out["personal_ocupado_est"] = out["estrato"].map(_estrato_a_personal)
    return out


def _reescalar(v: float, lo: float, hi: float) -> float:
    """Recupera el punto decimal perdido (p. ej. -1.064180e+08 -> -106.4180)."""
    if pd.isna(v) or lo <= v <= hi:
        return v
    x = float(v)
    while abs(x) > max(abs(lo), abs(hi)):
        x /= 10.0
    return x if lo <= x <= hi else np.nan


def corregir_coordenadas(df: pd.DataFrame) -> pd.DataFrame:
    """Conserva las coordenadas originales y corrige las que están fuera de México."""
    df = df.copy()
    df["latitud_original"], df["longitud_original"] = df["latitud"], df["longitud"]
    df["latitud"] = df["latitud"].map(lambda v: _reescalar(v, 14.0, 33.0))
    df["longitud"] = df["longitud"].map(lambda v: _reescalar(v, -118.5, -86.5))
    df["coord_corregida"] = (df["latitud"] != df["latitud_original"]) | (df["longitud"] != df["longitud_original"])
    return df


def cargar_red_v2(ruta: Path = RUTA_RED) -> pd.DataFrame:
    red = pd.read_csv(ruta, dtype={"scian_proveedor": str, "scian_comprador": str})
    faltan = set(COLUMNAS_RED) - set(red.columns)
    if faltan:
        raise ValueError(f"Columnas faltantes en {ruta.name}: {faltan}")
    red["confiabilidad"] = red["confiabilidad_nodal"].str.split().str[0]
    return red


def cargar_resumen_oem(ruta: Path = RUTA_RESUMEN_OEM) -> pd.DataFrame:
    """Hoja 'Resumen por OEM' -> tabla ordenada (la columna Total venía vacía: se recalcula)."""
    raw = pd.read_excel(ruta, header=None)
    fila_enc = raw.index[raw.apply(lambda r: r.astype(str).str.strip().eq("OEM").any(), axis=1)][0]
    df = raw.iloc[fila_enc + 1:, 1:6].copy()
    df.columns = ["oem", "modelos_ice", "modelos_hev_phev", "modelos_bev", "total_modelos"]
    df = df[df["oem"].notna() & ~df["oem"].astype(str).str.upper().eq("TOTAL")]
    for c in ["modelos_ice", "modelos_hev_phev", "modelos_bev"]:
        df[c] = pd.to_numeric(df[c].astype(str).str.replace("—", "0"), errors="coerce").fillna(0).astype(int)
    df["total_modelos"] = df[["modelos_ice", "modelos_hev_phev", "modelos_bev"]].sum(axis=1)
    df["oem"] = df["oem"].astype(str).str.replace(r"\s*\(2026\)", "", regex=True).str.strip()
    df["modelos_electrificados"] = df["modelos_hev_phev"] + df["modelos_bev"]
    return df.reset_index(drop=True)


def cargar_plantas_oem_inegi(ruta: Path = RUTA_INEGI_ARMADORAS) -> pd.DataFrame:
    a = pd.read_excel(ruta, sheet_name="ARMADORAS")
    a = a[a["TIPO"].astype(str).str.upper().str.startswith("ARMADORA")].copy()
    return pd.DataFrame({
        "marca": a["MARCA"], "planta": a["Nombre de la Unidad Económica"],
        "entidad": a["Entidad federativa"].astype(str).str.strip(),
        "municipio": a["Municipio"].astype(str).str.strip(),
        "latitud": pd.to_numeric(a["Latitud"], errors="coerce"),
        "longitud": pd.to_numeric(a["Longitud"], errors="coerce"),
        "vigente": ~a["TIPO"].astype(str).str.contains("hasta", case=False),
    }).reset_index(drop=True)


def cargar_vinculos_conocidos(ruta: Optional[Path]) -> pd.DataFrame:
    if ruta is None or not Path(ruta).exists():
        return pd.DataFrame(columns=["id_proveedor", "id_comprador", "fuente"])
    return pd.read_csv(ruta)


# =============================================================================
# 2. UTILIDADES
# =============================================================================
def distancia_haversine_km(lat1, lon1, lat2, lon2) -> np.ndarray:
    lat1, lon1, lat2, lon2 = map(lambda x: np.radians(np.asarray(x, float)), (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * np.arcsin(np.sqrt(a))


# =============================================================================
# 3. CATÁLOGO OEM (Tier 0)
# =============================================================================
def construir_catalogo_oem(unidades: pd.DataFrame, resumen: pd.DataFrame,
                           plantas: pd.DataFrame, radio_planta_km: float = 5.0) -> pd.DataFrame:
    """Une cada unidad DENUE SCIAN 336110/336120 con su grupo OEM y valida si
    coincide espacialmente con una planta de ensamble oficial (INEGI)."""
    oem = unidades[unidades["codigo_scian"].isin(SCIAN_OEM)].copy()
    oem["segmento"] = oem["codigo_scian"].map(SCIAN_OEM)
    oem["oem_grupo"] = oem["nombre"].map(MAPEO_OEM)
    oem["en_resumen_2026"] = oem["oem_grupo"].isin(resumen["oem"])
    p = plantas.dropna(subset=["latitud", "longitud"])
    dist = distancia_haversine_km(oem["latitud"].to_numpy()[:, None], oem["longitud"].to_numpy()[:, None],
                                  p["latitud"].to_numpy()[None, :], p["longitud"].to_numpy()[None, :])
    j = dist.argmin(axis=1)
    oem["planta_inegi_cercana"] = p["planta"].to_numpy()[j]
    oem["dist_planta_inegi_km"] = dist[np.arange(len(oem)), j].round(2)
    oem["es_planta_ensamble"] = oem["dist_planta_inegi_km"] <= radio_planta_km
    return oem[["id_unidad", "nombre", "codigo_scian", "segmento", "oem_grupo", "en_resumen_2026",
                "entidad", "municipio", "cvegeo_mun", "latitud", "longitud", "clasif_denue",
                "planta_inegi_cercana", "dist_planta_inegi_km", "es_planta_ensamble"]].reset_index(drop=True)


# =============================================================================
# 4. AUDITORÍA
# =============================================================================
def auditar_red(red: pd.DataFrame, unidades: pd.DataFrame, catalogo: pd.DataFrame,
                resumen: pd.DataFrame) -> dict:
    """Pruebas de viabilidad. Estado: OK / ADVERTENCIA / CRITICO (limita el alcance) / ERROR (invalida)."""
    res: dict = {"archivo": RUTA_RED.name, "filas": int(len(red)), "pruebas": []}

    def prueba(nombre, estado, detalle):
        res["pruebas"].append({"prueba": nombre, "estado": estado, "detalle": detalle})

    # Esquema y nulos
    nulos = int(red[COLUMNAS_RED].isna().sum().sum())
    prueba("Esquema y valores nulos", "OK" if nulos == 0 else "ERROR",
           f"9 columnas esperadas presentes; {nulos} nulos")

    # Integridad referencial
    ids = set(unidades["id_unidad"].dropna().astype(int))
    fp = int((~red["id_proveedor"].isin(ids)).sum()); fc = int((~red["id_comprador"].isin(ids)).sum())
    prueba("Integridad referencial id -> DENUE Enriquecido.id_ue", "OK" if fp + fc == 0 else "ERROR",
           f"proveedores huérfanos={fp}, compradores huérfanos={fc}; "
           f"{red['id_proveedor'].nunique()} proveedores y {red['id_comprador'].nunique()} compradores únicos")

    # Coherencia SCIAN
    sc = unidades.set_index("id_unidad")["codigo_scian"]
    ok_p = (red["id_proveedor"].map(sc) == red["scian_proveedor"]).mean()
    ok_c = (red["id_comprador"].map(sc) == red["scian_comprador"]).mean()
    prueba("Coherencia SCIAN enlace vs DENUE", "OK" if min(ok_p, ok_c) == 1 else "ERROR",
           f"proveedor {ok_p:.1%}, comprador {ok_c:.1%}")

    # Distancias recalculadas
    u = unidades.set_index("id_unidad")
    d = distancia_haversine_km(red["id_proveedor"].map(u["latitud_original"]), red["id_proveedor"].map(u["longitud_original"]),
                               red["id_comprador"].map(u["latitud_original"]), red["id_comprador"].map(u["longitud_original"]))
    err = np.abs(d - red["distancia_km"])
    prueba("Distancia Haversine reproducible (coordenadas originales)", "OK" if err.max() < 0.01 else "ADVERTENCIA",
           f"error máximo {err.max():.6f} km")

    # Coordenadas fuera de rango en DENUE (punto decimal perdido)
    malas = u[u["coord_corregida"]]
    ids_malos = set(malas.index.astype(int))
    afect = red["id_proveedor"].isin(ids_malos) | red["id_comprador"].isin(ids_malos)
    prueba("Coordenadas válidas de los nodos", "ADVERTENCIA" if afect.any() else "OK",
           f"{len(malas)} UE en DENUE con longitud sin punto decimal "
           + "; ".join(f"{i} {r.nombre} ({r.municipio}): {r.longitud_original:.4g} -> {r.longitud:.4f}" for i, r in malas.iterrows())
           + f". {int(afect.sum())} enlaces de la red se calcularon con esas distancias erróneas "
           f"(mediana {red.loc[afect, 'distancia_km'].median():.0f} km): su flujo está subestimado; "
           "se corrigen coordenadas y distancia_km_corregida, pero el flujo requiere re-ejecutar gravedad+RAS")

    # Duplicados / lazos / flujos
    dup = int(red.duplicated(["id_proveedor", "id_comprador"]).sum())
    lazo = int((red["id_proveedor"] == red["id_comprador"]).sum())
    neg = int((red["flujo_estimado"] <= 0).sum())
    prueba("Duplicados, autoenlaces y flujos no positivos", "OK" if dup + lazo + neg == 0 else "ERROR",
           f"duplicados={dup}, autoenlaces={lazo}, flujo<=0={neg}")

    # Jerarquía de tiers
    salto = int((red["tier_proveedor"] - red["tier_comprador"] != 1).sum())
    prueba("Jerarquía Tier consecutiva (proveedor = comprador + 1)", "OK" if salto == 0 else "ERROR",
           f"{salto} enlaces rompen la jerarquía; pares: "
           + ", ".join(f"T{a}->T{b}: {n}" for (a, b), n in red.groupby(['tier_proveedor', 'tier_comprador']).size().items()))

    # Continuidad de la cadena: los compradores del nivel k deben ser proveedores del nivel k-1
    detalle, critico = [], False
    for t in (1, 2):
        compr = set(red.loc[red["tier_comprador"] == t, "id_comprador"])
        prov = set(red.loc[red["tier_proveedor"] == t, "id_proveedor"])
        comun = len(compr & prov)
        detalle.append(f"Tier {t}: {comun}/{len(compr)} compradores también venden al Tier {t-1}")
        if compr and comun == 0:
            critico = True
            sc_c = sorted(red.loc[red["tier_comprador"] == t, "scian_comprador"].unique())
            sc_p = sorted(red.loc[red["tier_proveedor"] == t, "scian_proveedor"].unique())
            detalle.append(f"-> cadena ROTA: Tier {t} comprador (SCIAN {sc_c}) ≠ Tier {t} proveedor (SCIAN {sc_p}); "
                           f"el Tier {t+1} no puede rastrearse hasta los OEM")
    prueba("Continuidad de la cadena Tier 3 -> 2 -> 1 -> 0", "CRITICO" if critico else "OK", "; ".join(detalle))

    # Tier vs clasificación DENUE
    t0 = catalogo["clasif_denue"].value_counts().to_dict()
    prueba("Tier 0 vs 'Clasificación en proveeduría' (DENUE)", "ADVERTENCIA",
           f"las {len(catalogo)} unidades SCIAN 336110/336120 (Tier 0 en la red) están clasificadas en DENUE como {t0}; "
           "el tier de la red proviene del SCIAN, no de esa columna")

    # Densidad
    dens = []
    for (a, b), g in red.groupby(["tier_proveedor", "tier_comprador"]):
        posibles = g["id_proveedor"].nunique() * g["id_comprador"].nunique()
        dens.append(f"T{a}->T{b}: {len(g)}/{posibles} = {len(g)/posibles:.0%}")
    prueba("Densidad de la red (sin umbral de distancia)", "ADVERTENCIA",
           "; ".join(dens) + f". Distancia mediana {red['distancia_km'].median():.0f} km. "
           "Casi todos los pares compatibles existen: filtrar antes de visualizar")

    # Concentración del flujo
    f = red["flujo_estimado"].sort_values(ascending=False)
    k = int((f.cumsum() / f.sum() <= 0.8).sum()) + 1
    prueba("Concentración del flujo", "OK",
           f"{k} enlaces ({k/len(f):.1%}) concentran el 80% del flujo estimado; mediana {f.median():.4f}, máx {f.max():.2f}")

    # Confiabilidad
    conf = red["confiabilidad"].value_counts(normalize=True).round(3).to_dict()
    prueba("Confiabilidad nodal", "ADVERTENCIA",
           f"{conf}. Es confirmación institucional de NODOS; no hay confirmación de ENLACES (DENUE x B2B)")

    # Trazabilidad del modelo
    faltantes = [c for c in ("coeficiente_tecnico", "beta_usado", "masa_p", "masa_c") if c not in red.columns]
    prueba("Trazabilidad de parámetros del modelo", "ADVERTENCIA" if faltantes else "OK",
           f"no incluye {faltantes}: no es posible reproducir gravedad/RAS sólo con el CSV")

    # Cobertura OEM
    cubiertos = set(catalogo["oem_grupo"].dropna())
    sin = sorted(set(resumen["oem"]) - cubiertos)
    oficinas = catalogo[~catalogo["es_planta_ensamble"]]
    prueba("Cobertura de OEM del Resumen 2026", "ADVERTENCIA" if sin else "OK",
           f"OEM sin unidad Tier 0 en la red: {sin}")
    prueba("Unidades Tier 0 que no son planta de ensamble", "ADVERTENCIA" if len(oficinas) else "OK",
           f"{len(oficinas)} de {len(catalogo)} unidades a más de 5 km de una planta INEGI "
           f"(oficinas, pesados o plantas no listadas): "
           + "; ".join(f"{r.nombre} ({r.municipio}, {r.dist_planta_inegi_km} km)" for r in oficinas.itertuples()))

    # Dictamen
    estados = [p["estado"] for p in res["pruebas"]]
    res["dictamen"] = ("NO VIABLE" if "ERROR" in estados else
                       "VIABLE PARCIAL (Tier 0-1-2); Tier 3 desconectado" if "CRITICO" in estados else
                       "VIABLE CON AJUSTES" if "ADVERTENCIA" in estados else "VIABLE")
    return res


# =============================================================================
# 5. ENRIQUECIMIENTO, CONFIANZA Y FILTRADO
# =============================================================================
def enriquecer_red(red: pd.DataFrame, unidades: pd.DataFrame, catalogo: pd.DataFrame) -> pd.DataFrame:
    cols = ["id_unidad", "nombre", "cve_ent", "entidad", "municipio", "cvegeo_mun", "latitud", "longitud"]
    u = unidades[cols]
    e = red.merge(u.add_suffix("_p"), left_on="id_proveedor", right_on="id_unidad_p", how="left") \
           .merge(u.add_suffix("_c"), left_on="id_comprador", right_on="id_unidad_c", how="left") \
           .drop(columns=["id_unidad_p", "id_unidad_c"])
    cat = catalogo.set_index("id_unidad")
    e["oem_grupo_c"] = e["id_comprador"].map(cat["oem_grupo"])
    e["misma_entidad"] = e["cve_ent_p"] == e["cve_ent_c"]
    e["distancia_km_corregida"] = distancia_haversine_km(e["latitud_p"], e["longitud_p"], e["latitud_c"], e["longitud_c"])
    e["coord_corregida"] = ~np.isclose(e["distancia_km_corregida"], e["distancia_km"], atol=0.01)
    e["participacion_comprador"] = e["flujo_estimado"] / e.groupby("id_comprador")["flujo_estimado"].transform("sum")
    return e


def etiquetar_confianza(enlaces: pd.DataFrame, vinculos_conocidos: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    """'confirmado' si el par aparece en evidencia (DENUE x B2B, clúster...), si no 'inferido'."""
    e = enlaces.copy()
    conocidos = set()
    if vinculos_conocidos is not None and not vinculos_conocidos.empty:
        conocidos = set(zip(vinculos_conocidos["id_proveedor"].astype(int), vinculos_conocidos["id_comprador"].astype(int)))
    e["confianza_enlace"] = [
        "confirmado" if (p, c) in conocidos else "inferido" for p, c in zip(e["id_proveedor"], e["id_comprador"])
    ]
    return e


def filtrar_red(enlaces: pd.DataFrame, top_n: Optional[int] = 5,
                participacion_acumulada: Optional[float] = None,
                confiabilidad_min: Optional[str] = None,
                distancia_max_km: Optional[float] = None,
                excluir_ids: Optional[set] = None) -> pd.DataFrame:
    """Reduce la red densa a los enlaces relevantes por comprador.
    top_n                  : N proveedores de mayor flujo por comprador.
    participacion_acumulada: p. ej. 0.8 -> proveedores que suman el 80% del flujo del comprador.
    confiabilidad_min      : 'media' o 'alta'.
    excluir_ids            : nodos a retirar (p. ej. oficinas corporativas Tier 0)."""
    e = enlaces
    if excluir_ids:
        e = e[~e["id_comprador"].isin(excluir_ids) & ~e["id_proveedor"].isin(excluir_ids)]
    if confiabilidad_min:
        e = e[e["confiabilidad"].map(ORDEN_CONFIABILIDAD) >= ORDEN_CONFIABILIDAD[confiabilidad_min]]
    if distancia_max_km:
        e = e[e["distancia_km"] <= distancia_max_km]
    e = e.sort_values(["id_comprador", "flujo_estimado"], ascending=[True, False])
    if participacion_acumulada:
        acum = e.groupby("id_comprador")["flujo_estimado"].cumsum() / e.groupby("id_comprador")["flujo_estimado"].transform("sum")
        e = e[(acum - e["flujo_estimado"] / e.groupby("id_comprador")["flujo_estimado"].transform("sum")) < participacion_acumulada]
    if top_n:
        e = e.groupby("id_comprador").head(top_n)
    return e.reset_index(drop=True)


# =============================================================================
# 6. GRAFO, MÉTRICAS Y CADENAS POR OEM
# =============================================================================
def construir_grafo(enlaces: pd.DataFrame) -> nx.DiGraph:
    """Grafo dirigido proveedor -> comprador. 'peso' = flujo; 'costo' = 1/flujo
    (para caminos más cortos/intermediación: más flujo = vínculo más 'cercano')."""
    g = nx.DiGraph()
    for r in enlaces.itertuples(index=False):
        g.add_edge(int(r.id_proveedor), int(r.id_comprador), peso=float(r.flujo_estimado),
                   costo=1.0 / float(r.flujo_estimado), distancia_km=float(r.distancia_km),
                   confiabilidad=r.confiabilidad)
    return g


def metricas_red(g: nx.DiGraph) -> pd.DataFrame:
    n = list(g.nodes())
    gs, ge = dict(g.out_degree(weight="peso")), dict(g.in_degree(weight="peso"))
    bt = nx.betweenness_centrality(g, weight="costo", normalized=True)
    pr = nx.pagerank(g.reverse(copy=False), weight="peso")   # importancia aguas arriba
    return pd.DataFrame({
        "id_unidad": n,
        "n_clientes": [g.out_degree(x) for x in n],
        "n_proveedores": [g.in_degree(x) for x in n],
        "grado_salida_ponderado": [gs.get(x, 0) for x in n],
        "grado_entrada_ponderado": [ge.get(x, 0) for x in n],
        "centralidad_intermediacion": [bt.get(x, 0) for x in n],
        "pagerank_proveeduria": [pr.get(x, 0) for x in n],
    }).sort_values("centralidad_intermediacion", ascending=False).reset_index(drop=True)


def cadena_oem(g: nx.DiGraph, ids_oem: list[int], tier: dict) -> dict:
    """Proveedores aguas arriba de un conjunto de plantas, separados por tier."""
    arriba = set()
    for i in ids_oem:
        if i in g:
            arriba |= nx.ancestors(g, i)
    return {t: sorted(x for x in arriba if tier.get(x) == t) for t in (1, 2, 3)}


def resumen_red_por_oem(enlaces_f: pd.DataFrame, g: nx.DiGraph, catalogo: pd.DataFrame,
                        resumen: pd.DataFrame, unidades: pd.DataFrame) -> pd.DataFrame:
    tier = dict(zip(enlaces_f["id_proveedor"], enlaces_f["tier_proveedor"]))
    tier.update(dict(zip(enlaces_f["id_comprador"], enlaces_f["tier_comprador"])))
    ent = unidades.set_index("id_unidad")["entidad"]
    filas = []
    for grupo, sub in catalogo.dropna(subset=["oem_grupo"]).groupby("oem_grupo"):
        ids = sub["id_unidad"].astype(int).tolist()
        c = cadena_oem(g, ids, tier)
        directos = enlaces_f[enlaces_f["id_comprador"].isin(ids)]
        filas.append({
            "oem": grupo,
            "unidades_tier0": len(ids),
            "plantas_ensamble": int(sub["es_planta_ensamble"].sum()),
            "entidades_tier0": ", ".join(sorted(sub["entidad"].unique())),
            "proveedores_t1": len(c[1]), "proveedores_t2": len(c[2]), "proveedores_t3": len(c[3]),
            "entidades_proveedoras_t1": int(ent.reindex(c[1]).nunique()),
            "flujo_directo_t1": round(directos["flujo_estimado"].sum(), 4),
            "dist_media_pond_t1_km": round(np.average(directos["distancia_km"], weights=directos["flujo_estimado"]), 1)
                                      if len(directos) else np.nan,
            "pct_enlaces_t1_alta": round((directos["confiabilidad"] == "alta").mean() * 100, 1) if len(directos) else np.nan,
        })
    out = resumen.merge(pd.DataFrame(filas), on="oem", how="outer")
    out["en_red"] = out["unidades_tier0"].fillna(0) > 0
    return out.sort_values(["en_red", "flujo_directo_t1"], ascending=[False, False]).reset_index(drop=True)


# =============================================================================
# 7. EXPORTACIÓN GEOJSON (CRS84, compatible con Leaflet del geovisualizador)
# =============================================================================
def _fc(features):
    return {"type": "FeatureCollection",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
            "features": features}


def exportar_geojson_enlaces(e: pd.DataFrame, ruta: Path) -> None:
    feats = []
    for r in e.itertuples(index=False):
        feats.append({"type": "Feature",
                      "geometry": {"type": "LineString",
                                   "coordinates": [[round(r.longitud_p, 6), round(r.latitud_p, 6)],
                                                   [round(r.longitud_c, 6), round(r.latitud_c, 6)]]},
                      "properties": {"id_proveedor": int(r.id_proveedor), "id_comprador": int(r.id_comprador),
                                     "proveedor": r.nombre_p, "comprador": r.nombre_c,
                                     "tier_proveedor": int(r.tier_proveedor), "tier_comprador": int(r.tier_comprador),
                                     "enlace": f"T{int(r.tier_proveedor)}-T{int(r.tier_comprador)}",
                                     "oem_grupo": r.oem_grupo_c if isinstance(r.oem_grupo_c, str) else None,
                                     "entidad_p": r.entidad_p, "entidad_c": r.entidad_c,
                                     "distancia_km": round(r.distancia_km, 2),
                                     "distancia_km_corregida": round(r.distancia_km_corregida, 2),
                                     "coord_corregida": bool(r.coord_corregida),
                                     "flujo_estimado": round(r.flujo_estimado, 6),
                                     "participacion_comprador": round(r.participacion_comprador, 4),
                                     "confiabilidad": r.confiabilidad, "confianza_enlace": r.confianza_enlace}})
    ruta.write_text(json.dumps(_fc(feats), ensure_ascii=False), encoding="utf-8")


def exportar_geojson_nodos(nodos: pd.DataFrame, ruta: Path) -> None:
    feats = []
    for r in nodos.to_dict("records"):
        props = {k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in r.items()
                 if k not in ("latitud", "longitud")}
        props = {k: (int(v) if isinstance(v, (np.integer,)) else float(v) if isinstance(v, np.floating) else
                     bool(v) if isinstance(v, np.bool_) else v) for k, v in props.items()}
        feats.append({"type": "Feature",
                      "geometry": {"type": "Point", "coordinates": [round(r["longitud"], 6), round(r["latitud"], 6)]},
                      "properties": props})
    ruta.write_text(json.dumps(_fc(feats), ensure_ascii=False, default=str), encoding="utf-8")


# =============================================================================
# 8. PIPELINE
# =============================================================================
def ejecutar_pipeline(top_n: int = 5, solo_plantas: bool = False,
                      ruta_vinculos: Optional[Path] = None, exportar: bool = True) -> dict:
    unidades = cargar_unidades_denue()
    red = cargar_red_v2()
    resumen = cargar_resumen_oem()
    plantas = cargar_plantas_oem_inegi()
    catalogo = construir_catalogo_oem(unidades, resumen, plantas)

    auditoria = auditar_red(red, unidades, catalogo, resumen)

    enlaces = etiquetar_confianza(enriquecer_red(red, unidades, catalogo), cargar_vinculos_conocidos(ruta_vinculos))
    excluir = set(catalogo.loc[~catalogo["es_planta_ensamble"], "id_unidad"].astype(int)) if solo_plantas else None
    filtrada = filtrar_red(enlaces, top_n=top_n, excluir_ids=excluir)

    g = construir_grafo(filtrada)
    met = metricas_red(g)
    tier_nodo = pd.concat([
        filtrada[["id_proveedor", "tier_proveedor"]].set_axis(["id_unidad", "tier"], axis=1),
        filtrada[["id_comprador", "tier_comprador"]].set_axis(["id_unidad", "tier"], axis=1),
    ]).groupby("id_unidad")["tier"].agg(lambda s: "/".join(str(x) for x in sorted(s.unique()))).rename("tier_red")
    nodos = (unidades.merge(met, on="id_unidad", how="inner")
                     .merge(tier_nodo, left_on="id_unidad", right_index=True, how="left")
                     .merge(catalogo[["id_unidad", "oem_grupo", "es_planta_ensamble"]], on="id_unidad", how="left"))
    resumen_oem = resumen_red_por_oem(filtrada, g, catalogo, resumen, unidades)

    if exportar:
        for p in (MOD_DATA, MOD_CARTO, MOD_DOCS):
            p.mkdir(parents=True, exist_ok=True)
        sufijo = f"top{top_n}" + ("_plantas" if solo_plantas else "")
        enlaces.to_parquet(MOD_DATA / "red_proveeduria_enlaces.parquet", index=False)
        filtrada.to_parquet(MOD_DATA / f"red_proveeduria_enlaces_{sufijo}.parquet", index=False)
        nodos.to_parquet(MOD_DATA / "red_proveeduria_nodos.parquet", index=False)
        catalogo.to_csv(MOD_DATA / "cat_oem.csv", index=False, encoding="utf-8-sig")
        resumen_oem.to_csv(MOD_DATA / "resumen_red_por_oem.csv", index=False, encoding="utf-8-sig")
        exportar_geojson_enlaces(filtrada, MOD_CARTO / f"red_proveeduria_enlaces_{sufijo}.geojson")
        exportar_geojson_nodos(nodos[["id_unidad", "nombre", "codigo_scian", "tier_red", "oem_grupo",
                                      "es_planta_ensamble", "entidad", "municipio", "cvegeo_mun",
                                      "nivel_inst", "n_clientes", "n_proveedores",
                                      "grado_salida_ponderado", "grado_entrada_ponderado",
                                      "centralidad_intermediacion", "pagerank_proveeduria",
                                      "latitud", "longitud"]],
                               MOD_CARTO / "red_proveeduria_nodos.geojson")
        (MOD_DOCS / "auditoria_red_proveeduria_v2.json").write_text(
            json.dumps(auditoria, ensure_ascii=False, indent=2), encoding="utf-8")

    return {"auditoria": auditoria, "catalogo": catalogo, "enlaces": enlaces, "filtrada": filtrada,
            "grafo": g, "metricas": met, "nodos": nodos, "resumen_oem": resumen_oem}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Red de proveeduría automotriz — Geovisualizador IIEC")
    ap.add_argument("--top-n", type=int, default=5)
    ap.add_argument("--solo-plantas", action="store_true", help="excluir Tier 0 que no son planta de ensamble")
    ap.add_argument("--vinculos", type=Path, default=None, help="CSV id_proveedor,id_comprador,fuente")
    a = ap.parse_args()
    r = ejecutar_pipeline(top_n=a.top_n, solo_plantas=a.solo_plantas, ruta_vinculos=a.vinculos)
    print(f"\nDICTAMEN: {r['auditoria']['dictamen']}")
    for p in r["auditoria"]["pruebas"]:
        print(f"  [{p['estado']:<11}] {p['prueba']}: {p['detalle'][:160]}")
    print(f"\nRed filtrada: {len(r['filtrada'])} enlaces, {r['grafo'].number_of_nodes()} nodos")
    print(r["resumen_oem"].to_string(index=False))
    print("\nTop 10 nodos por intermediación:")
    print(r["nodos"].sort_values("centralidad_intermediacion", ascending=False)
          [["id_unidad", "nombre", "tier_red", "entidad", "centralidad_intermediacion", "n_clientes"]].head(10).to_string(index=False))
