import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useDeviceToken = () => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const registerDeviceToken = async (token: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check if token already exists
      const { data: existingToken } = await supabase
        .from('user_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('token', token)
        .maybeSingle();

      if (existingToken) {
        setIsRegistered(true);
        return;
      }

      // Insert new token
      const { error } = await supabase
        .from('user_tokens')
        .insert({
          user_id: user.id,
          token: token,
          platform: 'android'
        });

      if (error) throw error;

      setIsRegistered(true);
      toast({
        title: "Notifications enabled",
        description: "You'll receive notifications for new blood requests in your area.",
      });
    } catch (error) {
      console.error('Error registering device token:', error);
      toast({
        title: "Failed to enable notifications",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const unregisterDeviceToken = async (token: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('user_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token', token);

      if (error) throw error;

      setIsRegistered(false);
      toast({
        title: "Notifications disabled",
        description: "You won't receive notifications anymore.",
      });
    } catch (error) {
      console.error('Error unregistering device token:', error);
      toast({
        title: "Failed to disable notifications",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkTokenRegistration = async (token: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return false;

      const { data } = await supabase
        .from('user_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('token', token)
        .maybeSingle();

      const registered = !!data;
      setIsRegistered(registered);
      return registered;
    } catch (error) {
      console.error('Error checking token registration:', error);
      return false;
    }
  };

  return {
    isRegistered,
    loading,
    registerDeviceToken,
    unregisterDeviceToken,
    checkTokenRegistration,
  };
};