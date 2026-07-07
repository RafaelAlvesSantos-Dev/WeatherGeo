/**
 * WeatherGeo - Gerenciador do DOM e Geolocalização (Aba Hoje)
 * @author RafaelAlves-Dev
 * @description Captura geolocalização nativa, ativação de loaders em formato
 * Skeleton Screen e renderização dinâmica dos cartões de métricas.
 */

import { fetchCurrentWeatherByCoords, fetchForecastByCoords } from './api.js';
import { formatTemperature, showError } from './utils.js';
import { updateHourlyChart } from './chart.js';

// Seletores fixos mapeados na interface
const mainCard = document.getElementById('today-main-card');
const feelsLikeMetric = document.getElementById('metric-feels-like');
const popMetric = document.getElementById('metric-pop');
const geoStatusText = document.getElementById('current-city-text');

/**
 * Converte códigos de ícones nativos do OpenWeatherMap para classes do Remix Icon
 */
const mapWeatherIcon = (iconCode) => {
    const iconMap = {
        '01d': 'ri-sun-fill',         '01n': 'ri-moon-clear-fill',
        '02d': 'ri-sun-cloudy-fill',  '02n': 'ri-moon-cloudy-fill',
        '03d': 'ri-cloudy-fill',      '03n': 'ri-cloudy-fill',
        '04d': 'ri-cloudy-fill',      '04n': 'ri-cloudy-fill',
        '09d': 'ri-showers-fill',     '09n': 'ri-showers-fill',
        '10d': 'ri-rainy-fill',       '10n': 'ri-rainy-fill',
        '11d': 'ri-thunderstorm-fill','11n': 'ri-thunderstorm-fill',
        '13d': 'ri-snowy-fill',       '13n': 'ri-snowy-fill',
        '50d': 'ri-mist-fill',        '50n': 'ri-mist-fill'
    };
    return iconMap[iconCode] || 'ri-cloud-windy-line';
};

/**
 * Controla os estados visuais alternando entre o Skeleton Screen e os dados reais.
 * @param {boolean} isLoading - Estado de carregamento do fluxo.
 */
const toggleSkeletons = (isLoading) => {
    if (isLoading) {
        mainCard.innerHTML = `
            <div class="skeleton-wrapper">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-temp"></div>
                <div class="skeleton skeleton-text"></div>
            </div>
        `;
        feelsLikeMetric.innerHTML = `<span class="skeleton skeleton-metric"></span>`;
        popMetric.innerHTML = `<span class="skeleton skeleton-metric"></span>`;
    }
};

/**
 * Processa a renderização completa da tela usando as respostas unificadas das APIs.
 * @param {Object} current - Dados vindos de fetchCurrentWeatherByCoords.
 * @param {Object} forecast - Dados vindos de fetchForecastByCoords.
 */
const renderTodayDashboard = (current, forecast) => {
    const city = current.name;
    const currentTemp = formatTemperature(current.main.temp);
    const description = current.weather[0].description;
    const iconClass = mapWeatherIcon(current.weather[0].icon);

    mainCard.innerHTML = `
        <div class="main-weather-info animate-fade-in">
            <h2>${city}</h2>
            <div class="temp-display">
                <i class="${iconClass} weather-main-icon"></i>
                <h1>${currentTemp}</h1>
            </div>
            <p class="weather-description">${description.charAt(0).toUpperCase() + description.slice(1)}</p>
        </div>
    `;

    feelsLikeMetric.textContent = formatTemperature(current.main.feels_like);
    
    const probabilityOfPrecipitation = forecast.list && forecast.list[0] 
        ? Math.round(forecast.list[0].pop * 100) 
        : 0;
    popMetric.textContent = `${probabilityOfPrecipitation}%`;

    if (geoStatusText) {
        geoStatusText.textContent = city;
    }

    // Notifica outros módulos (ex: relógio da sidebar) sobre a temperatura atual
    window.dispatchEvent(new CustomEvent('weathergeo:temp-update', {
        detail: { temp: current.main.temp }
    }));
};

/**
 * Ponto de entrada do módulo: Gerencia o fluxo completo de geolocalização do dispositivo.
 */
export const handleGeolocationAndLoad = () => {
    if (!navigator.geolocation) {
        showError('A API de geolocalização não é suportada ou está desativada no seu navegador.');
        if (geoStatusText) geoStatusText.textContent = 'Localização indisponível';
        return;
    }

    toggleSkeletons(true);

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;

            try {
                const [weatherData, forecastData] = await Promise.all([
                    fetchCurrentWeatherByCoords(latitude, longitude),
                    fetchForecastByCoords(latitude, longitude)
                ]);

                renderTodayDashboard(weatherData, forecastData);
                
                if (forecastData && forecastData.list) {
                    updateHourlyChart(forecastData.list.slice(0, 8));
                }

            } catch (error) {
                console.error('Falha na integração dos dados climáticos:', error);
                if (geoStatusText) geoStatusText.textContent = 'Chave Pendente';
                
                if (error.message === 'API_KEY_MISSING') {
                    mainCard.innerHTML = `<p class="placeholder-text" style="color: #ef4444; font-weight: 500;">Insira sua OpenWeatherMap API Key no arquivo api.js para ver o clima local.</p>`;
                } else {
                    mainCard.innerHTML = `<p class="placeholder-text">Falha de comunicação com o servidor de clima.</p>`;
                }
                feelsLikeMetric.textContent = '--';
                popMetric.textContent = '--';
            }
        },
        (error) => {
            console.warn('Bloqueio no acesso à localização:', error.message);
            let userFriendlyMessage = 'Permissão de localização recusada. Insira uma cidade manualmente na busca global.';
            
            if (error.code === error.POSITION_UNAVAILABLE) {
                userFriendlyMessage = 'Os serviços de localização do dispositivo estão instáveis ou desligados.';
            } else if (error.code === error.TIMEOUT) {
                userFriendlyMessage = 'Tempo limite esgotado ao tentar capturar suas coordenadas geográficas.';
            }

            showError(userFriendlyMessage);
            if (geoStatusText) geoStatusText.textContent = 'Localização negada';
            
            mainCard.innerHTML = `<p class="placeholder-text">Geolocalização pendente. Use a aba "Mundo" ou "Previsão" para pesquisar.</p>`;
            feelsLikeMetric.textContent = '--';
            popMetric.textContent = '--';
        },
        { 
            enableHighAccuracy: false, 
            timeout: 15000, 
            maximumAge: 60000 
        }
    );
};
