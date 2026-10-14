import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type HappeningTournament = {
  id: string;
  name: string;
  type: "RANDOM_PAIRING" | "FIXED_BRACKET";
  activeGames: number;
  readyGames: number;
};

export default function HappeningNow() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noLiveTournament, setNoLiveTournament] = useState(false);

  useEffect(() => {
    let active = true;
    api.get<{ tournament: HappeningTournament | null }>("/tournaments/happening-now")
      .then(({ data }) => {
        if (!active) return;
        if (data.tournament) {
          navigate(`/t/${data.tournament.id}/kiosk`, { replace: true });
        } else {
          setNoLiveTournament(true);
        }
      })
      .catch(() => {
        if (active) setError("We couldn’t check live court activity right now. Please try again or browse the tournaments.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [navigate]);

  return (
    <main className="grid min-h-[60vh] place-items-center bg-court-bg px-4 py-12">
      <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center sm:p-9">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-ball/80">Club Lorenzo · live courts</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-white">{loading ? "Finding the live game…" : error ? "Live board unavailable" : noLiveTournament ? "No games are live right now" : "Opening the live board…"}</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          {loading
            ? "Checking for an open play or tournament with an active court."
            : error ?? (noLiveTournament ? "There isn’t a court-ready or in-progress game at the moment. Browse events to find the next open play." : "Taking you to the active event.")}
        </p>
        {(error || noLiveTournament) && <div className="mt-6 flex flex-wrap justify-center gap-3">
          {error && <button type="button" onClick={() => window.location.reload()} className="action-button min-h-11 px-5">Try again</button>}
          <Link to="/tournaments" className="secondary-button min-h-11 px-5">Browse tournaments</Link>
          <Link to="/" className="secondary-button min-h-11 px-5">Home</Link>
        </div>}
      </section>
    </main>
  );
}
