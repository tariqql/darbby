import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuthStore } from "@/hooks/use-auth";
import { useLoginMerchant, useRegisterMerchant } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, Input, Button, Label } from "@/components/ui";

export function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);

  const loginMerchant = useLoginMerchant();
  const registerMerchant = useRegisterMerchant();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries()) as any;

    try {
      if (isLogin) {
        const res = await loginMerchant.mutateAsync({ data });
        login(res.token);
        setLocation("/merchant/dashboard");
      } else {
        const res = await registerMerchant.mutateAsync({ data });
        login(res.token);
        setLocation("/merchant/dashboard");
      }
    } catch (err: any) {
      alert("خطأ: " + (err.message || "تحقق من البيانات المدخلة"));
    }
  };

  const isPending = loginMerchant.isPending || registerMerchant.isPending;

  return (
    <div className="min-h-screen w-full flex bg-background" dir="rtl">
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 lg:p-24 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <img src={`${import.meta.env.BASE_URL}images/logo-mark.png`} alt="Logo" className="w-16 h-16 mx-auto mb-6 rounded-2xl shadow-lg" />
            <h1 className="text-4xl font-black text-primary tracking-tight">بوابة التاجر</h1>
            <p className="text-muted-foreground font-medium text-lg">منصة دربي للتجار والمنشآت</p>
          </div>

          <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <p className="text-center text-sm text-muted-foreground font-medium">
                {isLogin ? "تسجيل دخول التاجر" : "تسجيل منشأة تجارية جديدة"}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>اسم المنشأة</Label>
                        <Input name="businessName" required placeholder="محطة الرواد" className="bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label>اسم المالك</Label>
                        <Input name="ownerName" required placeholder="عبدالله" className="bg-white" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>السجل التجاري</Label>
                        <Input name="commercialRegNo" required className="bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label>تاريخ الانتهاء</Label>
                        <Input type="date" name="commercialRegExpiry" required className="bg-white" />
                      </div>
                    </div>
                    <div className="hidden">
                      <Input name="commercialRegDocUrl" value="https://example.com/doc.pdf" readOnly />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input name="email" type="email" required placeholder="business@example.com" className="bg-white" dir="ltr" />
                </div>

                {!isLogin && (
                  <div className="space-y-2">
                    <Label>رقم الجوال</Label>
                    <Input name="phone" required placeholder="05xxxxxxxx" className="bg-white" dir="ltr" />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>كلمة المرور</Label>
                  <Input name="password" type="password" required className="bg-white" dir="ltr" />
                </div>

                <Button type="submit" className="w-full h-14 text-lg rounded-xl shadow-xl shadow-primary/20 mt-4" disabled={isPending}>
                  {isPending ? "جاري التحميل..." : isLogin ? "تسجيل الدخول" : "تسجيل المنشأة"}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary font-bold hover:text-accent transition-colors"
                >
                  {isLogin ? "منشأة جديدة؟ سجل الآن" : "لديك حساب؟ سجل دخولك"}
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="hidden lg:block w-1/2 relative bg-primary overflow-hidden">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/50 to-transparent" />
        <div className="absolute bottom-20 right-20 max-w-lg text-white">
          <h2 className="text-5xl font-black leading-tight mb-4">وسّع نطاق<br />عملك</h2>
          <p className="text-xl text-white/80 font-medium leading-relaxed">
            تواصل مع المسافرين على طول الطريق وقدم لهم عروضاً حصرية بنظام المفاوضة الذكية DINE.
          </p>
        </div>
      </div>
    </div>
  );
}
