import { Router } from "express";
import { customersDb, merchantsDb, users, merchants } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken } from "../lib/auth.js";
import { writeAuditLog } from "../lib/auditLog.js";

const router = Router();

// POST /api/auth/user/register
router.post("/user/register", async (req, res) => {
  const { fullName, email, phone, password } = req.body;

  if (!fullName || !email || !password) {
    res.status(400).json({ error: "fullName, email, password are required" });
    return;
  }

  const existing = await customersDb.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await customersDb.insert(users).values({
    fullName,
    email: email.toLowerCase(),
    phone: phone || null,
    passwordHash,
  }).returning();

  await writeAuditLog({
    tableName: "users",
    recordId: user.id,
    operation: "INSERT",
    actorType: "USER",
    actorId: user.id,
    newValues: { fullName, email },
    ipAddress: req.ip,
  });

  const token = signToken({ id: user.id, email: user.email, actor: "USER" });
  res.status(201).json({ token, actor: "USER", id: user.id, email: user.email, name: user.fullName });
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

  const token = signToken({ id: user.id, email: user.email, actor: "USER" });
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

  const existing = await merchantsDb.select({ id: merchants.id }).from(merchants).where(eq(merchants.email, email.toLowerCase())).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [merchant] = await merchantsDb.insert(merchants).values({
    businessName,
    ownerName,
    email: email.toLowerCase(),
    phone,
    passwordHash,
    commercialRegNo,
    commercialRegDocUrl,
    commercialRegExpiry,
  }).returning();

  await writeAuditLog({
    tableName: "merchants",
    recordId: merchant.id,
    operation: "INSERT",
    actorType: "MERCHANT",
    actorId: merchant.id,
    newValues: { businessName, email },
    ipAddress: req.ip,
  });

  const token = signToken({ id: merchant.id, email: merchant.email, actor: "MERCHANT" });
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

  const token = signToken({ id: merchant.id, email: merchant.email, actor: "MERCHANT" });
  res.json({ token, actor: "MERCHANT", id: merchant.id, email: merchant.email, name: merchant.businessName });
});

export default router;
