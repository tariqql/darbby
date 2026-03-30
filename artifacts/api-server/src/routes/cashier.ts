import { Router } from "express";
import { sharedDb, sharedPool, merchantsPool, customersPool } from "@workspace/db";
import { orders, receipts } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, JwtPayload } from "../lib/auth.js";
import { dispatchWebhook } from "../lib/webhook.js";

const router = Router();

function auth(req: any): JwtPayload { return req.auth; }

// GET /api/cashier/scan/:barcode
// الكاشير يمسح الباركود ويرى تفاصيل الطلب
router.get("/scan/:barcode", authenticate, async (req, res) => {
  const { actor, id: merchantId } = auth(req);
  if (actor !== "MERCHANT") {
    res.status(403).json({ error: "FORBIDDEN", message: "Cashier access requires merchant token" });
    return;
  }

  const { barcode } = req.params;

  const [order] = await sharedDb.select().from(orders).where(eq(orders.barcode, barcode)).limit(1);

  if (!order) {
    res.status(404).json({ error: "BARCODE_NOT_FOUND", message: "الباركود غير مسجل في النظام" });
    return;
  }

  if (order.status !== "OPEN") {
    res.status(409).json({ error: "ORDER_NOT_OPEN", message: "الطلب مغلق أو ملغي", status: order.status });
    return;
  }

  if (order.merchantId !== merchantId) {
    res.status(403).json({ error: "BRANCH_MISMATCH", message: "الطلب ليس لهذا التاجر" });
    return;
  }

  if (new Date() > order.expiresAt) {
    await sharedDb.update(orders).set({ status: "EXPIRED", updatedAt: new Date() }).where(eq(orders.id, order.id));
    res.status(410).json({ error: "ORDER_EXPIRED", message: "انتهت صلاحية هذا الطلب" });
    return;
  }

  // Commission details
  const commissionRate = 0.05;
  const finalPrice = parseFloat(order.finalPrice.toString());
  const commissionAmount = parseFloat((finalPrice * commissionRate).toFixed(2));
  const vatAmount = parseFloat((finalPrice * 0.15).toFixed(2));
  const total = parseFloat((finalPrice + vatAmount).toFixed(2));

  // Get customer info
  let customerName = "عميل درباي";
  try {
    const custRes = await customersPool.query(
      `SELECT full_name FROM users WHERE id = $1::uuid LIMIT 1`,
      [order.userId]
    );
    if (custRes.rows[0]) customerName = custRes.rows[0].full_name;
  } catch { }

  // Get offer + product info
  let productName = "خدمة درباي";
  let originalPrice = finalPrice;
  try {
    const offerRes = await sharedPool.query(
      `SELECT o.total_price, oi.product_id
       FROM offers o
       LEFT JOIN offer_items oi ON oi.offer_id = o.id
       WHERE o.id = $1::uuid LIMIT 1`,
      [order.offerId]
    );
    if (offerRes.rows[0]) {
      originalPrice = parseFloat(offerRes.rows[0].total_price);
      if (offerRes.rows[0].product_id) {
        const prodRes = await merchantsPool.query(
          `SELECT name FROM products WHERE id = $1::uuid LIMIT 1`,
          [offerRes.rows[0].product_id]
        );
        if (prodRes.rows[0]) productName = prodRes.rows[0].name;
      }
    }
  } catch { }

  res.json({
    success: true,
    order: {
      order_id: order.id,
      barcode: order.barcode,
      status: order.status,
      expires_at: order.expiresAt,
    },
    customer: {
      name: customerName,
      user_id: order.userId,
    },
    offer: {
      offer_id: order.offerId,
      product_name: productName,
      agreed_price: finalPrice,
      original_price: originalPrice,
    },
    commission: {
      rate: commissionRate,
      amount: commissionAmount,
      display_text: `عمولة درباي: ${commissionAmount} ر.س (${(commissionRate * 100).toFixed(0)}%)`,
    },
    invoice_preview: {
      subtotal: finalPrice,
      darby_fee: commissionAmount,
      vat: vatAmount,
      total,
    },
  });
});

// POST /api/cashier/confirm
// تأكيد الشراء وإصدار الفاتورة
router.post("/confirm", authenticate, async (req, res) => {
  const { actor, id: merchantId } = auth(req);
  if (actor !== "MERCHANT") {
    res.status(403).json({ error: "FORBIDDEN", message: "Cashier access requires merchant token" });
    return;
  }

  const { order_id, final_amount, cashier_id, payment_method, pos_receipt_number } = req.body;
  if (!order_id || !final_amount) {
    res.status(400).json({ error: "MISSING_FIELDS", message: "order_id و final_amount مطلوبان" });
    return;
  }

  const [order] = await sharedDb.select().from(orders).where(eq(orders.id, order_id)).limit(1);

  if (!order) {
    res.status(404).json({ error: "ORDER_NOT_FOUND" });
    return;
  }
  if (order.status !== "OPEN") {
    res.status(409).json({ error: "ORDER_NOT_OPEN", status: order.status });
    return;
  }
  if (order.merchantId !== merchantId) {
    res.status(403).json({ error: "BRANCH_MISMATCH" });
    return;
  }
  if (new Date() > order.expiresAt) {
    await sharedDb.update(orders).set({ status: "EXPIRED", updatedAt: new Date() }).where(eq(orders.id, order.id));
    res.status(410).json({ error: "ORDER_EXPIRED" });
    return;
  }

  const commissionRate = 0.05;
  const finalAmt = parseFloat(final_amount.toString());
  const commissionAmount = parseFloat((finalAmt * commissionRate).toFixed(2));
  const vatAmount = parseFloat((finalAmt * 0.15).toFixed(2));
  const totalWithVat = parseFloat((finalAmt + vatAmount).toFixed(2));

  // Generate invoice number
  const invoiceNumber = `DRB-INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

  const validPaymentMethod = ["CASH", "CARD", "WALLET"].includes((payment_method || "CASH").toUpperCase())
    ? (payment_method || "CASH").toUpperCase() as "CASH" | "CARD" | "WALLET"
    : "CASH";

  // Create receipt
  const [receipt] = await sharedDb.insert(receipts).values({
    orderId: order.id,
    finalAmount: finalAmt.toString(),
    commissionAmount: commissionAmount.toString(),
    commissionRate: (commissionRate * 100).toString(),
    vatAmount: vatAmount.toString(),
    totalWithVat: totalWithVat.toString(),
    cashierId: cashier_id || null,
    paymentMethod: validPaymentMethod,
    posReceiptNumber: pos_receipt_number || null,
    invoiceNumber,
    status: "ACTIVE",
    closeTime: new Date(),
  }).returning();

  // Close the order
  await sharedDb.update(orders).set({
    status: "CLOSED",
    closedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(orders.id, order.id));

  // Update commission_ledger to INVOICED
  await sharedPool.query(
    `UPDATE commission_ledger
     SET ledger_status = 'INVOICED', invoice_no = $1, invoiced_at = NOW(), updated_at = NOW()
     WHERE offer_id = $2::uuid`,
    [invoiceNumber, order.offerId]
  );

  // Get merchant info for invoice
  let merchantName = "التاجر";
  let branchName = "";
  try {
    const mRes = await merchantsPool.query(
      `SELECT business_name FROM merchants WHERE id = $1::uuid LIMIT 1`,
      [order.merchantId]
    );
    if (mRes.rows[0]) merchantName = mRes.rows[0].business_name;
    if (order.branchId) {
      const bRes = await merchantsPool.query(
        `SELECT name FROM merchant_branches WHERE id = $1::uuid LIMIT 1`,
        [order.branchId]
      );
      if (bRes.rows[0]) branchName = bRes.rows[0].name;
    }
  } catch { }

  // Get product info for invoice
  let productName = "خدمة درباي";
  let originalPrice = finalAmt;
  try {
    const offerRes = await sharedPool.query(
      `SELECT o.total_price, oi.product_id FROM offers o
       LEFT JOIN offer_items oi ON oi.offer_id = o.id
       WHERE o.id = $1::uuid LIMIT 1`,
      [order.offerId]
    );
    if (offerRes.rows[0]) {
      originalPrice = parseFloat(offerRes.rows[0].total_price);
      if (offerRes.rows[0].product_id) {
        const prodRes = await merchantsPool.query(
          `SELECT name FROM products WHERE id = $1::uuid LIMIT 1`,
          [offerRes.rows[0].product_id]
        );
        if (prodRes.rows[0]) productName = prodRes.rows[0].name;
      }
    }
  } catch { }

  // Fire webhook
  dispatchWebhook(order.merchantId, "order.confirmed", {
    order_id: order.id,
    barcode: order.barcode,
    receipt_id: receipt.id,
    final_amount: finalAmt,
    commission_amount: commissionAmount,
  }).catch(() => {});

  res.status(201).json({
    success: true,
    receipt: {
      receipt_id: receipt.id,
      invoice_number: invoiceNumber,
      final_amount: finalAmt,
      commission_amount: commissionAmount,
      vat_amount: vatAmount,
      total_with_vat: totalWithVat,
      close_time: receipt.closeTime,
    },
    invoice: {
      invoice_number: invoiceNumber,
      merchant_name: merchantName,
      branch_name: branchName,
      line_items: [{
        description: `${productName} (عرض درباي)`,
        original_price: originalPrice,
        discount: parseFloat((originalPrice - finalAmt).toFixed(2)),
        price: finalAmt,
      }],
      subtotal: finalAmt,
      darby_commission: { rate: `${(commissionRate * 100).toFixed(0)}%`, amount: commissionAmount },
      vat: { rate: "15%", amount: vatAmount },
      total: totalWithVat,
      footer_text: "تم عبر منصة درباي | darbby.sa",
    },
  });
});

// GET /api/cashier/order/:order_id/receipt — جلب الإيصال بعد إغلاق الأوردر
router.get("/order/:order_id/receipt", authenticate, async (req, res) => {
  const { id: merchantId } = auth(req);
  const result = await sharedPool.query(
    `SELECT r.*, o.barcode, o.merchant_id
     FROM receipts r
     JOIN orders o ON o.id = r.order_id
     WHERE r.order_id = $1::uuid AND o.merchant_id = $2::uuid
     LIMIT 1`,
    [req.params.order_id, merchantId]
  );
  const receipt = result.rows[0];
  if (!receipt) { res.status(404).json({ error: "RECEIPT_NOT_FOUND" }); return; }

  const vat = parseFloat(receipt.final_amount) * 0.15;
  const commission = parseFloat(receipt.commission_amount);
  res.json({
    receipt_id: receipt.id,
    invoice_number: receipt.invoice_number,
    barcode: receipt.barcode,
    status: receipt.status,
    payment_method: receipt.payment_method,
    pos_receipt_number: receipt.pos_receipt_number,
    cashier_id: receipt.cashier_id,
    amounts: {
      subtotal: parseFloat(receipt.final_amount),
      commission: commission,
      vat: parseFloat(receipt.vat_amount || vat.toFixed(2)),
      total_with_vat: parseFloat(receipt.total_with_vat || (parseFloat(receipt.final_amount) + vat).toFixed(2)),
    },
    times: {
      issued_at: receipt.issued_at,
      voided_at: receipt.voided_at || null,
    },
  });
});

// GET /api/cashier/order/:order_id/status
router.get("/order/:order_id/status", authenticate, async (req, res) => {
  const { actor } = auth(req);
  if (actor !== "MERCHANT") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  const [order] = await sharedDb.select().from(orders).where(eq(orders.id, req.params.order_id)).limit(1);

  if (!order) {
    res.status(404).json({ error: "ORDER_NOT_FOUND" });
    return;
  }

  const now = new Date();
  const isExpired = order.status === "OPEN" && now > order.expiresAt;
  const isScannable = order.status === "OPEN" && !isExpired;

  res.json({
    order_id: order.id,
    barcode: order.barcode,
    status: isExpired ? "EXPIRED" : order.status,
    created_at: order.createdAt,
    expires_at: order.expiresAt,
    closed_at: order.closedAt,
    is_scannable: isScannable,
  });
});

// PUT /api/cashier/receipt/:receipt_id/void
// إلغاء الإيصال (خلال 15 دقيقة)
router.put("/receipt/:receipt_id/void", authenticate, async (req, res) => {
  const { actor, id: merchantId } = auth(req);
  if (actor !== "MERCHANT") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  const { reason, cashier_id } = req.body;
  if (!reason) {
    res.status(400).json({ error: "MISSING_FIELDS", message: "reason مطلوب" });
    return;
  }

  const [receipt] = await sharedDb.select().from(receipts).where(eq(receipts.id, req.params.receipt_id)).limit(1);

  if (!receipt) {
    res.status(404).json({ error: "RECEIPT_NOT_FOUND" });
    return;
  }
  if (receipt.status === "VOIDED") {
    res.status(409).json({ error: "ALREADY_VOIDED" });
    return;
  }

  // Check 15-minute window
  const minutesSinceClose = (Date.now() - new Date(receipt.closeTime!).getTime()) / 60000;
  if (minutesSinceClose > 15) {
    res.status(409).json({
      error: "VOID_WINDOW_EXPIRED",
      message: "انتهت فترة الإلغاء (15 دقيقة)",
      minutes_elapsed: Math.round(minutesSinceClose),
    });
    return;
  }

  // Void the receipt
  await sharedDb.update(receipts).set({
    status: "VOIDED",
    voidedAt: new Date(),
    voidReason: reason,
    voidedByCashierId: cashier_id || null,
  }).where(eq(receipts.id, receipt.id));

  // Reopen the order
  await sharedDb.update(orders).set({
    status: "OPEN",
    closedAt: null,
    updatedAt: new Date(),
  }).where(eq(orders.id, receipt.orderId));

  // Revert commission_ledger to PENDING
  await sharedPool.query(
    `UPDATE commission_ledger cl
     SET ledger_status = 'PENDING', invoice_no = NULL, invoiced_at = NULL, updated_at = NOW()
     FROM orders o
     WHERE o.id = cl.offer_id AND o.id = $1`,
    [receipt.orderId]
  );

  const commissionAmt = parseFloat(receipt.commissionAmount.toString());

  res.json({
    success: true,
    voided_receipt_id: receipt.id,
    refund_transaction: {
      type: "commission_refund",
      amount: -commissionAmt,
    },
    order_status: "OPEN",
    message: "تم إلغاء الإيصال وإعادة فتح الطلب",
  });
});

export default router;
