-- Fix security issue: Restrict profile access to only relevant users
-- Drop the overly permissive policy
DROP POLICY "Users can view all profiles" ON public.profiles;

-- Create a more secure policy that allows users to see:
-- 1. Their own profile
-- 2. Profiles of users in the same district (potential donors in their area)
-- This maintains functionality while protecting privacy
CREATE POLICY "Users can view relevant profiles" ON public.profiles
FOR SELECT USING (
  -- Users can always see their own profile
  auth.uid() = user_id 
  OR 
  -- Users can see profiles of people in the same district
  -- This allows them to see potential blood donors in their area
  district = (
    SELECT profiles.district 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
);