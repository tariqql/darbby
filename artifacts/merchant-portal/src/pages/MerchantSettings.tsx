import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetMerchantProfile, useUpdateMerchantProfile } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { Settings, Building2, LogOut, Zap, ChevronLeft, Key, Copy, Eye, EyeOff, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type ProfileFormData = {
  businessName: string;
  ownerName: string;
  phone: string;
};

type ApiKey = {
  id: string;
  key_type: string;
  key_prefix: string;
  api_key: string;
  api_key_masked: string;
  description: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
};

export function MerchantSettings() {
  const { data: profile, isLoading } = useGetMerchantProfile();
  const updateProfile = useUpdateMerchantProfile();
  const { logout, token } = useAuthStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  const fetchApiKeys = async () => {
    setKeysLoading(true);
    try {
      const res = await fetch(`/api/merchant/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setApiKeys(data.keys || []);
    } catch {
      setApiKeys([]);
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => { fetchApiKeys(); }, []);

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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast({ title: "تم النسخ", description: "تم نسخ مفتاح الـ API." });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      const res = await fetch(`/api/merchant/api-keys/rotate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم التجديد", description: "تم إنشاء مفتاح API جديد. احفظه الآن." });
        await fetchApiKeys();
        setShowRotateConfirm(false);
      }
    } catch {
      toast({ title: "خطأ", description: "تعذر تجديد المفتاح.", variant: "destructive" });
    } finally {
      setRotating(false);
    }
  };

  const { register, handleSubmit, formState: { isSubmitting, isDirty } } = useForm<ProfileFormData>({
    values: {
      businessName: profile?.businessName || "",
      ownerName: profile?.ownerName || "",
      phone: profile?.phone || "",
    },
  });

  const inputClass = "w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all disabled:opacity-60";
  const labelClass = "block text-sm font-bold text-muted-foreground mb-2";

  const activeKey = apiKeys.find(k => k.is_active && k.key_type === "LIVE");

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

        {/* Profile Card */}
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

        {/* Edit Profile */}
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

        {/* API Keys Section */}
        <Card className="mb-6 border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="p-6">
            <h3 className="text-lg font-black text-primary mb-1 flex items-center gap-2">
              <Key className="w-5 h-5" />
              مفاتيح الـ API
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              استخدم هذا المفتاح للتكامل مع نظام الكاشير (POS) الخاص بك.
            </p>

            {keysLoading ? (
              <div className="animate-pulse h-20 bg-muted rounded-xl" />
            ) : !activeKey ? (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                <div>
                  <p className="font-bold text-yellow-800">لا يوجد مفتاح API نشط</p>
                  <p className="text-sm text-yellow-700">سيتم إنشاء مفتاح تلقائياً عند موافقة الإدارة على حسابك.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Key Display */}
                <div className="p-4 bg-white dark:bg-card border border-border rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-bold text-green-700">نشط — LIVE</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(activeKey.created_at).toLocaleDateString("ar-SA")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <code
                      className="flex-1 px-3 py-2.5 bg-muted rounded-lg text-sm font-mono break-all select-all"
                      dir="ltr"
                    >
                      {showKey[activeKey.id] ? activeKey.api_key : activeKey.api_key_masked}
                    </code>
                    <button
                      onClick={() => setShowKey(prev => ({ ...prev, [activeKey.id]: !prev[activeKey.id] }))}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title={showKey[activeKey.id] ? "إخفاء" : "إظهار"}
                    >
                      {showKey[activeKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleCopy(activeKey.api_key, activeKey.id)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="نسخ"
                    >
                      {copied === activeKey.id
                        ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                        : <Copy className="w-4 h-4" />
                      }
                    </button>
                  </div>
                  {activeKey.last_used_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      آخر استخدام: {new Date(activeKey.last_used_at).toLocaleString("ar-SA")}
                    </p>
                  )}
                </div>

                {/* Usage Guide */}
                <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-1" dir="ltr">
                  <p className="font-bold text-foreground mb-2">كيفية الاستخدام (HTTP Header):</p>
                  <code className="block bg-background p-2 rounded-lg">
                    Authorization: Bearer {activeKey.key_prefix}•••
                  </code>
                  <p className="mt-2 font-bold text-foreground">أو كـ API Key Header:</p>
                  <code className="block bg-background p-2 rounded-lg">
                    X-API-Key: {activeKey.key_prefix}•••
                  </code>
                </div>

                {/* Rotate Key */}
                {!showRotateConfirm ? (
                  <button
                    onClick={() => setShowRotateConfirm(true)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors font-bold"
                  >
                    <RefreshCw className="w-4 h-4" />
                    تجديد المفتاح (rotate)
                  </button>
                ) : (
                  <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-xl">
                    <p className="text-sm font-bold text-destructive mb-3">
                      ⚠️ سيتم إلغاء المفتاح الحالي فوراً. تأكد من تحديث جميع أنظمتك بعد التجديد.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleRotate}
                        disabled={rotating}
                        className="gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${rotating ? "animate-spin" : ""}`} />
                        {rotating ? "جاري التجديد..." : "تأكيد التجديد"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRotateConfirm(false)}
                        disabled={rotating}
                      >
                        إلغاء
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto-Negotiator Link */}
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

        {/* Danger Zone */}
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
