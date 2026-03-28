import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { LoginPage } from "@/pages/LoginPage";
import { UserDashboard } from "@/pages/UserDashboard";
import { CreateTrip } from "@/pages/CreateTrip";
import { TripDetail } from "@/pages/TripDetail";
import { UserOfferDetail } from "@/pages/UserOfferDetail";
import { VehicleList } from "@/pages/VehicleList";
import { VehicleForm } from "@/pages/VehicleForm";
import { UserProfile } from "@/pages/UserProfile";
import { NotificationCenter } from "@/pages/NotificationCenter";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/user/trips" component={UserDashboard} />
      <Route path="/user/trips/new" component={CreateTrip} />
      <Route path="/user/trips/:id" component={TripDetail} />
      <Route path="/user/offers/:id" component={UserOfferDetail} />
      <Route path="/user/vehicles" component={VehicleList} />
      <Route path="/user/vehicles/new" component={VehicleForm} />
      <Route path="/user/vehicles/:id/edit" component={VehicleForm} />
      <Route path="/user/profile" component={UserProfile} />
      <Route path="/notifications" component={NotificationCenter} />
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
