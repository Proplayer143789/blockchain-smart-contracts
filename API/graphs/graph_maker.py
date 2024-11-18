import json
import matplotlib.pyplot as plt
import os
from statistics import mean, median
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from collections import Counter


# Cargar las variables de entorno desde la carpeta previa
load_dotenv(dotenv_path='../.env')

def read_data():
    # Verifica la variable de entorno para determinar el archivo a leer
    file_type = os.getenv('FILE_TYPE', 'json')  # Establece 'json' como predeterminado si no se especifica

    if file_type == 'json':
        with open('../performance_log.json', 'r') as file:
            data = json.load(file)
    else:
        with open('../performance_log.txt', 'r') as file:
            content = file.read().strip()
            entries = content.split('---')
            data = []
            for entry_text in entries:
                entry_raw = {}
                lines = entry_text.strip().split('\n')
                for line in lines:
                    line = line.strip()
                    if line:
                        # Manejar líneas con formato 'Clave: Valor'
                        if ':' in line:
                            key, value = line.split(':', 1)
                            key = key.strip()
                            value = value.strip()
                            entry_raw[key] = value
                # Mapeo de claves originales a estandarizadas
                entry = {
                    'time': entry_raw.get('Time'),
                    'requestNumber': entry_raw.get('Request Number'),
                    'route': entry_raw.get('Route'),
                    'method': entry_raw.get('Method'),
                    'refTime': entry_raw.get('RefTime (Gas Computacional)'),
                    'proofSize': entry_raw.get('ProofSize'),
                    'tip': entry_raw.get('Tip'),
                    'duration': entry_raw.get('Duration'),
                    'groupID': entry_raw.get('GroupID'),
                    'cpuUsageStart': entry_raw.get('CPU Usage (start)'),
                    'cpuUsageEnd': entry_raw.get('CPU Usage (end)'),
                    'ramUsageStart': entry_raw.get('RAM Usage (start)'),
                    'ramUsageEnd': entry_raw.get('RAM Usage (end)'),
                    'transactionSuccess': entry_raw.get('Transaction Success'),
                    'parametersLength': entry_raw.get('Parameters Length'),
                    'testType': entry_raw.get('Test Type'),
                    'totalTransactions': entry_raw.get('Total Transactions'),
                }
                if any(entry.values()):
                    data.append(entry)
        print("Datos cargados exitosamente")
        return data




def calculate_transaction_cost(entry):
    refTime = entry.get('refTime', '0')
    proofSize = entry.get('proofSize', '0')
    refTime = float(refTime) if refTime != 'N/A' else 0.0
    proofSize = float(proofSize) if proofSize != 'N/A' else 0.0
    if entry.get('method') == 'GET':
        return 0.0
    return refTime + proofSize

def parse_data(data):
    parsed_data = []
    null_entries = 0

    for entry in data:
        # Ignorar entradas completamente nulas
        if all(value is None for value in entry.values()):
            null_entries += 1
            continue

        try:
            # Procesar entradas con 'transactionSuccess' == 'Yes' o método 'GET'
            if entry.get('transactionSuccess') == 'Yes' or entry.get('method') == 'GET':
                # Validar que los campos requeridos existan y no sean None
                required_fields = ['time', 'duration', 'cpuUsageStart', 'cpuUsageEnd',
                                   'ramUsageStart', 'ramUsageEnd', 'testType', 'method',
                                   'groupID', 'requestNumber', 'totalTransactions']
                missing_fields = [field for field in required_fields if not entry.get(field)]
                if missing_fields:
                    print(f"Entrada omitida por campos faltantes {missing_fields}: {entry}")
                    continue

                # Convertir valores numéricos de manera segura
                duration = float(entry.get('duration', '0').replace(' ms', ''))
                cpu_start = float(entry.get('cpuUsageStart', '0').replace('%', ''))
                cpu_end = float(entry.get('cpuUsageEnd', '0').replace('%', ''))
                ram_start = float(entry.get('ramUsageStart', '0').replace('%', ''))
                ram_end = float(entry.get('ramUsageEnd', '0').replace('%', ''))
                
                parsed_entry = {
                    'duration': duration,
                    'cpuUsageStart': cpu_start,
                    'cpuUsageEnd': cpu_end,
                    'ramUsageStart': ram_start,
                    'ramUsageEnd': ram_end,
                    'cpuUsageDiff': cpu_end - cpu_start,
                    'ramUsageDiff': ram_end - ram_start,
                    'transactionCost': calculate_transaction_cost(entry),
                    'latency': duration,
                    'timestamp': datetime.fromisoformat(entry['time'].replace('Z', '+00:00')),
                    'groupID': entry.get('groupID', 'N/A'),
                    'requestNumber': int(entry.get('requestNumber', 0)) if entry.get('requestNumber', 'N/A') != 'N/A' else 0,
                    'totalTransactions': int(entry.get('totalTransactions', 0)) if entry.get('totalTransactions', 'N/A') != 'N/A' else 0,
                    'testType': entry.get('testType', 'Unknown'),
                    'parametersLength': int(entry.get('parametersLength', 0)) if entry.get('parametersLength', 'N/A') != 'N/A' else 0,
                    'method': entry.get('method', 'Unknown')
                }
                parsed_data.append(parsed_entry)
            else:
                print(f"Entrada omitida (transactionSuccess != Yes y método no es GET): {entry}")
        except Exception as e:
            print(f"Error procesando entrada: {entry}")
            print(f"Error detallado: {str(e)}")
            continue

    if null_entries > 0:
        print(f"Se encontraron {null_entries} entradas nulas que fueron ignoradas")
    if not parsed_data:
        print("Advertencia: No se pudo procesar ningún dato válido")
    else:
        print(f"Se procesaron {len(parsed_data)} entradas de datos")
        print(f"Primera entrada procesada: {parsed_data[0]}")

    return parsed_data

def plot_metric_vs_time(data, metric, title):
    if not data:
        print(f"No hay datos para graficar {metric}")
        return
        
    plt.figure(figsize=(12, 8))
    
    if not any(metric in entry for entry in data):
        print(f"La métrica {metric} no existe en los datos")
        return
        
    # Agrupar por tipo de prueba y número total de transacciones
    test_groups = {}
    for entry in data:
        key = (entry['testType'], entry['totalTransactions'])
        if key not in test_groups:
            test_groups[key] = []
        test_groups[key].append(entry)

    # Plotear cada tipo de test
    for (test_type, total_tx), entries in test_groups.items():
        # Organizar por grupos para calcular duraciones máximas
        group_entries = {}
        max_durations = []
        
        for entry in entries:
            group_id = entry['groupID']
            if group_id not in group_entries:
                group_entries[group_id] = []
            group_entries[group_id].append(entry)
        
        # Calcular duración máxima para cada grupo
        for group_data in group_entries.values():
            if group_data:
                group_data.sort(key=lambda x: x['timestamp'])
                start_time = group_data[0]['timestamp']
                end_time = group_data[-1]['timestamp']
                duration = (end_time - start_time).total_seconds() / 60  # en minutos
                max_durations.append(duration)
        
        # Calcular duración promedio para este tipo de test
        avg_duration = mean(max_durations) if max_durations else 1
        print(f"Duración promedio para {test_type}: {avg_duration:.2f} minutos")
        
        # Recolectar todos los puntos normalizados
        all_points = []
        
        # Procesar cada grupo y normalizar sus tiempos
        for group_data in group_entries.values():
            if group_data:
                group_data.sort(key=lambda x: x['timestamp'])
                start_time = group_data[0]['timestamp']
                
                for entry in group_data:
                    relative_time = (entry['timestamp'] - start_time).total_seconds() / 60
                    # Normalizar el tiempo usando la duración promedio
                    normalized_time = (relative_time / avg_duration) * 100  # Convertir a porcentaje
                    if entry[metric] is not None:
                        all_points.append((normalized_time, float(entry[metric])))
        
        if all_points:
            # Ordenar puntos por tiempo normalizado
            all_points.sort(key=lambda x: x[0])
            times, metrics = zip(*all_points)
            
            label = f'{test_type} - {total_tx} tx (Duración promedio: {avg_duration:.2f}min)'
            plt.plot(times, metrics, label=label, marker='o', markersize=2)
            print(f"Graficando {len(times)} puntos para {label}")

    plt.xlabel('Porcentaje de Tiempo Transcurrido (%)')
    plt.ylabel(metric)
    plt.title(title, fontsize=15)
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.grid(True)
    
    try:
        plt.savefig(f'{metric}_vs_time.png', bbox_inches='tight')
        print(f"Gráfica guardada: {metric}_vs_time.png")
    except Exception as e:
        print(f"Error guardando la gráfica {metric}: {str(e)}")
    
    plt.close()

def plot_metric_vs_transaction(data, metric, title):
    if not data:
        print(f"No hay datos para graficar {metric}")
        return

    plt.figure(figsize=(12, 8))

    # Filtrar datos válidos
    valid_data = [entry for entry in data if entry.get(metric) is not None and entry.get('requestNumber') is not None]
    if not valid_data:
        print(f"No se encontraron valores válidos para la métrica {metric}")
        return

    # Agrupar datos por 'testType'
    test_types = set(entry['testType'] for entry in valid_data)
    for test_type in test_types:
        # Filtrar datos para el tipo de prueba actual
        type_data = [entry for entry in valid_data if entry['testType'] == test_type]

        # Ordenar los datos por número de transacción
        type_data.sort(key=lambda x: int(x['requestNumber']))
        transaction_numbers = [int(entry['requestNumber']) for entry in type_data]
        metric_values = [float(entry[metric]) for entry in type_data]

        # Graficar los datos para este tipo de prueba
        plt.plot(transaction_numbers, metric_values, label=test_type, marker='o', markersize=3)

    plt.xlabel('Número de Transacción')
    plt.ylabel(metric)
    plt.title(title)
    plt.legend()
    plt.grid(True)

    try:
        plt.savefig(f'{metric}_vs_transaction.png', bbox_inches='tight')
        print(f"Gráfica guardada: {metric}_vs_transaction.png")
    except Exception as e:
        print(f"Error guardando la gráfica {metric}: {str(e)}")

    plt.close()

def plot_transaction_cost_vs_length(data):
    plt.figure(figsize=(20, 15))  # Aumentar el tamaño de la figura
    df = pd.DataFrame(data)
    df['parametersLength'] = pd.to_numeric(df['parametersLength'])
    df['transactionCost'] = pd.to_numeric(df['transactionCost'])
    df.boxplot(column='transactionCost', by='parametersLength')
    plt.xlabel('Longitud de Parámetros')
    plt.ylabel('Costo de Transacción')
    plt.title('Costo de Transacción vs Longitud de Parámetros', fontsize=15)
    plt.suptitle('')
    plt.tight_layout()  # Ajustar automáticamente los márgenes
    plt.savefig('transaction_cost_vs_length.png')

def calculate_statistics(data, metric):
    values = [entry[metric] for entry in data]
    return {
        'mean': mean(values),
        'median': median(values),
        'mode': Counter(values).most_common(1)[0][0]
    }

def generate_statistics_table(data, metrics):
    stats_table = []
    for method in set(entry['method'] for entry in data):
        for test_type in set(entry['testType'] for entry in data):
            subset = [entry for entry in data if entry['method'] == method and entry['testType'] == test_type]
            stats = {'Method': method, 'Test Type': test_type}
            for metric in metrics:
                metric_stats = calculate_statistics(subset, metric)
                stats[f'{metric}_mean'] = metric_stats['mean']
                stats[f'{metric}_median'] = metric_stats['median']
                stats[f'{metric}_mode'] = metric_stats['mode']
            stats_table.append(stats)
    
    df = pd.DataFrame(stats_table)
    return df

def calculate_transaction_speed(data, interval='60S'):
    df = pd.DataFrame(data)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df.set_index('timestamp', inplace=True)
    transaction_speed = df.resample(interval).size()
    plt.figure(figsize=(10, 6))
    transaction_speed.plot()
    plt.xlabel('Time')
    plt.ylabel('Transactions per Interval')
    plt.title(f'Transaction Speed over Time (Interval: {interval})')
    #plt.show()
    plt.savefig('transaction_speed_in_time.png')
    return transaction_speed

def main():
    data = read_data()
    if not data:
        print("No se pudieron cargar datos del archivo")
        return
        
    parsed_data = parse_data(data)
    if not parsed_data:
        print("No hay datos válidos para procesar")
        return
    
    print(f"Se procesaron exitosamente {len(parsed_data)} entradas de datos")
    
    # Gráficos actualizados
    plot_metric_vs_transaction(parsed_data, 'cpuUsageDiff', 'Diferencia de Uso de CPU vs Número de Transacción')
    plot_metric_vs_time(parsed_data, 'ramUsageDiff', 'Diferencia de Uso de RAM vs Tiempo')
    plot_metric_vs_time(parsed_data, 'latency', 'Latencia vs Tiempo')
    
    # Gráfico de Costo Transaccional vs Longitud de Parámetros
    plot_transaction_cost_vs_length(parsed_data)
    
    # Velocidad de Transacción
    transaction_speed = calculate_transaction_speed(parsed_data, interval='60s')
    
    # Tabla de estadísticas (Media, Moda, Mediana)
    metrics = ['cpuUsageDiff', 'ramUsageDiff', 'transactionCost', 'latency']
    stats_table = generate_statistics_table(parsed_data, metrics)
    
    print("Estadísticas:")
    print(stats_table)
    stats_table.to_csv('statistics_summary.csv', index=False)

if __name__ == "__main__":
    main()
