// ─────────────────────────────────────────────
// TimeTracker Pro — storage.js
// Responsabilidad: Capa de datos. Toda la lógica
// de lectura, agregación y consulta de datos de tiempo.
// ─────────────────────────────────────────────

/**
 * Devuelve la clave de un día específico o de hoy
 * @param {Date} [date]
 * @returns {string} "YYYY-MM-DD"
 */
function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Genera un array de Date para los últimos N días
 */
function getLastNDays(n) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

/**
 * Obtiene los datos de un solo día
 * @param {string} dateKey "YYYY-MM-DD"
 * @returns {Promise<Record<string, number>>} { domain: segundos }
 */
async function getDayData(dateKey) {
  return new Promise((resolve) => {
    chrome.storage.local.get([`day_${dateKey}`], (result) => {
      resolve(result[`day_${dateKey}`] || {});
    });
  });
}

/**
 * Agrega datos de múltiples días en un único objeto { domain: totalSegundos }
 * @param {Date[]} days
 */
async function aggregateDays(days) {
  const keys = days.map(d => `day_${getDateKey(d)}`);
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      const totals = {};
      for (const key of keys) {
        const dayData = result[key] || {};
        for (const [domain, seconds] of Object.entries(dayData)) {
          totals[domain] = (totals[domain] || 0) + seconds;
        }
      }
      resolve(totals);
    });
  });
}

/**
 * Datos de HOY
 */
async function getTodayData() {
  return getDayData(getDateKey());
}

/**
 * Datos de los últimos 7 días (semana actual)
 */
async function getWeekData() {
  return aggregateDays(getLastNDays(7));
}

/**
 * Datos de los últimos 30 días (mes actual)
 */
async function getMonthData() {
  return aggregateDays(getLastNDays(30));
}

/**
 * Ordena un objeto { domain: seconds } de mayor a menor
 * y devuelve un array de [{ domain, seconds, percent }]
 */
function rankDomains(data) {
  const total = Object.values(data).reduce((sum, s) => sum + s, 0);
  return Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .map(([domain, seconds]) => ({
      domain,
      seconds,
      percent: total > 0 ? Math.round((seconds / total) * 100) : 0,
    }));
}

/**
 * Convierte segundos en string legible: "2h 34m" o "45m 12s"
 */
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

/**
 * Datos día a día para el gráfico de barras (últimos N días)
 */
async function getDailyTimeline(days = 7) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayData = await getDayData(getDateKey(d));
    const total = Object.values(dayData).reduce((sum, s) => sum + s, 0);
    result.push({
      label: i === 0 ? 'Hoy' : d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
      totalSeconds: total,
    });
  }
  return result;
}

/**
 * Elimina todos los datos guardados
 */
async function clearAllData() {
  return new Promise((resolve) => {
    chrome.storage.local.clear(resolve);
  });
}

/**
 * Obtiene los datos detallados de YouTube de un solo día
 * @param {string} dateKey "YYYY-MM-DD"
 * @returns {Promise<Record<string, { title: string, channel: string, seconds: number }>>}
 */
async function getYouTubeDayData(dateKey) {
  return new Promise((resolve) => {
    chrome.storage.local.get([`yt_day_${dateKey}`], (result) => {
      resolve(result[`yt_day_${dateKey}`] || {});
    });
  });
}

/**
 * Agrega datos detallados de YouTube de múltiples días
 * @param {Date[]} days
 * @returns {Promise<Record<string, { title: string, channel: string, seconds: number }>>}
 */
async function aggregateYouTubeDays(days) {
  const keys = days.map(d => `yt_day_${getDateKey(d)}`);
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      const totals = {};
      for (const key of keys) {
        const dayData = result[key] || {};
        for (const [videoId, data] of Object.entries(dayData)) {
          if (!totals[videoId]) {
            totals[videoId] = {
              title: data.title,
              channel: data.channel,
              seconds: 0
            };
          }
          totals[videoId].seconds += data.seconds;
        }
      }
      resolve(totals);
    });
  });
}

/**
 * Ordena los vídeos de YouTube de mayor a menor tiempo
 * @param {Record<string, { title: string, channel: string, seconds: number }>} ytData
 * @returns {Array<{ videoId: string, title: string, channel: string, seconds: number, percent: number }>}
 */
function rankYouTubeVideos(ytData) {
  const total = Object.values(ytData).reduce((sum, v) => sum + v.seconds, 0);
  return Object.entries(ytData)
    .sort(([, a], [, b]) => b.seconds - a.seconds)
    .map(([videoId, data]) => ({
      videoId,
      title: data.title,
      channel: data.channel,
      seconds: data.seconds,
      percent: total > 0 ? Math.round((data.seconds / total) * 100) : 0
    }));
}

/**
 * Agrupa y ordena la actividad de YouTube por Canal
 * @param {Record<string, { title: string, channel: string, seconds: number }>} ytData
 * @returns {Array<{ channel: string, seconds: number, percent: number }>}
 */
function rankYouTubeChannels(ytData) {
  const channels = {};
  for (const video of Object.values(ytData)) {
    channels[video.channel] = (channels[video.channel] || 0) + video.seconds;
  }
  const total = Object.values(channels).reduce((sum, s) => sum + s, 0);
  return Object.entries(channels)
    .sort(([, a], [, b]) => b - a)
    .map(([channel, seconds]) => ({
      channel,
      seconds,
      percent: total > 0 ? Math.round((seconds / total) * 100) : 0
    }));
}
