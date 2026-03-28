import React, { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useCreateProduct, useUpdateProduct, useListProducts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent } from "@/components/ui";
import { ArrowRight, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ProductFormData = {
  name: string;
  description: string;
  price: number;
  category: string;
  targetFuelType: string;
  stockQty: number;
  isAvailable: boolean;
};

const CATEGORY_OPTIONS = [
  { value: "FUEL",    label: "وقود" },
  { value: "FOOD",    label: "طعام ومشروبات" },
  { value: "LODGING", label: "إقامة وفنادق" },
  { value: "SERVICE", label: "خدمات" },
  { value: "RETAIL",  label: "بيع تجزئة" },
  { value: "OTHER",   label: "أخرى" },
];

const FUEL_TYPE_OPTIONS = [
  { value: "",          label: "— لا ينطبق —" },
  { value: "PETROL_91", label: "بنزين 91" },
  { value: "PETROL_95", label: "بنزين 95" },
  { value: "DIESEL",    label: "ديزل" },
  { value: "ELECTRIC",  label: "كهربائي" },
  { value: "HYBRID",    label: "هجين" },
];

export function ProductForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products } = useListProducts({ query: { enabled: isEdit } });
  const existing = isEdit ? products?.find((p: any) => p.id === id) : null;

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProductFormData>({
    defaultValues: {
      name: "", description: "", price: 0,
      category: "FUEL", targetFuelType: "",
      stockQty: 0, isAvailable: true,
    },
  });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        description: existing.description || "",
        price: Number(existing.price) || 0,
        category: existing.category || "OTHER",
        targetFuelType: existing.targetFuelType || "",
        stockQty: existing.stockQty || 0,
        isAvailable: existing.isAvailable ?? true,
      });
    }
  }, [existing, reset]);

  const onSubmit = async (data: ProductFormData) => {
    const payload = {
      ...data,
      price: Number(data.price),
      stockQty: Number(data.stockQty),
      targetFuelType: data.targetFuelType || undefined,
    };
    try {
      if (isEdit) {
        await updateProduct.mutateAsync({ id: id!, data: payload });
        toast({ title: "تم التعديل", description: "تم تحديث المنتج." });
      } else {
        await createProduct.mutateAsync({ data: payload });
        toast({ title: "تمت الإضافة", description: "تمت إضافة المنتج بنجاح." });
      }
      queryClient.invalidateQueries({ queryKey: ["listProducts"] });
      setLocation("/merchant/products");
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
        <button onClick={() => setLocation("/merchant/products")} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-8 font-bold transition-colors group">
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          العودة للمنتجات
        </button>

        <div className="mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-primary">{isEdit ? "تعديل المنتج" : "إضافة منتج جديد"}</h1>
            <p className="text-muted-foreground">أضف منتجاتك وخدماتك لتكون متاحة في العروض</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className={labelClass}>اسم المنتج / الخدمة *</label>
                <input {...register("name", { required: "الاسم مطلوب" })} className={inputClass} placeholder="مثال: بنزين 91" />
                {errors.name && <p className={errorClass}>{errors.name.message}</p>}
              </div>

              <div>
                <label className={labelClass}>الوصف</label>
                <textarea {...register("description")} rows={3} className={`${inputClass} resize-none`} placeholder="وصف مختصر للمنتج أو الخدمة" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>الفئة *</label>
                  <select {...register("category", { required: true })} className={inputClass}>
                    {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>نوع الوقود المستهدف</label>
                  <select {...register("targetFuelType")} className={inputClass}>
                    {FUEL_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>السعر (ر.س) *</label>
                  <input type="number" step="0.01" min="0" {...register("price", { required: true, min: 0 })} className={inputClass} />
                  {errors.price && <p className={errorClass}>أدخل سعراً صحيحاً</p>}
                </div>

                <div>
                  <label className={labelClass}>الكمية المتاحة</label>
                  <input type="number" min="0" {...register("stockQty")} className={inputClass} placeholder="0 = غير محدود" />
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
                <input type="checkbox" id="isAvailable" {...register("isAvailable")} className="w-5 h-5 accent-primary" />
                <label htmlFor="isAvailable" className="font-bold cursor-pointer">المنتج متاح للبيع حالياً</label>
              </div>

              <div className="flex gap-4 pt-2">
                <Button type="submit" size="lg" className="flex-1 h-14 text-lg rounded-xl" disabled={isSubmitting}>
                  {isSubmitting ? "جاري الحفظ..." : (isEdit ? "حفظ التعديلات" : "إضافة المنتج")}
                </Button>
                <Button type="button" variant="outline" size="lg" className="h-14 px-8 rounded-xl" onClick={() => setLocation("/merchant/products")}>
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
