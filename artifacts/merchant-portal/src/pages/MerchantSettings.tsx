import React from "react";
import { Link, useLocation } from "wouter";
import { useGetMerchantProfile, useUpdateMerchantProfile } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { Settings, Building2, LogOut, Zap, ChevronLeft } from "lucide-react";
import { useAuthStore } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type ProfileFormData = {
  businessName: string;
  ownerName: string;
  phone: string;
};

export function MerchantSettings() {
  const { data: profile, isLoading } = useGetMerchantProfile();
  const updateProfile = useUpdateMerchantProfile();
  const { logout } = useAuthStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { register, handleSubmit, formState: { isSubmitting, isDirty } } = useForm<ProfileFormData>({
    values: {
      businessName: profile?.businessName || "",
      ownerName: profile?.ownerName || "",
      phone: profile?.phone || "",
    },
  });

  const handleLogout = () => { logout(); setLocation("/login"); };

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile.mutateAsync({ data });
      queryClient.invalidateQueries({ queryKey: ["getMerchantProfile"] });
      toast({ title: "تم الحفظ", description: "تم تحديث بيانات المنشأة." });
    } catch {
      toast({ title: "خطأ", description: "تعذر تحديث البيانات.", variant: "destructive" });
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all disabled:opacity-60";
  const labelClass = "block text-sm font-bold text-muted-foreground mb-2";

  if (isLoading) return <AppLayout><div className="animate-pulse h-96 bg-muted rounded-2xl" /></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-primary">إعدادات الحساب</h1>
            <p className="text-muted-foreground">أدر بيانات منشأتك وإعدادات حسابك</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-primary text-white font-black text-2xl flex items-center justify-center shadow-lg">
                {profile?.businessName?.charAt(0) || "م"}
              </div>
              <div>
                <h2 className="text-xl font-black">{profile?.businessName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-xs ${profile?.subscriptionTier === "PREMIUM" ? "bg-accent/15 text-accent border-accent/30" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                    {profile?.subscriptionTier || "FREE"}
                  </Badge>
                  {profile?.isVerified && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">موثّق</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-xl mb-2">
              <p className="text-xs text-muted-foreground font-bold mb-0.5">البريد الإلكتروني</p>
              <p className="font-bold">{profile?.email}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-black text-primary mb-5 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              تعديل بيانات المنشأة
            </h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className={labelClass}>اسم المنشأة</label>
                <input {...register("businessName")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>اسم المالك</label>
                <input {...register("ownerName")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>رقم الهاتف</label>
                <input {...register("phone")} className={inputClass} dir="ltr" />
              </div>
              <Button type="submit" className="w-full h-12 rounded-xl" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mb-6 border-accent/20 bg-accent/5">
          <CardContent className="p-5">
            <Link href="/merchant/auto-negotiator">
              <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-black">إعدادات المفاوض الذكي</p>
                    <p className="text-sm text-muted-foreground">تحكم في قواعد التفاوض التلقائي</p>
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-black text-lg mb-4 text-destructive">منطقة الخطر</h3>
            <Button
              variant="outline"
              className="w-full h-12 border-destructive/30 text-destructive hover:bg-destructive hover:text-white gap-2 font-bold"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              تسجيل الخروج من الحساب
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
