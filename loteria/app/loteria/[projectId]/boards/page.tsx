import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BoardsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Boards</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Project <span className="font-mono">{projectId}</span> — generate, validate, and lock
          board layouts.
        </p>
      </header>
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Board generator coming soon</CardTitle>
          <CardDescription>
            4×4 boards · casual random / balanced / perfect-balance / corner-balanced modes ·
            validation report before export. See BOAA-399.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          Each board: 16 unique cards · TABLA XX label · seeded · locked to DB before export.
        </CardContent>
      </Card>
    </div>
  );
}
