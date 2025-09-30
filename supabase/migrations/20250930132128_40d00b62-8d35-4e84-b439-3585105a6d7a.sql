-- Drop the existing permissive RLS policy on profiles
DROP POLICY IF EXISTS "Users can view limited profile info" ON public.profiles;

-- Create a more restrictive policy that protects phone numbers
-- Users can only see their own full profile
-- Users can see basic info (name, district, blood_group) of users in same district, but NOT phone numbers
CREATE POLICY "Users can view own profile fully" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Note: Since RLS works at row level, we rely on application code to not query phone field for other users
-- The get_safe_profile_info function should be used when querying other users' profiles