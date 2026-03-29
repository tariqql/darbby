import React from "react";
import { useParams, Link } from "wouter";
import { useGetTripById } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { Store, ChevronLeft, Map } from "lucide-react";
import { useProtectedRoute } from "@/hooks/use-auth";

export function TripDetail() {
  useProtectedRoute();
  const { id } = useParams();
  const { data: trip, isLoading } = useGetTripById(id!);

  if (isLoading) return <AppLayout><div className="animate-pulse h-64 bg-muted rounded-2xl" /></AppLayout>;
  if (!trip) return <AppLayout><div className="p-8 text-center font-bold">الرحلة غير موجودة</div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/3 space-y-6">
          <Card className="bg-primary text-primary-foreground border-0 shadow-xl overflow-hidden relative">
            <div className="absolute inset-0 map-bg-pattern opacity-10" />
            <CardContent className="p-8 relative z-10">
              <Badge variant="success" className="mb-6">{trip.status}</Badge>
              <h2 className="text-3xl font-black mb-6">{trip.title || "تفاصيل الرحلة"}</h2>
              
              <div className="space-y-6 relative before:absolute before:right-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/20">
                <div className="relative pr-8">
                  <div className="absolute right-0 top-1 w-5 h-5 bg-white rounded-full ring-4 ring-primary" />
                  <p className="text-white/60 text-sm font-bold">الانطلاق</p>
                  <p className="text-xl font-bold">{trip.originName}</p>
                </div>
                <div className="relative pr-8">
                  <div className="absolute right-0 top-1 w-5 h-5 bg-accent rounded-full ring-4 ring-primary" />
                  <p className="text-white/60 text-sm font-bold">الوجهة</p>
                  <p className="text-xl font-bold">{trip.destinationName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Button variant="outline" className="w-full h-14 text-lg">
            <Map className="w-5 h-5 ml-2" /> عرض الخريطة
          </Button>
        </div>

        <div className="w-full md:w-2/3">
          <h3 className="text-2xl font-black text-primary mb-6 flex items-center">
            <Store className="w-6 h-6 ml-3 text-accent" />
            العروض المستلمة ({trip.offers?.length || 0})
          </h3>

          <div className="space-y-4">
            {trip.offers?.length === 0 ? (
              <Card className="py-12 text-center bg-muted/30 border-dashed">
                <p className="text-muted-foreground font-bold">لا توجد عروض بعد. ستبدأ المحطات القريبة بإرسال العروض قريباً.</p>
              </Card>
            ) : (
              trip.offers?.map(offer => (
                <Link key={offer.id} href={`/user/offers/${offer.id}`}>
                  <Card className="hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center">
                          <Store className="w-7 h-7 text-accent" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg mb-1">عرض جديد</h4>
                          <Badge variant="outline">{offer.status}</Badge>
                        </div>
                      </div>
                      <div className="text-left flex items-center gap-6">
                        <div>
                          <p className="text-sm text-muted-foreground font-medium">السعر الإجمالي</p>
                          <p className="text-2xl font-black text-primary">{formatCurrency(offer.finalPrice || offer.totalPrice)}</p>
                        </div>
                        <ChevronLeft className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
