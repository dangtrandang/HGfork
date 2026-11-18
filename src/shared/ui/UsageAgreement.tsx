import { useEffect, useRef, useState } from "react";
import { addPluginListener, invoke } from "@tauri-apps/api/core";
import { platform } from "../api/api";
import { acceptUsageAgreement, USAGE_AGREEMENT_VERSION } from "../storage/usageAgreement";
import "../../styles/usage-agreement.css";
import type { RegisterStartupBack } from "../lib/back";

/** Shared verbatim text for first-run signing and read-only review in Settings. */
export function UsageAgreementText() {
  return <div className="hg-agreement-text select-text">
    <section className="hg-agreement-region"><h2>1. Tuyên bố mục đích và phi thương mại</h2><p><strong>Phần mềm này được phát triển hoàn toàn vì mục đích học tập, nghiên cứu kỹ thuật cá nhân và phi thương mại. Nghiêm cấm mọi hành vi sử dụng phần mềm để kinh doanh, buôn bán hoặc thu phí dưới mọi hình thức.</strong></p></section>
    <section><h2>2. Độ tuổi và tư cách sử dụng</h2><p>Bạn phải từ đủ 18 tuổi trở lên hoặc đủ độ tuổi theo quy định của pháp luật hiện hành tại khu vực của bạn. Bạn tự chịu trách nhiệm đảm bảo hành vi sử dụng của mình phù hợp với pháp luật và quy định sở tại.</p></section>
    <section><h2>3. Nội dung và bản quyền bên thứ ba</h2><p>Ứng dụng có thể hiển thị nội dung, hình ảnh, bài viết và đường dẫn phát video được cung cấp bởi các trang web và dịch vụ của bên thứ ba. Toàn bộ bản quyền nội dung thuộc về các chủ sở hữu hợp pháp tương ứng. Ứng dụng không lưu trữ hay phân phối trực tiếp bất kỳ tệp video nào.</p></section>
    <section><h2>4. Rủi ro sử dụng</h2><p>Nội dung và đường truyền mạng của bên thứ ba có thể thay đổi hoặc gián đoạn bất cứ lúc nào. Nhóm phát triển không đảm bảo tính chính xác, liên tục hay toàn vẹn của nội dung.</p></section>
    <section><h2>5. Giới hạn trách nhiệm</h2><p>Trong phạm vi tối đa được pháp luật cho phép, nhà phát triển không chịu trách nhiệm đối với bất kỳ thiệt hại trực tiếp hoặc gián tiếp nào phát sinh từ việc sử dụng ứng dụng.</p></section>
    <section><h2>6. Xác nhận đồng ý</h2><p>Việc đánh dấu vào ô đồng ý và nhấn "Đồng ý và tiếp tục" thể hiện bạn đã đọc, hiểu và chấp thuận toàn bộ điều khoản sử dụng này. Bản ghi xác nhận chỉ được lưu trữ cục bộ trên thiết bị của bạn.</p></section>
  </div>;
}

export default function UsageAgreement({ onAccept, registerBack, active = true }: { onAccept: () => void; registerBack?: RegisterStartupBack; active?: boolean }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState("");
  const [exiting, setExiting] = useState(false);

  useEffect(() => { if (active) titleRef.current?.focus({ preventScroll: true }); }, [active, declined]);
  useEffect(() => {
    if (!active || registerBack) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); setDeclined(true); }
      if (event.key !== "Tab") return;
      const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? [])];
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, registerBack]);
  useEffect(() => {
    if (!active) return;
    if (registerBack) return registerBack(() => setDeclined(true));
    if (platform !== "android") return;
    let disposed = false;
    let listener: { unregister: () => Promise<void> } | undefined;
    void addPluginListener("app", "back-button", () => setDeclined(true)).then(handle => {
      if (disposed) void handle.unregister().catch(() => {});
      else listener = handle;
    }).catch(() => {});
    return () => { disposed = true; void listener?.unregister().catch(() => {}); };
  }, [active, registerBack]);

  const accept = () => {
    if (!confirmed) return;
    setError("");
    try {
      acceptUsageAgreement();
      onAccept();
    } catch {
      setError("Không thể lưu xác nhận, vui lòng kiểm tra quyền lưu trữ của ứng dụng.");
    }
  };

  const exit = () => {
    setExiting(true);
    void invoke("plugin:app|exit", { code: 0 }).catch(() => setError("Ứng dụng chưa vào giao diện chính, bạn có thể đóng cửa sổ trực tiếp.")).finally(() => setExiting(false));
  };

  return <div className="hg-agreement" inert={!active} data-tv-modal={active ? "agreement" : undefined} role="dialog" aria-modal="true" aria-labelledby="hg-agreement-title" aria-describedby="hg-agreement-summary">
    <div ref={panelRef} className="hg-agreement-card">
      <header className="hg-agreement-header">
        <h1 ref={titleRef} tabIndex={-1} id="hg-agreement-title">{declined ? "Ứng dụng chưa được kích hoạt" : "Điều khoản sử dụng & Miễn trừ trách nhiệm"}</h1>
        <p id="hg-agreement-summary" className="hg-agreement-summary">{declined ? "Bạn chưa đồng ý điều khoản, nội dung sẽ không được tải. Bạn có thể thoát ứng dụng hoặc quay lại đọc điều khoản." : "Vui lòng đọc các điều khoản bên dưới trước khi tiếp tục. Xác nhận chỉ lưu trên thiết bị của bạn."}</p>
      </header>
      {!declined && <div className="hg-agreement-scroll" data-tv-focus="agreement-text" data-tv-scroll data-tv-initial tabIndex={0} aria-label="Nội dung điều khoản">
        <UsageAgreementText />
      </div>}
      <footer className="hg-agreement-footer">
        {error && <p className="hg-agreement-error" role="alert">{error}</p>}
        {!declined && <label className="hg-agreement-check"><input data-tv-focus="agreement-checkbox" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
          <span>Tôi đã đọc, hiểu và đồng ý với các điều khoản sử dụng trên.</span>
        </label>}
        <div className="hg-agreement-actions">
          {declined ? <>
            {platform !== "ios" && <button data-tv-focus="agreement-exit" type="button" className="hg-agreement-exit" onClick={exit} disabled={exiting}>Thoát ứng dụng</button>}
            <button data-tv-focus="agreement-read" type="button" className="hg-agreement-accept" onClick={() => { setDeclined(false); setConfirmed(false); setError(""); }}>Quay lại đọc</button>
          </> : <>
            <button data-tv-focus="agreement-decline" type="button" className="hg-agreement-exit" onClick={() => { setDeclined(true); setConfirmed(false); }}>Từ chối</button>
            <button data-tv-focus="agreement-accept" type="button" className="hg-agreement-accept" disabled={!confirmed} onClick={accept}>Đồng ý và tiếp tục</button>
          </>}
        </div>
        <p className="hg-agreement-footnote">Phiên bản điều khoản {USAGE_AGREEMENT_VERSION}</p>
      </footer>
    </div>
  </div>;
}
