-- Create user_tokens table for storing FCM device tokens
CREATE TABLE public.user_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL DEFAULT 'android',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for user_tokens
CREATE POLICY "Users can view their own tokens" 
ON public.user_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens" 
ON public.user_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens" 
ON public.user_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens" 
ON public.user_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_tokens_updated_at
BEFORE UPDATE ON public.user_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_user_tokens_user_id ON public.user_tokens(user_id);
CREATE INDEX idx_user_tokens_platform ON public.user_tokens(platform);