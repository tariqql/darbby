import React from "react";
import { useGetMerchantCommission } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Badge } from "@/components/ui";
import { Receipt, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

export function CommissionLedger() {
  const { data, isLoading } = useGetMerchantCommission();

  const summary = data?.summary;
  const entries = data?.entries || [];

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-primary">سجل العمولات</h1>
        <p className="text-muted-foreground mt-1">تتبع العمولات المستحقة على منصة دربي</p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />)}
          </div>
          <div className="h-64 bg-muted animate-pulse rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-primary to-primary/90 text-white border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white/70 font-bold text-sm mb-1">إجمالي المبيعات</p>
                    <h3 className="text-3xl font-black">{formatCurrency(summary?.totalRevenue || 0)}</h3>
                  </div>
                  <div className="p-3 bg-white/10 rounded-xl">
                    <Wallet className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-muted-foreground font-bold text-sm mb-1">إجمالي العمولات</p>
                    <h3 className="text-3xl font-black text-destructive">{formatCurrency(summary?.totalCommission || 0)}</h3>
                  </div>
                  <div className="p-3 bg-destructive/10 rounded-xl">
                    <TrendingDown className="w-6 h-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-muted-foreground font-bold text-sm mb-1">الصافي بعد العمولات</p>
                    <h3 className="text-3xl font-black text-green-600">
                      {formatCurrency((summary?.totalRevenue || 0) - (summary?.totalCommission || 0))}
                    </h3>
                  </div>
                  <div className="p-3 bg-green-50 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-black text-primary mb-6 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-accent" />
                تفاصيل العمولات
              </h3>

              {entries.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Receipt className="w-8 h-8 text-muted-foreground opacity-50" />
                  </div>
                  <h4 className="font-bold text-lg mb-2">لا توجد عمولات بعد</h4>
                  <p className="text-muted-foreground">ستظهر هنا بعد أول صفقة مكتملة.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 text-sm font-bold text-muted-foreground">التاريخ</th>
                        <th className="pb-3 text-sm font-bold text-muted-foreground">العرض</th>
                        <th className="pb-3 text-sm font-bold text-muted-foreground">قيمة البيع</th>
                        <th className="pb-3 text-sm font-bold text-muted-foreground">نسبة العمولة</th>
                        <th className="pb-3 text-sm font-bold text-muted-foreground">قيمة العمولة</th>
                        <th className="pb-3 text-sm font-bold text-muted-foreground">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {entries.map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-4 text-sm text-muted-foreground">
                            {format(new Date(entry.createdAt), 'dd/MM/yyyy', { locale: arSA })}
                          </td>
                          <td className="py-4 font-medium">{entry.offerId?.slice(0,8)}...</td>
                          <td className="py-4 font-bold text-foreground">{formatCurrency(entry.revenue)}</td>
                          <td className="py-4 text-center">
                            <Badge className="bg-primary/10 text-primary border-primary/20">
                              {entry.commissionRate}%
                            </Badge>
                          </td>
                          <td className="py-4 font-bold text-destructive">{formatCurrency(entry.commissionAmt)}</td>
                          <td className="py-4">
                            <Badge className={entry.isPaid ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                              {entry.isPaid ? "مسدّد" : "معلق"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
}
