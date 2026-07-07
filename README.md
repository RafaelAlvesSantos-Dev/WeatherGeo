# 🌤️ WeatherGeo — Dashboard Climático Avançado

O **WeatherGeo** é um ecossistema SPA (*Single Page Application*) focado no monitoramento e análise das condições climáticas globais e locais. Unindo uma interface moderna baseada em **Glassmorphic Design** com uma arquitetura assíncrona robusta, o app integra múltiplas APIs REST para fornecer dados hierárquicos precisos que vão desde o nível de países até bairros específicos, incluindo um radar térmico interativo.

---

## 🚀 Funcionalidades Principais

*   **🌍 Exploração Global Hierárquica:** Sistema encadeado inteligente de filtros (**País ➔ Estado ➔ Cidade ➔ Bairro**) integrando dados do IBGE (para o Brasil) e CountriesNow API (para o restante do mundo).
*   **📍 Geolocalização Nativa:** Captura automática de coordenadas geográficas via API do navegador com tratamento avançado de estados (*Skeleton Screens* e fallbacks).
*   **📊 Análise Temporal (Gráfico Horário):** Gráfico linear responsivo e estilizado com as próximas 8 horas de previsão gerado via **Chart.js**.
*   **📅 Planejamento Semanal:** Previsão do tempo estendida e gerenciamento de locais favoritos persistidos diretamente no **localStorage**.
*   **🗺️ Radar Térmico Interativo:** Renderização de um mapa dinâmico via **Leaflet.js** que consome uma grade de pontos geográficos e colore marcadores com base na faixa térmica em tempo real.
*   **🕒 Interface Viva (Live Clock):** Relógio com data e hora atualizados em tempo real sincronizado com um indicador de temperatura por Emojis dinâmicos.

---

## 🛠️ Arquitetura de APIs e Tecnologias

Para contornar as limitações tradicionais de buscas por texto livre e garantir altíssima precisão de geocodificação, o projeto divide-se na integração das seguintes tecnologias:

### APIs Utilizadas
1.  **OpenWeatherMap API:** Responsável por alimentar o motor climático (`/weather` e `/forecast`).
2.  **IBGE Localidades:** Fornece a malha fina de estados e municípios do território brasileiro.
3.  **CountriesNow API:** Fornece a infraestrutura global de países, regiões e cidades estrangeiras.
4.  **Nominatim (OpenStreetMap):** Geocodifica nomes de cidades e retorna coordenadas exatas junto com sua *bounding box*.
5.  **Overpass API (OpenStreetMap):** Mapeia e extrai os bairros internos da localidade usando delimitações vetoriais (*suburb/neighbourhood/quarter*).

### Stack Técnica
*   **Linguagem:** JavaScript Moderno (ES6+) com Modularização Nativa (`import`/`export`).
*   **Renderização de Mapas:** Leaflet.js (Camadas de tiles do OpenStreetMap).
*   **Visualização de Dados:** Chart.js.
*   **Estilização:** CSS Custom Properties (Variáveis), Glassmorphism, Layouts Flexbox/Grid e animações fluidas de Skeleton Screen.
*   **Pacote de Ícones:** Remix Icon.

---

## 📂 Estrutura do Projeto

```text
├── index.html                # Estrutura HTML5 da SPA e containers de visualização
├── variables.css             # Definição de tokens de design, variáveis de cor e tema escuro
├── style.css                 # Estrutura base de layout, Media Queries e Sidebar responsiva
├── components.css            # Estilização modular de cards, selects, mapa e animações de shimmer
├── app.js                    # Core/Entry Point da SPA: coordena ciclos de vida e troca de abas
├── api.js                    # Módulo central assíncrono isolado para comunicação com as REST APIs
├── dom.js                    # Manipulação direta do DOM, loaders e fluxo de geolocalização nativa
├── chart.js                  # Inicialização, estilização e destruição segura dos gráficos Chart.js
└── utils.js                  # Utilitários globais: manipulação do localStorage, formatadores e alertas
