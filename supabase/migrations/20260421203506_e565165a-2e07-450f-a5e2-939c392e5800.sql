-- Drop overly permissive public SELECT policies
DROP POLICY IF EXISTS "messages_select_public" ON public.messages;
DROP POLICY IF EXISTS "groups_select_public" ON public.groups;

-- Restrict SELECT access to authenticated users only
CREATE POLICY "messages_select_authenticated"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "groups_select_authenticated"
  ON public.groups
  FOR SELECT
  TO authenticated
  USING (true);

-- Revoke any direct SELECT grants from the anon role to be safe
REVOKE SELECT ON public.messages FROM anon;
REVOKE SELECT ON public.groups   FROM anon;