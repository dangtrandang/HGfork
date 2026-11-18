import { useEffect, useRef, useState } from "react";
import { api, isMobile, type ProxyMode, type ProxyProbe, type ProxyState } from "../../shared/api/api";
import { useStore } from "../../shared/model/store";
import { IChevR, IClose, ILink } from "../../shared/ui/icons";
import { Button, Input, SegmentedControl } from "../../shared/ui/ios/controls";
import { Modal, Sheet } from "../../shared/ui/ui";

const MODES: ProxyMode[] = ["system", "custom", "off"];
const LABELS: Record<ProxyMode, string> = { system: "Theo hệ thống", custom: "Tùy chỉnh", off: "Trực tiếp" };
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : typeof error === "string" ? error : fallback;

function summary(state: ProxyState | null, failed: boolean): string {
  if (!state) return failed ? "Đọc thất bại, mở lại để thử" : "Đang đọc…";
  if (state.mode === "off") return "Kết nối trực tiếp · Bỏ qua proxy hệ thống";
  if (state.effective) return `${LABELS[state.mode]} · ${state.effective}`;
  return state.mode === "custom" ? "Proxy tùy chỉnh" : state.system_proxy || state.env_proxy ? "Theo hệ thống · Đã phát hiện proxy" : "Theo hệ thống · Không có proxy";
}

/** Uses the same shared controls as the line picker and keeps proxy credentials out of summaries/logs. */
export default function ProxySettings() {
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ProxyState | null>(null);
  const [mode, setMode] = useState<ProxyMode>("system");
  const [url, setUrl] = useState("");
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "test" | "save">("");
  const [probe, setProbe] = useState<ProxyProbe | null>(null);
  const request = useRef(0);
  const probeGeneration = useRef(0);
  const pending = useRef(false);

  const read = async (fillDraft: boolean) => {
    const generation = ++request.current;
    setLoading(true);
    setLoadError("");
    if (fillDraft) setReady(false);
    try {
      const next = await api.proxyState();
      if (generation !== request.current) return;
      setState(next);
      if (fillDraft) {
        setMode(next.mode);
        setUrl(next.url || "");
        setReady(true);
      }
    } catch (failure) {
      if (generation === request.current) setLoadError(message(failure, "Đọc cài đặt proxy thất bại, vui lòng thử lại"));
    } finally {
      if (generation === request.current) setLoading(false);
    }
  };

  useEffect(() => {
    void read(false);
    const invalidateProbe = () => { probeGeneration.current++; setProbe(null); };
    window.addEventListener("hg:line-changed", invalidateProbe);
    return () => { request.current++; probeGeneration.current++; window.removeEventListener("hg:line-changed", invalidateProbe); };
  }, []);

  const openForm = () => {
    setOpen(true);
    setVisible(false);
    setProbe(null);
    setError("");
    void read(true);
  };
  const close = () => {
    if (pending.current) return;
    request.current++;
    setOpen(false);
    setVisible(false);
  };
  const change = () => { probeGeneration.current++; setProbe(null); setError(""); };
  const run = async (action: "test" | "save") => {
    if (pending.current || !ready) return;
    if (mode === "custom" && !url.trim()) {
      setError("Vui lòng nhập địa chỉ proxy");
      return;
    }
    pending.current = true;
    setBusy(action);
    setError("");
    setProbe(null);
    const generation = ++probeGeneration.current;
    try {
      if (action === "test") {
        const result = await api.proxyTest(mode, mode === "custom" ? url.trim() : "");
        if (generation === probeGeneration.current) setProbe(result);
        else setError("Đường truyền đã thay đổi, vui lòng kiểm tra lại");
      } else {
        const next = await api.proxySet(mode, mode === "custom" ? url.trim() : "");
        setState(next);
        setMode(next.mode);
        setUrl(next.url || "");
        setOpen(false);
        setVisible(false);
        window.dispatchEvent(new Event("hg:proxy-changed"));
        toast(`Đã lưu cài đặt proxy · ${LABELS[next.mode]}`, "ok");
      }
    } catch (failure) {
      setError(message(failure, action === "test" ? "Kiểm tra proxy thất bại" : "Lưu cài đặt proxy thất bại"));
    } finally {
      pending.current = false;
      setBusy("");
    }
  };

  const disabled = !ready || loading || !!busy;
  const body = <div className="flex flex-col min-h-0" style={{ maxHeight: isMobile ? "74dvh" : "min(78dvh, 640px)" }}>
    <div className="shrink-0 flex items-center gap-3 px-4 pt-3 pb-2">
      <span className="ios-setting-icon" aria-hidden="true"><ILink size={16} /></span>
      <h2 className="flex-1 text-[16px] font-bold text-on">Cấu hình Proxy</h2>
      <Button aria-label="Đóng cài đặt proxy" disabled={!!busy} onClick={close} className="min-h-12 min-w-12 flex items-center justify-center"><IClose size={18} /></Button>
    </div>
    <form className="scroll-y px-4 pb-5 space-y-4" onSubmit={(event) => { event.preventDefault(); void run("save"); }}>
      <p className="text-[13px] text-mut leading-relaxed">Chỉ áp dụng cho HGhubX. Sau khi kiểm tra kết nối có thể lưu làm cấu hình mạng của ứng dụng.</p>
      {loadError && <div role="alert" className="text-[13px] text-danger">
        {loadError}
        <Button onClick={() => { void read(true); }} disabled={loading} className="min-h-12 px-3 ml-1 text-primary">Đọc lại</Button>
      </div>}
      {loading && <p role="status" className="text-[13px] text-mut">Đang đọc cài đặt proxy…</p>}
      <SegmentedControl aria-label="Chế độ Proxy" activeIndex={MODES.indexOf(mode)}>
        {MODES.map(value => <Button key={value} disabled={disabled} aria-pressed={mode === value}
          className="min-h-12" onClick={() => { setMode(value); change(); }}>{LABELS[value]}</Button>)}
      </SegmentedControl>
      {mode === "custom" && <div>
        <label htmlFor="proxy-address" className="block text-[14px] text-on mb-2">Địa chỉ proxy</label>
        <Input id="proxy-address" aria-label="Địa chỉ proxy" type={visible ? "text" : "password"} value={url}
          disabled={disabled} autoComplete="off" autoCapitalize="none" spellCheck={false}
          placeholder="http://127.0.0.1:7890" aria-invalid={!!error} aria-describedby={`proxy-address-hint${error ? " proxy-form-error" : ""}`}
          className="w-full min-h-12 min-w-0 text-[14px]" onChange={event => { setUrl(event.target.value); change(); }} />
        <div className="flex items-start gap-2 mt-1">
          <p id="proxy-address-hint" className="flex-1 text-[12px] text-mut leading-relaxed pt-2">Hỗ trợ HTTP, HTTPS, SOCKS. 127.0.0.1 trên điện thoại trỏ đến chính thiết bị; nếu dùng proxy máy tính hãy điền IP mạng LAN của máy tính.</p>
          <Button onClick={() => setVisible(value => !value)} aria-pressed={visible} className="min-h-12 shrink-0 px-2 text-[12px] text-primary">{visible ? "Ẩn địa chỉ" : "Hiện địa chỉ"}</Button>
        </div>
      </div>}
      {mode !== "custom" && <p className="text-[13px] text-mut leading-relaxed">{mode === "system" ? "Sử dụng proxy hệ thống và biến môi trường; địa chỉ tùy chỉnh đã lưu vẫn được giữ nguyên." : "Kết nối trực tiếp tới đường truyền, bỏ qua proxy hệ thống; địa chỉ tùy chỉnh đã lưu vẫn được giữ nguyên."}</p>}
      {error && <p id="proxy-form-error" role="alert" className="text-[13px] text-danger break-words">{error}</p>}
      <div role="status" aria-live="polite" className={`text-[13px] break-words ${probe && !probe.ok ? "text-danger" : "text-mut"}`}>
        {busy === "test" ? "Đang kiểm tra kết nối…" : probe ? probe.ok ? `Hoạt động tốt · ${probe.ms}ms` : `Kết nối thất bại · ${probe.error || (probe.status ? `HTTP ${probe.status}` : "Vui lòng kiểm tra địa chỉ và mạng")}` : "Kiểm tra kết nối thử nghiệm, cần bấm Lưu để áp dụng."}
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" disabled={disabled} onClick={() => { void run("test"); }} className="min-h-12 flex-1 px-3">{busy === "test" ? "Đang kiểm tra…" : "Kiểm tra kết nối"}</Button>
        <Button variant="primary" type="submit" disabled={disabled} className="min-h-12 flex-1 px-3">{busy === "save" ? "Đang lưu…" : "Lưu cấu hình"}</Button>
      </div>
    </form>
  </div>;

  return <>
    <Button onClick={openForm} className="ios-settings-row text-left pressable">
      <span className="ios-setting-icon" aria-hidden="true"><ILink size={16} /></span>
      <div className="flex-1 min-w-0"><div className="text-[14px] text-on">Cấu hình Proxy</div><div className="text-[12px] text-mut truncate">{summary(state, !!loadError)}</div></div>
      <IChevR size={15} className="text-mut" />
    </Button>
    {isMobile ? <Sheet open={open} onClose={close} label="Cấu hình Proxy">{body}</Sheet> : <Modal open={open} onClose={close} label="Cấu hình Proxy" width={460}>{body}</Modal>}
  </>;
}
