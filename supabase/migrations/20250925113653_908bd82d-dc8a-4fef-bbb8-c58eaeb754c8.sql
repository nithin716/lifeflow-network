-- Fix the function search path issue
CREATE OR REPLACE FUNCTION public.confirm_user_email(user_email text)
RETURNS void AS $$
BEGIN
    UPDATE public.profiles 
    SET is_confirmed = true 
    WHERE user_id = (
        SELECT id FROM auth.users WHERE email = user_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;