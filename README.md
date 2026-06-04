# TimeTracker Pro by Msorl ⏱

**TimeTracker Pro** es una potente extensión para Google Chrome diseñada para rastrear automáticamente y en tiempo real el tiempo que pasas en cada sitio web. Mantén el control de tu productividad, visualiza tus hábitos de navegación y obtén un desglose detallado de tu actividad diaria, semanal y mensual.

## 🌟 Características Principales

*   **Rastreo 24/7 Preciso:** Cuenta el tiempo de forma ininterrumpida utilizando eventos nativos del navegador, incluso si el panel de la extensión está cerrado. Se pausa inteligentemente si detecta inactividad (sin ratón/teclado durante 60 segundos).
*   **Contador en Tiempo Real:** Visualiza cómo avanzan los segundos en vivo mientras navegas, con un indicador de estado.
*   **Integración Especial con YouTube:** No solo rastrea el tiempo que pasas en `youtube.com`, sino que desglosa **qué canales** y **qué vídeos** exactos has estado viendo.
*   **Calendario de Actividad:** Un mapa de calor mensual te muestra de un vistazo los días de mayor actividad. Haz clic en cualquier día para ver un historial detallado de las páginas visitadas en esa fecha.
*   **Gráficos Interactivos:** Visualiza tus métricas mediante gráficos de barras (últimos 7 días) y gráficos circulares (Top sitios de hoy) generados de forma nativa y segura.
*   **Favicons Nativos:** Muestra el logo oficial de cada web de forma segura sin depender de servicios externos.
*   **Privacidad Total:** Todos los datos se almacenan y procesan de forma local en tu navegador. No se envía información de tu historial a ningún servidor externo.

## 🚀 Cómo instalar y probar la extensión

Dado que esta extensión no está publicada en la Chrome Web Store (todavía), debes instalarla en modo desarrollador. Es un proceso rápido y seguro:

1.  **Descarga el código:** Clona este repositorio o descarga el código fuente en formato `.zip` y descomprímelo en una carpeta de tu ordenador.
2.  **Abre Chrome:** En la barra de direcciones de Google Chrome, escribe `chrome://extensions/` y pulsa Enter.
3.  **Activa el Modo Desarrollador:** En la esquina superior derecha de la página de extensiones, activa el interruptor que dice **"Modo de desarrollador"**.
4.  **Carga la extensión:** Aparecerán unos nuevos botones en la parte superior izquierda. Haz clic en **"Cargar descomprimida"** (Load unpacked).
5.  **Selecciona la carpeta:** Busca y selecciona la carpeta principal de este proyecto (la carpeta que contiene el archivo `manifest.json`).
6.  **¡Listo!** Verás el icono de **TimeTracker Pro** en la barra de extensiones de Chrome (puedes fijarlo haciendo clic en el icono del puzzle).

### 🧪 Cómo probarla
1. Abre el panel de la extensión haciendo clic en su icono. Verás que empieza a rastrear la página actual.
2. Abre una nueva pestaña y navega por tus webs favoritas (Google, GitHub, etc.).
3. Ve a YouTube, reproduce un vídeo y luego revisa el panel de la extensión: verás un menú desplegable en "youtube.com" mostrando exactamente qué vídeos has estado viendo.
4. Explora las pestañas de **Calendario**, **Semana**, **Mes** y **Gráfico** para ver tus estadísticas renderizadas al instante.

## 🛠️ Tecnologías utilizadas
*   HTML5 / CSS3 (Diseño moderno "Glassmorphism", variables CSS, animaciones).
*   JavaScript Vanilla (ES6+) para la lógica del panel (`popup.js`).
*   Chrome Extension API (Manifest V3):
    *   `Service Workers` para ejecución en segundo plano continua.
    *   `chrome.storage.local` para persistencia de datos offline.
    *   `chrome.tabs`, `chrome.windows`, `chrome.idle` para detección precisa de estado.

## 👨‍💻 Autor
Desarrollado por **Msorl**.
