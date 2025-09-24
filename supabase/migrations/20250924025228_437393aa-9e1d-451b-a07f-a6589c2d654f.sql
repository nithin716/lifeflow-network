-- Blood Donation App Database Schema

-- Create blood group enum
CREATE TYPE public.blood_group AS ENUM ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-');

-- Create request status enum
CREATE TYPE public.request_status AS ENUM ('open', 'claimed', 'fulfilled', 'expired');

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    blood_group blood_group NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create requests table
CREATE TABLE public.requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    blood_group blood_group NOT NULL,
    requester_name TEXT NOT NULL,
    requester_phone TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    location_description TEXT,
    message TEXT,
    status request_status NOT NULL DEFAULT 'open',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create claims table
CREATE TABLE public.claims (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    donor_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(request_id, donor_id)
);

-- Create favourites table
CREATE TABLE public.favourites (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    blood_group blood_group,
    district TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, blood_group, district)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Requests policies
CREATE POLICY "Users can view requests in their district with matching blood group or their own requests" 
ON public.requests FOR SELECT USING (
    status = 'open' AND expires_at > now() AND (
        (district = (SELECT district FROM public.profiles WHERE user_id = auth.uid()) AND 
         blood_group = (SELECT blood_group FROM public.profiles WHERE user_id = auth.uid()))
        OR requester_id = auth.uid()
    )
);

CREATE POLICY "Users can insert their own requests" ON public.requests 
FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update their own requests" ON public.requests 
FOR UPDATE USING (auth.uid() = requester_id);

-- Claims policies  
CREATE POLICY "Users can view claims for requests they can see" ON public.claims 
FOR SELECT USING (
    request_id IN (
        SELECT id FROM public.requests WHERE 
        (district = (SELECT district FROM public.profiles WHERE user_id = auth.uid()) AND 
         blood_group = (SELECT blood_group FROM public.profiles WHERE user_id = auth.uid()))
        OR requester_id = auth.uid()
    )
);

CREATE POLICY "Users can create claims for open requests" ON public.claims 
FOR INSERT WITH CHECK (auth.uid() = donor_id);

-- Favourites policies
CREATE POLICY "Users can manage their own favourites" ON public.favourites 
FOR ALL USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_requests_updated_at
    BEFORE UPDATE ON public.requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, phone, district, state, blood_group)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'district', ''),
        COALESCE(NEW.raw_user_meta_data->>'state', ''),
        COALESCE(NEW.raw_user_meta_data->>'blood_group', 'O+')::blood_group
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create function to auto-expire old requests
CREATE OR REPLACE FUNCTION public.expire_old_requests()
RETURNS void AS $$
BEGIN
    UPDATE public.requests 
    SET status = 'expired'
    WHERE status = 'open' AND expires_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create indexes for better performance
CREATE INDEX idx_requests_district_blood_group ON public.requests(district, blood_group) WHERE status = 'open';
CREATE INDEX idx_requests_requester ON public.requests(requester_id);
CREATE INDEX idx_requests_expires_at ON public.requests(expires_at) WHERE status = 'open';
CREATE INDEX idx_claims_request_donor ON public.claims(request_id, donor_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_district_blood ON public.profiles(district, blood_group);