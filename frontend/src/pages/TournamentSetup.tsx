import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Tournament } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PublicEventListings from "../components/PublicEventListings";
import { clubLorenzo } from "../lib/clubLorenzo";
import PageHeader from "../components/PageHeader";

export default function TournamentSetup({ publicOnly = false }: { publicOnly?: boolean }) {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"RANDOM_PAIRING" | "FIXED_BRACKET">("RANDOM_PAIRING");
  const [skillLevel, setSkillLevel] = useState<"BEGINNER" | "AVERAGE" | "ADVANCE">("BEGINNER");
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    setLoadingTournaments(true);
    setLoadError("");
    return api.get<Tournament[]>("/tournaments")
      .then(({ data }) => setTournaments(data))
      .catch(() => setLoadError("Could not load tournaments. Check your connection and try again."))
      .finally(() => setLoadingTournaments(false));
  };
  useEffect(() => { load(); }, []);

  const joinTournament = async (tournamentId: string, requestedSkillLevel = skillLevel, displayName?: string) => {
    await api.post("/players/join", { tournamentId, name: displayName, skillLevel: requestedSkillLevel });
    setJoined((current) => ({ ...current, [tournamentId]: true }));
    load();
  };

  if (publicOnly || user?.role === "PLAYER" || !user) {
    return <>
      <PublicEventListings />
      <PlayerTournamentDirectory
        tournaments={tournaments.filter((tournament) => tournament.status !== "COMPLETED")}
        joined={joined}
        canJoin={user?.role === "PLAYER"}
        user={user}
        loading={loadingTournaments}
        loadError={loadError}
        onRetry={() => { void load(); }}
        onJoin={joinTournament}
        onOpen={(id) => navigate(`/t/${id}/kiosk`)}
      />
    </>;
  }

  const create = async () => {
    setError("");
    if (name.trim().length < 2) { setError("Enter a tournament name."); return; }
    try {
      const { data } = await api.post("/tournaments", { name: name.trim(), type });
      navigate(`/t/${data.id}/registration`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || "Could not create the tournament.");
    }
  };

  const finishTournament = (id: string) => {
    navigate(`/t/${id}/courts`);
  };

  const openTournament = (id: string) => {
    navigate(`/t/${id}/courts`);
  };

  const removeTournament = async (id: string) => {
    if (!window.confirm("Remove this tournament and all of its tournament data? This cannot be undone.")) return;
    await api.delete(`/tournaments/${id}`);
    load();
  };

  const removePreviousTournaments = async () => {
    const previousCount = tournaments.filter((tournament) => tournament.ownerId === user?.id && tournament.status === "COMPLETED").length;
    if (previousCount === 0) return;
    if (!window.confirm(`Delete all ${previousCount} completed open play${previousCount === 1 ? "" : "s"} and their data? This cannot be undone.`)) return;
    await api.delete("/tournaments/previous");
    load();
  };

  const removeAllTournaments = async () => {
    const removableCount = tournaments.length;
    if (removableCount === 0) return;
    const scope = "all club tournaments";
    if (!window.confirm(`Delete ${removableCount} ${scope} and all associated data? This cannot be undone.`)) return;
    await api.delete("/tournaments");
    load();
  };

  const downloadSummary = async (id: string, tournamentName: string) => {
    const response = await api.get(`/tournaments/${id}/summary.csv`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tournamentName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-summary.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <PublicEventListings />
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="glass-panel overflow-hidden p-6 sm:p-8">
          <PageHeader eyebrow="Club operations" title="Manage tournaments" description="Create tournaments, run local open play, and keep players informed from one place." actions={
            <Link to="/community" className="secondary-button min-h-11 px-4">Event board</Link>
          } />
          <p className="my-6 max-w-lg text-sm leading-6 text-white/65">{clubLorenzo.description}</p>
          {loadError && <div className="error-panel mb-5 flex flex-wrap items-center justify-between gap-3" role="alert"><span>{loadError}</span><button type="button" onClick={() => { void load(); }} className="secondary-button">Try again</button></div>}

          {user && ["ADMIN", "SUPERADMIN", "STAFF"].includes(user.role) ? <div className="space-y-5">
            <div>
              <label className="field-label">Tournament name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Barangay Open 2026"
                className="field"
              />
            </div>

            <div>
              <label className="field-label">Tournament format</label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setType("RANDOM_PAIRING")}
                  className={`rounded-2xl border p-4 text-left ${type === "RANDOM_PAIRING" ? "border-ball/50 bg-ball/10 shadow-[0_12px_24px_rgba(242,201,76,0.15)]" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
                >
                  <div className="font-display text-xl font-bold text-white">Random Pairing</div>
                  <div className="mt-2 text-xs leading-5 text-white/55">
                    Skill-balanced draw, bunot-bunot scheduling, and dynamic leaderboard ranking.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setType("FIXED_BRACKET")}
                  className={`rounded-2xl border p-4 text-left ${type === "FIXED_BRACKET" ? "border-ball/50 bg-ball/10 shadow-[0_12px_24px_rgba(242,201,76,0.15)]" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
                >
                  <div className="font-display text-xl font-bold text-white">Fixed Bracket</div>
                  <div className="mt-2 text-xs leading-5 text-white/55">
                    Bracket-based events with fixed pairings, round robin logic, and fine-tuned tournament flow.
                  </div>
                </button>
              </div>
            </div>

            <button onClick={create} className="action-button w-full py-3 text-base">
              Create Tournament
            </button>
            {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
          </div> : (
            <div className="rounded-2xl border border-ball/20 bg-ball/5 p-4 text-sm text-white/65">
              You are signed in as a player. Choose a tournament below to view its live games and standings.
              <select value={skillLevel} onChange={(event) => setSkillLevel(event.target.value as typeof skillLevel)} className="field mt-3 max-w-xs">
                <option value="BEGINNER">Beginner</option>
                <option value="AVERAGE">Average</option>
                <option value="ADVANCE">Advanced</option>
              </select>
            </div>
          )}
        </section>

        <aside className="glass-panel p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-white">Recent</h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/45">{tournaments.length} total</span>
              {(user?.role === "ADMIN" || user?.role === "SUPERADMIN") && tournaments.length > 0 && <button type="button" onClick={removeAllTournaments} className="rounded-lg border border-red-400/30 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-300 hover:bg-red-400/10">Clear all</button>}
              {tournaments.some((tournament) => tournament.ownerId === user?.id && tournament.status === "COMPLETED") && <button type="button" onClick={removePreviousTournaments} className="rounded-lg border border-red-400/30 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-300 hover:bg-red-400/10">Clear previous</button>}
            </div>
          </div>

          {tournaments.length > 0 ? (
            <div className="space-y-3">
              {tournaments.map((t) => (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openTournament(t.id)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openTournament(t.id); }}
                  className="w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-ball/30 hover:bg-ball/[0.04]"
                >
                  <div className="flex items-center justify-between gap-3"><button type="button" onClick={(event) => { event.stopPropagation(); openTournament(t.id); }} className="font-medium text-white hover:text-ball">{t.name}</button>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/55">
                      {t.type === "RANDOM_PAIRING" ? "Random" : "Bracket"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
                    <span>{t.status === "COMPLETED" ? "FINISHED" : t.status}</span>
                    <div className="flex gap-1">
                      {user && ["ADMIN", "SUPERADMIN", "STAFF"].includes(user.role) && <button type="button" onClick={(event) => { event.stopPropagation(); openTournament(t.id); }} className="rounded-lg border border-ball/30 px-2 py-1 text-ball">Manage games &amp; courts</button>}
                      {user && ["ADMIN", "SUPERADMIN", "STAFF"].includes(user.role) && <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/t/${t.id}/registration`); }} className="rounded-lg border border-white/15 px-2 py-1 text-white/75">Manage players</button>}
                      {t.status !== "COMPLETED" && user && ["ADMIN", "SUPERADMIN", "STAFF"].includes(user.role) && <button type="button" onClick={(event) => { event.stopPropagation(); finishTournament(t.id); }} className="rounded-lg border border-emerald-400/30 px-2 py-1 text-emerald-300">Open finalizer</button>}
                      {t.status === "COMPLETED" && user && ["ADMIN", "SUPERADMIN", "STAFF"].includes(user.role) && <button type="button" onClick={(event) => { event.stopPropagation(); downloadSummary(t.id, t.name); }} className="rounded-lg border border-ball/30 px-2 py-1 text-ball">Download summary</button>}
                      {user && ["ADMIN", "SUPERADMIN", "STAFF"].includes(user.role) && <button type="button" onClick={(event) => { event.stopPropagation(); removeTournament(t.id); }} className="rounded-lg border border-red-400/30 px-2 py-1 text-red-300">Remove</button>}
                    </div>
                    {user?.role === "PLAYER" && <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); joinTournament(t.id); }}
                      disabled={joined[t.id]}
                      className="rounded-lg border border-ball/30 px-2.5 py-1 text-ball disabled:opacity-50"
                    >{joined[t.id] ? "Joined" : "Join"}</button>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/45">
              No tournaments yet. Start with a new event above.
            </div>
          )}
        </aside>
      </div>
    </div>
    </>
  );
}

function PlayerTournamentDirectory({
  tournaments,
  joined,
  canJoin,
  user,
  loading,
  loadError,
  onRetry,
  onJoin,
  onOpen,
}: {
  tournaments: Tournament[];
  joined: Record<string, boolean>;
  canJoin: boolean;
  user: ReturnType<typeof useAuth>["user"];
  loading: boolean;
  loadError: string;
  onRetry: () => void;
  onJoin: (id: string, skillLevel: "BEGINNER" | "AVERAGE" | "ADVANCE", displayName: string) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const [skillLevel, setSkillLevel] = useState<"BEGINNER" | "AVERAGE" | "ADVANCE">("BEGINNER");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [joinError, setJoinError] = useState("");

  const join = async (id: string) => {
    if (displayName.trim().length < 2) return;
    setPending((current) => ({ ...current, [id]: true }));
    setJoinError("");
    try {
      await onJoin(id, skillLevel, displayName.trim());
    } catch {
      setJoinError("Could not request entry. Please try again.");
    } finally {
      setPending((current) => ({ ...current, [id]: false }));
    }
  };

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="glass-panel p-5 sm:p-7">
          <PageHeader eyebrow="Open play" title="Spectate or join a tournament" description="Every posted tournament is available to view. Resume a joined tournament or spectate its live courts, standings, and bracket." actions={
            <>
              <Link to="/community" className="secondary-button min-h-11 px-4">Event board</Link>
              {!user && <>
                <Link to="/community/login" state={{ from: "/tournaments" }} className="secondary-button min-h-11 px-4">Sign in to join</Link>
                <Link to="/community/register" state={{ from: "/tournaments" }} className="action-button min-h-11 px-4">Create player account</Link>
              </>}
            </>
          } />
          {user && !canJoin && <p className="mt-4 text-xs text-white/50">Only player accounts can request entry.</p>}
          {canJoin && <div className="mt-5 grid max-w-xl gap-4 sm:grid-cols-2"><div><label className="field-label">Name shown in tournament</label><input className="field" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your full name" maxLength={80} required /></div><div><label className="field-label">Your skill level</label><select value={skillLevel} onChange={(event) => setSkillLevel(event.target.value as typeof skillLevel)} className="field"><option value="BEGINNER">Beginner</option><option value="AVERAGE">Average</option><option value="ADVANCE">Advanced</option></select></div></div>}
        </section>
        {joinError && <p className="error-panel" role="alert">{joinError}</p>}
        {loadError && <div className="error-panel flex flex-wrap items-center justify-between gap-3" role="alert"><span>{loadError}</span><button type="button" onClick={onRetry} className="secondary-button">Try again</button></div>}
        {loading && <p className="text-sm text-white/50" role="status">Loading tournaments…</p>}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <article
              key={tournament.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(tournament.id)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(tournament.id); }}
              className="glass-panel cursor-pointer p-5"
            >
              <div className="flex items-start justify-between gap-3"><h2 className="font-display text-2xl font-bold text-white">{tournament.name}</h2><span className="text-[10px] uppercase tracking-widest text-white/45">{tournament.status}</span></div>
              <p className="mt-2 text-sm text-white/50">{tournament.type === "RANDOM_PAIRING" ? "Random pairing" : "Fixed bracket"}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={(event) => { event.stopPropagation(); onOpen(tournament.id); }} className="secondary-button min-h-11 flex-1">{tournament.myMembership?.joinStatus === "APPROVED" ? "Resume tournament" : "Open live kiosk"}</button>
                {canJoin && <button onClick={(event) => { event.stopPropagation(); void join(tournament.id); }} disabled={displayName.trim().length < 2 || joined[tournament.id] || pending[tournament.id] || (tournament.myMembership !== undefined && tournament.myMembership !== null)} className="action-button min-h-11 flex-1">{tournament.myMembership?.joinStatus === "APPROVED" ? "Joined" : tournament.myMembership?.joinStatus === "PENDING" || joined[tournament.id] ? "Awaiting approval" : tournament.myMembership?.joinStatus === "REJECTED" ? "Rejected" : pending[tournament.id] ? "Sending..." : "Request entry"}</button>}
              </div>
            </article>
          ))}
        </section>
        {!loading && !loadError && tournaments.length === 0 && <div className="glass-panel p-8 text-center"><h2 className="font-display text-xl font-bold text-white">No tournaments posted yet</h2><p className="mt-2 text-sm text-white/50">Check back soon for upcoming games and events.</p></div>}
      </div>
    </div>
  );
}
