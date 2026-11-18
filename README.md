<div align="center">

<img src="hghubx.svg" alt="HGhubX" width="128" height="128" />

# HGhubX (Bản Fork Tiếng Việt · Android Optimized)

**Ứng dụng xem video đa nền tảng · Rust + Tauri v2**

Hỗ trợ: Android / Windows / macOS / Linux / iOS · Giao diện phong cách iOS Liquid Glass · Trình phát video cảm ứng chuyên sâu cho Android

</div>

---

## 🌟 Điểm nổi bật của bản Fork (`dangtrandang/HGfork`)

### 1. 🇻🇳 Việt hóa 100% Giao diện (UI/UX)
- Toàn bộ giao diện người dùng, thanh điều hướng, tìm kiếm, khám phá danh mục, cài đặt hệ thống, bộ lọc nội dung, bảng chọn tập và thông báo lỗi đã được chuyển ngữ sang Tiếng Việt hoàn chỉnh, tự nhiên và dễ hiểu.

### 2. 📴 Chế độ Offline-first (Không cần tài khoản)
- Gỡ bỏ hoàn toàn sự phụ thuộc vào hệ thống đăng nhập tài khoản máy chủ Trung Quốc.
- Chuyển mục **"Tôi"** thành **"Tủ phim cá nhân"**: Lưu lịch sử xem tiếp, danh sách theo dõi tác giả và phim yêu thích trực tiếp vào bộ nhớ máy (`localStorage`). Bạn có thể sử dụng đầy đủ mọi tính năng lưu trữ mà không lo lỗi mạng, lỗi tài khoản hay lộ thông tin cá nhân.

### 3. 📱 Trình phát Player tối ưu hóa cho màn hình cảm ứng Android
- **Thao tác chạm thông minh**:
  - Chạm 1 lần để ẩn/hiện thanh điều khiển mượt mà.
  - Chạm đúp bên trái màn hình: Tua lùi 10 giây (kèm rung haptic + toast).
  - Chạm đúp bên phải màn hình: Tua tới 10 giây.
  - Chạm đúp ở giữa màn hình: Tạm dừng / Tiếp tục phát.
- **Thanh tua thời gian (Seekbar) phóng to**: Chiều cao vùng chạm 42px, chấm tròn chỉ báo 12px giúp thao tác ngón tay kéo tua cực kỳ chính xác.
- **Thao tác tập nhanh**: Nút "Chọn tập" và "Tập trước / Tập sau" ngay trên giao diện điều khiển.
- **Xoay ngang màn hình chuẩn Native**:
  - Hỗ trợ xoay ngang mượt mà thông qua API điều hướng màn hình của hệ điều hành.
  - Khi xoay ngang có thanh Header đầy đủ: **Nút Back góc trái (`<`)**, tên phim, tập phim, nút chọn tập và nút thu nhỏ.
- **Cử chỉ vuốt mép Back Android**:
  - Chừa khoảng cách mép màn hình (< 28px) tránh bắt nhầm thao tác tua phim, hỗ trợ cử chỉ vuốt cạnh mép của Android 100%.
  - Cơ chế **"Vuốt lần nữa để thoát" (Double-back to exit)**: Ngăn chặn việc vô tình chạm mép làm tắt ứng dụng khi đang ở trang chủ; khi thoát sẽ thu nhỏ ứng dụng xuống nền thay vì đóng đột ngột.

---

## 🛠️ Hướng dẫn cài đặt & Build APK

### Yêu cầu môi trường
- **Node.js**: v18+ & **pnpm**: v9+
- **Rust toolchain**: `rustup target add aarch64-linux-android`
- **JDK**: Java 17+
- **Android SDK & NDK**: NDK r25+ (khuyên dùng NDK 27)

### 1. Cài đặt dependencies
```sh
pnpm install
```

### 2. Kiểm tra & Build Web Frontend
```sh
pnpm build
```

### 3. Đóng gói file APK cho Android (arm64-v8a)
```sh
pnpm tauri android build --apk -t aarch64 -d
```
File APK sau khi build nằm tại:
`src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`

### 4. Cài đặt trực tiếp qua ADB vào điện thoại
```sh
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

---

## ⚠️ Tuyên bố miễn trừ trách nhiệm (Disclaimer)

- Dự án này là bản fork phục vụ mục đích **học tập, nghiên cứu kỹ thuật và trải nghiệm cá nhân**.
- Ứng dụng không lưu trữ, không phân phối và không sở hữu bất kỳ nội dung âm thanh/video nào. Toàn bộ nội dung hiển thị đều lấy từ các nguồn công khai của bên thứ ba.
- Vui lòng tuân thủ luật pháp hiện hành và tôn trọng quyền tác giả của các bên liên quan.

---

## ⚖️ Giấy phép (License)

[PolyForm Noncommercial License 1.0.0](LICENSE) — **Chỉ dành cho mục đích phi thương mại**.
