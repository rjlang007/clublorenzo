import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fileUrl, PublicProfile } from "../../lib/api";
import PageHeader from "../../components/PageHeader";

export default function Members() {
  const [members, setMembers] = useState<PublicProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadMembers() {
    setMembers(null);
    setError(null);
    api.get<PublicProfile[]>("/users")
      .then(({ data }) => setMembers(data))
      .catch(() => setError("Couldn't load members. Please check your connection and try again."));
  }

  useEffect(() => {
    loadMembers();
  }, []);

  return (
    <div>
      <PageHeader eyebrow="Community" title="Members" description="Meet players and find familiar faces from across the club." />
      <div className="my-5">
      {members === null && !error && <p className="text-white/60" role="status">Loading members…</p>}
      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200" role="alert">
          {error} <button type="button" onClick={loadMembers} className="ml-2 underline">Retry</button>
        </div>
      )}
      {members?.length === 0 && (
        <p className="text-white/60">No members to show yet.</p>
      )}
      {members && members.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {members.map((m) => (
          <Link
            key={m.id}
            to={`/community/profile/${m.username}`}
            className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 hover:border-ball/60 p-3"
          >
            <img src={fileUrl(m.avatarUrl)} alt="" className="w-12 h-12 rounded-full object-cover border border-white/20" />
            <div className="min-w-0">
              <p className="font-display font-semibold text-white truncate">{m.isSystemAccount ? "System" : m.username}</p>
              <p className="text-xs text-white/50 truncate">{m.bio || "No description yet"}</p>
            </div>
          </Link>
        ))}
      </div>}
      </div>
    </div>
  );
}
