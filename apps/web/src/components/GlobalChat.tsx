'use client';

import { usePathname } from 'next/navigation';
import ChatWidget from './ChatWidget';
import { useCurrentUser } from './UserMenu';

// Pages without the floating chat: signed-out pages, the full-page chat, and the
// architecture map (which mounts its own chat with the selected node as context).
const HIDDEN = [/^\/$/, /^\/login$/, /^\/register$/, /^\/projects\/[^/]+\/architecture$/, /^\/projects\/[^/]+\/chat$/];

// The AI chat button, fixed at the bottom-right on every signed-in page.
// Inside a project it chats about that project; elsewhere it offers a project picker.
export default function GlobalChat() {
  const pathname = usePathname() || '/';
  const { hasToken } = useCurrentUser();
  if (!hasToken || HIDDEN.some((re) => re.test(pathname))) return null;
  const match = /^\/projects\/([0-9a-fA-F-]{36})(?:\/|$)/.exec(pathname);
  const projectId = match ? match[1] : null;
  return <ChatWidget key={projectId ?? 'all-projects'} projectId={projectId} />;
}
