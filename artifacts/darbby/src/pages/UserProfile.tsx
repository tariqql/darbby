import React from "react";
import { useAuthStore } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Button } from "@/components/ui";
import { User, Mail, Shield, LogOut } from "lucide-react";
import { useLocation } from "wouter";

export function UserProfile() {
  const { user, logout } = useAuthStore();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const initials = user?.email?.charAt(0)?.toUpperCase() || "م";

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-primary">حسابي</h1>
          <p className="text-muted-foreground mt-1">معلومات حسابك الشخصي</p>
        </div>

        <Card className="mb-6 overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-primary to-primary/80" />
          <CardContent className="px-8 pb-8">
            <div className="flex items-end gap-6 -mt-12 mb-8">
              <div className="w-20 h-20 rounded-2xl bg-accent text-white font-black text-3xl flex items-center justify-center shadow-xl border-4 border-background">
                {initials}
              </div>
              <div className="mb-2">
                <h2 className="text-2xl font-black text-foreground">{user?.email?.split("@")[0]}</h2>
                <p className="text-muted-foreground font-medium">مسافر</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold">البريد الإلكتروني</p>
                  <p className="font-bold text-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold">نوع الحساب</p>
                  <p className="font-bold text-foreground">مسافر — Darbby</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold">معرف الحساب</p>
                  <p className="font-mono text-sm font-bold text-foreground">{user?.id?.slice(0, 8)}...</p>
                </div>
              </div>
            </div>
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
