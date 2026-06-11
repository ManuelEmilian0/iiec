"""
Backend FastAPI para análisis de redes OECD ICIO con detección de comunidades Louvain.
Proyecto académico – Instituto de Investigaciones Económicas, UNAM.
"""

import time
import logging
from pathlib import Path
from itertools import combinations
from typing import Optional

import pandas as pd
import networkx as nx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# ──────────────────────────────────────────────
# Configuración de logging
# ──────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Ruta base donde se encuentran los archivos parquet
# ──────────────────────────────────────────────
DATA_DIR = Path(r"C:\iiec\iiec-main\Modelos\data")

# ──────────────────────────────────────────────
# Coordenadas geográficas (lat, lon) por código de país ICIO
# ──────────────────────────────────────────────
COUNTRY_COORDS = {
    "AGO": (-8.84, 13.23), "ARE": (23.42, 53.85), "ARG": (-38.42, -63.62),
    "AUS": (-25.27, 133.78), "AUT": (47.52, 14.55), "BEL": (50.50, 4.47),
    "BGD": (23.68, 90.36), "BGR": (42.73, 25.49), "BLR": (53.71, 27.95),
    "BRA": (-14.24, -51.93), "BRN": (4.54, 114.73), "CAN": (56.13, -106.35),
    "CHE": (46.82, 8.23), "CHL": (-35.68, -71.54), "CHN": (35.86, 104.20),
    "CIV": (7.54, -5.55), "CMR": (7.37, 12.35), "COD": (-4.04, 21.76),
    "COL": (4.57, -74.30), "CRI": (9.75, -83.75), "CYP": (35.13, 33.43),
    "CZE": (49.82, 15.47), "DEU": (51.17, 10.45), "DNK": (56.26, 9.50),
    "EGY": (26.82, 30.80), "ESP": (40.46, -3.75), "EST": (58.60, 25.01),
    "FIN": (61.92, 25.75), "FRA": (46.23, 2.21), "GBR": (55.38, -3.44),
    "GRC": (39.07, 21.82), "HKG": (22.40, 114.11), "HRV": (45.10, 15.20),
    "HUN": (47.16, 19.50), "IDN": (-0.79, 113.92), "IND": (20.59, 78.96),
    "IRL": (53.14, -7.69), "ISL": (64.96, -19.02), "ISR": (31.05, 34.85),
    "ITA": (41.87, 12.57), "JOR": (30.59, 36.24), "JPN": (36.20, 138.25),
    "KAZ": (48.02, 66.92), "KHM": (12.57, 104.99), "KOR": (35.91, 127.77),
    "LAO": (19.86, 102.50), "LTU": (55.17, 23.88), "LUX": (49.82, 6.13),
    "LVA": (56.88, 24.60), "MAR": (31.79, -7.09), "MEX": (23.63, -102.55),
    "MLT": (35.94, 14.38), "MMR": (21.91, 95.96), "MYS": (4.21, 101.98),
    "NGA": (9.08, 8.68), "NLD": (52.13, 5.29), "NOR": (60.47, 8.47),
    "NZL": (-40.90, 174.89), "PAK": (30.38, 69.35), "PER": (-9.19, -75.02),
    "PHL": (12.88, 121.77), "POL": (51.92, 19.15), "PRT": (39.40, -8.22),
    "ROU": (45.94, 24.97), "ROW": (0.0, 0.0), "RUS": (61.52, 105.32),
    "SAU": (23.89, 45.08), "SEN": (14.50, -14.45), "SGP": (1.35, 103.82),
    "STP": (0.19, 6.61), "SVK": (48.67, 19.70), "SVN": (46.15, 14.99),
    "SWE": (60.13, 18.64), "THA": (15.87, 100.99), "TUN": (33.89, 9.54),
    "TUR": (38.96, 35.24), "TWN": (23.70, 120.96), "UKR": (48.38, 31.17),
    "USA": (37.09, -95.71), "VNM": (14.06, 108.28), "ZAF": (-30.56, 22.94),
}

# ──────────────────────────────────────────────
# Nombres de países en español
# ──────────────────────────────────────────────
COUNTRY_NAMES = {
    "AGO": "Angola", "ARE": "Emiratos Árabes", "ARG": "Argentina",
    "AUS": "Australia", "AUT": "Austria", "BEL": "Bélgica",
    "BGD": "Bangladesh", "BGR": "Bulgaria", "BLR": "Bielorrusia",
    "BRA": "Brasil", "BRN": "Brunéi", "CAN": "Canadá",
    "CHE": "Suiza", "CHL": "Chile", "CHN": "China",
    "CIV": "Costa de Marfil", "CMR": "Camerún", "COD": "R.D. Congo",
    "COL": "Colombia", "CRI": "Costa Rica", "CYP": "Chipre",
    "CZE": "Chequia", "DEU": "Alemania", "DNK": "Dinamarca",
    "EGY": "Egipto", "ESP": "España", "EST": "Estonia",
    "FIN": "Finlandia", "FRA": "Francia", "GBR": "Reino Unido",
    "GRC": "Grecia", "HKG": "Hong Kong", "HRV": "Croacia",
    "HUN": "Hungría", "IDN": "Indonesia", "IND": "India",
    "IRL": "Irlanda", "ISL": "Islandia", "ISR": "Israel",
    "ITA": "Italia", "JOR": "Jordania", "JPN": "Japón",
    "KAZ": "Kazajistán", "KHM": "Camboya", "KOR": "Corea del Sur",
    "LAO": "Laos", "LTU": "Lituania", "LUX": "Luxemburgo",
    "LVA": "Letonia", "MAR": "Marruecos", "MEX": "México",
    "MLT": "Malta", "MMR": "Myanmar", "MYS": "Malasia",
    "NGA": "Nigeria", "NLD": "Países Bajos", "NOR": "Noruega",
    "NZL": "Nueva Zelanda", "PAK": "Pakistán", "PER": "Perú",
    "PHL": "Filipinas", "POL": "Polonia", "PRT": "Portugal",
    "ROU": "Rumania", "ROW": "Resto del Mundo", "RUS": "Rusia",
    "SAU": "Arabia Saudita", "SEN": "Senegal", "SGP": "Singapur",
    "STP": "S. Tomé y Príncipe", "SVK": "Eslovaquia", "SVN": "Eslovenia",
    "SWE": "Suecia", "THA": "Tailandia", "TUN": "Túnez",
    "TUR": "Turquía", "TWN": "Taiwán", "UKR": "Ucrania",
    "USA": "Estados Unidos", "VNM": "Vietnam", "ZAF": "Sudáfrica",
}

# ──────────────────────────────────────────────
# Nombres de sectores en español
# ──────────────────────────────────────────────
SECTOR_NAMES = {
    "ADPDEF": "Admin. Pública y Defensa", "AGRPFO": "Agricultura y Forestería",
    "AGUBAS": "Agua y Basura", "ALMSTR": "Almacenamiento",
    "ALYBEB": "Alimentos y Bebidas", "AUTOMO": "Automotriz",
    "COMREV": "Comercio", "CONSTR": "Construcción",
    "EDUCAC": "Educación", "ELCTRI": "Eléctrica",
    "ELCTRO": "Electrónica", "ELEGAS": "Electricidad y Gas",
    "ESPARC": "Esparcimiento", "FARMED": "Farmacéutica",
    "FORLOG": "Forestal y Logística", "GOBEST": "Gobierno Estatal",
    "HOTYRE": "Hotelería y Restaurantes", "HUPLAS": "Hule y Plástico",
    "ITSERV": "Servicios TI", "MADYPR": "Madera y Productos",
    "MAQYEQ": "Maquinaria y Equipo", "METBAS": "Metales Básicos",
    "MINCOL": "Minería (Carbón)", "MINORE": "Minería (Minerales)",
    "MINOTH": "Minería (Otros)", "MINSER": "Servicios Mineros",
    "MMTVRA": "Materiales de Transporte", "NONFER": "No Ferrosos",
    "OTRMAN": "Otras Manufacturas", "OTRSER": "Otros Servicios",
    "OTRTRA": "Otro Transporte", "PAPYPR": "Papel y Productos",
    "PESCAC": "Pesca y Acuacultura", "PETGAS": "Petróleo y Gas",
    "PETREF": "Refinación Petróleo", "POSTME": "Correo y Mensajería",
    "PRMETA": "Productos Metálicos", "PRNOMT": "Productos No Metálicos",
    "QUIMYP": "Química y Petroquímica", "SALUDH": "Salud",
    "SEAEMP": "Servicios Empresariales", "SERFIN": "Servicios Financieros",
    "SERHOG": "Servicios de Hogar", "SPRSCT": "Servicios Prof. y Científicos",
    "TELECO": "Telecomunicaciones", "TEXYPR": "Textiles y Prendas",
    "TRAAIR": "Transporte Aéreo", "TRAGUA": "Transporte Acuático",
    "TRANSP": "Transporte Terrestre", "TRATIE": "Transporte Terrestre (Int.)",
}

# Sectores por defecto para el análisis
DEFAULT_SECTORS = "ELCTRI,TELECO,ITSERV,ELCTRO,MMTVRA,AUTOMO"

# ──────────────────────────────────────────────
# Inicialización de la aplicación FastAPI
# ──────────────────────────────────────────────
app = FastAPI(
    title="OECD ICIO – Análisis de Redes Louvain",
    description="API para detección de comunidades en cadenas globales de valor (OECD ICIO).",
    version="1.0.0",
)

# CORS abierto para desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Funciones auxiliares
# ──────────────────────────────────────────────

def _read_parquet(anio: int) -> pd.DataFrame:
    """Lee el archivo parquet correspondiente al año indicado."""
    filepath = DATA_DIR / f"ICIO_DATA_{anio}.parquet"
    if not filepath.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró el archivo de datos para el año {anio}: {filepath.name}",
        )
    return pd.read_parquet(filepath)


def _parse_index(df: pd.DataFrame) -> pd.DataFrame:
    """
    Separa la columna INDEX (formato COUNTRY_SECTOR) en dos columnas:
    'country' y 'sector'.  El código de país son los primeros 3 caracteres
    y el sector es todo lo que sigue después del primer guion bajo.
    """
    df = df.copy()
    df["country"] = df["INDEX"].str.split("_").str[0]
    df["sector"] = df["INDEX"].str.split("_", n=1).str[1]
    return df


def _normalize_sizes(values: dict, min_size: float = 80.0, max_size: float = 300.0) -> dict:
    """
    Normaliza un diccionario {key: valor} al rango [min_size, max_size].
    Si todos los valores son iguales devuelve el punto medio.
    """
    if not values:
        return {}
    vals = list(values.values())
    lo, hi = min(vals), max(vals)
    if hi == lo:
        mid = (min_size + max_size) / 2
        return {k: mid for k in values}
    return {
        k: min_size + (v - lo) / (hi - lo) * (max_size - min_size)
        for k, v in values.items()
    }


def build_louvain_graph(
    df: pd.DataFrame,
    sectores: list[str],
    metrica: str,
    top_n: int = 30,
) -> tuple[nx.Graph, dict]:
    """
    Construye un grafo ponderado no dirigido y aplica detección de comunidades
    Louvain.

    Algoritmo:
    1. Filtrar el DataFrame a los sectores seleccionados.
    2. Excluir 'ROW' (Resto del Mundo) por carecer de coordenadas significativas.
    3. Calcular el total de la métrica por país y conservar los top_n países.
    4. Para cada par de países, sumar min(valor_i_s, valor_j_s) en cada sector
       compartido (ambos con valor > 0).  Ese total es el peso de la arista.
    5. Aplicar louvain_communities con resolution=1.0.
    6. Normalizar tamaños de nodo al rango [80, 300].

    Retorna (grafo, comunidades_dict).
    """
    # 1. Filtrar sectores
    df_filtered = df[df["sector"].isin(sectores)].copy()

    # 2. Excluir ROW
    df_filtered = df_filtered[df_filtered["country"] != "ROW"]

    if df_filtered.empty:
        raise HTTPException(
            status_code=400,
            detail="No hay datos para los sectores seleccionados.",
        )

    # 3. Top N países por total de la métrica
    country_totals = (
        df_filtered.groupby("country")[metrica]
        .sum()
        .sort_values(ascending=False)
    )
    top_countries = country_totals.head(top_n).index.tolist()
    df_top = df_filtered[df_filtered["country"].isin(top_countries)]

    # Pivotear: filas = país, columnas = sector, valores = métrica
    pivot = df_top.pivot_table(
        index="country", columns="sector", values=metrica, aggfunc="sum", fill_value=0.0
    )

    # 4. Construir grafo
    G = nx.Graph()

    # Añadir nodos con su total como atributo
    for country in pivot.index:
        total = float(country_totals.get(country, 0.0))
        G.add_node(country, total=total)

    # Añadir aristas basadas en participación sectorial compartida
    countries = list(pivot.index)
    for i, j in combinations(range(len(countries)), 2):
        c_i, c_j = countries[i], countries[j]
        weight = 0.0
        for sector in pivot.columns:
            val_i = pivot.at[c_i, sector]
            val_j = pivot.at[c_j, sector]
            if val_i > 0 and val_j > 0:
                weight += min(val_i, val_j)
        if weight > 0:
            G.add_edge(c_i, c_j, weight=weight)

    # 5. Detección de comunidades Louvain
    if G.number_of_nodes() < 2:
        # Caso trivial: un solo nodo o grafo vacío
        communities_map = {n: 0 for n in G.nodes()}
    else:
        communities = nx.community.louvain_communities(G, weight="weight", resolution=1.0, seed=42)
        communities_map = {}
        for idx, comm in enumerate(communities):
            for node in comm:
                communities_map[node] = idx

    # 6. Normalizar tamaños
    raw_sizes = {n: G.nodes[n]["total"] for n in G.nodes()}
    normalized = _normalize_sizes(raw_sizes)
    for n in G.nodes():
        G.nodes[n]["size"] = normalized.get(n, 80.0)

    return G, communities_map


def _top_edges_per_node(G: nx.Graph, top_k: int = 5) -> list[dict]:
    """
    Retorna una lista de aristas únicas, manteniendo solo las top_k aristas
    más pesadas por nodo para reducir el tamaño de la respuesta JSON.
    """
    selected: set[tuple[str, str]] = set()
    for node in G.nodes():
        # Obtener aristas del nodo ordenadas por peso descendente
        neighbors = sorted(
            G.edges(node, data=True),
            key=lambda e: e[2].get("weight", 0),
            reverse=True,
        )
        for _, neighbor, _ in neighbors[:top_k]:
            edge = tuple(sorted([node, neighbor]))
            selected.add(edge)

    edges_list = []
    for src, tgt in selected:
        w = G[src][tgt].get("weight", 0.0)
        edges_list.append({"source": src, "target": tgt, "weight": round(w, 2)})

    # Ordenar por peso descendente para mayor legibilidad
    edges_list.sort(key=lambda e: e["weight"], reverse=True)
    return edges_list


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@app.get("/api/health")
def health():
    """Verificación rápida de estado del servidor."""
    return {"status": "ok"}


@app.get("/api/industrias")
def get_industrias():
    """
    Devuelve la lista de códigos únicos de sector disponibles,
    leyendo un archivo parquet de referencia (2020 por defecto).
    """
    # Intentar leer cualquier archivo disponible para extraer sectores
    for anio in range(2020, 2023):
        filepath = DATA_DIR / f"ICIO_DATA_{anio}.parquet"
        if filepath.exists():
            df = pd.read_parquet(filepath)
            df = _parse_index(df)
            sectores = sorted(df["sector"].unique().tolist())
            return {"industrias": sectores}

    # Fallback: intentar desde 1995
    for anio in range(1995, 2020):
        filepath = DATA_DIR / f"ICIO_DATA_{anio}.parquet"
        if filepath.exists():
            df = pd.read_parquet(filepath)
            df = _parse_index(df)
            sectores = sorted(df["sector"].unique().tolist())
            return {"industrias": sectores}

    raise HTTPException(
        status_code=404,
        detail="No se encontró ningún archivo parquet de datos ICIO.",
    )


@app.get("/api/modelo-louvain/{anio}")
def modelo_louvain(
    anio: int,
    sectores: Optional[str] = Query(default=DEFAULT_SECTORS, description="Códigos de sector separados por coma"),
    metrica: Optional[str] = Query(default="EXP", description="Columna de métrica: VA o EXP"),
):
    """
    Ejecuta detección de comunidades Louvain sobre la red de países
    para el año y sectores indicados.

    Parámetros de ruta:
        anio: año entre 1995 y 2022.

    Parámetros de consulta:
        sectores: códigos de sector separados por coma.
        metrica: columna a usar como peso (VA o EXP).
    """
    t0 = time.perf_counter()

    # ── Validaciones ──
    if anio < 1995 or anio > 2022:
        raise HTTPException(
            status_code=400,
            detail=f"El año debe estar entre 1995 y 2022. Se recibió: {anio}",
        )

    metrica = metrica.upper()
    if metrica not in ("VA", "EXP"):
        raise HTTPException(
            status_code=400,
            detail=f"La métrica debe ser 'VA' o 'EXP'. Se recibió: {metrica}",
        )

    # Parsear lista de sectores
    lista_sectores = [s.strip().upper() for s in sectores.split(",") if s.strip()]
    if not lista_sectores:
        raise HTTPException(status_code=400, detail="Debe indicar al menos un sector.")

    # Validar que los sectores existan en el catálogo
    invalidos = [s for s in lista_sectores if s not in SECTOR_NAMES]
    if invalidos:
        raise HTTPException(
            status_code=400,
            detail=f"Sectores no válidos: {invalidos}. Consulte /api/industrias para ver los disponibles.",
        )

    # ── Lectura y preparación de datos ──
    df = _read_parquet(anio)
    df = _parse_index(df)

    # ── Construcción del grafo y Louvain ──
    G, communities_map = build_louvain_graph(df, lista_sectores, metrica)

    # ── Preparar respuesta de nodos ──
    nodes = []
    for node in G.nodes():
        coords = COUNTRY_COORDS.get(node, (0.0, 0.0))
        nodes.append({
            "id": node,
            "lat": coords[0],
            "lon": coords[1],
            "community": communities_map.get(node, 0),
            "size": round(G.nodes[node].get("size", 80.0), 2),
            "label": COUNTRY_NAMES.get(node, node),
        })

    # Ordenar nodos por tamaño descendente para consistencia visual
    nodes.sort(key=lambda n: n["size"], reverse=True)

    # ── Preparar respuesta de aristas (top 5 por nodo) ──
    edges = _top_edges_per_node(G, top_k=5)

    # ── Conteo de comunidades ──
    communities_count = len(set(communities_map.values())) if communities_map else 0

    elapsed = time.perf_counter() - t0
    logger.info(
        "Louvain completado | año=%d | sectores=%s | métrica=%s | nodos=%d | aristas=%d | comunidades=%d | %.3fs",
        anio, lista_sectores, metrica, len(nodes), len(edges), communities_count, elapsed,
    )

    return {
        "year": anio,
        "nodes": nodes,
        "edges": edges,
        "communities_count": communities_count,
        "sectores": lista_sectores,
        "metrica": metrica,
    }
