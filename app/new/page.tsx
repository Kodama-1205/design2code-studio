import NewWizard from "@/components/NewWizard";

export default function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const projectId =
    typeof searchParams.projectId === "string" ? searchParams.projectId : undefined;

  const sourceUrl =
    typeof searchParams.sourceUrl === "string" ? searchParams.sourceUrl : undefined;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <NewWizard projectId={projectId} sourceUrl={sourceUrl ?? ""} />
    </div>
  );
}
