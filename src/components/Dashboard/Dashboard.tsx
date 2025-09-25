import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Droplets, Plus, Clock, MapPin, Phone, User, Heart, Copy, X } from "lucide-react";
import { RequestBloodDialog } from "./RequestBloodDialog";

interface Profile {
  id: string;
  full_name: string;
  district: string;
  blood_group: string;
}

interface BloodRequest {
  id: string;
  requester_name: string;
  requester_phone: string;
  blood_group: string;
  district: string;
  location_description?: string;
  message?: string;
  created_at: string;
  expires_at: string;
  status: string;
  requester_id: string;
}

interface Claim {
  id: string;
  donor_id: string;
  claimed_at: string;
}

interface DashboardProps {
  user: any;
}

export const Dashboard = ({ user }: DashboardProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [myRequests, setMyRequests] = useState<BloodRequest[]>([]);
  const [requestClaims, setRequestClaims] = useState<{[key: string]: Claim[]}>({});
  const [myRequestClaims, setMyRequestClaims] = useState<{[key: string]: Claim[]}>({});
  const [claimedRequests, setClaimedRequests] = useState<Set<string>>(new Set());
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchRequests();
      fetchMyRequests();
      
      // Set up real-time subscriptions
      const requestsChannel = supabase
        .channel('requests-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'requests',
          },
          () => {
            fetchRequests();
            fetchMyRequests();
          }
        )
        .subscribe();

      const claimsChannel = supabase
        .channel('claims-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'claims',
          },
          () => {
            fetchClaims();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(requestsChannel);
        supabase.removeChannel(claimsChannel);
      };
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load profile",
      });
    }
  };

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'open')
        .gt('expires_at', new Date().toISOString())
        .neq('requester_id', user.id) // Exclude user's own requests
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
      await fetchClaims();
    } catch (error: any) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyRequests(data || []);
      await fetchMyRequestClaims();
    } catch (error: any) {
      console.error('Error fetching my requests:', error);
    }
  };

  const fetchClaims = async () => {
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('*');

      if (error) throw error;
      
      const claimsMap: {[key: string]: Claim[]} = {};
      const userClaimedSet = new Set<string>();
      
      data?.forEach(claim => {
        if (!claimsMap[claim.request_id]) {
          claimsMap[claim.request_id] = [];
        }
        claimsMap[claim.request_id].push(claim);
        
        if (claim.donor_id === user.id) {
          userClaimedSet.add(claim.request_id);
        }
      });
      
      setRequestClaims(claimsMap);
      setClaimedRequests(userClaimedSet);
    } catch (error: any) {
      console.error('Error fetching claims:', error);
    }
  };

  const fetchMyRequestClaims = async () => {
    try {
      const myRequestIds = myRequests.map(req => req.id);
      if (myRequestIds.length === 0) return;

      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .in('request_id', myRequestIds);

      if (error) throw error;
      
      const claimsMap: {[key: string]: Claim[]} = {};
      data?.forEach(claim => {
        if (!claimsMap[claim.request_id]) {
          claimsMap[claim.request_id] = [];
        }
        claimsMap[claim.request_id].push(claim);
      });
      
      setMyRequestClaims(claimsMap);
    } catch (error: any) {
      console.error('Error fetching my request claims:', error);
    }
  };

  const handleClaimRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('claims')
        .insert({
          request_id: requestId,
          donor_id: user.id,
        });

      if (error) throw error;

      toast({
        title: "Request Claimed!",
        description: "You can now see the requester's contact details.",
      });
      
      fetchClaims();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to claim request. You may have already claimed this request.",
      });
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Request Cancelled",
        description: "Your blood request has been cancelled and removed from the feed.",
      });
      
      fetchMyRequests();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error", 
        description: "Failed to cancel request.",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Phone number copied to clipboard.",
    });
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const hoursRemaining = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (hoursRemaining < 1) {
      const minutesRemaining = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60));
      return `${minutesRemaining}m left`;
    }
    return `${hoursRemaining}h left`;
  };

  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground">
          Welcome, {profile.full_name}
        </h2>
        <div className="text-muted-foreground mt-2">
          Blood Group: <Badge variant="secondary" className="bg-medical-red text-white ml-1">
            {profile.blood_group}
          </Badge> • District: {profile.district}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex justify-center">
        <Button
          onClick={() => setIsRequestDialogOpen(true)}
          size="lg"
          className="bg-gradient-primary hover:opacity-90 text-lg px-8 py-6 rounded-xl shadow-medium"
        >
          <Plus className="h-6 w-6 mr-3" />
          Request Blood
        </Button>
      </div>

      {/* Navigation Tabs */}
      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Requests ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="my-requests" className="flex items-center gap-2">
            <Droplets className="h-4 w-4" />
            My Requests ({myRequests.filter(req => req.status === 'open').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Blood Requests in Your Area</h3>
          
          {requests.length === 0 ? (
            <Card className="border-0 shadow-soft">
              <CardContent className="text-center py-12">
                <Droplets className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No blood requests available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Check back later or help others by spreading the word
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {requests.map((request) => {
                const claims = requestClaims[request.id] || [];
                const isClaimed = claimedRequests.has(request.id);
                
                return (
                  <Card key={request.id} className="border-0 shadow-soft hover:shadow-medium transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-medical-red p-2 rounded-lg">
                            <Droplets className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">
                              {request.requester_name}
                            </h4>
                            <Badge variant="secondary" className="bg-medical-red text-white">
                              {request.blood_group}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Clock className="h-4 w-4" />
                            {formatTimeRemaining(request.expires_at)}
                          </div>
                          {claims.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {claims.length} Claimed
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {request.district} • {request.location_description}
                        </div>
                        {request.message && (
                          <p className="text-sm text-foreground bg-soft-gray p-3 rounded-lg">
                            "{request.message}"
                          </p>
                        )}
                      </div>

                      {isClaimed ? (
                        <div className="space-y-3">
                          <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-success">Contact Details</p>
                                <p className="text-sm text-muted-foreground">Phone: {request.requester_phone}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(request.requester_phone)}
                                className="flex items-center gap-2"
                              >
                                <Copy className="h-4 w-4" />
                                Copy
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleClaimRequest(request.id)}
                          className="w-full bg-gradient-primary hover:opacity-90"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          I will help
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">My Blood Requests</h3>
          
          {myRequests.filter(req => req.status === 'open').length === 0 ? (
            <Card className="border-0 shadow-soft">
              <CardContent className="text-center py-12">
                <Droplets className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No active requests</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Request Blood" to create a new request
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myRequests.filter(req => req.status === 'open').map((request) => {
                const claims = myRequestClaims[request.id] || [];
                
                return (
                  <Card key={request.id} className="border-0 shadow-soft">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-primary p-2 rounded-lg">
                            <Droplets className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">
                              Your Request
                            </h4>
                            <Badge variant="secondary" className="bg-medical-red text-white">
                              {request.blood_group}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Clock className="h-4 w-4" />
                            {formatTimeRemaining(request.expires_at)}
                          </div>
                          {claims.length > 0 && (
                            <Badge variant="secondary" className="bg-success text-white">
                              {claims.length} Claimed
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {request.district} • {request.location_description}
                        </div>
                        {request.message && (
                          <p className="text-sm text-foreground bg-soft-gray p-3 rounded-lg">
                            "{request.message}"
                          </p>
                        )}
                      </div>

                      <Button
                        onClick={() => handleCancelRequest(request.id)}
                        variant="destructive"
                        className="w-full"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel My Request
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RequestBloodDialog
        isOpen={isRequestDialogOpen}
        onClose={() => setIsRequestDialogOpen(false)}
        user={user}
        onSuccess={fetchMyRequests}
      />
    </div>
  );
};