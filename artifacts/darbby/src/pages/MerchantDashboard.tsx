import React from "react";
import { useGetMerchantStats } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Wallet, PackageCheck, Zap, ArrowUpRight } from "lucide-react";

export function MerchantDashboard() {
  const { data: stats, isLoading } = useGetMerchantStats();

  const dummyChartData = [
    { name: 'السبت', value: 4000 },
    { name: 'الأحد', value: 3000 },
    { name: 'الاثنين', value: 5000 },
    { name: 'الثلاثاء', value: 2780 },
    { name: 'الأربعاء', value: 8900 },
    { name: 'الخميس', value: 2390 },
    { name: 'الجمعة', value: 13490 },
  ];

  if (isLoading) return <AppLayout><div className="animate-pulse h-screen bg-muted rounded-2xl" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-primary">لوحة القيادة</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على أداء أعمالك والعروض</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-primary to-primary/90 text-white border-0 shadow-lg shadow-primary/20">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/70 font-bold mb-1">الإيرادات المحققة</p>
                <h3 className="text-3xl font-black">{formatCurrency(stats?.totalRevenue || 0)}</h3>
              </div>
              <div className="p-3 bg-white/10 rounded-xl"><Wallet className="w-6 h-6 text-accent" /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-bold mb-1">العروض المقبولة</p>
                <h3 className="text-3xl font-black text-foreground">{stats?.acceptedOffers || 0}</h3>
              </div>
              <div className="p-3 bg-success/10 rounded-xl"><PackageCheck className="w-6 h-6 text-success" /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-bold mb-1">رحلات نشطة بالقرب منك</p>
                <h3 className="text-3xl font-black text-foreground">{stats?.activeTripsNearby || 0}</h3>
              </div>
              <div className="p-3 bg-accent/10 rounded-xl"><Zap className="w-6 h-6 text-accent" /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-bold mb-1">إجمالي العروض المرسلة</p>
                <h3 className="text-3xl font-black text-foreground">{stats?.totalOffers || 0}</h3>
              </div>
              <div className="p-3 bg-secondary/50 rounded-xl"><ArrowUpRight className="w-6 h-6 text-primary" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm mb-8">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold mb-6">إيرادات الأسبوع (تجريبي)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dummyChartData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value} ر.س`} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
