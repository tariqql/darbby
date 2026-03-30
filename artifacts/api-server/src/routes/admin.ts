import { Router } from "express";
import { staffPool, sharedPool, merchantsPool } from "@workspace/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const router = Router();

const JWT_SECRET = process.env.SESSION_SECRET || "darbby-admin-secret";
const JWT_EXPIRES = "8h";

// Permissions matrix per role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    "users.view", "users.suspend", "users.ban",
    "merchants.view", "merchants.approve", "merchants.suspend", "merchants.update_commission",
    "orders.view", "orders.override",
    "staff.create", "staff.manage",
    "finance.reports",
    "audit.view",
    "roles.manage",
  ],
  ops_manager: [
    "users.view", "users.suspend",
    "merchants.view", "merchants.approve", "merchants.suspend",
    "orders.view", "orders.override",
    "finance.reports",
  ],
  finance_staff: [
    "merchants.view", "merchants.update_commission",
    "orders.view",
    "finance.reports",
  ],
  support_agent: [
    "users.view", "users.suspend",
    "merchants.view",
    "orders.view",
  ],
  marketing_mgr: [
    "users.view",
    "merchants.view",
  ],
};

// Middleware: verify staff JWT
function requireAdmin(permissions: string[] = []) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "يلزم تسجيل الدخول كموظف" });
      return;
    }

    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.staff = decoded;

      if (permissions.length > 0) {
        const staffPerms: string[] = decoded.permissions || [];
        const hasAll = permissions.every(p => staffPerms.includes(p));
        if (!hasAll) {
          res.status(403).json({
            error: "INSUFFICIENT_PERMISSIONS",
            required: permissions,
            message: "ليس لديك صلاحية لهذا الإجراء",
          });
          return;
        }
      }

      next();
    } catch {
      res.status(401).json({ error: "INVALID_TOKEN" });
    }
  };
}

async function writeAdminAuditLog(staffId: string, action: string, targetType: string, targetId: string, details: any, ip: string) {
  try {
    await staffPool.query(
      `INSERT INTO audit_log
       (staff_id, action, entity_type, entity_id, new_values, ip_address)
       VALUES ($1::uuid, $2, $3, $4::uuid, $5::jsonb, $6)`,
      [staffId, action, targetType, targetId, JSON.stringify(details), ip]
    );
  } catch (e: any) {
    console.error("[admin] audit log error:", e.message);
  }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

// POST /api/admin/auth/login
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "MISSING_FIELDS" });
    return;
  }

  const result = await staffPool.query(
    `SELECT id, full_name, email, password_hash, role, status, permissions
     FROM staff_users WHERE email = $1 LIMIT 1`,
    [email]
  );

  const staff = result.rows[0];
  if (!staff) {
    res.status(401).json({ error: "INVALID_CREDENTIALS", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    return;
  }

  if (staff.status !== "ACTIVE") {
    res.status(403).json({ error: "ACCOUNT_SUSPENDED", message: "الحساب موقوف أو غير نشط" });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, staff.password_hash);
  if (!passwordMatch) {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
    return;
  }

  const role = staff.role?.toLowerCase() || "support_agent";
  const permissions = ROLE_PERMISSIONS[role] || [];

  const token = jwt.sign(
    {
      staff_id: staff.id,
      full_name: staff.full_name,
      email: staff.email,
      role,
      permissions,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  // Update last login
  await staffPool.query(
    `UPDATE staff_users SET last_login_at = NOW() WHERE id = $1::uuid`,
    [staff.id]
  );

  res.json({
    success: true,
    token,
    staff: {
      staff_id: staff.id,
      full_name: staff.full_name,
      role,
      permissions,
    },
    expires_in: 28800,
  });
});

// ─── STAFF MANAGEMENT ─────────────────────────────────────────────────────────

// POST /api/admin/staff
router.post("/staff", requireAdmin(["staff.create"]), async (req, res) => {
  const { full_name, email, phone, role, department, temporary_password } = req.body;
  if (!full_name || !email || !temporary_password || !role) {
    res.status(400).json({ error: "MISSING_FIELDS" });
    return;
  }

  const normalizedRole = role.toUpperCase();
  const validRoles = ["SUPER_ADMIN", "ADMIN", "SUPPORT", "FINANCE", "MODERATOR"];
  if (!validRoles.includes(normalizedRole)) {
    res.status(400).json({ error: "INVALID_ROLE", valid_roles: validRoles });
    return;
  }

  const existing = await staffPool.query(
    `SELECT id FROM staff_users WHERE email = $1 LIMIT 1`,
    [email]
  );
  if (existing.rows[0]) {
    res.status(409).json({ error: "EMAIL_TAKEN", message: "البريد الإلكتروني مستخدم بالفعل" });
    return;
  }

  const passwordHash = await bcrypt.hash(temporary_password, 12);

  const result = await staffPool.query(
    `INSERT INTO staff_users (full_name, email, password_hash, role, status, created_by)
     VALUES ($1, $2, $3, $4, 'ACTIVE', $5::uuid)
     RETURNING id, full_name, email, role, status, created_at`,
    [full_name, email, passwordHash, normalizedRole, req.staff.staff_id]
  );

  const newStaff = result.rows[0];

  await writeAdminAuditLog(
    req.staff.staff_id, "created_staff", "Staff", newStaff.id,
    { full_name, email, role: normalizedRole },
    req.ip || ""
  );

  res.status(201).json({
    success: true,
    staff: { ...newStaff, department },
  });
});

// PUT /api/admin/staff/:staff_id/status
router.put("/staff/:staff_id/status", requireAdmin(["staff.manage"]), async (req, res) => {
  const { status, reason } = req.body;
  const validStatuses = ["ACTIVE", "SUSPENDED", "INACTIVE"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "INVALID_STATUS", valid: validStatuses });
    return;
  }

  const result = await staffPool.query(
    `UPDATE staff_users SET status = $1, updated_at = NOW()
     WHERE id = $2::uuid RETURNING id, full_name, status`,
    [status, req.params.staff_id]
  );

  if (!result.rows[0]) {
    res.status(404).json({ error: "STAFF_NOT_FOUND" });
    return;
  }

  await writeAdminAuditLog(
    req.staff.staff_id, `changed_staff_status_to_${status.toLowerCase()}`,
    "Staff", req.params.staff_id, { status, reason },
    req.ip || ""
  );

  res.json({
    success: true,
    staff_id: req.params.staff_id,
    new_status: status,
  });
});

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

// GET /api/admin/users
router.get("/users", requireAdmin(["users.view"]), async (req, res) => {
  const { search, status, page = "1", per_page = "20" } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(per_page as string);

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (search) {
    params.push(`%${search}%`);
    where += ` AND (full_name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
  }
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }

  params.push(parseInt(per_page as string));
  params.push(offset);

  const { customersPool } = await import("@workspace/db");
  const result = await customersPool.query(
    `SELECT id, full_name, email, phone, status, created_at
     FROM users
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    data: result.rows,
    pagination: {
      page: parseInt(page as string),
      per_page: parseInt(per_page as string),
      total: result.rows.length,
    },
  });
});

// PUT /api/admin/users/:user_id/suspend
router.put("/users/:user_id/suspend", requireAdmin(["users.suspend"]), async (req, res) => {
  const { action, reason, duration_days } = req.body;
  const validActions = ["suspend", "ban", "activate"];
  if (!validActions.includes(action)) {
    res.status(400).json({ error: "INVALID_ACTION", valid: validActions });
    return;
  }

  const newStatus = action === "suspend" ? "SUSPENDED" : action === "ban" ? "BANNED" : "ACTIVE";
  const suspendedUntil = action === "suspend" && duration_days
    ? new Date(Date.now() + duration_days * 86400000)
    : null;

  const { customersPool } = await import("@workspace/db");
  const result = await customersPool.query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING id, full_name, status`,
    [newStatus, req.params.user_id]
  );

  if (!result.rows[0]) {
    res.status(404).json({ error: "USER_NOT_FOUND" });
    return;
  }

  await writeAdminAuditLog(
    req.staff.staff_id, `${action}_user`, "User", req.params.user_id,
    { action, reason, new_status: newStatus, suspended_until: suspendedUntil },
    req.ip || ""
  );

  res.json({
    success: true,
    user_id: req.params.user_id,
    new_status: newStatus,
    suspended_until: suspendedUntil,
  });
});

// ─── MERCHANT MANAGEMENT ──────────────────────────────────────────────────────

// GET /api/admin/merchants
router.get("/merchants", requireAdmin(["merchants.view"]), async (req, res) => {
  const { status, search, page = "1", per_page = "20" } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(per_page as string);

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (business_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
  }

  params.push(parseInt(per_page as string));
  params.push(offset);

  const result = await merchantsPool.query(
    `SELECT id, business_name, owner_name, email, phone, status,
            commercial_reg_no, subscription_plan, is_active, created_at
     FROM merchants
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    data: result.rows,
    pagination: {
      page: parseInt(page as string),
      per_page: parseInt(per_page as string),
      total: result.rows.length,
    },
  });
});

// PUT /api/admin/merchants/:merchant_id/approve
router.put("/merchants/:merchant_id/approve", requireAdmin(["merchants.approve"]), async (req, res) => {
  const { decision, commission_rate = 0.05, notes } = req.body;
  if (!["approved", "rejected"].includes(decision)) {
    res.status(400).json({ error: "INVALID_DECISION", valid: ["approved", "rejected"] });
    return;
  }

  const newStatus = decision === "approved" ? "APPROVED" : "REJECTED";

  const result = await merchantsPool.query(
    `UPDATE merchants SET
       status = $1,
       reviewed_by_admin_id = $2::uuid,
       reviewed_at = NOW(),
       rejection_reason = $3,
       updated_at = NOW()
     WHERE id = $4::uuid
     RETURNING id, business_name, status, email`,
    [newStatus, req.staff.staff_id, decision === "rejected" ? notes : null, req.params.merchant_id]
  );

  if (!result.rows[0]) {
    res.status(404).json({ error: "MERCHANT_NOT_FOUND" });
    return;
  }

  const merchant = result.rows[0];

  // Generate API key if approved
  let apiKey = null;
  if (decision === "approved") {
    const { merchantApiKeys } = await import("@workspace/db");
    const { sharedDb } = await import("@workspace/db");
    const rawKey = `drb_live_${crypto.randomBytes(20).toString("hex")}`;
    apiKey = rawKey;
    await sharedPool.query(
      `INSERT INTO merchant_api_keys
       (merchant_id, api_key, key_type, key_prefix, description)
       VALUES ($1::uuid, $2, 'LIVE', $3, 'Auto-generated on approval')`,
      [req.params.merchant_id, rawKey, rawKey.slice(0, 12)]
    );
  }

  await writeAdminAuditLog(
    req.staff.staff_id,
    decision === "approved" ? "approved_merchant" : "rejected_merchant",
    "Merchant", req.params.merchant_id,
    { decision, commission_rate, notes, new_status: newStatus },
    req.ip || ""
  );

  res.json({
    success: true,
    merchant_id: req.params.merchant_id,
    business_name: merchant.business_name,
    new_status: newStatus,
    api_key: apiKey,
    commission_rate,
  });
});

// PUT /api/admin/merchants/:merchant_id/suspend
router.put("/merchants/:merchant_id/suspend", requireAdmin(["merchants.suspend"]), async (req, res) => {
  const { action, reason } = req.body;
  const validActions = ["suspend", "ban", "activate"];
  if (!validActions.includes(action)) {
    res.status(400).json({ error: "INVALID_ACTION" });
    return;
  }

  const newStatus = action === "suspend" ? "SUSPENDED" : action === "ban" ? "REJECTED" : "APPROVED";

  const result = await merchantsPool.query(
    `UPDATE merchants SET status = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING id, business_name`,
    [newStatus, req.params.merchant_id]
  );

  if (!result.rows[0]) {
    res.status(404).json({ error: "MERCHANT_NOT_FOUND" });
    return;
  }

  await writeAdminAuditLog(
    req.staff.staff_id, `${action}_merchant`, "Merchant", req.params.merchant_id,
    { action, reason, new_status: newStatus },
    req.ip || ""
  );

  res.json({
    success: true,
    merchant_id: req.params.merchant_id,
    new_status: newStatus,
  });
});

// PUT /api/admin/merchants/:merchant_id/commission
router.put("/merchants/:merchant_id/commission", requireAdmin(["merchants.update_commission"]), async (req, res) => {
  const { new_rate, reason } = req.body;
  if (new_rate === undefined) {
    res.status(400).json({ error: "MISSING_FIELDS" });
    return;
  }

  const result = await merchantsPool.query(
    `SELECT id, business_name FROM merchants WHERE id = $1::uuid LIMIT 1`,
    [req.params.merchant_id]
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "MERCHANT_NOT_FOUND" });
    return;
  }

  await writeAdminAuditLog(
    req.staff.staff_id, "updated_commission", "Merchant", req.params.merchant_id,
    { new_rate, reason },
    req.ip || ""
  );

  res.json({
    success: true,
    merchant_id: req.params.merchant_id,
    new_rate: parseFloat(new_rate),
  });
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────

// PUT /api/admin/orders/:order_id/override
router.put("/orders/:order_id/override", requireAdmin(["orders.override"]), async (req, res) => {
  const { action, reason, refund } = req.body;
  if (!["cancel"].includes(action)) {
    res.status(400).json({ error: "INVALID_ACTION" });
    return;
  }

  const result = await sharedPool.query(
    `UPDATE orders
     SET status = 'CANCELLED', cancelled_at = NOW(), cancel_reason = $1, updated_at = NOW()
     WHERE id = $2::uuid RETURNING id, status`,
    [reason || "Admin override", req.params.order_id]
  );

  if (!result.rows[0]) {
    res.status(404).json({ error: "ORDER_NOT_FOUND" });
    return;
  }

  await writeAdminAuditLog(
    req.staff.staff_id, "override_order", "Order", req.params.order_id,
    { action, reason, refund },
    req.ip || ""
  );

  res.json({
    success: true,
    order_id: req.params.order_id,
    new_status: "CANCELLED",
    refund: refund || false,
  });
});

// ─── REPORTS ──────────────────────────────────────────────────────────────────

// GET /api/admin/reports/financial
router.get("/reports/financial", requireAdmin(["finance.reports"]), async (req, res) => {
  const { from_date, to_date, merchant_id } = req.query;
  if (!from_date || !to_date) {
    res.status(400).json({ error: "MISSING_DATES", message: "from_date و to_date مطلوبان" });
    return;
  }

  let merchantFilter = "";
  const params: any[] = [from_date, to_date];
  if (merchant_id) {
    params.push(merchant_id);
    merchantFilter = `AND merchant_id = $${params.length}::uuid`;
  }

  const summaryResult = await sharedPool.query(
    `SELECT
       COUNT(*) as total_receipts,
       COALESCE(SUM(final_amount), 0) as total_revenue,
       COALESCE(SUM(commission_amount), 0) as total_commission,
       COUNT(CASE WHEN status = 'VOIDED' THEN 1 END) as total_refunds,
       COALESCE(SUM(CASE WHEN status = 'VOIDED' THEN -commission_amount ELSE 0 END), 0) as refund_amount
     FROM receipts r
     JOIN orders o ON o.id = r.order_id
     WHERE r.created_at::date BETWEEN $1 AND $2 ${merchantFilter}`,
    params
  );

  const topMerchantsResult = await sharedPool.query(
    `SELECT o.merchant_id, COUNT(*) as orders, SUM(r.commission_amount) as commission
     FROM receipts r
     JOIN orders o ON o.id = r.order_id
     WHERE r.created_at::date BETWEEN $1 AND $2 AND r.status = 'ACTIVE'
     GROUP BY o.merchant_id
     ORDER BY commission DESC LIMIT 10`,
    [from_date, to_date]
  );

  const dailyResult = await sharedPool.query(
    `SELECT r.created_at::date as date, COUNT(*) as receipts, SUM(r.commission_amount) as commission
     FROM receipts r
     WHERE r.created_at::date BETWEEN $1 AND $2 AND r.status = 'ACTIVE'
     GROUP BY r.created_at::date
     ORDER BY date`,
    [from_date, to_date]
  );

  const summary = summaryResult.rows[0];
  const netCommission = parseFloat(summary.total_commission) + parseFloat(summary.refund_amount);

  res.json({
    period: { from: from_date, to: to_date },
    summary: {
      total_receipts: parseInt(summary.total_receipts),
      total_revenue: parseFloat(summary.total_revenue),
      total_commission: parseFloat(summary.total_commission),
      total_refunds: parseInt(summary.total_refunds),
      refund_amount: parseFloat(summary.refund_amount),
      net_commission: parseFloat(netCommission.toFixed(2)),
    },
    top_merchants: topMerchantsResult.rows,
    daily_breakdown: dailyResult.rows,
  });
});

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────

// GET /api/admin/audit-log
router.get("/audit-log", requireAdmin(["audit.view"]), async (req, res) => {
  const { staff_id, action, from_date, to_date, page = "1", per_page = "50" } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(per_page as string);

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (staff_id) {
    params.push(staff_id);
    where += ` AND staff_id = $${params.length}::uuid`;
  }
  if (action) {
    params.push(`%${action}%`);
    where += ` AND action ILIKE $${params.length}`;
  }
  if (from_date) {
    params.push(from_date);
    where += ` AND created_at::date >= $${params.length}`;
  }
  if (to_date) {
    params.push(to_date);
    where += ` AND created_at::date <= $${params.length}`;
  }

  params.push(parseInt(per_page as string));
  params.push(offset);

  const result = await staffPool.query(
    `SELECT al.id, al.staff_id, su.full_name as staff_name, su.role as staff_role,
            al.action, al.entity_type, al.entity_id, al.new_values, al.ip_address, al.created_at
     FROM audit_log al
     LEFT JOIN staff_users su ON su.id = al.staff_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    data: result.rows,
    pagination: {
      page: parseInt(page as string),
      per_page: parseInt(per_page as string),
      total: result.rows.length,
    },
  });
});

export default router;
