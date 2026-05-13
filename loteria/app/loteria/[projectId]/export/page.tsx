import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Project <span className="font-mono">{projectId}</span> — produce printable PDFs and the
          project ZIP.
        </p>
      </header>
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Export pipeline coming soon</CardTitle>
          <CardDescription>
            Puppeteer-rendered boards (5 per PDF), caller deck PDF, card index CSV, rules sheet,
            project ZIP. See BOAA-401.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          Validation must pass before exports unlock.
        </CardContent>
      </Card>
    </div>
  );
}
