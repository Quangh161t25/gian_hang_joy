// Đọc tham số ?up= từ URL của trang này (ví dụ: sp_pm_joy.html?up=txx1)
const UP_PARAM = new URLSearchParams(window.location.search).get('up') || '';

const JOY_TAB_STORAGE_KEY = 'joyActiveTab';
const JOY_VALID_TABS = ['SP_PM', 'DH_S', 'THU_CHI'];

let currentTab = 'DH_S', allData = [], accessToken = null, tokenExpiry = 0;
let currentPage = 1, rowsPerPage = 100, filteredData = [];
let selectedDhSOrderCode = '';
let selectedTinhTrangFilter = '';
let selectedThuChiLoaiFilter = '';
let thuChiOrderCodes = new Set();
/** Map tên tab (tên sheet) → sheetId Google, cache nhẹ cho batchUpdate */
let sheetTitleToIdCache = null;

const THU_CHI_NGAY_COL = 1;

function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 20);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 180);
    }, 3600);
}

function askConfirm(message) {
    return new Promise(resolve => {
        let modal = document.getElementById('confirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'confirmModal';
            modal.className = 'confirm-mask';
            modal.innerHTML = `
                <div class="confirm-card">
                    <div class="confirm-title">Xác nhận</div>
                    <div class="confirm-message"></div>
                    <div class="confirm-actions">
                        <button type="button" class="secondary-btn" data-confirm="no">Hủy</button>
                        <button type="button" class="action-btn action-success" data-confirm="yes">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        modal.querySelector('.confirm-message').textContent = message;
        modal.style.display = 'flex';
        const done = value => {
            modal.style.display = 'none';
            modal.querySelector('[data-confirm="yes"]').onclick = null;
            modal.querySelector('[data-confirm="no"]').onclick = null;
            resolve(value);
        };
        modal.querySelector('[data-confirm="yes"]').onclick = () => done(true);
        modal.querySelector('[data-confirm="no"]').onclick = () => done(false);
    });
}

function toggleSidebar() {
    document.body.classList.toggle('sidebar-collapsed');
    const icon = document.querySelector('.sidebar-toggle i');
    if (icon) icon.setAttribute('data-lucide', document.body.classList.contains('sidebar-collapsed') ? 'panel-left-open' : 'panel-left-close');
    lucide.createIcons();
}

async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiry - 300000) return accessToken;
    const header = { alg: "RS256", typ: "JWT" }, now = Math.floor(Date.now() / 1000),
        payload = { iss: CONFIG.serviceAccountEmail, scope: "https://www.googleapis.com/auth/spreadsheets", aud: CONFIG.tokenUrl, exp: now + 3600, iat: now };
    const sJWT = KJUR.jws.JWS.sign("RS256", JSON.stringify(header), JSON.stringify(payload), CONFIG.privateKey);
    const res = await fetch(CONFIG.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sJWT}` });
    const data = await res.json();
    accessToken = data.access_token; tokenExpiry = Date.now() + (data.expires_in * 1000);
    return accessToken;
}

async function switchTab(tabName) {
    currentTab = tabName;
    if (JOY_VALID_TABS.includes(tabName)) {
        try { sessionStorage.setItem(JOY_TAB_STORAGE_KEY, tabName); } catch (_) { /* ignore */ }
    }
    const uploadBtn = document.getElementById('uploadBtn');
    const tabLabels = {
        'SP_PM': 'SP_PM',
        'DH_S': 'ĐƠN HÀNG SHOPEE'
    };

    document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        if (t.innerText === (tabLabels[tabName] || tabName)) t.classList.add('active');
    });

    const tableWrapper = document.getElementById('tableWrapper');
    const dhSSplitWrapper = document.getElementById('dhSSplitWrapper');
    const pagination = document.getElementById('pagination');
    const imageManager = document.getElementById('imageManager');
    const headerActions = document.getElementById('headerActions');
    const updateGiaSpBtn = document.getElementById('updateGiaSpBtn');
    const updatePiShipBtn = document.getElementById('updatePiShipBtn');
    const recalcDhSBtn = document.getElementById('recalcDhSBtn');
    const addThuChiBtn = document.getElementById('addThuChiBtn');
    const dateFilterGroup = document.getElementById('dateFilterGroup');
    const thuChiFilterGroup = document.getElementById('thuChiFilterGroup');
    const dhSNoteInput = document.getElementById('dhSNoteInput');
    const dhSStatusNote = document.getElementById('dhSStatusNote');
    const pageTitle = document.getElementById('pageTitle');

    // Reset all
    tableWrapper.style.display = 'none';
    dhSSplitWrapper.style.display = 'none';
    pagination.style.display = 'none';
    headerActions.style.display = 'none';
    imageManager.style.display = 'none';
    if (updateGiaSpBtn) updateGiaSpBtn.style.display = 'none';
    if (updatePiShipBtn) updatePiShipBtn.style.display = 'none';
    if (recalcDhSBtn) recalcDhSBtn.style.display = 'none';
    if (addThuChiBtn) addThuChiBtn.style.display = 'none';
    if (dateFilterGroup) dateFilterGroup.style.display = 'none';
    if (thuChiFilterGroup) thuChiFilterGroup.style.display = 'none';
    if (dhSNoteInput) dhSNoteInput.style.display = 'none';
    if (dhSStatusNote) dhSStatusNote.style.display = 'none';

    if (tabName === 'ANH') {
        imageManager.style.display = 'block';
        pageTitle.innerText = 'HỆ THỐNG QUẢN LÝ ẢNH';
    } else {
        if (tabName === 'DH_S') {
            dhSSplitWrapper.style.display = 'grid';
        } else {
            tableWrapper.style.display = 'block';
            pagination.style.display = 'flex';
        }
        headerActions.style.display = 'flex';
        pageTitle.innerText = tabName === 'DH_S' ? 'ĐƠN HÀNG SHOPEE (TẤT CẢ)' : 'QUẢN LÝ SẢN PHẨM';
        if (tabName === 'THU_CHI') pageTitle.innerText = 'THU CHI';
        if (uploadBtn) {
            uploadBtn.style.display = tabName === 'THU_CHI' ? 'none' : 'flex';
            uploadBtn.innerHTML = `<i data-lucide="upload" style="width:18px;"></i> ${tabName === 'DH_S' ? 'Tải Excel Shopee Lên' : 'Tải Sản Phẩm Lên'}`;
            lucide.createIcons();
        }
        if (updateGiaSpBtn && tabName === 'DH_S') {
            updateGiaSpBtn.style.display = 'flex';
            lucide.createIcons();
        }
        if (updatePiShipBtn && tabName === 'DH_S') {
            updatePiShipBtn.style.display = 'flex';
            lucide.createIcons();
        }
        if (recalcDhSBtn && tabName === 'DH_S') {
            recalcDhSBtn.style.display = 'flex';
            lucide.createIcons();
        }
        if (addThuChiBtn && tabName === 'THU_CHI') {
            addThuChiBtn.style.display = 'flex';
            lucide.createIcons();
        }
        if (dateFilterGroup && tabName === 'DH_S') {
            dateFilterGroup.style.display = 'flex';
        }
        if (dhSNoteInput && tabName === 'DH_S') {
            dhSNoteInput.style.display = 'block';
            dhSNoteInput.value = '';
        }
        if (dhSStatusNote && tabName === 'DH_S') {
            dhSStatusNote.style.display = 'block';
        }
        if (thuChiFilterGroup && tabName === 'THU_CHI') {
            thuChiFilterGroup.style.display = 'flex';
        }

        document.getElementById('searchInput').value = '';
        if (tabName === 'DH_S') setDhSDateFilterToTodayIfEmpty();
        currentPage = 1;
        await fetchData();
    }
}

async function fetchData() {
    document.getElementById('loading').style.display = 'flex';
    document.querySelector('#loading p').innerText = `Đang tải dữ liệu ${currentTab}...`;
    try {
        const token = await getAccessToken();
        const tabConfig = CONFIG.tabs[currentTab];
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${tabConfig.range}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const rawRows = data.values || [];
        allData = rawRows.map((row, i) => {
            const arr = Array.isArray(row) ? row.slice() : [];
            arr._sheetRow = i + 2;
            return arr;
        });
        if (currentTab === 'DH_S') await loadThuChiOrderCodes(token);
        if (currentTab === 'DH_SHOPE') allData = sortDhShopeRowsByNgayDesc(allData);
        if (currentTab === 'DH_S') allData = sortDhSRowsByNgayDatHangDesc(allData);
        if (currentTab === 'THU_CHI') allData = sortThuChiRowsByNgayDesc(allData);
        if (currentTab === 'DH_S') {
            filteredData = applyDhSFilters([...allData]);
        } else if (currentTab === 'THU_CHI') {
            filteredData = applyThuChiFilters([...allData]);
        } else {
            filteredData = [...allData];
        }
        renderHeaders();
        renderTable();
    } catch (e) {
        console.error("Lỗi khi tải dữ liệu:", e);
        showToast("Không thể tải dữ liệu. Vui lòng kiểm tra lại sheet '" + currentTab + "' có tồn tại không.", 'error');
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

async function loadThuChiOrderCodes(token) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/THU_CHI!E2:E`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        thuChiOrderCodes = new Set();
        return;
    }
    const data = await res.json();
    thuChiOrderCodes = new Set((data.values || [])
        .map(row => normalizeOrderCode(row[0]))
        .filter(Boolean));
}

function renderHeaders() {
    if (currentTab === 'DH_S') {
        renderDhSHeaders();
        return;
    }

    const head = document.getElementById('tableHead');

    if (currentTab === 'THU_CHI') {
        head.innerHTML = `<tr>
            <th>ngay</th><th>thu_chi</th><th>truong</th><th>mdh</th><th>mvd</th><th>so_tien</th>
            <th>tiền còn lại</th><th>so_tien_loi_nhuan</th><th>tiền lợi nhuận còn lại</th><th>Xóa</th>
        </tr>`;
        return;
    }

    const tabConfig = CONFIG.tabs[currentTab];
    const hiddenCols = tabConfig.hiddenCols || [];
    const headers = tabConfig.headers.filter((_, idx) => !hiddenCols.includes(idx));
    if (currentTab === 'SP_PM') {
        headers.push('', 'Xóa');
    } else if (currentTab === 'SP_SHOPEE' || currentTab === 'DH_SHOPE' || currentTab === 'DH_S' || currentTab === 'DH_SHOPE_CT') {
        headers.push('Xóa');
    }
    head.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
}

function renderDhSHeaders() {
    const tabConfig = CONFIG.tabs.DH_S;
    document.getElementById('dhSOrderHead').innerHTML = `<tr>${tabConfig.orderHeaders.map(h => `<th>${h}</th>`).join('')}</tr>`;
    document.getElementById('dhSDetailHead').innerHTML = `<tr>${tabConfig.detailHeaders.map(h => `<th>${h}</th>`).join('')}</tr>`;
}

function getDataSheetRow(row) {
    if (row && typeof row._sheetRow === 'number' && row._sheetRow >= 2) return row._sheetRow;
    const idx = allData.indexOf(row);
    return idx >= 0 ? idx + 2 : 0;
}

async function getSheetTitleToIdMap(token) {
    if (sheetTitleToIdCache) return sheetTitleToIdCache;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}?fields=sheets(properties(sheetId,title))`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Không đọc được metadata spreadsheet');
    const data = await res.json();
    const map = {};
    for (const s of data.sheets || []) {
        map[s.properties.title] = s.properties.sheetId;
    }
    sheetTitleToIdCache = map;
    return map;
}

async function deleteDataSheetRow(sheetRow1Based) {
    const rowNum = Number(sheetRow1Based);
    if (!rowNum || rowNum < 2) {
        showToast('Không xác định được dòng cần xóa.', 'error');
        return;
    }
    if (!await askConfirm('Xóa dòng này trên Google Sheet? Thao tác không hoàn tác.')) return;

    document.getElementById('loading').style.display = 'flex';
    document.querySelector('#loading p').innerText = 'Đang xóa dòng...';
    try {
        const token = await getAccessToken();
        const map = await getSheetTitleToIdMap(token);
        const sheetId = map[currentTab];
        if (sheetId === undefined) throw new Error('Không tìm thấy sheet: ' + currentTab);

        const startIndex = rowNum - 1;
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId,
                            dimension: 'ROWS',
                            startIndex,
                            endIndex: startIndex + 1
                        }
                    }
                }]
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || 'batchUpdate thất bại');
        }
        sheetTitleToIdCache = null;
        await fetchData();
        filterTable();
    } catch (e) {
        console.error(e);
        showToast('Không xóa được: ' + e.message, 'error');
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

async function init() {
    lucide.createIcons();
    initDragAndDrop();
    if (UP_PARAM) {
        await fetchData();
    } else {
        let saved = '';
        try { saved = sessionStorage.getItem(JOY_TAB_STORAGE_KEY) || ''; } catch (_) { }
        if (saved && JOY_VALID_TABS.includes(saved)) {
            await switchTab(saved);
        } else {
            await fetchData();
        }
    }
}

function initDragAndDrop() {
    const body = document.body;
    const overlay = document.getElementById('dropOverlay');

    window.addEventListener('dragover', (e) => {
        if (currentTab === 'ANH' || currentTab === 'THU_CHI') return;
        e.preventDefault();
        overlay.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
        if (currentTab === 'ANH' || currentTab === 'THU_CHI') return;
        if (e.relatedTarget === null) overlay.classList.remove('active');
    });

    window.addEventListener('drop', (e) => {
        if (currentTab === 'ANH' || currentTab === 'THU_CHI') return;
        e.preventDefault();
        overlay.classList.remove('active');
        if (e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    });
}

function formatCurrency(val) {
    const n = parseMoney(val);
    if (!n) return '0';
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n);
}

function parseMoney(val) {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    let s = String(val || '').trim();
    if (!s) return 0;
    s = s.replace(/[^\d,.-]/g, '');
    if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes('.')) {
        const parts = s.split('.');
        s = parts[parts.length - 1].length === 3 ? s.replace(/\./g, '') : s;
    } else if (s.includes(',')) {
        const parts = s.split(',');
        s = parts[parts.length - 1].length === 3 ? s.replace(/,/g, '') : s.replace(',', '.');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

/** Cột ngay trong tab DH_SHOPE (sau id). */
const DH_SHOPE_NGAY_COL = 1;
/** Cột Ngày đặt hàng trong tab DH_S raw Shopee. */
const DH_S_NGAY_DAT_HANG_COL = 2;
const DH_S_NGAY_UP_DON_COL = 63;
const DH_S_GHI_CHU_COL = 62;
const DH_S_PISHIP_COL = 64;
const DH_S_PHI_THUE_COL = 65;
const DH_S_PHI_KHAC_COL = 66;
const DH_S_TIEN_THU_VE_COL = 67;
const DH_S_GIA_SP_COL = 68;
const DH_S_LOI_NHUAN_COL = 69;
const DH_S_TINH_TRANG_COL = 70;
const DH_S_TRANG_THAI_COL = 71;
const DH_S_DEFAULT_TINH_TRANG = 'LÊN ĐƠN';

/** Chuẩn hóa ngày để so sánh: DD/MM/YYYY, ISO, hoặc số serial Excel. Không parse được → xếp cuối. */
function parseNgayForSort(raw) {
    if (raw === undefined || raw === null) return Number.NEGATIVE_INFINITY;
    const s0 = String(raw).trim();
    if (!s0) return Number.NEGATIVE_INFINITY;

    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 25000 && raw < 120000) {
        return (raw - 25569) * 86400000;
    }

    const s = s0.replace(',', '.');
    const asNum = Number(s);
    if (Number.isFinite(asNum) && asNum > 25000 && asNum < 120000 && !/[\/\-]/.test(s0)) {
        return (asNum - 25569) * 86400000;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(s0)) {
        const t = Date.parse(s0);
        if (!isNaN(t)) return t;
    }

    const m = s0.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (m) {
        const day = parseInt(m[1], 10), month = parseInt(m[2], 10) - 1, year = parseInt(m[3], 10);
        const hh = m[4] != null ? parseInt(m[4], 10) : 0, mi = m[5] != null ? parseInt(m[5], 10) : 0, ss = m[6] != null ? parseInt(m[6], 10) : 0;
        const d = new Date(year, month, day, hh, mi, ss);
        if (!isNaN(d.getTime())) return d.getTime();
    }

    const fallback = Date.parse(s0);
    if (!isNaN(fallback)) return fallback;
    return Number.NEGATIVE_INFINITY;
}

function sortRowsByNgayDesc(rows, ngayCol) {
    return [...rows].sort((a, b) => {
        const tb = parseNgayForSort(b[ngayCol]);
        const ta = parseNgayForSort(a[ngayCol]);
        return tb - ta;
    });
}

function sortDhShopeRowsByNgayDesc(rows) {
    return sortRowsByNgayDesc(rows, DH_SHOPE_NGAY_COL);
}

function sortDhSRowsByNgayDatHangDesc(rows) {
    return sortRowsByNgayDesc(rows, DH_S_NGAY_DAT_HANG_COL);
}

function getThuChiTypeRank(row) {
    return String(row?.[2] || '').trim().toLowerCase() === 'chi' ? 1 : 0;
}

function sortThuChiRowsByNgayDesc(rows) {
    return [...rows].sort((a, b) => {
        const dateDiff = parseNgayForSort(b[THU_CHI_NGAY_COL]) - parseNgayForSort(a[THU_CHI_NGAY_COL]);
        if (dateDiff) return dateDiff;
        const typeDiff = getThuChiTypeRank(a) - getThuChiTypeRank(b);
        if (typeDiff) return typeDiff;
        return getDataSheetRow(a) - getDataSheetRow(b);
    });
}

function formatDateOnly(raw) {
    if (raw === undefined || raw === null || raw === '') return raw;

    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 25000 && raw < 120000) {
        const d = new Date((raw - 25569) * 86400000);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    const s0 = String(raw).trim();
    if (!s0) return raw;

    const serialText = Number(s0.replace(',', '.'));
    if (Number.isFinite(serialText) && serialText > 25000 && serialText < 120000 && !/[\/\-]/.test(s0)) {
        return formatDateOnly(serialText);
    }

    const iso = s0.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
        return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
    }

    const vn = s0.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (vn) {
        return `${vn[3]}-${String(vn[2]).padStart(2, '0')}-${String(vn[1]).padStart(2, '0')}`;
    }

    const t = Date.parse(s0);
    if (!isNaN(t)) {
        const d = new Date(t);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    return raw;
}

function todayDateOnly() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function todayDateDisplay() {
    const iso = todayDateOnly();
    const [yyyy, mm, dd] = iso.split('-');
    return `${dd}/${mm}/${yyyy}`;
}

function formatDateDisplay(raw) {
    const iso = formatDateOnly(raw);
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (raw || '');
}

function generateThuChiId() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return `TC${stamp}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function getThuChiFormValues() {
    return {
        id: generateThuChiId(),
        ngay: formatDateDisplay(document.getElementById('thuChiNgayInput')?.value || todayDateOnly()),
        thuChi: String(document.getElementById('thuChiLoaiInput')?.value || 'thu').trim(),
        truong: String(document.getElementById('thuChiTruongInput')?.value || '').trim(),
        mdh: String(document.getElementById('thuChiMdhInput')?.value || '').trim(),
        mvd: String(document.getElementById('thuChiMvdInput')?.value || '').trim(),
        soTien: parseMoney(document.getElementById('thuChiSoTienInput')?.value || 0),
        soTienLoiNhuan: parseMoney(document.getElementById('thuChiSoTienLoiNhuanInput')?.value || 0)
    };
}

function openThuChiForm(defaults = {}) {
    const modal = document.getElementById('thuChiModal');
    if (!modal) return;
    document.getElementById('thuChiNgayInput').value = defaults.ngay || todayDateOnly();
    document.getElementById('thuChiLoaiInput').value = defaults.thuChi || 'thu';
    document.getElementById('thuChiTruongInput').value = defaults.truong || '';
    document.getElementById('thuChiMdhInput').value = defaults.mdh || '';
    document.getElementById('thuChiMvdInput').value = defaults.mvd || '';
    document.getElementById('thuChiSoTienInput').value = defaults.soTien ?? '';
    if (document.getElementById('thuChiSoTienLoiNhuanInput')) {
        document.getElementById('thuChiSoTienLoiNhuanInput').value = defaults.soTienLoiNhuan ?? '';
    }
    modal.style.display = 'flex';
    lucide.createIcons();
}

function closeThuChiForm() {
    const modal = document.getElementById('thuChiModal');
    if (modal) modal.style.display = 'none';
}

async function appendThuChiRow(values) {
    const row = [
        values.id || generateThuChiId(),
        formatDateDisplay(values.ngay || todayDateOnly()),
        values.thuChi || 'thu',
        values.truong || '',
        values.mdh || '',
        values.mvd || '',
        values.soTien ?? 0,
        values.soTienLoiNhuan ?? 0
    ];
    const token = await getAccessToken();
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/THU_CHI!A2:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Lỗi thêm THU_CHI');
    }
    return row;
}

async function submitThuChiForm(event) {
    event.preventDefault();
    const values = getThuChiFormValues();
    if (!values.truong) {
        showToast('Vui lòng nhập trường.', 'warning');
        return;
    }
    if (!values.soTien) {
        showToast('Vui lòng nhập số tiền.', 'warning');
        return;
    }
    document.getElementById('loading').style.display = 'flex';
    document.querySelector('#loading p').innerText = 'Đang thêm thu chi...';
    try {
        await appendThuChiRow(values);
        closeThuChiForm();
        if (currentTab === 'THU_CHI') await fetchData();
        showToast('Đã thêm thu chi thành công.', 'success');
    } catch (err) {
        console.error(err);
        showToast('Lỗi khi thêm thu chi: ' + err.message, 'error');
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function normalizeHeaderName(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function getDhSHeaderAliases(header) {
    const aliases = [header];
    if (normalizeHeaderName(header) === normalizeHeaderName('Phí thanh toán')) {
        aliases.push('Phí xử lý giao dịch');
    }
    return aliases;
}

function mapDhSRowsByHeaders(rows) {
    const tabConfig = CONFIG.tabs.DH_S;
    if (!rows.length) return [];
    const firstRow = rows[0] || [];
    const headerIndex = new Map();
    firstRow.forEach((header, idx) => {
        const key = normalizeHeaderName(header);
        if (key && !headerIndex.has(key)) headerIndex.set(key, idx);
    });
    const hasHeader = headerIndex.has(normalizeHeaderName('Mã đơn hàng'));
    if (!hasHeader) return rows;

    const uploadDate = todayDateDisplay();
    const dataRows = rows.slice(1);
    return dataRows.map(row => tabConfig.fullHeaders.map((header, targetIdx) => {
        if (targetIdx === DH_S_NGAY_UP_DON_COL) return uploadDate;
        if (targetIdx === DH_S_TINH_TRANG_COL) return DH_S_DEFAULT_TINH_TRANG;
        if (targetIdx === DH_S_TRANG_THAI_COL) return deriveDhSTrangThai(DH_S_DEFAULT_TINH_TRANG);
        const sourceIdx = getDhSHeaderAliases(header)
            .map(alias => headerIndex.get(normalizeHeaderName(alias)))
            .find(idx => idx !== undefined);
        return sourceIdx === undefined ? '' : row[sourceIdx];
    }));
}

function normalizeDhSDateColumns(rows) {
    const targetLength = CONFIG.tabs.DH_S.fullHeaders.length;
    return rows.map(row => {
        const next = Array.isArray(row) ? row.slice() : row;
        if (Array.isArray(next)) {
            next[DH_S_NGAY_DAT_HANG_COL] = formatDateOnly(next[DH_S_NGAY_DAT_HANG_COL]);
            while (next.length < targetLength) next.push('');
            if (!String(next[DH_S_TINH_TRANG_COL] || '').trim()) next[DH_S_TINH_TRANG_COL] = DH_S_DEFAULT_TINH_TRANG;
            if (!String(next[DH_S_TRANG_THAI_COL] || '').trim()) next[DH_S_TRANG_THAI_COL] = deriveDhSTrangThai(next[DH_S_TINH_TRANG_COL]);
            if (next.length > targetLength) next.length = targetLength;
        }
        return next;
    });
}

async function ensureDhSHeaders(token) {
    const writeHeaderRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/DH_S!A1:BT1?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [CONFIG.tabs.DH_S.fullHeaders] })
    });
    if (!writeHeaderRes.ok) {
        const err = await writeHeaderRes.json();
        throw new Error(err.error?.message || 'Lỗi cập nhật header DH_S');
    }
}

function excelColToIndex(col) {
    const name = String(col || '').toUpperCase().trim();
    let idx = 0;
    for (let i = 0; i < name.length; i++) {
        idx = idx * 26 + (name.charCodeAt(i) - 64);
    }
    return idx - 1;
}

function safeCell(row, col) {
    const idx = excelColToIndex(col);
    return String((row && row[idx]) ?? '').trim();
}

function leftText(val, len) {
    return String(val || '').slice(0, len);
}

function normalizeOrderCode(val) {
    return String(val || '').trim();
}

function filterRowsByNewOrderCode(rowsToUpload, existingRows) {
    const existingOrderCodes = new Set(
        existingRows
            .map(row => normalizeOrderCode(row[0]))
            .filter(Boolean)
    );
    const skippedOrderCodes = new Set();
    const uploadOrderCodes = new Set();
    const newRows = [];

    for (const row of rowsToUpload) {
        const mdh = normalizeOrderCode(row[0]);
        if (mdh && existingOrderCodes.has(mdh)) {
            skippedOrderCodes.add(mdh);
            continue;
        }
        if (mdh) uploadOrderCodes.add(mdh);
        newRows.push(row);
    }

    return {
        newRows,
        skippedOrderCount: skippedOrderCodes.size,
        newOrderCount: uploadOrderCodes.size
    };
}

/** Chỉ ô Excel thật sự là kiểu số (typeof number) → lấy phần nguyên. Không đụng chuỗi (SĐT, mã đơn dạng text). */
function extractUniqueForDhShope(allRows) {
    const seen = new Set();
    const uniqueRows = [];
    for (const row of allRows) {
        const mdh = normalizeOrderCode(row[0]);
        if (!mdh || seen.has(mdh)) continue;
        seen.add(mdh);

        const ngay = formatDateOnly(row[2]) || '';
        const mvd = row[7] || '';
        const thanhTien = Number(row[29]) || 0;
        const phiCoDinh = Number(row[50]) || 0;
        const phiDichVu = Number(row[51]) || 0;
        const phiThanhToan = Number(row[52]) || 0;
        const piship = 1620;
        const thue = Math.round(thanhTien * 0.015);
        const loiNhuan = thanhTien - phiCoDinh - phiDichVu - phiThanhToan - piship - thue;

        uniqueRows.push([
            mdh, ngay, mvd, thanhTien, phiCoDinh, phiDichVu, phiThanhToan,
            piship, '', thue, '', '', loiNhuan, '', '',
            row[54] || '', row[55] || '', row[56] || '', row[60] || ''
        ]);
    }
    return uniqueRows;
}

function extractDetailsForDhShopeCt(dhSRows, spPmRows) {
    const productMap = {};
    for (const p of spPmRows) {
        const skuCon = String(p[36] || '').trim();
        if (skuCon) {
            productMap[skuCon] = {
                gia_ban: Number(p[39]) || 0,
                gia_dong_goi: Number(p[40]) || 0
            };
        }
    }

    return dhSRows.map(row => {
        const mdh = row[0] || '';
        const skuPhanLoai = String(row[20] || '').trim();
        const soLuong = Number(row[27]) || 0;
        const tenSp = row[16] || '';
        const sku4 = leftText(skuPhanLoai, 4);
        const sku10 = leftText(skuPhanLoai, 10);

        const prod = productMap[sku10] || { gia_ban: 0, gia_dong_goi: 0 };
        const donGia = prod.gia_ban - prod.gia_dong_goi;
        const thanhTien = soLuong * donGia;
        const randId = Math.random().toString(36).substring(2, 8).toUpperCase();

        return [randId, mdh, skuPhanLoai, soLuong, sku4, sku10, tenSp, soLuong, donGia, thanhTien];
    });
}

function buildThuChiBalanceMap(rows) {
    const byRow = new Map();
    let balance = 0;
    let profitBalance = 0;
    const orderedRows = [...rows].sort((a, b) => {
        const dateDiff = parseNgayForSort(a[THU_CHI_NGAY_COL]) - parseNgayForSort(b[THU_CHI_NGAY_COL]);
        if (dateDiff) return dateDiff;
        return getDataSheetRow(a) - getDataSheetRow(b);
    });
    for (const row of orderedRows) {
        const type = String(row[2] || '').trim().toLowerCase();
        const amount = parseMoney(row[6]);
        const profitAmount = parseMoney(row[7] || (type === 'chi' ? row[6] : 0));
        balance += type === 'chi' ? -amount : amount;
        profitBalance += type === 'chi' ? -profitAmount : profitAmount;
        byRow.set(row, { balance, profitBalance });
    }
    return byRow;
}

function renderTable() {
    if (currentTab === 'DH_S') {
        renderDhSTables();
        return;
    }

    const tbody = document.getElementById('tableBody');
    const tabConfig = CONFIG.tabs[currentTab];

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredData.slice(start, end);
    const thuChiBalanceByRow = currentTab === 'THU_CHI' ? buildThuChiBalanceMap(allData) : null;

    tbody.innerHTML = pageData.map(row => {
        if (currentTab === 'THU_CHI') {
            const rowIdx = getDataSheetRow(row);
            const balances = thuChiBalanceByRow.get(row) || { balance: 0, profitBalance: 0 };
            return `<tr>
                <td>${formatDateDisplay(row[1])}</td>
                <td>${row[2] || ''}</td>
                <td>${row[3] || ''}</td>
                <td>${row[4] || ''}</td>
                <td>${row[5] || ''}</td>
                <td class="price-cell">${formatCurrency(row[6])}</td>
                <td class="price-cell">${formatCurrency(balances.balance)}</td>
                <td class="price-cell">${formatCurrency(row[7])}</td>
                <td class="price-cell">${formatCurrency(balances.profitBalance)}</td>
                <td><button type="button" class="btn-delete" onclick="deleteDataSheetRow(${rowIdx})">Xóa</button></td>
            </tr>`;
        }

        const hiddenCols = tabConfig.hiddenCols || [];
        const colIndices = tabConfig.displayCols || null;
        const visibleCols = colIndices
            ? colIndices.map(srcIdx => ({ srcIdx, cell: row[srcIdx] }))
            : tabConfig.headers.map((_, idx) => hiddenCols.includes(idx) ? null : ({ srcIdx: idx, cell: row[idx] })).filter(Boolean);

        const cells = visibleCols.map(({ srcIdx, cell }, displayIdx) => {
            if (srcIdx === tabConfig.imgCol && cell) {
                const firstImg = cell.split(',')[0].trim();
                return `<td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${firstImg}" class="table-img" onerror="this.style.display='none'">
                        <a href="${cell.split(',')[0].trim()}" target="_blank" style="color: var(--primary); text-decoration: none; font-size: 11px; font-weight: 600;">Xem</a>
                    </div>
                </td>`;
            }
            const priceIdx = colIndices ? displayIdx : srcIdx;
            if (tabConfig.priceCols.includes(priceIdx)) {
                return `<td class="price-cell">${formatCurrency(cell)}</td>`;
            }
            if (currentTab === 'DH_S' && srcIdx === DH_S_NGAY_DAT_HANG_COL) {
                return `<td>${formatDateOnly(cell) || ''}</td>`;
            }
            if (currentTab === 'THU_CHI' && srcIdx === THU_CHI_NGAY_COL) {
                return `<td>${formatDateDisplay(cell)}</td>`;
            }
            const cellStr = String(cell || '').trim();
            if (cellStr.startsWith('http://') || cellStr.startsWith('https://')) {
                const parts = cellStr.split(',');
                const linksHtml = parts.map((l, i) => `<a href="${l.trim()}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: none;">Link ${parts.length > 1 ? i + 1 : ''}</a>`.trim());
                return `<td>${linksHtml.join(', ')}</td>`;
            }
            return `<td>${cell || ''}</td>`;
        }).join('');

        const sr = getDataSheetRow(row);
        let extraCols = '';
        if (currentTab === 'SP_PM') {
            extraCols = `<td><button class="btn-camera" onclick="openImageManager('${(row[5] || '').replace(/'/g, "\\'")}')">📷 Ảnh</button></td>`;
            extraCols += `<td><button type="button" class="btn-delete" onclick="deleteDataSheetRow(${sr})">Xóa</button></td>`;
        } else if (currentTab === 'SP_SHOPEE' || currentTab === 'DH_SHOPE') {
            extraCols = `<td><button type="button" class="btn-delete" onclick="deleteDataSheetRow(${sr})">Xóa</button></td>`;
        }

        // THU_CHI extraCols is now handled completely at the top of the map function

        return `<tr>${cells}${extraCols}</tr>`;
    }).join('');

    renderPagination();
}

function renderPagination() {
    const totalRows = filteredData.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
    const pagination = document.getElementById('pagination');

    if (totalRows <= rowsPerPage) {
        pagination.innerHTML = '';
        return;
    }

    pagination.innerHTML = `
        <button class="pagination-btn" onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''}>
            <i data-lucide="chevron-left" style="width:16px;"></i> Trước
        </button>
        <div class="page-info">Trang ${currentPage} / ${totalPages} (${totalRows} dòng)</div>
        <button class="pagination-btn" onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''}>
            Tiếp <i data-lucide="chevron-right" style="width:16px;"></i>
        </button>
    `;
    lucide.createIcons();
}

function changePage(delta) {
    currentPage += delta;
    renderTable();
    document.querySelector('.table-wrapper').scrollTop = 0;
}

function filterTable() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    filteredData = allData.filter(row => row.some(cell => String(cell).toLowerCase().includes(term)));
    if (currentTab === 'DH_S') filteredData = applyDhSFilters(filteredData);
    if (currentTab === 'DH_SHOPE') filteredData = sortDhShopeRowsByNgayDesc(filteredData);
    if (currentTab === 'DH_S') filteredData = sortDhSRowsByNgayDatHangDesc(filteredData);
    if (currentTab === 'THU_CHI') filteredData = sortThuChiRowsByNgayDesc(applyThuChiFilters(filteredData));
    currentPage = 1;
    renderTable();
}

function dateInputToTime(value, endOfDay = false) {
    if (!value) return endOfDay ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    const d = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`);
    return isNaN(d.getTime()) ? (endOfDay ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : d.getTime();
}

function applyDhSDateFilter(rows) {
    const fromInput = document.getElementById('dateFromInput');
    const toInput = document.getElementById('dateToInput');
    const orderDateFilter = document.getElementById('orderDateFilterInput')?.checked;
    const dateCol = orderDateFilter ? DH_S_NGAY_DAT_HANG_COL : DH_S_NGAY_UP_DON_COL;
    const fromTime = dateInputToTime(fromInput?.value || '', false);
    const toTime = dateInputToTime(toInput?.value || '', true);
    return rows.filter(row => {
        const t = parseNgayForSort(row[dateCol]);
        return t >= fromTime && t <= toTime;
    });
}

function applyDhSFilters(rows) {
    let result = applyDhSDateFilter(rows);
    const orderCode = String(document.getElementById('orderCodeFilterInput')?.value || '').trim().toLowerCase();
    const buyer = String(document.getElementById('buyerFilterInput')?.value || '').trim().toLowerCase();
    const trangThai = String(document.getElementById('trangThaiFilterInput')?.value || '').trim().toUpperCase();
    const tinhTrang = String(selectedTinhTrangFilter || '').trim().toUpperCase();

    if (orderCode) result = result.filter(row => normalizeOrderCode(row[0]).toLowerCase().includes(orderCode));
    if (buyer) result = result.filter(row => String(row[54] || '').toLowerCase().includes(buyer));
    if (tinhTrang) result = result.filter(row => String(row[DH_S_TINH_TRANG_COL] || '').trim().toUpperCase() === tinhTrang);
    if (trangThai) result = result.filter(row => deriveDhSTrangThai(row[DH_S_TINH_TRANG_COL]) === trangThai);
    return result;
}

function applyThuChiFilters(rows) {
    const fromTime = dateInputToTime(document.getElementById('thuChiDateFromInput')?.value || '', false);
    const toTime = dateInputToTime(document.getElementById('thuChiDateToInput')?.value || '', true);
    const loai = String(selectedThuChiLoaiFilter || '').trim().toLowerCase();
    const truong = String(document.getElementById('thuChiTruongFilterInput')?.value || '').trim().toLowerCase();

    return rows.filter(row => {
        const rowTime = parseNgayForSort(row[1]);
        const rowLoai = String(row[2] || '').trim().toLowerCase();
        const rowTruong = String(row[3] || '').trim().toLowerCase();

        if (rowTime < fromTime || rowTime > toTime) return false;
        if (loai && rowLoai !== loai) return false;
        if (truong && !rowTruong.includes(truong)) return false;
        return true;
    });
}

function setDhSDateFilterToTodayIfEmpty() {
    const fromInput = document.getElementById('dateFromInput');
    const toInput = document.getElementById('dateToInput');
    const sameDateInput = document.getElementById('sameDateFilterInput');
    if (sameDateInput) sameDateInput.checked = true;
    if (!fromInput || !toInput || fromInput.value || toInput.value) return;
    const val = todayDateOnly();
    fromInput.value = val;
    toInput.value = val;
}

function syncSameDateFilter(sourceInputId) {
    const sameDate = document.getElementById('sameDateFilterInput')?.checked;
    if (!sameDate) {
        filterTable();
        return;
    }
    const fromInput = document.getElementById('dateFromInput');
    const toInput = document.getElementById('dateToInput');
    const source = document.getElementById(sourceInputId) || fromInput;
    if (fromInput && toInput && source?.value) {
        fromInput.value = source.value;
        toInput.value = source.value;
    }
    filterTable();
}

function handleDateFilterChange(inputId) {
    syncSameDateFilter(inputId);
}

function toDateInputValue(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function setDhSQuickDateFilter(mode) {
    const fromInput = document.getElementById('dateFromInput');
    const toInput = document.getElementById('dateToInput');
    const sameDateInput = document.getElementById('sameDateFilterInput');
    if (!fromInput || !toInput) return;

    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);

    if (mode === 'yesterday') {
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
    } else if (mode === 'week') {
        const day = start.getDay() || 7;
        start.setDate(start.getDate() - day + 1);
    } else if (mode === 'month') {
        start.setDate(1);
    } else if (mode === '3months') {
        start.setMonth(start.getMonth() - 3);
    }

    fromInput.value = toDateInputValue(start);
    toInput.value = toDateInputValue(end);
    if (sameDateInput) sameDateInput.checked = mode === 'today' || mode === 'yesterday';
    filterTable();
}

function setTinhTrangFilter(value) {
    selectedTinhTrangFilter = value;
    document.querySelectorAll('#tinhTrangFilterButtons .status-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
    filterTable();
}

function setThuChiLoaiFilter(value) {
    selectedThuChiLoaiFilter = value;
    document.querySelectorAll('#thuChiLoaiFilterButtons .status-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
    filterTable();
}

function stepDateFilter(inputId, deltaDays) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const base = input.value ? new Date(`${input.value}T00:00:00`) : new Date();
    base.setDate(base.getDate() + deltaDays);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    input.value = `${yyyy}-${mm}-${dd}`;
    syncSameDateFilter(inputId);
}

function stepThuChiDateFilter(inputId, deltaDays) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const base = input.value ? new Date(`${input.value}T00:00:00`) : new Date();
    base.setDate(base.getDate() + deltaDays);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    input.value = `${yyyy}-${mm}-${dd}`;
    filterTable();
}

async function handleFileUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    await processFiles(files);
    event.target.value = '';
}

function readExcelRows(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (currentTab !== 'DH_S' && rows[0] && rows[0][0] && String(rows[0][0]).toUpperCase().includes("ID")) {
                    rows = rows.slice(1);
                }
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error(`Không thể đọc file ${file.name}`));
        reader.readAsArrayBuffer(file);
    });
}

async function processFiles(files) {
    const excelFiles = files.filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (!excelFiles.length) {
        showToast("Vui lòng tải lên file Excel hoặc CSV.", 'warning');
        return;
    }

    const fileNames = excelFiles.map(f => f.name).join(", ");
    const confirmMessage = currentTab === 'DH_S'
        ? `Dữ liệu từ ${excelFiles.length} file (${fileNames}) sẽ được THÊM MỚI vào sheet 'DH_S' và cập nhật unique vào 'DH_SHOPE'. Tiếp tục?`
        : `Dữ liệu từ ${excelFiles.length} file (${fileNames}) sẽ ghi đè sheet '${currentTab}' (xóa dữ liệu cũ). Tiếp tục?`;
    if (!await askConfirm(confirmMessage)) return;

    document.getElementById('loading').style.display = 'flex';
    document.querySelector('#loading p').innerText = `Đang xử lý ${excelFiles.length} file và cập nhật Google Sheets...`;

    try {
        const rowsFromFiles = await Promise.all(excelFiles.map(readExcelRows));
        const normalizedRowsFromFiles = currentTab === 'DH_S'
            ? rowsFromFiles.map(mapDhSRowsByHeaders)
            : rowsFromFiles;
        let allRowsToUpload = normalizedRowsFromFiles
            .flat()
            .filter(r => Array.isArray(r) && r.some(c => String(c || '').trim() !== ''))
            .map(r => Array.isArray(r) ? r.map(c => (typeof c === 'number' && Number.isFinite(c)) ? Math.trunc(c) : c) : r);

        if (currentTab === 'DH_S') {
            allRowsToUpload = normalizeDhSDateColumns(allRowsToUpload);
        }

        if (!allRowsToUpload.length) {
            throw new Error("Không có dòng dữ liệu hợp lệ để tải lên.");
        }

        const token = await getAccessToken();

        if (currentTab === 'DH_S') {
            await ensureDhSHeaders(token);

            // 1. Fetch current DH_S first so each Mã đơn hàng is uploaded only once.
            document.querySelector('#loading p').innerText = 'Đang kiểm tra Mã đơn hàng đã tồn tại...';
            const existingDhSRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${CONFIG.tabs.DH_S.range}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!existingDhSRes.ok) {
                const err = await existingDhSRes.json();
                throw new Error(err.error?.message || 'Lỗi đọc DH_S hiện có');
            }
            const existingDhSData = await existingDhSRes.json();
            const existingDhSRows = existingDhSData.values || [];
            const { newRows, skippedOrderCount, newOrderCount } = filterRowsByNewOrderCode(allRowsToUpload, existingDhSRows);

            if (!newRows.length) {
                showToast(`Không có dữ liệu mới để tải lên. ${skippedOrderCount} Mã đơn hàng trong file đã tồn tại trên DH_S nên đã bỏ qua.`, 'warning');
                return;
            }

            // 2. Append only new order rows to DH_S. One order can still contain many rows.
            document.querySelector('#loading p').innerText = 'Đang thêm các Mã đơn hàng mới vào DH_S...';
            const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/DH_S!A2:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ values: newRows })
            });
            if (!appendRes.ok) {
                const err = await appendRes.json();
                throw new Error(err.error?.message || 'Lỗi append DH_S');
            }

            // 3. Rebuild derived sheets from existing rows plus the newly appended rows.
            document.querySelector('#loading p').innerText = 'Đang cập nhật unique vào DH_SHOPE...';
            const allDhSRows = existingDhSRows.concat(newRows);

            // 4. Extract unique by Mã đơn hàng
            const uniqueRows = extractUniqueForDhShope(allDhSRows);

            // 5. Clear DH_SHOPE and write unique rows
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/DH_SHOPE!A2:S100000:clear`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (uniqueRows.length > 0) {
                const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/DH_SHOPE!A2?valueInputOption=RAW`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ values: uniqueRows })
                });
                if (!writeRes.ok) {
                    const err = await writeRes.json();
                    throw new Error(err.error?.message || 'Lỗi cập nhật DH_SHOPE');
                }
            }

            // 6. Build DH_SHOPE_CT
            document.querySelector('#loading p').innerText = 'Đang trích xuất chi tiết đơn hàng...';
            const spPmRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${CONFIG.tabs.SP_PM.range}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const spPmData = await spPmRes.json();
            const spPmRows = spPmData.values || [];
            const detailRows = extractDetailsForDhShopeCt(allDhSRows, spPmRows);

            // 7. Clear and write DH_SHOPE_CT
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/DH_SHOPE_CT!A2:J100000:clear`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (detailRows.length > 0) {
                const writeCtRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/DH_SHOPE_CT!A2?valueInputOption=RAW`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ values: detailRows })
                });
                if (!writeCtRes.ok) {
                    const err = await writeCtRes.json();
                    throw new Error(err.error?.message || 'Lỗi cập nhật DH_SHOPE_CT');
                }
            }
            const skippedText = skippedOrderCount ? ` Đã bỏ qua ${skippedOrderCount} Mã đơn hàng đã tồn tại.` : '';
            showToast(`Đã thêm ${newRows.length} dòng (${newOrderCount} Mã đơn hàng mới) vào DH_S, cập nhật ${uniqueRows.length} đơn vào DH_SHOPE và ${detailRows.length} dòng vào DH_SHOPE_CT thành công!${skippedText}`, 'success');
        } else {
            const tabConfig = CONFIG.tabs[currentTab];
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${tabConfig.clearRange}:clear`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${currentTab}!A2?valueInputOption=RAW`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ values: allRowsToUpload })
            });
            if (!updateRes.ok) {
                const err = await updateRes.json();
                throw new Error(err.error?.message || 'Lỗi cập nhật API');
            }
            showToast(`Đã tải dữ liệu từ ${excelFiles.length} file lên sheet '${currentTab}' thành công!`, 'success');
        }

        try { sessionStorage.setItem(JOY_TAB_STORAGE_KEY, currentTab); } catch (_) { }
        location.reload();
    } catch (err) {
        console.error(err);
        showToast("Lỗi khi tải dữ liệu: " + err.message, 'error');
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function openImageManager(ma) {
    // Lấy BASE_URL động từ iframe (không hardcode, tránh lỗi khi đổi URL)
    const iframe = document.querySelector('#imageManager iframe');
    const BASE_URL = iframe.getAttribute('src').split('?')[0];
    const url = ma ? BASE_URL + '?up=' + encodeURIComponent(ma) : BASE_URL;
    iframe.src = url;
    switchTab('ANH');
}

init();
