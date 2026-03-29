import React from "react";
import { useLocation } from "wouter";
import { useCreateTrip, useListVehicles } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent, Input, Label } from "@/components/ui";
import { MapPin, Navigation } from "lucide-react";
import { useProtectedRoute } from "@/hooks/use-auth";

export function CreateTrip() {
  useProtectedRoute();
  const [, setLocation] = useLocation();
  const createTrip = useCreateTrip();
  const { data: vehicles } = useListVehicles();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    // Using dummy coordinates for demo since we don't have map picker UI here
    const data = {
      title: fd.get("title") as string,
      tripPurpose: fd.get("tripPurpose") as any,
      originName: fd.get("originName") as string,
      originLat: 24.7136, originLng: 46.6753, // Riyadh
      destinationName: fd.get("destinationName") as string,
      destLat: 21.4858, destLng: 39.1925, // Mecca
      departureTime: new Date(fd.get("departureTime") as string).toISOString(),
      vehicleProfileId: fd.get("vehicleProfileId") as string || undefined,
      isPublic: true
    };

    try {
      await createTrip.mutateAsync({ data });
      setLocation("/user/trips");
    } catch (err) {
      alert("فشل في إنشاء الرحلة");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-primary mb-2">رحلة جديدة</h1>
        <p className="text-muted-foreground mb-8">حدد مسار رحلتك لتستقبل العروض المناسبة</p>

        <Card className="border-0 shadow-2xl bg-white/50 backdrop-blur-xl">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>عنوان الرحلة (اختياري)</Label>
                <Input name="title" placeholder="مثال: رحلة العمل للرياض" className="bg-white" />
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>نقطة الانطلاق</Label>
                  <div className="relative">
                    <MapPin className="absolute right-3 top-3 w-6 h-6 text-primary" />
                    <Input name="originName" required placeholder="الرياض" className="bg-white pr-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الوجهة</Label>
                  <div className="relative">
                    <Navigation className="absolute right-3 top-3 w-6 h-6 text-accent" />
                    <Input name="destinationName" required placeholder="مكة المكرمة" className="bg-white pr-11" />
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>وقت المغادرة</Label>
                  <Input type="datetime-local" name="departureTime" required className="bg-white" />
                </div>
                <div className="space-y-2">
                  <Label>غرض الرحلة</Label>
                  <select name="tripPurpose" className="flex h-12 w-full rounded-xl border-2 border-border bg-white px-4 py-2 text-sm focus:border-accent outline-none">
                    <option value="TOURISM">سياحة</option>
                    <option value="WORK">عمل</option>
                    <option value="UMRAH">عمرة</option>
                    <option value="FAMILY_VISIT">زيارة عائلية</option>
                    <option value="OTHER">أخرى</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>المركبة المستخدمة</Label>
                <select name="vehicleProfileId" className="flex h-12 w-full rounded-xl border-2 border-border bg-white px-4 py-2 text-sm focus:border-accent outline-none">
                  <option value="">بدون مركبة محددة</option>
                  {vehicles?.map(v => (
                    <option key={v.id} value={v.id}>{v.nickname} ({v.make} {v.model})</option>
                  ))}
                </select>
              </div>

              <Button type="submit" size="lg" className="w-full text-lg h-14 shadow-xl shadow-primary/20" disabled={createTrip.isPending}>
                {createTrip.isPending ? "جاري الإنشاء..." : "نشر الرحلة لاستقبال العروض"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
