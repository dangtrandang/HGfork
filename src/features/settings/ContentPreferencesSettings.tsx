import { useId, useState } from "react";
import { MAX_BLOCKED_TAGS, MAX_TAG_LENGTH, normalizeTag, useContentPreferences } from "../../shared/model/contentPreferences";
import { Button, Form, Input } from "../../shared/ui/ios/controls";
import { Modal, Toggle } from "../../shared/ui/ui";
import { IClose } from "../../shared/ui/icons";
import "../../styles/content-preferences.css";

export default function ContentPreferencesSettings() {
  const { preferences, storageError, blockTags, unblockTag, setPaused, setHideUntagged, clearBlockedTags, isTagBlocked } = useContentPreferences();
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [removal, setRemoval] = useState<{ tag: string } | { all: true } | null>(null);
  const errorId = useId();
  const tags = preferences.blockedTags.filter(tag => normalizeTag(tag).includes(normalizeTag(query)));
  const add = () => {
    const tag = value.trim().replace(/\s+/g, " ");
    setMessage("");
    if (!tag) { setError("Vui lòng nhập tên thẻ muốn chặn."); return; }
    if (tag.length > MAX_TAG_LENGTH) { setError(`Thẻ tối đa ${MAX_TAG_LENGTH} ký tự.`); return; }
    if (isTagBlocked(tag)) { setError("Thẻ này đã có trong danh sách chặn."); return; }
    if (preferences.blockedTags.length >= MAX_BLOCKED_TAGS) { setError(`Tối đa ${MAX_BLOCKED_TAGS} thẻ, vui lòng xóa bớt thẻ không cần thiết trước.`); return; }
    blockTags([tag]); setValue(""); setError(""); setMessage(`Đã chặn thẻ: ${tag}`);
  };
  const remove = () => {
    if (!removal) return;
    if ("all" in removal) { clearBlockedTags(); setMessage("Đã xóa tất cả thẻ bị chặn."); }
    else { unblockTag(removal.tag); setMessage(`Đã bỏ chặn: ${removal.tag}`); }
    setRemoval(null);
  };
  return <div className="content-preferences-settings">
    <div className="content-preference-state" data-paused={preferences.paused}>
      <span className="content-preference-state-dot" aria-hidden="true" />
      <div className="min-w-0 text-[12px] leading-relaxed text-mut"><p className="font-semibold text-[13px] text-on">{preferences.paused ? "Bộ lọc đang tạm dừng" : preferences.blockedTags.length || preferences.hideUntagged ? "Bộ lọc nội dung đang bật" : "Chưa có quy tắc chặn"}</p>
        <p className="mt-1">{preferences.paused ? "Các quy tắc đã lưu vẫn được giữ, có hiệu lực lại sau khi tiếp tục." : `Đã lưu ${preferences.blockedTags.length} / ${MAX_BLOCKED_TAGS} thẻ; chỉ áp dụng trên thiết bị này.`}</p>
      </div>
    </div>
    <div className="content-preference-switches">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0"><h3 className="text-[14px] font-semibold text-on">Tạm dừng bộ lọc</h3>
          <p className="text-[12px] text-mut mt-1">Tạm thời hiển thị tất cả nội dung, các thẻ đã chặn vẫn được lưu.</p></div>
        <Toggle desktop label="Tạm dừng bộ lọc" on={preferences.paused} onChange={setPaused} />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0"><h3 className="text-[14px] font-semibold text-on">Ẩn video không có thẻ</h3>
          <p className="text-[12px] text-mut mt-1">Mặc định hiển thị video không gắn thẻ; bật tùy chọn này để ẩn chúng.</p></div>
        <Toggle desktop label="Ẩn video không có thẻ" on={preferences.hideUntagged} onChange={setHideUntagged} />
      </div>
    </div>
    <Form className="space-y-2" onSubmit={event => { event.preventDefault(); add(); }}>
      <label className="block text-[13px] font-semibold text-on" htmlFor={`${errorId}-add`}>Thêm thẻ cần chặn</label>
      <div className="flex flex-wrap gap-2">
        <Input id={`${errorId}-add`} aria-label="Thêm thẻ cần chặn" value={value} onChange={event => { setValue(event.target.value); setError(""); }}
          placeholder="Nhập tên thẻ, ví dụ: Kinh dị" autoComplete="off" maxLength={MAX_TAG_LENGTH} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
          className="flex-1 w-full min-w-[160px]" />
        <Button type="submit" variant="primary" className="min-h-11 px-4 rounded-(--r-ctl)">Chặn thẻ</Button>
      </div>
      {error && <p id={errorId} role="alert" className="text-[13px] text-danger break-words">{error}</p>}
    </Form>
    <div className="content-preference-library">
      <div className="content-preference-library-heading">
        <h3 className="text-[13px] font-semibold text-on">Thẻ đã chặn · {preferences.blockedTags.length}</h3>
        <Button className="min-h-11 px-3 text-danger" disabled={!preferences.blockedTags.length} onClick={() => setRemoval({ all: true })}>Xóa tất cả thẻ</Button>
      </div>
      {preferences.blockedTags.length > 0 && <label className="block text-[13px] text-mut">
        <span className="block mb-2">Tìm trong thẻ đã chặn</span>
        <Input aria-label="Tìm trong thẻ đã chặn" placeholder="Tìm theo tên thẻ" value={query} onChange={event => setQuery(event.target.value)} className="w-full" />
      </label>}
      <ul aria-label="Thẻ đã chặn" className="content-preference-tag-list" tabIndex={tags.length ? 0 : undefined}>
        {tags.map(tag => <li key={normalizeTag(tag)}>
          <span className="text-[13px] text-on break-words min-w-0">{tag}</span>
          <Button aria-label={`Bỏ chặn ${tag}`} onClick={() => setRemoval({ tag })}><IClose size={16} /></Button>
        </li>)}
      </ul>
      {!tags.length && <p className="text-[13px] text-mut">{preferences.blockedTags.length ? "Không có thẻ phù hợp." : "Chưa có thẻ nào bị chặn. Bạn có thể bấm 'Không quan tâm' ở video để thêm thẻ."}</p>}
    </div>
    <p role="status" aria-live="polite" className="text-[13px] text-mut break-words">{message || (preferences.paused ? "Bộ lọc đang tạm dừng." : "Cài đặt có hiệu lực ngay trên thiết bị này.")}</p>
    {storageError && <div role="alert" className="rounded-(--r-md) bg-s3 p-3 text-[13px] text-danger">
      <p>{storageError}</p><Button className="mt-2 min-h-11 px-3 text-on" onClick={() => setPaused(preferences.paused)}>Thử lại</Button>
    </div>}
    <Modal open={!!removal} onClose={() => setRemoval(null)} label={removal && "all" in removal ? "Xóa tất cả thẻ chặn" : "Bỏ chặn thẻ"}>
      <div className="p-5">
        <h2 className="text-[18px] font-bold">{removal && "all" in removal ? "Xóa tất cả thẻ chặn" : "Bỏ chặn thẻ"}</h2>
        <p className="content-preference-confirm-copy mt-3 text-[14px] text-mut">{removal && "tag" in removal ? `Bỏ chặn thẻ "${removal.tag}"? Video gắn thẻ này sẽ xuất hiện lại.` : "Xóa toàn bộ các thẻ đang bị chặn?"}</p>
        <div className="mt-4 flex gap-3"><Button variant="secondary" className="flex-1 min-h-11" onClick={() => setRemoval(null)}>Giữ lại</Button>
          <Button variant="danger" className="flex-1 min-h-11" onClick={remove}>Xác nhận {removal && "all" in removal ? "xóa" : "bỏ chặn"}</Button></div>
      </div>
    </Modal>
  </div>;
}
