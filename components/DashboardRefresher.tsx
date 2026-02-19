"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ダッシュボード表示時に Router Cache を無効化し、最新データを取得する
 * - クライアントナビゲーションで遷移した場合、古いキャッシュが表示されるのを防ぐ
 * - 第三者ユーザーが生成後にダッシュボードへ戻った際、リロードなしで最新一覧を表示
 */
export default function DashboardRefresher() {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, [router]);

  return null;
}
