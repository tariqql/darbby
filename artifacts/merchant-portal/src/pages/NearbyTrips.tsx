import React from "react";
import { Link } from "wouter";
import { useListActiveTripsMerchant } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Button, Badge } from "@/components/ui";
import { Map, Navigation } from "lucide-react";

export function NearbyTrips() {
  const { data: trips, isLoading } = useListActiveTripsMerchant();

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-primary">الرحلات النشطة القريبة</h1>
        <p className="text-muted-foreground mt-1">رحلات عملاء تمر بالقرب من فروعك حالياً. قدم عروضك الآن!</p>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : trips?.length === 0 ? (
        <Card className="py-20 text-center bg-muted/30 border-dashed">
          <Map className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">لا توجد رحلات قريبة حالياً</h3>
          <p className="text-muted-foreground">سيظهر العملاء هنا بمجرد اقتراب مسارهم من النطاق الجغرافي لفروعك.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips?.map((trip: any) => (
            <Card key={trip.id} className="hover:shadow-xl transition-all border-accent/20">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="accent" className="px-3 py-1">محتمل</Badge>
                  <p className="text-sm font-bold text-accent">يبعد {(trip.dist_meters / 1000).toFixed(1)} كم</p>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                      <div className="w-3 h-3 bg-primary rounded-full" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold">من</p>
                      <p className="font-bold">{trip.originName}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-1">
                      <Navigation className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold">إلى</p>
                      <p className="font-bold">{trip.destinationName}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-xl mb-6">
                  <p className="text-sm">الفرع المطابق: <span className="font-bold">{trip.branch_name}</span></p>
                </div>

                {/* We need a dedicated send offer page or modal, let's link to a generic or implement inline */}
                <Button className="w-full h-12 text-md" asChild>
                  <Link href={`/merchant/trips/${trip.id}/offer?branchId=${trip.matched_branch_id}`}>
                    تقديم عرض حصري
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
