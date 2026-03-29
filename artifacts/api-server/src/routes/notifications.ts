import { Router } from "express";
import { notificationsDb, notifications } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, JwtPayload } from "../lib/auth.js";

const router = Router();
router.use(authenticate);

function auth(req: any): JwtPayload { return req.auth; }

// GET /api/notifications
router.get("/", async (req, res) => {
  const { id, actor } = auth(req);
  const unreadOnly = req.query.unreadOnly === "true";

  const recipientType = actor as "USER" | "MERCHANT";

  let conditions = [
    eq(notifications.recipientType, recipientType),
    eq(notifications.recipientId, id),
  ];
  if (unreadOnly) {
    conditions.push(eq(notifications.isRead, false));
  }

  const list = await notificationsDb
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(sql`${notifications.createdAt} DESC`)
    .limit(50);

  res.json(list);
});

// POST /api/notifications/:id/read
router.post("/:id/read", async (req, res) => {
  const { id: recipientId, actor } = auth(req);
  const { id } = req.params;

  await notificationsDb
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientId, recipientId),
      )
    );

  res.status(204).end();
});

export default router;
