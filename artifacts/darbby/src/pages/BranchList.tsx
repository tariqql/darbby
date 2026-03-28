import React, { useState } from "react";
import { Link } from "wouter";
import { useListBranches, useDeleteBranch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { MapPin, Plus, Trash2, Edit3, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function BranchList() {
  const { data: branches, isLoading } = useListBranches();
  const deleteBranch = useDeleteBranch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الفرع؟")) return;
    setDeleting(id);
    try {
      await deleteBranch.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["listBranches"] });
      toast({ title: "تم الحذف", description: "تم حذف الفرع بنجاح." });
    } catch {
      toast({ title: "خطأ", description: "تعذر حذف الفرع.", variant: "destructive" });
    }
    setDeleting(null);
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary">الفروع</h1>
          <p className="text-muted-foreground mt-1">أدر فروع منشأتك ومواقعها الجغرافية</p>
        </div>
        <Link href="/merchant/branches/new">
          <Button size="lg" className="rounded-2xl gap-2 w-full sm:w-auto">
            <Plus className="w-5 h-5" />
            إضافة فرع
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : !branches?.length ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-muted/30 border-dashed border-2">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <MapPin className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">لا توجد فروع بعد</h3>
          <p className="text-muted-foreground max-w-sm mb-8">أضف موقع فرعك لتظهر للمسافرين الذين يمرون بالقرب منك.</p>
          <Link href="/merchant/branches/new">
            <Button size="lg">أضف الفرع الأول</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {branches.map((branch: any) => (
            <Card key={branch.id} className="hover:shadow-xl transition-all border-border/70">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black">{branch.name}</h3>
                      {branch.address && <p className="text-sm text-muted-foreground">{branch.address}</p>}
                    </div>
                  </div>
                  <Badge className={branch.isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                    {branch.isActive ? <><CheckCircle2 className="w-3 h-3 ml-1" />نشط</> : <><XCircle className="w-3 h-3 ml-1" />معطّل</>}
                  </Badge>
                </div>

                <div className="bg-muted/50 rounded-xl p-3 mb-4 text-sm">
                  <p className="text-muted-foreground font-bold mb-1">الإحداثيات</p>
                  <p className="font-mono text-foreground">
                    {branch.latitude?.toFixed(4) || "—"}, {branch.longitude?.toFixed(4) || "—"}
                  </p>
                </div>

                {branch.radiusMeters && (
                  <div className="bg-primary/5 rounded-xl px-4 py-2 mb-4 text-sm font-medium text-primary">
                    نطاق الرصد: {branch.radiusMeters >= 1000 ? `${(branch.radiusMeters/1000).toFixed(0)} كم` : `${branch.radiusMeters} م`}
                  </div>
                )}

                <div className="flex gap-3">
                  <Link href={`/merchant/branches/${branch.id}/edit`} className="flex-1">
                    <Button variant="outline" className="w-full gap-2">
                      <Edit3 className="w-4 h-4" />
                      تعديل
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive hover:text-white px-4"
                    onClick={() => handleDelete(branch.id)}
                    disabled={deleting === branch.id}
                  >
                    <Trash2 className="w-4 h-4" />
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
