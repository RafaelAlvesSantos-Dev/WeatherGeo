/**
 * WeatherGeo - Dashboard Climático Avançado
 * @author RafaelAlves-Dev
 * @description Entry Point da SPA. Coordena ciclo de vida, troca de abas e lógica de cada seção.
 */

import {
    fetchCurrentWeatherByCity,
    fetchCurrentWeatherByCoords,
    fetchForecastByCoords,
    fetchIBGEEstados,
    fetchIBGECidades,
    fetchCityCoords,
    fetchNeighborhoodsByBbox,
    fetchAllCountries,
    fetchStatesByCountry,
    fetchCitiesByState,
    fetchCitiesByCountry
} from './api.js';
import {
    showError,
    formatTemperature,
    formatUnixDate,
    getFavorites,
    saveFavorite,
    removeFavorite,
    getTempColorRadar,
    getTempEmoji
} from './utils.js';
import { handleGeolocationAndLoad } from './dom.js';

const navButtons = document.querySelectorAll('.nav-menu .nav-btn');
const tabPanes  = document.querySelectorAll('.main-content .tab-pane');

let mapInstance = null;
let radarMarkers = [];
let radarMoveTimeout = null;
let radarLoading = false;

// Grade de pontos ao redor do centro (raio de amostragem)
const RADAR_GRID_SIZE = 1;   // 1 = grade 3x3 (9 pontos)
const RADAR_OFFSET = 0.18;   // ~18-20km entre pontos

/* ==========================================================================
   NAVEGAÇÃO ENTRE ABAS
   ========================================================================== */
const switchTab = (targetId) => {
    navButtons.forEach(btn =>
        btn.classList.toggle('active', btn.dataset.target === targetId)
    );
    tabPanes.forEach(pane => {
        const isTarget = pane.id === `pane-${targetId}`;
        pane.classList.toggle('hidden', !isTarget);
        pane.classList.toggle('active', isTarget);
    });

    if (targetId === 'radar') {
        // Espera o navegador aplicar a remoção da classe "hidden" e calcular
        // o layout real do painel antes de inicializar/redimensionar o mapa.
        requestAnimationFrame(() => {
            initRadarTab();
            if (mapInstance) {
                // Duplo rAF + timeout: garante que o Leaflet recalcule o tamanho
                // do container mesmo em navegadores mais lentos para aplicar o layout.
                requestAnimationFrame(() => mapInstance.invalidateSize());
                setTimeout(() => mapInstance.invalidateSize(), 250);
            }
        });
    }
};

/* ==========================================================================
   UTILITÁRIO: RESET DE SELECTS ENCADEADOS
   ========================================================================== */
const resetSelects = (selectsArray) => {
    selectsArray.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '<option value="">Selecione</option>';
        sel.disabled = true;
    });
};

/* ==========================================================================
   CADEIA REUTILIZÁVEL: País → Estado/Região → Cidade
   Brasil usa a IBGE (dados mais precisos e já testados); qualquer outro país
   usa a CountriesNow API (gratuita, sem chave). Países sem divisão em estados
   cadastrada na base pulam direto para a lista de cidades do próprio país.
   ========================================================================== */
const setupLocationChain = ({ selectPais, selectEstado, selectCidade, onCidadeChange, onChainReset = () => {}, extraResetOnPais = [], extraResetOnEstado = [] }) => {
    let currentIso2 = '';

    (async () => {
        try {
            selectPais.innerHTML = '<option value="">Carregando países...</option>';
            const countries = await fetchAllCountries();
            selectPais.innerHTML =
                '<option value="">Selecione o País</option>' +
                countries.map(c => `<option value="${c.name}" data-iso2="${c.iso2}">${c.name}</option>`).join('');
            selectPais.disabled = false;
        } catch {
            selectPais.innerHTML = '<option value="">Erro ao carregar países</option>';
        }
    })();

    selectPais.addEventListener('change', async () => {
        resetSelects([selectEstado, selectCidade, ...extraResetOnPais]);
        onChainReset();

        const paisNome = selectPais.value;
        const selectedOption = selectPais.options[selectPais.selectedIndex];
        currentIso2 = (selectedOption && selectedOption.dataset.iso2) || '';

        if (!paisNome) return;

        try {
            if (currentIso2 === 'BR') {
                const estados = await fetchIBGEEstados();
                selectEstado.innerHTML =
                    '<option value="">Selecione o Estado</option>' +
                    estados.map(e => `<option value="${e.sigla}">${e.nome}</option>`).join('');
                selectEstado.disabled = false;
                return;
            }

            const states = await fetchStatesByCountry(paisNome);

            if (states.length === 0) {
                // País sem estados/regiões cadastrados: pula direto para as cidades do país
                selectEstado.innerHTML = '<option value="__NONE__">Não aplicável</option>';
                selectEstado.disabled = true;

                const cidades = await fetchCitiesByCountry(paisNome);
                selectCidade.innerHTML =
                    '<option value="">Selecione a Cidade</option>' +
                    cidades.map(c => `<option value="${c}">${c}</option>`).join('');
                selectCidade.disabled = false;
                return;
            }

            selectEstado.innerHTML =
                '<option value="">Selecione o Estado/Região</option>' +
                states.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
            selectEstado.disabled = false;
        } catch {
            showError('Falha ao carregar estados/regiões deste país.');
        }
    });

    selectEstado.addEventListener('change', async () => {
        resetSelects([selectCidade, ...extraResetOnEstado]);
        onChainReset();

        const paisNome   = selectPais.value;
        const estadoNome = selectEstado.value;
        if (!paisNome || !estadoNome || estadoNome === '__NONE__') return;

        try {
            if (currentIso2 === 'BR') {
                const cidades = await fetchIBGECidades(estadoNome);
                selectCidade.innerHTML =
                    '<option value="">Selecione a Cidade</option>' +
                    cidades.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
                selectCidade.disabled = false;
                return;
            }

            const cidades = await fetchCitiesByState(paisNome, estadoNome);
            selectCidade.innerHTML =
                '<option value="">Selecione a Cidade</option>' +
                cidades.map(c => `<option value="${c}">${c}</option>`).join('');
            selectCidade.disabled = false;
        } catch {
            showError('Falha ao carregar cidades desta região.');
        }
    });

    selectCidade.addEventListener('change', () => {
        const cidadeNome = selectCidade.value;
        if (!cidadeNome) return;

        const estadoNome = selectEstado.value !== '__NONE__' ? selectEstado.value : '';
        onCidadeChange({
            cidade: cidadeNome,
            estado: estadoNome,
            pais: selectPais.value,
            iso2: currentIso2
        });
    });
};

/* ==========================================================================
   ABA MUNDO — Exploração Global com filtros encadeados (Brasil + todo o mundo)
   ========================================================================== */
const initWorldTab = () => {
    const selectPais   = document.getElementById('select-pais');
    const selectEstado = document.getElementById('select-estado');
    const selectCidade = document.getElementById('select-cidade');
    const selectBairro = document.getElementById('select-bairro');
    const display      = document.getElementById('mundo-result-display');

    if (!selectPais) return;

    const loadCityWeather = async ({ cidade: cidadeNome, estado: estadoNome, iso2 }) => {
        resetSelects([selectBairro]);

        selectBairro.innerHTML = '<option value="">Carregando bairros...</option>';
        display.innerHTML      = '<p class="placeholder-text">Buscando dados climáticos da cidade...</p>';

        try {
            const cityGeo = await fetchCityCoords(cidadeNome, estadoNome, iso2 ? iso2.toLowerCase() : '');
            const { lat: cityLat, lon: cityLon, boundingbox } = cityGeo;

            const current = await fetchCurrentWeatherByCoords(cityLat, cityLon);

            display.innerHTML = `
                <div class="main-weather-info animate-fade-in" style="padding: 1.5rem; text-align: center;">
                    <h2>${cidadeNome}${estadoNome ? ` (${estadoNome})` : ''}</h2>
                    <div class="temp-display" style="display: flex; align-items: center; justify-content: center; gap: 10px; margin: 1rem 0;">
                        <h1 style="font-size: 3.5rem; margin: 0;">${formatTemperature(current.main.temp)}</h1>
                    </div>
                    <p class="weather-description" style="margin: 0.5rem 0; font-weight: bold;">
                        ${current.weather[0].description.toUpperCase()}
                    </p>
                    <span style="font-size: 0.9rem; opacity: 0.8;">
                        Sensação: ${formatTemperature(current.main.feels_like)} &nbsp;|&nbsp; Umidade: ${current.main.humidity}%
                    </span>
                </div>
            `;

            const [south, north, west, east] = boundingbox;
            const neighborhoods = await fetchNeighborhoodsByBbox(south, north, west, east);

            if (neighborhoods.length > 0) {
                const seen   = new Set();
                const unique = neighborhoods
                    .filter(n => !seen.has(n.name) && seen.add(n.name))
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

                selectBairro.innerHTML =
                    '<option value="">Selecione o Bairro</option>' +
                    unique.map(b =>
                        `<option value="${b.name}" data-lat="${b.lat}" data-lon="${b.lon}">${b.name}</option>`
                    ).join('');
            } else {
                selectBairro.innerHTML = `
                    <option value="${cidadeNome}" data-lat="${cityLat}" data-lon="${cityLon}">
                        Centro (${cidadeNome})
                    </option>`;
            }
            selectBairro.disabled = false;

        } catch (error) {
            console.error('Erro ao carregar dados da cidade:', error);
            if (error.message !== 'API_KEY_MISSING') {
                display.innerHTML = '<p class="placeholder-text">Não foi possível carregar os dados desta cidade. Tente novamente.</p>';
            }
            selectBairro.innerHTML = '<option value="">Sem dados disponíveis</option>';
            selectBairro.disabled  = true;
        }
    };

    setupLocationChain({
        selectPais, selectEstado, selectCidade,
        extraResetOnPais: [selectBairro],
        extraResetOnEstado: [selectBairro],
        onChainReset: () => {
            display.innerHTML = '<p class="placeholder-text">Selecione os filtros acima para exibir os dados climáticos.</p>';
        },
        onCidadeChange: loadCityWeather
    });

    selectBairro.addEventListener('change', async () => {
        const bairroNome     = selectBairro.value;
        const selectedOption = selectBairro.options[selectBairro.selectedIndex];

        if (!bairroNome || !selectedOption) return;

        const lat = selectedOption.dataset.lat;
        const lon = selectedOption.dataset.lon;
        if (!lat || !lon) return;

        try {
            display.innerHTML = '<p class="placeholder-text">Refinando dados climáticos para o bairro...</p>';
            const current = await fetchCurrentWeatherByCoords(lat, lon);

            display.innerHTML = `
                <div class="main-weather-info animate-fade-in" style="padding: 1.5rem; text-align: center;">
                    <h2>${bairroNome}</h2>
                    <p style="margin: 0; opacity: 0.6;">${selectCidade.value} — ${selectEstado.value}</p>
                    <div class="temp-display" style="display: flex; align-items: center; justify-content: center; margin: 1rem 0;">
                        <h1 style="font-size: 3.5rem; margin: 0;">${formatTemperature(current.main.temp)}</h1>
                    </div>
                    <p class="weather-description" style="margin: 0.5rem 0; font-weight: bold;">
                        ${current.weather[0].description.toUpperCase()}
                    </p>
                    <span style="font-size: 0.9rem; opacity: 0.8;">
                        Sensação: ${formatTemperature(current.main.feels_like)} &nbsp;|&nbsp; Umidade: ${current.main.humidity}%
                    </span>
                </div>
            `;
        } catch {
            showError('Não foi possível carregar o clima para este bairro.');
        }
    });
};

/* ==========================================================================
   ABA PREVISÃO — Planejamento semanal + favoritos
   ========================================================================== */
const initForecastTab = () => {
    const inputFav        = document.getElementById('input-fav');
    const btnAddFav       = document.getElementById('btn-add-fav');
    const favoritesList   = document.getElementById('favorites-list');
    const weeklyContainer = document.getElementById('weekly-forecast-container');

    if (!favoritesList) return;

    const renderFavorites = () => {
        const favs = getFavorites();

        if (favs.length === 0) {
            favoritesList.innerHTML = '<p class="placeholder-text" style="padding: 10px; font-size: 0.85rem;">Nenhum local salvo ainda.</p>';
            return;
        }

        favoritesList.innerHTML = favs.map(city => `
            <li style="display: flex; justify-content: space-between; align-items: center;
                        padding: 0.6rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span class="fav-item-click" style="cursor: pointer; font-size: 0.95rem; flex-grow: 1;">${city}</span>
                <button class="btn-del" data-name="${city}"
                    style="background: none; border: none; color: #f43f5e; cursor: pointer;">
                    <i class="ri-delete-bin-6-line"></i>
                </button>
            </li>
        `).join('');

        favoritesList.querySelectorAll('.fav-item-click').forEach(item => {
            item.addEventListener('click', () => loadExtendedForecast(item.textContent.trim()));
        });

        favoritesList.querySelectorAll('.btn-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFavorite(btn.dataset.name);
                renderFavorites();
            });
        });
    };

    /** Renderiza a lista de cards da previsão semanal a partir da resposta da API. */
    const renderWeeklyForecast = (forecastData) => {
        const dailyFiltered = forecastData.list.filter((_, idx) => idx % 8 === 0);

        weeklyContainer.innerHTML = dailyFiltered.map(day => {
            const label = formatUnixDate(day.dt);
            return `
                <div class="forecast-card glass animate-fade-in"
                     style="display: flex; justify-content: space-between; align-items: center;
                            padding: 1.2rem; margin-bottom: 0.8rem; border-radius: 12px;">
                    <div>
                        <span style="font-weight: 600; display: block; font-size: 1.05rem;">
                            ${label.charAt(0).toUpperCase() + label.slice(1)}
                        </span>
                        <span style="font-size: 0.85rem; opacity: 0.75;">${day.weather[0].description}</span>
                    </div>
                    <h2 style="margin: 0; font-size: 1.6rem;">${formatTemperature(day.main.temp)}</h2>
                </div>
            `;
        }).join('');
    };

    const loadExtendedForecast = async (cityName, stateName = '', iso2 = '') => {
        try {
            weeklyContainer.innerHTML = '<p class="placeholder-text">Carregando previsão semanal...</p>';

            let lat, lon;

            try {
                const geoData = await fetchCityCoords(cityName, stateName, iso2 ? iso2.toLowerCase() : '');
                lat = geoData.lat;
                lon = geoData.lon;
            } catch {
                const cityData = await fetchCurrentWeatherByCity(cityName);
                lat = cityData.coord.lat;
                lon = cityData.coord.lon;
            }

            const forecastData = await fetchForecastByCoords(lat, lon);
            renderWeeklyForecast(forecastData);

        } catch {
            weeklyContainer.innerHTML = '<p class="placeholder-text">Erro ao carregar previsão. Verifique o nome da cidade e sua API Key.</p>';
        }
    };

    /**
     * Carrega a previsão semanal diretamente por coordenadas — usado quando o
     * usuário refina a busca até o nível de Bairro na cadeia
     * País → Estado → Cidade → Bairro, igual à aba Mundo.
     */
    const loadExtendedForecastByCoords = async (lat, lon) => {
        try {
            weeklyContainer.innerHTML = '<p class="placeholder-text">Carregando previsão semanal do bairro...</p>';
            const forecastData = await fetchForecastByCoords(lat, lon);
            renderWeeklyForecast(forecastData);
        } catch {
            weeklyContainer.innerHTML = '<p class="placeholder-text">Erro ao carregar previsão para este bairro.</p>';
        }
    };

    btnAddFav.addEventListener('click', () => {
        const value = inputFav.value.trim();
        if (!value) return;

        if (saveFavorite(value)) {
            inputFav.value = '';
            renderFavorites();
            loadExtendedForecast(value);
        } else {
            showError('Esta cidade já está na sua lista de favoritos.');
        }
    });

    inputFav.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnAddFav.click();
    });

    // Busca global (País → Estado/Região → Cidade), mesma cadeia usada na aba Mundo,
    // como alternativa mais precisa à busca por texto livre acima.
    const selectPaisPrev   = document.getElementById('select-pais-previsao');
    const selectEstadoPrev = document.getElementById('select-estado-previsao');
    const selectCidadePrev = document.getElementById('select-cidade-previsao');
    const selectBairroPrev = document.getElementById('select-bairro-previsao');

    if (selectPaisPrev && selectEstadoPrev && selectCidadePrev) {
        setupLocationChain({
            selectPais: selectPaisPrev,
            selectEstado: selectEstadoPrev,
            selectCidade: selectCidadePrev,
            extraResetOnPais: [selectBairroPrev],
            extraResetOnEstado: [selectBairroPrev],
            onCidadeChange: async ({ cidade, estado, iso2 }) => {
                const favoriteLabel = estado ? `${cidade}, ${estado}` : cidade;

                if (saveFavorite(favoriteLabel)) {
                    renderFavorites();
                } else {
                    showError('Este local já está na sua lista de favoritos.');
                }
                loadExtendedForecast(cidade, estado, iso2);

                // Carrega os bairros da cidade selecionada, na mesma lógica da aba Mundo
                if (!selectBairroPrev) return;

                resetSelects([selectBairroPrev]);
                selectBairroPrev.innerHTML = '<option value="">Carregando bairros...</option>';

                try {
                    const cityGeo = await fetchCityCoords(cidade, estado, iso2 ? iso2.toLowerCase() : '');
                    const { lat: cityLat, lon: cityLon, boundingbox } = cityGeo;
                    const [south, north, west, east] = boundingbox;
                    const neighborhoods = await fetchNeighborhoodsByBbox(south, north, west, east);

                    if (neighborhoods.length > 0) {
                        const seen   = new Set();
                        const unique = neighborhoods
                            .filter(n => !seen.has(n.name) && seen.add(n.name))
                            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

                        selectBairroPrev.innerHTML =
                            '<option value="">Selecione o Bairro</option>' +
                            unique.map(b =>
                                `<option value="${b.name}" data-lat="${b.lat}" data-lon="${b.lon}">${b.name}</option>`
                            ).join('');
                    } else {
                        selectBairroPrev.innerHTML = `
                            <option value="${cidade}" data-lat="${cityLat}" data-lon="${cityLon}">
                                Centro (${cidade})
                            </option>`;
                    }
                    selectBairroPrev.disabled = false;
                } catch (error) {
                    console.error('Erro ao carregar bairros para a previsão:', error);
                    selectBairroPrev.innerHTML = '<option value="">Sem dados disponíveis</option>';
                    selectBairroPrev.disabled = true;
                }
            }
        });

        if (selectBairroPrev) {
            selectBairroPrev.addEventListener('change', () => {
                const bairroNome     = selectBairroPrev.value;
                const selectedOption = selectBairroPrev.options[selectBairroPrev.selectedIndex];

                if (!bairroNome || !selectedOption) return;

                const lat = selectedOption.dataset.lat;
                const lon = selectedOption.dataset.lon;
                if (!lat || !lon) return;

                loadExtendedForecastByCoords(lat, lon);
            });
        }
    }

    renderFavorites();
};

/* ==========================================================================
   ABA RADAR — Mapa Leaflet com radar térmico funcional
   ========================================================================== */

/** Remove todos os marcadores térmicos atuais do mapa. */
const clearRadarMarkers = () => {
    radarMarkers.forEach(marker => mapInstance.removeLayer(marker));
    radarMarkers = [];
};

/**
 * Busca o clima em uma grade de pontos ao redor do centro informado
 * e desenha círculos coloridos (conforme a legenda) no mapa.
 */
const loadRadarGrid = async (centerLat, centerLon) => {
    if (!mapInstance || radarLoading) return;
    radarLoading = true;

    const mapElement = document.getElementById('map');
    if (mapElement) mapElement.classList.add('skeleton-loading');

    const points = [];
    for (let i = -RADAR_GRID_SIZE; i <= RADAR_GRID_SIZE; i++) {
        for (let j = -RADAR_GRID_SIZE; j <= RADAR_GRID_SIZE; j++) {
            points.push([centerLat + i * RADAR_OFFSET, centerLon + j * RADAR_OFFSET]);
        }
    }

    try {
        const results = await Promise.allSettled(
            points.map(([lat, lon]) => fetchCurrentWeatherByCoords(lat, lon))
        );

        clearRadarMarkers();

        results.forEach((result, idx) => {
            if (result.status !== 'fulfilled') return;

            const data = result.value;
            const [lat, lon] = points[idx];
            const temp = data.main.temp;
            const color = getTempColorRadar(temp);

            const marker = L.circleMarker([lat, lon], {
                radius: 18,
                fillColor: color,
                color: 'rgba(255, 255, 255, 0.6)',
                weight: 1,
                fillOpacity: 0.55
            })
                .bindPopup(
                    `<strong>${data.name || 'Local'}</strong><br>` +
                    `${formatTemperature(temp)} — ${data.weather[0].description}`
                )
                .addTo(mapInstance);

            radarMarkers.push(marker);
        });
    } catch (error) {
        console.error('Erro ao carregar radar térmico:', error);
        showError('Não foi possível carregar os dados do radar térmico.');
    } finally {
        radarLoading = false;
        if (mapElement) mapElement.classList.remove('skeleton-loading');
    }
};

const initRadarTab = () => {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    if (mapInstance) return; // Mapa já inicializado; evita recriar a instância

    // Se o container ainda estiver com altura 0 (painel ainda não totalmente
    // "visível" para o navegador), adia a inicialização por um instante em vez
    // de deixar o Leaflet calcular um mapa 0x0 (causa clássica de mapa em branco).
    if (mapElement.clientHeight === 0 || mapElement.clientWidth === 0) {
        setTimeout(initRadarTab, 100);
        return;
    }

    try {
        mapInstance = L.map('map').setView([-25.4284, -49.2733], 11);

        const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(mapInstance);

        // Diagnóstico: se os tiles falharem (bloqueio de rede, CDN, adblock etc.),
        // avisa o usuário em vez de deixar o mapa em branco silenciosamente.
        let tilesLoadedOk = false;
        tileLayer.on('load', () => { tilesLoadedOk = true; });
        tileLayer.on('tileerror', () => {
            if (!tilesLoadedOk) {
                showError('Não foi possível carregar os tiles do mapa (verifique sua conexão ou bloqueadores de anúncio).');
            }
        });

        // Garante que o Leaflet recalcule as dimensões assim que o container
        // estiver com o tamanho final aplicado pelo CSS.
        requestAnimationFrame(() => mapInstance.invalidateSize());

        // Carrega o radar inicial no centro padrão (Curitiba)
        loadRadarGrid(-25.4284, -49.2733);

        // Recarrega o radar sempre que o usuário mover/dar zoom no mapa (com debounce)
        mapInstance.on('moveend', () => {
            clearTimeout(radarMoveTimeout);
            radarMoveTimeout = setTimeout(() => {
                const center = mapInstance.getCenter();
                loadRadarGrid(center.lat, center.lng);
            }, 800);
        });

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                ({ coords: { latitude, longitude } }) => {
                    mapInstance.setView([latitude, longitude], 12);
                    L.marker([latitude, longitude])
                        .addTo(mapInstance)
                        .bindPopup('Sua localização')
                        .openPopup();
                    loadRadarGrid(latitude, longitude);
                },
                () => console.log('Geolocalização não disponível para o radar.')
            );
        }
    } catch (err) {
        console.error('Falha ao inicializar o mapa Leaflet:', err);
    }
};

/* ==========================================================================
   RELÓGIO AO VIVO — Rodapé da Sidebar (Data + Hora em tempo real)
   ========================================================================== */
const initLiveClock = () => {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    const emojiEl = document.getElementById('clock-emoji');
    if (!timeEl || !dateEl) return;

    const updateClock = () => {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        dateEl.textContent = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    updateClock();
    setInterval(updateClock, 1000); // Atualiza a cada segundo p/ sincronizar exatamente na virada do minuto

    // Troca o emoji conforme a temperatura atual (mesma faixa da Legenda do Radar)
    if (emojiEl) {
        window.addEventListener('weathergeo:temp-update', (event) => {
            emojiEl.textContent = getTempEmoji(event.detail.temp);
        });
    }
};

/* ==========================================================================
   INICIALIZAÇÃO
   ========================================================================== */
const setupEventListeners = () => {
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            if (target) switchTab(target);
        });
    });
};

const init = () => {
    console.log('WeatherGeo inicializado ✓');
    setupEventListeners();
    initLiveClock();
    handleGeolocationAndLoad();
    initWorldTab();
    initForecastTab();
};

document.addEventListener('DOMContentLoaded', init);

export { init, switchTab };
