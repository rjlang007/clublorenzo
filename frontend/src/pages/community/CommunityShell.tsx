import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import Footer from "../../components/Footer";
import AppHeader from "../../components/AppHeader";

export default function CommunityShell() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => { if (user) api.get<Array<{ readAt: string | null }>>("/notifications").then(({ data }) => setUnread(data.filter((item) => !item.readAt).length)); }, [user]);

  return (
    <div className="min-h-screen">
      <AppHeader unreadCount={unread} />
      <main id="main-content" className="mx-auto max-w-5xl p-4 sm:p-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
