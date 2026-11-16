// Prefix tree (trie) for fast as-you-type search.
//
// Every item is indexed under its full name and under each "word" inside the name
// (split on _ - . / spaces and camelCase), so "user" finds both "UserService" and
// "get_user_by_id". Lookup costs O(length of the query), then walks only the matching
// subtree, collecting at most `limit` items.

type TrieNode<T> = {
  children: Map<string, TrieNode<T>>;
  items: Map<string, { item: T; rank: number }>; // items whose key ends exactly here
};

const newNode = <T,>(): TrieNode<T> => ({ children: new Map(), items: new Map() });

export function tokenize(text: string): string[] {
  const spaced = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // fooBar -> foo Bar
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); // HTTPServer -> HTTP Server
  return spaced
    .split(/[\s_\-./:\\]+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean);
}

export class Trie<T> {
  private root: TrieNode<T> = newNode<T>();
  private getId: (item: T) => string;

  constructor(getId: (item: T) => string) {
    this.getId = getId;
  }

  private insertKey(key: string, item: T, rank: number) {
    let node = this.root;
    for (const ch of key) {
      let next = node.children.get(ch);
      if (!next) {
        next = newNode<T>();
        node.children.set(ch, next);
      }
      node = next;
    }
    const id = this.getId(item);
    const existing = node.items.get(id);
    if (!existing || existing.rank > rank) node.items.set(id, { item, rank });
  }

  /** Index `item` under its full name (best rank) and every word in it. */
  insert(name: string, item: T) {
    const full = name.toLowerCase().trim();
    if (!full) return;
    this.insertKey(full, item, 0);
    tokenize(name).forEach((token) => this.insertKey(token, item, 1));
  }

  /**
   * Items whose name, or any word in it, starts with `prefix`.
   * Ranked: exact match, then full-name prefix, then word prefix; shorter names first.
   */
  search(prefix: string, limit = 20, nameOf?: (item: T) => string): T[] {
    const q = prefix.toLowerCase().trim();
    if (!q) return [];
    let node: TrieNode<T> | undefined = this.root;
    for (const ch of q) {
      node = node.children.get(ch);
      if (!node) return [];
    }

    const found = new Map<string, { item: T; rank: number }>();
    const stack: TrieNode<T>[] = [node];
    // Collect generously, then sort, so ranking is not decided by traversal order
    const cap = Math.max(limit * 10, 200);
    while (stack.length && found.size < cap) {
      const current = stack.pop()!;
      current.items.forEach(({ item, rank }, id) => {
        const prev = found.get(id);
        if (!prev || prev.rank > rank) found.set(id, { item, rank });
      });
      current.children.forEach((child) => stack.push(child));
    }

    const score = ({ item, rank }: { item: T; rank: number }) => {
      const name = (nameOf ? nameOf(item) : '').toLowerCase();
      if (name === q) return -1;
      return rank;
    };
    return Array.from(found.values())
      .sort((a, b) => {
        const d = score(a) - score(b);
        if (d !== 0) return d;
        const an = nameOf ? nameOf(a.item).length : 0;
        const bn = nameOf ? nameOf(b.item).length : 0;
        return an - bn;
      })
      .slice(0, limit)
      .map((r) => r.item);
  }
}
