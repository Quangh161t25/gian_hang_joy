function getUniqueDhSOrderRows(rows) {
    const seen = new Set();
    const uniqueRows = [];
    for (const row of rows) {
        const mdh = normalizeOrderCode(row[0]);
        if (!mdh || seen.has(mdh)) continue;
        seen.add(mdh);
        uniqueRows.push(row);
    }
    return uniqueRows;
}

function renderDhSCell(row, srcIdx) {
    const cell = row[srcIdx];
    const tabConfig = CONFIG.tabs.DH_S;
    if (srcIdx === DH_S_NGAY_DAT_HANG_COL) {
        return `<td>${formatDateOnly(cell) || ''}</td>`;
    }
    if ((tabConfig.rawPriceCols || []).includes(srcIdx)) {
        return `<td class="price-cell">${formatCurrency(cell)}</td>`;
    }
    return `<td>${cell || ''}</td>`;
}

function calculateDhSOrderMetrics(orderRow, orderRows) {
    const totalPaid = parseMoney(orderRow[29]);
    const phiCoDinh = parseMoney(orderRow[50]);
    const phiDichVu = parseMoney(orderRow[51]);
    const phiThanhToan = parseMoney(orderRow[52]);
    const piship = parseMoney(orderRow[DH_S_PISHIP_COL]);
    const phiThue = Math.round(totalPaid * 0.015);
    const phiKhac = parseMoney(orderRow[DH_S_PHI_KHAC_COL]);
    const tienThuVe = totalPaid - phiCoDinh - phiDichVu - phiThanhToan - piship - phiThue - phiKhac;
    const tongGiaSp = orderRows.reduce((sum, row) => sum + parseMoney(row[DH_S_GIA_SP_COL]), 0);
    const tinhTrang = String(orderRow[DH_S_TINH_TRANG_COL] || '').trim();
    const trangThai = deriveDhSTrangThai(tinhTrang);
    const loiNhuan = !tinhTrang || trangThai === 'HỦY' ? 0 : tienThuVe - tongGiaSp;
    return { piship, phiThue, phiKhac, tienThuVe, tongGiaSp, loiNhuan, trangThai };
}

function getBuyerPurchaseCounts(rows) {
    const buyerOrders = new Map();
    for (const row of rows) {
        const buyer = String(row[54] || '').trim();
        const mdh = normalizeOrderCode(row[0]);
        if (!buyer || !mdh) continue;
        if (!buyerOrders.has(buyer)) buyerOrders.set(buyer, new Set());
        buyerOrders.get(buyer).add(mdh);
    }
    const counts = new Map();
    buyerOrders.forEach((orders, buyer) => counts.set(buyer, orders.size));
    return counts;
}

function deriveDhSTrangThai(tinhTrang) {
    const val = String(tinhTrang || '').trim().toUpperCase();
    if (val === 'HỦY' || val === 'TRẢ') return 'HỦY';
    if (val === 'HOÀN THÀNH') return 'HOÀN THÀNH';
    return '';
}

function renderTinhTrangSelect(row) {
    const mdh = normalizeOrderCode(row[0]).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const current = String(row[DH_S_TINH_TRANG_COL] || '').trim().toUpperCase();
    const options = ['', 'HỦY', 'TRẢ', 'HOÀN THÀNH'];
    return `<td><select class="status-select" onclick="event.stopPropagation()" onchange="updateDhSTinhTrang('${mdh}', this.value)">
        ${options.map(opt => `<option value="${opt}" ${opt === current ? 'selected' : ''}>${opt || '-'}</option>`).join('')}
    </select></td>`;
}

function renderDhSOrderCell(row, srcIdx, metrics) {
    if (srcIdx === 'tong_gia_sp') return `<td class="price-cell">${formatCurrency(metrics.tongGiaSp)}</td>`;
    if (srcIdx === 'so_lan_mua') return `<td>${metrics.soLanMua || 0}</td>`;
    if (srcIdx === DH_S_PISHIP_COL) return `<td class="price-cell">${formatCurrency(row[DH_S_PISHIP_COL] || 0)}</td>`;
    if (srcIdx === DH_S_PHI_THUE_COL) return `<td class="price-cell">${formatCurrency(metrics.phiThue)}</td>`;
    if (srcIdx === DH_S_PHI_KHAC_COL) return `<td class="price-cell">${formatCurrency(row[DH_S_PHI_KHAC_COL] || 0)}</td>`;
    if (srcIdx === DH_S_TIEN_THU_VE_COL) return `<td class="price-cell">${formatCurrency(metrics.tienThuVe)}</td>`;
    if (srcIdx === DH_S_LOI_NHUAN_COL) return `<td class="price-cell">${formatCurrency(metrics.loiNhuan)}</td>`;
    if (srcIdx === DH_S_TINH_TRANG_COL) return renderTinhTrangSelect(row);
    if (srcIdx === DH_S_TRANG_THAI_COL) return `<td>${metrics.trangThai}</td>`;
    if ([55, 56, 60].includes(srcIdx)) return renderEditableDhSCell(row, srcIdx);
    return renderDhSCell(row, srcIdx);
}

function renderEditableDhSCell(row, srcIdx) {
    const mdh = normalizeOrderCode(row[0]).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const value = String(row[srcIdx] || '').replace(/"/g, '&quot;');
    return `<td><input class="editable-cell" value="${value}" onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter') this.blur()" onblur="updateDhSOrderField('${mdh}', ${srcIdx}, this.value)"></td>`;
}

function setSelectedDhSOrder(mdh) {
    selectedDhSOrderCode = selectedDhSOrderCode === mdh ? '' : mdh;
    renderDhSTables();
}

function renderDhSTables() {
    const tabConfig = CONFIG.tabs.DH_S;
    const sortedRows = sortDhSRowsByNgayDatHangDesc(filteredData);
    const uniqueRows = getUniqueDhSOrderRows(sortedRows);
    const buyerPurchaseCounts = getBuyerPurchaseCounts(allData);
    const rowsByOrder = new Map();
    for (const row of sortedRows) {
        const mdh = normalizeOrderCode(row[0]);
        if (!rowsByOrder.has(mdh)) rowsByOrder.set(mdh, []);
        rowsByOrder.get(mdh).push(row);
    }
    if (selectedDhSOrderCode && !uniqueRows.some(row => normalizeOrderCode(row[0]) === selectedDhSOrderCode)) {
        selectedDhSOrderCode = '';
    }
    const detailRows = selectedDhSOrderCode
        ? sortedRows.filter(row => normalizeOrderCode(row[0]) === selectedDhSOrderCode)
        : sortedRows;
    let totalProfit = 0;

    document.getElementById('dhSOrderBody').innerHTML = uniqueRows.map(row => {
        const mdh = normalizeOrderCode(row[0]);
        const activeClass = mdh === selectedDhSOrderCode ? ' active' : '';
        const metrics = calculateDhSOrderMetrics(row, rowsByOrder.get(mdh) || [row]);
        metrics.soLanMua = buyerPurchaseCounts.get(String(row[54] || '').trim()) || 0;
        totalProfit += metrics.loiNhuan;
        return `<tr class="dh-s-order-row${activeClass}" onclick="setSelectedDhSOrder('${mdh.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">${tabConfig.orderCols.map(srcIdx => renderDhSOrderCell(row, srcIdx, metrics)).join('')}</tr>`;
    }).join('');

    renderProfitSummary(totalProfit);

    document.getElementById('dhSDetailBody').innerHTML = detailRows.map(row => {
        return `<tr>${tabConfig.detailCols.map(srcIdx => renderDhSCell(row, srcIdx)).join('')}</tr>`;
    }).join('');
}

function renderProfitSummary(totalProfit) {
    const summary = document.getElementById('profitSummary');
    if (!summary) return;
    const valueEl = summary.querySelector('strong');
    if (valueEl) valueEl.textContent = formatCurrency(totalProfit);
}

function excelIndexToColName(idx) {
    let n = idx + 1;
    let name = '';
    while (n > 0) {
        const r = (n - 1) % 26;
        name = String.fromCharCode(65 + r) + name;
        n = Math.floor((n - 1) / 26);
    }
    return name;
}

async function updateDhSOrderField(mdh, srcIdx, value) {
    const orderCode = normalizeOrderCode(mdh);
    const targetRows = allData.filter(row => normalizeOrderCode(row[0]) === orderCode);
    if (!targetRows.length) return;
    const oldValue = String(targetRows[0][srcIdx] || '');
    if (oldValue === value) return;

    for (const row of targetRows) row[srcIdx] = value;
    renderDhSTables();

    try {
        const token = await getAccessToken();
        const colName = excelIndexToColName(srcIdx);
        const data = targetRows
            .filter(row => typeof row._sheetRow === 'number' && row._sheetRow >= 2)
            .map(row => ({
                range: `DH_S!${colName}${row._sheetRow}:${colName}${row._sheetRow}`,
                values: [[value]]
            }));
        if (!data.length) return;
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ valueInputOption: 'RAW', data })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || 'Lỗi cập nhật thông tin người nhận');
        }
    } catch (err) {
        console.error(err);
        alert('Lỗi khi cập nhật thông tin người nhận: ' + err.message);
        await fetchData();
    }
}

async function updateDhSTinhTrang(mdh, tinhTrang) {
    const orderCode = normalizeOrderCode(mdh);
    const nextTinhTrang = String(tinhTrang || '').trim().toUpperCase();
    const nextTrangThai = deriveDhSTrangThai(nextTinhTrang);
    const targetRows = allData.filter(row => normalizeOrderCode(row[0]) === orderCode);
    if (!targetRows.length) return;

    for (const row of targetRows) {
        row[DH_S_TINH_TRANG_COL] = nextTinhTrang;
        row[DH_S_TRANG_THAI_COL] = nextTrangThai;
    }
    renderDhSTables();

    try {
        const token = await getAccessToken();
        const data = targetRows
            .filter(row => typeof row._sheetRow === 'number' && row._sheetRow >= 2)
            .map(row => ({
                range: `DH_S!BS${row._sheetRow}:BT${row._sheetRow}`,
                values: [[nextTinhTrang, nextTrangThai]]
            }));
        if (!data.length) return;
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ valueInputOption: 'RAW', data })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || 'Lỗi cập nhật tình trạng');
        }
    } catch (err) {
        console.error(err);
        alert('Lỗi khi cập nhật tình trạng: ' + err.message);
        await fetchData();
    }
}

async function updateDhSGiaSp() {
    if (currentTab !== 'DH_S') return;
    if (!allData.length) {
        alert('Chưa có dữ liệu DH_S để cập nhật.');
        return;
    }
    if (!confirm('Cập nhật cột gia_sp trong DH_S theo giá bán ở SP_PM?')) return;

    document.getElementById('loading').style.display = 'flex';
    document.querySelector('#loading p').innerText = 'Đang cập nhật giá sản phẩm...';

    try {
        const token = await getAccessToken();
        await ensureDhSHeaders(token);

        const spPmRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${CONFIG.tabs.SP_PM.range}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!spPmRes.ok) {
            const err = await spPmRes.json();
            throw new Error(err.error?.message || 'Lỗi đọc SP_PM');
        }

        const spPmData = await spPmRes.json();
        const priceBySku3 = new Map();
        for (const row of spPmData.values || []) {
            const sku3 = String(row[35] || '').trim();
            if (sku3) priceBySku3.set(sku3, row[39] || '');
        }

        let matchedCount = 0;
        const sortedRows = sortDhSRowsByNgayDatHangDesc(filteredData);
        const targetRows = selectedDhSOrderCode
            ? sortedRows.filter(row => normalizeOrderCode(row[0]) === selectedDhSOrderCode)
            : sortedRows;

        if (!targetRows.length) {
            alert('Không có dòng nào trong bộ lọc hiện tại để cập nhật.');
            return;
        }

        const data = [];
        for (const row of targetRows) {
            const sku3 = leftText(row[20], 4);
            const giaSp = priceBySku3.has(sku3) ? priceBySku3.get(sku3) : '';
            if (giaSp !== '') matchedCount++;
            row[DH_S_GIA_SP_COL] = giaSp;
            if (typeof row._sheetRow === 'number' && row._sheetRow >= 2) {
                data.push({
                    range: `DH_S!BQ${row._sheetRow}:BQ${row._sheetRow}`,
                    values: [[giaSp]]
                });
            }
        }

        const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ valueInputOption: 'RAW', data })
        });
        if (!updateRes.ok) {
            const err = await updateRes.json();
            throw new Error(err.error?.message || 'Lỗi cập nhật gia_sp');
        }

        renderTable();
        alert(`Đã cập nhật gia_sp cho ${matchedCount}/${targetRows.length} dòng đang lọc.`);
    } catch (err) {
        console.error(err);
        alert('Lỗi khi cập nhật gia_sp: ' + err.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

async function updateDhSPiShip() {
    if (currentTab !== 'DH_S') return;
    if (!allData.length) {
        alert('Chưa có dữ liệu DH_S để cập nhật.');
        return;
    }
    if (!confirm('Cập nhật piship = 1620 cho các dòng đang lọc?')) return;

    document.getElementById('loading').style.display = 'flex';
    document.querySelector('#loading p').innerText = 'Đang cập nhật piship...';

    try {
        const token = await getAccessToken();
        await ensureDhSHeaders(token);

        const sortedRows = sortDhSRowsByNgayDatHangDesc(filteredData);
        const targetRows = selectedDhSOrderCode
            ? sortedRows.filter(row => normalizeOrderCode(row[0]) === selectedDhSOrderCode)
            : sortedRows;

        if (!targetRows.length) {
            alert('Không có dòng nào trong bộ lọc hiện tại để cập nhật.');
            return;
        }

        const data = [];
        for (const row of targetRows) {
            row[DH_S_PISHIP_COL] = 1620;
            if (typeof row._sheetRow === 'number' && row._sheetRow >= 2) {
                data.push({
                    range: `DH_S!BM${row._sheetRow}:BM${row._sheetRow}`,
                    values: [[1620]]
                });
            }
        }

        const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ valueInputOption: 'RAW', data })
        });
        if (!updateRes.ok) {
            const err = await updateRes.json();
            throw new Error(err.error?.message || 'Lỗi cập nhật piship');
        }

        renderTable();
        alert(`Đã cập nhật piship cho ${targetRows.length} dòng đang lọc.`);
    } catch (err) {
        console.error(err);
        alert('Lỗi khi cập nhật piship: ' + err.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}
