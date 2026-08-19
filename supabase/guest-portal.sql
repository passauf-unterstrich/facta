-- Additive Erweiterung: Der bestehende Kartenbestand und Eigentümerzugang bleiben unverändert.
create extension if not exists pgcrypto;

create table if not exists public.guest_portals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  password_salt text not null,
  password_hash text not null,
  active boolean not null default true,
  expires_at timestamptz,
  session_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_tree_shares (
  portal_id uuid not null references public.guest_portals(id) on delete cascade,
  root_id text not null references public.nodes(id) on delete cascade,
  node_count integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (portal_id, root_id)
);

create table if not exists public.guest_tree_nodes (
  portal_id uuid not null,
  root_id text not null,
  node_id text not null references public.nodes(id) on delete cascade,
  primary key (portal_id, root_id, node_id),
  foreign key (portal_id, root_id)
    references public.guest_tree_shares(portal_id, root_id) on delete cascade
);

create index if not exists guest_tree_nodes_portal_node_idx
  on public.guest_tree_nodes(portal_id, node_id);

create table if not exists public.guest_login_events (
  id bigint generated always as identity primary key,
  portal_id uuid not null references public.guest_portals(id) on delete cascade,
  logged_in_at timestamptz not null default now(),
  ip text not null
);

create index if not exists guest_login_events_portal_time_idx
  on public.guest_login_events(portal_id, logged_in_at desc);

alter table public.guest_portals enable row level security;
alter table public.guest_tree_shares enable row level security;
alter table public.guest_tree_nodes enable row level security;
alter table public.guest_login_events enable row level security;

create or replace function public.share_facta_tree(p_portal_id uuid, p_root_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if not exists (select 1 from nodes where id = p_root_id) then
    raise exception 'Startkarte nicht gefunden';
  end if;

  insert into guest_tree_shares(portal_id, root_id)
  values (p_portal_id, p_root_id)
  on conflict (portal_id, root_id) do nothing;

  delete from guest_tree_nodes
  where portal_id = p_portal_id and root_id = p_root_id;

  with recursive tree(id) as (
    select p_root_id
    union
    select e.to_id from edges e join tree t on e.from_id = t.id
  )
  insert into guest_tree_nodes(portal_id, root_id, node_id)
  select p_portal_id, p_root_id, id from tree;

  get diagnostics v_count = row_count;
  update guest_tree_shares set node_count = v_count
  where portal_id = p_portal_id and root_id = p_root_id;
  return jsonb_build_object('ok', true, 'nodes', v_count);
end;
$$;

create or replace function public.share_facta_trees(p_portal_id uuid, p_root_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_root_id text;
  v_result jsonb;
  v_tree_count integer := 0;
  v_node_count integer := 0;
begin
  for v_root_id in
    select distinct root_id from unnest(p_root_ids) as roots(root_id)
    where root_id is not null and root_id <> ''
  loop
    v_result := public.share_facta_tree(p_portal_id, v_root_id);
    v_tree_count := v_tree_count + 1;
    v_node_count := v_node_count + coalesce((v_result->>'nodes')::integer, 0);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'trees', v_tree_count,
    'nodes', v_node_count
  );
end;
$$;

create or replace function public.delete_facta_tree(p_root_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer; v_external integer;
begin
  if not exists (select 1 from nodes where id = p_root_id) then
    raise exception 'Startkarte nicht gefunden';
  end if;

  with recursive tree(id) as (
    select p_root_id
    union
    select e.to_id from edges e join tree t on e.from_id = t.id
  )
  select count(*) into v_external
  from edges e
  where e.to_id in (select id from tree)
    and e.from_id not in (select id from tree);

  if v_external > 0 then
    return jsonb_build_object('ok', false, 'externalReferences', v_external);
  end if;

  with recursive tree(id) as (
    select p_root_id
    union
    select e.to_id from edges e join tree t on e.from_id = t.id
  ), deleted as (
    delete from nodes where id in (select id from tree) returning id
  )
  select count(*) into v_count from deleted;
  return jsonb_build_object('ok', true, 'nodes', v_count);
end;
$$;

revoke all on public.guest_portals, public.guest_tree_shares,
  public.guest_tree_nodes, public.guest_login_events from anon, authenticated;
revoke all on function public.share_facta_tree(uuid, text) from public, anon, authenticated;
revoke all on function public.share_facta_trees(uuid, text[]) from public, anon, authenticated;
revoke all on function public.delete_facta_tree(text) from public, anon, authenticated;
grant execute on function public.share_facta_tree(uuid, text) to service_role;
grant execute on function public.share_facta_trees(uuid, text[]) to service_role;
grant execute on function public.delete_facta_tree(text) to service_role;
