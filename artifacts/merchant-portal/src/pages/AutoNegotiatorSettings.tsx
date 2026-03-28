import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useGetAutoNegSettings, useUpdateAutoNegSettings, useListProducts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { Zap, Package, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

type AutoNegFormData = {
  isEnabled: boolean;
  minDiscountPct: number;
  maxDiscountPct: number;
  autoAcceptAbovePct: number;
  selectedProducts: string[];
};

export function AutoNegotiatorSettings() {
  const { data: settings, isLoading: loadingSettings } = useGetAutoNegSettings();
  const { data: products, isLoading: loadingProducts } = useListProducts();
  const updateSettings = useUpdateAutoNegSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const enabledProducts = products?.filter((p: any) => p.isAvailable) || [];

  const activeProductIds: string[] = settings?.products?.map((p: any) => p.productId || p.id) || [];

  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<AutoNegFormData>({
    defaultValues: {
      isEnabled: false,
      minDiscountPct: 5,
      maxDiscountPct: 20,
      autoAcceptAbovePct: 10,
      selectedProducts: [],
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        isEnabled: settings.isEnabled ?? false,
        minDiscountPct: settings.minDiscountPct ?? 5,
        maxDiscountPct: settings.maxDiscountPct ?? 20,
        autoAcceptAbovePct: settings.autoAcceptAbovePct ?? 10,
        selectedProducts: activeProductIds,
      });
    }
  }, [settings]);

  const isEnabled = watch("isEnabled");

  const onSubmit = async (data: AutoNegFormData) => {
    try {
      await updateSettings.mutateAsync({
        data: {
          isEnabled: data.isEnabled,
          minDiscountPct: Number(data.minDiscountPct),
          maxDiscountPct: Number(data.maxDiscountPct),
          autoAcceptAbovePct: Number(data.autoAcceptAbovePct),
          productIds: data.selectedProducts || [],
        },
      });
      queryClient.invalidateQueries({ queryKey: ["getAutoNegSettings"] });
      toast({ title: "تم الحفظ", description: "تم تحديث إعدادات المفاوض الذكي." });
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "حدث خطأ.", variant: "destructive" });
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all";
  const labelClass = "block text-sm font-bold text-muted-foreground mb-2";

  if (loadingSettings || loadingProducts) {
    return <AppLayout><div className="animate-pulse h-96 bg-muted rounded-2xl" /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-primary">المفاوض الذكي</h1>
            <p className="text-muted-foreground">يرد تلقائياً على عروض المسافرين بحسب القواعد المحددة</p>
          </div>
        </div>

        <Card className="mb-6 border-accent/20 bg-accent/5">
          <CardContent className="p-5 flex gap-3">
            <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-accent mb-1">كيف يعمل المفاوض الذكي؟</p>
              <p className="text-muted-foreground">عند استلام طلب تفاوض من مسافر، يقوم المفاوض تلقائياً بالرد بخصم ضمن النطاق المحدد. إذا كان الخصم المطلوب يتجاوز حد القبول التلقائي، يتم قبول العرض فوراً.</p>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black">تفعيل المفاوض الذكي</h3>
                  <p className="text-sm text-muted-foreground">الرد التلقائي على طلبات التفاوض من المسافرين</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" {...register("isEnabled")} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                </label>
              </div>
            </CardContent>
          </Card>

          {isEnabled && (
            <>
              <Card>
                <CardContent className="p-6 space-y-5">
                  <h3 className="text-lg font-black text-primary mb-4">نطاق الخصم</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>الحد الأدنى للخصم (%)</label>
                      <input type="number" min="0" max="100" {...register("minDiscountPct")} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>الحد الأقصى للخصم (%)</label>
                      <input type="number" min="0" max="100" {...register("maxDiscountPct")} className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>القبول التلقائي عند خصم أعلى من (%)</label>
                    <input type="number" min="0" max="100" {...register("autoAcceptAbovePct")} className={inputClass} />
                    <p className="text-xs text-muted-foreground mt-1">إذا طلب المسافر خصماً أعلى من هذه النسبة، يُقبل العرض تلقائياً</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-black text-primary mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    المنتجات المشمولة
                  </h3>
                  {enabledProducts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">لا توجد منتجات متاحة. أضف منتجات أولاً من قسم المنتجات.</p>
                  ) : (
                    <div className="space-y-3">
                      {enabledProducts.map((product: any) => (
                        <label key={product.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            value={product.id}
                            {...register("selectedProducts")}
                            className="w-5 h-5 accent-primary"
                          />
                          <div className="flex-1">
                            <p className="font-bold">{product.name}</p>
                            <p className="text-sm text-muted-foreground">{formatCurrency(product.price)}</p>
                          </div>
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{product.category}</Badge>
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          <Button type="submit" size="lg" className="w-full h-14 text-lg rounded-xl" disabled={isSubmitting}>
            {isSubmitting ? "جاري الحفظ..." : "حفظ إعدادات المفاوض"}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}
