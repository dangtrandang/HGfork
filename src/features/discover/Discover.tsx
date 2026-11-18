import { Button, Surface } from "../../shared/ui/ios/controls";
import { Loader } from "../../shared/ui/ios/effects";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api, fmt } from "../../shared/api/api";
import type { Post, TopicCard, TopicDetail, VideoCard } from "../../shared/api/types";
import { useStore } from "../../shared/model/store";
import { MAX_BLOCKED_TAGS, MAX_TAG_LENGTH, useContentPreferences } from "../../shared/model/contentPreferences";
import { Masonry, MediaCard } from "../../shared/ui/cards";
import { FilteredContent } from "../../shared/ui/FilteredContent";
import { InplaceSearch } from "../search/InplaceSearch";
import { Empty, Img } from "../../shared/ui/ui";
import { IBack, IFireF, ILayers, IRefresh, ISearch, ITag } from "../../shared/ui/icons";

const TopicIcon = ILayers;
const TagIcon = ITag;

/** Retain the last good result on refresh, but never expose a previous route's data. */
function useDiscoveryData<T>(baseKey: string, request: () => Promise<T>) {
  const { lineEpoch } = useStore();
  const key = `${lineEpoch}:${baseKey}`;
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: string }>({ key, data: null, loading: true, error: "" });
  const sequence = useRef(0);
  const busy = useRef(false);
  const requestRef = useRef(request);
  requestRef.current = request;
  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const token = ++sequence.current;
    setState(previous => ({ key, data: previous.key === key ? previous.data : null, loading: true, error: "" }));
    try {
      const data = await requestRef.current();
      if (token === sequence.current) setState({ key, data, loading: false, error: "" });
    } catch (error) {
      if (token === sequence.current) setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : "Tải thất bại, vui lòng thử lại" }));
    } finally {
      if (token === sequence.current) busy.current = false;
    }
  }, [key]);
  useEffect(() => {
    busy.current = false;
    void load();
    return () => { sequence.current++; busy.current = false; };
  }, [load]);
  return { data: state.key === key ? state.data : null, loading: state.key !== key || state.loading, err: state.key === key ? state.error : "", load };
}

function RefreshStatus({ loading, error, onRetry }: { loading: boolean; error: string; onRetry: () => void }) {
  if (!loading && !error) return null;
  return <div role="status" className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-mut">
    {loading ? <><Loader className="w-4 h-4" />Đang làm mới, vẫn giữ nội dung hiện tại…</>
      : <><span className="min-w-0 break-words">Làm mới thất bại, vẫn giữ nội dung hiện tại. {error}</span><Button onClick={onRetry} className="px-3 text-primary">Thử lại</Button></>}
  </div>;
}

/* ================= 专题列表页 ================= */
export function TopicsPage({ onBack, wide }: { onBack: () => void; wide: boolean }) {
  const { push } = useStore();
  const [searching, setSearching] = useState(false);
  const { data, loading, err, load } = useDiscoveryData("topics", api.topics);
  const items = data?.items ?? [];

  return (
    <div className="ios-page absolute inset-0 bg-bg flex flex-col">
      <div className="ios-subpage-header shrink-0" style={{ paddingTop: "var(--sat, 0px)" }}>
        <div className="ios-subpage-bar">
          <Button aria-label="Quay lại" onClick={onBack} className="ios-nav-btn"><IBack size={20} /></Button>
          <span className="w-9 h-9 rounded-[12px] bg-pc text-on-pc flex items-center justify-center shrink-0"><TopicIcon size={18} /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold text-on leading-tight">Chuyên đề</h1>
            <div className="text-[12px] text-mut leading-tight mt-0.5">{loading && !items.length ? "Đang tải…" : `${items.length} chuyên đề`}</div>
          </div>
          <Button onClick={() => setSearching(true)} aria-label="Tìm kiếm" className="ios-nav-btn"><ISearch size={18} /></Button>
          <Button aria-label="Làm mới" disabled={loading} aria-busy={loading} onClick={() => void load()} className="ios-nav-btn">{loading ? <Loader className="w-4 h-4" /> : <IRefresh size={18} />}</Button>
        </div>
      </div>

      <div className="flex-1 scroll-y pt-3.5 pb-8" aria-busy={loading}>
        {items.length > 0 && <RefreshStatus loading={loading} error={err} onRetry={() => void load()} />}
        {loading && !items.length ? (
          <div className="flex justify-center py-12"><Loader className="w-8 h-8 spinner" /></div>
        ) : err && !items.length ? (
          <Empty icon={<TopicIcon size={26} />} title="Tải chuyên đề thất bại" sub={err} action="Thử lại" onAction={load} />
        ) : items.length ? (
          <div className={`grid gap-3.5 ${wide ? "grid-cols-3 xl:grid-cols-4" : "grid-cols-2"}`}>
            {items.map((t) => (
              <Button key={t.id} onClick={() => push({ kind: "topic", slug: t.slug, name: t.title })}
                title={t.title} className="ios-topic-card min-w-0 text-left pressable a-rise">
                <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                  <Img src={t.cover} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <span className="absolute bottom-2 left-2.5 inline-flex items-center h-6 px-2.5 rounded-full bg-black/62 border border-white/15 backdrop-blur-sm text-[11.5px] font-semibold text-white/95 tabular-nums">
                    {t.video_count ?? 0} bộ
                  </span>
                </div>
                <div className="px-3 py-2.5">
                  <div className="text-[14px] font-semibold text-on clamp-1 leading-snug">{t.title}</div>
                </div>
              </Button>
            ))}
          </div>
        ) : (
          <Empty icon={<TopicIcon size={26} />} title="Chưa có chuyên đề" />
        )}
        {wide && <div className="h-2" />}
      </div>
      {searching && <InplaceSearch kind="video" wide={wide} onClose={() => setSearching(false)} onOpenVideo={(v, list, kw) => push({ kind: "feed", videoIds: list.map((x) => x.id), index: list.findIndex((x) => x.id === v.id), title: kw ? `Tìm kiếm · ${kw}` : "Tìm kiếm · Chuyên đề" })} />}
    </div>
  );
}

/* ================= 专题详情页 ================= */
export function TopicPage({ slug, name, onBack, wide }: { slug: string; name: string; onBack: () => void; wide: boolean }) {
  const { push, lineEpoch } = useStore();
  const { preferences } = useContentPreferences();
  const filtering = !preferences.paused && (preferences.blockedTags.length > 0 || preferences.hideUntagged);
  const [searching, setSearching] = useState(false);
  const [introExpanded, setIntroExpanded] = useState(false);
  const introId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{
    topic: TopicDetail["topic"] | null;
    related: TopicCard[];
    videos: VideoCard[];
    page: number;
    pages: number;
    total: number;
    loading: boolean;
    loadingMore: boolean;
    error: string;
  }>({ topic: null, related: [], videos: [], page: 0, pages: 1, total: 0, loading: true, loadingMore: false, error: "" });
  const sequence = useRef(0);
  const busy = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(async (page = 1, reset = false) => {
    if (busy.current) return;
    busy.current = true;
    const token = reset ? ++sequence.current : sequence.current;
    setState(previous => reset
      ? { ...previous, topic: null, related: [], videos: [], page: 0, pages: 1, total: 0, loading: true, loadingMore: false, error: "" }
      : { ...previous, loading: false, loadingMore: true, error: "" });
    try {
      const data = await api.topic(slug, page, 20);
      if (token !== sequence.current) return;
      const incoming = data?.videos?.items ?? [];
      setState(previous => {
        const seen = new Set(reset ? [] : previous.videos.map(video => video.id));
        const videos = [...(reset ? [] : previous.videos), ...incoming.filter(video => !seen.has(video.id))];
        return {
          topic: data?.topic ?? previous.topic,
          related: data?.related ?? previous.related,
          videos,
          page: data?.videos?.pagination?.page ?? page,
          pages: Math.max(1, data?.videos?.pagination?.pages ?? page),
          total: Math.max(videos.length, data?.videos?.pagination?.total ?? videos.length),
          loading: false,
          loadingMore: false,
          error: "",
        };
      });
    } catch (error) {
      if (token === sequence.current) {
        setState(previous => ({
          ...previous,
          loading: false,
          loadingMore: false,
          error: error instanceof Error ? error.message : "Tải thất bại, vui lòng thử lại",
        }));
      }
    } finally {
      if (token === sequence.current) busy.current = false;
    }
  }, [slug, lineEpoch]);

  const loadMore = () => {
    const current = stateRef.current;
    if (current.loading || current.loadingMore || current.page >= current.pages) return;
    void load(current.page + 1);
  };

  useEffect(() => {
    busy.current = false;
    setIntroExpanded(false);
    setSearching(false);
    void load(1, true);
    return () => { sequence.current++; busy.current = false; };
  }, [load]);

  const { topic, related, videos, page, pages, total, loading, loadingMore, error } = state;
  const hasMore = page < pages;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || filtering || loading || loadingMore || error || !hasMore || !scrollRef.current) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { root: scrollRef.current, rootMargin: "260px" });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtering, loading, loadingMore, error, hasMore, page, pages]);

  return (
    <div className="ios-page absolute inset-0 bg-bg flex flex-col">
      <div className="ios-subpage-header shrink-0" style={{ paddingTop: "var(--sat, 0px)" }}>
        <div className="ios-subpage-bar">
          <Button aria-label="Quay lại" onClick={onBack} className="ios-nav-btn"><IBack size={20} /></Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold text-on leading-tight truncate" title={topic?.title || name}>{topic?.title || name}</h1>
            <div className="text-[12px] text-mut leading-tight mt-0.5">{loading ? "Đang tải…" : `Đã tải ${videos.length} / ${total} bộ`}</div>
          </div>
          <Button onClick={() => setSearching(true)} aria-label="Tìm phim" className="ios-nav-btn"><ISearch size={18} /></Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 scroll-y pt-3.5 pb-8" aria-busy={loading}>
        {topic?.intro && <section className="mb-4" aria-label="Giới thiệu chuyên đề">
          <p id={introId} className={`text-[13px] text-mut leading-relaxed break-words ${introExpanded ? "" : "clamp-3"}`}>{topic.intro}</p>
          <Button aria-expanded={introExpanded} aria-controls={introId} onClick={() => setIntroExpanded(value => !value)} className="mt-1 inline-flex items-center min-h-9 px-0 text-[12px] font-medium text-primary">{introExpanded ? "Thu gọn" : "Xem thêm giới thiệu"}</Button>
        </section>}
        {related.length > 0 && (
          <div className="mb-5">
            <h2 className="text-[13.5px] font-bold text-on/90 mb-2.5">Chuyên đề liên quan</h2>
            <div className="scroll-x flex gap-3 snap-x">
              {related.map((r) => (
                <Button key={r.id} onClick={() => push({ kind: "topic", slug: r.slug, name: r.title })}
                  className="ios-topic-card w-[156px] shrink-0 text-left snap-start pressable">
                  <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                    <Img src={r.cover} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                    <span className="absolute bottom-1.5 left-2 inline-flex items-center h-5 px-2 rounded-full bg-black/62 border border-white/15 text-[11px] font-semibold text-white/95 tabular-nums">{r.video_count ?? 0} bộ</span>
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="text-[12.5px] font-semibold text-on clamp-1 leading-snug">{r.title}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        {loading && !videos.length ? (
          <div className="flex justify-center py-12"><Loader className="w-8 h-8 spinner" /></div>
        ) : error && !videos.length ? (
          <Empty icon={<TopicIcon size={26} />} title="Tải thất bại" sub={error} action="Thử lại" onAction={() => void load(1, true)} />
        ) : videos.length ? (
          <Masonry videos={videos} scopeKey={slug} wide={wide} onOpen={(v, visible) => push({ kind: "feed", videoIds: visible.map((x) => x.id), index: visible.findIndex((x) => x.id === v.id), title: topic?.title || name })} />
        ) : (
          <Empty icon={<TopicIcon size={26} />} title="Chưa có nội dung" />
        )}
        {error && videos.length > 0 && <div role="alert" className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[13px] text-danger">
          <span className="min-w-0 break-words">Tải thêm thất bại: {error}</span>
          <Button disabled={loadingMore} onClick={loadMore} className="px-3 text-primary">Thử lại</Button>
        </div>}
        {loadingMore && <div className="flex justify-center py-3"><Loader label="Đang tải thêm phim chuyên đề" className="w-6 h-6" /></div>}
        {!loading && !loadingMore && hasMore && <Button onClick={loadMore} className="mt-3 w-full rounded-(--r-ctl) bg-s3 py-2.5 text-[13px] text-on pressable">
          Tải thêm ({videos.length}/{total})
        </Button>}
        {!loading && !loadingMore && !hasMore && videos.length > 0 && <div className="py-3 text-center text-[12px] text-dim">Đã tải toàn bộ {total} bộ</div>}
        <div ref={sentinelRef} className="h-6" aria-hidden="true" />
        {wide && <div className="h-2" />}
      </div>
      {searching && <InplaceSearch kind="video" wide={wide} onClose={() => setSearching(false)} onOpenVideo={(v, list, kw) => push({ kind: "feed", videoIds: list.map((x) => x.id), index: list.findIndex((x) => x.id === v.id), title: kw ? `Tìm kiếm · ${kw}` : "Tìm kiếm" })} />}
    </div>
  );
}

/* ================= 标签聚合页 ================= */
export function TagsPage({ onBack, wide }: { onBack: () => void; wide: boolean }) {
  const { push } = useStore();
  const [searching, setSearching] = useState(false);
  const { data, loading, err, load } = useDiscoveryData("tags", api.tags);
  const groups = data?.categories ?? [];

  const totalTags = groups.reduce((sum, g) => sum + (g.tags?.length || 0), 0);

  return (
    <div className="ios-page absolute inset-0 bg-bg flex flex-col">
      <div className="ios-subpage-header shrink-0" style={{ paddingTop: "var(--sat, 0px)" }}>
        <div className="ios-subpage-bar">
          <Button aria-label="Quay lại" onClick={onBack} className="ios-nav-btn"><IBack size={20} /></Button>
          <span className="w-9 h-9 rounded-[12px] bg-pc text-on-pc flex items-center justify-center shrink-0"><TagIcon size={18} /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold text-on leading-tight">Thẻ tag</h1>
            <div className="text-[12px] text-mut leading-tight mt-0.5">{loading && !groups.length ? "Đang tải…" : `${totalTags} thẻ tag · ${groups.length} nhóm`}</div>
          </div>
          <Button onClick={() => setSearching(true)} aria-label="Tìm phim" className="ios-nav-btn"><ISearch size={18} /></Button>
          <Button aria-label="Làm mới" disabled={loading} aria-busy={loading} onClick={() => void load()} className="ios-nav-btn">{loading ? <Loader className="w-4 h-4" /> : <IRefresh size={18} />}</Button>
        </div>
      </div>

      <div className="flex-1 scroll-y pt-3.5 pb-8" aria-busy={loading}>
        {groups.length > 0 && <RefreshStatus loading={loading} error={err} onRetry={() => void load()} />}
        {loading && !groups.length ? (
          <div className="flex justify-center py-12"><Loader className="w-8 h-8 spinner" /></div>
        ) : err && !groups.length ? (
          <Empty icon={<TagIcon size={26} />} title="Tải thẻ thất bại" sub={err} action="Thử lại" onAction={load} />
        ) : groups.length ? (
          <div className={`grid gap-3.5 ${wide ? "grid-cols-2" : "grid-cols-1"}`}>{groups.map((g) => (
            <Surface key={g.name} className="rounded-[22px] bg-s1 p-4 a-rise">
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <h2 className="text-[14.5px] font-bold text-on">{g.name}</h2>
                <span className="text-[12px] text-dim tabular-nums">{g.tags?.length || 0} thẻ</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {g.tags.map((t) => (
                  <Button key={t.id} onClick={() => push({ kind: "tag", tag: t.name, name: t.name })}
                    className="ios-filter-pill max-w-full min-w-0 gap-1.5 text-left">
                    <span className="min-w-0 whitespace-normal break-words text-on/95">{t.name}</span>
                    {!!t.hot_score && <span aria-label={`Độ hot ${fmt(t.hot_score)}`} className="shrink-0 inline-flex items-center gap-0.5 text-[11.5px] font-medium text-dim tabular-nums"><IFireF size={11} className="text-primary/85" />{fmt(t.hot_score)}</span>}
                  </Button>
                ))}
              </div>
            </Surface>
          ))}</div>
        ) : (
          <Empty icon={<TagIcon size={26} />} title="Chưa có thẻ tag" />
        )}
        {wide && <div className="h-2" />}
      </div>
      {searching && <InplaceSearch kind="video" wide={wide} onClose={() => setSearching(false)} onOpenVideo={(v, list, kw) => push({ kind: "feed", videoIds: list.map((x) => x.id), index: list.findIndex((x) => x.id === v.id), title: kw ? `Tìm kiếm · ${kw}` : "Tìm kiếm · Thẻ tag" })} />}
    </div>
  );
}

/* ================= 标签视频页 ================= */
export function TagPage({ tag, name, onBack, wide }: { tag: string; name: string; onBack: () => void; wide: boolean }) {
  const { push, lineEpoch } = useStore();
  const { preferences, storageError, isTagBlocked, blockTags, unblockTag } = useContentPreferences();
  const filtering = !preferences.paused && (preferences.blockedTags.length > 0 || preferences.hideUntagged);
  const tagBlocked = isTagBlocked(name);
  const cannotAdd = !name.trim() || name.trim().length > MAX_TAG_LENGTH || preferences.blockedTags.length >= MAX_BLOCKED_TAGS;
  const [searching, setSearching] = useState(false);
  const [videos, setVideos] = useState<VideoCard[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [videoPage, setVideoPage] = useState(0);
  const [postPage, setPostPage] = useState(0);
  const [videoPages, setVideoPages] = useState(1);
  const [postPages, setPostPages] = useState(1);
  const [videoTotal, setVideoTotal] = useState(0);
  const [postTotal, setPostTotal] = useState(0);
  const [videoLoading, setVideoLoading] = useState(true);
  const [postLoading, setPostLoading] = useState(true);
  const [videoErr, setVideoErr] = useState("");
  const [postErr, setPostErr] = useState("");
  const [loadedVideoTag, setLoadedVideoTag] = useState("");
  const [loadedPostTag, setLoadedPostTag] = useState("");
  const busy = useRef({ video: false, post: false });
  const sequence = useRef({ video: 0, post: 0 });
  const videoSentinel = useRef<HTMLDivElement>(null);
  const postSentinel = useRef<HTMLDivElement>(null);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const currentVideos = loadedVideoTag === tag;
  const currentPosts = loadedPostTag === tag;
  const visibleVideos = currentVideos ? videos : [];
  const visiblePosts = currentPosts ? posts : [];

  const load = useCallback(async (kind: "video" | "post", next: number, reset = false) => {
    if (busy.current[kind] && !reset) return;
    busy.current[kind] = true;
    const token = ++sequence.current[kind];
    if (kind === "video") { setVideoLoading(true); setVideoErr(""); }
    else { setPostLoading(true); setPostErr(""); }
    try {
      if (kind === "video") {
        const result = await api.tagVideos(tag, next, 20);
        if (sequence.current.video !== token) return;
        setVideos(previous => {
          const base = reset ? [] : previous;
          const seen = new Set(base.map(item => item.id));
          return [...base, ...(result?.items ?? []).filter(item => !seen.has(item.id))];
        });
        setLoadedVideoTag(tag); setVideoPage(next); setVideoPages(result?.pagination?.pages || next); setVideoTotal(result?.pagination?.total || 0);
      } else {
        const result = await api.postTag(name, next, 20);
        if (sequence.current.post !== token) return;
        setPosts(previous => {
          const base = reset ? [] : previous;
          const seen = new Set(base.map(item => item.id));
          return [...base, ...(result?.items ?? []).filter(item => !seen.has(item.id))];
        });
        setLoadedPostTag(tag); setPostPage(next); setPostPages(result?.pagination?.pages || next); setPostTotal(result?.pagination?.total || 0);
      }
    } catch (error) {
      if (sequence.current[kind] === token) {
        const message = error instanceof Error ? error.message : "Tải thất bại, vui lòng thử lại";
        if (kind === "video") setVideoErr(message); else setPostErr(message);
      }
    } finally {
      if (sequence.current[kind] === token) {
        busy.current[kind] = false;
        if (kind === "video") setVideoLoading(false); else setPostLoading(false);
      }
    }
  }, [tag, name]);
  useEffect(() => {
    sequence.current.video++; sequence.current.post++;
    busy.current.video = false; busy.current.post = false;
    setVideos([]); setPosts([]); setLoadedVideoTag(""); setLoadedPostTag("");
    setVideoPage(0); setPostPage(0); setVideoPages(1); setPostPages(1); setVideoTotal(0); setPostTotal(0);
    setVideoLoading(true); setPostLoading(true); setVideoErr(""); setPostErr(""); setSearching(false);
    if (scrollContainer.current) scrollContainer.current.scrollTop = 0;
    void load("video", 1, true);
    void load("post", 1, true);
    return () => { sequence.current.video++; sequence.current.post++; busy.current.video = false; busy.current.post = false; };
  }, [load, tag, lineEpoch]);
  useEffect(() => {
    const el = videoSentinel.current;
    if (!el || filtering || videoErr || videoLoading || videoPage >= videoPages) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) void load("video", videoPage + 1);
    }, { root: scrollContainer.current, rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [load, videoPage, videoPages, videoErr, videoLoading, filtering]);
  useEffect(() => {
    const el = postSentinel.current;
    if (!el || filtering || postErr || postLoading || postPage >= postPages) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) void load("post", postPage + 1);
    }, { root: scrollContainer.current, rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [load, postPage, postPages, postErr, postLoading, filtering]);

  return (
    <div className="ios-page absolute inset-0 bg-bg flex flex-col">
      <div className="ios-subpage-header shrink-0" style={{ paddingTop: "var(--sat, 0px)" }}>
        <div className="ios-subpage-bar">
          <Button aria-label="Quay lại" onClick={onBack} className="ios-nav-btn"><IBack size={20} /></Button>
          <span className="w-9 h-9 rounded-[12px] bg-pc text-on-pc flex items-center justify-center shrink-0"><TagIcon size={18} /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold text-on leading-tight truncate" title={name}>{name}</h1>
            <div role="status" className="text-[12px] text-mut leading-tight mt-0.5 tabular-nums">Phim ngắn {currentVideos ? videoTotal : 0} · Bài viết {currentPosts ? postTotal : 0}</div>
          </div>
          <Button onClick={() => setSearching(true)} aria-label="Tìm phim" className="ios-nav-btn"><ISearch size={18} /></Button>
        </div>
      </div>
      <div ref={scrollContainer} className="flex-1 scroll-y pt-3.5 pb-8" aria-busy={videoLoading || postLoading || !currentVideos || !currentPosts}>
        <Surface className="mb-4 rounded-[20px] px-3.5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="min-w-0 text-[13px] text-mut">{tagBlocked ? "Thẻ này đã được thêm vào danh sách chặn" : "Tùy chọn lọc thẻ tag"}</p>
            <div className="flex items-center gap-1.5 ml-auto">
              <Button className="inline-flex items-center min-h-10 px-2.5 text-[12.5px] font-medium text-mut hover:text-on"
                onClick={() => push({ kind: "settings", section: "Bộ lọc nội dung" })}>Quản lý thẻ chặn</Button>
              <Button style={{ minBlockSize: 40 }} disabled={!tagBlocked && cannotAdd} aria-pressed={tagBlocked}
                onClick={() => tagBlocked ? unblockTag(name) : blockTags([name])}
                className={`inline-flex items-center justify-center min-h-10 rounded-(--r-ctl) px-3.5 text-[13px] font-semibold ${tagBlocked ? "bg-pc text-on-pc" : "bg-s3 text-primary"}`}>{tagBlocked ? "Bỏ chặn thẻ này" : "Chặn thẻ này"}</Button>
            </div>
          </div>
          {preferences.paused && <p role="status" className="mt-2 text-[12px] text-mut">Tính năng chặn đang tạm dừng, thẻ mới vẫn sẽ lưu và có hiệu lực khi bật lại.</p>}
          {!tagBlocked && cannotAdd && <p role="status" className="mt-2 text-[12px] text-mut">{name.trim().length > MAX_TAG_LENGTH ? "Tên thẻ quá dài, vui lòng quản lý trong cài đặt." : `Đã đạt tối đa ${MAX_BLOCKED_TAGS} thẻ chặn.`}</p>}
          {storageError && <p role="alert" className="mt-2 text-[13px] text-danger">{storageError}</p>}
        </Surface>
        {videoLoading && !visibleVideos.length && <div className="flex justify-center py-8"><Loader className="w-7 h-7 spinner" /></div>}
        {videoErr && !visibleVideos.length && <Empty icon={<TagIcon size={26} />} title="Tải phim thất bại" sub={videoErr} action="Thử lại" onAction={() => void load("video", 1, true)} />}
        {visibleVideos.length > 0 && <section className="mb-6">
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[15px] font-bold text-on">Phim ngắn</h2>
            <span className="text-[12px] text-mut tabular-nums">{videoTotal}</span>
          </div>
          <Masonry videos={visibleVideos} scopeKey={`tag-video:${tag}`} wide={wide} onOpen={(v, visible) => push({ kind: "feed", videoIds: visible.map(x => x.id), index: visible.findIndex(x => x.id === v.id), title: name })} />
        </section>}
        <div ref={videoSentinel} className="h-2" />
        {videoErr && visibleVideos.length > 0 && <div role="status" className="flex flex-wrap items-center justify-center gap-2 py-2 text-[12px] text-mut"><span>Tải phim thất bại: {videoErr}</span><Button onClick={() => void load("video", videoPage + 1)} className="px-3 text-primary">Thử lại</Button></div>}
        {videoLoading && visibleVideos.length > 0 && <div className="flex justify-center py-3"><Loader className="w-6 h-6 spinner" /></div>}
        {!videoLoading && !videoErr && videoPage < videoPages && <Button onClick={() => void load("video", videoPage + 1)} className="my-2 px-4 text-primary">Tải thêm phim ngắn</Button>}

        {postLoading && !visiblePosts.length && <div className="flex justify-center py-8"><Loader className="w-7 h-7 spinner" /></div>}
        {postErr && !visiblePosts.length && <Empty icon={<TagIcon size={26} />} title="Tải bài viết thất bại" sub={postErr} action="Thử lại" onAction={() => void load("post", 1, true)} />}
        {visiblePosts.length > 0 && <section className="mb-6">
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[15px] font-bold text-on">Bài viết</h2>
            <span className="text-[12px] text-mut tabular-nums">{postTotal}</span>
          </div>
          <FilteredContent items={visiblePosts} scopeKey={`tag-post:${tag}`}>{shownPosts => <div className={`ios-media-grid ${wide ? "is-wide" : ""}`}>
            {shownPosts.map(post => <MediaCard key={post.id} title={post.title} cover={post.cover} subtitle={post.tags?.slice(0, 2).join(" · ")} onOpen={() => push({ kind: "post", id: post.id })} />)}
          </div>}</FilteredContent>
        </section>}
        <div ref={postSentinel} className="h-2" />
        {postErr && visiblePosts.length > 0 && <div role="status" className="flex flex-wrap items-center justify-center gap-2 py-2 text-[12px] text-mut"><span>Tải bài viết thất bại: {postErr}</span><Button onClick={() => void load("post", postPage + 1)} className="px-3 text-primary">Thử lại</Button></div>}
        {postLoading && visiblePosts.length > 0 && <div className="flex justify-center py-3"><Loader className="w-6 h-6 spinner" /></div>}
        {!postLoading && !postErr && postPage < postPages && <Button onClick={() => void load("post", postPage + 1)} className="my-2 px-4 text-primary">Tải thêm bài viết</Button>}
        {!videoLoading && !postLoading && !videoErr && !postErr && !visibleVideos.length && !visiblePosts.length && <Empty icon={<TagIcon size={26} />} title="Chưa có nội dung nào trong thẻ này" />}
      </div>
      {searching && <InplaceSearch kind="video" wide={wide} onClose={() => setSearching(false)} onOpenVideo={(v, list, kw) => push({ kind: "feed", videoIds: list.map(x => x.id), index: list.findIndex(x => x.id === v.id), title: kw ? `Tìm kiếm · ${kw}` : "Tìm kiếm" })} />}
    </div>
  );
}
