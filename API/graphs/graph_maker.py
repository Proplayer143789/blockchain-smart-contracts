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
            elif linea.startswith("Request Number:"):
                log_actual["requestNumber"] = int(linea.split(": ", 1)[1])
            elif linea.startswith("Route:"):
                log_actual["route"] = linea.split(": ", 1)[1]
            elif linea.startswith("Method:"):
                log_actual["method"] = linea.split(": ", 1)[1]
            elif linea.startswith("RefTime (Gas Computacional):"):
                log_actual["refTime"] = int(linea.split(": ", 1)[1])
            elif linea.startswith("Duration:"):
                log_actual["duration"] = int(linea.split(": ", 1)[1].replace("ms", ""))
            elif linea.startswith("CPU Usage (start):"):
                log_actual["cpuUsageStart"] = float(linea.split(": ", 1)[1].replace("%", ""))
            elif linea.startswith("CPU Usage (end):"):
                log_actual["cpuUsageEnd"] = float(linea.split(": ", 1)[1].replace("%", ""))
            elif linea.startswith("RAM Usage (start):"):
                log_actual["ramUsageStart"] = float(linea.split(": ", 1)[1].replace("%", ""))
            elif linea.startswith("RAM Usage (end):"):
                log_actual["ramUsageEnd"] = float(linea.split(": ", 1)[1].replace("%", ""))
            elif linea.startswith("Transaction Success:"):
                log_actual["transactionSuccess"] = linea.split(": ", 1)[1]
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

# Convertir test_type a su equivalente en español
def traducir_tipo_test(test_type):
    if test_type == "sequential":
        return "Secuencial"
    elif test_type == "concurrent":
        return "Concurrente"
    elif test_type == "batch":
        return "Por Lotes"
    else:
        return test_type

# Extraer los datos por tipo de prueba y por ruta
logs_por_ruta_y_tipo = {}
for log in logs:
    test_type = log.get('test_type', 'default')
    route = log.get('route', 'default')
    key = (route, test_type)
    if key not in logs_por_ruta_y_tipo:
        logs_por_ruta_y_tipo[key] = []
    logs_por_ruta_y_tipo[key].append(log)

# Función para calcular transacciones por segundo
def calcular_tps(logs):
    total_duration = (max([datetime.strptime(log['time'], "%Y-%m-%dT%H:%M:%S.%fZ") for log in logs]) -
                      min([datetime.strptime(log['time'], "%Y-%m-%dT%H:%M:%S.%fZ") for log in logs])).total_seconds()
    return len(logs) / total_duration if total_duration > 0 else 0

# Función para generar gráficos y tablas
def generar_graficos_y_tablas(logs, route, test_type):
    # Extraer datos
    times = [datetime.strptime(log['time'], "%Y-%m-%dT%H:%M:%S.%fZ").strftime("%H:%M") for log in logs]
    durations = [log['duration'] for log in logs]
    cpu_usages_start = [log['cpuUsageStart'] for log in logs]
    cpu_usages_end = [log['cpuUsageEnd'] for log in logs]
    ram_usages_start = [log['ramUsageStart'] for log in logs]
    ram_usages_end = [log['ramUsageEnd'] for log in logs]
    ref_times = [log['refTime'] for log in logs]

    # Duración vs Tiempo
    plt.figure(figsize=(10, 5))
    plt.plot(times, durations, label=f'Duración (ms) - {traducir_tipo_test(test_type)}', color='blue')
    plt.xticks(rotation=45)
    plt.xlabel('Tiempo (HH:MM)')
    plt.ylabel('Duración (ms)')
    plt.title(f'Duración de Solicitudes en el Tiempo - {route} ({traducir_tipo_test(test_type)})')
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"Duración_vs_Tiempo_{route}_{test_type}.png")

    # CPU Usage vs Tiempo
    plt.figure(figsize=(10, 5))
    plt.plot(times, cpu_usages_start, label=f'CPU Start (%) - {traducir_tipo_test(test_type)}', color='red')
    plt.plot(times, cpu_usages_end, label=f'CPU End (%) - {traducir_tipo_test(test_type)}', color='orange')
    plt.xticks(rotation=45)
    plt.xlabel('Tiempo (HH:MM)')
    plt.ylabel('Uso de CPU (%)')
    plt.title(f'Uso de CPU en el Tiempo - {route} ({traducir_tipo_test(test_type)})')
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"Uso_de_CPU_vs_Tiempo_{route}_{test_type}.png")

    # RAM Usage vs Tiempo
    plt.figure(figsize=(10, 5))
    plt.plot(times, ram_usages_start, label=f'RAM Start (%) - {traducir_tipo_test(test_type)}', color='green')
    plt.plot(times, ram_usages_end, label=f'RAM End (%) - {traducir_tipo_test(test_type)}', color='lightgreen')
    plt.xticks(rotation=45)
    plt.xlabel('Tiempo (HH:MM)')
    plt.ylabel('Uso de Memoria (%)')
    plt.title(f'Uso de RAM en el Tiempo - {route} ({traducir_tipo_test(test_type)})')
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"Uso_de_RAM_vs_Tiempo_{route}_{test_type}.png")

    # RefTime (Gas Computacional) vs Tiempo
    plt.figure(figsize=(10, 5))
    plt.plot(times, ref_times, label=f'Gas Computacional - {traducir_tipo_test(test_type)}', color='purple')
    plt.xticks(rotation=45)
    plt.xlabel('Tiempo (HH:MM)')
    plt.ylabel('Gas Computacional')
    plt.title(f'Gas Computacional en el Tiempo - {route} ({traducir_tipo_test(test_type)})')
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"Gas_Computacional_vs_Tiempo_{route}_{test_type}.png")

    # Calcular estadísticas y generar tabla
    data = {
        'Duración (ms)': durations,
        'CPU Start (%)': cpu_usages_start,
        'CPU End (%)': cpu_usages_end,
        'RAM Start (%)': ram_usages_start,
        'RAM End (%)': ram_usages_end,
        'Gas Computacional': ref_times
    }

    estadisticas = {
        'Media': {var: statistics.mean(val) for var, val in data.items()},
        'Mediana': {var: statistics.median(val) for var, val in data.items()},
        'Moda': {var: statistics.mode(val) for var, val in data.items()}
    }

    df_estadisticas = pd.DataFrame(estadisticas)
    df_estadisticas.index.name = 'Métrica'
    
    print(f"Tabla de estadísticas para {route} - {traducir_tipo_test(test_type)}:")
    print(df_estadisticas)

    # Guardar la tabla en archivo CSV
    df_estadisticas.to_csv(f'Estadisticas_{route}_{test_type}.csv')

    # Calcular transacciones por segundo (TPS)
    tps = calcular_tps(logs)
    print(f"Transacciones por segundo (TPS) para {route} - {traducir_tipo_test(test_type)}: {tps:.2f}")

# Generar gráficos y tablas por cada ruta y tipo de prueba
for (route, test_type), logs_ruta_tipo in logs_por_ruta_y_tipo.items():
    generar_graficos_y_tablas(logs_ruta_tipo, route, test_type)

print("Gráficos y tablas generados correctamente.")
