import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuthStore } from "@/hooks/use-auth";
import { useLoginUser, useRegisterUser, useLoginMerchant, useRegisterMerchant } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Label, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";

export function AuthPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"user" | "merchant">("user");
  const [isLogin, setIsLogin] = useState(true);

  // Mutations
  const loginUser = useLoginUser();
  const registerUser = useRegisterUser();
  const loginMerchant = useLoginMerchant();
  const registerMerchant = useRegisterMerchant();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries()) as any;

    try {
      if (activeTab === "user") {
        if (isLogin) {
          const res = await loginUser.mutateAsync({ data });
          login(res.token);
          setLocation("/user/trips");
        } else {
          const res = await registerUser.mutateAsync({ data });
          login(res.token);
          setLocation("/user/trips");
        }
      } else {
        if (isLogin) {
          const res = await loginMerchant.mutateAsync({ data });
          login(res.token);
          setLocation("/merchant/dashboard");
        } else {
          const res = await registerMerchant.mutateAsync({ data });
          login(res.token);
          setLocation("/merchant/dashboard");
        }
      }
    } catch (err: any) {
      alert("خطأ: " + (err.message || "تحقق من البيانات المدخلة"));
    }
  };

  const isPending = loginUser.isPending || registerUser.isPending || loginMerchant.isPending || registerMerchant.isPending;

  return (
    <div className="min-h-screen w-full flex bg-background" dir="rtl">
      {/* Left Form Side */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 lg:p-24 relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <img src={`${import.meta.env.BASE_URL}images/logo-mark.png`} alt="Logo" className="w-16 h-16 mx-auto mb-6 rounded-2xl shadow-lg" />
            <h1 className="text-4xl font-black text-primary tracking-tight">أهلاً بك في دربي</h1>
            <p className="text-muted-foreground font-medium text-lg">منصة السفر الذكية للمسافرين والتجار</p>
          </div>

          <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-xl">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <CardHeader className="pb-4">
                <TabsList className="w-full grid grid-cols-2 p-1 bg-muted/50 rounded-xl">
                  <TabsTrigger value="user" className="rounded-lg py-2.5 font-bold">مسافر</TabsTrigger>
                  <TabsTrigger value="merchant" className="rounded-lg py-2.5 font-bold">تاجر</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {!isLogin && activeTab === "user" && (
                    <div className="space-y-2">
                      <Label>الاسم الكامل</Label>
                      <Input name="fullName" required placeholder="أحمد محمد" className="bg-white" />
                    </div>
                  )}
                  
                  {!isLogin && activeTab === "merchant" && (
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
                      <div className="space-y-2 hidden">
                         <Input name="commercialRegDocUrl" value="https://example.com/doc.pdf" readOnly />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input name="email" type="email" required placeholder="name@example.com" className="bg-white" dir="ltr" />
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
                    {isPending ? "جاري التحميل..." : isLogin ? "تسجيل الدخول" : "إنشاء حساب"}
                  </Button>
                </form>

                <div className="mt-8 text-center">
                  <button 
                    type="button" 
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-primary font-bold hover:text-accent transition-colors"
                  >
                    {isLogin ? "ليس لديك حساب؟ سجل الآن" : "لديك حساب بالفعل؟ سجل دخولك"}
                  </button>
                </div>
              </CardContent>
            </Tabs>
          </Card>
        </motion.div>
      </div>

      {/* Right Image Side */}
      <div className="hidden lg:block w-1/2 relative bg-primary overflow-hidden">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
          alt="Hero Background" 
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/50 to-transparent" />
        <div className="absolute bottom-20 right-20 max-w-lg text-white">
          <h2 className="text-5xl font-black leading-tight mb-4">رحلتك،<br/>بأفضل الأسعار</h2>
          <p className="text-xl text-white/80 font-medium leading-relaxed">
            منصة دربي تربطك بأفضل المحطات والمطاعم على مسار رحلتك بأسعار تفاوضية حصرية.
          </p>
        </div>
      </div>
    </div>
  );
}
