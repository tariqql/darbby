import { sharedPool } from "@workspace/db";

// Barcode format: DRB-YYYY-NNNNN-XXX
// YYYY = year, NNNNN = 5-digit sequence, XXX = 3 random chars

const SAFE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No O,I,0,1 to avoid confusion

function randomSuffix(len: number): string {
  return Array.from({ length: len }, () =>
    SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)]
  ).join("");
}

export async function generateBarcode(): Promise<string> {
  // Ensure sequence exists
  await sharedPool.query(`
    CREATE SEQUENCE IF NOT EXISTS order_barcode_seq
    START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 1
  `).catch(() => {});

  const seqResult = await sharedPool.query(
    `SELECT nextval('order_barcode_seq') AS seq`
  );
  const seq = parseInt(seqResult.rows[0].seq);
  const year = new Date().getFullYear();
  const seqPadded = String(seq).padStart(5, "0");
  const suffix = randomSuffix(3);

  return `DRB-${year}-${seqPadded}-${suffix}`;
}
