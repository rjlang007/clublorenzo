import { Link } from "react-router-dom";
import { Tournament } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";

function isClubOperator(role: string | undefined) {
  return role === "SUPERADMIN" || role === "ADMIN" || role === "STAFF";
}

export default function TournamentHome({ tournament }: { tournament: Tournament }) {
  const { user } = useAuth();
  const base = `/t/${tournament.id}`;
  const operator = isClubOperator(user?.role);
  const completed = tournament.status === "COMPLETED";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={tournament.type === "RANDOM_PAIRING" ? "Open play hub" : "Tournament hub"}
        title={tournament.name}
        description={completed
          ? "This event is complete. Review the final results, standings, and event details."
          : "Find registration, live court activity, standings, and event management for this event."}
        actions={<span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-white/60">{tournament.status}</span>}
      />
      <section className="mt-6 rounded-2xl border border-ball/20 bg-ball/[0.06] p-5 sm:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ball/75">Follow this event</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-white">See what’s happening on court</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{completed
          ? "This event has ended. Review the final standings and event details."
          : operator
            ? "Follow active courts and upcoming matchups, or check the latest standings."
            : "Register for the event, follow active courts and upcoming matchups, or check the latest standings."}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {!operator && !completed && <Link to={tournament.postId ? `/community/${tournament.postId}` : `${base}/registration`} className="action-button min-h-11 px-5">{tournament.postId ? "Register for event" : "Registration & roster"}</Link>}
          <Link to={`${base}/kiosk`} className={`${completed ? "secondary-button" : "action-button"} min-h-11 px-5`}>Open live board</Link>
          <Link to={`${base}/leaderboard`} className={`${completed ? "action-button" : "secondary-button"} min-h-11 px-5`}>View standings</Link>
          {completed && tournament.postId && <Link to={`/community/${tournament.postId}`} className="secondary-button min-h-11 px-5">Event details</Link>}
          {tournament.type === "FIXED_BRACKET" && <Link to={`${base}/bracket`} className="secondary-button min-h-11 px-5">View bracket</Link>}
          <Link to={`${base}/raffle`} className="secondary-button min-h-11 px-5">Raffle</Link>
        </div>
      </section>
      {operator && <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Organizer tools</p>
        <h2 className="mt-2 font-display text-xl font-bold text-white">Run this event</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={`${base}/courts`} className="action-button min-h-11 px-5">Manage games &amp; courts</Link>
          <Link to={`${base}/location`} className="secondary-button min-h-11 px-5">Manage event location</Link>
          {tournament.type === "FIXED_BRACKET" && <Link to={`${base}/bracket`} className="secondary-button min-h-11 px-5">Manage bracket</Link>}
        </div>
        <p className="mt-3 text-xs leading-5 text-white/45">Add or open courts, draw matchups from the queue, assign players, and record scores. Manage registrations and the player roster in the Registration &amp; players section of the live board.</p>
      </section>}
    </div>
  );
}
