"use client";

import { useMemo } from "react";
import { clsx } from "clsx";

function buildTree(paths: string[]) {
  type Node = { name: string; path: string; children: Map<string, Node>; isFile: boolean };
  const root: Node = { name: "", path: "", children: new Map(), isFile: false };

  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    let cur = root;
    let acc = "";
    parts.forEach((part, idx) => {
      acc = acc ? `${acc}/${part}` : part;
      const isFile = idx === parts.length - 1;
      if (!cur.children.has(part)) {
        cur.children.set(part, { name: part, path: acc, children: new Map(), isFile });
      }
      cur = cur.children.get(part)!;
      cur.isFile = isFile;
    });
  }
  return root;
}

function sortChildren(node: ReturnType<typeof buildTree>) {
  const entries = Array.from(node.children.values());
  entries.sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

export default function FileTree({
  paths,
  selected,
  onSelect
}: {
  paths: string[];
  selected: string;
  onSelect: (path: string) => void;
}) {
  const tree = useMemo(() => buildTree(paths), [paths]);

  function render(node: any, depth: number) {
    const children = sortChildren(node);
    return (
      <div key={node.path}>
        {node.path && (
          <button
            onClick={() => node.isFile && onSelect(node.path)}
            className={clsx(
              "w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-b border-[rgba(255,255,255,0.03)]",
              node.isFile ? "hover:bg-[rgba(255,255,255,0.03)]" : "opacity-80",
              selected === node.path && "bg-[rgba(170,90,255,0.10)]"
            )}
            style={{ paddingLeft: 12 + depth * 12 }}
            disabled={!node.isFile}
          >
            <span className="text-[rgb(var(--muted))]">{node.isFile ? "📄" : "📁"}</span>
            <span className="truncate">{node.name}</span>
          </button>
        )}
        {children.map((c) => render(c, depth + 1))}
      </div>
    );
  }

  return <div className="py-1">{render(tree, 0)}</div>;
}
