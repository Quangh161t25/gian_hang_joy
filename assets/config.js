const CONFIG = {
    spreadsheetId: "1Bfz39faKp79G1BYEw7R0_2TZPF4vP2wZxOq7pvmNIkQ",
    serviceAccountEmail: "test-gia-ason@api-test-sheet-161.iam.gserviceaccount.com",
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC3NN84hLTkQPZd
Lj7niXZTICq7nHsuTn3J6r2Paq12m70/lYSmrwh1i0EStr9bO19QM8cevGlslwGr
WSVOLJlc6+w1HGPKvRXtA41kYV9MYIvpzIPQtkFE7Hxq71QyBARcv39Lfzze6Ioj
3G8VBvAKFLAnCUr97GHRv+KbCTFxPZupd3PEB+xS5ZUlzdBCEZvDid3iXaaEJJ+l
Td1apAGQHjtnDTLOkiTa8zf7X5ebALwnI9MziOdN8VyprHXGhkachPbKyrG0QwEs
2jtiI6Y5ULsBPjNefoavH8MKU5DEAT9h0fZ7KfsKYVMDuXqmEKBs0D3B4Z6aDZQW
wT2dDRZDAgMBAAECggEAEIuVoSzZVuFhaz1GI9ji0IacjvO50cIq7M8Zrj4/F756
Ew6PIhKENafAb7U4INm2AnzUMO8CqL9Jpxs85qUM3W4JysSByqLUiRW2184amIyb
j7jCXfLBTQn8AbHgrUepl5d/vBmFYMgon/mqjbNiGDb4FZgEQSkie5o6fi/dWp5d
NahbZl+WTOB/znhAfKh/zferHNxldR/ERmwOubZUerkqysWiBigc3ovpLSUof9ur
z3hNPPp0CKQjF40xuQc6FYTHUHMLuMvp78PXuc/mYqQmZ8VOGhU+faGtZ4m+QJly
dF5dS8U5cwKEF+ptuAUiWSahn6INb9yKn3+FcsW0UQKBgQDb8N4eWFvbgpRo/vxo
wBN2u2TWubj6clcrq/1a+VR0njC28Can0ogJHhrFhPxVs5D/rugs3HlbyAXJFptY
V0DZPCwBxGU5P5RbGjXWWEUXjp4ISKQD8WKfVlXNr79TqLdOg2NZBYQAi06Cpo/T
PV9l7LSG2Tj/9WdvD7W2wvrpaQKBgQDVPjpJN6xh7+sHtSU0mjKvrqigpHbuSQ/o
XpUaWSIpJffm5QpFPAOcTT5mHZCyllicJQIrfPSY+sH8n+sF03CUqVkV4Q2UqfOf
pFaLDB4P6SQ8iesZyF4VKFrj/cAvRJmp0e5W/DRnFkoEp+8c+nrru2+Dzm9kb7Uq
0CiltqYAywKBgBtcfrV1to+7Ue0x84KwintV2rifyDRX7yI+tjkQFYKgf1zyyUxN
c6D2vsvdvGqI+TvlrXqPPwW8/4NBrbeyux2LT8o0fYc+sp0WyKXOu2Gv21caelUH
PYam/eultn6Y2Z0J2V0kw4Qx0GWOhQv5cZnDdb3k3iNxixmU8b03ynEpAoGBAKEA
7O0fNe50QRZ+tOq0ihSPYQ55XrqnO3WNBDLynZJH8pbI1CpWF7vJrpVXOUs9rQWo
A61mGR/wJMtiywaJEHWOL48PbzuR3jno0NcHfSMyOoPi9jlvSWncIFQH4TVPLF5F
/Rh8L+ytrZE6YpWUoX6e9KGmGgDRPw5mQGpuL4RlAoGADe9n080SXlsUk4nHVjUz
Efv7EBoBkgOpqb9T1foRfJl46NxmmTOYV3iGIhjwcDskEg284k4iq/gH6EEFyEBc
Vz13jzB1nBgjfezFesVQz7bA/+Wik6HZtxAxVg38BKMt+Q1tYw9wOjbGPqOn++VC
sR2Sh8e3h3Knd6j1tceRIFU=
-----END PRIVATE KEY-----`,
    tokenUrl: "https://oauth2.googleapis.com/token",
    tabs: {
        'SP_PM': {
            range: 'SP_PM!A2:AU',
            clearRange: 'SP_PM!A2:AU10000',
            headers: ['ID', 'Tên', 'Sản phẩm cha', 'Loại', 'Trạng thái', 'Mã', 'Mã vạch', 'Giá nhập', 'VAT(%)', 'Giá bán lẻ', 'Giá sỉ', 'Giá đón gói', 'Giá cũ', 'Danh mục', 'Thương hiệu', 'Khối lượng', 'Đơn vị tính', 'Dài', 'Rộng', 'Cao', 'Link hướng dẫn sử dụng', 'Ảnh', 'Xuất xứ', 'Địa chỉ bảo hành', 'Số điện thoại bảo hành', 'Số tháng bảo hành', 'Link video bảo hành', 'Tồn', 'Tổng tồn', 'Tạm giữ', 'Có thể bán', 'Giá bán thấp nhất', 'show_sku', 'sku_1', 'sku_2', 'sku_3', 'sku_con', 'sku_cha', 'gia_nhap', 'gia_ban', 'gia_dong_goi', 'gia_thap_nhat', 'sku_ct_ten', 'sku_ten', 'sku_bce', 'kt_1', 'kt_2'],
            priceCols: [7, 9, 10, 11, 12, 31, 38, 39, 40, 41],
            imgCol: 21
        },
        'SP_SHOPEE': {
            range: 'SP_SHOPEE!A2:M',
            clearRange: 'SP_SHOPEE!A2:M10000',
            headers: ['Mã Sản phẩm', 'Tên Sản phẩm', 'Mã Phân loại', 'Tên phân loại', 'SKU Sản phẩm', 'SKU', 'Giá', 'Giá niêm yết trực tiếp:MY', 'Giá niêm yết trực tiếp:PH', 'GTIN', 'Số lượng:KHO F', 'Số lượng:Kho HCM', 'Số lượng:Kho Hà Nội'],
            priceCols: [6, 7, 8],
            imgCol: -1
        },
        'DH_SHOPE': {
            range: 'DH_SHOPE!A2:S',
            clearRange: 'DH_SHOPE!A2:S100000',
            headers: ['mdh', 'ngay', 'mvd', 'Tổng số tiền Người mua thanh toán', 'Phí cố định', 'Phí Dịch Vụ', 'Phí thanh toán', 'piship', 'tiep_thi_lien_ket', 'thue', 'phi_khac', 'tien_mua', 'loi_nhuan', 'gc1', 'gc1', 'id_khach', 'ten_khach', 'sdt', 'dia_chỉ'],
            priceCols: [3, 4, 5, 6, 7, 9, 12],
            imgCol: -1
        },
        'DH_S': {
            range: 'DH_S!A2:BT',
            clearRange: 'DH_S!A2:BT100000',
            fullHeaders: ["Mã đơn hàng", "Mã Kiện Hàng", "Ngày đặt hàng", "Trạng Thái Đơn Hàng", "Sản Phẩm Bán Chạy", "Lý do hủy", "Nhận xét từ Người mua", "Mã vận đơn", "Đơn Vị Vận Chuyển", "Phương thức giao hàng", "Loại đơn hàng", "Ngày giao hàng dự kiến", "Ngày gửi hàng", "Thời gian giao hàng", "Trạng thái Trả hàng/Hoàn tiền", "SKU sản phẩm", "Tên sản phẩm", "Cân nặng sản phẩm", "Tổng cân nặng", "Tên kho hàng", "SKU phân loại hàng", "Tên phân loại hàng", "Giá gốc", "Người bán trợ giá", "Được Shopee trợ giá", "Tổng số tiền được người bán trợ giá", "Giá ưu đãi", "Số lượng", "Số lượng sản phẩm được hoàn trả", "Tổng số tiền Người mua thanh toán", "Tổng giá trị đơn hàng (VND)", "Mã giảm giá của Shop", "Hoàn Xu", "Mã giảm giá của Shopee", "Chỉ tiêu Combo Khuyến Mãi", "Giảm giá từ combo Shopee", "Giảm giá từ Combo của Shop", "Shopee Xu được hoàn", "Số tiền được giảm khi thanh toán bằng thẻ Ghi nợ", "Trade-in Discount", "Trade-in Bonus", "Phí vận chuyển (dự kiến)", "Trade-in Bonus by Seller", "Phí vận chuyển mà người mua trả", "Phí vận chuyển tài trợ bởi Shopee (dự kiến)", "Phí vận chuyển trả hàng (đơn Trả hàng/hoàn tiền)", "Tổng số tiền người mua thanh toán", "Thời gian hoàn thành đơn hàng", "Thời gian đơn hàng được thanh toán", "Phương thức thanh toán", "Phí cố định", "Phí Dịch Vụ", "Phí thanh toán", "Tiền ký quỹ", "Người Mua", "Tên Người nhận", "Số điện thoại", "Tỉnh/Thành phố", "TP / Quận / Huyện", "Quận", "Địa chỉ nhận hàng", "Quốc gia", "Ghi chú", "ngay_up_don", "piship", "phi_thue", "phi_khac", "tien_thu_ve", "gia_sp", "loi_nhuan", "tinh_trang", "trang_thai"],
            headers: ['Mã đơn hàng', 'Ngày đặt hàng', 'Mã vận đơn', 'SKU phân loại hàng', 'Số lượng', 'Tổng số tiền Người mua thanh toán', 'Phí cố định', 'Phí Dịch Vụ', 'Phí thanh toán', 'Tiền ký quỹ', 'Người Mua', 'Tên Người nhận', 'Số điện thoại', 'Địa chỉ nhận hàng'],
            displayCols: [0, 2, 7, 20, 27, 29, 50, 51, 52, 53, 54, 55, 56, 60],
            orderCols: [0, 2, 7, 63, 70, 71, 29, 50, 51, 52, 64, 65, 66, 67, 'tong_gia_sp', 69, 54, 'so_lan_mua', 55, 56, 60],
            orderHeaders: ['Mã đơn hàng', 'Ngày đặt hàng', 'Mã vận đơn', 'ngay_up_don', 'tinh_trang', 'trang_thai', 'Tổng số tiền Người mua thanh toán', 'Phí cố định', 'Phí Dịch Vụ', 'Phí thanh toán', 'piship', 'phi_thue', 'phi_khac', 'tien_thu_ve', 'tổng giá sp', 'loi_nhuan', 'Người Mua', 'số lần mua', 'Tên Người nhận', 'Số điện thoại', 'Địa chỉ nhận hàng'],
            detailCols: [20, 27, 68],
            detailHeaders: ['SKU phân loại hàng', 'Số lượng', 'gia_sp'],
            priceCols: [5, 6, 7, 8, 9],
            rawPriceCols: [29, 50, 51, 52, 53, 64, 65, 66, 67, 68, 69],
            imgCol: -1
        },
        'DH_SHOPE_CT': {
            range: 'DH_SHOPE_CT!A2:J',
            clearRange: 'DH_SHOPE_CT!A2:J100000',
            headers: ['id', 'mdh', 'SKU phân loại hàng', 'Số lượng', 'sku', 'sku_ct', 'ten_sp', 'slg', 'don_gia', 'thanh_tien'],
            priceCols: [8, 9],
            imgCol: -1
        }
    }
};
