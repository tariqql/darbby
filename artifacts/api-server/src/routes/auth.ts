import { Router } from "express";
import { customersDb, merchantsDb, users, merchants } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken } from "../lib/auth.js";
import { writeAuditLog } from "../lib/auditLog.js";

const router = Router();

function isPgUniqueViolation(err: unknown): boolean {
  return (err as any)?.cause?.code === "23505" || (err as any)?.code === "23505";
}

// POST /api/auth/user/register
router.post("/user/register", async (req, res) => {
  const { fullName, email, phone, password } = req.body;

  if (!fullName || !email || !password) {
    res.status(400).json({ error: "fullName, email, password are required" });
    return;
  }

  const conditions: any[] = [eq(users.email, email.toLowerCase())];
  if (phone) conditions.push(eq(users.phone, phone));

  const existing = await customersDb
    .select({ id: users.id, email: users.email, phone: users.phone })
    .from(users)
    .where(or(...conditions))
    .limit(1);

  if (existing.length) {
    if (existing[0].email === email.toLowerCase()) {
      res.status(409).json({ error: "Email already registered" });
    } else {
      res.status(409).json({ error: "Phone number already registered" });
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let user: typeof users.$inferSelect;
  try {
    const result = await customersDb.insert(users).values({
      fullName,
      email: email.toLowerCase(),
      phone: phone || null,
      passwordHash,
    }).returning();
    user = result[0];
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      res.status(409).json({ error: "Email or phone already registered" });
    } else {
      console.error("Register insert error:", (err as any)?.message, (err as any)?.cause?.message);
      res.status(500).json({ error: "Registration failed" });
    }
    return;
  }

  await writeAuditLog({
    tableName: "users",
    recordId: user.id,
    operation: "INSERT",
    actorType: "USER",
    actorId: user.id,
    newValues: { fullName, email },
    ipAddress: req.ip,
  });

  const token = signToken({ id: user.id, email: user.email, actor: "USER", name: user.fullName });
  res.status(201).json({ token, actor: "USER", id: user.id, email: user.email, name: user.fullName });
});

// POST /api/auth/user/verify-otp  (mock — any 6-digit code marks user as verified)
router.post("/user/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    res.status(400).json({ error: "email and otp are required" });
    return;
  }
  if (!/^\d{6}$/.test(String(otp))) {
    res.status(400).json({ error: "OTP must be exactly 6 digits" });
    return;
  }

  const [user] = await customersDb.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await customersDb.update(users).set({ isVerified: true }).where(eq(users.id, user.id));
  res.json({ success: true, message: "Email verified successfully" });
});

// POST /api/auth/user/login
router.post("/user/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const [user] = await customersDb.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  await customersDb.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  const token = signToken({ id: user.id, email: user.email, actor: "USER", name: user.fullName });
  res.json({ token, actor: "USER", id: user.id, email: user.email, name: user.fullName });
});

// POST /api/auth/merchant/register
router.post("/merchant/register", async (req, res) => {
  const {
    businessName, ownerName, email, phone, password,
    commercialRegNo, commercialRegDocUrl, commercialRegExpiry,
  } = req.body;

  if (!businessName || !ownerName || !email || !phone || !password || !commercialRegNo || !commercialRegDocUrl || !commercialRegExpiry) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  const existingMerchant = await merchantsDb.select({ id: merchants.id }).from(merchants).where(
    or(eq(merchants.email, email.toLowerCase()), eq(merchants.phone, phone))
  ).limit(1);

  if (existingMerchant.length) {
    res.status(409).json({ error: "Email or phone already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let merchant: typeof merchants.$inferSelect;
  try {
    const result = await merchantsDb.insert(merchants).values({
      businessName,
      ownerName,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      commercialRegNo,
      commercialRegDocUrl,
      commercialRegExpiry,
    }).returning();
    merchant = result[0];
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      res.status(409).json({ error: "Email or phone already registered" });
    } else {
      console.error("Merchant register insert error:", (err as any)?.message, (err as any)?.cause?.message);
      res.status(500).json({ error: "Registration failed" });
    }
    return;
  }

  await writeAuditLog({
    tableName: "merchants",
    recordId: merchant.id,
    operation: "INSERT",
    actorType: "MERCHANT",
    actorId: merchant.id,
    newValues: { businessName, email },
    ipAddress: req.ip,
  });

  const token = signToken({ id: merchant.id, email: merchant.email, actor: "MERCHANT", name: merchant.businessName });
  res.status(201).json({ token, actor: "MERCHANT", id: merchant.id, email: merchant.email, name: merchant.businessName });
});

// POST /api/auth/merchant/login
router.post("/merchant/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const [merchant] = await merchantsDb.select().from(merchants).where(eq(merchants.email, email.toLowerCase())).limit(1);
  if (!merchant || !merchant.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const ok = await bcrypt.compare(password, merchant.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  await merchantsDb.update(merchants).set({ updatedAt: new Date() }).where(eq(merchants.id, merchant.id));

  const token = signToken({ id: merchant.id, email: merchant.email, actor: "MERCHANT", name: merchant.businessName });
  res.json({ token, actor: "MERCHANT", id: merchant.id, email: merchant.email, name: merchant.businessName });
});

export default router;
