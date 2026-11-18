import { Button, SegmentedControl, Surface } from "../../shared/ui/ios/controls";
import { Loader } from "../../shared/ui/ios/effects";
import { useEffect, useRef, useState } from "react";
import { api, APP_VERSION, fmt, fmtTime, isMobile, platform } from "../../shared/api/api";
import type { Detail, Post } from "../../shared/api/types";
import { useStore } from "../../shared/model/store";
import { Avatar, Empty, Modal } from "../../shared/ui/ui";
import { MediaCard } from "../../shared/ui/cards";
import { useContentPreferences } from "../../shared/model/contentPreferences";
import { CollectionLink, CollectionLinks } from "../../shared/ui/CollectionLink";
import { IChevR, IClock, IHeart, ILogout, ISettings, IStar, IUser, IUserF } from "../../shared/ui/icons";

/* Account changes discard cached details synchronously, before another account can paint. */
export default function Profile({ wide, active = true }: { wide: boolean; active?: boolean }) {
  const { accountScope, lineEpoch } = useStore();
  return <ProfileContent key={`${accountScope}:${lineEpoch}`} wide={wide} active={active} />;
}

function ProfileContent({ wide, active }: { wide: boolean; active: boolean }) {
  const { blockReason } = useContentPreferences();
  const {
    user, setLoginOpen, logout, history, favs, postFavs, follows, setCollected, toast,
    clearHistory, push, accountSync, syncAccount,
  } = useStore();
  const [tab, setTab] = useState<"fav" | "history">("fav");
  const [favKind, setFavKind] = useState<"video" | "post">("video");
  const [videoCache, setVideoCache] = useState<Record<number, Detail>>({});
  const videoCacheRef = useRef(videoCache);
  videoCacheRef.current = videoCache;
  const [postCache, setPostCache] = useState<Record<number, Post>>({});
  const postCacheRef = useRef(postCache);
  postCacheRef.current = postCache;
  const [limits, setLimits] = useState({ favVideo: 12, favPost: 12, history: 12 });
  const [failedIds, setFailedIds] = useState<number[]>([]);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const logoutPending = useRef(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState("");
  const clearing = useRef(false);
  const [blockedPrompt, setBlockedPrompt] = useState<{
    id: number; kind: "video" | "post"; reason: string; removableFav: boolean;
  } | null>(null);
  const [removingBlocked, setRemovingBlocked] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const showingPosts = tab === "fav" && favKind === "post";
  const limitKey = tab === "history" ? "history" : showingPosts ? "favPost" : "favVideo";
  const ids = tab === "history" ? history.map((h) => h.id) : showingPosts ? postFavs : favs;
  const visibleIds = ids.slice(0, limits[limitKey]);
  const videoCards = !showingPosts ? visibleIds.map(id => videoCache[id]).filter((card): card is Detail => !!card) : [];
  const postCards = showingPosts ? visibleIds.map(id => postCache[id]).filter((card): card is Post => !!card) : [];
  const cardsCount = showingPosts ? postCards.length : videoCards.length;
  const failed = failedIds.filter(id => visibleIds.includes(id));
  const idsKey = visibleIds.join(",");
  const favoriteStateUnknown = tab === "fav" && !!user && !accountSync.favoritesKnown && favs.length === 0 && postFavs.length === 0;
  const favoriteSyncFailed = favoriteStateUnknown && !accountSync.busy;
  const syncingFavorites = favoriteStateUnknown && !favoriteSyncFailed;
  /** 观看记录里这条的进度（收藏页没有） */
  const progressOf = (id: number) => (tab === "history" ? history.find((h) => h.id === id) : undefined);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const missing = showingPosts
      ? visibleIds.filter(id => !postCacheRef.current[id])
      : visibleIds.filter(id => !videoCacheRef.current[id]);
    setFailedIds([]);
    if (!missing.length) { setLoading(false); return; }
    setLoading(true);
    if (showingPosts) {
      Promise.allSettled(missing.map(id => api.post(id)))
        .then(results => {
          if (!alive) return;
          const loaded: Record<number, Post> = {};
          const failedList: number[] = [];
          results.forEach((result, index) => {
            if (result.status === "fulfilled" && result.value) loaded[missing[index]] = result.value;
            else failedList.push(missing[index]);
          });
          setPostCache(previous => ({ ...previous, ...loaded }));
          setFailedIds(failedList);
          setLoading(false);
        });
    } else {
      Promise.allSettled(missing.map(id => api.video(id)))
        .then(results => {
          if (!alive) return;
          const loaded: Record<number, Detail> = {};
          const failedList: number[] = [];
          results.forEach((result, index) => {
            if (result.status === "fulfilled" && result.value) loaded[missing[index]] = result.value;
            else failedList.push(missing[index]);
          });
          setVideoCache(previous => ({ ...previous, ...loaded }));
          setFailedIds(failedList);
          setLoading(false);
        });
    }
    return () => { alive = false; };
  }, [active, idsKey, tab, showingPosts, reload]);

  const confirmLogout = async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setLogoutBusy(true);
    setLogoutError("");
    try {
      await logout();
      if (mounted.current) setLogoutOpen(false);
    } catch (error) {
      if (mounted.current) setLogoutError(error instanceof Error ? error.message : "退出失败，请重试");
    } finally {
      logoutPending.current = false;
      if (mounted.current) setLogoutBusy(false);
    }
  };

  const clearWatchHistory = async () => {
    if (clearing.current) return;
    clearing.current = true;
    setClearBusy(true); setClearError("");
    try {
      await clearHistory();
      if (mounted.current) setClearOpen(false);
    } catch (error) {
      if (mounted.current) setClearError(error instanceof Error ? error.message : "清空失败，观看记录已保留，请重试");
    } finally {
      clearing.current = false;
      if (mounted.current) setClearBusy(false);
    }
  };

  return (
    <div className="ios-page absolute inset-0 bg-bg flex flex-col">
      <div className="ios-page-heading shrink-0 flex items-center">
        <h1 className="ios-page-title text-on">Tủ phim</h1>
        {isMobile && (
          <Button onClick={() => push({ kind: "settings" })} aria-label="Cài đặt"
            className="ios-icon-button ml-auto">
            <ISettings size={17} strokeWidth={1.7} />
          </Button>
        )}
      </div>

      <div className="ios-page-body flex-1 scroll-y pt-2 pb-24">
        {/* 资料卡：已登录 / 未登录（本地模式） */}
        {user ? (
          <Surface className="ios-account-card flex items-center gap-3.5 a-rise">
            <Avatar size={56} name={user.nickname} hue={280} ring />
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-bold text-on truncate">{user.nickname}</div>
              <div className="text-[12px] text-mut mt-0.5">@{user.username} · ID {user.id}</div>
              <div className="flex gap-3 mt-2 text-[12px] text-mut">
                <span>Thích <b className="text-on">{fmt(user.counts?.like)}</b></span>
                <span>Lưu <b className="text-on">{fmt(user.counts?.collect)}</b></span>
                <span>Theo dõi <b className="text-on">{fmt(user.counts?.following)}</b></span>
              </div>
            </div>
            <Button onClick={() => { setLogoutError(""); setLogoutOpen(true); }}
              className="ios-icon-button" aria-label="Đăng xuất">
              <ILogout size={17} />
            </Button>
          </Surface>
        ) : (
          <Surface className="ios-account-card flex items-center gap-3.5 a-rise">
            <Avatar size={56} icon={<IUser size={26} />} hue={220} ring />
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-bold text-on">Tủ phim cá nhân</div>
              <div className="text-[12px] text-mut mt-0.5">Lưu trữ cục bộ trên thiết bị này</div>
              <div className="flex gap-3 mt-2 text-[12px] text-mut">
                <span>Đã lưu <b className="text-on">{favs.length + postFavs.length}</b></span>
                <span>Đã xem <b className="text-on">{history.length}</b></span>
                <span>Theo dõi <b className="text-on">{follows.length}</b></span>
              </div>
            </div>
          </Surface>
        )}

        {user && accountSync.error && <div role="alert" className="mt-3 rounded-(--r-sm) bg-s3 px-3.5 py-3 text-[13px] flex flex-wrap items-center justify-between gap-2">
          <p className="text-danger break-words flex-1 min-w-[200px]">{accountSync.error}</p>
          <Button disabled={accountSync.busy} onClick={() => { void syncAccount().catch(() => {}); }}
            className="inline-flex items-center min-h-9 -mx-2 px-2 text-primary font-semibold shrink-0">{accountSync.busy ? "Đang thử lại…" : "Thử lại đồng bộ"}</Button>
        </div>}

        {/* 关注 / 我的主页 */}
        <CollectionLinks className="ios-profile-links mt-4">
          <CollectionLink icon={<IHeart size={18} />} title="Đang theo dõi"
            onClick={() => push({ kind: "following" })} />
          {user && (
            <CollectionLink icon={<IUserF size={18} />} title="Trang của tôi"
              onClick={() => push({ kind: "user", id: user.id, name: user.nickname })} />
          )}
        </CollectionLinks>

        {/* 我的内容 */}
        <SegmentedControl className="mt-4" aria-label="Nội dung của tôi" activeIndex={tab === "fav" ? 0 : 1}>
          {([["fav", "Phim đã lưu"], ["history", "Lịch sử xem"]] as const).map(([k, l]) => (
            <Button aria-pressed={tab === k} key={k} onClick={() => setTab(k)}>{l}</Button>
          ))}
        </SegmentedControl>

        {tab === "fav" && !favoriteStateUnknown && (favs.length > 0 || postFavs.length > 0 || favKind === "post") && (
          <div className="mt-2.5 flex items-center gap-2" role="group" aria-label="Loại nội dung">
            <Button aria-pressed={favKind === "video"} onClick={() => setFavKind("video")} className="ios-filter-pill">
              Phim ngắn{favs.length ? ` ${favs.length}` : ""}
            </Button>
            <Button aria-pressed={favKind === "post"} onClick={() => setFavKind("post")} className="ios-filter-pill">
              Bài viết{postFavs.length ? ` ${postFavs.length}` : ""}
            </Button>
          </div>
        )}

        <div className="mt-3" aria-busy={loading || syncingFavorites}>
          {favoriteSyncFailed ? (
            <Empty icon={<IStar size={24} />} title="Trạng thái lưu chưa rõ"
              sub="Đồng bộ chưa hoàn tất, tạm thời chưa xác nhận được phim đã lưu." action="Thử lại"
              onAction={() => { void syncAccount().catch(() => {}); }} />
          ) : syncingFavorites ? (
            <FavoriteSyncState wide={wide} />
          ) : loading && !cardsCount ? (
            <div className="flex justify-center py-8"><Loader className="w-7 h-7 spinner" /></div>
          ) : showingPosts && postCards.length ? (
            <div className={`ios-media-grid ${wide ? "is-wide" : ""}`}>
              {postCards.map((p) => {
                const reason = blockReason(p.tags);
                return <MediaCard key={p.id} blockedReason={reason} title={p.title} cover={p.cover}
                  subtitle={p.tags?.slice(0, 2).join(" · ") || `${fmt(p.hot)} lượt xem`}
                  onOpen={() => {
                    if (reason) setBlockedPrompt({ id: p.id, kind: "post", reason, removableFav: true });
                    else push({ kind: "post", id: p.id });
                  }} />;
              })}
            </div>
          ) : !showingPosts && videoCards.length ? (
            <div className={`ios-media-grid ${wide ? "is-wide" : ""}`}>
              {videoCards.map((c) => {
                const progress = progressOf(c.id);
                const reason = blockReason(c.tags);
                return <MediaCard key={c.id} blockedReason={reason} title={c.title} cover={c.cover} score={c.score}
                  badge={c.is_finished ? "Đã trọn bộ" : `${c.episode_count} tập`}
                  subtitle={c.tags?.slice(0, 2).join(" · ")}
                  progress={progress ? (progress.t >= 1 ? `Tập ${progress.ep} · ${fmtTime(progress.t)}` : `Tập ${progress.ep}`) : undefined}
                  onOpen={() => {
                    if (reason) {
                      setBlockedPrompt({ id: c.id, kind: "video", reason, removableFav: tab === "fav" });
                      return;
                    }
                    const playableIds = ids.filter(id => {
                      const cached = videoCache[id];
                      return !cached || !blockReason(cached.tags);
                    });
                    const targetIndex = Math.max(0, playableIds.indexOf(c.id));
                    push({
                      kind: "feed", videoIds: playableIds, index: targetIndex,
                      title: tab === "fav" ? "Phim đã lưu" : "Lịch sử xem", startEp: progress?.ep, startTime: progress?.t,
                    });
                  }} />;
              })}
            </div>
          ) : failed.length ? (
            <Empty icon={tab === "fav" ? <IStar size={24} /> : <IClock size={24} />}
              title={tab === "fav" ? "Tải danh sách lưu thất bại" : "Tải lịch sử xem thất bại"}
              sub="Dữ liệu vẫn còn, bấm thử lại để tiếp tục." action="Thử lại" onAction={() => setReload(n => n + 1)} />
          ) : showingPosts ? (
            <Empty icon={<IStar size={24} />} title="Chưa có bài viết nào được lưu"
              sub="Bấm lưu ở trang bài viết để hiển thị tại đây"
              action="Xem bài viết" onAction={() => push({ kind: "posts" })} />
          ) : (
            <Empty icon={tab === "fav" ? <IStar size={24} /> : <IClock size={24} />}
              title={tab === "fav" ? "Chưa lưu bộ phim nào" : "Chưa có lịch sử xem"}
              sub={tab === "fav" ? "Bấm lưu ở trang xem phim để hiển thị tại đây" : "Phim bạn đã xem sẽ hiển thị tại đây"}
              action="Khám phá ngay" onAction={() => push({ kind: "ranks" })} />
          )}
          {cardsCount > 0 && failed.length > 0 && <div role="status" className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-mut">
            <span>{failed.length} mục tải thất bại, các mục còn lại vẫn xem bình thường.</span>
            <Button disabled={loading} onClick={() => setReload(n => n + 1)} className="px-3 text-primary">Thử lại</Button>
          </div>}
          {cardsCount > 0 && loading && <div className="flex justify-center py-3"><Loader label="Đang tải thêm…" /></div>}
          {ids.length > 0 && <p role="status" className="mt-3 text-[12px] text-mut">Đã hiển thị {cardsCount} / {ids.length} mục ({user ? "Tài khoản" : "Bộ nhớ máy"})</p>}
          {visibleIds.length < ids.length && <Button disabled={loading} onClick={() => setLimits(previous => ({ ...previous, [limitKey]: previous[limitKey] + 12 }))}
            className="mt-3 w-full rounded-(--r-ctl) bg-s3 text-[13px] text-on">Tải thêm</Button>}
          {tab === "history" && history.length > 0 && (
            <Button disabled={clearBusy} aria-busy={clearBusy} onClick={() => { setClearError(""); setClearOpen(true); }} className="mt-3 w-full h-9 rounded-(--r-ctl) bg-s3 text-[13px] text-mut pressable">{clearBusy ? "Đang xóa…" : "Xóa lịch sử xem"}</Button>
          )}
          {clearError && !clearOpen && <p role="alert" className="mt-2 text-[13px] text-danger">{clearError}</p>}
        </div>

        <div className="text-center text-[12px] text-dim mt-5">HGhubX {APP_VERSION} · {platform === "android" ? "Android" : platform === "ios" ? "iOS" : platform === "macos" ? "macOS" : platform === "linux" ? "Linux" : "Windows"}</div>
      </div>
      <Modal open={!!blockedPrompt} onClose={() => { if (!removingBlocked) setBlockedPrompt(null); }} label="Nội dung đã bị chặn">
        {blockedPrompt && (
          <div className="p-5">
            <h2 className="text-[18px] font-bold">Nội dung này khớp quy tắc chặn</h2>
            <p className="mt-2 text-[14px] text-mut break-words">{blockedPrompt.reason}. Bạn có thể chỉnh lại bộ lọc trong cài đặt{blockedPrompt.removableFav ? ", hoặc bỏ lưu nội dung này" : ""}.</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Button variant="secondary" disabled={removingBlocked} onClick={() => setBlockedPrompt(null)} className="flex-1">Đóng</Button>
              {blockedPrompt.removableFav && (
                <Button variant="danger" disabled={removingBlocked} onClick={() => {
                  setRemovingBlocked(true);
                  void setCollected(blockedPrompt.kind, blockedPrompt.id, false)
                    .then(() => { if (mounted.current) { setBlockedPrompt(null); toast("Đã bỏ lưu", "info"); } })
                    .catch(e => { if (mounted.current) toast(e instanceof Error ? e.message : "Thao tác thất bại", "info"); })
                    .finally(() => { if (mounted.current) setRemovingBlocked(false); });
                }} className="flex-1 rounded-(--r-ctl) px-3">
                  {removingBlocked ? "Đang xử lý…" : "Bỏ lưu"}
                </Button>
              )}
              <Button variant="primary" disabled={removingBlocked} onClick={() => {
                setBlockedPrompt(null);
                push({ kind: "settings", section: "Bộ lọc nội dung" });
              }} className="w-full rounded-(--r-ctl) min-h-11 px-4 font-semibold">
                Quản lý tag bị chặn
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={logoutOpen} onClose={() => { if (!logoutPending.current) setLogoutOpen(false); }} label="Đăng xuất">
        <div className="p-5">
          <h2 className="text-[18px] font-bold">Đăng xuất</h2>
          <p className="mt-2 text-[14px] text-mut">Bạn muốn đăng xuất khỏi tài khoản này? Dữ liệu và tiến độ xem trên máy vẫn sẽ được giữ lại.</p>
          {logoutError && <p role="alert" className="mt-3 text-[13px] text-danger">{logoutError}</p>}
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" disabled={logoutBusy} onClick={() => setLogoutOpen(false)} className="flex-1">Hủy</Button>
            <Button variant="danger" disabled={logoutBusy} onClick={() => void confirmLogout()} className="flex-1 rounded-(--r-ctl) px-3">
              {logoutBusy ? "Đang đăng xuất…" : "Xác nhận đăng xuất"}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal open={clearOpen} onClose={() => { if (!clearing.current) setClearOpen(false); }} label="Xóa lịch sử xem">
        <div className="p-5">
          <h2 className="text-[18px] font-bold">Xóa lịch sử xem</h2>
          <p className="mt-2 text-[14px] text-mut">Bạn có chắc muốn xóa toàn bộ lịch sử xem không? Hành động này không thể hoàn tác, danh sách phim đã lưu không bị ảnh hưởng.</p>
          {clearError && <p role="alert" className="mt-3 text-[13px] text-danger">{clearError}</p>}
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" disabled={clearBusy} onClick={() => setClearOpen(false)} className="flex-1">Hủy</Button>
            <Button variant="danger" disabled={clearBusy} aria-busy={clearBusy} onClick={() => void clearWatchHistory()} className="flex-1 rounded-(--r-ctl) px-3">
              {clearBusy ? "Đang xóa…" : "Xóa lịch sử"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FavoriteSyncState({ wide }: { wide: boolean }) {
  return <>
    <div role="status" aria-live="polite" aria-label="Đang đồng bộ danh sách lưu"
      className="mb-4 flex items-center justify-center gap-2.5 text-[13px] text-mut">
      <span aria-hidden="true" className="ios-loader spinner w-5 h-5" />
      <span>Đang tải danh sách lưu…</span>
    </div>
    <div aria-hidden="true" className={`ios-media-grid ${wide ? "is-wide" : ""}`}>
      {[0, 1, 2, 3].map(index => (
        <div key={index} className="min-w-0">
          <div className="aspect-[3/4] w-full rounded-[22px] bg-s3 animate-pulse" />
          <div className="mt-2.5 h-3.5 w-4/5 rounded-full bg-s3 animate-pulse" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-s2 animate-pulse" />
        </div>
      ))}
    </div>
  </>;
}
