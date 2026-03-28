import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground text-center px-4" dir="rtl">
      <h1 className="text-8xl font-black text-primary mb-4">404</h1>
      <p className="text-2xl font-bold text-muted-foreground mb-8">عذراً، الصفحة غير موجودة</p>
      <Link href="/">
        <Button size="lg" className="rounded-xl h-14 px-8 text-lg">العودة للرئيسية</Button>
      </Link>
    </div>
  );
}
