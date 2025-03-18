
import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useSubscription } from '@/hooks/useSubscription';
import SubscriptionInfo from '@/components/subscription/SubscriptionInfo';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const Subscription = () => {
  const { user } = useAuth();
  const { planDetails, isLoading: subscriptionLoading, error: subscriptionError } = useSubscription();
  const [statsLoading, setStatsLoading] = useState(true);
  const [userStats, setUserStats] = useState({
    apiCalls: 0,
    ownedBrains: 0,
    sharedBrains: 0,
    documents: 0
  });

  // Fetch user statistics directly
  useEffect(() => {
    const fetchUserStats = async () => {
      if (!user) return;
      
      setStatsLoading(true);
      
      try {
        console.log('Fetching user statistics from Subscription page...');
        
        const { data, error } = await supabase.functions.invoke('user-statistics', {
          body: { 
            userId: user.id
          },
        });
        
        if (error) {
          console.error('Error invoking user-statistics function:', error);
          toast.error('Could not load usage statistics');
          return;
        }
        
        console.log('User statistics response:', data);
        
        if (!data) {
          toast.error('No statistics data returned');
          return;
        }
        
        if (data.status === 'error') {
          toast.error(data.error || 'An error occurred fetching statistics');
          return;
        }
        
        setUserStats({
          apiCalls: data.apiCalls ?? 0,
          ownedBrains: data.ownedBrains ?? 0,
          sharedBrains: data.sharedBrains ?? 0,
          documents: data.documents ?? 0
        });
        
      } catch (error) {
        console.error('Error fetching user stats:', error);
        toast.error('Failed to load user statistics');
      } finally {
        setStatsLoading(false);
      }
    };

    fetchUserStats();
  }, [user]);

  // Calculate totals for display
  const totalBrains = userStats.ownedBrains + userStats.sharedBrains;
  const apiCallsUsed = userStats.apiCalls;

  return (
    <div className="min-h-screen bg-background pb-12 animate-fade-in">
      <Navbar />
      
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <div className="flex items-center mb-6">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold ml-2">Subscription</h1>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Your Plan Details</h2>
          
          <SubscriptionInfo 
            planDetails={planDetails} 
            isLoading={subscriptionLoading || statsLoading} 
            error={subscriptionError}
            userBrainCount={totalBrains}
            apiCallsUsed={apiCallsUsed}
          />
          
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Subscription Benefits</h3>
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs mr-2 mt-0.5">✓</span>
                <span>Access to advanced AI features and more API calls</span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs mr-2 mt-0.5">✓</span>
                <span>Create and manage more brains</span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs mr-2 mt-0.5">✓</span>
                <span>Priority support and early access to new features</span>
              </li>
            </ul>
          </div>
          
          {planDetails?.plan_type === 'starter' && (
            <div className="mt-8 p-4 bg-muted rounded-lg border border-dashed">
              <h3 className="text-lg font-medium mb-2">Upgrade to Pro</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get unlimited access to all features and higher usage limits.
              </p>
              <Button className="w-full">Upgrade Now</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Subscription;
