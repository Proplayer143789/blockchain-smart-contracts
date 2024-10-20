import json
import matplotlib.pyplot as plt
import os
import statistics
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

# Cargar las variables de entorno desde la carpeta previa
load_dotenv(dotenv_path='../.env')

# Función para leer el archivo JSON
def leer_json(ruta_archivo):
    with open(ruta_archivo) as f:
        logs = json.load(f)
    return logs

# Función para leer el archivo de texto
def leer_txt(ruta_archivo):
    logs = []
    with open(ruta_archivo) as f:
        log_actual = {}
        for linea in f:
            linea = linea.strip()
            if linea.startswith("Time:"):
                if log_actual:
                    logs.append(log_actual)
                log_actual = {"time": linea.split(": ", 1)[1]}
            elif linea.startswith("Duration:"):
                log_actual["duration"] = int(linea.split(": ", 1)[1].replace("ms", ""))
            elif linea.startswith("CPU Usage:"):
                log_actual["cpuUsage"] = linea.split(": ", 1)[1].split("%")[0]
            elif linea.startswith("Memory Usage:"):
                log_actual["memUsage"] = linea.split(": ", 1)[1].split("%")[0]
            elif linea.startswith("Test Type:"):
                log_actual["test_type"] = linea.split(": ", 1)[1]
        if log_actual:
            logs.append(log_actual)
    return logs

# Función para detectar y leer según el tipo de archivo
def leer_archivo(ruta_archivo):
    extension = os.path.splitext(ruta_archivo)[1]
    if extension == ".json":
        return leer_json(ruta_archivo)
    elif extension == ".txt":
        return leer_txt(ruta_archivo)
    else:
        raise ValueError("Formato de archivo no soportado")

# Ruta del archivo (puedes cambiarlo según tu archivo)
ruta_archivo = '../performance_log.txt'

# Leer los logs
logs = leer_archivo(ruta_archivo)

# Extraer los datos por tipo de prueba
logs_por_tipo = {}
for log in logs:
    test_type = log.get('test_type', 'default')
    if test_type not in logs_por_tipo:
        logs_por_tipo[test_type] = []
    logs_por_tipo[test_type].append(log)

# Función para generar gráficos y tablas
def generar_graficos_y_tablas(logs, test_type):
    # Extraer datos
    times = [datetime.strptime(log['time'], "%Y-%m-%dT%H:%M:%S.%fZ").strftime("%H:%M") for log in logs]
    durations = [log['duration'] for log in logs]
    cpu_usages = [float(log['cpuUsage']) for log in logs]
    mem_usages = [float(log['memUsage']) for log in logs]
    
    # Duración vs Tiempo
    plt.figure(figsize=(10, 5))
    plt.plot(times, durations, label=f'Duración (ms) - {test_type}', color='blue')
    plt.xticks(rotation=45)
    plt.xlabel('Tiempo (HH:MM)')
    plt.ylabel('Duración (ms)')
    plt.title(f'Duración de Solicitudes en el Tiempo - {test_type}')
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"Duración_vs_Tiempo_{test_type}.png")

    # CPU Usage vs Tiempo
    plt.figure(figsize=(10, 5))
    plt.plot(times, cpu_usages, label=f'CPU Usage (%) - {test_type}', color='red')
    plt.xticks(rotation=45)
    plt.xlabel('Tiempo (HH:MM)')
    plt.ylabel('Uso de CPU (%)')
    plt.title(f'Uso de CPU en el Tiempo - {test_type}')
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"Uso_de_CPU_vs_Tiempo_{test_type}.png")

    # Mem Usage vs Tiempo
    plt.figure(figsize=(10, 5))
    plt.plot(times, mem_usages, label=f'Mem Usage (%) - {test_type}', color='green')
    plt.xticks(rotation=45)
    plt.xlabel('Tiempo (HH:MM)')
    plt.ylabel('Uso de Memoria (%)')
    plt.title(f'Uso de Memoria en el Tiempo - {test_type}')
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"Uso_de_Memoria_vs_Tiempo_{test_type}.png")

    # Calcular estadísticas y generar tabla
    data = {
        'Duración (ms)': durations,
        'Uso de CPU (%)': cpu_usages,
        'Uso de Memoria (%)': mem_usages
    }

    estadisticas = {
        'Media': {var: statistics.mean(val) for var, val in data.items()},
        'Mediana': {var: statistics.median(val) for var, val in data.items()},
        'Moda': {var: statistics.mode(val) for var, val in data.items()}
    }

    df_estadisticas = pd.DataFrame(estadisticas)
    df_estadisticas.index.name = 'Métrica'
    
    print(f"Tabla de estadísticas para {test_type}:")
    print(df_estadisticas)

    # Guardar la tabla en archivo CSV o mostrarla en formato de tabla en otros formatos
    df_estadisticas.to_csv(f'Estadisticas_{test_type}.csv')
    
# Generar gráficos y tablas por cada tipo de prueba
for test_type, logs_tipo in logs_por_tipo.items():
    generar_graficos_y_tablas(logs_tipo, test_type)

print("Gráficos y tablas generados correctamente.")
