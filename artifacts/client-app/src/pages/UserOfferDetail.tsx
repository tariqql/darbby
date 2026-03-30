import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetOffer, useAcceptOffer, useRejectOffer, useCounterOffer } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Badge, Button, Dialog, DialogContent, DialogTrigger, Input, Label } from "@/components/ui";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils";
import { offerStatusAr, offerStatusVariant } from "@/lib/status";
import { CheckCircle, XCircle, RefreshCw, ChevronRight, Store, Clock } from "lucide-react";
import { useProtectedRoute } from "@/hooks/use-auth";

export function UserOfferDetail() {
  useProtectedRoute();
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { data: offer, isLoading, refetch } = useGetOffer(id!);
  const acceptOffer  = useAcceptOffer();
  const rejectOffer  = useRejectOffer();
  const counterOffer = useCounterOffer();

  const [counterPrice, setCounterPrice] = useState("");
  const [isCounterOpen, setIsCounterOpen] = useState(false);

  if (isLoading) return <AppLayout><div className="animate-pulse h-64 bg-muted rounded-2xl" /></AppLayout>;
  if (!offer) return <AppLayout><div className="p-8 text-center font-bold">العرض غير موجود</div></AppLayout>;

  const handleAccept = async () => {
    await acceptOffer.mutateAsync({ id: id! });
    refetch();
  };

  const handleReject = async () => {
    await rejectOffer.mutateAsync({ id: id! });
    refetch();
  };

  const handleCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    await counterOffer.mutateAsync({ id: id!, data: { proposedPrice: parseFloat(counterPrice) } });
    setIsCounterOpen(false);
    setCounterPrice("");
    refetch();
  };

  const isActive = ["SENT", "VIEWED", "NEGOTIATING"].includes(offer.status);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => setLocation("/user/trips")}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary font-bold transition-colors"
        >
          <ChevronRight className="w-5 h-5" /> العودة للرحلات
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-primary">تفاصيل العرض</h1>
          <Badge variant={offerStatusVariant(offer.status)} className="text-base px-4 py-1.5 rounded-xl">
            {offerStatusAr[offer.status] ?? offer.status}
          </Badge>
        </div>

        <Card className="border-0 shadow-2xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-accent to-primary" />
          <CardContent className="p-8 space-y-8">

            <div className="grid md:grid-cols-2 gap-8 pb-8 border-b border-border/50">
              <div>
                <p className="text-muted-foreground font-bold mb-1 text-sm">السعر الأصلي</p>
                <p className="text-3xl font-black text-muted-foreground line-through">{formatCurrency(offer.totalPrice)}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-bold mb-1 text-sm">السعر المعروض</p>
                <p className="text-5xl font-black text-accent">{formatCurrency(offer.finalPrice || offer.totalPrice)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Store className="w-5 h-5 text-accent" /> عناصر العرض
              </h3>
              {offer.items?.map(item => (
                <div key={item.id} className="flex justify-between items-center p-4 rounded-xl bg-muted/40 border border-border/30">
                  <div>
                    <p className="font-bold">{item.productName ?? "منتج"}</p>
                    <p className="text-sm text-muted-foreground">الكمية: {item.quantity}</p>
                  </div>
                  <p className="font-bold text-lg">{formatCurrency(item.unitPrice * item.quantity)}</p>
                </div>
              ))}
            </div>

            {offer.negotiations && offer.negotiations.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" /> سجل التفاوض
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {offer.negotiations.map(neg => (
                    <div
                      key={neg.id}
                      className={`p-4 rounded-2xl max-w-[78%] ${
                        neg.senderType === "USER"
                          ? "bg-primary text-primary-foreground mr-auto rounded-br-sm"
                          : "bg-muted ml-auto rounded-bl-sm"
                      }`}
                    >
                      <p className="text-xs opacity-70 mb-1 font-bold">
                        {neg.senderType === "USER" ? "أنت" : "التاجر"}
                      </p>
                      <p className="text-2xl font-black">{formatCurrency(neg.proposedPrice)}</p>
                      {neg.message && <p className="text-sm mt-1 opacity-80">{neg.message}</p>}
                      <p className="text-xs mt-2 opacity-60">{new Date(neg.createdAt!).toLocaleString("ar-SA")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {offer.status === "ACCEPTED" && (
              <div className="bg-success/10 border border-success/30 rounded-2xl p-6 text-center">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
                <h3 className="text-xl font-black text-success mb-1">تم قبول العرض!</h3>
                <p className="text-muted-foreground">توجه للتاجر وأبرز الباركود الخاص بك</p>
              </div>
            )}

            {isActive && (
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="lg" className="flex-1 h-14 text-lg gap-2" disabled={acceptOffer.isPending}>
                      <CheckCircle className="w-5 h-5" /> قبول العرض
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد قبول العرض</AlertDialogTitle>
                      <AlertDialogDescription>
                        ستقبل العرض بقيمة <strong>{formatCurrency(offer.finalPrice || offer.totalPrice)}</strong>.
                        سيتم إنشاء باركود للاستخدام عند التاجر. لا يمكن التراجع بعد القبول.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAccept}>نعم، أقبل العرض</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Dialog open={isCounterOpen} onOpenChange={setIsCounterOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="lg" className="flex-1 h-14 text-lg gap-2 border-accent text-accent hover:bg-accent hover:text-white">
                      <RefreshCw className="w-5 h-5" /> تفاوض
                    </Button>
                  </DialogTrigger>
                  <DialogContent dir="rtl">
                    <h2 className="text-2xl font-black mb-2">تقديم سعر بديل</h2>
                    <p className="text-muted-foreground mb-6">أدخل السعر الذي تقترحه، وسيتم إرساله للتاجر للنظر فيه.</p>
                    <form onSubmit={handleCounter} className="space-y-4">
                      <div className="space-y-2">
                        <Label>السعر المقترح (ر.س)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="1"
                          required
                          value={counterPrice}
                          onChange={e => setCounterPrice(e.target.value)}
                          className="text-2xl h-16 font-bold"
                          placeholder="0.00"
                        />
                      </div>
                      <Button type="submit" className="w-full h-14 text-lg" disabled={counterOffer.isPending}>
                        {counterOffer.isPending ? "جاري الإرسال..." : "إرسال السعر المقترح"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="lg" className="h-14 text-destructive hover:bg-destructive/10" disabled={rejectOffer.isPending}>
                      <XCircle className="w-5 h-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>رفض العرض</AlertDialogTitle>
                      <AlertDialogDescription>
                        هل أنت متأكد من رفض هذا العرض؟ لا يمكن التراجع عن هذا الإجراء.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReject} className="bg-destructive hover:bg-destructive/90">
                        نعم، أرفض العرض
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
