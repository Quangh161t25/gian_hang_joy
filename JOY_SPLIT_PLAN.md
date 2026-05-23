# JOY split plan

Muc tieu: tach `joy.html` thanh cac file nho de de bao tri, nhung tach theo tung buoc de tranh vo luong upload Google Sheets.

## De xuat cau truc

- `joy.html`: da giu khung HTML va import CSS/JS.
- `assets/joy.css`: da tach toan bo style giao dien, sidebar, bang, nut, form loc.
- `assets/config.js`: da tach `CONFIG`, ten sheet, cot, range. Can tach rieng credential neu co backend/proxy.
- `assets/dh-s.js`: da tach logic rieng cho `DH_S`: 2 bang, loc ngay, tinh phi, tinh loi nhuan, cap nhat `gia_sp`, cap nhat `tinh_trang`.
- `assets/joy.js`: logic chung con lai: tab, fetch, upload, render bang chung, tim kiem.
- `assets/google-sheets.js`: token, fetch sheet, append, clear, batchUpdate.
- `assets/table-render.js`: render header, render table chung, pagination, search.
- `assets/upload.js`: doc Excel/CSV va luong upload.
- `assets/image-manager.js`: module quan ly anh.

## Thu tu tach an toan

1. Tach CSS truoc vi it anh huong logic.
2. Tach `dh-s.js` sau, vi phan nay dang thay doi nhieu nhat.
3. Tach upload va Google Sheets API.
4. Cuoi cung tach config/credential neu co cach bao mat tot hon.

## Luu y

- Sau moi buoc tach can chay lai kiem tra cu phap JavaScript.
- Sau khi tach `dh-s.js`, cac ham global dang dung trong HTML onclick nhu `switchTab`, `filterTable`, `updateDhSGiaSp` can gan vao `window`.
