import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { API_URL, api, Player, PostDetail, SkillLevel, Tournament } from "../lib/api";
import { useTournamentSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";

const LEVELS: SkillLevel[] = ["BEGINNER", "AVERAGE", "ADVANCE"];

type AccountSearchResult = { id: string; username: string; displayName: string | null };
type EventSubmission = {
  id: string;
  applicantName: string;
  skillLevel: SkillLevel;
  status: "PENDING" | "APPROVED" | "REJECTED" | "INVITED" | "RESERVED";
  paymentMethod: "QR" | "IN_PERSON" | "PAYMONGO" | null;
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "VERIFIED" | "FAILED" | "REFUNDED";
  paymentProofStoredFile: string | null;
  contact: string | null;
  division: string | null;
  submittedAt: string;
  user?: { username: string };
  participantUser?: { username: string } | null;
};

function isClubOperator(role: string | undefined) {
  return role === "ADMIN" || role === "SUPERADMIN" || role === "STAFF";
}

function requestErrorMessage(error: unknown, fallback: string) {
  return isAxiosError<{ error?: string }>(error) ? error.response?.data?.error || fallback : fallback;
}

export default function Registration({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { tournamentId } = useParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("BEGINNER");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountResults, setAccountResults] = useState<AccountSearchResult[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountSearchResult | null>(null);
  const [accountSearchLoading, setAccountSearchLoading] = useState(false);
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [eventEntryFeeCents, setEventEntryFeeCents] = useState<number | null>(null);
  const [reviewingSubmission, setReviewingSubmission] = useState<string | null>(null);
  const staff = isClubOperator(user?.role);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setError("");
    try {
      const [rosterResponse, tournamentResponse, mineResponse] = await Promise.all([
        api.get<Player[]>("/players", { params: { tournamentId } }),
        api.get<Tournament>(`/tournaments/${tournamentId}`),
        user?.role === "PLAYER"
          ? api.get<Player[]>("/players", { params: { tournamentId, mine: "true" } })
          : Promise.resolve({ data: [] as Player[] }),
      ]);
      setPlayers(rosterResponse.data);
      setTournament(tournamentResponse.data);
      setMyPlayer(mineResponse.data[0] ?? null);
      if (staff && tournamentResponse.data.postId) {
        const [submissionsResponse, postResponse] = await Promise.all([
          api.get<EventSubmission[]>(`/posts/${tournamentResponse.data.postId}/submissions`),
          api.get<Pick<PostDetail, "entryFeeCents">>(`/posts/${tournamentResponse.data.postId}`),
        ]);
        setSubmissions(submissionsResponse.data);
        setEventEntryFeeCents(postResponse.data.entryFeeCents ?? null);
      } else {
        setSubmissions([]);
        setEventEntryFeeCents(null);
      }
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError, "Could not load this tournament’s registration."));
    } finally {
      setLoading(false);
    }
  }, [staff, tournamentId, user?.role]);

  useEffect(() => { void load(); }, [load]);
  useTournamentSocket(tournamentId, ["players:changed"], () => { void load(); });

  useEffect(() => {
    if (!staff || !tournamentId || accountSearch.trim().length < 2 || selectedAccount) {
      setAccountResults([]);
      setAccountSearchLoading(false);
      return;
    }
    let active = true;
    setAccountSearchLoading(true);
    const timer = window.setTimeout(() => {
      api.get<AccountSearchResult[]>("/players/search-users", {
        params: { tournamentId, query: accountSearch.trim() },
      }).then(({ data }) => {
        if (active) setAccountResults(data);
      }).catch((searchError: unknown) => {
        if (!active) return;
        setAccountResults([]);
        setError(requestErrorMessage(searchError, "Could not search player accounts."));
      }).finally(() => {
        if (active) setAccountSearchLoading(false);
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [accountSearch, selectedAccount, staff, tournamentId]);

  const register = async () => {
    setError("");
    setNotice("");
    if (!tournamentId || name.trim().length < 2) {
      setError("Enter the player's name.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/players", { tournamentId, name: name.trim(), contact, skillLevel });
      setName("");
      setContact("");
      setNotice("Player added to the tournament roster.");
      await load();
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError, "Could not add this player."));
    } finally {
      setSubmitting(false);
    }
  };

  const registerAccount = async () => {
    if (!tournamentId || !selectedAccount) {
      setError("Search for and select a player account first.");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await api.post("/players", {
        tournamentId,
        userId: selectedAccount.id,
        name: selectedAccount.displayName || selectedAccount.username,
        skillLevel,
      });
      setNotice(`@${selectedAccount.username} was added to the tournament.`);
      setSelectedAccount(null);
      setAccountSearch("");
      await load();
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError, "Could not add this player account."));
    } finally {
      setSubmitting(false);
    }
  };

  const reviewSubmission = async (submission: EventSubmission, status: "APPROVED" | "REJECTED") => {
    if (!tournament?.postId) return;
    if (status === "APPROVED" && (eventEntryFeeCents ?? 0) > 0 && submission.paymentStatus !== "PAID" && submission.paymentStatus !== "VERIFIED") {
      setError("Verify the player's payment before approving this paid registration.");
      return;
    }
    if (status === "REJECTED" && ["PAID", "VERIFIED"].includes(submission.paymentStatus)) {
      setError("A paid registration cannot be rejected. Resolve or refund the payment first.");
      return;
    }
    setReviewingSubmission(submission.id);
    setError("");
    setNotice("");
    try {
      await api.patch(`/posts/${tournament.postId}/submissions/${submission.id}`, { status });
      setNotice(`${submission.applicantName} was ${status.toLowerCase()}.`);
      await load();
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError, "Could not update the event registration."));
    } finally {
      setReviewingSubmission(null);
    }
  };

  const verifySubmissionPayment = async (submission: EventSubmission) => {
    if (!tournament?.postId) return;
    const paymentDescription = submission.paymentMethod === "IN_PERSON" ? "in-person payment" : "uploaded payment proof";
    if (!window.confirm(`Confirm that you received and verified this ${paymentDescription} for ${submission.applicantName}?`)) return;
    setReviewingSubmission(submission.id);
    setError("");
    setNotice("");
    try {
      await api.patch(`/posts/${tournament.postId}/submissions/${submission.id}/verify-payment`);
      setNotice(`Payment for ${submission.applicantName} was verified. You can now approve the registration.`);
      await load();
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError, "Could not verify this payment."));
    } finally {
      setReviewingSubmission(null);
    }
  };

  const requestEntry = async () => {
    if (!tournamentId || name.trim().length < 2) {
      setError("Enter the name you want shown on the roster.");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await api.post("/players/join", { tournamentId, name: name.trim(), skillLevel });
      setNotice("Your request was sent. The host must approve it before you can join matchmaking.");
      await load();
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError, "Could not request entry."));
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/players/${id}`, { status });
      await load();
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError, "Could not update the player status."));
    }
  };

  const updateSkill = async (id: string, level: SkillLevel) => {
    try {
      await api.patch(`/players/${id}`, { skillLevel: level });
      await load();
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError, "Could not update the player skill level."));
    }
  };

  const updateApproval = async (id: string, joinStatus: "APPROVED" | "REJECTED") => {
    try {
      await api.patch(`/players/${id}/approval`, { joinStatus });
      await load();
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError, "Could not update this join request."));
    }
  };

  const removePlayer = async (id: string) => {
    if (!window.confirm("Permanently remove this player from the tournament roster? Their roster record and active queue/bracket entries will be deleted.")) return;
    try {
      await api.patch(`/players/${id}/remove`);
      await load();
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError, "Could not remove this player."));
    }
  };

  const updateName = async (id: string, playerName: string) => {
    if (!playerName.trim()) return;
    try {
      await api.patch(`/players/${id}`, { name: playerName.trim() });
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError, "Could not update the player name."));
    }
  };

  const statusTone: Record<string, string> = {
    WAITING: "text-white/60",
    QUEUED: "text-ball",
    LEFT: "text-red-300",
    PLAYING: "text-blue-300",
    RESTING: "text-orange-300",
    READY: "text-emerald-300",
  };
  const visiblePlayers = staff ? players : players.filter((player) => player.joinStatus === "APPROVED");
  const isClosed = tournament?.status === "COMPLETED";

  return (
    <div className={`${embedded ? "space-y-5" : "mx-auto max-w-6xl space-y-6"}`}>
      {!embedded && <PageHeader
        eyebrow={staff ? "Tournament management" : "Tournament entry"}
        title={staff ? "Player registration" : "Registration"}
        description={staff
          ? "Manage the roster, player skill levels, and join requests."
          : `View approved players and request a place in ${tournament?.name ?? "this tournament"}.`}
        actions={<div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/60">
          {visiblePlayers.length} {staff ? "roster entries" : "approved players"}
        </div>}
      />}

      {error && <div className="error-panel" role="alert">{error}</div>}
      {notice && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200" role="status">{notice}</p>}
      {loading && <p className="text-sm text-white/50" role="status">Loading registration…</p>}

      {!staff && tournament?.postId && <section className="rounded-2xl border border-ball/20 bg-ball/5 p-5">
        <h2 className="font-display text-lg font-bold text-white">Register for this event</h2>
        <p className="mt-1 text-sm text-white/60">Submit your application and payment details from the event page. Approved players are listed below.</p>
        <Link to={`/community/${tournament.postId}`} className="action-button mt-4 inline-flex min-h-11 items-center px-4">Open event registration</Link>
      </section>}

      {staff && tournament?.postId && <section className="glass-panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ball/75">Paid event registrations</p>
            <h2 className="mt-1 font-display text-xl font-bold text-white">Review applicants</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/55">Check each payment first. Paid applications can be approved; unpaid applications may be rejected, but must not be approved.</p>
          </div>
          <Link to={`/community/${tournament.postId}`} className="secondary-button px-3 py-2 text-xs">Open event details</Link>
        </div>
        {submissions.length > 0 ? <div className="space-y-3">
          {submissions.map((submission) => {
            const paid = ["PAID", "VERIFIED"].includes(submission.paymentStatus);
            const paymentRequired = (eventEntryFeeCents ?? 0) > 0;
            return <article key={submission.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold text-white">{submission.applicantName}
                    {submission.participantUser && <span className="ml-2 text-xs text-ball">@{submission.participantUser.username}</span>}
                  </h3>
                  <p className="mt-1 text-xs text-white/50">
                    {submission.division || submission.skillLevel}
                    {" · "}{submission.paymentMethod === "PAYMONGO" ? "Online checkout" : submission.paymentMethod === "QR" ? "QR / e-wallet" : "Pay in person"}
                    {paymentRequired && <> · Payment: <span className={paid ? "text-emerald-300" : "text-amber-300"}>{submission.paymentStatus}</span></>}
                    {" · "}{submission.status}
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Submitted by @{submission.user?.username ?? "player"} · {submission.contact || "No contact"} · {new Date(submission.submittedAt).toLocaleString()}
                  </p>
                  {submission.paymentProofStoredFile ? (
                    <a className="mt-2 inline-block text-xs font-semibold text-ball hover:underline" href={`${API_URL}/api/posts/${tournament.postId}/submissions/${submission.id}/payment-proof`} target="_blank" rel="noreferrer">View uploaded payment proof</a>
                  ) : paymentRequired && submission.paymentMethod === "QR" ? (
                    <p className="mt-2 text-xs text-amber-200/70">QR payment proof has not been uploaded yet.</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {paymentRequired && !paid && submission.paymentMethod !== "PAYMONGO" && <button
                    type="button"
                    disabled={reviewingSubmission === submission.id || (submission.paymentMethod === "QR" && !submission.paymentProofStoredFile)}
                    onClick={() => void verifySubmissionPayment(submission)}
                    className="secondary-button px-3 py-2 text-xs text-ball disabled:opacity-40"
                  >{reviewingSubmission === submission.id ? "Saving…" : "Verify payment"}</button>}
                  {["PENDING", "RESERVED"].includes(submission.status) && <>
                    <button
                      type="button"
                      disabled={reviewingSubmission === submission.id || (paymentRequired && !paid)}
                      onClick={() => void reviewSubmission(submission, "APPROVED")}
                      className="secondary-button px-3 py-2 text-xs text-emerald-300 disabled:opacity-40"
                    >Approve</button>
                    {!paid && <button
                      type="button"
                      disabled={reviewingSubmission === submission.id}
                      onClick={() => void reviewSubmission(submission, "REJECTED")}
                      className="secondary-button px-3 py-2 text-xs text-red-300 disabled:opacity-40"
                    >Reject</button>}
                  </>}
                  {submission.status === "APPROVED" && <span className="self-center text-xs font-semibold uppercase tracking-wider text-emerald-300">Approved</span>}
                  {submission.status === "REJECTED" && <span className="self-center text-xs font-semibold uppercase tracking-wider text-red-300">Rejected</span>}
                </div>
              </div>
            </article>;
          })}
        </div> : <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">No event applications have been submitted yet.</p>}
      </section>}

      {staff && <section className="glass-panel p-4 sm:p-5">
        <h2 className="font-display text-lg font-bold text-white">Add a registered player account</h2>
        <p className="mt-1 text-sm text-white/55">Search by account username or a name used on a previous player roster. Added accounts are linked to this tournament and queued for open play.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.7fr_auto] lg:items-end">
          <div>
            <label className="field-label" htmlFor="staff-player-account-search">Search player account</label>
            <input
              id="staff-player-account-search"
              value={selectedAccount ? `@${selectedAccount.username}` : accountSearch}
              onChange={(event) => { setSelectedAccount(null); setAccountSearch(event.target.value); setError(""); }}
              maxLength={80}
              placeholder="Type a player name or username"
              className="field"
            />
            {!selectedAccount && accountSearch.trim().length >= 2 && <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#090a32]">
              {accountSearchLoading ? <p className="p-3 text-sm text-white/50">Searching accounts…</p>
                : accountResults.length > 0 ? accountResults.map((account) => <button
                  key={account.id}
                  type="button"
                  onClick={() => { setSelectedAccount(account); setAccountSearch(account.displayName || account.username); setAccountResults([]); }}
                  className="flex w-full items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2.5 text-left last:border-0 hover:bg-white/[0.06]"
                >
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{account.displayName || account.username}</span><span className="block text-xs text-white/45">@{account.username}</span></span>
                  <span className="shrink-0 text-xs text-ball">Select</span>
                </button>)
                  : <p className="p-3 text-sm text-white/50">No available player accounts found.</p>}
            </div>}
          </div>
          <div>
            <label className="field-label" htmlFor="staff-player-skill">Skill level</label>
            <select id="staff-player-skill" value={skillLevel} onChange={(event) => setSkillLevel(event.target.value as SkillLevel)} className="field">
              {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => void registerAccount()} disabled={submitting || isClosed || !selectedAccount} className="action-button min-h-11 w-full disabled:opacity-50 lg:w-auto">{submitting ? "Adding…" : "Add account"}</button>
        </div>
        {isClosed && <p className="mt-3 text-xs text-white/50">This tournament is completed; new roster entries are closed.</p>}
        <details className="mt-5 rounded-xl border border-white/10 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white/75">Add a guest without an account</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr_0.7fr_auto] lg:items-end">
            <div>
              <label className="field-label" htmlFor="staff-player-name">Full name</label>
              <input id="staff-player-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Player name" className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="staff-player-contact">Contact</label>
              <input id="staff-player-contact" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Optional" className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="guest-player-skill">Skill level</label>
              <select id="guest-player-skill" value={skillLevel} onChange={(event) => setSkillLevel(event.target.value as SkillLevel)} className="field">
                {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => void register()} disabled={submitting || isClosed} className="action-button min-h-11 w-full disabled:opacity-50 lg:w-auto">{submitting ? "Adding…" : "Add guest"}</button>
          </div>
        </details>
        {isClosed && <p className="mt-3 text-xs text-white/50">This tournament is completed; new roster entries are closed.</p>}
      </section>}

      {!staff && tournament?.postId && <section className="rounded-2xl border border-ball/25 bg-ball/[0.06] p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold text-white">Join this event</h2>
        <p className="mt-2 text-sm leading-6 text-white/65">This tournament uses event registration, so the host can review participant details and payment in one place.</p>
        <Link to={`/community/${tournament.postId}`} className="action-button mt-4 inline-flex min-h-11 items-center px-5">Event details &amp; registration</Link>
      </section>}

      {!staff && !tournament?.postId && !user && <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="font-display text-lg font-bold text-white">Sign in to request a place</h2>
        <p className="mt-2 text-sm text-white/60">Player accounts can request entry. The organizer must approve the request before matchmaking.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/community/login" state={{ from: `/t/${tournamentId}/registration` }} className="action-button min-h-11 px-4">Sign in</Link>
          <Link to="/community/register" state={{ from: `/t/${tournamentId}/registration` }} className="secondary-button min-h-11 px-4">Create player account</Link>
        </div>
      </section>}

      {!staff && user?.role === "PLAYER" && !tournament?.postId && <section className="rounded-2xl border border-ball/20 bg-ball/5 p-5">
        {myPlayer ? (
          <>
            <h2 className="font-display text-lg font-bold text-white">Your entry status</h2>
            <p className="mt-2 text-sm text-white/70">Request status: <span className="font-semibold text-ball">{myPlayer.joinStatus}</span></p>
            <p className="mt-1 text-xs text-white/50">{myPlayer.joinStatus === "APPROVED" ? "Your entry is approved. You can join the waiting queue from the live board." : myPlayer.joinStatus === "PENDING" ? "The host needs to approve your request before you can join the queue." : "Your request was not approved. Contact the tournament host if you need help."}</p>
            {myPlayer.joinStatus === "APPROVED" && tournamentId && <Link to={`/t/${tournamentId}/kiosk`} className="secondary-button mt-4 inline-flex min-h-10 items-center px-4">Open live board &amp; queue</Link>}
          </>
        ) : isClosed ? (
          <p className="text-sm text-white/60">Registration is closed because this tournament has ended.</p>
        ) : (
          <>
            <h2 className="font-display text-lg font-bold text-white">Request a place</h2>
            <p className="mt-1 text-sm text-white/60">Your request will be sent to the organizer. Once approved, you can join the live matchmaking queue.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_0.7fr_auto] sm:items-end">
              <div>
                <label className="field-label" htmlFor="player-display-name">Name shown on the roster</label>
                <input id="player-display-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Your full name" className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="player-skill-level">Skill level</label>
                <select id="player-skill-level" value={skillLevel} onChange={(event) => setSkillLevel(event.target.value as SkillLevel)} className="field">
                  {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => void requestEntry()} disabled={submitting || name.trim().length < 2} className="action-button min-h-11 w-full disabled:opacity-50 sm:w-auto">{submitting ? "Sending…" : "Request entry"}</button>
            </div>
          </>
        )}
      </section>}

      <section className="glass-panel p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-white">{staff ? "Player roster" : "Approved players"}</h2>
          <div className="text-xs uppercase tracking-[0.2em] text-white/40">Live roster</div>
        </div>

        <div className="space-y-2">
          {visiblePlayers.map((player) => (
            <div key={player.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ball/10 text-sm font-semibold text-ball ring-1 ring-ball/20">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  {staff
                    ? <input aria-label={`Player name for ${player.name}`} className="field max-w-[220px] py-1" defaultValue={player.name} onBlur={(event) => { if (event.target.value !== player.name) void updateName(player.id, event.target.value); }} />
                    : <p className="font-semibold text-white">{player.name}</p>}
                  {staff && <div className="text-xs text-white/45">{player.contact || "No contact provided"}</div>}
                  <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    {player.arrivalAt && <>Arrived {new Date(player.arrivalAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · </>}{player.gamesPlayed ?? 0} games
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {staff ? <select
                  aria-label={`Skill level for ${player.name}`}
                  value={player.skillLevel}
                  onChange={(event) => void updateSkill(player.id, event.target.value as SkillLevel)}
                  className={`skill-badge-${player.skillLevel} rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]`}
                >
                  {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select> : <span className={`skill-badge-${player.skillLevel} rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]`}>{player.skillLevel}</span>}

                <span className={`min-w-[76px] text-center text-xs uppercase tracking-[0.12em] ${statusTone[player.status] ?? "text-white/60"}`}>
                  {player.status}
                </span>

                {staff && player.joinStatus === "PENDING" && <>
                  <button type="button" onClick={() => void updateApproval(player.id, "APPROVED")} className="secondary-button px-3 py-2 text-xs text-emerald-300">Approve</button>
                  <button type="button" onClick={() => void updateApproval(player.id, "REJECTED")} className="secondary-button px-3 py-2 text-xs text-red-300">Reject</button>
                </>}
                {staff && player.joinStatus === "REJECTED" && <span className="text-xs uppercase tracking-[0.12em] text-red-300">Rejected</span>}

                {staff && (player.status !== "LEFT" ? (
                  <button type="button" onClick={() => void updateStatus(player.id, "LEFT")} className="secondary-button px-3 py-2 text-xs uppercase tracking-[0.14em] text-red-300 hover:text-red-200">Mark left</button>
                ) : (
                  <button type="button" onClick={() => void updateStatus(player.id, "WAITING")} className="secondary-button px-3 py-2 text-xs uppercase tracking-[0.14em] text-emerald-300 hover:text-emerald-200">Re-add</button>
                ))}
                {staff && <button type="button" onClick={() => void removePlayer(player.id)} className="secondary-button px-3 py-2 text-xs text-red-300">Remove</button>}
              </div>
            </div>
          ))}

          {!loading && visiblePlayers.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/45">
              {staff ? "No players registered yet. Add the first competitor to start the event." : "No approved players to display yet."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
