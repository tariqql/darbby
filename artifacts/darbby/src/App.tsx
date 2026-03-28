import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthPage } from "@/pages/AuthPage";
import { UserDashboard } from "@/pages/UserDashboard";
import { CreateTrip } from "@/pages/CreateTrip";
import { TripDetail } from "@/pages/TripDetail";
import { UserOfferDetail } from "@/pages/UserOfferDetail";
import { MerchantDashboard } from "@/pages/MerchantDashboard";
import { NearbyTrips } from "@/pages/NearbyTrips";
import { SendOffer } from "@/pages/SendOffer";
import { MerchantOffers } from "@/pages/MerchantOffers";
import { MerchantOfferDetail } from "@/pages/MerchantOfferDetail";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      
      {/* Customer Routes */}
      <Route path="/user/trips" component={UserDashboard} />
      <Route path="/user/trips/new" component={CreateTrip} />
      <Route path="/user/trips/:id" component={TripDetail} />
      <Route path="/user/offers/:id" component={UserOfferDetail} />
      
      {/* Merchant Routes */}
      <Route path="/merchant/dashboard" component={MerchantDashboard} />
      <Route path="/merchant/trips" component={NearbyTrips} />
      <Route path="/merchant/trips/:id/offer" component={SendOffer} />
      <Route path="/merchant/offers" component={MerchantOffers} />
      <Route path="/merchant/offers/:id" component={MerchantOfferDetail} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
