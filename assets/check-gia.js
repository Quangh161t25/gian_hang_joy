const CHECK_GIA_HEADERS = [
  'id',
  'ten_sp',
  'gia_goc',
  'lai_mong_muon',
  'gia_ban',
  'loi_nhuan%',
  'phi_ads_%',
  'phi_aff_%',
  'phi_co_dinh',
  'phi_xu_ly_giao_dich_6%',
  'voucher_xtra_5.5%489_₫',
  'thue_hkd_tam_tinh_1.5%133_₫',
  'phi_quang_cao_co_dinh_1%89_₫',
  'phi_ha_tang3.000_₫',
  'phi_piship',
];

const CHECK_GIA_TABS = {
  SP_PM: {
    title: 'SP_PM',
    subtitle: 'Dữ liệu sản phẩm từ sheet SP_PM',
    range: CONFIG.tabs.SP_PM.range,
    headers: CONFIG.tabs.SP_PM.headers,
    priceCols: CONFIG.tabs.SP_PM.priceCols || [],
    percentCols: [],
    imgCol: CONFIG.tabs.SP_PM.imgCol,
  },
  CHECK_GIA: {
    title: 'CHECK GIÁ',
    subtitle: 'Dữ liệu tính giá từ sheet TINH_GIA',
    range: 'TINH_GIA!A2:O',
    headers: CHECK_GIA_HEADERS,
    priceCols: [2, 3, 4, 8, 9, 10, 11, 12, 13, 14],
    percentCols: [5, 6, 7],
    imgCol: -1,
  },
};

let currentModule = 'SP_PM';
let accessToken = null;
let tokenExpiry = 0;
let allRows = [];
let filteredRows = [];
let currentRenderRow = null;
let currentPage = 1;
let selectedIdPrefixOne = '';
let selectedIdPrefixTwo = '';
const ROWS_PER_PAGE = 100;

const SP_PM_COLS = {
  tenSp: 1,
  sku3: 35,
  giaBan: 39,
};

const TINH_GIA_COLS = {
  id: 0,
  tenSp: 1,
  giaGoc: 2,
  laiMongMuon: 3,
  giaBan: 4,
  loiNhuanPercent: 5,
  phiAdsPercent: 6,
  phiAffPercent: 7,
  phiCoDinh: 8,
  phiXuLyGiaoDich: 9,
  voucherXtra: 10,
  thueHkd: 11,
  phiQuangCaoCoDinh: 12,
  phiHaTang: 13,
  phiPiship: 14,
};

const CHECK_GIA_EDITABLE_COLS = new Set([
  TINH_GIA_COLS.giaGoc,
  TINH_GIA_COLS.laiMongMuon,
  TINH_GIA_COLS.giaBan,
  TINH_GIA_COLS.phiAdsPercent,
  TINH_GIA_COLS.phiAffPercent,
]);

function showLoading(show) {
  document.getElementById('loadingMask')?.classList.toggle('show', show);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return value;
  const cleaned = String(value)
    .replace(/\s/g, '')
    .replace(/[₫đ%]/gi, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function formatNumber(value) {
  const num = parseNumber(value);
  if (!Number.isFinite(num)) return escapeHtml(value);
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(num);
}

function toSheetNumber(value) {
  const num = parseNumber(value);
  if (!Number.isFinite(num)) return '';
  return Math.round(num * 100) / 100;
}

function parseRate(value) {
  const num = parseNumber(value);
  if (!Number.isFinite(num)) return 0;
  return Math.abs(num) > 1 ? num / 100 : num;
}

function formatInputValue(value, index) {
  const num = parseNumber(value);
  if (!Number.isFinite(num)) return escapeHtml(value);
  if (index === TINH_GIA_COLS.phiAdsPercent || index === TINH_GIA_COLS.phiAffPercent) {
    return String(Math.round(num * 10000) / 10000);
  }
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(num);
}

function isUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function getActiveConfig() {
  return CHECK_GIA_TABS[currentModule];
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (accessToken && now < tokenExpiry - 60) return accessToken;

  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: CONFIG.serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: CONFIG.tokenUrl,
    exp: now + 3600,
    iat: now,
  };

  const jwt = KJUR.jws.JWS.sign(
    'RS256',
    JSON.stringify(header),
    JSON.stringify(claimSet),
    CONFIG.privateKey
  );

  const response = await fetch(CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Không lấy được token Google Sheets: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = now + Number(data.expires_in || 3600);
  return accessToken;
}

async function fetchSheetRows(range) {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Không đọc được sheet ${range}: ${response.status}`);
  }

  const data = await response.json();
  return data.values || [];
}

async function appendSheetRows(range, rows) {
  if (!rows.length) return;
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: rows }),
  });

  if (!response.ok) {
    throw new Error(`Không thêm được dữ liệu vào ${range}: ${response.status}`);
  }
}

async function updateSheetRow(range, row) {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [row] }),
  });

  if (!response.ok) {
    throw new Error(`Không cập nhật được ${range}: ${response.status}`);
  }
}

function normalizeRows(rows, columnCount) {
  return rows.map((row, index) => {
    const normalized = Array.from({ length: columnCount }, (_, index) => row[index] ?? '');
    normalized.sheetRow = index + 2;
    return normalized;
  });
}

function getIdPrefix(row, length) {
  return String(row?.[TINH_GIA_COLS.id] ?? '').trim().slice(0, length).toUpperCase();
}

function compareIdDesc(a, b) {
  const idA = String(a?.[TINH_GIA_COLS.id] ?? '').trim();
  const idB = String(b?.[TINH_GIA_COLS.id] ?? '').trim();
  if (!idA && !idB) return 0;
  if (!idA) return 1;
  if (!idB) return -1;
  return idB.localeCompare(idA, 'vi', { numeric: true, sensitivity: 'base' });
}

function sortCheckGiaRows(rows) {
  return currentModule === 'CHECK_GIA' ? [...rows].sort(compareIdDesc) : rows;
}

function renderHeaders() {
  const config = getActiveConfig();
  const tableHead = document.getElementById('tableHead');
  tableHead.innerHTML = `
    <tr>
      ${config.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}
    </tr>
  `;
}

function renderTable() {
  const config = getActiveConfig();
  const tableBody = document.getElementById('tableBody');
  const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  if (!filteredRows.length) {
    tableBody.innerHTML = `
      <tr>
        <td class="empty-cell" colspan="${config.headers.length}">Không có dữ liệu</td>
      </tr>
    `;
    renderPagination();
    return;
  }

  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const pageRows = filteredRows.slice(start, start + ROWS_PER_PAGE);

  tableBody.innerHTML = pageRows
    .map((row) => {
      currentRenderRow = row;
      const cells = config.headers.map((_, index) => renderCell(row[index], index, config)).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  currentRenderRow = null;

  if (currentModule === 'CHECK_GIA') {
    tableBody.querySelectorAll('.calc-input').forEach((input) => {
      input.addEventListener('change', handleTinhGiaInputChange);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          input.blur();
        }
      });
    });
    tableBody.querySelectorAll('.profit-10-btn').forEach((button) => {
      button.addEventListener('click', handleProfitTenPercentClick);
    });
  }

  renderPagination();
}

function renderPagination() {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;

  const totalRows = filteredRows.length;
  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE) || 1;

  if (totalRows <= ROWS_PER_PAGE) {
    pagination.innerHTML = '';
    return;
  }

  pagination.innerHTML = `
    <button type="button" class="pagination-btn" id="prevPageBtn" ${currentPage === 1 ? 'disabled' : ''}>
      <i data-lucide="chevron-left"></i>
      Trước
    </button>
    <div class="page-info">Trang ${currentPage} / ${totalPages} (${totalRows} dòng)</div>
    <button type="button" class="pagination-btn" id="nextPageBtn" ${currentPage === totalPages ? 'disabled' : ''}>
      Tiếp
      <i data-lucide="chevron-right"></i>
    </button>
  `;

  document.getElementById('prevPageBtn')?.addEventListener('click', () => changePage(-1));
  document.getElementById('nextPageBtn')?.addEventListener('click', () => changePage(1));
  lucide.createIcons();
}

function changePage(delta) {
  const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE) || 1;
  currentPage = Math.min(Math.max(currentPage + delta, 1), totalPages);
  renderTable();
  document.querySelector('.table-shell')?.scrollTo({ top: 0, left: 0 });
}

function renderCell(value, index, config) {
  const raw = value ?? '';
  if (currentModule === 'CHECK_GIA' && CHECK_GIA_EDITABLE_COLS.has(index)) {
    const inputHtml = `
      <input
        class="calc-input"
        value="${formatInputValue(raw, index)}"
        data-row="${escapeHtml(currentRenderRow?.sheetRow || '')}"
        data-col="${index}"
        inputmode="decimal"
      >
    `;
    const profitShortcutHtml = index === TINH_GIA_COLS.laiMongMuon
      ? `
        <button
          type="button"
          class="profit-10-btn"
          title="Lãi mong muốn = giá gốc x 10%"
          aria-label="Lãi mong muốn bằng giá gốc nhân 10 phần trăm"
          data-row="${escapeHtml(currentRenderRow?.sheetRow || '')}"
        >10%</button>
      `
      : '';
    return `
      <td class="${config.percentCols.includes(index) ? 'percent-cell' : 'price-cell'}">
        <div class="calc-control">
          ${inputHtml}
          ${profitShortcutHtml}
        </div>
      </td>
    `;
  }

  if (config.imgCol === index && isUrl(raw)) {
    return `<td><img class="table-img" src="${escapeHtml(raw)}" alt=""></td>`;
  }

  if (isUrl(raw)) {
    return `<td><a class="link-cell" href="${escapeHtml(raw)}" target="_blank" rel="noopener">Mở link</a></td>`;
  }

  if (config.priceCols.includes(index)) {
    return `<td class="price-cell">${formatNumber(raw)}</td>`;
  }

  if (config.percentCols.includes(index)) {
    return `<td class="percent-cell">${formatNumber(raw)}</td>`;
  }

  if (index === 0) {
    return `<td class="id-cell">${escapeHtml(raw)}</td>`;
  }

  if (index === 1) {
    return `<td class="sku-cell">${escapeHtml(raw)}</td>`;
  }

  return `<td>${escapeHtml(raw)}</td>`;
}

function filterTable() {
  const keyword = document.getElementById('globalSearch').value.trim().toLowerCase();
  let rows = keyword
    ? allRows.filter((row) => row.some((cell) => String(cell ?? '').toLowerCase().includes(keyword)))
    : [...allRows];

  if (currentModule === 'CHECK_GIA') {
    if (selectedIdPrefixTwo) {
      rows = rows.filter((row) => getIdPrefix(row, 2) === selectedIdPrefixTwo);
    } else if (selectedIdPrefixOne) {
      rows = rows.filter((row) => getIdPrefix(row, 1) === selectedIdPrefixOne);
    }
  }

  filteredRows = sortCheckGiaRows(rows);
  currentPage = 1;
  renderTable();
  renderIdFilters();
}

function getSortedUniquePrefixes(length, rows = allRows) {
  return [...new Set(rows.map((row) => getIdPrefix(row, length)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }));
}

function renderPrefixButtons(containerId, prefixes, selectedValue, level) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = [
    `<button type="button" class="id-filter-btn ${selectedValue ? '' : 'active'}" data-level="${level}" data-prefix="">Tất cả</button>`,
    ...prefixes.map((prefix) => `
      <button type="button" class="id-filter-btn ${selectedValue === prefix ? 'active' : ''}" data-level="${level}" data-prefix="${escapeHtml(prefix)}">
        ${escapeHtml(prefix)}
      </button>
    `),
  ].join('');
}

function renderIdFilters() {
  const panel = document.getElementById('idFilterPanel');
  if (!panel) return;

  const isCheckGia = currentModule === 'CHECK_GIA';
  panel.hidden = !isCheckGia;
  if (!isCheckGia) return;

  const onePrefixes = getSortedUniquePrefixes(1);
  const rowsForTwoPrefixes = selectedIdPrefixOne
    ? allRows.filter((row) => getIdPrefix(row, 1) === selectedIdPrefixOne)
    : allRows;
  const twoPrefixes = getSortedUniquePrefixes(2, rowsForTwoPrefixes);

  renderPrefixButtons('idPrefixOneButtons', onePrefixes, selectedIdPrefixOne, '1');
  renderPrefixButtons('idPrefixTwoButtons', twoPrefixes, selectedIdPrefixTwo, '2');

  panel.querySelectorAll('.id-filter-btn').forEach((button) => {
    button.addEventListener('click', handleIdFilterClick);
  });
}

function handleIdFilterClick(event) {
  const button = event.currentTarget;
  const level = button.dataset.level;
  const prefix = button.dataset.prefix || '';

  if (level === '1') {
    selectedIdPrefixOne = prefix;
    selectedIdPrefixTwo = '';
  } else if (level === '2') {
    selectedIdPrefixTwo = prefix;
    selectedIdPrefixOne = prefix ? prefix.slice(0, 1) : selectedIdPrefixOne;
  }

  filterTable();
}

function resetIdFilters() {
  selectedIdPrefixOne = '';
  selectedIdPrefixTwo = '';
}

function calculateFeesFromGiaBan(row, giaBan) {
  const phiAdsRate = parseRate(row[TINH_GIA_COLS.phiAdsPercent]);
  const phiAffRate = parseRate(row[TINH_GIA_COLS.phiAffPercent]);
  const phiCoDinh = giaBan * 0.11;
  const phiXuLy = giaBan * 0.06;
  const voucherXtra = Math.min(giaBan * 0.055, 50000);
  const thueHkd = giaBan * 0.015;
  const phiQuangCao = giaBan * 0.01;
  const phiHaTang = 3000;
  const phiPiship = 2700;
  const phiAds = giaBan * phiAdsRate;
  const phiAff = giaBan * phiAffRate;
  const totalFee = phiAds + phiAff + phiCoDinh + phiXuLy + voucherXtra + thueHkd + phiQuangCao + phiHaTang + phiPiship;

  return {
    phiAds,
    phiAff,
    phiCoDinh,
    phiXuLy,
    voucherXtra,
    thueHkd,
    phiQuangCao,
    phiHaTang,
    phiPiship,
    totalFee,
  };
}

function calculateGiaBanFromLai(row, laiMongMuon) {
  const giaGoc = parseNumber(row[TINH_GIA_COLS.giaGoc]) || 0;
  const phiAdsRate = parseRate(row[TINH_GIA_COLS.phiAdsPercent]);
  const phiAffRate = parseRate(row[TINH_GIA_COLS.phiAffPercent]);
  const fixedBase = giaGoc + 3000 + 2700 + laiMongMuon;
  const rateWithVoucher = phiAdsRate + phiAffRate + 0.11 + 0.06 + 0.055 + 0.015 + 0.01;
  const giaBanPercentVoucher = fixedBase / Math.max(1 - rateWithVoucher, 0.0001);

  if (giaBanPercentVoucher * 0.055 <= 50000) {
    return giaBanPercentVoucher;
  }

  const rateWithVoucherCap = phiAdsRate + phiAffRate + 0.11 + 0.06 + 0.015 + 0.01;
  return (fixedBase + 50000) / Math.max(1 - rateWithVoucherCap, 0.0001);
}

function recalculateTinhGiaRow(row, changedCol) {
  const giaGoc = parseNumber(row[TINH_GIA_COLS.giaGoc]) || 0;
  let giaBan = parseNumber(row[TINH_GIA_COLS.giaBan]) || 0;
  let laiMongMuon = parseNumber(row[TINH_GIA_COLS.laiMongMuon]) || 0;

  if (changedCol === TINH_GIA_COLS.laiMongMuon) {
    giaBan = calculateGiaBanFromLai(row, laiMongMuon);
  }

  const fees = calculateFeesFromGiaBan(row, giaBan);

  if (
    changedCol === TINH_GIA_COLS.giaGoc ||
    changedCol === TINH_GIA_COLS.giaBan ||
    changedCol === TINH_GIA_COLS.phiAdsPercent ||
    changedCol === TINH_GIA_COLS.phiAffPercent
  ) {
    laiMongMuon = giaBan - giaGoc - fees.totalFee;
  }

  row[TINH_GIA_COLS.laiMongMuon] = toSheetNumber(laiMongMuon);
  row[TINH_GIA_COLS.giaBan] = toSheetNumber(giaBan);
  row[TINH_GIA_COLS.loiNhuanPercent] = giaBan ? toSheetNumber((laiMongMuon / giaBan) * 100) : 0;
  row[TINH_GIA_COLS.phiCoDinh] = toSheetNumber(fees.phiCoDinh);
  row[TINH_GIA_COLS.phiXuLyGiaoDich] = toSheetNumber(fees.phiXuLy);
  row[TINH_GIA_COLS.voucherXtra] = toSheetNumber(fees.voucherXtra);
  row[TINH_GIA_COLS.thueHkd] = toSheetNumber(fees.thueHkd);
  row[TINH_GIA_COLS.phiQuangCaoCoDinh] = toSheetNumber(fees.phiQuangCao);
  row[TINH_GIA_COLS.phiHaTang] = fees.phiHaTang;
  row[TINH_GIA_COLS.phiPiship] = fees.phiPiship;

  return row;
}

async function handleTinhGiaInputChange(event) {
  const input = event.currentTarget;
  const sheetRow = Number(input.dataset.row);
  const col = Number(input.dataset.col);
  const row = allRows.find((item) => item.sheetRow === sheetRow);
  if (!row) return;

  row[col] = input.value;
  await recalculateAndSaveTinhGiaRow(row, col);
}

async function handleProfitTenPercentClick(event) {
  const sheetRow = Number(event.currentTarget.dataset.row);
  const row = allRows.find((item) => item.sheetRow === sheetRow);
  if (!row) return;

  const giaGoc = parseNumber(row[TINH_GIA_COLS.giaGoc]);
  if (!Number.isFinite(giaGoc)) {
    alert('Dòng này chưa có giá gốc hợp lệ.');
    return;
  }

  row[TINH_GIA_COLS.laiMongMuon] = toSheetNumber(giaGoc * 0.1);
  await recalculateAndSaveTinhGiaRow(row, TINH_GIA_COLS.laiMongMuon);
}

async function recalculateAndSaveTinhGiaRow(row, changedCol) {
  recalculateTinhGiaRow(row, changedCol);
  renderTable();

  try {
    await updateSheetRow(`TINH_GIA!A${row.sheetRow}:O${row.sheetRow}`, row.slice(0, CHECK_GIA_HEADERS.length));
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

function buildTinhGiaRowFromSpPmRow(row) {
  const sku3 = String(row[SP_PM_COLS.sku3] ?? '').trim();
  const tenSp = String(row[SP_PM_COLS.tenSp] ?? '').trim();
  const giaBan = row[SP_PM_COLS.giaBan] ?? '';
  const newRow = Array.from({ length: CHECK_GIA_HEADERS.length }, () => '');
  newRow[0] = sku3;
  newRow[1] = tenSp || sku3;
  newRow[2] = giaBan;
  return newRow;
}

function findSpPmRowForInput(spPmRows, keyword) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return null;

  return (
    spPmRows.find((row) => String(row[SP_PM_COLS.sku3] ?? '').trim().toLowerCase() === normalizedKeyword) ||
    spPmRows.find((row) => String(row[SP_PM_COLS.tenSp] ?? '').trim().toLowerCase() === normalizedKeyword) ||
    spPmRows.find((row) => String(row[SP_PM_COLS.sku3] ?? '').trim().toLowerCase().includes(normalizedKeyword)) ||
    spPmRows.find((row) => String(row[SP_PM_COLS.tenSp] ?? '').trim().toLowerCase().includes(normalizedKeyword)) ||
    null
  );
}

function getExistingTinhGiaKeys(existingRows) {
  const existingIds = new Set();
  existingRows.forEach((row) => {
    [row[0], row[1]].forEach((value) => {
      const key = String(value ?? '').trim();
      if (key) existingIds.add(key);
    });
  });
  return existingIds;
}

function buildTinhGiaRowsFromSpPm(spPmRows, existingRows) {
  const existingIds = getExistingTinhGiaKeys(existingRows);
  const preparedIds = new Set();
  const rowsToAppend = [];

  spPmRows.forEach((row) => {
    const sku3 = String(row[SP_PM_COLS.sku3] ?? '').trim();
    if (!sku3 || existingIds.has(sku3) || preparedIds.has(sku3)) return;

    const newRow = buildTinhGiaRowFromSpPmRow(row);
    preparedIds.add(sku3);
    rowsToAppend.push(newRow);
  });

  return rowsToAppend;
}

async function addNewTinhGiaRows() {
  const keyword = prompt('Nhập sku_3 hoặc tên sản phẩm cần thêm từ SP_PM:');
  if (!keyword || !keyword.trim()) return;

  showLoading(true);
  try {
    const [spPmRows, tinhGiaRows] = await Promise.all([
      fetchSheetRows(CONFIG.tabs.SP_PM.range),
      fetchSheetRows(CHECK_GIA_TABS.CHECK_GIA.range),
    ]);
    const spPmRow = findSpPmRowForInput(spPmRows, keyword);

    if (!spPmRow) {
      alert('Không tìm thấy sản phẩm trong SP_PM.');
      return;
    }

    const sku3 = String(spPmRow[SP_PM_COLS.sku3] ?? '').trim();
    if (!sku3) {
      alert('Sản phẩm này chưa có sku_3.');
      return;
    }

    const existingIds = getExistingTinhGiaKeys(tinhGiaRows);
    if (existingIds.has(sku3)) {
      alert('Sản phẩm này đã có trong TINH_GIA.');
      return;
    }

    const rowToAppend = buildTinhGiaRowFromSpPmRow(spPmRow);
    await appendSheetRows('TINH_GIA!A:O', [rowToAppend]);
    alert(`Đã thêm ${sku3} vào TINH_GIA.`);

    if (currentModule === 'CHECK_GIA') {
      await loadModuleData();
    }
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    showLoading(false);
  }
}

async function loadModuleData() {
  const config = getActiveConfig();
  showLoading(true);

  try {
    document.getElementById('pageTitle').textContent = config.title;
    document.getElementById('pageSubtitle').textContent = config.subtitle;
    renderHeaders();

    const rows = await fetchSheetRows(config.range);
    allRows = normalizeRows(rows, config.headers.length);
    currentPage = 1;
    renderIdFilters();
    filterTable();
  } catch (error) {
    console.error(error);
    allRows = [];
    filteredRows = [];
    currentPage = 1;
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = `
      <tr>
        <td class="empty-cell" colspan="${config.headers.length}">${escapeHtml(error.message)}</td>
      </tr>
    `;
    renderPagination();
    renderIdFilters();
  } finally {
    showLoading(false);
    lucide.createIcons();
  }
}

function switchModule(moduleName) {
  if (!CHECK_GIA_TABS[moduleName]) return;
  currentModule = moduleName;
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.module === moduleName);
  });
  document.getElementById('globalSearch').value = '';
  resetIdFilters();
  currentPage = 1;
  loadModuleData();
}

function init() {
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => switchModule(button.dataset.module));
  });

  document.getElementById('globalSearch').addEventListener('input', filterTable);
  document.getElementById('reloadBtn').addEventListener('click', loadModuleData);
  document.getElementById('addNewBtn').addEventListener('click', addNewTinhGiaRows);

  lucide.createIcons();
  loadModuleData();
}

document.addEventListener('DOMContentLoaded', init);
