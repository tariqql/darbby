import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

interface AuditLogEntry {
  tableName: string;
  recordId: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | "STATUS_CHANGE";
  actorType: "USER" | "MERCHANT" | "ADMIN" | "SYSTEM";
  actorId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  changedFields?: string[];
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO system_operations_log (
        id, table_name, record_id, operation, actor_type, actor_id,
        old_values, new_values, changed_fields, reason,
        ip_address, user_agent, performed_at
      ) VALUES (
        gen_random_uuid(),
        ${entry.tableName},
        ${entry.recordId}::uuid,
        ${entry.operation},
        ${entry.actorType},
        ${entry.actorId ?? null}::uuid,
        ${entry.oldValues ? JSON.stringify(entry.oldValues) : null}::jsonb,
        ${entry.newValues ? JSON.stringify(entry.newValues) : null}::jsonb,
        ${entry.changedFields ?? null},
        ${entry.reason ?? null},
        ${entry.ipAddress ?? null},
        ${entry.userAgent ?? null},
        NOW()
      )
    `);
  } catch {
  }
}
