/**
 * WeatherGeo - Módulo de Utilitários
 * @author RafaelAlves-Dev
 * @description Funções utilitárias para formatação de dados, manipulação 
 * do localStorage e gerenciamento centralizado de erros na UI.
 */

const ERROR_CONTAINER_ID = 'error-container';
const FAVORITES_KEY = 'weathergeo_favorites';

/**
 * Exibe uma mensagem de erro amigável diretamente na interface do usuário.
 * @param {string} message - Mensagem clara de erro para o usuário.
 * @param {number} timeout - Tempo em milissegundos antes de ocultar o alerta (padrão: 5000ms).
 */
export const showError = (message, timeout = 5000) => {
    const errorContainer = document.getElementById(ERROR_CONTAINER_ID);
    if (!errorContainer) return;

    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');

    if (window.errorTimeout) {
        clearTimeout(window.errorTimeout);
    }

    window.errorTimeout = setTimeout(() => {
        errorContainer.classList.add('hidden');
        errorContainer.textContent = '';
    }, timeout);
};

/**
 * Formata um valor numérico para exibição padronizada em graus Celsius.
 */
export const formatTemperature = (temp) => {
    if (temp === undefined || temp === null || isNaN(temp)) return '--°C';
    return `${Math.round(temp)}°C`;
};

/**
 * Converte um timestamp UNIX em string de data baseada no idioma do navegador.
 */
export const formatUnixDate = (timestamp, options = { weekday: 'long', day: 'numeric', month: 'short' }) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat('pt-BR', options).format(date);
};

/**
 * Extrai o horário formatado (HH:MM) a partir de um timestamp UNIX.
 */
export const formatUnixTime = (timestamp) => {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Retorna a cor hexadecimal correspondente à faixa de temperatura,
 * seguindo a mesma legenda exibida na aba Radar.
 * @param {number} temp - Temperatura em graus Celsius.
 * @returns {string} Cor hexadecimal.
 */
export const getTempColorRadar = (temp) => {
    if (temp === undefined || temp === null || isNaN(temp)) return '#94a3b8';
    if (temp < 10) return '#3b82f6';   // Frio Intenso
    if (temp < 23) return '#10b981';   // Agradável
    if (temp < 35) return '#f59e0b';   // Quente
    return '#ef4444';                  // Calor Extremo
};

/**
 * Retorna um emoji representando a faixa de temperatura atual, usado no
 * relógio ao vivo da sidebar. Segue os mesmos limites da Legenda de Temperatura
 * exibida na aba Radar.
 * @param {number} temp - Temperatura em graus Celsius.
 * @returns {string} Emoji correspondente à faixa.
 */
export const getTempEmoji = (temp) => {
    if (temp === undefined || temp === null || isNaN(temp)) return '🌡️';
    if (temp < 10) return '🥶';   // Frio Intenso
    if (temp < 23) return '😊';   // Agradável
    if (temp < 35) return '☀️';   // Quente
    return '🔥';                  // Calor Extremo
};

/**
 * Recupera os locais favoritados armazenados no localStorage do navegador.
 */
export const getFavorites = () => {
    try {
        const storedFavs = localStorage.getItem(FAVORITES_KEY);
        return storedFavs ? JSON.parse(storedFavs) : [];
    } catch (error) {
        console.error('Erro ao ler dados do localStorage:', error);
        return [];
    }
};

/**
 * Adiciona um novo local de forma persistente à lista de favoritos.
 */
export const saveFavorite = (city) => {
    if (!city || typeof city !== 'string') return false;
    const sanitizedCity = city.trim();
    if (!sanitizedCity) return false;

    try {
        const favorites = getFavorites();
        if (!favorites.some(fav => fav.toLowerCase() === sanitizedCity.toLowerCase())) {
            favorites.push(sanitizedCity);
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Erro ao salvar no localStorage:', error);
        showError('Não foi possível gravar o local nos favoritos.');
        return false;
    }
};

/**
 * Remove um local específico do armazenamento interno de favoritos.
 */
export const removeFavorite = (city) => {
    if (!city) return false;
    try {
        const favorites = getFavorites();
        const updatedFavorites = favorites.filter(fav => fav.toLowerCase() !== city.trim().toLowerCase());
        
        if (favorites.length !== updatedFavorites.length) {
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Erro ao gerenciar exclusão no localStorage:', error);
        showError('Houve um erro técnico ao remover este item.');
        return false;
    }
};
