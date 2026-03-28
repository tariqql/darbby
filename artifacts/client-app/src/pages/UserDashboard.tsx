import React from "react";
import { Link } from "wouter";
import { useListMyTrips } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { MapPin, Plus, Clock, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

export function UserDashboard() {
  const { data: trips, isLoading } = useListMyTrips();

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary">رحلاتي</h1>
          <p className="text-muted-foreground mt-1">تتبع رحلاتك الحالية والسابقة والعروض المقدمة لك</p>
        </div>
        <Link href="/user/trips/new">
          <Button size="lg" className="rounded-2xl gap-2 w-full sm:w-auto">
            <Plus className="w-5 h-5" />
            رحلة جديدة
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : trips?.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-muted/30 border-dashed border-2">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <MapPin className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">لا توجد رحلات بعد</h3>
          <p className="text-muted-foreground max-w-sm mb-8">أضف رحلتك الأولى لتبدأ في استقبال العروض الحصرية من التجار على مسارك.</p>
          <Link href="/user/trips/new">
            <Button size="lg">ابدأ رحلتك الأولى</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {trips?.map(trip => (
            <Link key={trip.id} href={`/user/trips/${trip.id}`}>
              <Card className="hover:shadow-2xl hover:border-accent transition-all duration-300 cursor-pointer h-full flex flex-col group">
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <Badge variant={trip.status === 'ACTIVE' ? 'success' : 'secondary'} className="px-3 py-1 text-sm">
                      {trip.status === 'ACTIVE' ? 'نشطة' : trip.status === 'COMPLETED' ? 'مكتملة' : 'ملغاة'}
                    </Badge>
                    <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
                      {trip.tripPurpose}
                    </Badge>
                  </div>
                  
                  <div className="relative pl-8 mb-6 flex-1">
                    <div className="absolute right-3 top-2 bottom-2 w-0.5 bg-border rounded-full" />
                    <div className="absolute right-[9px] top-2 w-2.5 h-2.5 bg-primary rounded-full ring-4 ring-background" />
                    <div className="absolute right-[9px] bottom-2 w-2.5 h-2.5 bg-accent rounded-full ring-4 ring-background" />
                    
                    <div className="mb-6 relative">
                      <p className="text-xs text-muted-foreground font-bold mb-1">من</p>
                      <h4 className="font-bold text-lg leading-tight truncate">{trip.originName}</h4>
                    </div>
                    <div className="relative">
                      <p className="text-xs text-muted-foreground font-bold mb-1">إلى</p>
                      <h4 className="font-bold text-lg leading-tight truncate">{trip.destinationName}</h4>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                    <div className="flex items-center text-sm text-muted-foreground font-medium">
                      <Clock className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-primary" />
                      {format(new Date(trip.departureTime!), 'dd MMM yyyy, HH:mm', { locale: arSA })}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
