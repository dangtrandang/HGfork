import { isIos, isLinux } from "../../shared/api/api";

export function mediaErrorMessage(error: MediaError | null): string {
  switch (error?.code) {
    case 2:
      return "Lỗi mạng, tải video thất bại, vui lòng kiểm tra kết nối";
    case 3:
      return "Giải mã video thất bại, vui lòng thử lại";
    case 4:
      return isLinux
        ? "Hệ thống thiếu codec H.264/AAC, vui lòng cài đặt gstreamer1.0-libav và gstreamer1.0-plugins-bad"
        : isIos
          ? "Tải video thất bại hoặc định dạng không được hỗ trợ"
          : "Định dạng video không được hỗ trợ";
    default:
      return "Tải video thất bại, vui lòng thử lại";
  }
}
