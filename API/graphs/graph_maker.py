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
            lines = file.read().strip().split('---')
            data = []
            for line in lines:
                entry_raw = {}
                # Dividir el contenido por líneas y luego por ', ' para capturar todas las parejas clave-valor
                parts = line.strip().split('\n')
                for part in parts:
                    part = part.strip()
                    # Dividir por ', ' en caso de que haya múltiples parejas clave-valor en una línea
                    sub_parts = part.split(', ')
                    for sub_part in sub_parts:
                        if ':' in sub_part:
                            key, value = sub_part.split(':', 1)
                            entry_raw[key.strip()] = value.strip()
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
                data.append(entry)
    return data

def calculate_transaction_cost(entry):
    refTime = entry.get('refTime', '0')
    proofSize = entry.get('proofSize', '0')
    refTime = float(refTime) if refTime != 'N/A' else 0.0
    proofSize = float(proofSize) if proofSize != 'N/A' else 0.0
    return refTime + proofSize

def parse_data(data):
    parsed_data = []
    for entry in data:
        try:
            if entry.get('transactionSuccess') == 'Yes':
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
                    'groupID': entry.get('GroupID', 'N/A'),
                    'totalTransactions': int(entry.get('totalTransactions', 0)) if entry.get('totalTransactions', 'N/A') != 'N/A' else 0,
                    'testType': entry.get('testType', 'Unknown'),
                    'parametersLength': int(entry.get('parametersLength', 0)) if entry.get('parametersLength', 'N/A') != 'N/A' else 0,
                    'method': entry.get('method', 'Unknown')
                }
                parsed_data.append(parsed_entry)
            else:
                print(f"Entrada omitida (transactionSuccess != Yes): {entry}")
        except Exception as e:
            print(f"Error procesando entrada: {entry}")
            print(f"Error: {str(e)}")
    return parsed_data

def plot_metric_vs_time(data, metric, title):
    if not data:
        print(f"No hay datos para graficar {metric}")
        return
        
    plt.figure(figsize=(12, 8))
    
    # Verificar que el metric existe en los datos
    if not any(metric in entry for entry in data):
        print(f"La métrica {metric} no existe en los datos")
        return
        
    # Agrupar por tipo de prueba y número total de transacciones
    test_groups = {}
    for entry in data:
        key = (entry['testType'], entry['totalTransactions'])
        if key not in test_groups:
            test_groups[key] = {}
        group_id = entry['groupID']
        if group_id not in test_groups[key]:
            test_groups[key][group_id] = []
        test_groups[key][group_id].append(entry)

    # Plotear cada grupo
    for (test_type, total_tx), groups in test_groups.items():
        for group_id, entries in groups.items():
            if entries:
                # Ordenar por timestamp
                entries.sort(key=lambda x: x['timestamp'])
                start_time = entries[0]['timestamp']
                times = [(entry['timestamp'] - start_time).total_seconds() / 60 for entry in entries]
                metrics = [float(entry[metric]) for entry in entries if entry[metric] is not None]
                
                if times and metrics and len(times) == len(metrics):
                    label = f'{test_type} - {total_tx} tx - Group {group_id[:8]}'
                    plt.plot(times, metrics, label=label, marker='o', markersize=2)
                else:
                    print(f"Datos incompletos para {test_type} - Group {group_id}")

    plt.xlabel('Tiempo Relativo (minutos)')
    plt.ylabel(metric)
    plt.title(title)
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.tight_layout()
    plt.grid(True)
    
    try:
        plt.savefig(f'{metric}_vs_time.png', bbox_inches='tight')
        print(f"Gráfica guardada: {metric}_vs_time.png")
    except Exception as e:
        print(f"Error guardando la gráfica {metric}: {str(e)}")
    
    plt.close()

def plot_transaction_cost_vs_length(data):
    plt.figure(figsize=(10, 6))
    df = pd.DataFrame(data)
    df['parametersLength'] = pd.to_numeric(df['parametersLength'])
    df['transactionCost'] = pd.to_numeric(df['transactionCost'])
    df.boxplot(column='transactionCost', by='parametersLength')
    plt.xlabel('Longitud de Parámetros')
    plt.ylabel('Costo de Transacción')
    plt.title('Costo de Transacción vs Longitud de Parámetros')
    plt.suptitle('')
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
    data = parse_data(data)
    
    # Gráficos actualizados
    plot_metric_vs_time(data, 'cpuUsageDiff', 'Diferencia de Uso de CPU vs Tiempo')
    plot_metric_vs_time(data, 'ramUsageDiff', 'Diferencia de Uso de RAM vs Tiempo')
    plot_metric_vs_time(data, 'latency', 'Latencia vs Tiempo')
    
    # Gráfico de Costo Transaccional vs Longitud de Parámetros
    plot_transaction_cost_vs_length(data)
    
    # Velocidad de Transacción
    transaction_speed = calculate_transaction_speed(data, interval='60s')
    
    # Tabla de estadísticas (Media, Moda, Mediana)
    metrics = ['cpuUsageDiff', 'ramUsageDiff', 'transactionCost', 'latency']
    stats_table = generate_statistics_table(data, metrics)
    
    print("Estadísticas:")
    print(stats_table)
    stats_table.to_csv('statistics_summary.csv', index=False)

if __name__ == "__main__":
    main()
