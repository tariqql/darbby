import React, { useState } from "react";
import { Link } from "wouter";
import { useListProducts, useDeleteProduct } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { Package, Plus, Trash2, Edit3, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  FUEL: "وقود", FOOD: "طعام", LODGING: "إقامة",
  SERVICE: "خدمة", RETAIL: "بيع تجزئة", OTHER: "أخرى",
};
const FUEL_LABELS: Record<string, string> = {
  PETROL_91: "91", PETROL_95: "95", DIESEL: "ديزل",
  ELECTRIC: "كهرباء", HYBRID: "هجين",
};

export function ProductList() {
  const { data: products, isLoading } = useListProducts();
  const deleteProduct = useDeleteProduct();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    setDeleting(id);
    try {
      await deleteProduct.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["listProducts"] });
      toast({ title: "تم الحذف", description: "تم حذف المنتج بنجاح." });
    } catch {
      toast({ title: "خطأ", description: "تعذر حذف المنتج.", variant: "destructive" });
    }
    setDeleting(null);
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary">المنتجات والخدمات</h1>
          <p className="text-muted-foreground mt-1">أدر كتالوج منتجاتك وخدماتك المقدمة للمسافرين</p>
        </div>
        <Link href="/merchant/products/new">
          <Button size="lg" className="rounded-2xl gap-2 w-full sm:w-auto">
            <Plus className="w-5 h-5" />
            إضافة منتج
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : !products?.length ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-muted/30 border-dashed border-2">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Package className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">لا توجد منتجات بعد</h3>
          <p className="text-muted-foreground max-w-sm mb-8">أضف منتجاتك وخدماتك لتكون متاحة عند إرسال العروض للمسافرين.</p>
          <Link href="/merchant/products/new">
            <Button size="lg">أضف أول منتج</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product: any) => (
            <Card key={product.id} className="hover:shadow-lg transition-all border-border/70 group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                        {CATEGORY_LABELS[product.category] || product.category}
                      </Badge>
                      {product.targetFuelType && (
                        <Badge variant="outline" className="text-xs">
                          {FUEL_LABELS[product.targetFuelType] || product.targetFuelType}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-black text-lg leading-tight">{product.name}</h3>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                    )}
                  </div>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mr-2 ${product.isAvailable ? "bg-green-100" : "bg-gray-100"}`}>
                    {product.isAvailable
                      ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                      : <XCircle className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-2xl font-black text-primary">{formatCurrency(product.price)}</p>
                    {product.stockQty != null && (
                      <p className="text-xs text-muted-foreground">مخزون: {product.stockQty}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href={`/merchant/products/${product.id}/edit`} className="flex-1">
                    <Button variant="outline" className="w-full gap-1.5 text-sm h-9">
                      <Edit3 className="w-3.5 h-3.5" />
                      تعديل
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive hover:text-white px-3 h-9"
                    onClick={() => handleDelete(product.id)}
                    disabled={deleting === product.id}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
