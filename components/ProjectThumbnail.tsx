"use client";

import { useState } from "react";

/**
 * ダッシュボード用の小さいサムネイル
 * - 読み込み失敗時は「画像なし」プレースホルダーを表示
 */
export default function ProjectThumbnail({
  src,
  href,
  size = { width: 72, height: 54 },
}: {
  src: string;
  href: string;
  size?: { width: number; height: number };
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="shrink-0 rounded border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/10 flex items-center justify-center text-[10px] text-[rgb(var(--muted))]"
        style={{ width: size.width, height: size.height }}
      >
        画像なし
      </div>
    );
  }

  return (
    <a
      href={href}
      className="shrink-0 rounded border border-[rgb(var(--border))] overflow-hidden bg-[rgb(var(--muted))]/10"
      style={{ width: size.width, height: size.height }}
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        width={size.width}
        height={size.height}
        onError={() => setFailed(true)}
      />
    </a>
  );
}
