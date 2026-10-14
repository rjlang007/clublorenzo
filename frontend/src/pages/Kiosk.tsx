import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { api, Court, Game, PublicQueueEntry, Tournament } from "../lib/api";
import { useTournamentSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import Registration from "./Registration";
import SpinWheel from "../components/SpinWheel";

function isTournamentOperator(role: string | undefined) {
  return role === "ADMIN" || role === "SUPERADMIN" || role === "STAFF";
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

type KioskBoard = {
  nowPlaying: Game[];
  upNext: Game[];
  waitingCount: number;
};

export default function Kiosk() {
  const { user } = useAuth();
  const { tournamentId } = useParams();
  const [nowPlaying, setNowPlaying] = useState<Game[]>([]);
  const [upNext, setUpNext] = useState<Game[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [waitingQueue, setWaitingQueue] = useState<PublicQueueEntry[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [drawBusy, setDrawBusy] = useState(false);
  const [drawError, setDrawError] = useState("");
  const [drawNotice, setDrawNotice] = useState("");
  const [drawnGames, setDrawnGames] = useState<Game[] | null>(null);
  const [drawNames, setDrawNames] = useState<string[]>([]);
  const loadRequest = useRef(0);
  const drawRequest = useRef(0);
  const canManagePlayers = isTournamentOperator(user?.role);

  const load = () => {
    const request = ++loadRequest.current;
    setError(null);
    return Promise.all([
      api.get<KioskBoard>(`/games/board/${tournamentId}`),
      api.get<Tournament>(`/tournaments/${tournamentId}`),
      api.get<Court[]>("/courts", { params: { tournamentId } }),
      api.get<PublicQueueEntry[]>(`/queue/${tournamentId}`),
    ]).then(([boardResponse, tournamentResponse, courtResponse, queueResponse]) => {
      const board = boardResponse.data;
      if (request === loadRequest.current) {
        setNowPlaying(board.nowPlaying);
        setUpNext(board.upNext);
        setWaitingCount(board.waitingCount);
        setTournament(tournamentResponse.data);
        setCourts(courtResponse.data);
        setWaitingQueue(queueResponse.data);
      }
      return board;
    }).catch(() => {
      if (request === loadRequest.current) setError("Live board is temporarily unavailable.");
      return null;
    }).finally(() => {
      if (request === loadRequest.current) setLoading(false);
    });
  };

  useEffect(() => {
    drawRequest.current += 1;
    setLoading(true);
    setNowPlaying([]);
    setUpNext([]);
    setWaitingCount(0);
    setWaitingQueue([]);
    setCourts([]);
    setTournament(null);
    setDrawBusy(false);
    setDrawError("");
    setDrawNotice("");
    setDrawnGames(null);
    void load();
    return () => { loadRequest.current += 1; };
  }, [tournamentId]);
  useTournamentSocket(tournamentId, ["games:changed", "courts:changed", "queue:changed", "queue:drawn", "players:changed", "tournament:changed"], load, true);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowPlaying((games) => games.map((game) => (
        game.status === "IN_PROGRESS"
          ? { ...game, remainingSeconds: Math.max(0, game.remainingSeconds - 1) }
          : game
      )));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const drawMatches = async () => {
    if (!tournamentId || drawBusy || waitingQueue.length < 4) return;
    const previousGames = new Set([...nowPlaying, ...upNext].map((game) => game.id));
    setDrawBusy(true);
    setDrawError("");
    setDrawNotice("");
    setDrawnGames(null);
    const queuedNames = waitingQueue.map((entry) => entry.player.name);
    const request = ++drawRequest.current;

    try {
      await api.post(`/queue/${tournamentId}/draw`);
      if (request !== drawRequest.current) return;
      const board = await load();
      if (request !== drawRequest.current) return;
      if (!board) {
        setDrawError("The draw completed, but the live board could not refresh. Please retry.");
        return;
      }
      const newGames = [...board.nowPlaying, ...board.upNext].filter((game) => !previousGames.has(game.id));
      if (newGames.length > 0) {
        setDrawNames(queuedNames);
        setDrawnGames(newGames);
      } else {
        setDrawNotice("No new match was drawn. Upcoming lineups may already fill the preview, or the waiting players may not form an eligible matchup yet.");
      }
    } catch (requestError: unknown) {
      const message = isAxiosError<{ error?: string }>(requestError)
        ? requestError.response?.data?.error
        : undefined;
      if (request === drawRequest.current) setDrawError(message || "Could not draw matches. Please try again.");
    } finally {
      if (request === drawRequest.current) setDrawBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-court-bg p-4 sm:p-8">
      <div className="mb-6">
        <PageHeader eyebrow="Live tournament board" title="Now playing" description={tournament?.name} actions={
        <div className="flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1.5 text-xs text-blue-200">
          <span className="live-dot" /> Auto-updating board
        </div>
        } />
      </div>
      {error && <div className="error-panel mb-5 flex flex-wrap items-center justify-between gap-3">{error}<button type="button" onClick={() => { setLoading(true); void load(); }} className="secondary-button px-3 py-1.5 text-xs">Retry</button></div>}
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Courts &amp; live queue</h2>
          <p className="mt-1 text-xs text-white/50">{courts.filter((court) => court.isEnabled).length} of {courts.length} courts open · {waitingCount} players waiting{tournament?.status === "COMPLETED" ? " · Event completed" : ""}</p>
        </div>
        {canManagePlayers
          ? <Link to={`/t/${tournamentId}/courts`} className="action-button min-h-11 px-5 text-sm font-bold shadow-lg shadow-ball/15">Manage games &amp; courts</Link>
          : <p className="text-xs text-white/45">This board updates automatically for everyone.</p>}
      </section>
      {loading ? <KioskSkeleton /> : <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-5">
        {nowPlaying.map((g, index) => (
          <div key={g.id} style={{ animationDelay: `${index * 70}ms` }} className="glass-panel animate-[card-rise_420ms_ease_both] border-2 border-court-line/20 bg-black/30 p-5 text-center">
            <div className="text-xs uppercase text-white/50 tracking-widest mb-2">{g.court?.label ?? "Court"}</div>
            <Names game={g} team="A" />
            <div className="text-ball font-display font-bold text-sm my-1">VS</div>
            <Names game={g} team="B" />
            <div className="font-display text-5xl mt-4 tabular-nums">{fmt(g.remainingSeconds)}</div>
            <div className={`text-xs mt-1 uppercase tracking-widest ${g.status === "PAUSED" ? "text-indigo-200" : "text-blue-300"}`}>{g.status}</div>
          </div>
        ))}
        {nowPlaying.length === 0 && <p className="col-span-full rounded-2xl border border-dashed border-white/10 p-10 text-center text-white/40">No games in progress</p>}
      </div>}

      <h2 className="mb-4 text-center font-display text-2xl font-bold tracking-wide text-white">UP NEXT · {upNext.length} LINEUPS</h2>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
        {upNext.map((game, index) => (
          <div key={game.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <div className="mb-1 text-xs text-white/40">Lineup #{index + 1}</div>
            <Names game={game} team="A" small />
            <div className="my-1 text-xs font-bold text-ball">VS</div>
            <Names game={game} team="B" small />
          </div>
        ))}
        {upNext.length === 0 && <p className="col-span-full rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-white/40">No upcoming lineups. The host will draw the next eligible players when ready.</p>}
      </div>

      {tournament?.type === "RANDOM_PAIRING" && <section className="mb-8 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ball/75">Open-play matchmaking</p>
            <h2 className="font-display text-xl font-bold text-white">Waiting queue</h2>
            {canManagePlayers && <p className="mt-1 max-w-xl text-xs text-white/50">Randomize eligible waiting players into skill-balanced doubles matchups.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-white/45">{waitingQueue.length} players · first in queue is shown first</p>
            {canManagePlayers && <button
              type="button"
              onClick={() => void drawMatches()}
              disabled={drawBusy || waitingQueue.length < 4 || tournament.status === "COMPLETED"}
              className="action-button min-h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {drawBusy ? "Randomizing players…" : "Bunot-bunot · Randomize players"}
            </button>}
          </div>
        </div>
        {canManagePlayers && waitingQueue.length < 4 && tournament.status !== "COMPLETED" && <p className="mb-3 text-xs text-white/45">At least 4 players must be waiting to draw a doubles match.</p>}
        {drawError && <p className="mb-3 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200" role="alert">{drawError}</p>}
        {drawNotice && <p className="mb-3 rounded-lg border border-ball/20 bg-ball/5 p-3 text-sm text-white/70" role="status">{drawNotice}</p>}
        {waitingQueue.length > 0 ? (
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {waitingQueue.map((entry) => (
              <li key={entry.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ball/10 text-sm font-bold text-ball">#{entry.position}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-white">{entry.player.name}</span>
                <span className={`shrink-0 text-[9px] uppercase tracking-wider ${entry.player.skillLevel === "ADVANCE" ? "text-red-300" : entry.player.skillLevel === "AVERAGE" ? "text-orange-300" : "text-blue-300"}`}>{entry.player.skillLevel}</span>
              </li>
            ))}
          </ol>
        ) : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-white/40">No one is waiting right now.</p>}
        {drawnGames && <div className="mt-5">
          <SpinWheel games={drawnGames} allNames={drawNames} />
          <button type="button" onClick={() => setDrawnGames(null)} className="mt-2 text-xs text-white/40 hover:text-white/70">Close draw</button>
        </div>}
      </section>}

      {canManagePlayers && <details
        className="mb-8 rounded-2xl border border-ball/20 bg-ball/[0.04] p-4 sm:p-5"
        onToggle={(event) => setRegistrationOpen(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-ball/75">Organizer section</span>
            <span className="mt-1 block font-display text-xl font-bold text-white">Registration &amp; players</span>
            <span className="mt-1 block text-sm text-white/55">Search player accounts, review payment, approve registrations, and manage the roster.</span>
          </span>
          <span className="shrink-0 rounded-full border border-ball/25 bg-ball/10 px-3 py-1.5 text-xs font-semibold text-ball">{registrationOpen ? "Close" : "Open"}</span>
        </summary>
        {registrationOpen && <div className="mt-5 border-t border-white/10 pt-5">
          <Registration embedded />
        </div>}
      </details>}
    </div>
  );
}

function KioskSkeleton() {
  return <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 sm:gap-5">
    {[0, 1, 2].map((item) => <div key={item} className="glass-panel h-56 p-5"><div className="skeleton mx-auto h-3 w-20" /><div className="skeleton mx-auto mt-8 h-5 w-36" /><div className="skeleton mx-auto mt-3 h-5 w-28" /><div className="skeleton mx-auto mt-8 h-10 w-24" /></div>)}
  </div>;
}

function Names({ game, team, small }: { game: Game; team: "A" | "B"; small?: boolean }) {
  const teamPlayers = game.players.filter((p) => p.team === team);
  return <div className={small ? "flex flex-wrap justify-center gap-2 text-sm font-display" : "flex flex-wrap justify-center gap-2 font-display text-lg"}>{teamPlayers.length > 0 ? teamPlayers.map((p) => <span key={p.id} className="inline-flex flex-col leading-tight"><span>{p.player.name}</span><span className={`text-[9px] uppercase tracking-[0.12em] ${p.player.skillLevel === "ADVANCE" ? "text-red-300" : p.player.skillLevel === "AVERAGE" ? "text-orange-300" : "text-blue-300"}`}>{p.player.skillLevel}</span></span>) : "—"}</div>;
}
