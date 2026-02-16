import Card from "@/components/ui/Card";

export default async function Page() {
  return (
    <div className="container-max py-10">
      <div>
        <h1 className="h1">Design2Code Studio</h1>
        <p className="p-muted mt-2">
          Figma URL からコードを生成し、プレビュー・コード確認・ZIP出力まで行うデモ実装（MVP骨組み）です。
          保存済みの生成結果一覧は「ダッシュボード」に集約します。
        </p>
      </div>

      <Card className="p-6 mt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="h2">取扱説明（使い方）</div>
            <p className="p-muted mt-2">
              本アプリは、Figma のURLを入力してコード生成（現状はモック）→ 結果確認 → ZIP出力 を行います。
              保存が有効な場合は、生成結果がダッシュボードに保存されます。
            </p>
          </div>
          <span className="badge">MVP</span>
        </div>

        <div className="mt-4 rounded-2xl border border-[rgb(var(--border))] bg-[rgba(var(--accent),0.08)] p-4">
          <div className="text-sm font-semibold">プレビュー画像（サムネイル）について</div>
          <p className="p-muted mt-2 text-sm">
            Figma のプレビュー画像URLは <span className="font-semibold text-[rgb(var(--text))]">最大30日で失効</span> します。
            画像が表示されない場合は、ダッシュボードから「再生成」または「再取得」で最新の画像を取得してください。
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
            <div className="text-sm font-semibold">① 生成する</div>
            <div className="p-muted mt-1 text-sm">
              右上の「新規作成」へ進み、Figma の Frame URL（node-id 付き推奨）を貼り付けて「生成」を押します。
            </div>
            <div className="p-muted mt-2 text-xs">
              例：<code>https://www.figma.com/design/XXX/YYY?node-id=12%3A345</code>
            </div>
          </div>

          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
            <div className="text-sm font-semibold">② 結果を見る</div>
            <div className="p-muted mt-1 text-sm">
              生成が完了すると、結果ページで「プレビュー / コード / レポート / マッピング」を確認できます。
            </div>
          </div>

          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
            <div className="text-sm font-semibold">③ ZIP出力する</div>
            <div className="p-muted mt-1 text-sm">
              結果ページの「ZIP出力」から、生成ファイル一式をまとめてダウンロードできます。
            </div>
          </div>

          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgba(var(--accent),0.08)] p-4">
            <div className="text-sm font-semibold">よくあるエラー</div>
            <ul className="mt-2 space-y-2 text-sm text-[rgb(var(--muted))]">
              <li>
                <span className="text-[rgb(var(--text))] font-semibold">Generate failed</span>：
                Supabase の環境変数（URL / Secret key / Owner ID）が未設定、またはDBテーブル未作成の可能性があります。
              </li>
              <li>
                <span className="text-[rgb(var(--text))] font-semibold">URL解析がうまくいかない</span>：
                Figma URL は <code>/file/</code> と <code>/design/</code> の両形式があります。最新版コードを使用してください。
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
