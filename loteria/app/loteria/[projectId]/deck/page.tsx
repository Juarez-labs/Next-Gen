import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DeckPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Deck</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Project <span className="font-mono">{projectId}</span> — review, edit, and regenerate the
          54 cards.
        </p>
      </header>
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Deck management coming soon</CardTitle>
          <CardDescription>
            Card concept generation, Higgsfield image generation, and per-card approve/regenerate
            controls will live here. See BOAA-400 for the image generation track.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          54 cards × prompt template → Higgsfield <code>generate_image</code> → approve/regenerate.
        </CardContent>
      </Card>
    </div>
  );
}
