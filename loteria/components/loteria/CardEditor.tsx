"use client";

// Per-card review + regenerate control.
//
// Wraps a single card row, surfaces its current artwork (or a placeholder
// when none exists), and exposes three actions:
//   - Approve / unapprove
//   - Regenerate via Higgsfield (POST /api/loteria/generate-card-image)
//   - Replace with a manual URL (PATCH /api/loteria/cards/:id/image)
//
// Polls /api/loteria/job-status/:jobId every 3s when a job is in flight.

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type JobStatus = "queued" | "processing" | "succeeded" | "failed" | "cancelled";

export interface CardEditorCard {
  id: string;
  card_number: number;
  english_name: string;
  spanish_name: string;
  description: string | null;
  image_url: string | null;
  approved: boolean;
  version: number;
}

interface GenerationJob {
  id: string;
  status: JobStatus;
  image_url: string | null;
  error: string | null;
}

interface CardEditorProps {
  card: CardEditorCard;
  /** Optional callback fired whenever the card mutates (approve/regen/upload). */
  onCardChange?: (card: CardEditorCard) => void;
}

const POLL_INTERVAL_MS = 3000;

export function CardEditor({ card: initialCard, onCardChange }: CardEditorProps) {
  const [card, setCard] = React.useState<CardEditorCard>(initialCard);
  const [job, setJob] = React.useState<GenerationJob | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const updateCard = React.useCallback(
    (next: CardEditorCard) => {
      setCard(next);
      onCardChange?.(next);
    },
    [onCardChange],
  );

  // Apply a job update — bumps the card if the job has succeeded, otherwise
  // just records the new status.
  const applyJob = React.useCallback(
    (next: GenerationJob) => {
      setJob(next);
      if (next.status === "succeeded" && next.image_url) {
        updateCard({
          ...card,
          image_url: next.image_url,
          approved: false,
          version: card.version + 1,
        });
      }
    },
    [card, updateCard],
  );

  // --- Regenerate via Higgsfield ---
  const regenerate = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/loteria/generate-card-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, mode: "text_to_image" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `submission failed (${res.status})`);
      }
      const data = (await res.json()) as { job: GenerationJob };
      applyJob(data.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "regenerate failed");
    } finally {
      setBusy(false);
    }
  }, [card.id, applyJob]);

  // --- Upload override ---
  const replaceWithUrl = React.useCallback(
    async (imageUrl: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/loteria/cards/${card.id}/image`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `replace failed (${res.status})`);
        }
        const data = (await res.json()) as { card: Partial<CardEditorCard> };
        updateCard({ ...card, ...data.card } as CardEditorCard);
      } catch (err) {
        setError(err instanceof Error ? err.message : "upload failed");
      } finally {
        setBusy(false);
      }
    },
    [card, updateCard],
  );

  // --- Approve toggle ---
  const toggleApproved = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/loteria/cards/${card.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: !card.approved }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `approve failed (${res.status})`);
      }
      const data = (await res.json()) as { card: Partial<CardEditorCard> };
      updateCard({ ...card, ...data.card } as CardEditorCard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "approve failed");
    } finally {
      setBusy(false);
    }
  }, [card, updateCard]);

  // --- Poll the active job until terminal ---
  React.useEffect(() => {
    if (!job) return;
    if (
      job.status === "succeeded" ||
      job.status === "failed" ||
      job.status === "cancelled"
    ) {
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/loteria/job-status/${job.id}`);
        if (!res.ok) throw new Error(`poll failed (${res.status})`);
        const data = (await res.json()) as { job: GenerationJob };
        if (!cancelled) applyJob(data.job);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "poll failed");
        }
      }
    };

    const handle = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [job, applyJob]);

  const generating =
    job?.status === "queued" || job?.status === "processing";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle className="text-base">
            {String(card.card_number).padStart(2, "0")} · {card.english_name}
          </CardTitle>
          <span
            className={
              "rounded-full px-2 py-0.5 text-xs font-medium " +
              (card.approved
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200")
            }
          >
            {card.approved ? "Approved" : "Draft"}
          </span>
        </div>
        <CardDescription>{card.spanish_name}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          {card.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image_url}
              alt={`${card.english_name} artwork`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
              No artwork yet
            </div>
          )}
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
              Generating… ({job?.status})
            </div>
          )}
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={card.approved ? "outline" : "default"}
          disabled={busy || !card.image_url}
          onClick={toggleApproved}
        >
          {card.approved ? "Unapprove" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || generating}
          onClick={regenerate}
        >
          Regenerate
        </Button>
        <UploadButton disabled={busy || generating} onSubmit={replaceWithUrl} />
      </CardFooter>
    </Card>
  );
}

function UploadButton({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (url: string) => void;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={disabled}
      onClick={() => {
        const url = window.prompt(
          "Paste the URL of the replacement artwork (must be http(s)).",
        );
        if (url && url.trim().length > 0) onSubmit(url.trim());
      }}
    >
      Replace…
    </Button>
  );
}

/**
 * Compact batch progress indicator.
 * Renders a single progress bar + numeric "x / N" label.
 */
export interface BatchProgressProps {
  completed: number;
  total: number;
  label?: string;
}

export function BatchProgress({ completed, total, label }: BatchProgressProps) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
        <span>{label ?? "Generation progress"}</span>
        <span>
          {completed} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
