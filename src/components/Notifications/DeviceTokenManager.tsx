import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useDeviceToken } from '@/hooks/useDeviceToken';
import { useToast } from '@/hooks/use-toast';
import { Bell, BellOff, Smartphone, Copy, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DeviceTokenManagerProps {
  user: any;
}

interface UserToken {
  id: string;
  token: string;
  platform: string;
  created_at: string;
}

export const DeviceTokenManager = ({ user }: DeviceTokenManagerProps) => {
  const [manualToken, setManualToken] = useState('');
  const [userTokens, setUserTokens] = useState<UserToken[]>([]);
  const [loading, setLoading] = useState(true);
  const { isRegistered, loading: tokenLoading, registerDeviceToken, unregisterDeviceToken } = useDeviceToken();
  const { toast } = useToast();

  useEffect(() => {
    fetchUserTokens();
  }, [user]);

  const fetchUserTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserTokens(data || []);
    } catch (error) {
      console.error('Error fetching user tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterToken = async () => {
    if (!manualToken.trim()) {
      toast({
        title: "Invalid Token",
        description: "Please enter a valid FCM token",
        variant: "destructive"
      });
      return;
    }

    await registerDeviceToken(manualToken.trim());
    setManualToken('');
    fetchUserTokens();
  };

  const handleUnregisterToken = async (token: string) => {
    await unregisterDeviceToken(token);
    fetchUserTokens();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Token copied to clipboard",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Manual Token Registration */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Register Device Token</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your Firebase Cloud Messaging (FCM) device token to receive notifications on your Android device.
              </p>
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="fcm-token">FCM Device Token</Label>
              <div className="flex gap-2">
                <Input
                  id="fcm-token"
                  placeholder="Enter your FCM device token here..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button 
                  onClick={handleRegisterToken}
                  disabled={tokenLoading || !manualToken.trim()}
                >
                  {tokenLoading ? 'Adding...' : 'Add Token'}
                </Button>
              </div>
            </div>

            {/* Android App Instructions */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                For Android App Developers
              </h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Project Details:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Project ID: <code className="bg-muted px-1 rounded">blood-donation-604b0</code></li>
                  <li>Sender ID: <code className="bg-muted px-1 rounded">39973841595</code></li>
                  <li>Package Name: <code className="bg-muted px-1 rounded">com.Nithin.LifeFlow</code></li>
                </ul>
                <p className="mt-2">
                  Use Firebase SDK to get the FCM token and register it here to receive push notifications.
                </p>
              </div>
            </div>
          </div>

          {/* Active Tokens */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Active Device Tokens</h3>
              <Badge variant="secondary">
                {userTokens.length} device{userTokens.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {userTokens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BellOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No devices registered for notifications</p>
                <p className="text-sm">Add a device token above to start receiving notifications</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userTokens.map((token) => (
                  <div key={token.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{token.platform}</Badge>
                          <span className="text-sm text-muted-foreground">
                            Added: {formatDate(token.created_at)}
                          </span>
                        </div>
                        <div className="font-mono text-sm bg-muted p-2 rounded break-all">
                          {token.token}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(token.token)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnregisterToken(token.token)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};