// components/chat/store.ts
"use client";

import { create } from "zustand";

type UIState = {
  showStatusOverlay: boolean;
  showNewChatOverlay: boolean;
  showMenuDropdown: boolean;

  showContactInfo: boolean;
  chatSearchOpen: boolean;
  chatSearchQuery: string;

  composerText: string;
  editingMessageId: string | null;
  replyingToMessageId: string | null;

  sidebarQuery: string;
  /** Android-like chips filter */
  activeChip: "all" | "unread" | "fav" | "group";
  /** Toggle archived folder view */
  showArchived: boolean;

  set: (patch: Partial<UIState>) => void;
  resetComposer: () => void;
};

export const useChatUI = create<UIState>((set) => ({
  showStatusOverlay: false,
  showNewChatOverlay: false,
  showMenuDropdown: false,

  showContactInfo: false,
  chatSearchOpen: false,
  chatSearchQuery: "",

  composerText: "",
  editingMessageId: null,
  replyingToMessageId: null,

  sidebarQuery: "",
  activeChip: "all",
  showArchived: false,

  set: (patch) => set(patch),
  resetComposer: () => set({ composerText: "", editingMessageId: null, replyingToMessageId: null }),
}));
