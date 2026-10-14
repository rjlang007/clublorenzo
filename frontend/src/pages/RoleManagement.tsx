import { FormEvent, useCallback, useEffect, useState } from "react";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";

type ManagedRole = "ADMIN" | "STAFF" | "PLAYER";
type ManagedAccount = { id: string; username: string; role: ManagedRole; createdAt: string; isBlocked: boolean };

export default function RoleManagement() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<ManagedAccount[]>("/accounts");
      setAccounts(response.data);
    } catch (requestError) {
      const message = requestError && typeof requestError === "object" && "response" in requestError
        ? (requestError as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setError(message || "Could not load club accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.post("/accounts", { username: username.trim(), password, role });
      setUsername("");
      setPassword("");
      setMessage(`${role === "ADMIN" ? "Club admin" : "Staff"} account created. Share the temporary password securely.`);
      await loadAccounts();
    } catch (requestError) {
      const message = requestError && typeof requestError === "object" && "response" in requestError
        ? (requestError as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setError(message || "Could not create this account.");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(account: ManagedAccount, nextRole: ManagedRole) {
    if (nextRole === account.role) return;
    const confirmation = nextRole === "ADMIN"
      ? `Transfer the single club admin role to @${account.username}? The current admin will become staff.`
      : `Change @${account.username} from ${account.role.toLowerCase()} to ${nextRole.toLowerCase()}?`;
    if (!window.confirm(confirmation)) return;
    setMessage("");
    setError("");
    try {
      await api.patch(`/accounts/${account.id}/role`, { role: nextRole });
      setMessage(nextRole === "ADMIN" ? `Admin role transferred to @${account.username}.` : `@${account.username} is now ${nextRole.toLowerCase()}.`);
      await loadAccounts();
    } catch (requestError) {
      const message = requestError && typeof requestError === "object" && "response" in requestError
        ? (requestError as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setError(message || "Could not change this account's role.");
    }
  }

  async function setAccountBlocked(account: ManagedAccount) {
    const nextBlocked = !account.isBlocked;
    const action = nextBlocked ? "block" : "unblock";
    const confirmation = nextBlocked
      ? `Block @${account.username}? They will lose access on their next request and cannot sign in until an administrator unblocks the account. Their history and records will be kept.`
      : `Unblock @${account.username}? They will be able to sign in again.`;
    if (!window.confirm(confirmation)) return;

    setUpdatingAccountId(account.id);
    setMessage("");
    setError("");
    try {
      await api.patch(`/accounts/${account.id}/status`, { isBlocked: nextBlocked });
      setMessage(`@${account.username} was ${nextBlocked ? "blocked" : "unblocked"}.`);
      await loadAccounts();
    } catch (requestError) {
      const message = requestError && typeof requestError === "object" && "response" in requestError
        ? (requestError as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setError(message || `Could not ${action} this account.`);
    } finally {
      setUpdatingAccountId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-4 py-8 sm:px-6">
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6">
        <PageHeader eyebrow="Club administration" title="Account roles" description="Create and manage trusted Club Lorenzo staff accounts." />

        <div className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <form onSubmit={createAccount} className="glass-panel space-y-4 p-5 sm:p-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Add club account</h2>
              <p className="mt-1 text-sm leading-6 text-white/55">
                {isSuperAdmin
                  ? "Create the single client admin account or add club staff."
                  : "Create staff accounts for trusted members who run club events and play."}
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="managed-username">Username</label>
              <input id="managed-username" className="field" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" autoComplete="off" required />
            </div>
            <div>
              <label className="field-label" htmlFor="managed-password">Temporary password</label>
              <input id="managed-password" className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" required />
            </div>
            <div>
              <label className="field-label" htmlFor="managed-role">Role</label>
              <select id="managed-role" className="field" value={role} onChange={(event) => setRole(event.target.value as "ADMIN" | "STAFF")}>
                {isSuperAdmin && <option value="ADMIN">Club admin · client owner</option>}
                <option value="STAFF">Staff · event and court operations</option>
              </select>
            </div>
            {message && <p className="text-sm text-emerald-300" role="status">{message}</p>}
            {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
            <button type="submit" disabled={saving} className="action-button w-full">{saving ? "Creating…" : "Create account"}</button>
          </form>

          <section className="glass-panel p-5 sm:p-6" aria-labelledby="managed-accounts-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="managed-accounts-heading" className="font-display text-2xl font-bold text-white">Club accounts</h2>
                <p className="mt-1 text-sm text-white/50">Block access when needed; account history and records are kept.</p>
              </div>
              <button type="button" onClick={() => void loadAccounts()} className="secondary-button px-3 py-2 text-xs">Refresh</button>
            </div>
            {error && <p className="mb-4 text-sm text-red-300" role="alert">{error}</p>}
            {loading ? <p className="text-sm text-white/55" role="status">Loading accounts…</p> : accounts.length === 0
              ? <p className="rounded-lg border border-white/10 p-4 text-sm text-white/55">No managed accounts are listed yet.</p>
              : <ul className="space-y-2">
                {accounts.map((account) => (
                  <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">@{account.username}</p>
                      <p className="mt-1 text-xs text-white/45">
                        Added {new Date(account.createdAt).toLocaleDateString()}
                        {account.isBlocked && <span className="ml-2 font-semibold text-red-300">Blocked</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/65">{account.role === "ADMIN" ? "Club admin" : account.role}</span>
                      {(account.role === "STAFF" || account.role === "PLAYER") && (
                        <select
                          aria-label={`Change role for ${account.username}`}
                          className="field min-w-36 py-2 text-xs"
                          value={account.role}
                          onChange={(event) => void changeRole(account, event.target.value as ManagedRole)}
                        >
                          <option value={account.role}>{account.role}</option>
                          {account.role !== "STAFF" && <option value="STAFF">Staff</option>}
                          {isSuperAdmin && <option value="ADMIN">Transfer admin here</option>}
                          {account.role !== "PLAYER" && <option value="PLAYER">Player</option>}
                        </select>
                      )}
                      {(account.role !== "ADMIN" || isSuperAdmin) && (
                        <button
                          type="button"
                          onClick={() => void setAccountBlocked(account)}
                          disabled={updatingAccountId === account.id}
                          className={`secondary-button px-3 py-2 text-xs ${account.isBlocked ? "text-emerald-300" : "text-red-300"}`}
                        >
                          {updatingAccountId === account.id
                            ? "Saving…"
                            : account.isBlocked
                              ? "Unblock"
                              : "Block"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
