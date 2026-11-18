import { Button, SegmentedControl, Surface, TextArea } from "../../shared/ui/ios/controls";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, APP_VERSION, hostOf, isMobile, logLine, platform, type UpdateInfo } from "../../shared/api/api";
import { useStore } from "../../shared/model/store";
import { Modal, Toggle } from "../../shared/ui/ui";
import LinePicker from "./LinePicker";
import ProxySettings from "./ProxySettings";
import ContentPreferencesSettings from "./ContentPreferencesSettings";
import SettingsSection from "./SettingsSection";
import { UsageAgreementText } from "../../shared/ui/UsageAgreement";
import { USAGE_AGREEMENT_VERSION } from "../../shared/storage/usageAgreement";
import { autoLineEnabled, setAutoLine } from "../../shared/network/autoLine";
import { copyPlaybackLog, initPlaybackLog, setPlaybackLog, tracePlayback, usePlaybackLog } from "../../shared/diagnostics/playbackDiagnostics";
import { formatNetDiag, shortVerdict } from "../../shared/diagnostics/netDiagReport";
import { copyText } from "../../shared/lib/clipboard";
import { Loader } from "../../shared/ui/ios/effects";
import { IBack, IBoltF, IBroom, IChevR, ICompress, IHeart, IInfo, ILink, ILockF, IMoon, IRefresh, ISun, IVolMute } from "../../shared/ui/icons";

const SETTING_GROUPS = ["Giao diện", "Trình phát", "Bộ lọc nội dung", "Dữ liệu cục bộ", "Mạng & Đường truyền", "Chẩn đoán", "Thông tin khác"] as const;
type SettingGroup = typeof SETTING_GROUPS[number];

/* 独立设置页：线路 / 外观 / 播放 / 本地数据 / 清理缓存 / 网络诊断 / 关于
   入口：Windows 侧栏「设置」、Android「我的」右上角齿轮 */
export default function Settings({ onBack, initialSection }: { onBack: () => void; wide: boolean; initialSection?: string }) {
  const { theme, themePreference, setTheme, favs, history, muteOnStartup, setMuteOnStartup, preferHevc, setPreferHevc, fsIdleSecs, setFsIdleSecs, strictSecurity, strictSecurityReady, securityPending, cliRelaxed, setStrictSecurity, toast } = useStore();
  const [about, setAbout] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [lineBase, setLineBase] = useState("");
  const [autoLineOn, setAutoLineOn] = useState(autoLineEnabled);
  const clearBusy = useRef(false);
  const [clearError, setClearError] = useState("");
  const [lineError, setLineError] = useState("");
  const [clearing, setClearing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  /** 应用内更新进行到哪一步（空串=没在更新） */
  const [updating, setUpdating] = useState("");
  const playbackLog = usePlaybackLog();
  const [copyingLog, setCopyingLog] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagReport, setDiagReport] = useState<string | null>(null);
  const [copyingReport, setCopyingReport] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<SettingGroup>>(() => new Set());
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!initialSection) return;
    const resolvedSection = initialSection === "内容偏好" ? "Bộ lọc nội dung" : initialSection;
    const frame = requestAnimationFrame(() => {
      const target = contentRef.current?.querySelector<HTMLElement>(`#settings-${resolvedSection}`);
      target?.scrollIntoView({ block: "start", behavior: "instant" });
      target?.querySelector<HTMLElement>(".ios-settings-trigger")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialSection]);
  const section = (title: SettingGroup, children: ReactNode) => <SettingsSection title={title}
    open={openGroups.has(title)} onToggle={() => setOpenGroups(previous => {
      const next = new Set(previous);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    })}>{children}</SettingsSection>;

  useEffect(() => { void initPlaybackLog(); }, []);

  const readLine = () => { api.lineState().then((state) => { setLineBase(state.base); setLineError(""); }).catch(() => setLineError("Tải đường truyền thất bại, bấm để chọn lại")); };
  useEffect(() => {
    const sync = () => { readLine(); setAutoLineOn(autoLineEnabled()); };
    sync();
    window.addEventListener("hg:line-changed", sync);
    window.addEventListener("hg:auto-line-changed", sync);
    return () => {
      window.removeEventListener("hg:line-changed", sync);
      window.removeEventListener("hg:auto-line-changed", sync);
    };
  }, []);

  const checkUpdate = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const info = await api.checkUpdate();
      if (info.has_update) setUpdate(info);
      else toast(`Đã là phiên bản mới nhất v${info.current}`, "ok");
    } catch (e) {
      toast((e as Error).message || "Kiểm tra cập nhật thất bại", "info");
    } finally {
      setChecking(false);
    }
  };

  const doUpdate = async () => {
    if (!update) return;
    setUpdating("Đang mở…");
    try {
      await api.openUrl(update.url);
    } catch (e) {
      await copyText(update.url)
        .then(() => toast("Đã sao chép link tải, có thể dán vào trình duyệt", "ok"))
        .catch(() => toast((e as Error).message || "Mở link thất bại", "info"));
    } finally {
      setUpdating("");
    }
  };

  return (
    <div className="ios-page ios-settings-page absolute inset-0 bg-bg flex flex-col">
      <div data-settings-header className="ios-settings-header shrink-0">
        <div className="ios-settings-column">
          <Button onClick={onBack} aria-label="Quay lại" className="ios-icon-button"><IBack size={20} /></Button>
        </div>
      </div>
      <div data-settings-scroll className="ios-page-body flex-1 min-h-0 scroll-y">
        <div ref={contentRef} className="ios-settings-column ios-settings-content">
          <div className="pt-1 pb-4">
            <h1 className="ios-page-title text-on">Cài đặt</h1>
          </div>
          {section("Giao diện", <>
            <div className="ios-appearance-row items-center">
              <span className="ios-setting-icon">{themePreference === "system" ? <IRefresh size={16} /> : theme === "dark" ? <IMoon size={16} /> : <ISun size={16} />}</span>
              <div className="flex-1">
                <div className="text-[14px] text-on">Giao diện</div>
                <div className="text-[12px] text-mut">{themePreference === "system" ? `Theo hệ thống (hiện đang ${theme === "dark" ? "Tối" : "Sáng"})` : theme === "dark" ? "Chủ đề Tối" : "Chủ đề Sáng"}</div>
              </div>
              <SegmentedControl className="ios-appearance-picker" aria-label="Chế độ giao diện" activeIndex={(["system", "light", "dark"] as const).indexOf(themePreference)}>
                {([['system', 'Hệ thống'], ['light', 'Sáng'], ['dark', 'Tối']] as const).map(([value, label]) => (
                  <Button key={value} type="button" aria-pressed={themePreference === value}
                    onClick={() => setTheme(value)}>
                    {label}
                  </Button>
                ))}
              </SegmentedControl>
            </div>
          </>)}

          {section("Trình phát", <>
            <div className="ios-settings-row">
              <span className="ios-setting-icon"><IVolMute size={16} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-on">Tắt tiếng khi khởi động</div>
                <div className="text-[12px] text-mut">Mặc định bật, luôn tắt âm thanh khi mở app. Bật để tránh phát âm thanh bất ngờ.</div>
              </div>
              <Toggle desktop on={muteOnStartup} onChange={setMuteOnStartup} label="Tắt tiếng khi khởi động" />
            </div>
            <div className="ios-settings-row">
              <span className="ios-setting-icon"><IBoltF size={16} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-on">Ưu tiên chất lượng cao HEVC</div>
                <div className="text-[12px] text-mut">Tự động dùng luồng HEVC nếu có, nếu không sẽ dùng luồng tiêu chuẩn</div>
              </div>
              <Toggle desktop on={preferHevc} onChange={setPreferHevc} label="Ưu tiên chất lượng cao" />
            </div>
            {isMobile && <div className="ios-settings-row flex-wrap">
              <span className="ios-setting-icon"><ICompress size={16} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-on">Tự ẩn thanh điều khiển khi rảnh tay</div>
                <div className="text-[12px] text-mut">Khi xem video, thanh điều khiển sẽ tự ẩn sau số giây chọn bên dưới</div>
              </div>
              <SegmentedControl className="w-full" aria-label="Tự ẩn thanh điều khiển" activeIndex={[0, 3, 5, 10].indexOf(fsIdleSecs)}>
                {([[0, "Tắt"], [3, "3s"], [5, "5s"], [10, "10s"]] as const).map(([secs, label]) => (
                  <Button key={secs} type="button" aria-pressed={fsIdleSecs === secs} onClick={() => setFsIdleSecs(secs)}>{label}</Button>
                ))}
              </SegmentedControl>
            </div>}
          </>)}

          {section("Bộ lọc nội dung", <ContentPreferencesSettings />)}

          {section("Dữ liệu cục bộ", <>
            <div className="ios-settings-row">
              <span className="ios-setting-icon"><IHeart size={16} /></span>
              <div className="flex-1">
                <div className="text-[14px] text-on">Tủ phim máy này</div>
                <div className="text-[12px] text-mut">{favs.length} phim đã lưu · {history.length} lịch sử xem</div>
              </div>
            </div>
            <Button onClick={() => { setClearError(""); setClearOpen(true); }} className="ios-settings-row text-left pressable">
              <span className="ios-setting-icon"><IBroom size={16} /></span>
              <div className="flex-1">
                <div className="text-[14px] text-on">Dọn dẹp bộ nhớ đệm (Cache)</div>
              </div>
              <IChevR size={15} className="text-mut" />
            </Button>
          </>)}

          {section("Mạng & Đường truyền", <>
            <ProxySettings />
            <Button onClick={() => setLineOpen(true)} className="ios-settings-row text-left pressable">
              <span className="ios-setting-icon"><IBoltF size={16} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-on">Đường truyền phát</div>
                <div className="text-[12px] text-mut truncate">{lineError || (lineBase ? hostOf(lineBase) : "Đang kiểm tra…")}</div>
              </div>
              <IChevR size={15} className="text-mut" />
            </Button>
            <div className="ios-settings-row">
              <span className="ios-setting-icon"><IRefresh size={15} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-on">Tự động chọn đường truyền</div>
                <div className="text-[12px] text-mut">Tự động chuyển sang mirror nhanh nhất khi đường truyền chính chậm hoặc lỗi</div>
              </div>
              <Toggle desktop label="Tự động chọn đường truyền" on={autoLineOn} onChange={(on) => {
                void setAutoLine(on).catch(() => toast("Không thể thay đổi tự động chọn đường truyền", "info"));
                setAutoLineOn(on);
                toast(on ? "Đã bật tự động chọn đường truyền" : "Đã tắt tự động chọn đường truyền", "info");
              }} />
            </div>
            <div className="ios-settings-row">
              <span className="ios-setting-icon"><ILockF size={15} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-on">Chế độ bảo mật nghiêm ngặt</div>
                <div className="text-[12px] text-mut">
                  {cliRelaxed
                    ? "Đang chạy ở chế độ tương thích (--no-strict)"
                    : "Mặc định bật: Chặn chuyển hướng và bảo vệ mạng cục bộ"}
                </div>
              </div>
              <Toggle desktop
                on={strictSecurity}
                disabled={!strictSecurityReady || securityPending}
                onChange={(on) => {
                  void setStrictSecurity(on).then(() => {
                    toast(on ? "Đã bật chế độ bảo mật nghiêm ngặt" : "Đã chuyển sang chế độ tương thích", "info");
                  }).catch(() => toast("Lưu cài đặt bảo mật thất bại", "info"));
                }}
                label="Chế độ bảo mật nghiêm ngặt"
              />
            </div>
            <Button disabled={diagnosing} onClick={async () => {
              setDiagnosing(true);
              try {
                const diag = await api.netDiag();
                logLine(`[net_diag] ${JSON.stringify(diag)}`);
                const http = (diag.http ?? {}) as { ms?: number; status?: number };
                const dns = (diag.dns ?? {}) as { count?: number; has_fake_ip?: boolean };
                const env = (diag.env ?? {}) as Record<string, unknown>;
                tracePlayback("net.diag", {
                  verdict: String(diag.verdict ?? ""),
                  host: hostOf(String(diag.host ?? "")), http_status: http.status ?? null, http_ms: http.ms ?? null,
                  dns_count: dns.count ?? null, fake_ip: dns.has_fake_ip ?? null,
                  proxy: Object.values(env).some(Boolean), strict: strictSecurity,
                });
                const report = formatNetDiag(diag);
                try {
                  await copyText(report);
                  toast(`Đã chẩn đoán xong · ${shortVerdict(diag)}`, "ok");
                } catch {
                  setDiagReport(report);
                  toast("Chẩn đoán hoàn tất, có thể xem báo cáo bên dưới", "info");
                }
              } catch (e) {
                const detail = e instanceof Error ? e.message : typeof e === "string" ? e : "Vui lòng thử lại sau";
                toast(`Chẩn đoán mạng thất bại: ${detail}`, "info");
              } finally {
                setDiagnosing(false);
              }
            }} className="ios-settings-row text-left pressable disabled:opacity-60">
              <span className="ios-setting-icon"><ILink size={16} /></span>
              <div className="flex-1">
                <div className="text-[14px] text-on">{diagnosing ? "Đang chẩn đoán…" : "Chẩn đoán mạng"}</div>
                <div className="text-[12px] text-mut">Kiểm tra DNS / TCP / Proxy / Tốc độ kết nối tới server</div>
              </div>
              <IChevR size={15} className="text-mut" />
            </Button>
          </>)}

          {section("Chẩn đoán", <>
            <div className="ios-settings-row">
              <span className="ios-setting-icon"><IInfo size={16} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-on">Nhật ký phát video</div>
                <div className="text-[12px] text-mut">Ghi lại thông tin lỗi và hiệu suất stream video để xử lý sự cố</div>
                {playbackLog.error && <div role="alert" className="text-[12px] text-danger">{playbackLog.error}</div>}
              </div>
              <Toggle desktop label="Nhật ký phát video" on={playbackLog.enabled} disabled={!playbackLog.ready || playbackLog.pending}
                onChange={(on) => { void setPlaybackLog(on).then(() => toast(on ? "Đã bật nhật ký chẩn đoán" : "Đã tắt nhật ký chẩn đoán", "ok")).catch(() => toast("Không thể lưu cài đặt nhật ký", "info")); }} />
            </div>
            <Button disabled={!playbackLog.ready || playbackLog.pending || copyingLog} onClick={async () => {
              setCopyingLog(true);
              try { await copyPlaybackLog(); toast("Đã sao chép nhật ký chẩn đoán", "ok"); }
              catch (e) { toast((e as Error).message || "Sao chép nhật ký thất bại", "info"); }
              finally { setCopyingLog(false); }
            }} className="ios-settings-row text-left pressable disabled:opacity-60">
              <span className="ios-setting-icon"><ILink size={16} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-on">{copyingLog ? "Đang sao chép…" : "Sao chép nhật ký chẩn đoán"}</div>
                <div className="text-[12px] text-mut">Bao gồm phiên bản, nền tảng, đường truyền và mã lỗi video</div>
              </div>
              <IChevR size={15} className="text-mut" />
            </Button>
            {playbackLog.path && <details className="ios-settings-log-path text-[12px] text-mut"><summary className="cursor-pointer py-3">Vị trí lưu nhật ký</summary><p className="break-all select-text pb-3">{playbackLog.path}</p></details>}
          </>)}

          {section("Thông tin khác", <>
            <Button onClick={checkUpdate} disabled={checking} className="ios-settings-row text-left pressable disabled:opacity-60">
              <span className="ios-setting-icon">{checking ? <Loader label="Đang kiểm tra cập nhật" className="size-4" /> : <IRefresh size={16} />}</span>
              <div className="flex-1">
                <div className="text-[14px] text-on">Kiểm tra bản cập nhật</div>
                <div className="text-[12px] text-mut">{checking ? "Đang kiểm tra…" : `Phiên bản hiện tại v${APP_VERSION}`}</div>
              </div>
              <IChevR size={15} className="text-mut" />
            </Button>
            <Button onClick={() => setAgreementOpen(true)} className="ios-settings-row text-left pressable">
              <span className="ios-setting-icon"><ILockF size={16} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-on">Điều khoản sử dụng & Miễn trừ</div>
                <div className="text-[12px] text-mut">Xem chi tiết các điều khoản sử dụng ứng dụng</div>
              </div>
              <IChevR size={15} className="text-mut" />
            </Button>
            <Button onClick={() => setAbout(true)} className="ios-settings-row text-left pressable">
              <span className="ios-setting-icon"><IInfo size={16} /></span>
              <div className="flex-1">
                <div className="text-[14px] text-on">Thông tin ứng dụng</div>
                <div className="text-[12px] text-mut">Phiên bản {APP_VERSION} · Bản phi thương mại</div>
              </div>
              <IChevR size={15} className="text-mut" />
            </Button>
          </>)}

          <div className="text-center text-[12px] text-dim mt-5">HGhubX {APP_VERSION} · {platform === "android" ? "Android" : platform === "ios" ? "iOS" : platform === "macos" ? "macOS" : platform === "linux" ? "Linux" : "Windows"}</div>
        </div>
      </div>

      <LinePicker open={lineOpen} onClose={() => { setLineOpen(false); readLine(); }} />

      <Modal label="Điều khoản sử dụng" open={agreementOpen} onClose={() => setAgreementOpen(false)} width={680}>
        <div className="flex flex-col min-h-0 max-h-[78dvh]">
          <div className="shrink-0 flex items-center justify-between gap-3 p-4 border-b border-s3">
            <h2 className="text-[17px] font-bold text-on">Điều khoản sử dụng</h2>
            <Button className="min-h-11 px-3 shrink-0" onClick={() => setAgreementOpen(false)}>Đóng</Button>
          </div>
          <div className="flex-1 min-h-0 scroll-y p-4 select-text" tabIndex={0} aria-label="Nội dung điều khoản">
            <p className="text-[12px] text-mut mb-4">Phiên bản điều khoản {USAGE_AGREEMENT_VERSION}</p>
            <UsageAgreementText />
          </div>
        </div>
      </Modal>

      <Modal label="Báo cáo chẩn đoán mạng" open={diagReport !== null} onClose={() => setDiagReport(null)} width={520}>
        <div className="p-5">
          <h2 className="text-[15px] font-bold text-on">Báo cáo chẩn đoán mạng</h2>
          <p className="text-[13px] text-mut mt-2">Chẩn đoán đã hoàn tất. Bạn có thể sao chép kết quả bên dưới để gửi phân tích.</p>
          <TextArea readOnly aria-label="Báo cáo chẩn đoán mạng" value={diagReport ?? ""}
            className="w-full h-64 mt-3 p-3 rounded-(--r-sm) bg-s3 text-[12px] text-on resize-none" />
          <div className="flex gap-2 mt-4">
            <Button onClick={() => setDiagReport(null)} className="flex-1 h-9 rounded-(--r-ctl) bg-s3 text-[14px] text-on pressable">Đóng</Button>
            <Button disabled={copyingReport} onClick={async () => {
              if (diagReport === null) return;
              setCopyingReport(true);
              try { await copyText(diagReport); toast("Đã sao chép báo cáo", "ok"); setDiagReport(null); }
              catch { toast("Sao chép thất bại, hãy bôi đen và sao chép thủ công", "info"); }
              finally { setCopyingReport(false); }
            }} className="flex-1 h-9 rounded-(--r-ctl) brand-grad text-[14px] pressable disabled:opacity-60">{copyingReport ? "Đang sao chép…" : "Sao chép báo cáo"}</Button>
          </div>
        </div>
      </Modal>

      <Modal label="Về HGhubX" open={about} onClose={() => setAbout(false)} width={392}>
        <div className="p-5">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-(--r-sm) brand-grad glow-neon flex items-center justify-center text-on-primary text-[17px] font-black">H</span>
            <div>
              <div className="text-[16px] font-bold text-on leading-tight">HGhubX</div>
              <div className="text-[12px] text-mut mt-0.5">Phiên bản v{APP_VERSION}</div>
            </div>
          </div>

          <p className="text-[13px] text-on/70 leading-relaxed mt-4">
            Ứng dụng đa nền tảng xây dựng trên Rust + Tauri 2 + React, tối ưu cho Android và PC.
          </p>

          <Surface className="mt-4 rounded-(--r-sm) bg-s3/60 p-3 text-[12px] text-mut leading-relaxed">
            Chỉ dành cho mục đích nghiên cứu học tập cá nhân. Toàn bộ nội dung âm thanh và video thuộc quyền sở hữu của các bên thứ ba.
          </Surface>

          <Button onClick={() => setAbout(false)} className="mt-4 w-full h-9 rounded-(--r-ctl) bg-s3 text-[14px] text-on pressable">Đã hiểu</Button>
        </div>
      </Modal>

      <Modal label="Dọn dẹp bộ nhớ đệm" open={clearOpen} onClose={() => { if (!clearBusy.current) setClearOpen(false); }} width={330}>
        <div className="p-5">
          <div className="text-[15px] font-bold text-on">Dọn dẹp bộ nhớ đệm</div>
          <p className="text-[13px] text-mut leading-relaxed mt-2">
            Xóa ảnh bìa, phân đoạn video tạm thời trong máy để giải phóng dung lượng. Danh sách phim đã lưu và lịch sử xem vẫn được bảo toàn.
          </p>
          {clearError && <p role="alert" className="text-[13px] text-danger mt-3">{clearError}</p>}
          <div className="flex gap-2 mt-5">
            <Button disabled={clearing} onClick={() => setClearOpen(false)} className="flex-1 h-9 rounded-(--r-ctl) bg-s3 text-[14px] text-on/80 pressable">Hủy</Button>
            <Button disabled={clearing} onClick={async () => {
              if (clearBusy.current) return;
              clearBusy.current = true;
              setClearing(true); setClearError("");
              try {
                const cleared = await api.clearCache();
                setClearOpen(false);
                toast(cleared.webCache ? "Đã dọn dẹp bộ nhớ đệm thành công" : "Đã dọn dẹp bộ nhớ đệm", "ok");
              } catch (error) {
                setClearError(error instanceof Error ? error.message : String(error || "Dọn dẹp thất bại"));
              } finally { clearBusy.current = false; setClearing(false); }
            }} className="flex-1 h-9 rounded-(--r-ctl) bg-primary text-[14px] font-semibold text-on-primary pressable disabled:opacity-60">
              {clearing ? "Đang dọn dẹp…" : "Xác nhận dọn dẹp"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal label="Có bản cập nhật mới" open={!!update?.has_update} onClose={() => setUpdate(null)} width={392}>
        <div className="p-5">
          <div className="text-[16px] font-bold text-on">Có bản cập nhật mới</div>
          <p className="text-[12px] text-mut mt-1.5">
            v{update?.current} → <b className="text-on">v{update?.latest}</b>
            {update?.published_at ? ` · ${update.published_at.slice(0, 10)}` : ""}
          </p>
          {!!update?.notes && (
            <Surface className="mt-3 max-h-[180px] scroll-y rounded-(--r-sm) bg-s2 p-3 text-[12px] text-mut whitespace-pre-wrap leading-relaxed">{update.notes}</Surface>
          )}
          <div className="flex gap-2 mt-4">
            <Button onClick={() => setUpdate(null)} disabled={!!updating}
              className="flex-1 h-9 rounded-(--r-ctl) bg-s3 text-[14px] text-on/80 pressable disabled:opacity-60">Để sau</Button>
            <Button onClick={() => void doUpdate()} disabled={!!updating}
              className="flex-1 h-9 rounded-(--r-ctl) bg-primary text-[14px] font-semibold text-on-primary pressable disabled:opacity-60">
              {updating || "Tải về"}
            </Button>
          </div>
          <details className="text-[12px] text-mut mt-2.5"><summary className="py-3 cursor-pointer">Link tải trực tiếp</summary><p className="break-all select-text">{update?.url}</p></details>
        </div>
      </Modal>
    </div>
  );
}
