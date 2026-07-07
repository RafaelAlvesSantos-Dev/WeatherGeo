/**
 * WeatherGeo - Módulo do Gráfico de Previsão Horária
 * @author RafaelAlves-Dev
 * @description Inicialização e atualização do gráfico linear usando Chart.js
 */

// Instância global para controlar o ciclo de vida do gráfico e evitar bugs de sobreposição
let hourlyChartInstance = null;

/**
 * Renderiza ou atualiza o gráfico de linha com as próximas horas de previsão.
 * @param {Array} forecastList - Lista contendo os blocos de horários retornados pela API.
 */
export const updateHourlyChart = (forecastList) => {
    const ctx = document.getElementById('hourlyChart');
    if (!ctx) return;

    // Mapeia os rótulos (HH:MM) e os dados climáticos (Temperatura convertida)
    const labels = forecastList.map(item => {
        const date = new Date(item.dt * 1000);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    });

    const temperatures = forecastList.map(item => Math.round(item.main.temp));

    // Destrói o gráfico anterior caso ele já exista para limpar o canvas
    if (hourlyChartInstance) {
        hourlyChartInstance.destroy();
    }

    // Inicializa a nova estrutura com a estilização moderna alinhada ao Glassmorphism
    hourlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperatura',
                data: temperatures,
                borderColor: '#3b82f6', // Azul primário destacado
                backgroundColor: 'rgba(59, 130, 246, 0.15)', // Preenchimento sutil translúcido
                fill: true,
                tension: 0.4, // Curvatura suave nas linhas (suavização)
                borderWidth: 3,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: 'rgba(255, 255, 255, 0.8)',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Ocultado para manter o design clean focado nos dados
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    callbacks: {
                        label: (context) => ` ${context.parsed.y}°C`
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.75)',
                        font: { family: 'sans-serif', size: 12 }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.08)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.75)',
                        font: { family: 'sans-serif', size: 12 },
                        callback: (value) => `${value}°C`
                    }
                }
            }
        }
    });
};
