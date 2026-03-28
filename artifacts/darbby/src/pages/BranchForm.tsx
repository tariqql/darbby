import React, { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useCreateBranch, useUpdateBranch, useListBranches } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent } from "@/components/ui";
import { ArrowRight, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type BranchFormData = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
};

export function BranchForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: branches } = useListBranches({ query: { enabled: isEdit } });
  const existing = isEdit ? branches?.find((b: any) => b.id === id) : null;

  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<BranchFormData>({
    defaultValues: {
      name: "", address: "",
      latitude: 24.7136, longitude: 46.6753,
      radiusMeters: 50000, isActive: true,
    },
  });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        address: existing.address || "",
        latitude: existing.latitude || 24.7136,
        longitude: existing.longitude || 46.6753,
        radiusMeters: existing.radiusMeters || 50000,
        isActive: existing.isActive ?? true,
      });
    }
  }, [existing, reset]);

  const onSubmit = async (data: BranchFormData) => {
    const payload = {
      ...data,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      radiusMeters: Number(data.radiusMeters),
    };
    try {
      if (isEdit) {
        await updateBranch.mutateAsync({ id: id!, data: payload });
        toast({ title: "تم التعديل", description: "تم تحديث بيانات الفرع." });
      } else {
        await createBranch.mutateAsync({ data: payload });
        toast({ title: "تمت الإضافة", description: "تمت إضافة الفرع بنجاح." });
      }
      queryClient.invalidateQueries({ queryKey: ["listBranches"] });
      setLocation("/merchant/branches");
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "حدث خطأ غير متوقع.", variant: "destructive" });
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all";
  const labelClass = "block text-sm font-bold text-muted-foreground mb-2";
  const errorClass = "text-xs text-destructive mt-1 font-medium";

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setLocation("/merchant/branches")} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-8 font-bold transition-colors group">
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          العودة للفروع
        </button>

        <div className="mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-primary">{isEdit ? "تعديل الفرع" : "إضافة فرع جديد"}</h1>
            <p className="text-muted-foreground">حدد موقع فرعك ونطاق الرصد الجغرافي</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className={labelClass}>اسم الفرع *</label>
                <input {...register("name", { required: "الاسم مطلوب" })} className={inputClass} placeholder="مثال: فرع طريق الرياض-الدمام" />
                {errors.name && <p className={errorClass}>{errors.name.message}</p>}
              </div>

              <div>
                <label className={labelClass}>العنوان</label>
                <input {...register("address")} className={inputClass} placeholder="مثال: كم 180 طريق الرياض الدمام" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>خط العرض (Latitude) *</label>
                  <input type="number" step="0.0001" {...register("latitude", { required: true, min: -90, max: 90 })} className={inputClass} />
                  {errors.latitude && <p className={errorClass}>أدخل خط عرض صحيح</p>}
                </div>
                <div>
                  <label className={labelClass}>خط الطول (Longitude) *</label>
                  <input type="number" step="0.0001" {...register("longitude", { required: true, min: -180, max: 180 })} className={inputClass} />
                  {errors.longitude && <p className={errorClass}>أدخل خط طول صحيح</p>}
                </div>
              </div>

              <div>
                <label className={labelClass}>نطاق الرصد (بالمتر)</label>
                <input type="number" {...register("radiusMeters", { min: 1000, max: 500000 })} className={inputClass} />
                <p className="text-xs text-muted-foreground mt-1">الإعداد الافتراضي: 50,000 متر (50 كم)</p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
                <input type="checkbox" id="isActive" {...register("isActive")} className="w-5 h-5 accent-primary" />
                <label htmlFor="isActive" className="font-bold cursor-pointer">تفعيل الفرع (سيظهر للمسافرين فوراً)</label>
              </div>

              <div className="flex gap-4 pt-2">
                <Button type="submit" size="lg" className="flex-1 h-14 text-lg rounded-xl" disabled={isSubmitting}>
                  {isSubmitting ? "جاري الحفظ..." : (isEdit ? "حفظ التعديلات" : "إضافة الفرع")}
                </Button>
                <Button type="button" variant="outline" size="lg" className="h-14 px-8 rounded-xl" onClick={() => setLocation("/merchant/branches")}>
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
