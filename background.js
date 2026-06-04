// ─────────────────────────────────────────────
// TimeTracker Pro — background.js (Service Worker)
// Responsabilidad: Rastrear tiempo activo por dominio y vídeo de YouTube.
// Implementación guiada por eventos + alarma de respaldo (24/7 seguro y preciso).
// ─────────────────────────────────────────────

// ── Estado en memoria ──
let activeTabId = null;
let activeDomain = null;
let activeVideoInfo = null;
let lastSessionStartTime = null;

// TabId -> { videoId, title, channel } para rastrear pestañas de YouTube independientes
let youtubeTabs = {};

// ── Utilidades de fecha ──
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function extractDomain(url) {
  if (!url) return null;
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:') || url.startsWith('edge://')) {
    return 'Sistema Chrome';
  }
  if (url.startsWith('file://')) {
    return 'Archivo Local';
  }
  try {
    const { hostname } = new URL(url);
    const domain = hostname.replace(/^www\./, '');
    return domain || 'Desconocido';
  } catch {
    return 'Desconocido';
  }
}

// Helpers de storage
function getStorageValue(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key]);
    });
  });
}

function setStorageValue(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

// ── Persistencia de datos acumulados ──
async function addTimeToStorage(domain, seconds, videoInfo) {
  if (!domain || seconds <= 0) return;

  const todayKey = getTodayKey();
  
  // 1. Guardar por dominio
  const domainKey = `day_${todayKey}`;
  const dayData = await getStorageValue(domainKey) || {};
  dayData[domain] = (dayData[domain] || 0) + seconds;
  await setStorageValue(domainKey, dayData);

  // 2. Guardar por vídeo de YouTube si aplica
  if (domain === 'youtube.com' && videoInfo && videoInfo.videoId) {
    const ytKey = `yt_day_${todayKey}`;
    const ytData = await getStorageValue(ytKey) || {};
    if (!ytData[videoInfo.videoId]) {
      ytData[videoInfo.videoId] = {
        title: videoInfo.title,
        channel: videoInfo.channel,
        seconds: 0
      };
    }
    ytData[videoInfo.videoId].seconds += seconds;
    await setStorageValue(ytKey, ytData);
  }
}

// ── Transición y actualización de la sesión activa ──
async function updateActiveSession(newDomain, newVideoInfo) {
  const now = Date.now();

  // Guardar tiempo acumulado en la sesión anterior si existía
  if (activeDomain && lastSessionStartTime) {
    const elapsedSeconds = Math.round((now - lastSessionStartTime) / 1000);
    if (elapsedSeconds > 0) {
      await addTimeToStorage(activeDomain, elapsedSeconds, activeVideoInfo);
    }
  }

  // Establecer nuevo estado
  activeDomain = newDomain;
  activeVideoInfo = newVideoInfo;

  // IMPORTANTE: Ya no dependemos de isBrowserFocused ni de inactividad (idle).
  // Siempre rastreamos si hay un dominio, ideal para que cuente al ver videos.
  const isTrackingActive = !!activeDomain;

  if (isTrackingActive) {
    lastSessionStartTime = now;
    const session = {
      domain: activeDomain,
      startTime: lastSessionStartTime,
      video: activeVideoInfo
    };
    await setStorageValue('activeSession', session);
  } else {
    lastSessionStartTime = null;
    await setStorageValue('activeSession', null);
  }
}

// ── LISTENERS DE EVENTOS DE NAVEGACIÓN ──

// Cambio de pestaña activa en la misma ventana
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  const window = await chrome.windows.get(windowId).catch(() => null);
  const isFocused = window ? window.focused : false;

  if (isFocused) {
    isBrowserFocused = true;
    activeTabId = tabId;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    const domain = tab ? extractDomain(tab.url) : null;
    const videoInfo = youtubeTabs[tabId] || null;
    await updateActiveSession(domain, videoInfo);
  }
});

// Navegación (cambio de URL) en la pestaña activa
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    const domain = extractDomain(changeInfo.url);
    if (domain !== 'youtube.com') {
      delete youtubeTabs[tabId];
    }
    const videoInfo = youtubeTabs[tabId] || null;
    await updateActiveSession(domain, videoInfo);
  }
});

// Cierre de pestaña
chrome.tabs.onRemoved.addListener(async (tabId) => {
  delete youtubeTabs[tabId];
  if (tabId === activeTabId) {
    await updateActiveSession(null, null);
    activeTabId = null;
  }
});

// Se ha eliminado el listener de chrome.windows.onFocusChanged para cumplir
// con la solicitud del usuario de "contar el tiempo todo el rato", incluso
// cuando Chrome no tenga el foco.

// (Eliminado el listener de inactividad chrome.idle para que no se pause el contador
// cuando el usuario ve videos largos sin mover el ratón)

// Mensajes del script de contenido (YouTube)
chrome.runtime.onMessage.addListener(async (message, sender) => {
  if (message.type === 'YOUTUBE_WATCHING' && sender.tab) {
    const tabId = sender.tab.id;
    if (message.data) {
      youtubeTabs[tabId] = message.data;
    } else {
      delete youtubeTabs[tabId];
    }

    if (tabId === activeTabId) {
      const domain = extractDomain(sender.tab.url);
      await updateActiveSession(domain, message.data || null);
    }
  }
});

// ── ALARMA DE RESPALDO (1 minuto) ──
chrome.alarms.create('timetracker_backup', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'timetracker_backup') {
    if (activeDomain && lastSessionStartTime) {
      const now = Date.now();
      const elapsedSeconds = Math.round((now - lastSessionStartTime) / 1000);
      if (elapsedSeconds > 0) {
        await addTimeToStorage(activeDomain, elapsedSeconds, activeVideoInfo);
        
        // Mantener la sesión activa avanzando el startTime
        lastSessionStartTime = now;
        const session = {
          domain: activeDomain,
          startTime: lastSessionStartTime,
          video: activeVideoInfo
        };
        await setStorageValue('activeSession', session);
      }
    }
  }
});

// ── INICIALIZACIÓN AL INICIAR/DESPERTAR SW ──
async function initActiveTab() {

  const windows = await chrome.windows.getAll({ populate: true }).catch(() => []);
  // Buscamos una ventana normal que esté enfocada, o en su defecto la primera ventana normal
  const normalFocusedWindow = windows.find(w => w.focused && w.type !== 'popup');
  const fallbackWindow = windows.find(w => w.type !== 'popup');
  const targetWindow = normalFocusedWindow || fallbackWindow;

  // Si hay alguna ventana popup enfocada (como la propia extensión), seguimos considerando el navegador activo
  const hasPopupFocused = windows.some(w => w.focused && w.type === 'popup');

  if (targetWindow) {
    const activeTab = targetWindow.tabs.find(t => t.active);
    if (activeTab) {
      activeTabId = activeTab.id;
      const domain = extractDomain(activeTab.url);
      await updateActiveSession(domain, null);
      return;
    }
  }

  await updateActiveSession(null, null);
}

initActiveTab();
