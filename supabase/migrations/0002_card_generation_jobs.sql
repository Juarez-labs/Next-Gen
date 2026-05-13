-- Card generation job tracking for async Higgsfield image jobs.
-- Each row represents one submission for one card; a card may have many
-- jobs over its lifetime (regenerations), but only the latest succeeded job
-- backs the card.image_url.

create type card_generation_job_status as enum (
  'queued',
  'processing',
  'succeeded',
  'failed',
  'cancelled'
);

create type card_generation_job_mode as enum (
  'text_to_image',
  'image_to_image'
);

create table card_generation_jobs (
  id                    uuid primary key default gen_random_uuid(),
  card_id               uuid        not null references cards(id) on delete cascade,
  project_id            uuid        not null references projects(id) on delete cascade,
  mode                  card_generation_job_mode not null default 'text_to_image',
  provider              text        not null default 'higgsfield',
  provider_job_id       text,
  prompt                text        not null,
  reference_image_url   text,
  status                card_generation_job_status not null default 'queued',
  image_url             text,
  error                 text,
  metadata_json         jsonb       not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index card_generation_jobs_card_idx       on card_generation_jobs(card_id);
create index card_generation_jobs_project_idx    on card_generation_jobs(project_id);
create index card_generation_jobs_provider_idx   on card_generation_jobs(provider_job_id);
create index card_generation_jobs_status_idx     on card_generation_jobs(status);

create trigger card_generation_jobs_set_updated_at
  before update on card_generation_jobs
  for each row execute function set_updated_at();

alter table card_generation_jobs enable row level security;

create policy "card_generation_jobs: via project ownership"
  on card_generation_jobs for all
  using (
    exists (
      select 1 from projects p
      where p.id = card_generation_jobs.project_id
        and (p.user_id is null or p.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = card_generation_jobs.project_id
        and (p.user_id is null or p.user_id = auth.uid())
    )
  );
