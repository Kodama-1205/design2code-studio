import NewWizard from "@/components/NewWizard";

export default function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const projectId = typeof searchParams.projectId === "string" ? searchParams.projectId : undefined;
  return (
    <div className="container-max py-10">
      <NewWizard projectId={projectId} />
    </div>
  );
}
