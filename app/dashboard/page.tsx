"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import DashboardProjectsGrid from "@/components/DashboardProjectsGrid";

export default function Page() {
  const [last, setLast] = useState<null | { projectId: string; generationId: string }>(null);

  useEffect(() => {
    try {
      const projectId = sessionStorage.getItem("d2c_last_project_id") ?? "";
      const generationId = sessionStorage.getItem("d2c_last_generation_id") ?? "";
      if (projectId && generationId) setLast({ projectId, generationId });
    } catch {
      setLast(null);
    }
  }, []);

  return (
    <div className="container-max py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="h1">ダッシュボード</h1>
          <p className="p-muted mt-2">プロジェクト一覧を表示します。</p>
        </div>
        <div className="flex gap-2">
          <Button href="/" variant="secondary">
            TOPへ戻る
          </Button>
          {last ? (
            <Button href={`/projects/${last.projectId}/generations/${last.generationId}`} variant="primary">
              リザルトへ戻る
            </Button>
          ) : (
            <Button disabled variant="secondary">
              リザルトへ戻る
            </Button>
          )}
        </div>
      </div>

      <DashboardProjectsGrid emptyAction="top" />
    </div>
  );
}

