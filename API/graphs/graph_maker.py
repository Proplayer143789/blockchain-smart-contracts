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
                entry = {}
                for part in line.split('\n'):
                    key, value = part.strip().split(':', 1)
                    entry[key.strip()] = value.strip()
                data.append(entry)
    return data

def calculate_transaction_cost(entry):
    return float(entry.get('refTime', 0)) + float(entry.get('proofSize', 0)) + float(entry.get('tip', 0))

def parse_data(data):
    for entry in data:
        entry['duration'] = float(entry['duration'].replace(' ms', ''))
        entry['cpuUsageStart'] = float(entry['cpuUsageStart'].replace('%', ''))
        entry['cpuUsageEnd'] = float(entry['cpuUsageEnd'].replace('%', ''))
        entry['ramUsageStart'] = float(entry['ramUsageStart'].replace('%', ''))
        entry['ramUsageEnd'] = float(entry['ramUsageEnd'].replace('%', ''))
        
        # Calcular la diferencia de CPU y RAM entre inicio y fin
        entry['cpuUsageDiff'] = entry['cpuUsageEnd'] - entry['cpuUsageStart']
        entry['ramUsageDiff'] = entry['ramUsageEnd'] - entry['ramUsageStart']
        
        entry['transactionCost'] = calculate_transaction_cost(entry)
        entry['latency'] = entry['duration']
        entry['timestamp'] = datetime.fromisoformat(entry['time'].replace('Z', '+00:00'))
    return data


def plot_metric_vs_time(data, metric, title):
    plt.figure(figsize=(10, 6))
    for test_type in set(entry['testType'] for entry in data):
        times = [entry['timestamp'] for entry in data if entry['testType'] == test_type]
        metrics = [entry[metric] for entry in data if entry['testType'] == test_type]
        plt.plot(times, metrics, label=f'Test Type: {test_type}')
    plt.xlabel('Time')
    plt.ylabel(metric)
    plt.title(title)
    plt.legend()
    #plt.show()
    plt.savefig(f'{metric}_vs_time.png')


def plot_transaction_cost_vs_length(data):
    plt.figure(figsize=(10, 6))
    lengths = [entry['parametersLength'] for entry in data]
    costs = [entry['transactionCost'] for entry in data]
    plt.plot(lengths, costs, 'o-')
    plt.xlabel('Parameters Length')
    plt.ylabel('Transaction Cost')
    plt.title('Transaction Cost vs Parameters Length')
    #plt.show()
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
    
    # Gráficos de diferencias de CPU, RAM, Latencia vs Tiempo
    plot_metric_vs_time(data, 'cpuUsageDiff', 'CPU Usage Difference vs Time')
    plot_metric_vs_time(data, 'ramUsageDiff', 'RAM Usage Difference vs Time')
    plot_metric_vs_time(data, 'latency', 'Latency vs Time')
    
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
