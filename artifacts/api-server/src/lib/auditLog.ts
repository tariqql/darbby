import { operationsDb, systemOperationsLog } from "@workspace/db";

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
    await operationsDb.insert(systemOperationsLog).values({
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      operationType: entry.operation,
      targetEntity: entry.tableName,
      targetId: entry.recordId,
      oldValues: entry.oldValues ?? null,
      newValues: entry.newValues ?? null,
      metadata: entry.changedFields ? { changedFields: entry.changedFields, reason: entry.reason } : null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch {
  }
}
