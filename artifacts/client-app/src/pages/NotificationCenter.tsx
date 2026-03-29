import React from "react";
import { useListNotifications, useMarkNotificationRead } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, Button } from "@/components/ui";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { arSA } from "date-fns/locale";
import { useProtectedRoute } from "@/hooks/use-auth";

export function NotificationCenter() {
  useProtectedRoute();
  const { data: notifications, isLoading } = useListNotifications();
  const markRead = useMarkNotificationRead();
  const queryClient = useQueryClient();

  const handleMarkRead = async (id: string) => {
    await markRead.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: ["listNotifications"] });
  };

  const unreadCount = notifications?.filter((n: any) => !n.isRead).length || 0;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-primary">الإشعارات</h1>
            {unreadCount > 0 && (
              <p className="text-muted-foreground mt-1">{unreadCount} إشعار غير مقروء</p>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        ) : !notifications?.length ? (
          <Card className="flex flex-col items-center justify-center py-20 text-center bg-muted/30 border-dashed">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Bell className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">لا توجد إشعارات</h3>
            <p className="text-muted-foreground max-w-sm">ستظهر هنا الإشعارات المتعلقة بعروضك ورحلاتك.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif: any) => (
              <Card
                key={notif.id}
                className={`transition-all duration-200 ${!notif.isRead ? "border-primary/30 bg-primary/5 shadow-sm" : "border-border/50"}`}
              >
                <CardContent className="p-5 flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${!notif.isRead ? "bg-primary text-white" : "bg-muted"}`}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold mb-1 ${!notif.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                      {notif.title || notif.message || "إشعار جديد"}
                    </p>
                    {notif.body && <p className="text-sm text-muted-foreground">{notif.body}</p>}
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: arSA })}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-primary hover:bg-primary/10 gap-1"
                      onClick={() => handleMarkRead(notif.id)}
                    >
                      <CheckCheck className="w-4 h-4" />
                      قراءة
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
