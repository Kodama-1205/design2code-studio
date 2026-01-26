import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function EmptyState({
  title,
  description,
  actionHref,
  actionLabel
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <Card className="p-8 text-center">
      <div className="text-lg font-semibold">{title}</div>
      <div className="p-muted mt-2">{description}</div>
      <div className="mt-6 flex justify-center">
        <Button href={actionHref} variant="primary">
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}
