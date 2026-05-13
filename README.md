# Next Gen

> A collaborative AI learning project — a group of friends figuring out AI tools together, guided by the Paperclip AI agent team.

## Intro challenge — start here

If you were invited to join Next Gen, your first task is the **intro questionnaire challenge**. It's how you say hi, tell us about yourself, and (more importantly) get your first reps with GitHub + your AI assistant working together.

**The flow:**

1. **Fork** this repo to your own GitHub account.
2. **Copy** [`questionnaire.md`](./questionnaire.md) to `submissions/<your-name>.md` (e.g., `submissions/alex.md`).
3. **Fill it in** — use your AI assistant to help with anything you get stuck on. That's the point.
4. **Open a Pull Request** back to `Juarez-labs/next-gen`.
5. We review, merge, and you're in.

See [`submissions/example-submission.md`](./submissions/example-submission.md) for a sample of the expected format.

> Stuck on any step (forking, cloning, PRs)? Ask your AI assistant — "walk me through forking and submitting a PR to a GitHub repo" is a great prompt. Getting comfortable doing this _with_ AI is half the exercise.

---

## What is this?

**Next Gen** is a shared workspace for a group of friends who want to learn how to use AI tools effectively. We experiment, share notes, build things together, and develop good habits for collaborating with (and around) AI.

This repo is the home base for our experiments, mini-projects, notes, and shared resources. The Paperclip AI agent team helps guide structure and direction so we can spend more time learning and less time wrestling with setup.

## Goals

- **Learn AI tools.** Hands-on practice with the tools that are reshaping how we work.
- **Build things together.** Small, real projects beat passive tutorials.
- **Develop good collaboration habits.** Branching, PRs, code review, writing things down — skills that compound.
- **Have fun.** This should feel like a clubhouse, not homework.

## How to get involved

1. **Get added to the repo.** Ask Jose for an invite to the `Juarez-labs/next-gen` GitHub repo.
2. **Clone it locally** and poke around.
3. **Pick (or propose) something to work on.** Open an issue, claim one, or jump into an existing experiment.
4. **Push small, push often.** Branches and PRs over giant dumps. See [Contributing](#contributing) below.
5. **Ask questions in the open.** A question in an issue helps everyone, not just you.

For the full collaboration guide and onboarding details, see the linked Paperclip issue (ask Jose for the link if you don't have it yet).

## Suggested repo structure

We're keeping this lightweight to start. As things grow, organize work into folders like:

```
/experiments   — quick tests, prompt drafts, throwaway scripts
/projects      — longer-running mini-projects (one folder per project)
/notes         — write-ups, learnings, "what worked / what didn't"
/resources     — curated links, cheat sheets, reading lists
```

Folders get created as we need them — no need to scaffold empty directories.

## Current builds

- [`loteria/`](./loteria) — **Lotería Game Builder**. A Next.js 16 + Supabase app for designing custom Lotería decks, generating balanced boards, and exporting printable PDFs. AI card art via Higgsfield. See [`loteria/README.md`](./loteria/README.md). Tracked under the Loteria App initiative (BOAA-397).
- [`supabase/migrations/`](./supabase/migrations) — DB schema for the Lotería app.

## Who we are

A group of friends, at different starting points, learning AI together. Some of us code regularly, some are just getting started — and that's exactly the point. The mix is the feature.

## Contributing

A few light norms to keep things smooth:

- **Branches:** use a short, descriptive branch name like `experiment/voice-cloning-test` or `notes/week-1-recap`. Keep `main` clean.
- **Pull requests:** open a PR for anything you want feedback on, or anything going into a `/projects` folder. Small PRs > giant PRs.
- **Commit messages:** a short summary line, present-tense ("add prompt examples", not "added prompt examples"). Detail in the body if needed.
- **Be kind in reviews.** Assume good intent. We're all learning. Praise what's good, suggest gently, never dunk.
- **Write things down.** If you figured something out, drop a note in `/notes` so the next person doesn't have to re-discover it.

## Questions?

Open an issue, ping Jose, or ask the Paperclip agent team. No question is too small.
