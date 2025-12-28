// components/chat/ChatConversation.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useChatUI } from "./store";
import AttachmentMenu from "./AttachmentMenu";
import EmojiPicker from "./EmojiPicker";
import MessageContextMenu from "./MessageContextMenu";

type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
};

type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
};

export default function ChatConversation() {
  const router = useRouter();
  const params = useParams<{ conversationId: string }>();
  const convId = params.conversationId;

  const ui = useChatUI();

  const [meId, setMeId] = useState<string | null>(null);
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const grouped = useMemo(() => {
    const groups: { day: string; items: Msg[] }[] = [];
    const fmtDay = (iso: string) =>
      new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });

    const filtered = ui.chatSearchOpen && ui.chatSearchQuery.trim()
      ? messages.filter((m) => (m.body ?? "").toLowerCase().includes(ui.chatSearchQuery.toLowerCase()))
      : messages;

    for (const m of filtered) {
      const day = fmtDay(m.created_at);
      const last = groups[groups.length - 1];
      if (!last || last.day !== day) groups.push({ day, items: [m] });
      else last.items.push(m);
    }
    return groups;
  }, [messages, ui.chatSearchOpen, ui.chatSearchQuery]);

  function scrollBottom(smooth = true) {
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" }),
      30
    );
  }

  async function markDeliveredRead(uid: string) {
    if (!uid || !convId) return;

    await supabase
      .from("messages")
      .update({ delivered_at: new Date().toISOString() })
      .eq("conversation_id", convId)
      .neq("sender_id", uid)
      .is("delivered_at", null);

    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", convId)
      .neq("sender_id", uid)
      .is("read_at", null);
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;

      if (!uid) {
        router.replace("/auth/login");
        return;
      }
      if (!mounted) return;
      setMeId(uid);

      const { data: otherId } = await supabase.rpc("get_conversation_peer", { conv_id: convId });
      if (otherId) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, last_seen_at")
          .eq("id", otherId)
          .single();
        if (mounted) setOther((p ?? null) as any);
      }

      const { data: hist } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at, delivered_at, read_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(150);

      if (!mounted) return;
      setMessages((hist ?? []) as any);
      scrollBottom(false);
      await markDeliveredRead(uid);
    })();

    return () => {
      mounted = false;
    };
  }, [convId, router]);

  useEffect(() => {
    const ch = supabase
      .channel(`messages:${convId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        async (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => [...prev, m]);
          scrollBottom(true);
          if (meId) await markDeliveredRead(meId);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const next = payload.new as Msg;
          setMessages((prev) => prev.map((m) => (m.id === next.id ? { ...m, ...next } : m)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [convId, meId]);

  async function sendOrEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!meId) return;

    const body = ui.composerText.trim();
    if (!body) return;

    // EDIT MODE
    if (ui.editingMessageId) {
      const { error } = await supabase
        .from("messages")
        .update({ body })
        .eq("id", ui.editingMessageId);

      if (error) alert(error.message);
      ui.resetComposer();
      return;
    }

    // SEND MODE
    ui.set({ composerText: "" });

    const { error } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: meId,
      body,
      type: "text",
      // Agar “langsung biru” sesuai request kamu:
      delivered_at: new Date().toISOString(),
      read_at: new Date().toISOString(),
    });

    if (error) alert(error.message);
  }

  const isTyping = ui.composerText.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="h-14 bg-[#f0f2f5] border-b border-[#d1d7db] px-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button className="md:hidden text-sm px-2 py-1 rounded hover:bg-black/5" onClick={() => router.push("/chat")}>
            ←
          </button>

          <Avatar url={other?.avatar_url ?? null} name={other?.username ?? "Chat"} />

          <button
            className="min-w-0 text-left"
            onClick={() => ui.set({ showContactInfo: !ui.showContactInfo })}
            title="Open contact info"
          >
            <div className="text-sm font-medium truncate">{other?.username ?? "Chat"}</div>
            <div className="text-xs text-gray-600 truncate">
              {other?.last_seen_at ? `last seen ${fmtClock(other.last_seen_at)}` : "online"}
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Search inside chat */}
          <button
            className="w-9 h-9 rounded-full hover:bg-black/5 grid place-items-center"
            title="Search"
            onClick={() => ui.set({ chatSearchOpen: !ui.chatSearchOpen })}
          >
            🔍
          </button>

          {/* Profile shortcut (opsional) */}
          <button className="w-9 h-9 rounded-full hover:bg-black/5 grid place-items-center" title="Profile" onClick={() => router.push("/profile")}>
            ⚙️
          </button>
        </div>
      </div>

      {/* Search bar inside chat */}
      {ui.chatSearchOpen && (
        <div className="px-3 py-2 border-b border-[#d1d7db] bg-white">
          <input
            className="w-full bg-[#f0f2f5] rounded-lg px-3 py-2 text-sm outline-none"
            placeholder="Cari di chat..."
            value={ui.chatSearchQuery}
            onChange={(e) => ui.set({ chatSearchQuery: e.target.value })}
          />
        </div>
      )}

      {/* Messages area (WA wallpaper) */}
      <div className="flex-1 overflow-auto px-4 py-3 wa-wallpaper-amoled">
        {/* System message */}
        <div className="flex justify-center my-3">
          <div className="text-[12px] px-3 py-2 rounded-lg bg-[#fff3c4] text-[#5c4b00] shadow-sm">
            Messages are end-to-end encrypted
          </div>
        </div>

        {grouped.map((g) => (
          <div key={g.day} className="mb-4">
            <div className="flex justify-center mb-3">
              <div className="text-[11px] px-3 py-1 rounded-full bg-white/70 text-gray-700 shadow-sm">
                {g.day}
              </div>
            </div>

            <div className="space-y-2">
              {g.items.map((m) => {
                const mine = m.sender_id === meId;

                const status = !mine ? null : m.delivered_at ? "✓✓" : "✓";
                const statusClass = !mine ? "" : m.read_at ? "text-blue-600" : "text-gray-500";

                return (
                  <MessageBubble
                    key={m.id}
                    mine={mine}
                    body={m.body ?? ""}
                    time={fmtClock(m.created_at)}
                    status={status}
                    statusClass={statusClass}
                    onEdit={() => ui.set({ editingMessageId: m.id, composerText: m.body ?? "" })}
                    onDelete={async () => {
                      await supabase.from("messages").delete().eq("id", m.id);
                    }}
                    onReply={() => ui.set({ replyingToMessageId: m.id })}
                  />
                );
              })}
              <div ref={bottomRef} />
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <form className="h-16 bg-[#f0f2f5] border-t border-[#d1d7db] px-3 flex items-center gap-2" onSubmit={sendOrEdit}>
        {/* Emoji */}
        <div className="relative">
          <button
            type="button"
            className="w-10 h-10 rounded-full hover:bg-black/5 grid place-items-center"
            onClick={() => setShowEmoji((v) => !v)}
            title="Emoji"
          >
            😀
          </button>
          {showEmoji && (
            <EmojiPicker
              onPick={(emoji) => ui.set({ composerText: ui.composerText + emoji })}
              onClose={() => setShowEmoji(false)}
            />
          )}
        </div>

        {/* Attachment */}
        <div className="relative">
          <button
            type="button"
            className="w-10 h-10 rounded-full hover:bg-black/5 grid place-items-center"
            onClick={() => setShowAttach((v) => !v)}
            title="Attach"
          >
            ＋
          </button>
          {showAttach && <AttachmentMenu onClose={() => setShowAttach(false)} />}
        </div>

        {/* Input */}
        <input
          className="flex-1 bg-white rounded-full px-4 py-2 text-sm outline-none"
          placeholder={ui.editingMessageId ? "Edit pesan..." : "Ketik pesan"}
          value={ui.composerText}
          onChange={(e) => ui.set({ composerText: e.target.value })}
        />

        {/* Mic/Send */}
        {isTyping ? (
          <button className="w-10 h-10 rounded-full bg-[#25d366] text-white grid place-items-center" title="Send">
            ➤
          </button>
        ) : (
          <button
            type="button"
            className="w-10 h-10 rounded-full hover:bg-black/5 grid place-items-center"
            title="Mic (v2)"
            onClick={() => alert("Voice note v2")}
          >
            🎤
          </button>
        )}
      </form>
    </div>
  );
}

function MessageBubble({
  mine,
  body,
  time,
  status,
  statusClass,
  onEdit,
  onDelete,
  onReply,
}: {
  mine: boolean;
  body: string;
  time: string;
  status: string | null;
  statusClass: string;
  onEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="relative max-w-[75%]">
        <div
          ref={bubbleRef}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen(true);
          }}
          onMouseEnter={() => setMenuOpen(false)}
          className={[
            "rounded-lg px-3 py-2 text-sm shadow-sm bubble",
            mine ? "bg-[#dcf8c6] bubble-out" : "bg-white bubble-in",
          ].join(" ")}
        >
          <div className="whitespace-pre-wrap break-words">{body}</div>
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500">
            <span>{time}</span>
            {mine && status && <span className={statusClass}>{status}</span>}
          </div>

          {/* hover trigger */}
          <button
            type="button"
            className="absolute top-1 right-1 text-xs opacity-0 hover:opacity-100 bubble-menu-trigger"
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu"
          >
            ▾
          </button>
        </div>

        {menuOpen && (
          <MessageContextMenu
            onClose={() => setMenuOpen(false)}
            onReply={() => {
              setMenuOpen(false);
              onReply();
            }}
            onEdit={() => {
              setMenuOpen(false);
              onEdit();
            }}
            onDelete={async () => {
              setMenuOpen(false);
              onDelete();
            }}
          />
        )}
      </div>
    </div>
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

function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
