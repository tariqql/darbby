import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useListProducts, useSendOffer } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Button, Input, Label } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

export function SendOffer() {
  const { id: tripId } = useParams();
  const branchId = new URLSearchParams(window.location.search).get("branchId");
  const [, setLocation] = useLocation();
  
  const { data: products } = useListProducts();
  const sendOffer = useSendOffer();

  const [selectedItems, setSelectedItems] = useState<Array<{productId: string, quantity: number, unitPrice: number}>>([]);
  const [message, setMessage] = useState("");

  const toggleProduct = (prod: any) => {
    const exists = selectedItems.find(i => i.productId === prod.id);
    if (exists) {
      setSelectedItems(selectedItems.filter(i => i.productId !== prod.id));
    } else {
      setSelectedItems([...selectedItems, { productId: prod.id, quantity: 1, unitPrice: prod.price }]);
    }
  };

  const updateQuantity = (pid: string, qty: number) => {
    setSelectedItems(selectedItems.map(i => i.productId === pid ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const total = selectedItems.reduce((acc, curr) => acc + (curr.unitPrice * curr.quantity), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) return alert("اختر منتجاً واحداً على الأقل");
    
    // Default expiration 2 hours from now
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    try {
      await sendOffer.mutateAsync({ 
        tripId: tripId!, 
        data: {
          branchId: branchId || undefined,
          message,
          expiresAt,
          items: selectedItems
        }
      });
      setLocation("/merchant/offers");
    } catch (err) {
      alert("فشل الإرسال");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black text-primary mb-8">إعداد وتجهيز العرض</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold text-xl mb-4">اختر المنتجات / الخدمات</h3>
            <div className="space-y-3">
              {products?.map(p => {
                const isSelected = !!selectedItems.find(i => i.productId === p.id);
                return (
                  <Card key={p.id} className={`cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'hover:border-primary/50'}`} onClick={() => toggleProduct(p)}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-bold">{p.name}</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(p.price)}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div>
            <Card className="sticky top-24 shadow-2xl border-0 bg-white/80 backdrop-blur-xl">
              <CardContent className="p-6">
                <h3 className="font-bold text-xl mb-6 border-b pb-4">ملخص العرض</h3>
                
                {selectedItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">لم يتم اختيار منتجات</p>
                ) : (
                  <div className="space-y-4 mb-6">
                    {selectedItems.map(item => {
                      const prod = products?.find(p => p.id === item.productId);
                      return (
                        <div key={item.productId} className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-bold">{prod?.name}</p>
                            <p className="text-sm text-muted-foreground">{formatCurrency(item.unitPrice)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="w-8 h-8 p-0 rounded-full" onClick={(e) => { e.stopPropagation(); updateQuantity(item.productId, item.quantity - 1); }}>-</Button>
                            <span className="w-6 text-center font-bold">{item.quantity}</span>
                            <Button size="sm" variant="outline" className="w-8 h-8 p-0 rounded-full" onClick={(e) => { e.stopPropagation(); updateQuantity(item.productId, item.quantity + 1); }}>+</Button>
                          </div>
                        </div>
                      );
                    })}
                    
                    <div className="pt-4 border-t mt-4 flex justify-between items-center">
                      <span className="font-bold text-lg">الإجمالي</span>
                      <span className="font-black text-2xl text-accent">{formatCurrency(total)}</span>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 mt-8">
                  <div className="space-y-2">
                    <Label>رسالة ترحيبية للعميل (اختياري)</Label>
                    <Input 
                      value={message} 
                      onChange={e => setMessage(e.target.value)} 
                      placeholder="نتشرف بزيارتكم لفرعنا..."
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full h-14 text-lg" disabled={sendOffer.isPending || selectedItems.length === 0}>
                    {sendOffer.isPending ? "جاري الإرسال..." : "إرسال العرض للمسافر"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
