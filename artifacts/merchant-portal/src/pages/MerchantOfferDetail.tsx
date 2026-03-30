import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetOffer, useAcceptCounter, useMerchantCounter } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Badge, Button, Input } from "@/components/ui";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils";
import { offerStatusAr, offerStatusVariant } from "@/lib/status";
import { ChevronRight, CheckCircle, Send } from "lucide-react";

export function MerchantOfferDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { data: offer, isLoading, refetch } = useGetOffer(id!);
  const acceptCounter = useAcceptCounter();
  const sendCounter   = useMerchantCounter();

  const [proposedPrice, setProposedPrice] = useState("");

  if (isLoading) return <AppLayout><div className="animate-pulse h-64 bg-muted rounded-2xl" /></AppLayout>;
  if (!offer)   return <AppLayout><div className="p-8 text-center font-bold">العرض غير موجود</div></AppLayout>;

  const lastNeg = offer.negotiations?.[offer.negotiations.length - 1];
  const isUserCounter = lastNeg?.senderType === "USER" && offer.status === "NEGOTIATING";

  const handleAcceptCounter = async () => {
    await acceptCounter.mutateAsync({ id: id! });
    refetch();
  };

  const handleSendCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCounter.mutateAsync({ id: id!, data: { proposedPrice: parseFloat(proposedPrice) } });
    setProposedPrice("");
    refetch();
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => setLocation("/merchant/offers")}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary font-bold transition-colors"
        >
          <ChevronRight className="w-5 h-5" /> العودة للعروض
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-primary">تفاصيل العرض</h1>
          <Badge variant={offerStatusVariant(offer.status)} className="text-base px-4 py-1.5 rounded-xl">
            {offerStatusAr[offer.status] ?? offer.status}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8 space-y-6">
              <h3 className="text-xl font-bold border-b pb-4">بيانات العرض</h3>

              <div className="space-y-4">
                <div>
                  <p className="text-muted-foreground font-bold text-sm">السعر الأصلي</p>
                  <p className="text-2xl font-black text-muted-foreground line-through">{formatCurrency(offer.totalPrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-bold text-sm">السعر النهائي</p>
                  <p className="text-3xl font-black text-accent">{formatCurrency(offer.finalPrice || offer.totalPrice)}</p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <p className="font-bold text-sm mb-3">المنتجات المشمولة</p>
                {offer.items?.map(i => (
                  <div key={i.id} className="flex justify-between items-center p-3 bg-muted/40 rounded-xl text-sm">
                    <span className="font-bold">{i.productName} <span className="text-muted-foreground font-normal">×{i.quantity}</span></span>
                    <span className="font-bold">{formatCurrency(i.unitPrice * i.quantity)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl">
            <CardContent className="p-8 flex flex-col h-full">
              <h3 className="text-xl font-bold border-b pb-4 mb-4">غرفة التفاوض</h3>

              <div className="flex-1 space-y-3 overflow-y-auto max-h-72 mb-4">
                {!offer.negotiations?.length && (
                  <p className="text-muted-foreground text-center py-8 font-bold">لم يبدأ التفاوض بعد</p>
                )}
                {offer.negotiations?.map(neg => (
                  <div
                    key={neg.id}
                    className={`p-4 rounded-2xl ${
                      neg.senderType === "MERCHANT" || neg.senderType === "SYSTEM"
                        ? "bg-primary text-primary-foreground mr-10 rounded-tr-none"
                        : "bg-muted ml-10 rounded-tl-none"
                    }`}
                  >
                    <p className="text-xs opacity-70 mb-1 font-bold">
                      {neg.senderType === "USER" ? "العميل" : neg.senderType === "SYSTEM" ? "🤖 DINA" : "أنت"}
                    </p>
                    <p className="font-black text-xl">{formatCurrency(neg.proposedPrice)}</p>
                    {neg.message && <p className="text-sm mt-1 opacity-80">{neg.message}</p>}
                  </div>
                ))}
              </div>

              {isUserCounter && (
                <div className="pt-4 border-t space-y-3">
                  <div className="bg-accent/10 border border-accent/20 p-4 rounded-xl">
                    <p className="font-bold text-accent text-sm mb-1">العميل يقترح:</p>
                    <p className="text-2xl font-black">{formatCurrency(lastNeg.proposedPrice)}</p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full h-12 bg-success hover:bg-success/90 gap-2" disabled={acceptCounter.isPending}>
                        <CheckCircle className="w-5 h-5" /> قبول سعر العميل
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>قبول سعر العميل</AlertDialogTitle>
                        <AlertDialogDescription>
                          ستوافق على السعر المقترح من العميل وهو <strong>{formatCurrency(lastNeg.proposedPrice)}</strong>.
                          سيتم إنشاء باركود للعميل فور الموافقة.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleAcceptCounter}>نعم، أقبل</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <form onSubmit={handleSendCounter} className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="سعر مضاد..."
                      value={proposedPrice}
                      onChange={e => setProposedPrice(e.target.value)}
                      className="font-bold text-lg h-12"
                    />
                    <Button type="submit" className="h-12 gap-2" disabled={sendCounter.isPending}>
                      <Send className="w-4 h-4" /> إرسال
                    </Button>
                  </form>
                </div>
              )}

              {offer.status === "ACCEPTED" && (
                <div className="bg-success/10 border border-success/30 rounded-xl p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                  <p className="font-black text-success">العرض مقبول — بانتظار مسح الباركود</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
