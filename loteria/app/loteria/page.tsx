import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Placeholder data until Supabase is wired up end-to-end. Replace with a server
// component fetch (`createClient().from('projects').select()`) once env vars are set.
type ProjectListItem = {
  id: string;
  name: string;
  theme: string;
  status: "draft" | "in_progress" | "ready" | "exported" | "archived";
  updatedAt: string;
};

const SAMPLE_PROJECTS: ProjectListItem[] = [];

export default function LoteriaLandingPage() {
  const projects = SAMPLE_PROJECTS;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Your Lotería projects</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Create themed decks, generate balanced boards, and export printable PDFs.
          </p>
        </div>
        <Button disabled title="Wire up Supabase + project creation flow (BOAA-399 / future work)">
          + Create new game
        </Button>
      </header>

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Once Supabase env vars are configured, your saved projects will appear here. Use{" "}
              <span className="font-mono">+ Create new game</span> to start a fresh deck.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-zinc-500">
            <ul className="list-disc space-y-1 pl-5">
              <li>Pick a theme, tone, and audience.</li>
              <li>Generate 54 cards via Higgsfield AI.</li>
              <li>Lay out boards, validate, and export printable PDFs.</li>
            </ul>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Card>
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>{project.theme}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs uppercase tracking-wide text-zinc-500">
                  {project.status.replace("_", " ")}
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Link href={`/loteria/${project.id}/deck`}>
                    <Button size="sm" variant="outline">Open deck</Button>
                  </Link>
                  <Link href={`/loteria/${project.id}/boards`}>
                    <Button size="sm" variant="ghost">Boards</Button>
                  </Link>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
