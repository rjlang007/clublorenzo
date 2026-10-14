import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fileUrl, type GlobalLeaderboards } from "../lib/api";

export default function LeaderboardSpotlight() {
  const [rows, setRows] = useState<GlobalLeaderboards["overall"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    api.get<GlobalLeaderboards>("/leaderboard/global", { signal: controller.signal })
      .then(({ data }) => setRows(data.overall.slice(0, 5)))
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [retry]);

  return (
    <section className="bg-[#f3f5ff] px-5 py-16 sm:px-8 sm:py-20" aria-labelledby="leaderboard-heading">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#4147a7]">Earn your place on the board</p>
            <h2 id="leaderboard-heading" className="mt-2 font-display text-4xl uppercase text-[#11134f] sm:text-5xl">Club rankings</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#555b83]">All-time points from finalized open-play and tournament podiums.</p>
          </div>
          <Link to="/community/leaderboard" className="rounded-md border border-[#080886]/25 px-5 py-2.5 text-sm font-semibold text-[#080886] transition hover:bg-white">
            Full leaderboard <span aria-hidden="true">↗</span>
          </Link>
        </div>

        {loading && (
          <p className="rounded-xl border border-[#080886]/10 bg-white px-5 py-6 text-sm text-[#555b83]" role="status">
            Loading player rankings…
          </p>
        )}
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-white px-5 py-4 text-sm text-[#555b83]" role="alert">
            <span>Player rankings are temporarily unavailable.</span>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="font-bold text-[#080886] underline underline-offset-2">
              Try again
            </button>
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl border border-[#080886]/10 bg-white px-5 py-6 text-sm text-[#555b83]">
            Rankings will appear here after the first event results are finalized.{" "}
            <Link to="/community/leaderboard" className="font-bold text-[#080886] underline underline-offset-2">Learn how points work</Link>
          </div>
        )}
        {!loading && !error && rows.length > 0 && (
          <ol className="overflow-hidden rounded-xl border border-[#080886]/10 bg-white shadow-[0_12px_35px_rgba(8,8,134,0.07)]">
            {rows.map((row, index) => (
              <li key={row.userId} className="flex min-w-0 items-center gap-4 border-b border-[#080886]/10 px-4 py-4 last:border-b-0 sm:px-6">
                <span className={`w-9 shrink-0 text-center font-display text-xl font-bold ${index === 0 ? "text-[#080886]" : "text-[#777da5]"}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                {row.avatarUrl ? (
                  <img src={fileUrl(row.avatarUrl)} alt="" className="h-11 w-11 shrink-0 rounded-full bg-[#f3f5ff] object-cover" />
                ) : (
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#080886]/10 font-display text-lg font-bold text-[#080886]">
                    {row.username[0]?.toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#11134f]">{row.username}</p>
                  <p className="mt-0.5 text-xs text-[#777da5]">{row.rankTier} <span aria-hidden="true">·</span> {row.podiums} {row.podiums === 1 ? "podium" : "podiums"}</p>
                </div>
                <p className="shrink-0 text-right font-display text-xl font-bold text-[#080886]">
                  {row.overallPoints} <span className="font-sans text-xs font-semibold uppercase tracking-wide text-[#777da5]">pts</span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
