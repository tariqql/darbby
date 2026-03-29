import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetOffer, useAcceptOffer, useRejectOffer, useCounterOffer } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Badge, Button, Dialog, DialogContent, DialogTrigger, Input, Label } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { MessageCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useProtectedRoute } from "@/hooks/use-auth";

export function UserOfferDetail() {
  useProtectedRoute();
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { data: offer, isLoading, refetch } = useGetOffer(id!);
  const acceptOffer = useAcceptOffer();
  const rejectOffer = useRejectOffer();
  const counterOffer = useCounterOffer();
  
  const [counterPrice, setCounterPrice] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) return <AppLayout><div className="animate-pulse h-64 bg-muted rounded-2xl" /></AppLayout>;
  if (!offer) return <AppLayout><div className="p-8 text-center font-bold">العرض غير موجود</div></AppLayout>;

  const handleAccept = async () => {
    if(confirm("هل أنت متأكد من قبول هذا العرض؟")) {
      await acceptOffer.mutateAsync({ id: id! });
      refetch();
    }
  };

  const handleReject = async () => {
    if(confirm("هل تريد رفض هذا العرض؟")) {
      await rejectOffer.mutateAsync({ id: id! });
      refetch();
    }
  };

  const handleCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    await counterOffer.mutateAsync({ id: id!, data: { proposedPrice: parseFloat(counterPrice) } });
    setIsOpen(false);
    refetch();
  };

  const isActive = ["SENT", "VIEWED", "NEGOTIATING"].includes(offer.status);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-primary">تفاصيل العرض</h1>
          <Badge variant={offer.status === 'ACCEPTED' ? 'success' : 'default'} className="text-lg px-4 py-1 rounded-xl">
            {offer.status}
          </Badge>
        </div>

        <Card className="border-0 shadow-2xl bg-white/80 overflow-hidden relative">
          <div className="h-2 w-full bg-gradient-to-r from-accent to-primary" />
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-border/50">
              <div>
                <p className="text-muted-foreground font-bold mb-2">القيمة الإجمالية</p>
                <p className="text-4xl font-black text-primary line-through opacity-50">{formatCurrency(offer.totalPrice)}</p>
              </div>
              <div className="md:text-left">
                <p className="text-muted-foreground font-bold mb-2">السعر النهائي المعروض</p>
                <p className="text-5xl font-black text-accent">{formatCurrency(offer.finalPrice || offer.totalPrice)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold">عناصر العرض</h3>
              {offer.items?.map(item => (
                <div key={item.id} className="flex justify-between items-center p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div>
                    <p className="font-bold text-lg">{item.productName || "منتج"}</p>
                    <p className="text-sm text-muted-foreground">الكمية: {item.quantity}</p>
                  </div>
                  <p className="font-bold text-lg">{formatCurrency(item.unitPrice * item.quantity)}</p>
                </div>
              ))}
            </div>

            {offer.negotiations && offer.negotiations.length > 0 && (
              <div className="mt-8 pt-8 border-t border-border/50">
                <h3 className="text-xl font-bold mb-4">سجل التفاوض</h3>
                <div className="space-y-4">
                  {offer.negotiations.map(neg => (
                    <div key={neg.id} className={`p-4 rounded-xl max-w-[80%] ${neg.senderType === 'USER' ? 'bg-primary text-primary-foreground ml-auto rounded-br-sm' : 'bg-muted mr-auto rounded-bl-sm'}`}>
                      <p className="font-bold text-lg">{formatCurrency(neg.proposedPrice)}</p>
                      {neg.message && <p className="text-sm mt-1 opacity-90">{neg.message}</p>}
                      <p className="text-xs mt-2 opacity-70">{new Date(neg.createdAt!).toLocaleString('ar-SA')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isActive && (
              <div className="flex flex-col sm:flex-row gap-4 mt-10">
                <Button size="lg" className="flex-1 h-14 text-lg" onClick={handleAccept}>
                  <CheckCircle className="ml-2 w-6 h-6" /> قبول العرض
                </Button>
                
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="lg" className="flex-1 h-14 text-lg border-accent text-accent hover:bg-accent hover:text-white">
                      <RefreshCw className="ml-2 w-6 h-6" /> تفاوض بسعر آخر
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <h2 className="text-2xl font-black mb-4">تقديم سعر بديل</h2>
                    <form onSubmit={handleCounter} className="space-y-6">
                      <div className="space-y-2">
                        <Label>السعر المقترح (ر.س)</Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          required 
                          value={counterPrice} 
                          onChange={(e) => setCounterPrice(e.target.value)} 
                          className="text-2xl h-16 font-bold"
                        />
                      </div>
                      <Button type="submit" className="w-full h-14 text-lg" disabled={counterOffer.isPending}>إرسال العرض المضاد</Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button variant="ghost" size="lg" className="h-14 text-lg text-destructive hover:bg-destructive/10" onClick={handleReject}>
                  <XCircle className="ml-2 w-6 h-6" /> رفض
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
