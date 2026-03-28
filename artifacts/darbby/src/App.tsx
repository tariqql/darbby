import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthPage } from "@/pages/AuthPage";
import { UserDashboard } from "@/pages/UserDashboard";
import { CreateTrip } from "@/pages/CreateTrip";
import { TripDetail } from "@/pages/TripDetail";
import { UserOfferDetail } from "@/pages/UserOfferDetail";
import { VehicleList } from "@/pages/VehicleList";
import { VehicleForm } from "@/pages/VehicleForm";
import { UserProfile } from "@/pages/UserProfile";
import { NotificationCenter } from "@/pages/NotificationCenter";
import { MerchantDashboard } from "@/pages/MerchantDashboard";
import { NearbyTrips } from "@/pages/NearbyTrips";
import { SendOffer } from "@/pages/SendOffer";
import { MerchantOffers } from "@/pages/MerchantOffers";
import { MerchantOfferDetail } from "@/pages/MerchantOfferDetail";
import { BranchList } from "@/pages/BranchList";
import { BranchForm } from "@/pages/BranchForm";
import { ProductList } from "@/pages/ProductList";
import { ProductForm } from "@/pages/ProductForm";
import { AutoNegotiatorSettings } from "@/pages/AutoNegotiatorSettings";
import { CommissionLedger } from "@/pages/CommissionLedger";
import { MerchantSettings } from "@/pages/MerchantSettings";
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
      <Route path="/user/vehicles" component={VehicleList} />
      <Route path="/user/vehicles/new" component={VehicleForm} />
      <Route path="/user/vehicles/:id/edit" component={VehicleForm} />
      <Route path="/user/profile" component={UserProfile} />
      <Route path="/notifications" component={NotificationCenter} />
      
      {/* Merchant Routes */}
      <Route path="/merchant/dashboard" component={MerchantDashboard} />
      <Route path="/merchant/trips" component={NearbyTrips} />
      <Route path="/merchant/trips/:id/offer" component={SendOffer} />
      <Route path="/merchant/offers" component={MerchantOffers} />
      <Route path="/merchant/offers/:id" component={MerchantOfferDetail} />
      <Route path="/merchant/branches" component={BranchList} />
      <Route path="/merchant/branches/new" component={BranchForm} />
      <Route path="/merchant/branches/:id/edit" component={BranchForm} />
      <Route path="/merchant/products" component={ProductList} />
      <Route path="/merchant/products/new" component={ProductForm} />
      <Route path="/merchant/products/:id/edit" component={ProductForm} />
      <Route path="/merchant/auto-negotiator" component={AutoNegotiatorSettings} />
      <Route path="/merchant/commission" component={CommissionLedger} />
      <Route path="/merchant/settings" component={MerchantSettings} />
      
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
