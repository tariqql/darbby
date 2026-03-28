import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListVehicles, useDeleteVehicle, useCreateVehicle, useUpdateVehicle } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { Car, Plus, Trash2, Star, Fuel, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FUEL_LABELS: Record<string, string> = {
  PETROL_91: "بنزين 91",
  PETROL_95: "بنزين 95",
  DIESEL: "ديزل",
  ELECTRIC: "كهربائي",
  HYBRID: "هجين",
};

const VEHICLE_TYPE_ICONS: Record<string, string> = {
  SUV: "🚙",
  SEDAN: "🚗",
  TRUCK: "🚚",
  VAN: "🚐",
  MOTORCYCLE: "🏍️",
};

export function VehicleList() {
  const [, setLocation] = useLocation();
  const { data: vehicles, isLoading } = useListVehicles();
  const deleteVehicle = useDeleteVehicle();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المركبة؟")) return;
    setDeleting(id);
    try {
      await deleteVehicle.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["listVehicles"] });
      toast({ title: "تم الحذف", description: "تم حذف المركبة بنجاح." });
    } catch {
      toast({ title: "خطأ", description: "تعذر حذف المركبة.", variant: "destructive" });
    }
    setDeleting(null);
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary">مركباتي</h1>
          <p className="text-muted-foreground mt-1">أدر مركباتك واختر الوقود المفضل لكل رحلة</p>
        </div>
        <Link href="/user/vehicles/new">
          <Button size="lg" className="rounded-2xl gap-2 w-full sm:w-auto">
            <Plus className="w-5 h-5" />
            إضافة مركبة
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : !vehicles?.length ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-muted/30 border-dashed border-2">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Car className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">لا توجد مركبات بعد</h3>
          <p className="text-muted-foreground max-w-sm mb-8">أضف مركبتك للحصول على عروض وقود مخصصة على مسار رحلتك.</p>
          <Link href="/user/vehicles/new">
            <Button size="lg">أضف مركبتك الأولى</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {vehicles.map((v: any) => (
            <Card key={v.id} className="hover:shadow-xl transition-all duration-300 group border-border/70">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center text-3xl border border-border/50">
                      {VEHICLE_TYPE_ICONS[v.vehicleType] || "🚗"}
                    </div>
                    <div>
                      <h3 className="text-xl font-black">{v.nickname}</h3>
                      <p className="text-muted-foreground font-medium">{v.make} {v.model} — {v.year}</p>
                    </div>
                  </div>
                  {v.isPrimary && (
                    <Badge className="bg-accent/15 text-accent border-accent/30 font-bold">
                      <Star className="w-3 h-3 ml-1" />
                      الرئيسية
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-muted/60 rounded-xl p-3 text-center">
                    <Fuel className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <p className="text-xs text-muted-foreground font-bold">الوقود</p>
                    <p className="text-sm font-black text-foreground">{FUEL_LABELS[v.fuelType] || v.fuelType}</p>
                  </div>
                  <div className="bg-muted/60 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground font-bold mb-1">اللون</p>
                    <p className="text-sm font-black text-foreground">{v.color || "—"}</p>
                  </div>
                  <div className="bg-muted/60 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground font-bold mb-1">الخزان</p>
                    <p className="text-sm font-black text-foreground">{v.tankCapacityLiters ? `${v.tankCapacityLiters}L` : "—"}</p>
                  </div>
                </div>

                {v.plateNo && (
                  <div className="bg-primary/5 rounded-xl px-4 py-2 mb-4 text-center border border-primary/10">
                    <span className="font-black text-primary tracking-widest text-lg">{v.plateNo}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <Link href={`/user/vehicles/${v.id}/edit`} className="flex-1">
                    <Button variant="outline" className="w-full gap-2">
                      <Edit3 className="w-4 h-4" />
                      تعديل
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive hover:text-white px-4"
                    onClick={() => handleDelete(v.id)}
                    disabled={deleting === v.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
