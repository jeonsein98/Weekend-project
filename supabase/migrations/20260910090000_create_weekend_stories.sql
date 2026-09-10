create table if not exists public.weekend_stories (
  id text primary key,
  story jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekend_stories_id_length check (char_length(id) between 1 and 128),
  constraint weekend_stories_story_object check (jsonb_typeof(story) = 'object')
);

create index if not exists weekend_stories_created_at_idx
  on public.weekend_stories (created_at desc);

alter table public.weekend_stories enable row level security;
revoke all on table public.weekend_stories from anon, authenticated;
grant select, insert, update, delete on table public.weekend_stories to service_role;

create or replace function public.increment_weekend_story_reaction(p_story_id text, p_emoji text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_story jsonb;
  current_count integer;
begin
  if p_emoji is null or char_length(p_emoji) < 1 or char_length(p_emoji) > 16 then
    raise exception 'invalid reaction';
  end if;

  select case
    when jsonb_typeof(story #> array['reactions', p_emoji]) = 'number'
      then (story #>> array['reactions', p_emoji])::integer
    else 0
  end
  into current_count
  from public.weekend_stories
  where id = p_story_id
  for update;

  if not found then
    raise exception 'story not found';
  end if;

  update public.weekend_stories
  set story = story || jsonb_build_object(
        'reactions', coalesce(story->'reactions', '{}'::jsonb) || jsonb_build_object(p_emoji, current_count + 1)
      ),
      updated_at = now()
  where id = p_story_id
  returning story into updated_story;

  return updated_story;
end;
$$;

revoke execute on function public.increment_weekend_story_reaction(text, text) from public, anon, authenticated;
grant execute on function public.increment_weekend_story_reaction(text, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stories', 'stories', true, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
