import React from "react";
import { Link } from "wouter";
import { useGetMerchantStats } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Wallet, PackageCheck, Zap, ArrowUpRight, Map } from "lucide-react";

const DAYS_AR: Record<string, string> = {
  Mon: "الإثنين", Tue: "الثلاثاء", Wed: "الأربعاء", Thu: "الخميس",
  Fri: "الجمعة",  Sat: "السبت",   Sun: "الأحد",
};

export function MerchantDashboard() {
  const { data: stats, isLoading } = useGetMerchantStats();

  const chartData = (stats as any)?.weeklyRevenue?.length
    ? (stats as any).weeklyRevenue.map((d: any) => ({ name: DAYS_AR[d.name] ?? d.name, value: d.value }))
    : [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}
        </div>
        <div className="h-72 bg-muted animate-pulse rounded-2xl" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-primary">لوحة القيادة</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على أداء أعمالك والعروض</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white border-0 shadow-lg shadow-primary/25 col-span-2 lg:col-span-1">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/70 font-bold mb-1 text-sm">الإيرادات الكلية</p>
                <h3 className="text-3xl font-black">{formatCurrency(stats?.totalRevenue ?? 0)}</h3>
              </div>
              <div className="p-3 bg-white/15 rounded-xl">
                <Wallet className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-bold mb-1 text-sm">عروض مقبولة</p>
                <h3 className="text-3xl font-black">{stats?.acceptedOffers ?? 0}</h3>
              </div>
              <div className="p-3 bg-success/10 rounded-xl">
                <PackageCheck className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-bold mb-1 text-sm">رحلات قريبة</p>
                <h3 className="text-3xl font-black">{stats?.activeTripsNearby ?? 0}</h3>
              </div>
              <div className="p-3 bg-accent/10 rounded-xl">
                <Zap className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-bold mb-1 text-sm">إجمالي العروض</p>
                <h3 className="text-3xl font-black">{stats?.totalOffers ?? 0}</h3>
              </div>
              <div className="p-3 bg-secondary/50 rounded-xl">
                <ArrowUpRight className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">إيرادات الأسبوع الأخير</h3>
              <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">آخر 7 أيام</span>
            </div>
            {chartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <Wallet className="w-12 h-12 mb-3 opacity-30" />
                <p className="font-bold">لا توجد صفقات مكتملة بعد</p>
                <p className="text-sm mt-1">ستظهر الإيرادات هنا بعد أول عملية بيع</p>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={36}>
                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v} ر.س`} width={65} />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.04)" }}
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12)", fontFamily: "inherit" }}
                      formatter={(v: number) => [`${v.toFixed(2)} ر.س`, "الإيراد"]}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {chartData.map((_: any, i: number) => (
                        <Cell key={i} fill={i === chartData.length - 1 ? "hsl(var(--accent))" : "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6 flex flex-col h-full">
            <h3 className="text-xl font-bold mb-6">إجراءات سريعة</h3>
            <div className="space-y-3 flex-1">
              <Link href="/merchant/trips">
                <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-accent/5 hover:bg-accent/10 border border-accent/20 transition-colors text-right">
                  <div className="w-10 h-10 bg-accent/15 rounded-xl flex items-center justify-center shrink-0">
                    <Map className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">الرحلات القريبة</p>
                    <p className="text-xs text-muted-foreground">قدّم عروضاً الآن</p>
                  </div>
                  <span className="mr-auto bg-accent text-white text-xs font-black px-2 py-1 rounded-lg">
                    {stats?.activeTripsNearby ?? 0}
                  </span>
                </button>
              </Link>

              <Link href="/merchant/offers">
                <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 transition-colors text-right mt-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <PackageCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">عروضي</p>
                    <p className="text-xs text-muted-foreground">تتبع وتفاوض</p>
                  </div>
                  <span className="mr-auto bg-primary/10 text-primary text-xs font-black px-2 py-1 rounded-lg">
                    {(stats as any)?.pendingOffers ?? 0} معلّق
                  </span>
                </button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
