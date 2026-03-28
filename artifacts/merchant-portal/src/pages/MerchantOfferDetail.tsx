import React, { useState } from "react";
import { useParams } from "wouter";
import { useGetOffer, useAcceptCounter, useMerchantCounter } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Badge, Button, Input, Label } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

export function MerchantOfferDetail() {
  const { id } = useParams();
  const { data: offer, isLoading, refetch } = useGetOffer(id!);
  const acceptCounter = useAcceptCounter();
  const sendCounter = useMerchantCounter();

  const [proposedPrice, setProposedPrice] = useState("");

  if (isLoading) return <AppLayout><div className="animate-pulse h-64 bg-muted rounded-2xl" /></AppLayout>;
  if (!offer) return <AppLayout><div className="p-8 text-center font-bold">العرض غير موجود</div></AppLayout>;

  // Check if last negotiation is from user and needs response
  const lastNeg = offer.negotiations?.[offer.negotiations.length - 1];
  const isUserCounter = lastNeg?.senderType === "USER" && offer.status === "NEGOTIATING";

  const handleAcceptCounter = async () => {
    if(confirm("موافقة على السعر المقترح من العميل؟")) {
      await acceptCounter.mutateAsync({ id: id! });
      refetch();
    }
  };

  const handleSendCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCounter.mutateAsync({ id: id!, data: { proposedPrice: parseFloat(proposedPrice) } });
    setProposedPrice("");
    refetch();
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-primary">تفاصيل العرض (تاجر)</h1>
          <Badge className="text-lg px-4 py-1">{offer.status}</Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="border-0 shadow-xl bg-card">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold mb-6 border-b pb-4">بيانات العرض</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-muted-foreground font-bold">السعر الأساسي</p>
                  <p className="text-2xl font-black">{formatCurrency(offer.totalPrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-bold">السعر النهائي (بعد التفاوض)</p>
                  <p className="text-3xl font-black text-accent">{formatCurrency(offer.finalPrice || offer.totalPrice)}</p>
                </div>
                <div className="pt-4 mt-4 border-t">
                  <p className="font-bold mb-2">المنتجات المشمولة:</p>
                  {offer.items?.map(i => (
                    <div key={i.id} className="flex justify-between text-sm py-1">
                      <span>{i.productName} (x{i.quantity})</span>
                      <span className="font-bold">{formatCurrency(i.unitPrice * i.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-card">
            <CardContent className="p-8 flex flex-col h-full">
              <h3 className="text-xl font-bold mb-6 border-b pb-4">غرفة التفاوض</h3>
              
              <div className="flex-1 space-y-4 mb-6 overflow-y-auto max-h-[300px] pr-2">
                {offer.negotiations?.length === 0 && <p className="text-muted-foreground text-center my-8">لم يبدأ التفاوض بعد</p>}
                {offer.negotiations?.map(neg => (
                  <div key={neg.id} className={`p-4 rounded-xl ${neg.senderType === 'MERCHANT' || neg.senderType === 'SYSTEM' ? 'bg-primary text-primary-foreground ml-10 rounded-tr-sm' : 'bg-muted mr-10 rounded-tl-sm'}`}>
                    <p className="text-xs opacity-70 mb-1">{neg.senderType === 'USER' ? 'العميل' : 'أنت (التاجر)'}</p>
                    <p className="font-black text-xl">{formatCurrency(neg.proposedPrice)}</p>
                    {neg.message && <p className="text-sm mt-2">{neg.message}</p>}
                  </div>
                ))}
              </div>

              {isUserCounter && (
                <div className="pt-6 border-t mt-auto space-y-4">
                  <div className="bg-accent/10 p-4 rounded-xl mb-4">
                    <p className="font-bold text-accent mb-1">العميل يطلب سعر: {formatCurrency(lastNeg.proposedPrice)}</p>
                  </div>
                  <Button onClick={handleAcceptCounter} className="w-full h-12 text-lg bg-success hover:bg-success/90">قبول سعر العميل</Button>
                  
                  <form onSubmit={handleSendCounter} className="flex gap-2">
                    <Input 
                      type="number" step="0.01" required 
                      placeholder="أو قدم سعر جديد..." 
                      value={proposedPrice} onChange={e => setProposedPrice(e.target.value)}
                    />
                    <Button type="submit">إرسال</Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
