// components/chat/ChatThreadsList.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useChatUI } from "./store";

type Thread = {
  conversation_id: string;
  other_id: string;
  other_username: string | null;
  other_avatar_url: string | null;
  last_body: string | null;
  last_at: string | null;
  unread_count: number;
  last_sender_id: string | null;
  last_type: string | null;
  last_delivered_at: string | null;
  last_read_at: string | null;
  is_group: boolean;
};

export default function ChatThreadsList() {
  const router = useRouter();
  const pathname = usePathname();
  const ui = useChatUI();

  const [meId, setMeId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);

  // simple per-user preferences (localStorage): pinned/favorite/archived/disappearing
  const prefs = useMemo(() => makePrefs(meId), [meId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!meId) return;

    let mounted = true;

    (async () => {
      // MVP query sederhana:
      // ambil semua conversation_id milik saya
      const { data: cms } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", meId);

      const convIds = (cms ?? []).map((x: any) => x.conversation_id);
      if (!convIds.length) return setThreads([]);

      // ambil peer user untuk tiap conversation (via RPC one-by-one sederhana v1)
      // (kalau mau cepat/rapi: nanti bikin SQL view)
      const out: Thread[] = [];

      for (const cid of convIds) {
        const { data: peerId } = await supabase.rpc("get_conversation_peer", { conv_id: cid });
        if (!peerId) continue;

        const { data: peer } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .eq("id", peerId)
          .single();

        const { data: lastMsg } = await supabase
          .from("messages")
          .select("body, created_at, sender_id, read_at, delivered_at, type")
          .eq("conversation_id", cid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // group detection: count members > 2
        const { count: memberCount } = await supabase
          .from("conversation_members")
          .select("user_id", { count: "exact", head: true })
          .eq("conversation_id", cid);

        // unread (simple): pesan dari lawan yang read_at masih null
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", cid)
          .neq("sender_id", meId)
          .is("read_at", null);

        out.push({
          conversation_id: cid,
          other_id: peer?.id ?? peerId,
          other_username: peer?.username ?? null,
          other_avatar_url: peer?.avatar_url ?? null,
          last_body: lastMsg?.body ?? null,
          last_at: lastMsg?.created_at ?? null,
          unread_count: count ?? 0,
          last_sender_id: lastMsg?.sender_id ?? null,
          last_type: (lastMsg as any)?.type ?? null,
          last_delivered_at: (lastMsg as any)?.delivered_at ?? null,
          last_read_at: (lastMsg as any)?.read_at ?? null,
          is_group: (memberCount ?? 0) > 2,
        });
      }

      // sort by last_at desc
      out.sort((a, b) => (b.last_at ?? "").localeCompare(a.last_at ?? ""));

      if (mounted) setThreads(out);
    })();

    return () => {
      mounted = false;
    };
  }, [meId]);

  // filter realtime
  const filtered = useMemo(() => {
    const q = ui.sidebarQuery.trim().toLowerCase();
    return threads.filter((t) => {
      // archived folder toggle
      const isArchived = prefs.isArchived(t.conversation_id);
      if (ui.showArchived) {
        if (!isArchived) return false;
      } else {
        if (isArchived) return false;
      }

      // chips
      if (ui.activeChip === "unread" && t.unread_count <= 0) return false;
      if (ui.activeChip === "fav" && !prefs.isFavorite(t.conversation_id)) return false;
      if (ui.activeChip === "group" && !t.is_group) return false;

      if (!q) return true;
      const name = (t.other_username ?? "").toLowerCase();
      const last = (t.last_body ?? "").toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }, [threads, ui.sidebarQuery, ui.activeChip, ui.showArchived, prefs]);

  const sorted = useMemo(() => {
    // pinned chats first (max 3 enforced in setter)
    const pinSet = prefs.pinnedSet();
    const a = [...filtered];
    a.sort((x, y) => {
      const xp = pinSet.has(x.conversation_id) ? 1 : 0;
      const yp = pinSet.has(y.conversation_id) ? 1 : 0;
      if (xp !== yp) return yp - xp;
      return (y.last_at ?? "").localeCompare(x.last_at ?? "");
    });
    return a;
  }, [filtered, prefs]);

  return (
    <div className="flex-1 overflow-auto">
      {sorted.map((t) => {
        const active = pathname?.includes(t.conversation_id);

        const mineLast = t.last_sender_id && t.last_sender_id === meId;
        const tick = !mineLast ? null : t.last_delivered_at ? "✓✓" : "✓";
        const tickClass = !mineLast ? "" : t.last_read_at ? "text-blue-400" : "text-white/60";

        const preview = previewText(t.last_type, t.last_body);
        const pinned = prefs.isPinned(t.conversation_id);
        const fav = prefs.isFavorite(t.conversation_id);
        const disappear = prefs.disappearLabel(t.conversation_id);

        return (
          <button
            key={t.conversation_id}
            onClick={() => router.push(`/chat/${t.conversation_id}`)}
            className={[
              "w-full px-4 py-3 flex items-center gap-3 border-b border-white/5 hover:bg-white/5 text-left",
              active ? "bg-white/10" : "bg-transparent",
            ].join(" ")}
          >
            <Avatar
              url={t.other_avatar_url}
              name={t.other_username ?? "?"}
              badge={disappear}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm truncate text-white flex items-center gap-2">
                  {t.other_username ?? "Unknown"}
                  {pinned && <span className="text-[11px] text-white/60">📌</span>}
                  {fav && <span className="text-[11px] text-yellow-300">★</span>}
                </div>
                <div className="text-[11px] text-white/50 whitespace-nowrap">
                  {t.last_at ? fmtClock(t.last_at) : ""}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-white/70 truncate flex items-center gap-2">
                  {tick && <span className={tickClass}>{tick}</span>}
                  <span className="truncate">{preview}</span>
                </div>

                {t.unread_count > 0 && (
                  <div className="min-w-[20px] h-5 px-2 rounded-full bg-[#25d366] text-[#111b21] text-[11px] grid place-items-center font-semibold">
                    {t.unread_count}
                  </div>
                )}
              </div>
            </div>

            {/* quick toggles (tap icons) */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prefs.togglePinned(t.conversation_id);
                    // force rerender
                    setThreads((x) => [...x]);
                  }}
                  className="w-7 h-7 rounded-full hover:bg-white/10 grid place-items-center text-white/70"
                  title="Pin"
                >
                  📌
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prefs.toggleFavorite(t.conversation_id);
                    setThreads((x) => [...x]);
                  }}
                  className="w-7 h-7 rounded-full hover:bg-white/10 grid place-items-center"
                  title="Favorite"
                >
                  <span className={fav ? "text-yellow-300" : "text-white/50"}>★</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prefs.toggleArchived(t.conversation_id);
                    setThreads((x) => [...x]);
                  }}
                  className="w-7 h-7 rounded-full hover:bg-white/10 grid place-items-center text-white/60"
                  title="Archive"
                >
                  🗄️
                </button>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Avatar({
  url,
  name,
  badge,
}: {
  url: string | null;
  name: string;
  badge: string | null;
}) {
  const letter = (name?.[0] ?? "?").toUpperCase();
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <div className="relative">
      <img src={url} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
      {badge && (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#202c33] border border-[#111b21] grid place-items-center text-[10px]">
          ⏱️
        </div>
      )}
    </div>
  ) : (
    <div className="relative">
      <div className="w-12 h-12 rounded-full bg-[#2a3942] flex items-center justify-center">
        <span className="text-sm font-semibold text-white">{letter}</span>
      </div>
      {badge && (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#202c33] border border-[#111b21] grid place-items-center text-[10px]">
          ⏱️
        </div>
      )}
    </div>
  );
}

function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function previewText(type: string | null, body: string | null) {
  if (type === "image") return "📷 Foto";
  if (type === "voice") return "🎤 Pesan suara";
  if (type === "file") return "📎 Dokumen";
  const t = (body ?? "—").trim();
  return t || "—";
}

function makePrefs(meId: string | null) {
  const safeKey = (suffix: string) => `wa:${suffix}:${meId ?? "anon"}`;

  const readSet = (k: string) => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const raw = window.localStorage.getItem(k);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(arr);
    } catch {
      return new Set<string>();
    }
  };

  const writeSet = (k: string, s: Set<string>) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(k, JSON.stringify(Array.from(s)));
  };

  const pinnedKey = safeKey("pinned");
  const favKey = safeKey("fav");
  const archKey = safeKey("arch");
  const disappearKey = safeKey("disappear"); // map convId -> label

  const pinnedSet = () => readSet(pinnedKey);
  const favSet = () => readSet(favKey);
  const archSet = () => readSet(archKey);

  const toggleWithLimit = (k: string, id: string, limit?: number) => {
    const s = readSet(k);
    if (s.has(id)) s.delete(id);
    else {
      if (limit && s.size >= limit) {
        // remove oldest
        const first = s.values().next().value as string | undefined;
        if (first) s.delete(first);
      }
      s.add(id);
    }
    writeSet(k, s);
  };

  return {
    pinnedSet,
    isPinned: (id: string) => pinnedSet().has(id),
    togglePinned: (id: string) => toggleWithLimit(pinnedKey, id, 3),

    isFavorite: (id: string) => favSet().has(id),
    toggleFavorite: (id: string) => toggleWithLimit(favKey, id),

    isArchived: (id: string) => archSet().has(id),
    toggleArchived: (id: string) => toggleWithLimit(archKey, id),

    disappearLabel: (id: string) => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(disappearKey);
        const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
        return map[id] ?? null;
      } catch {
        return null;
      }
    },
  };
}
