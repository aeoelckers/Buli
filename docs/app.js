const MARKETPLACE_DETAIL_URL = 'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=';
const AUTO_REFRESH_MS = 5 * 60 * 1000;

const state = {
  tenders: [],
  meta: null,
  activeTender: null,
  lastTriggerButton: null,
  isSyncing: false,
  syncTimerId: null,
};

const elements = {
  statusFilter: document.querySelector('#statusFilter'),
  regionFilter: document.querySelector('#regionFilter'),
  buyerFilter: document.querySelector('#buyerFilter'),
  fromDate: document.querySelector('#fromDate'),
  toDate: document.querySelector('#toDate'),
  searchInput: document.querySelector('#searchInput'),
  results: document.querySelector('#results'),
  resultsCount: document.querySelector('#resultsCount'),
  updatedAt: document.querySelector('#updatedAt'),
  syncStatus: document.querySelector('#syncStatus'),
  syncNowButton: document.querySelector('#syncNowButton'),
  emptyStateTemplate: document.querySelector('#emptyState'),
  modalBackdrop: document.querySelector('#tenderModalBackdrop'),
  modalTitle: document.querySelector('#tenderModalTitle'),
  modalContent: document.querySelector('#tenderModalContent'),
  modalExternalLink: document.querySelector('#modalExternalLink'),
  modalCloseButton: document.querySelector('#modalCloseButton'),
};

const BASE_FIELDS = [
  ['tender_id', 'ID'],
  ['name', 'Nombre'],
  ['buyer', 'Comprador'],
  ['region', 'Región'],
  ['status', 'Estado'],
  ['published_at', 'Publicación'],
  ['close_at', 'Cierre'],
];

const OPTIONAL_FIELDS = [
  ['budget_amount', 'Presupuesto'],
  ['currency', 'Moneda'],
  ['description', 'Descripción'],
  ['procurement_type', 'Tipo de compra'],
];

function formatDisplayDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function detailUrlFor(tender) {
  if (tender.url && String(tender.url).trim()) return String(tender.url).trim();
  if (tender.tender_id && String(tender.tender_id).trim()) {
    return `${MARKETPLACE_DETAIL_URL}${encodeURIComponent(String(tender.tender_id).trim())}`;
  }
  return null;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

function populateSelect(selectEl, options, emptyText) {
  const current = selectEl.value;
  selectEl.innerHTML = `<option value="">${emptyText}</option>`;
  options.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });
  selectEl.value = options.includes(current) ? current : '';
}

function normalizedSearchText(tender) {
  return [
    tender.tender_id,
    tender.name,
    tender.buyer,
    tender.status,
    tender.region || '',
  ]
    .join(' ')
    .toLowerCase();
}

function readFilters() {
  return {
    status: elements.statusFilter.value,
    region: elements.regionFilter.value,
    buyer: elements.buyerFilter.value,
    fromDate: elements.fromDate.value,
    toDate: elements.toDate.value,
    search: elements.searchInput.value.trim().toLowerCase(),
  };
}

function applyFilters(tenders, filters) {
  const fromDate = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`) : null;
  const toDate = filters.toDate ? new Date(`${filters.toDate}T23:59:59`) : null;

  return tenders.filter((tender) => {
    if (filters.status && tender.status !== filters.status) return false;
    if (filters.region && tender.region !== filters.region) return false;
    if (filters.buyer && tender.buyer !== filters.buyer) return false;

    const closeAt = tender.close_at ? new Date(tender.close_at) : null;
    if (fromDate && closeAt && closeAt < fromDate) return false;
    if (toDate && closeAt && closeAt > toDate) return false;

    if (filters.search && !normalizedSearchText(tender).includes(filters.search)) return false;
    return true;
  });
}

function createInfoRow(label, value) {
  const row = document.createElement('div');
  row.className = 'modal-row';

  const key = document.createElement('span');
  key.className = 'modal-row-key';
  key.textContent = label;

  const val = document.createElement('span');
  val.className = 'modal-row-value';
  val.textContent = value ?? '—';

  row.append(key, val);
  return row;
}

function getModalRows(tender) {
  const rows = [];
  BASE_FIELDS.forEach(([field, label]) => {
    let value = tender[field];
    if (field === 'published_at' || field === 'close_at') {
      value = formatDisplayDate(value);
    }
    if (field === 'region') {
      value = value || 'No informada';
    }
    rows.push([label, value || '—']);
  });

  OPTIONAL_FIELDS.forEach(([field, label]) => {
    const value = tender[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      rows.push([label, String(value)]);
    }
  });

  const knownFields = new Set([...BASE_FIELDS, ...OPTIONAL_FIELDS, ['url']].map(([f]) => f));
  Object.entries(tender).forEach(([key, value]) => {
    if (knownFields.has(key)) return;
    if (value === undefined || value === null || String(value).trim() === '') return;
    rows.push([key.replaceAll('_', ' '), String(value)]);
  });

  return rows;
}

function openTenderModal(tender, triggerButton) {
  state.activeTender = tender;
  state.lastTriggerButton = triggerButton || null;

  elements.modalTitle.textContent = tender.name || 'Detalle de licitación';
  elements.modalContent.replaceChildren();

  const rows = getModalRows(tender);
  rows.forEach(([label, value]) => {
    elements.modalContent.appendChild(createInfoRow(label, value));
  });

  const externalUrl = detailUrlFor(tender);
  if (externalUrl) {
    elements.modalExternalLink.href = externalUrl;
    elements.modalExternalLink.hidden = false;
  } else {
    elements.modalExternalLink.hidden = true;
    elements.modalExternalLink.removeAttribute('href');
  }

  document.body.classList.add('modal-open');
  elements.modalBackdrop.hidden = false;
  elements.modalCloseButton.focus();
}

function closeTenderModal() {
  if (elements.modalBackdrop.hidden) return;

  elements.modalBackdrop.hidden = true;
  document.body.classList.remove('modal-open');
  state.activeTender = null;

  if (state.lastTriggerButton) {
    state.lastTriggerButton.focus();
  }
  state.lastTriggerButton = null;
}

function renderCard(tender) {
  const card = document.createElement('article');
  card.className = 'card';

  const title = document.createElement('h3');
  title.textContent = tender.name;

  const meta = document.createElement('div');
  meta.className = 'meta';

  const fields = [
    ['ID', tender.tender_id],
    ['Comprador', tender.buyer],
    ['Región', tender.region || 'No informada'],
    ['Publicación', formatDisplayDate(tender.published_at)],
    ['Cierre', formatDisplayDate(tender.close_at)],
  ];

  fields.forEach(([label, value]) => {
    const line = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    line.appendChild(strong);
    line.append(String(value || '—'));
    meta.appendChild(line);
  });

  const badges = document.createElement('div');
  badges.className = 'badges';
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = tender.status;
  badges.appendChild(badge);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const detailButton = document.createElement('button');
  detailButton.className = 'btn';
  detailButton.type = 'button';
  detailButton.textContent = 'Ver detalle';
  detailButton.addEventListener('click', () => openTenderModal(tender, detailButton));
  actions.appendChild(detailButton);

  card.append(title, meta, badges, actions);
  return card;
}

function renderCards(tenders) {
  elements.results.innerHTML = '';
  if (!tenders.length) {
    elements.results.appendChild(elements.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  const fragment = document.createDocumentFragment();
  tenders.forEach((tender) => {
    fragment.appendChild(renderCard(tender));
  });
  elements.results.appendChild(fragment);
}

function updateStats(count) {
  elements.resultsCount.textContent = `${count} licitaciones encontradas`;
  const timestamp = state.meta?.timestamp;
  const display = timestamp ? formatDisplayDate(timestamp) : formatDisplayDate(new Date().toISOString());
  elements.updatedAt.textContent = `Actualizado: ${display}`;
}

function setSyncStatus(message) {
  elements.syncStatus.textContent = message;
}


function getSyncStatusMessage(meta) {
  if (!meta) return 'Sin metadatos de sincronización disponibles.';

  if (meta.source && meta.source !== 'mercadopublico_api') {
    return 'Mostrando datos de ejemplo. Configura CHILECOMPRA_TICKET y ejecuta el workflow para conectar con Mercado Público.';
  }

  const timestamp = meta.timestamp;
  if (!timestamp) return 'Sin timestamp de sincronización.';

  const syncedAt = new Date(timestamp);
  if (Number.isNaN(syncedAt.getTime())) return 'Timestamp de sincronización inválido.';

  const ageMs = Date.now() - syncedAt.getTime();
  if (ageMs > 6 * 60 * 60 * 1000) {
    return `Datos potencialmente desactualizados (última sincronización: ${formatDisplayDate(timestamp)}).`;
  }

  return `Última sincronización: ${formatDisplayDate(timestamp)}`;
}

function setSyncInProgress(isSyncing) {
  state.isSyncing = isSyncing;
  elements.syncNowButton.disabled = isSyncing;
  elements.syncNowButton.textContent = isSyncing ? 'Actualizando…' : 'Actualizar datos ahora';
}

function refreshView() {
  const filtered = applyFilters(state.tenders, readFilters());
  renderCards(filtered);
  updateStats(filtered.length);
}

function setupFilters() {
  populateSelect(elements.statusFilter, uniqueSorted(state.tenders.map((t) => t.status)), 'Todos');
  populateSelect(elements.regionFilter, uniqueSorted(state.tenders.map((t) => t.region)), 'Todas');
  populateSelect(elements.buyerFilter, uniqueSorted(state.tenders.map((t) => t.buyer)), 'Todos');

  [
    elements.statusFilter,
    elements.regionFilter,
    elements.buyerFilter,
    elements.fromDate,
    elements.toDate,
    elements.searchInput,
  ].forEach((control) => control.addEventListener('input', refreshView));
}

function setupModal() {
  elements.modalCloseButton.addEventListener('click', closeTenderModal);
  elements.modalBackdrop.addEventListener('click', (event) => {
    if (event.target === elements.modalBackdrop) {
      closeTenderModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.modalBackdrop.hidden) {
      closeTenderModal();
    }
  });
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

async function syncData(trigger = 'manual') {
  if (state.isSyncing) return;

  const labels = {
    initial: 'Carga inicial',
    auto: 'Actualización automática',
    manual: 'Actualización manual',
  };

  setSyncInProgress(true);
  setSyncStatus(`${labels[trigger] || 'Sincronización'} en progreso…`);

  try {
    const [tenders, meta] = await Promise.all([
      fetchJson('./data/tenders.json'),
      fetchJson('./data/meta.json'),
    ]);

    state.tenders = Array.isArray(tenders) ? tenders : [];
    state.meta = meta;

    if (trigger === 'initial') {
      setupFilters();
      setupModal();
    }

    refreshView();
    setSyncStatus(getSyncStatusMessage(state.meta));
  } catch (error) {
    console.warn('No se pudieron sincronizar los datos:', error);
    setSyncStatus('No se pudo sincronizar. Reintenta en unos minutos.');
  } finally {
    setSyncInProgress(false);
  }
}

function setupSyncControls() {
  elements.syncNowButton.addEventListener('click', () => {
    syncData('manual');
  });
}

function startAutoRefresh() {
  if (state.syncTimerId) {
    clearInterval(state.syncTimerId);
  }

  state.syncTimerId = window.setInterval(() => {
    syncData('auto');
  }, AUTO_REFRESH_MS);
}

async function init() {
  setupSyncControls();
  await syncData('initial');
  startAutoRefresh();
}

init();
