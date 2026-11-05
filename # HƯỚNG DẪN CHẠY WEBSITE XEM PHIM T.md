# HƯỚNG DẪN CHẠY WEBSITE XEM PHIM TRÊN MÁY TÍNH (LOCALHOST)

## 1. Chuẩn bị

Trước tiên, cần cài đặt Node.js:

- Truy cập: https://nodejs.org/
- Tải phiên bản LTS.
- Cài đặt như phần mềm bình thường, cứ nhấn Next cho đến khi hoàn tất.

Sau đó tải và giải nén file source code website vào máy tính.

Ví dụ giải nén vào:

`D:\WebsiteXemPhim`

## 2. Khởi chạy website lần đầu

### Bước 1: Mở thư mục dự án

Mở thư mục `WebsiteXemPhim` vừa giải nén.

Nhấn vào thanh địa chỉ của cửa sổ File Explorer, nhập:

`cmd`

Sau đó nhấn Enter.

Một cửa sổ dòng lệnh màu đen sẽ xuất hiện.

### Bước 2: Cài đặt các thành phần cần thiết

Nhập lệnh sau và nhấn Enter:

```bash
npm install
```

Chờ máy tính tải và cài đặt các thành phần. Chỉ cần thực hiện bước này một lần.

### Bước 3: Tạo tài khoản quản trị

Nhập:

```bash
npm run setup
```

Chương trình sẽ yêu cầu nhập:

- Tên đăng nhập quản trị (ví dụ: admin).
- Mật khẩu quản trị (ít nhất 12 ký tự).

Hãy tự đặt mật khẩu và ghi nhớ để sử dụng sau này.

### Bước 4: Khởi chạy website

Nhập:

```bash
npm start
```

Nếu thành công, cửa sổ sẽ hiển thị:

`Single Movie Website đang chạy tại http://127.0.0.1:3000`

Không đóng cửa sổ màu đen này khi muốn tiếp tục sử dụng website.

## 3. Truy cập website

Mở Chrome hoặc Microsoft Edge và truy cập:

| Chức năng | Địa chỉ |
|---|---|
| Trang giới thiệu phim | http://localhost:3000 |
| Trang xem phim | http://localhost:3000/watch |
| Trang quản trị | http://localhost:3000/admin |

## 4. Cách tải phim lên website

Đây là phần dành cho người quản trị.

**Bước 1:** Mở địa chỉ:

`http://localhost:3000/admin`

**Bước 2:** Đăng nhập bằng tài khoản đã tạo ở bước 3.

**Bước 3:** Cập nhật thông tin phim:

- Tên phim.
- Năm phát hành.
- Thể loại.
- Đạo diễn.
- Diễn viên.
- Nội dung giới thiệu.

Nhấn LƯU THÔNG TIN.

**Bước 4:** Tải hình ảnh:

- Chọn poster phim.
- Nhấn TẢI POSTER.
- Chọn ảnh nền ngang.
- Nhấn TẢI BACKDROP.

**Bước 5:** Tải video:

- Chọn video từ máy tính.
- Ưu tiên định dạng MP4.
- Nhấn UPLOAD VIDEO.
- Chờ thanh tiến trình chạy đến 100%.

**Bước 6:** Mở trang chủ, nhấn XEM PHIM để kiểm tra.

Video và hình ảnh sẽ được lưu trực tiếp trên ổ cứng máy tính.

## 5. Những lần sử dụng tiếp theo

Khi đã cài đặt thành công lần đầu, những lần sau không cần thực hiện lại các bước cài đặt.

Chỉ cần:

1. Mở thư mục `WebsiteXemPhim`.
2. Mở CMD tại thư mục đó.
3. Nhập:

```bash
npm start
```

4. Mở trình duyệt và truy cập website.

## 6. Cách tắt website

Khi không sử dụng nữa:

- Quay lại cửa sổ CMD đang chạy website.
- Nhấn tổ hợp phím `Ctrl + C`.
- Website sẽ dừng hoạt động.

Muốn sử dụng lại, chỉ cần chạy `npm start`.

## 7. Lưu ý quan trọng

- Không xóa thư mục `storage`, vì đây là nơi chứa video và hình ảnh đã tải lên.
- Không xóa file `.env`, vì file này lưu thông tin đăng nhập và cấu hình bảo mật.
- Không đóng cửa sổ CMD nếu vẫn muốn website hoạt động.
- Video lớn cần nhiều thời gian upload và dung lượng ổ cứng tương ứng.
- Máy tính phải còn đủ dung lượng để lưu phim.
- Khi máy tính tắt hoặc website dừng chạy, website cũng không thể truy cập.

**LƯU Ý VỀ PHẠM VI TRUY CẬP:** Phiên bản hiện tại chạy tại `localhost`, nghĩa là chỉ máy tính đang chạy website mới truy cập được. Người khác dùng điện thoại hoặc máy tính khác sẽ không truy cập được bằng địa chỉ localhost của họ.

Nếu muốn các thiết bị cùng Wi-Fi xem được, cần cấu hình thêm IP nội bộ và Windows Firewall.