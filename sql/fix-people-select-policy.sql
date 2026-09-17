-- Fix the existing recursive people policy without changing its access rules.
-- Existing mylife_auth.is_household_member validates the current auth.uid().
-- Tested with Mircea and an unrelated authenticated user before applying.
ALTER POLICY people_select_self_or_household ON public.people
USING (
  auth_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.household_members other
    WHERE other.person_id = people.id
      AND other.status = 'active'
      AND (SELECT mylife_auth.is_household_member(other.household_id))
  )
);
