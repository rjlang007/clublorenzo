import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fileUrl, PostSummary } from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPosts(null);
    setError(null);
    api
      .get("/posts", {
        params: { search: search || undefined, location: location || undefined },
        signal: controller.signal,
      })
      .then(({ data }) => {
        setPosts(data.posts);
        setNote(data.photoPolicyNote);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Couldn't load club events right now. Check your connection and try again.");
      });
    return () => controller.abort();
  }, [search, location, retryCount]);

  const clearFilters = () => {
    setSearch("");
    setLocation("");
  };
  const canPostEvent = user && ["ADMIN", "SUPERADMIN", "STAFF"].includes(user.role);

  return (
    <div>
      <PageHeader eyebrow="Club Lorenzo" title="Events &amp; Open Play" description="Find upcoming games and events hosted by the Club Lorenzo community." actions={
        <Link to="/tournaments" className="secondary-button min-h-11 px-4">Tournament boards</Link>
      } />
      <div className="my-5 grid gap-3 sm:grid-cols-2">
        <label className="sr-only" htmlFor="event-search">Search events by name or details</label>
        <input id="event-search" type="search" className="field" placeholder="Search events" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="sr-only" htmlFor="event-location">Filter events by location</label>
        <input id="event-location" type="search" className="field" placeholder="Filter by location" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      {(search || location) && (
        <button type="button" onClick={clearFilters} className="mb-5 text-sm font-medium text-ball hover:text-white">
          Clear search and location filters
        </button>
      )}
      {note && <p className="text-xs text-white/40 mb-6">{note}</p>}
      {error && (
        <div className="error-panel mb-5 flex flex-wrap items-center justify-between gap-3" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="secondary-button">Try again</button>
        </div>
      )}
      {posts === null && !error && <p className="text-white/60" role="status">Loading club events…</p>}
      {posts && posts.length === 0 && (
        <section className="glass-panel my-6 p-6 text-center sm:p-8">
          <h2 className="font-display text-xl font-bold text-white">
            {search || location ? "No events match those filters" : "No club events are posted yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/60">
            {search || location
              ? "Try a different event name or location, or clear your filters to see all events."
              : "You can still browse open-play tournaments, or check back later for new club events."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {(search || location) && <button type="button" onClick={clearFilters} className="secondary-button">Show all events</button>}
            {!search && !location && <Link to="/tournaments" className="action-button">Browse open play</Link>}
            {!search && !location && canPostEvent && <Link to="/community/new" className="secondary-button">Post an event</Link>}
          </div>
        </section>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts?.map((post) => (
          <article key={post.id} className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors hover:border-ball/60">
            <Link to={`/community/${post.id}`} className="flex flex-1 flex-col">
              <div className="aspect-video bg-black/30">
                {post.photos[0] ? (
                  <img src={fileUrl(post.photos[0])} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-white/30">
                    No photo yet
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <h2 className="font-display text-lg font-semibold leading-snug text-white">{post.title}</h2>
                <p className="line-clamp-2 text-sm text-white/60">{post.description}</p>
                {post.scheduledStart && <p className="text-xs text-ball/80">{new Date(post.scheduledStart).toLocaleString()}</p>}
                {post.divisions && post.divisions.length > 0 && <p className="text-xs text-white/55">{post.divisions.map((division) => `${division.name.toLowerCase().replace(/_/g, " ")} ${division.registered}/${division.capacity}`).join(" · ")}</p>}
                <div className="mt-auto flex items-center justify-between pt-2 text-xs text-white/50">
                  <span>📍 {post.location}</span>
                  {post.entryFeeCents != null && post.entryFeeCents > 0
                    ? <span className="text-ball">₱{(post.entryFeeCents / 100).toFixed(2)} entry</span>
                    : post.amount && <span className="text-ball">{post.amount}</span>}
                </div>
                <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
                  <img src={fileUrl(post.host.avatarUrl)} alt="" className="h-5 w-5 rounded-full object-cover" />
                  <span className="text-xs text-white/50">by {post.host.username}</span>
                  <span className="ml-auto text-xs text-white/30">{post.capacity ? `${post.registrationCount} / ${post.capacity} spots` : `${post.registrationCount} registered`}</span>
                </div>
              </div>
            </Link>
            {post.tournamentId && <div className="border-t border-white/10 p-3">
              <Link to={`/t/${post.tournamentId}/kiosk`} className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-ball px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-ball/90">
                Live kiosk · courts &amp; queue
              </Link>
            </div>}
          </article>
        ))}
      </div>
    </div>
  );
}
