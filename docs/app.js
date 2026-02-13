const MARKETPLACE_DETAIL_URL = 'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=';

const state = {
  tenders: [],
  meta: null,
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
  emptyStateTemplate: document.querySelector('#emptyState'),
};

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
  if (tender.url && tender.url.trim()) return tender.url;
  return `${MARKETPLACE_DETAIL_URL}${encodeURIComponent(tender.tender_id)}`;
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

function renderCards(tenders) {
  elements.results.innerHTML = '';
  if (!tenders.length) {
    elements.results.appendChild(elements.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  const fragment = document.createDocumentFragment();

  tenders.forEach((tender) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <h3>${tender.name}</h3>
      <div class="meta">
        <div><strong>ID:</strong> ${tender.tender_id}</div>
        <div><strong>Comprador:</strong> ${tender.buyer}</div>
        <div><strong>Región:</strong> ${tender.region || 'No informada'}</div>
        <div><strong>Publicación:</strong> ${formatDisplayDate(tender.published_at)}</div>
        <div><strong>Cierre:</strong> ${formatDisplayDate(tender.close_at)}</div>
      </div>
      <div class="badges">
        <span class="badge">${tender.status}</span>
      </div>
      <div class="actions">
        <a class="btn" href="${detailUrlFor(tender)}" target="_blank" rel="noopener noreferrer">Ver detalle</a>
      </div>
    `;
    fragment.appendChild(card);
  });

  elements.results.appendChild(fragment);
}

function updateStats(count) {
  elements.resultsCount.textContent = `${count} licitaciones encontradas`;
  const timestamp = state.meta?.timestamp;
  const display = timestamp ? formatDisplayDate(timestamp) : formatDisplayDate(new Date().toISOString());
  elements.updatedAt.textContent = `Actualizado: ${display}`;
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

async function fetchJson(url, fallback) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`No se pudo cargar ${url}:`, error);
    return fallback;
  }
}

async function init() {
  state.tenders = await fetchJson('./data/tenders.json', []);
  state.meta = await fetchJson('./data/meta.json', null);
  setupFilters();
  refreshView();
}

init();
