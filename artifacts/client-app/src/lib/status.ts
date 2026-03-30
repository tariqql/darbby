export const offerStatusAr: Record<string, string> = {
  SENT: "مُرسَل",
  VIEWED: "تم الاطلاع",
  NEGOTIATING: "جاري التفاوض",
  ACCEPTED: "مقبول ✓",
  REJECTED: "مرفوض",
  EXPIRED: "منتهي الصلاحية",
  CANCELLED: "ملغي",
};

export const tripStatusAr: Record<string, string> = {
  ACTIVE: "نشطة",
  COMPLETED: "مكتملة",
  CANCELLED: "ملغاة",
};

export const tripPurposeAr: Record<string, string> = {
  TOURISM: "سياحة",
  WORK: "عمل",
  UMRAH: "عمرة",
  FAMILY_VISIT: "زيارة عائلية",
  OTHER: "أخرى",
};

export function offerStatusVariant(status: string): "success" | "destructive" | "secondary" | "default" {
  if (status === "ACCEPTED") return "success";
  if (status === "REJECTED" || status === "EXPIRED") return "destructive";
  if (status === "NEGOTIATING") return "default";
  return "secondary";
}

export function tripStatusVariant(status: string): "success" | "destructive" | "secondary" {
  if (status === "ACTIVE") return "success";
  if (status === "CANCELLED") return "destructive";
  return "secondary";
}
