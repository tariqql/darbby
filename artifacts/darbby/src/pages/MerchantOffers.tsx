import React from "react";
import { Link } from "wouter";
import { useListMerchantOffers } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Badge } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

export function MerchantOffers() {
  const { data: result, isLoading } = useListMerchantOffers({ page: 1 });

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-primary">العروض المرسلة</h1>
        <p className="text-muted-foreground mt-1">تتبع حالة العروض التي قدمتها للمسافرين</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : result?.data.length === 0 ? (
        <Card className="py-20 text-center bg-muted/30 border-dashed">
          <h3 className="text-xl font-bold mb-2">لا توجد عروض</h3>
          <p className="text-muted-foreground">ابدأ بتقديم العروض للرحلات القريبة لزيادة مبيعاتك.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {result?.data.map(offer => (
            <Link key={offer.id} href={`/merchant/offers/${offer.id}`}>
              <Card className="hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-lg">عرض بقيمة {formatCurrency(offer.finalPrice || offer.totalPrice)}</span>
                      <Badge variant={offer.status === 'ACCEPTED' ? 'success' : offer.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                        {offer.status}
                      </Badge>
                      {offer.isAutoOffer && <Badge variant="accent" className="bg-accent/20 text-accent">تلقائي</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      تم الإرسال: {format(new Date(offer.createdAt!), 'dd MMM, HH:mm', { locale: arSA })}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-primary hover:underline">عرض التفاصيل والتفاوض &larr;</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
