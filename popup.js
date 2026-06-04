// ─────────────────────────────────────────────
// TimeTracker Pro — popup.js
// Responsabilidad: Orquestar la UI, renderizar vistas, gráficos locales y calendario.
// Lógica de datos totalmente aislada (consume storage.js).
// ─────────────────────────────────────────────

// ── Referencias DOM ──
const domElements = {
  liveDomain:        document.getElementById('live-domain'),
  totalTimeValue:    document.getElementById('total-time-value'),
  domainList:        document.getElementById('domain-list'),
  btnSummary:        document.getElementById('btn-summary'),
  btnBack:           document.getElementById('btn-back'),
  btnClear:          document.getElementById('btn-clear'),
  summaryDate:       document.getElementById('summary-date'),
  summaryContent:    document.getElementById('summary-content'),
  tabBtns:           document.querySelectorAll('.tab-btn'),
  viewStats:         document.getElementById('view-stats'),
  viewChart:         document.getElementById('view-chart'),
  viewSummary:       document.getElementById('view-summary'),
  viewCalendar:      document.getElementById('view-calendar'),
  
  // Elementos del calendario
  calPrev:           document.getElementById('cal-prev'),
  calNext:           document.getElementById('cal-next'),
  calMonthYear:      document.getElementById('cal-month-year'),
  calendarGrid:      document.getElementById('calendar-grid'),
  calDetailDate:     document.getElementById('cal-detail-date'),
  calTotalValue:     document.getElementById('cal-total-value'),
  calDomainList:     document.getElementById('calendar-domain-list'),
};

// ── Estado de UI ──
let currentPeriod = 'day';
let liveTickInterval = null;
let originalDataForPeriod = null;

// Estado del gráfico para ticks en vivo
let originalTodayDataForChart = null;
let originalTimelineDataForChart = null;

// Estado del calendario
let currentCalMonth = new Date().getMonth();
let currentCalYear = new Date().getFullYear();
let selectedCalDateKey = getDateKey(); // por defecto hoy
// Globo SVG de diseño premium como icono fallback
const DEFAULT_ICON = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%238b92b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;

// Palette de colores para el gráfico de tarta
const CHART_COLORS = [
  '#6c63ff', '#3ecf8e', '#f59e0b', '#ef4444',
  '#06b6d4', '#a855f7', '#ec4899', '#84cc16',
];

// Helper para obtener el valor del almacenamiento local
function getStorageValue(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key]);
    });
  });
}

// ─────────────────────────────
// RENDERIZADO: Badge total
// ─────────────────────────────
function renderTotalBadge(rankedDomains) {
  const totalSeconds = rankedDomains.reduce((sum, d) => sum + d.seconds, 0);
  domElements.totalTimeValue.textContent = totalSeconds > 0
    ? formatDuration(totalSeconds)
    : '0s';
}

// ─────────────────────────────
// RENDERIZADO: Lista de dominios (Con favicons y acordeón de YouTube)
// ─────────────────────────────
async function renderDomainList(rankedDomains, period, selectedDateKey = null) {
  const container = domElements.domainList;

  if (rankedDomains.length === 0) {
    container.innerHTML = `<div class="empty-state">
      📭 Sin datos todavía.<br>
      <small>Navega un poco y vuelve.</small>
    </div>`;
    return;
  }

  // Cargar detalles de YouTube si existe youtube.com en la lista
  let ytDetailsHtml = '';
  const hasYouTube = rankedDomains.some(d => d.domain === 'youtube.com');
  if (hasYouTube) {
    let ytData = {};
    if (selectedDateKey) {
      ytData = await getYouTubeDayData(selectedDateKey);
    } else if (period === 'day') {
      ytData = await getYouTubeDayData(getDateKey());
    } else if (period === 'week') {
      ytData = await aggregateYouTubeDays(getLastNDays(7));
    } else if (period === 'month') {
      ytData = await aggregateYouTubeDays(getLastNDays(30));
    }

    const topVideos = rankYouTubeVideos(ytData).slice(0, 5);
    const topChannels = rankYouTubeChannels(ytData).slice(0, 3);

    if (topVideos.length > 0) {
      ytDetailsHtml = `
        <div class="youtube-details">
          <div>
            <div class="yt-section-title">Canales de YouTube</div>
            <div class="yt-sub-list">
              ${topChannels.map(c => `
                <div class="yt-sub-item" style="border-left-color: #ff0000">
                  <div class="yt-video-info">
                    <span class="yt-video-title">${c.channel}</span>
                  </div>
                  <span class="yt-sub-time">${formatDuration(c.seconds)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div>
            <div class="yt-section-title">Vídeos de YouTube</div>
            <div class="yt-sub-list">
              ${topVideos.map(v => `
                <div class="yt-sub-item">
                  <div class="yt-video-info">
                    <span class="yt-video-title" title="${v.title}">${v.title}</span>
                    <span class="yt-video-channel">${v.channel}</span>
                  </div>
                  <span class="yt-sub-time">${formatDuration(v.seconds)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      ytDetailsHtml = `
        <div class="youtube-details">
          <div class="empty-state" style="padding: 10px;">Sin vídeos registrados en este período</div>
        </div>
      `;
    }
  }

  container.innerHTML = '';

  rankedDomains
    .slice(0, 15)
    .forEach(({ domain, seconds, percent }) => {
      const isYt = domain === 'youtube.com';
      const item = document.createElement('div');
      item.className = 'domain-item';
      if (isYt) item.classList.add('has-accordion');

      // Favicon nativo local de Chrome (robusto, offline y seguro)
      const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent('https://' + domain)}&size=32`;

      item.innerHTML = `
        <img class="domain-icon" src="${faviconUrl}" alt="" />
        <span class="domain-name" title="${domain}">${domain}</span>
        <span class="domain-time">${formatDuration(seconds)}</span>
        <div class="domain-bar-wrap">
          <div class="domain-bar" style="width:${percent}%"></div>
        </div>
        ${isYt ? ytDetailsHtml : ''}
      `;

      // Registrar programáticamente el fallback para evitar violaciones de CSP
      const img = item.querySelector('.domain-icon');
      if (img) {
        img.addEventListener('error', () => {
          img.src = DEFAULT_ICON;
        });
      }

      if (isYt) {
        item.addEventListener('click', (e) => {
          if (!e.target.closest('.youtube-details')) {
            item.classList.toggle('expanded');
          }
        });
      }

      container.appendChild(item);
    });
}

// ─────────────────────────────
// GRÁFICOS: Dibujo nativo (CSP-Compliant, sin dependencias)
// ─────────────────────────────

// 1. Gráfico de barras local (Timeline)
function drawBarChart(containerId, timelineData, skipAnimation = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  const maxSeconds = Math.max(...timelineData.map(d => d.totalSeconds), 1);

  timelineData.forEach(d => {
    const heightPercent = Math.round((d.totalSeconds / maxSeconds) * 100);
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `
      <div class="bar-tooltip">${formatDuration(d.totalSeconds)}</div>
      <div class="bar-fill-wrap">
        <div class="bar-fill" style="height: ${skipAnimation ? heightPercent : 0}%"></div>
      </div>
      <div class="bar-label">${d.label}</div>
    `;
    container.appendChild(col);

    if (!skipAnimation) {
      setTimeout(() => {
        const fill = col.querySelector('.bar-fill');
        if (fill) fill.style.height = `${heightPercent}%`;
      }, 50);
    }
  });
}

// 2. Gráfico de tarta local (Doughnut Canvas)
function drawDoughnutChart(canvasId, legendId, data) {
  const canvas = document.getElementById(canvasId);
  const legend = document.getElementById(legendId);
  if (!canvas || !legend) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  legend.innerHTML = '';

  const ranked = rankDomains(data);
  const topSites = ranked.slice(0, 4);
  const othersSeconds = ranked.slice(4).reduce((sum, d) => sum + d.seconds, 0);

  const chartData = [...topSites];
  if (othersSeconds > 0) {
    chartData.push({ domain: 'Otros', seconds: othersSeconds });
  }

  const total = chartData.reduce((sum, d) => sum + d.seconds, 0);
  if (total === 0) {
    ctx.fillStyle = '#8b92b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Sin actividad hoy', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Dimensiones del gráfico de tarta descentrado a la izquierda
  const centerX = 65;
  const centerY = canvas.height / 2;
  const outerRadius = 52;
  const innerRadius = 36;

  let startAngle = -Math.PI / 2;

  chartData.forEach((d, idx) => {
    const sliceAngle = (d.seconds / total) * 2 * Math.PI;
    const color = CHART_COLORS[idx % CHART_COLORS.length];

    // Pintar trozo de rosca
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle += sliceAngle;

    // Crear ítem de leyenda en HTML
    const percent = Math.round((d.seconds / total) * 100);
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `
      <span class="legend-dot" style="background: ${color}"></span>
      <span class="legend-name" title="${d.domain}">${d.domain}</span>
      <span class="legend-time">${formatDuration(d.seconds)} (${percent}%)</span>
    `;
    legend.appendChild(legendItem);
  });

  // Limpiar el fondo del círculo central para simular el doughnut
  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius - 0.5, 0, 2 * Math.PI);
  ctx.fillStyle = '#1e2238'; // Coincide con --color-bg-elevated
  ctx.fill();
}

async function renderChartsView() {
  // Gráfico 1: Timeline de 7 días
  const timelineData = await getDailyTimeline(7);
  originalTimelineDataForChart = JSON.parse(JSON.stringify(timelineData)); // Copia profunda
  drawBarChart('bar-chart-container', timelineData);

  // Gráfico 2: Tarta de hoy
  const todayData = await getTodayData();
  originalTodayDataForChart = { ...todayData };
  drawDoughnutChart('pie-chart', 'pie-chart-legend', todayData);

  // Iniciar live ticking para el gráfico si hay sesión activa
  const session = await getStorageValue('activeSession');
  if (session) {
    startLiveTicking(session, 'chart');
  }
}

// ─────────────────────────────
// CALENDARIO: Vista interactiva mensual
// ─────────────────────────────
async function renderCalendar() {
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  domElements.calMonthYear.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;

  const grid = domElements.calendarGrid;
  grid.innerHTML = '';

  // Offset del día de la semana (0 = Lunes, 6 = Domingo)
  const firstDay = new Date(currentCalYear, currentCalMonth, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  // Cantidad de días
  const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();

  // Celdas vacías
  for (let i = 0; i < startOffset; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day empty';
    grid.appendChild(emptyCell);
  }

  // Celdas activas
  const todayKey = getDateKey();
  const cellPromises = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${currentCalYear}-${String(currentCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cellPromises.push(
      getDayData(dateKey).then(dayData => {
        const totalSecs = Object.values(dayData).reduce((sum, s) => sum + s, 0);
        return { day, dateKey, totalSecs };
      })
    );
  }

  const cells = await Promise.all(cellPromises);

  cells.forEach(({ day, dateKey, totalSecs }) => {
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = day;

    // Determinar clase del mapa de calor
    let level = 'level-0';
    if (totalSecs > 0) {
      if (totalSecs < 1800) level = 'level-1';       // < 30m
      else if (totalSecs < 7200) level = 'level-2';  // 30m - 2h
      else if (totalSecs < 18000) level = 'level-3'; // 2h - 5h
      else level = 'level-4';                        // > 5h
    }
    cell.classList.add(level);

    if (dateKey === todayKey) cell.classList.add('today');
    if (dateKey === selectedCalDateKey) cell.classList.add('selected');

    cell.addEventListener('click', () => {
      document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      selectedCalDateKey = dateKey;
      renderCalendarDayDetails(dateKey);
    });

    grid.appendChild(cell);
  });
}

async function renderCalendarDayDetails(dateKey) {
  const parts = dateKey.split('-');
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  domElements.calDetailDate.textContent = dateObj.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const dayData = await getDayData(dateKey);
  originalDataForPeriod = { ...dayData };

  // Activar ticking a tiempo real si seleccionamos el día de hoy
  const isToday = dateKey === getDateKey();
  if (isToday) {
    const session = await getStorageValue('activeSession');
    if (session) {
      startLiveTicking(session, 'calendar', dateKey);
    }
  } else {
    if (liveTickInterval) clearInterval(liveTickInterval);
  }

  const ranked = rankDomains(dayData);
  await renderCalendarDayDetailsList(ranked, dateKey);
}

async function renderCalendarDayDetailsList(rankedDomains, dateKey) {
  const totalValueEl = domElements.calTotalValue;
  const listContainer = domElements.calDomainList;

  const totalSecs = rankedDomains.reduce((sum, d) => sum + d.seconds, 0);
  totalValueEl.textContent = totalSecs > 0 ? formatDuration(totalSecs) : '0s';

  if (rankedDomains.length === 0) {
    listContainer.innerHTML = `<div class="empty-state">Sin actividad registrada este día.</div>`;
    return;
  }

  // Cargar detalles de YouTube en paralelo para el calendario
  let ytDetailsHtml = '';
  const hasYouTube = rankedDomains.some(d => d.domain === 'youtube.com');
  if (hasYouTube) {
    const ytData = await getYouTubeDayData(dateKey);
    const topVideos = rankYouTubeVideos(ytData).slice(0, 5);
    const topChannels = rankYouTubeChannels(ytData).slice(0, 3);

    if (topVideos.length > 0) {
      ytDetailsHtml = `
        <div class="youtube-details">
          <div>
            <div class="yt-section-title">Canales de YouTube</div>
            <div class="yt-sub-list">
              ${topChannels.map(c => `
                <div class="yt-sub-item" style="border-left-color: #ff0000">
                  <div class="yt-video-info">
                    <span class="yt-video-title">${c.channel}</span>
                  </div>
                  <span class="yt-sub-time">${formatDuration(c.seconds)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div>
            <div class="yt-section-title">Vídeos de YouTube</div>
            <div class="yt-sub-list">
              ${topVideos.map(v => `
                <div class="yt-sub-item">
                  <div class="yt-video-info">
                    <span class="yt-video-title" title="${v.title}">${v.title}</span>
                    <span class="yt-video-channel">${v.channel}</span>
                  </div>
                  <span class="yt-sub-time">${formatDuration(v.seconds)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
  }

  listContainer.innerHTML = '';

  rankedDomains.forEach(({ domain, seconds, percent }) => {
    const isYt = domain === 'youtube.com';
    const item = document.createElement('div');
    item.className = 'domain-item';
    if (isYt) item.classList.add('has-accordion');

    const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent('https://' + domain)}&size=32`;

    item.innerHTML = `
      <img class="domain-icon" src="${faviconUrl}" alt="" />
      <span class="domain-name" title="${domain}">${domain}</span>
      <span class="domain-time">${formatDuration(seconds)}</span>
      <div class="domain-bar-wrap">
        <div class="domain-bar" style="width:${percent}%"></div>
      </div>
      ${isYt ? ytDetailsHtml : ''}
    `;

    // Registrar programáticamente el fallback para evitar violaciones de CSP
    const img = item.querySelector('.domain-icon');
    if (img) {
      img.addEventListener('error', () => {
        img.src = DEFAULT_ICON;
      });
    }

    if (isYt) {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.youtube-details')) {
          item.classList.toggle('expanded');
        }
      });
    }

    listContainer.appendChild(item);
  });
}

// ─────────────────────────────
// RENDERIZADO: Vista de resumen
// ─────────────────────────────
async function renderSummaryView() {
  const today = new Date();
  const dateKey = getDateKey(today);
  const dayData = await getDayData(dateKey);
  const ranked = rankDomains(dayData);
  const totalSecs = ranked.reduce((s, d) => s + d.seconds, 0);

  domElements.summaryDate.textContent = today.toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  if (ranked.length === 0) {
    domElements.summaryContent.innerHTML = `<div class="empty-state">Sin actividad registrada hoy.</div>`;
    return;
  }

  const rows = ranked.map(({ domain, seconds }) => `
    <div class="summary-row">
      <span class="summary-domain">${domain}</span>
      <span class="summary-seconds">${formatDuration(seconds)}</span>
    </div>
  `).join('');

  const totalRow = `
    <div class="summary-total-row">
      <span class="summary-total-label">Total del día</span>
      <span class="summary-total-value">${formatDuration(totalSecs)}</span>
    </div>
  `;

  domElements.summaryContent.innerHTML = rows + totalRow;
}

// ─────────────────────────────
// CARGA PRINCIPAL POR PERÍODO (Hoy, Semana, Mes)
// ─────────────────────────────
async function loadPeriodData(period) {
  let rawData;

  if (period === 'day') {
    rawData = await getTodayData();
    domElements.btnSummary.classList.remove('hidden');
  } else {
    domElements.btnSummary.classList.add('hidden');
    if (period === 'week') rawData = await getWeekData();
    else if (period === 'month') rawData = await getMonthData();
    else return;
  }

  // Guardamos la copia de históricos para sumar el real-time ticking
  originalDataForPeriod = { ...rawData };

  const ranked = rankDomains(rawData);
  renderTotalBadge(ranked);
  await renderDomainList(ranked, period);

  // Iniciar live ticking para la vista si hay sesión activa
  const session = await getStorageValue('activeSession');
  if (session) {
    startLiveTicking(session, period);
  }
}

// ─────────────────────────────
// CONTADOR EN TIEMPO REAL (Live Ticking)
// ─────────────────────────────
function startLiveTicking(activeSession, period, selectedDateKey = null) {
  if (liveTickInterval) clearInterval(liveTickInterval);

  const isTodaySelected = !selectedDateKey || selectedDateKey === getDateKey();
  const shouldTick = activeSession && (
    (period === 'day' && isTodaySelected) ||
    (period === 'week' && isTodaySelected) ||
    (period === 'month' && isTodaySelected) ||
    (period === 'chart') ||
    (period === 'calendar' && isTodaySelected)
  );

  if (!shouldTick) return;

  liveTickInterval = setInterval(async () => {
    const elapsedSeconds = Math.round((Date.now() - activeSession.startTime) / 1000);
    if (elapsedSeconds <= 0) return;

    const domain = activeSession.domain;

    if (period === 'chart') {
      // 1. Live tick para la vista de Gráficos
      if (originalTodayDataForChart && originalTimelineDataForChart) {
        const updatedToday = { ...originalTodayDataForChart };
        updatedToday[domain] = (updatedToday[domain] || 0) + elapsedSeconds;
        drawDoughnutChart('pie-chart', 'pie-chart-legend', updatedToday);

        const updatedTimeline = originalTimelineDataForChart.map((d, idx) => {
          if (idx === originalTimelineDataForChart.length - 1) {
            return { ...d, totalSeconds: d.totalSeconds + elapsedSeconds };
          }
          return d;
        });
        drawBarChart('bar-chart-container', updatedTimeline, true); // true = saltar animación de entrada
      }
    } else if (period === 'calendar' && selectedDateKey) {
      // 2. Live tick para la vista de Calendario (detalle diario)
      const updatedData = { ...originalDataForPeriod };
      updatedData[domain] = (updatedData[domain] || 0) + elapsedSeconds;

      const ranked = rankDomains(updatedData);
      
      // Actualizar total y lista de detalle
      const totalSecs = ranked.reduce((sum, d) => sum + d.seconds, 0);
      domElements.calTotalValue.textContent = totalSecs > 0 ? formatDuration(totalSecs) : '0s';
      await renderCalendarDayDetailsList(ranked, selectedDateKey);
    } else {
      // 3. Live tick para las pestañas generales (Hoy, Semana, Mes)
      const updatedData = { ...originalDataForPeriod };
      updatedData[domain] = (updatedData[domain] || 0) + elapsedSeconds;

      const ranked = rankDomains(updatedData);
      renderTotalBadge(ranked);
      await renderDomainList(ranked, period);
    }
  }, 1000);
}

// ─────────────────────────────
// INDICADOR EN VIVO (Cabecera)
// ─────────────────────────────
async function updateLiveIndicator() {
  const session = await getStorageValue('activeSession');
  if (session && session.domain) {
    domElements.liveDomain.textContent = session.domain;
    document.querySelector('.live-dot').style.background = 'var(--color-success)';
  } else {
    domElements.liveDomain.textContent = 'pausado';
    document.querySelector('.live-dot').style.background = 'var(--color-text-muted)';
  }
}

// ─────────────────────────────
// NAVEGACIÓN ENTRE TABS
// ─────────────────────────────
function switchToView(period) {
  currentPeriod = period;

  // Parar ticking anterior antes de cambiar de pestaña
  if (liveTickInterval) clearInterval(liveTickInterval);

  // Actualizar botones activos
  domElements.tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });

  // Ocultar todas las secciones
  domElements.viewStats.classList.remove('active');
  domElements.viewChart.classList.remove('active');
  domElements.viewCalendar.classList.remove('active');
  domElements.viewSummary.classList.remove('active');

  if (period === 'chart') {
    domElements.viewChart.classList.add('active');
    renderChartsView();
  } else if (period === 'calendar') {
    domElements.viewCalendar.classList.add('active');
    renderCalendar();
    renderCalendarDayDetails(selectedCalDateKey);
  } else {
    domElements.viewStats.classList.add('active');
    loadPeriodData(period);
  }
}

// ─────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────
domElements.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchToView(btn.dataset.period));
});

domElements.btnSummary.addEventListener('click', () => {
  domElements.viewStats.classList.remove('active');
  domElements.viewSummary.classList.add('active');
  renderSummaryView();
});

domElements.btnBack.addEventListener('click', () => {
  domElements.viewSummary.classList.remove('active');
  domElements.viewStats.classList.add('active');
});

// Navegación del Calendario
domElements.calPrev.addEventListener('click', () => {
  currentCalMonth--;
  if (currentCalMonth < 0) {
    currentCalMonth = 11;
    currentCalYear--;
  }
  renderCalendar();
});

domElements.calNext.addEventListener('click', () => {
  currentCalMonth++;
  if (currentCalMonth > 11) {
    currentCalMonth = 0;
    currentCalYear++;
  }
  renderCalendar();
});

domElements.btnClear.addEventListener('click', async () => {
  const confirmed = confirm('¿Seguro que quieres borrar todos los datos de tiempo guardados?');
  if (!confirmed) return;
  await clearAllData();
  switchToView(currentPeriod);
});

// Escuchar actualizaciones de estado desde background
chrome.storage.onChanged.addListener((changes) => {
  if (changes.activeSession) {
    updateLiveIndicator();
    const newSession = changes.activeSession.newValue;
    if (newSession) {
      startLiveTicking(newSession, currentPeriod, currentPeriod === 'calendar' ? selectedCalDateKey : null);
    } else {
      if (liveTickInterval) clearInterval(liveTickInterval);
    }
  }
});

// ─────────────────────────────
// INIT
// ─────────────────────────────
(async function init() {
  await updateLiveIndicator();
  switchToView('day');
})();
