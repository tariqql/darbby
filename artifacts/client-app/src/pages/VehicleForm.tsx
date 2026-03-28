import React, { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useCreateVehicle, useUpdateVehicle, useListVehicles } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent } from "@/components/ui";
import { ArrowRight, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type VehicleFormData = {
  nickname: string;
  vehicleType: string;
  make: string;
  model: string;
  year: number;
  color: string;
  fuelType: string;
  plateNo: string;
  tankCapacityLiters: number;
};

const FUEL_OPTIONS = [
  { value: "PETROL_91", label: "بنزين 91" },
  { value: "PETROL_95", label: "بنزين 95" },
  { value: "DIESEL",    label: "ديزل" },
  { value: "ELECTRIC",  label: "كهربائي" },
  { value: "HYBRID",    label: "هجين" },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: "SEDAN",      label: "سيدان" },
  { value: "SUV",        label: "دفع رباعي (SUV)" },
  { value: "TRUCK",      label: "شاحنة" },
  { value: "VAN",        label: "فان" },
  { value: "MOTORCYCLE", label: "دراجة نارية" },
];

export function VehicleForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vehicles } = useListVehicles({ query: { enabled: isEdit } });
  const existing = isEdit ? vehicles?.find((v: any) => v.id === id) : null;

  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<VehicleFormData>({
    defaultValues: {
      nickname: "", vehicleType: "SEDAN", make: "", model: "",
      year: new Date().getFullYear(), color: "", fuelType: "PETROL_91",
      plateNo: "", tankCapacityLiters: 60,
    },
  });

  useEffect(() => {
    if (existing) {
      reset({
        nickname: existing.nickname,
        vehicleType: existing.vehicleType,
        make: existing.make,
        model: existing.model,
        year: existing.year,
        color: existing.color || "",
        fuelType: existing.fuelType,
        plateNo: existing.plateNo || "",
        tankCapacityLiters: existing.tankCapacityLiters ? Number(existing.tankCapacityLiters) : 60,
      });
    }
  }, [existing, reset]);

  const onSubmit = async (data: VehicleFormData) => {
    const payload = { ...data, year: Number(data.year), tankCapacityLiters: Number(data.tankCapacityLiters) };
    try {
      if (isEdit) {
        await updateVehicle.mutateAsync({ id: id!, data: payload });
        toast({ title: "تم التعديل", description: "تم تحديث بيانات المركبة." });
      } else {
        await createVehicle.mutateAsync({ data: payload });
        toast({ title: "تم الإضافة", description: "تمت إضافة المركبة بنجاح." });
      }
      queryClient.invalidateQueries({ queryKey: ["listVehicles"] });
      setLocation("/user/vehicles");
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
        <button onClick={() => setLocation("/user/vehicles")} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-8 font-bold transition-colors group">
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          العودة للمركبات
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black text-primary">{isEdit ? "تعديل المركبة" : "إضافة مركبة جديدة"}</h1>
          </div>
          <p className="text-muted-foreground mr-16">أدخل تفاصيل مركبتك للحصول على عروض وقود مخصصة</p>
        </div>

        <Card>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>اسم المركبة (للتمييز) *</label>
                  <input {...register("nickname", { required: "الاسم مطلوب" })} className={inputClass} placeholder="مثال: سيارتي الرئيسية" />
                  {errors.nickname && <p className={errorClass}>{errors.nickname.message}</p>}
                </div>

                <div>
                  <label className={labelClass}>نوع المركبة *</label>
                  <select {...register("vehicleType", { required: true })} className={inputClass}>
                    {VEHICLE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>الماركة *</label>
                  <input {...register("make", { required: "الماركة مطلوبة" })} className={inputClass} placeholder="مثال: تويوتا" />
                  {errors.make && <p className={errorClass}>{errors.make.message}</p>}
                </div>

                <div>
                  <label className={labelClass}>الموديل *</label>
                  <input {...register("model", { required: "الموديل مطلوب" })} className={inputClass} placeholder="مثال: كامري" />
                  {errors.model && <p className={errorClass}>{errors.model.message}</p>}
                </div>

                <div>
                  <label className={labelClass}>سنة الصنع *</label>
                  <input type="number" {...register("year", { required: true, min: 1990, max: new Date().getFullYear() + 1 })} className={inputClass} />
                  {errors.year && <p className={errorClass}>أدخل سنة صحيحة</p>}
                </div>

                <div>
                  <label className={labelClass}>اللون</label>
                  <input {...register("color")} className={inputClass} placeholder="مثال: أبيض" />
                </div>

                <div>
                  <label className={labelClass}>نوع الوقود *</label>
                  <select {...register("fuelType", { required: true })} className={inputClass}>
                    {FUEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>سعة الخزان (لتر)</label>
                  <input type="number" {...register("tankCapacityLiters", { min: 1, max: 300 })} className={inputClass} placeholder="60" />
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>رقم اللوحة</label>
                  <input {...register("plateNo")} className={inputClass} placeholder="مثال: أ ب ج 1234" />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" size="lg" className="flex-1 h-14 text-lg rounded-xl" disabled={isSubmitting}>
                  {isSubmitting ? "جاري الحفظ..." : (isEdit ? "حفظ التعديلات" : "إضافة المركبة")}
                </Button>
                <Button type="button" variant="outline" size="lg" className="h-14 px-8 rounded-xl" onClick={() => setLocation("/user/vehicles")}>
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
