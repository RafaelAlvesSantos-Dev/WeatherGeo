/**
 * WeatherGeo - Módulo de Comunicação Assíncrona (APIs REST)
 * @author RafaelAlves-Dev
 * @description Gerenciamento de requisições para OpenWeatherMap, IBGE, Nominatim e Overpass.
 */

import { showError } from './utils.js';
import { COUNTRY_NAMES_PT } from './countries-pt.js';

// ⚠️ Substitua pelo seu token em: https://home.openweathermap.org/api_keys
const OWM_API_KEY = 'aa21194e73ec976d37070482ea8ff835';
const OWM_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const OWM_LANG = 'pt_br';
const OWM_UNITS = 'metric';

const fetchJson = async (url, options = {}) => {
    if (url.includes('appid=SUA_API_KEY_AQUI')) {
        throw new Error('API_KEY_MISSING');
    }
    const response = await fetch(url, options);
    if (!response.ok) {
        const textError = await response.json().catch(() => ({}));
        throw new Error(textError.message || `HTTP ${response.status}`);
    }
    return response.json();
};

export const fetchCurrentWeatherByCoords = async (lat, lon) => {
    try {
        const url = `${OWM_BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=${OWM_UNITS}&lang=${OWM_LANG}`;
        return await fetchJson(url);
    } catch (error) {
        console.error('Erro ao buscar clima por coordenadas:', error);
        if (error.message === 'API_KEY_MISSING') {
            showError('Insira uma OpenWeatherMap API Key válida no arquivo api.js.');
        } else {
            showError('Não foi possível carregar o clima para esta localização.');
        }
        throw error;
    }
};

export const fetchCurrentWeatherByCity = async (city) => {
    try {
        const url = `${OWM_BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${OWM_API_KEY}&units=${OWM_UNITS}&lang=${OWM_LANG}`;
        return await fetchJson(url);
    } catch (error) {
        console.error('Erro ao buscar clima por cidade:', error);
        if (error.message === 'API_KEY_MISSING') {
            showError('Insira uma OpenWeatherMap API Key válida no arquivo api.js.');
        } else {
            showError(`Cidade "${city}" não encontrada. Verifique o nome e a API Key.`);
        }
        throw error;
    }
};

export const fetchForecastByCoords = async (lat, lon) => {
    try {
        const url = `${OWM_BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=${OWM_UNITS}&lang=${OWM_LANG}`;
        return await fetchJson(url);
    } catch (error) {
        console.error('Erro ao buscar previsão:', error);
        if (error.message === 'API_KEY_MISSING') {
            showError('Insira uma OpenWeatherMap API Key válida para carregar a previsão.');
        } else {
            showError('Erro ao carregar dados de previsão.');
        }
        throw error;
    }
};

// Base da CountriesNow API — cobre países além do Brasil (sem chave/token necessário)
const COUNTRIES_NOW_BASE = 'https://countriesnow.space/api/v0.1/countries';

/**
 * Retorna a lista completa de países do mundo com seus códigos ISO2,
 * usada para popular o select de País na exploração global (fora do Brasil).
 */
// Cache em memória: a aba Mundo e a aba Previsão usam a mesma lista de países
let cachedCountries = null;

export const fetchAllCountries = async () => {
    if (cachedCountries) return cachedCountries;

    try {
        const res = await fetch(`${COUNTRIES_NOW_BASE}/iso`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        cachedCountries = (json.data || [])
            .map(c => ({ name: COUNTRY_NAMES_PT[c.Iso2] || c.name, iso2: c.Iso2 }))
            .filter(c => c.name && c.iso2)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

        return cachedCountries;
    } catch (error) {
        console.error('Erro ao carregar lista de países:', error);
        showError('Erro ao carregar a lista de países.');
        throw error;
    }
};

/**
 * Retorna os estados/regiões de um país (fora do Brasil, que usa a IBGE).
 * Alguns países não têm essa divisão cadastrada na base — retorna array vazio.
 */
export const fetchStatesByCountry = async (country) => {
    try {
        const res = await fetch(`${COUNTRIES_NOW_BASE}/states`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return (json.data && json.data.states) || [];
    } catch (error) {
        console.error(`Erro ao carregar estados de ${country}:`, error);
        showError('Erro ao carregar estados/regiões deste país.');
        throw error;
    }
};

/**
 * Retorna as cidades de um estado/região específico de um país (fora do Brasil).
 */
export const fetchCitiesByState = async (country, state) => {
    try {
        const res = await fetch(`${COUNTRIES_NOW_BASE}/state/cities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country, state })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.data || [];
    } catch (error) {
        console.error(`Erro ao carregar cidades de ${state}, ${country}:`, error);
        showError('Erro ao carregar cidades desta região.');
        throw error;
    }
};

/**
 * Retorna todas as cidades cadastradas de um país, usada como fallback quando
 * o país não possui divisão em estados/regiões na base da CountriesNow.
 */
export const fetchCitiesByCountry = async (country) => {
    try {
        const res = await fetch(`${COUNTRIES_NOW_BASE}/cities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.data || [];
    } catch (error) {
        console.error(`Erro ao carregar cidades de ${country}:`, error);
        showError('Erro ao carregar cidades deste país.');
        throw error;
    }
};

export const fetchIBGEEstados = async () => {
    try {
        const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    } catch (error) {
        console.error('Erro IBGE (Estados):', error);
        showError('Erro ao carregar estados brasileiros.');
        throw error;
    }
};

export const fetchIBGECidades = async (estadoId) => {
    try {
        const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoId}/municipios?orderBy=nome`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    } catch (error) {
        console.error(`Erro IBGE (Cidades - ${estadoId}):`, error);
        showError('Erro ao carregar municípios do estado.');
        throw error;
    }
};

/**
 * Geocodifica uma cidade via Nominatim para obter coordenadas e bounding box precisos.
 * Não exige API Key. Utilizado para evitar limitações da busca por nome no OpenWeatherMap.
 *
 * @param {string} city         - Nome da cidade.
 * @param {string} [state='']   - Sigla do estado (melhora a precisão para cidades BR).
 * @param {string} [countrycodes=''] - Código ISO 3166-1 alpha-2 (ex: 'br') para restringir resultados.
 * @returns {Promise<Object>}   - { lat, lon, boundingbox: [south, north, west, east], ... }
 */
export const fetchCityCoords = async (city, state = '', countrycodes = '') => {
    const query = state ? `${city}, ${state}` : city;
    const params = new URLSearchParams({
        format: 'json',
        q: query,
        limit: 1,
        addressdetails: 1,
        email: 'weathergeo@portfolio.dev'
    });
    if (countrycodes) params.append('countrycodes', countrycodes);

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const response = await fetch(url, {
        headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' }
    });

    if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);

    const data = await response.json();
    if (!data || data.length === 0) throw new Error(`Localização não encontrada: "${city}"`);

    return data[0]; // { lat, lon, boundingbox: [south, north, west, east], display_name }
};

/**
 * Busca bairros de uma cidade via Overpass API (OpenStreetMap) usando o bounding box do Nominatim.
 * Nominatim retorna boundingbox no formato: [south, north, west, east].
 * Overpass espera o bbox no formato: (south, west, north, east).
 *
 * @returns {Promise<Array<{name: string, lat: string, lon: string}>>}
 */
export const fetchNeighborhoodsByBbox = async (south, north, west, east) => {
    try {
        // Overpass bbox format: (south, west, north, east)
        const query = `[out:json][timeout:20];node["place"~"suburb|neighbourhood|quarter"](${south},${west},${north},${east});out;`;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);

        const data = await response.json();

        return (data.elements || [])
            .filter(el => el.tags && el.tags.name)
            .map(el => ({
                name: el.tags.name,
                lat: String(el.lat),
                lon: String(el.lon)
            }));
    } catch (error) {
        console.warn('Overpass indisponível, usando fallback de cidade:', error.message);
        return []; // Caller trata com fallback (centro da cidade)
    }
};
