import React, { useState } from "react";
import { useLocation } from "wouter";
import { useCreateTrip, useListVehicles } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent, Input, Label } from "@/components/ui";
import { MapPin, Navigation, ChevronRight } from "lucide-react";
import { useProtectedRoute } from "@/hooks/use-auth";

const SAUDI_CITIES = [
  { name: "الرياض",         lat: 24.7136,  lng: 46.6753 },
  { name: "جدة",             lat: 21.4858,  lng: 39.1925 },
  { name: "مكة المكرمة",   lat: 21.3891,  lng: 39.8579 },
  { name: "المدينة المنورة",lat: 24.5247,  lng: 39.5692 },
  { name: "الدمام",          lat: 26.4207,  lng: 50.0888 },
  { name: "الطائف",          lat: 21.2854,  lng: 40.4152 },
  { name: "بريدة",           lat: 26.3550,  lng: 43.9756 },
  { name: "تبوك",            lat: 28.3838,  lng: 36.5550 },
  { name: "حائل",            lat: 27.5114,  lng: 41.6931 },
  { name: "خميس مشيط",      lat: 18.3060,  lng: 42.7285 },
  { name: "أبها",            lat: 18.2169,  lng: 42.5053 },
  { name: "ينبع",            lat: 24.0895,  lng: 38.0618 },
  { name: "نجران",           lat: 17.4927,  lng: 44.1277 },
  { name: "الأحساء",         lat: 25.3854,  lng: 49.5875 },
  { name: "سكاكا",           lat: 29.9697,  lng: 40.2001 },
  { name: "عرعر",            lat: 30.9753,  lng: 41.0381 },
  { name: "جازان",           lat: 16.8892,  lng: 42.5511 },
  { name: "الباحة",          lat: 20.0129,  lng: 41.4677 },
  { name: "رفحاء",           lat: 29.6263,  lng: 43.4906 },
  { name: "القريات",         lat: 31.3307,  lng: 37.3476 },
];

export function CreateTrip() {
  useProtectedRoute();
  const [, setLocation] = useLocation();
  const createTrip = useCreateTrip();
  const { data: vehicles } = useListVehicles();

  const [originCity, setOriginCity]   = useState(SAUDI_CITIES[0]);
  const [destCity, setDestCity]       = useState(SAUDI_CITIES[2]);
  const [error, setError]             = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);

    if (originCity.name === destCity.name) {
      setError("نقطة الانطلاق والوجهة لا يمكن أن تكونا نفس المدينة");
      return;
    }

    const data = {
      title: (fd.get("title") as string) || undefined,
      tripPurpose: fd.get("tripPurpose") as any,
      originName:      originCity.name,
      originLat:       originCity.lat,
      originLng:       originCity.lng,
      destinationName: destCity.name,
      destLat:         destCity.lat,
      destLng:         destCity.lng,
      departureTime:   new Date(fd.get("departureTime") as string).toISOString(),
      vehicleProfileId: (fd.get("vehicleProfileId") as string) || undefined,
      isPublic: true,
    };

    try {
      await createTrip.mutateAsync({ data });
      setLocation("/user/trips");
    } catch {
      setError("حدث خطأ أثناء إنشاء الرحلة. تأكد من ملء جميع الحقول.");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setLocation("/user/trips")} className="flex items-center gap-2 text-muted-foreground hover:text-primary font-bold mb-6 transition-colors">
          <ChevronRight className="w-5 h-5" /> العودة للرحلات
        </button>

        <h1 className="text-3xl font-black text-primary mb-2">رحلة جديدة</h1>
        <p className="text-muted-foreground mb-8">حدد مسار رحلتك لتستقبل العروض المناسبة من التجار على طريقك</p>

        <Card className="border-0 shadow-2xl bg-white/50 backdrop-blur-xl">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">

              <div className="space-y-2">
                <Label>عنوان الرحلة <span className="text-muted-foreground font-normal">(اختياري)</span></Label>
                <Input name="title" placeholder="مثال: رحلة عمل لجدة" className="bg-white" />
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>نقطة الانطلاق</Label>
                  <div className="relative">
                    <MapPin className="absolute right-3 top-3.5 w-5 h-5 text-primary pointer-events-none z-10" />
                    <select
                      className="flex h-12 w-full rounded-xl border-2 border-border bg-white pr-10 pl-4 py-2 text-sm font-bold focus:border-primary outline-none appearance-none"
                      value={originCity.name}
                      onChange={e => setOriginCity(SAUDI_CITIES.find(c => c.name === e.target.value)!)}
                    >
                      {SAUDI_CITIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الوجهة</Label>
                  <div className="relative">
                    <Navigation className="absolute right-3 top-3.5 w-5 h-5 text-accent pointer-events-none z-10" />
                    <select
                      className="flex h-12 w-full rounded-xl border-2 border-border bg-white pr-10 pl-4 py-2 text-sm font-bold focus:border-accent outline-none appearance-none"
                      value={destCity.name}
                      onChange={e => setDestCity(SAUDI_CITIES.find(c => c.name === e.target.value)!)}
                    >
                      {SAUDI_CITIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {originCity.name !== destCity.name && (
                <div className="flex items-center gap-3 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-bold text-sm">{originCity.name}</span>
                  <Navigation className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-bold text-sm text-accent">{destCity.name}</span>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>وقت المغادرة</Label>
                  <Input type="datetime-local" name="departureTime" required className="bg-white" />
                </div>
                <div className="space-y-2">
                  <Label>غرض الرحلة</Label>
                  <select name="tripPurpose" className="flex h-12 w-full rounded-xl border-2 border-border bg-white px-4 py-2 text-sm font-bold focus:border-accent outline-none">
                    <option value="TOURISM">🏖️ سياحة</option>
                    <option value="WORK">💼 عمل</option>
                    <option value="UMRAH">🕌 عمرة</option>
                    <option value="FAMILY_VISIT">👨‍👩‍👧 زيارة عائلية</option>
                    <option value="OTHER">🚗 أخرى</option>
                  </select>
                </div>
              </div>

              {vehicles && vehicles.length > 0 && (
                <div className="space-y-2">
                  <Label>المركبة المستخدمة <span className="text-muted-foreground font-normal">(اختياري)</span></Label>
                  <select name="vehicleProfileId" className="flex h-12 w-full rounded-xl border-2 border-border bg-white px-4 py-2 text-sm font-bold focus:border-accent outline-none">
                    <option value="">بدون مركبة محددة</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.nickname} — {v.make} {v.model}</option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 text-destructive font-bold px-4 py-3 rounded-xl text-sm">{error}</div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full text-lg h-14 shadow-xl shadow-primary/20"
                disabled={createTrip.isPending || originCity.name === destCity.name}
              >
                {createTrip.isPending ? "جاري النشر..." : "🚀 نشر الرحلة لاستقبال العروض"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
