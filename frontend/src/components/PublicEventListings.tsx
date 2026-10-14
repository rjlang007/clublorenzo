import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fileUrl, PostSummary } from "../lib/api";

export default function PublicEventListings({ eyebrow = "Club Lorenzo", heading = "Events & Open Play", browseLabel = "Browse all events" }: { eyebrow?: string; heading?: string; browseLabel?: string }) {
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPosts(null);
    setError(false);
    api.get<{ posts: PostSummary[] }>("/posts")
      .then(({ data }) => {
        if (!cancelled) setPosts(data.posts.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  return (
    <section className="mx-auto mb-8 max-w-6xl px-4 sm:px-6 lg:px-8" aria-labelledby="public-events-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-ball/80">{eyebrow}</p>
          <h2 id="public-events-heading" className="mt-1 font-display text-2xl font-bold text-white">{heading}</h2>
        </div>
        <Link to="/community" className="text-sm font-semibold text-ball hover:underline">{browseLabel}</Link>
      </div>

      {error && <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-4 text-sm text-white/65" role="alert">
        <p>Event postings are temporarily unavailable. <Link to="/community" className="text-ball hover:underline">Open the event board</Link></p>
        <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="min-h-10 rounded-md border border-white/25 px-4 py-2 font-semibold text-white transition hover:border-white/60 hover:bg-white/10">Try again</button>
      </div>}
      {posts === null && !error && <p className="border-y border-white/10 py-4 text-sm text-white/45" role="status" aria-live="polite">Loading postings…</p>}
      {posts?.length === 0 && <p className="border-y border-white/10 py-4 text-sm text-white/45">No events or open play posted yet.</p>}

      {posts && posts.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => <article key={post.id} className="group overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] transition-colors hover:border-ball/50">
          <Link to={`/community/${post.id}`} className="block">
            <div className="aspect-[16/7] overflow-hidden bg-black/30">
              {post.photos[0] ? <img src={fileUrl(post.photos[0])} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <div className="flex h-full items-center justify-center text-sm text-white/30">Event posting</div>}
            </div>
            <div className="p-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display font-semibold text-white group-hover:text-ball">{post.title}</h3>
                {post.amount && <span className="shrink-0 text-xs text-ball">{post.amount}</span>}
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-white/50">{post.location}{post.scheduledStart ? ` · ${new Date(post.scheduledStart).toLocaleDateString()}` : ""}</p>
            </div>
          </Link>
          {post.tournamentId && <div className="border-t border-white/10 p-3 pt-2">
            <Link to={`/t/${post.tournamentId}/kiosk`} className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-ball px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-ball/90">
              Live kiosk · courts &amp; queue
            </Link>
          </div>}
        </article>)}
      </div>}
    </section>
  );
}
