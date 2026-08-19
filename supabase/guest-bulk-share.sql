-- Ergänzung für die Sammelfreigabe mehrerer Gastbäume.
-- Additiv: Karten und bestehende Freigaben bleiben unverändert.
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

revoke all on function public.share_facta_trees(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.share_facta_trees(uuid, text[])
  to service_role;
