import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useTournamentSocket } from "../lib/socket";

type QueueSnapshot = {
  player: {
    id: string;
    name: string;
    status: string;
    joinStatus: "PENDING" | "APPROVED" | "REJECTED";
    skillLevel: string;
  };
  queuePosition: number | null;
  game: {
    id: string;
    status: "UPCOMING" | "READY" | "IN_PROGRESS" | "PAUSED";
    court?: { label: string } | null;
    players: { id: string; team: "A" | "B"; player: { id: string; name: string; skillLevel: string } }[];
  } | null;
};

export default function MyOpenPlayQueue({ tournamentId }: { tournamentId: string }) {
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return api.get<QueueSnapshot>(`/queue/${tournamentId}/me`)
      .then(({ data }) => setSnapshot(data))
      .catch((requestError) => {
        setSnapshot(null);
        setError(requestError?.response?.data?.error || "Could not load your open-play queue.");
      })
      .finally(() => setLoading(false));
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useTournamentSocket(tournamentId, ["queue:changed", "queue:drawn", "games:changed", "players:changed"], () => {
    void load();
  });

  async function updateQueue() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (snapshot?.queuePosition !== null && snapshot?.queuePosition !== undefined) {
        await api.delete(`/queue/${tournamentId}/me`);
        setMessage("You left the waiting queue. You can rejoin whenever you are ready.");
      } else {
        await api.post(`/queue/${tournamentId}/me/join`);
        setMessage("You joined the waiting queue.");
      }
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || "Could not update your queue status. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const assignedGame = snapshot?.game;
  const teamA = assignedGame?.players.filter((entry) => entry.team === "A") ?? [];
  const teamB = assignedGame?.players.filter((entry) => entry.team === "B") ?? [];
  const canJoin = !!snapshot && !assignedGame && ["WAITING", "LEFT"].includes(snapshot.player.status);
  const canLeave = !!snapshot && snapshot.queuePosition !== null && !assignedGame;

  return (
    <section className="mb-6 rounded-2xl border border-ball/25 bg-ball/[0.06] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ball/75">Open-play matchmaking</p>
          <h2 className="mt-1 font-display text-xl font-bold text-white">Your queue</h2>
        </div>
        <Link to={`/t/${tournamentId}/kiosk`} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/10">
          Live court board
        </Link>
      </div>
      <p className="mt-2 text-sm leading-6 text-white/65">
        Approved players wait here for the host to draw balanced doubles matchups. If you are called into a game, your lineup and court will appear below.
      </p>

      {loading && <p className="mt-4 text-sm text-white/50" role="status">Loading your queue…</p>}
      {error && <div className="mt-4 rounded-lg border border-advance/25 bg-advance/5 p-3 text-sm text-advance" role="alert">{error}</div>}
      {snapshot && !loading && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-white/60">Player: <span className="font-semibold text-white">{snapshot.player.name}</span></p>
          {assignedGame ? (
            <div className="mt-3">
              <p className="font-semibold text-ball">
                {assignedGame.status === "UPCOMING" ? "You’re in an upcoming lineup" : assignedGame.status === "READY" ? `Your court is ready${assignedGame.court?.label ? ` · ${assignedGame.court.label}` : ""}` : `Game in progress${assignedGame.court?.label ? ` · ${assignedGame.court.label}` : ""}`}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Team A</p>
                  {teamA.map((entry) => <p key={entry.id} className="text-sm text-white">{entry.player.name}</p>)}
                </div>
                <span className="text-center text-xs font-bold text-ball">VS</span>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Team B</p>
                  {teamB.map((entry) => <p key={entry.id} className="text-sm text-white">{entry.player.name}</p>)}
                </div>
              </div>
              <p className="mt-3 text-xs text-white/45">Please check the live board and listen for the host’s call. You can’t leave a lineup once it has been drawn.</p>
            </div>
          ) : snapshot.queuePosition !== null ? (
            <div className="mt-2">
              <p className="font-semibold text-emerald-300">Waiting in the pool · queue spot #{snapshot.queuePosition}</p>
              <p className="mt-1 text-xs text-white/45">The host will draw the next eligible players when courts are available.</p>
            </div>
          ) : snapshot.player.status === "RESTING" ? (
            <p className="mt-2 text-sm text-white/65">You are marked as resting and cannot join until the host returns you to the waiting pool.</p>
          ) : (
            <p className="mt-2 text-sm text-white/65">You are not currently in the waiting pool.</p>
          )}
          {message && <p className="mt-3 text-sm text-emerald-300" role="status">{message}</p>}
          {(canJoin || canLeave) && (
            <button type="button" onClick={() => void updateQueue()} disabled={busy} className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${canLeave ? "border border-white/20 text-white hover:bg-white/10" : "bg-ball text-neutral-900 hover:bg-ball/90"}`}>
              {busy ? "Updating…" : canLeave ? "Leave waiting queue" : "Join waiting queue"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
