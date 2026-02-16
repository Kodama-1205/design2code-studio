import NewWizard from "@/components/NewWizard";

export default function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const projectId =
    typeof searchParams.projectId === "string" ? searchParams.projectId : undefined;

  // 再生成導線用：sourceUrl をクエリから拾う（UI/レイアウトは変更しない）
  const sourceUrl =
    typeof searchParams.sourceUrl === "string" ? searchParams.sourceUrl : undefined;

  // NOTE:
  // NewWizard がまだ sourceUrl を受け取れない場合は、次に NewWizard 側を「レイアウトそのまま」で対応する
  return (
    <div className="container-max py-10">
      <NewWizard projectId={projectId} sourceUrl={sourceUrl} />
    </div>
  );
}
