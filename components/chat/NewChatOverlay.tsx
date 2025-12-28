"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Profile = { id: string; username: string | null; avatar_url: string | null };

export default function NewChatOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [meId, setMeId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  async function search() {
    if (!q.trim()) return setResults([]);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${q}%`)
      .limit(20);

    setResults((data ?? []).filter((u) => u.id !== meId));
  }

  async function startChat(otherId: string) {
    const { data } = await supabase.rpc("find_or_create_conversation", { other_user: otherId });
    if (data) router.push(`/chat/${data}`);
    onClose();
  }

  return (
    <div className="absolute inset-0 bg-black/40 z-40 flex">
      <div className="w-[380px] bg-white text-[#111827] h-full border-r border-[#d1d7db]">
        <div className="h-14 px-3 bg-[#f0f2f5] flex items-center justify-between border-b border-[#d1d7db]">
          <div className="font-medium text-sm">New Chat</div>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded hover:bg-black/5">✕</button>
        </div>

        <div className="p-3">
          <div className="bg-[#f0f2f5] rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-gray-500">🔎</span>
            <input
              className="bg-transparent outline-none text-sm w-full text-[#111827] placeholder:text-gray-500"
              placeholder="Cari username..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <button className="text-sm px-2 py-1 rounded hover:bg-black/5" onClick={search}>
              Cari
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => startChat(u.id)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-black/5 text-left"
              >
                <Avatar url={u.avatar_url} name={u.username ?? "?"} />
                <div className="text-sm font-medium">{u.username ?? "Unknown"}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button className="flex-1" onClick={onClose} />
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
