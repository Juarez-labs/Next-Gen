-- Lotería app initial schema.
-- Tables: projects, cards, boards, validation_reports, exports.
-- See projects/next-gen plan doc for full data model rationale.

create extension if not exists "pgcrypto";

create type project_status as enum (
  'draft',
  'in_progress',
  'ready',
  'exported',
  'archived'
);

create type export_type as enum (
  'boards_pdf',
  'caller_deck_pdf',
  'card_index_csv',
  'rules_sheet',
  'project_zip'
);

create table projects (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  theme         text,
  audience      text,
  tone          text,
  deck_size     integer     not null default 54,
  board_size    integer     not null default 16,
  board_count   integer     not null default 25,
  status        project_status not null default 'draft',
  style_preset  text,
  user_id       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table cards (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid        not null references projects(id) on delete cascade,
  card_number     integer     not null,
  english_name    text        not null,
  spanish_name    text        not null,
  category        text,
  description     text,
  prompt          text,
  image_url       text,
  approved        boolean     not null default false,
  version         integer     not null default 1,
  is_custom_photo boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, card_number)
);

create table boards (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid        not null references projects(id) on delete cascade,
  board_number  integer     not null,
  label         text        not null,
  card_ids      uuid[]      not null,
  seed          text,
  locked_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique (project_id, board_number)
);

create table validation_reports (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid        not null references projects(id) on delete cascade,
  board_count            integer     not null,
  passes                 boolean     not null,
  checks_json            jsonb       not null default '[]'::jsonb,
  card_frequencies_json  jsonb       not null default '{}'::jsonb,
  warnings               jsonb       not null default '[]'::jsonb,
  created_at             timestamptz not null default now()
);

create table exports (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid        not null references projects(id) on delete cascade,
  type            export_type not null,
  file_url        text        not null,
  metadata_json   jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- Helpful indexes for the common access patterns.
create index cards_project_idx               on cards(project_id);
create index boards_project_idx              on boards(project_id);
create index validation_reports_project_idx  on validation_reports(project_id);
create index exports_project_idx             on exports(project_id);
create index projects_user_idx               on projects(user_id);

-- Updated-at trigger for projects and cards.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

create trigger cards_set_updated_at
  before update on cards
  for each row execute function set_updated_at();

-- RLS: owners can read/write their own projects and the rows beneath them.
alter table projects             enable row level security;
alter table cards                enable row level security;
alter table boards               enable row level security;
alter table validation_reports   enable row level security;
alter table exports              enable row level security;

create policy "projects: owner read"
  on projects for select
  using (user_id is null or user_id = auth.uid());

create policy "projects: owner write"
  on projects for all
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

create policy "cards: via project ownership"
  on cards for all
  using (
    exists (
      select 1 from projects p
      where p.id = cards.project_id
        and (p.user_id is null or p.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = cards.project_id
        and (p.user_id is null or p.user_id = auth.uid())
    )
  );

create policy "boards: via project ownership"
  on boards for all
  using (
    exists (
      select 1 from projects p
      where p.id = boards.project_id
        and (p.user_id is null or p.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = boards.project_id
        and (p.user_id is null or p.user_id = auth.uid())
    )
  );

create policy "validation_reports: via project ownership"
  on validation_reports for all
  using (
    exists (
      select 1 from projects p
      where p.id = validation_reports.project_id
        and (p.user_id is null or p.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = validation_reports.project_id
        and (p.user_id is null or p.user_id = auth.uid())
    )
  );

create policy "exports: via project ownership"
  on exports for all
  using (
    exists (
      select 1 from projects p
      where p.id = exports.project_id
        and (p.user_id is null or p.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = exports.project_id
        and (p.user_id is null or p.user_id = auth.uid())
    )
  );
