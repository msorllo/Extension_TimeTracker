// ─────────────────────────────────────────────
// TimeTracker Pro — content.js
// Responsabilidad: Extraer información de vídeos y canales en YouTube
// y notificar al background worker cuando hay cambios.
// ─────────────────────────────────────────────

let lastVideoId = null;
let lastSentData = null;
let checkInterval = null;

function getYouTubeVideoId(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
      return urlObj.searchParams.get('v');
    }
  } catch (e) {
    // Silencioso
  }
  return null;
}

function extractYouTubeData() {
  const videoId = getYouTubeVideoId(window.location.href);

  if (!videoId) {
    // Si ya no estamos en un vídeo de YouTube
    if (lastVideoId !== null) {
      lastVideoId = null;
      lastSentData = null;
      chrome.runtime.sendMessage({ type: 'YOUTUBE_WATCHING', data: null }).catch(() => {});
    }
    return;
  }

  // Selectores para el título del vídeo y nombre del canal
  const titleEl = document.querySelector('ytd-watch-metadata #title h1, h1.ytd-watch-metadata, #title.ytd-watch-metadata h1');
  const channelEl = document.querySelector('ytd-watch-metadata #channel-name a, #upload-info #channel-name a, ytd-video-owner-renderer #channel-name a, #owner-name a');

  const title = titleEl ? titleEl.textContent.trim() : '';
  const channel = channelEl ? channelEl.textContent.trim() : '';

  // Esperamos a que los elementos estén cargados e insertados en el DOM
  if (!title && !channel) {
    return; // Sigue cargando la página SPA
  }

  const payload = { videoId, title: title || 'Vídeo de YouTube', channel: channel || 'Canal desconocido' };
  const payloadStr = JSON.stringify(payload);

  if (lastSentData !== payloadStr) {
    lastVideoId = videoId;
    lastSentData = payloadStr;
    chrome.runtime.sendMessage({
      type: 'YOUTUBE_WATCHING',
      data: payload
    }).catch(() => {
      // Ignorar errores si la extensión se recargó y el puerto se cerró
    });
  }
}

function startTracking() {
  if (checkInterval) clearInterval(checkInterval);
  
  // YouTube es SPA (Polymer), monitorizar la URL y DOM de forma periódica ligera
  checkInterval = setInterval(extractYouTubeData, 1500);
  extractYouTubeData();
}

startTracking();
