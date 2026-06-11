# -*- coding: utf-8 -*-
"""
Created on Mon May  4 12:54:20 2026

@author: Rafael
"""
# -*- coding: utf-8 -*-
"""
SCRIPT 1: REDES INDIVIDUALES (1995-2022)
Calcula redes para las componentes TOTAL_X2, CS_SIMPLE y CC_COMPLEX
"""

import pandas as pd
import networkx as nx
import numpy as np
import py4cytoscape as p4c
import pyarrow.dataset as ds
import pyarrow.compute as pc

#%% ==========================================
# 1. LECTURA DE DATOS (PARQUET) CON FILTRO
# ==========================================
out_dir = r"C:\Users\Rafael\Documents\ANGEL\DESCOMPOSICION_2026"
print("Escaneando dataset de Parquet...")

# Apuntar a la carpeta
dataset = ds.dataset(out_dir, format="parquet")

#VENDEDORA
industrias = ["ELCTRI", "TELECO", "ITSERV", "ELCTRO", "MMTVRA"]

#INDUSTRIA COMPRADORA (Se puede meter mas de una)
industria_comparar = "AUTOMO"

# Filtro inteligente: solo cargar lo que vamos a usar
filtro = (
    pc.field("sector_exporter").isin(industrias) & 
    (pc.field("sector_importer") == industria_comparar)
)

print("Extrayendo los datos a Pandas...")
df_completo = dataset.to_table(filter=filtro).to_pandas()

# Renombrar columnas para mantener la compatibilidad
df_completo = df_completo.rename(columns={
    'year': 'AÑO',
    'exporter': 'Pais_V',
    'sector_exporter': 'Industrias_V',
    'importer': 'Pais_C',
    'sector_importer': 'Industrias_C'
})

print(f"✅ Datos cargados. Filas en RAM: {len(df_completo)}")

#%% ==========================================
# 2. FUNCIÓN DE GENERACIÓN DE RED (redcyto4)
# ==========================================
def redcyto4(dataframe, columna_origen, columna_destino, columna_peso, col_inf_or, col_inf_des, 
             condicion=None, titulo_red=None, coleccion=None):
    
    df = dataframe.copy()
    
    # Aplicar la condición (Año, Industria Origen, Industria Destino)
    if condicion is not None:
        df = df.query(condicion)
        
    if df.empty:
        return None

    # Limpiar nulos y asegurar numéricos
    df[columna_peso] = pd.to_numeric(df[columna_peso], errors='coerce')
    df = df.dropna(subset=[columna_peso])
    
    # Quedarnos solo con valores positivos para evitar problemas de logaritmos y pesos negativos
    df = df[df[columna_peso] > 0]
    
    if df.empty:
        return None

    G = nx.MultiDiGraph()

    # Tañamo de nodos basado en ventas
    node_sizes_vend = df.groupby(columna_origen)[columna_peso].sum()
    node = node_sizes_vend.squeeze()

    min_size = node.min()
    max_size = node.max()
    
    if max_size > min_size:
        node_sizes = node.apply(lambda x: 100 + (200 * (x - min_size) / (max_size - min_size))).to_dict()
    else:
        node_sizes = node.apply(lambda x: 100).to_dict()

    # 15 vendedores más importantes
    top_vendedores = node_sizes_vend.nlargest(15).index.tolist()
    df_filtrado = df[df[columna_origen].isin(top_vendedores)]

    # 20 principales compradores
    compradores_top = df_filtrado.groupby(columna_origen, group_keys=False).apply(lambda x: x.nlargest(20, columna_peso)).reset_index(drop=True)

    # 10 compradores de segundo nivel
    compradores_nivel2 = df[df[columna_origen].isin(compradores_top[columna_destino])]
    compradores_nivel2 = compradores_nivel2.groupby(columna_origen, group_keys=False).apply(lambda x: x.nlargest(10, columna_peso)).reset_index(drop=True)
    compradores_nivel2 = compradores_nivel2.drop_duplicates(subset=[columna_origen, columna_destino])
    compradores_nivel2 = compradores_nivel2[compradores_nivel2[columna_origen] != compradores_nivel2[columna_destino]]   

    # Agregar nodos y aristas al grafo
    G.add_nodes_from(top_vendedores)
    G.add_nodes_from(compradores_top[columna_destino].unique())
    G.add_nodes_from(compradores_nivel2[columna_destino].unique())
    
    for _, row in compradores_top.iterrows():
        G.add_edge(row[columna_origen], row[columna_destino], weight=row[columna_peso])

    for _, row in compradores_nivel2.iterrows():
        G.add_edge(row[columna_origen], row[columna_destino], weight=row[columna_peso])
        
    if G.number_of_nodes() == 0:
        return None

    # Atributos de red
    nx.set_node_attributes(G, node_sizes, "tamaño")
    edge_weight = [np.log10(i) if i > 1 else 0.5 for i in compradores_top[columna_peso]]
    nx.set_edge_attributes(G, dict(zip(G.edges, edge_weight)), "ancho")
    edge_names = [f"{v} --> {c}" for v, c in zip(compradores_top[col_inf_or], compradores_top[col_inf_des])]
    nx.set_edge_attributes(G, dict(zip(G.edges, edge_names)), "Industrias")
    
    # Comunidades (Louvain)
    G_undirected = nx.Graph(G)
    communities = nx.community.louvain_communities(G_undirected)

    palette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
    community_color_map = {}
    node_color_map = {}

    for idx, community in enumerate(communities):
        color = palette[idx % len(palette)]
        for n in community:
            community_color_map[n] = idx
            node_color_map[n] = color

    nx.set_node_attributes(G, community_color_map, 'community')
    nx.set_node_attributes(G, node_color_map, 'color')
    
    # Fuentes
    node_font_sizes = {n: max(10, np.sqrt(size) * 3) for n, size in node_sizes.items()}  
    nx.set_node_attributes(G, node_font_sizes, "font_size")

    edge_font_sizes = {edge: max(5, np.log10(data["weight"]) * 5) if data["weight"] > 1 else 5
                       for edge, data in G.edges.items()}  
    nx.set_edge_attributes(G, edge_font_sizes, "edge_font_size")
    
    # Enviar a Cytoscape
    if titulo_red is None:
        titulo_red = 'Network'
        
    col_name = str(coleccion) if coleccion else "Redes_Descomposicion"
    
    try:
        p4c.create_network_from_networkx(G, title=titulo_red, collection=col_name)
        p4c.set_visual_style('Marquee')
        p4c.set_node_size_mapping('tamaño', mapping_type='p', style_name='Marquee')
        p4c.set_edge_line_width_mapping('edge_font_size', mapping_type='p', style_name='Marquee')
        p4c.set_edge_label_mapping('Industrias', style_name='Marquee')
        p4c.set_edge_opacity_mapping(table_column='weight', mapping_type='p', style_name="Marquee")
        p4c.set_node_color_mapping("color", mapping_type="p", default_color="#CCCCCC", style_name="Marquee")
        p4c.set_edge_color_default('#111111', style_name='Marquee')
        p4c.commands_run(f"layout attributes-layout network={titulo_red} nodeAttribute=community")
        
        p4c.set_node_font_size_mapping("font_size", mapping_type='p', style_name='Marquee')
        p4c.set_node_label_position_default('C','C','c',0.0,0.0,style_name='Marquee')
        p4c.set_edge_font_size_mapping("edge_font_size", mapping_type='p', style_name='Marquee')
        p4c.set_node_label_color_mapping('community', mapping_type='p', default_color='#222222', style_name='Marquee')
        p4c.set_edge_label_color_default('#222222', style_name='Marquee')
    except Exception as e:
        print(f"Error con Cytoscape en red {titulo_red}: {e}")
        
    return G

#%% ==========================================
# 3. EJECUCIÓN DEL LOOP PRINCIPAL
# ==========================================
columnas_peso = ["TOTAL_X2", "CS_SIMPLE", "CC_COMPLEX"]

print("\n🚀 Iniciando generación de redes individuales en Cytoscape...")

redes_generadas = 0

# Rango 1995 hasta 2022 (inclusive)
for año in range(1995, 2023):
    print(f"\n--- Procesando Año {año} ---")
    
    for componente in columnas_peso:
        for ind_origen in industrias:
            condicion = f"AÑO == {año} and Industrias_V == '{ind_origen}' and Industrias_C == '{industria_comparar}'"
            titulo = f"IND_{año}_{componente}_{ind_origen}"
            
            # Agrupar las colecciones en Cytoscape por Año y Componente
            coleccion = f"{año}_{componente}"
            
            red = redcyto4(df_completo, "Pais_V", "Pais_C", componente, "Industrias_V", "Industrias_C", 
                           condicion=condicion, titulo_red=titulo, coleccion=coleccion)
            
            if red is not None:
                redes_generadas += 1

print(f"\n✅ ¡Proceso completado! Se generaron {redes_generadas} redes individuales.")
