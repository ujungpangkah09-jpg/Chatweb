// components/chat/SidebarWA.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useChatUI } from "./store";
import ChatThreadsList from "./ChatThreadsList";
import StatusOverlay from "./StatusOverlay";
import NewChatOverlay from "./NewChatOverlay";
import MenuDropdown from "./MenuDropdown";

type Profile = { id: string; username: string | null; avatar_url: string | null };

export default function SidebarWA() {
  const router = useRouter();
  const ui = useChatUI();
  const [me, setMe] = useState<Profile | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!mounted) return;

      // If not logged in, send the user to the login page.
      if (!uid) {
        router.replace("/auth/login");
        return;
      }

      const fallbackName =
        (data.user?.user_metadata?.username as string | undefined) ||
        (data.user?.email ? data.user.email.split("@")[0] : undefined) ||
        "User";

      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", uid)
        .single();

      // If profiles row doesn't exist / username not set, still show the name
      // from auth metadata so it updates right after register.
      const merged: Profile = {
        id: uid,
        username: p?.username ?? fallbackName,
        avatar_url: p?.avatar_url ?? null,
      };

      if (mounted) setMe(merged);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  return (
    <aside className="w-full md:w-[380px] md:border-r md:border-[#2a3942] flex flex-col bg-[#111b21] text-white relative">
      {/* Top Bar (Android-ish) */}
      <div className="h-14 px-4 flex items-center justify-between bg-[#111b21]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[18px] font-semibold tracking-wide">WhatsApp</div>
        </div>

        <div className="flex items-center gap-1 relative">
          {/* Camera quick action */}
          <button
            className="w-10 h-10 rounded-full hover:bg-white/10 grid place-items-center"
            title="Camera"
            onClick={() => alert("Camera v2")}
          >
            📷
          </button>

          {/* Status / Updates */}
          <button
            className="w-10 h-10 rounded-full hover:bg-white/10 grid place-items-center"
            title="Status"
            onClick={() => ui.set({ showStatusOverlay: true, showMenuDropdown: false })}
          >
            ◯
          </button>

          {/* New Chat (also used by FAB) */}
          <button
            className="w-10 h-10 rounded-full hover:bg-white/10 grid place-items-center"
            title="New chat"
            onClick={() => ui.set({ showNewChatOverlay: true, showMenuDropdown: false })}
          >
            ＋
          </button>

          {/* Menu */}
          <button
            className="w-10 h-10 rounded-full hover:bg-white/10 grid place-items-center"
            title="Menu"
            onClick={() => ui.set({ showMenuDropdown: !ui.showMenuDropdown })}
          >
            ⋮
          </button>

          {ui.showMenuDropdown && (
            <MenuDropdown
              onLogout={logout}
              onClose={() => ui.set({ showMenuDropdown: false })}
            />
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pt-2">
        <div className="flex items-center gap-3 bg-[#202c33] rounded-full px-4 py-3">
          <span className="opacity-70">🔍</span>
          <input
            className="w-full bg-transparent outline-none text-sm placeholder:text-white/60 text-white"
            placeholder="Tanya Meta AI atau Cari"
            value={ui.sidebarQuery}
            onChange={(e) => ui.set({ sidebarQuery: e.target.value })}
          />
        </div>
      </div>

      {/* Chips */}
      <div className="px-4 mt-3 flex gap-2 overflow-x-auto">
        <Chip label="Semua" active={ui.activeChip === "all"} onClick={() => ui.set({ activeChip: "all" })} />
        <Chip label="Belum Dibaca" active={ui.activeChip === "unread"} onClick={() => ui.set({ activeChip: "unread" })} />
        <Chip label="Favorit" active={ui.activeChip === "fav"} onClick={() => ui.set({ activeChip: "fav" })} />
        <Chip label="Grup" active={ui.activeChip === "group"} onClick={() => ui.set({ activeChip: "group" })} />
      </div>

      {/* Archived row */}
      <button
        className="mx-4 mt-3 flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/5 text-sm text-white/80"
        onClick={() => ui.set({ showArchived: !ui.showArchived })}
        title="Archived"
      >
        <span className="flex items-center gap-3">
          <span>🗄️</span>
          <span>Diarsipkan</span>
        </span>
        <span className="text-xs text-white/60">{ui.showArchived ? "On" : "Off"}</span>
      </button>

      {/* Threads List */}
      <ChatThreadsList />

      {/* Bottom tabs (mobile) */}
      <div className="md:hidden h-14 border-t border-white/10 bg-[#111b21] flex items-center justify-around">
        <TabButton label="Chats" icon="💬" active />
        <TabButton label="Updates" icon="🟢" onClick={() => ui.set({ showStatusOverlay: true })} />
        <TabButton label="Komunitas" icon="👥" onClick={() => alert("Komunitas v2") } />
      </div>

      {/* FAB (mobile) */}
      <button
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 rounded-2xl bg-[#25d366] text-[#111b21] grid place-items-center shadow-2xl active:scale-95 transition"
        title="Chat baru"
        onClick={() => ui.set({ showNewChatOverlay: true, showMenuDropdown: false })}
      >
        ✉️
      </button>

      {/* Overlays */}
      {ui.showStatusOverlay && <StatusOverlay onClose={() => ui.set({ showStatusOverlay: false })} />}
      {ui.showNewChatOverlay && <NewChatOverlay onClose={() => ui.set({ showNewChatOverlay: false })} />}
    </aside>
  );
}

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-col items-center justify-center gap-1 text-[11px]",
        active ? "text-[#25d366]" : "text-white/70",
      ].join(" ")}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "whitespace-nowrap px-4 py-2 rounded-full text-sm transition",
        active ? "bg-[#0f3d34] text-[#25d366]" : "bg-[#202c33] text-white/70 hover:text-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const letter = (name?.[0] ?? "?").toUpperCase();
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
  ) : (
    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
      <span className="text-sm font-semibold text-white">{letter}</span>
    </div>
  );
}
