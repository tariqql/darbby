import React from "react";
import { Link } from "wouter";
import { useListMerchantOffers } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Badge } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { offerStatusAr, offerStatusVariant } from "@/lib/status";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { PackageSearch, ChevronLeft, Bot } from "lucide-react";

export function MerchantOffers() {
  const { data: result, isLoading } = useListMerchantOffers({ page: 1 });

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-primary">العروض المرسلة</h1>
        <p className="text-muted-foreground mt-1">تتبع حالة العروض التي قدمتها للمسافرين وتابع مفاوضاتك</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : result?.data.length === 0 ? (
        <Card className="py-20 text-center bg-muted/30 border-dashed border-2">
          <PackageSearch className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-xl font-bold mb-2">لا توجد عروض بعد</h3>
          <p className="text-muted-foreground mb-6">ابدأ بتقديم عروض للرحلات القريبة لزيادة مبيعاتك.</p>
          <Link href="/merchant/trips">
            <button className="bg-primary text-white font-bold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors">
              عرض الرحلات القريبة
            </button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-3">
          {result?.data.map(offer => (
            <Link key={offer.id} href={`/merchant/offers/${offer.id}`}>
              <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
                      <PackageSearch className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-lg">{formatCurrency(offer.finalPrice || offer.totalPrice)}</span>
                        <Badge variant={offerStatusVariant(offer.status)} className="text-xs">
                          {offerStatusAr[offer.status] ?? offer.status}
                        </Badge>
                        {(offer as any).isAutoOffer && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Bot className="w-3 h-3" /> DINA
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {offer.createdAt ? format(new Date(offer.createdAt), "dd MMM yyyy، HH:mm", { locale: arSA }) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                    <span className="text-sm font-bold hidden sm:block">التفاصيل والتفاوض</span>
                    <ChevronLeft className="w-5 h-5" />
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
