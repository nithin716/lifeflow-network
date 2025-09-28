import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DeviceTokenManager } from "@/components/Notifications/DeviceTokenManager";
import { useToast } from "@/hooks/use-toast";

export default function Notifications() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        window.location.href = '/';
        return;
      }
      
      setUser(user);
    } catch (error) {
      console.error('Error checking user:', error);
      toast({
        title: "Authentication Error",
        description: "Please log in to manage notifications",
        variant: "destructive"
      });
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Notification Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your device tokens to receive push notifications for new blood requests in your area.
          </p>
        </div>
        
        <DeviceTokenManager user={user} />
      </div>
    </div>
  );
}