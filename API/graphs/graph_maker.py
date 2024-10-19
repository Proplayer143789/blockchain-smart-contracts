import json
import matplotlib.pyplot as plt

# Cargar los datos del archivo JSON
with open('/home/nicolas/nicolas/github/blockchain-smart-contracts/API/performance_log.json') as f:
    logs = json.load(f)

# Extraer los datos que necesitamos
times = [log['time'] for log in logs]
durations = [log['duration'] for log in logs]
cpu_usages = [float(log['cpuUsage']) for log in logs]
mem_usages = [float(log['memUsage']) for log in logs]

# Graficar Duración vs Tiempo
plt.figure(figsize=(10, 5))
plt.plot(times, durations, label='Duración (ms)', color='blue')
plt.xticks(rotation=45)
plt.xlabel('Tiempo')
plt.ylabel('Duración (ms)')
plt.title('Duración de Solicitudes en el Tiempo')
plt.legend()
plt.tight_layout()
plt.show()

# Graficar Uso de CPU vs Tiempo
plt.figure(figsize=(10, 5))
plt.plot(times, cpu_usages, label='Uso de CPU (%)', color='red')
plt.xticks(rotation=45)
plt.xlabel('Tiempo')
plt.ylabel('Uso de CPU (%)')
plt.title('Uso de CPU en el Tiempo')
plt.legend()
plt.tight_layout()
plt.show()

# Graficar Uso de Memoria vs Tiempo
plt.figure(figsize=(10, 5))
plt.plot(times, mem_usages, label='Uso de Memoria (%)', color='green')
plt.xticks(rotation=45)
plt.xlabel('Tiempo')
plt.ylabel('Uso de Memoria (%)')
plt.title('Uso de Memoria en el Tiempo')
plt.legend()
plt.tight_layout()
plt.show()
