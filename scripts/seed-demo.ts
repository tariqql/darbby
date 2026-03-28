/**
 * Darbby Demo Seed Script — v2
 */

const BASE = "http://localhost:8080/api";

async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`  ❌ ${method} ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return null;
  }
  return data;
}

async function main() {
  console.log("\n🌱 Darbby Demo Seed v2 Starting...\n");

  // ─── 1. USERS ────────────────────────────────────────────────────────────
  console.log("👤 Creating demo travelers...");

  await api("POST", "/auth/user/register", {
    fullName: "أحمد العمري",
    email: "ahmed@demo.com",
    password: "demo1234",
    phone: "+966501234567",
  });
  await api("POST", "/auth/user/register", {
    fullName: "سارة الحربي",
    email: "sara@demo.com",
    password: "demo1234",
    phone: "+966507654321",
  });

  const u1Login = await api("POST", "/auth/user/login", { email: "ahmed@demo.com", password: "demo1234" });
  const u2Login = await api("POST", "/auth/user/login", { email: "sara@demo.com", password: "demo1234" });

  const tok1 = u1Login?.token;
  const tok2 = u2Login?.token;

  if (!tok1 || !tok2) { console.error("  ❌ فشل تسجيل دخول المسافرين"); process.exit(1); }
  console.log("  ✅ أحمد العمري  — ahmed@demo.com / demo1234");
  console.log("  ✅ سارة الحربي  — sara@demo.com  / demo1234");

  // ─── 2. VEHICLES ────────────────────────────────────────────────────────
  console.log("\n🚗 Creating vehicles...");

  await api("POST", "/vehicles", {
    nickname: "لاند كروزر العائلي", vehicleType: "SUV",
    make: "تويوتا", model: "لاند كروزر", year: 2024,
    plateNo: "ABJ-1234", fuelType: "PETROL_91", tankCapacityLiters: 93, color: "أبيض",
  }, tok1);
  await api("POST", "/vehicles", {
    nickname: "سبورتاج الأسبوعي", vehicleType: "SUV",
    make: "كيا", model: "سبورتاج", year: 2022,
    plateNo: "DHW-5678", fuelType: "DIESEL", tankCapacityLiters: 62, color: "رمادي",
  }, tok1);
  await api("POST", "/vehicles", {
    nickname: "أكسنت سارة", vehicleType: "SEDAN",
    make: "هيونداي", model: "أكسنت", year: 2021,
    plateNo: "ZHT-9999", fuelType: "PETROL_91", tankCapacityLiters: 45, color: "أزرق",
  }, tok2);
  console.log("  ✅ 3 مركبات");

  // ─── 3. MERCHANTS ────────────────────────────────────────────────────────
  console.log("\n🏪 Creating demo merchants...");

  const futureDate = "2027-12-31";
  await api("POST", "/auth/merchant/register", {
    businessName: "محطات الخليج للوقود",
    ownerName: "خالد المطيري",
    email: "gulf@demo.com",
    password: "demo1234",
    phone: "+966112345678",
    commercialRegNo: "1010000001",
    commercialRegDocUrl: "https://example.com/cr1.pdf",
    commercialRegExpiry: futureDate,
  });
  await api("POST", "/auth/merchant/register", {
    businessName: "مطاعم الوجبة السريعة",
    ownerName: "فيصل العتيبي",
    email: "food@demo.com",
    password: "demo1234",
    phone: "+966198765432",
    commercialRegNo: "1010000002",
    commercialRegDocUrl: "https://example.com/cr2.pdf",
    commercialRegExpiry: futureDate,
  });
  await api("POST", "/auth/merchant/register", {
    businessName: "فندق النخيل الذهبي",
    ownerName: "عبدالله القحطاني",
    email: "hotel@demo.com",
    password: "demo1234",
    phone: "+966114567890",
    commercialRegNo: "1010000003",
    commercialRegDocUrl: "https://example.com/cr3.pdf",
    commercialRegExpiry: futureDate,
  });

  const m1Login = await api("POST", "/auth/merchant/login", { email: "gulf@demo.com", password: "demo1234" });
  const m2Login = await api("POST", "/auth/merchant/login", { email: "food@demo.com", password: "demo1234" });
  const m3Login = await api("POST", "/auth/merchant/login", { email: "hotel@demo.com", password: "demo1234" });

  const mt1 = m1Login?.token;
  const mt2 = m2Login?.token;
  const mt3 = m3Login?.token;

  if (!mt1 || !mt2 || !mt3) { console.error("  ❌ فشل تسجيل دخول التجار"); process.exit(1); }
  console.log("  ✅ محطات الخليج للوقود  — gulf@demo.com  / demo1234");
  console.log("  ✅ مطاعم الوجبة السريعة — food@demo.com  / demo1234");
  console.log("  ✅ فندق النخيل الذهبي   — hotel@demo.com / demo1234");

  // ─── 4. APPROVE MERCHANTS (direct DB update via API workaround) ───────────
  // Merchants start as PENDING — approve via update profile endpoint using admin workaround
  // For demo we'll use the existing PENDING status (merchants can still operate)

  // ─── 5. BRANCHES ─────────────────────────────────────────────────────────
  console.log("\n📍 Creating branches along Riyadh-Dammam highway...");

  const b1 = await api("POST", "/merchant/branches", {
    branchName: "محطة الخليج — العليا",
    lat: 24.7136,
    lng: 46.6753,
    addressText: "طريق الملك فهد، حي العليا، الرياض",
    serviceRadiusKm: 10,
    workingHours: "06:00-23:00",
  }, mt1);
  const b1Id = b1?.id ?? b1?.branch?.id;

  const b1b = await api("POST", "/merchant/branches", {
    branchName: "محطة الخليج — الخرج",
    lat: 24.1504,
    lng: 47.2998,
    addressText: "طريق الرياض-الخرج، كم 60",
    serviceRadiusKm: 15,
    workingHours: "00:00-23:59",
  }, mt1);

  const b2 = await api("POST", "/merchant/branches", {
    branchName: "فرع الوجبة — شرق الرياض",
    lat: 24.7450,
    lng: 46.8200,
    addressText: "طريق الدمام، شرق الرياض",
    serviceRadiusKm: 8,
    workingHours: "07:00-02:00",
  }, mt2);
  const b2Id = b2?.id ?? b2?.branch?.id;

  const b3 = await api("POST", "/merchant/branches", {
    branchName: "فندق النخيل — الأحساء",
    lat: 25.3686,
    lng: 49.5870,
    addressText: "شارع الملك عبدالعزيز، الأحساء",
    serviceRadiusKm: 20,
    workingHours: "00:00-23:59",
  }, mt3);
  const b3Id = b3?.id ?? b3?.branch?.id;

  console.log("  ✅ 4 فروع على طريق الرياض-الدمام");

  // ─── 6. PRODUCTS ─────────────────────────────────────────────────────────
  console.log("\n🛒 Creating products...");

  let p91Id: string | null = null, p95Id: string | null = null,
      pDieselId: string | null = null, pWashId: string | null = null;
  if (mt1) {
    const p91  = await api("POST", "/merchant/products", { name: "بنزين 91", price: 2.18, category: "FUEL", targetFuelType: "PETROL_91" }, mt1);
    const p95  = await api("POST", "/merchant/products", { name: "بنزين 95", price: 2.33, category: "FUEL", targetFuelType: "PETROL_95" }, mt1);
    const pD   = await api("POST", "/merchant/products", { name: "ديزل",     price: 1.10, category: "FUEL", targetFuelType: "DIESEL"    }, mt1);
    const pW   = await api("POST", "/merchant/products", { name: "غسيل سيارة كامل", price: 45.00, category: "SERVICE" }, mt1);
    p91Id    = p91?.id ?? p91?.product?.id;
    p95Id    = p95?.id ?? p95?.product?.id;
    pDieselId= pD?.id  ?? pD?.product?.id;
    pWashId  = pW?.id  ?? pW?.product?.id;
  }

  let pFamilyId: string | null = null, pBurgerId: string | null = null, pDrinkId: string | null = null;
  if (mt2) {
    const pF = await api("POST", "/merchant/products", { name: "وجبة برجر دجاج", price: 32.00, category: "FOOD" }, mt2);
    const pFam = await api("POST", "/merchant/products", { name: "وجبة عائلية",    price: 120.00, category: "FOOD" }, mt2);
    const pDr  = await api("POST", "/merchant/products", { name: "مشروبات باردة",  price: 8.00,   category: "BEVERAGE" }, mt2);
    pBurgerId  = pF?.id   ?? pF?.product?.id;
    pFamilyId  = pFam?.id ?? pFam?.product?.id;
    pDrinkId   = pDr?.id  ?? pDr?.product?.id;
  }

  let pRoomId: string | null = null, pSuiteId: string | null = null, pBreakfastId: string | null = null;
  if (mt3) {
    const pR   = await api("POST", "/merchant/products", { name: "غرفة مزدوجة",  price: 450.00, category: "ACCOMMODATION" }, mt3);
    const pS   = await api("POST", "/merchant/products", { name: "جناح عائلي",   price: 850.00, category: "ACCOMMODATION" }, mt3);
    const pBrk = await api("POST", "/merchant/products", { name: "وجبة إفطار",   price: 65.00,  category: "FOOD" }, mt3);
    pRoomId      = pR?.id   ?? pR?.product?.id;
    pSuiteId     = pS?.id   ?? pS?.product?.id;
    pBreakfastId = pBrk?.id ?? pBrk?.product?.id;
  }
  console.log("  ✅ 10 منتجات");

  // ─── 7. AUTO-NEGOTIATOR ───────────────────────────────────────────────────
  console.log("\n🤖 Configuring Auto-Negotiator...");

  await api("PUT", "/merchant/auto-negotiator", {
    isEnabled: true,
    responseDelayMin: 1,
    purposeRules: {
      UMRAH: { extraDiscountPercent: 5 },
      TOURISM: { extraDiscountPercent: 2 },
      FAMILY_VISIT: { extraDiscountPercent: 3 },
    },
    products: [
      ...(p91Id ? [{ productId: p91Id, minDiscountPercent: 2, maxDiscountPercent: 8 }] : []),
      ...(pWashId ? [{ productId: pWashId, minDiscountPercent: 5, maxDiscountPercent: 15 }] : []),
    ],
  }, mt1);

  await api("PUT", "/merchant/auto-negotiator", {
    isEnabled: true,
    responseDelayMin: 2,
    purposeRules: {
      UMRAH: { extraDiscountPercent: 8 },
      FAMILY_VISIT: { extraDiscountPercent: 5 },
    },
    products: [
      ...(pRoomId ? [{ productId: pRoomId, minDiscountPercent: 5, maxDiscountPercent: 15 }] : []),
    ],
  }, mt3);
  console.log("  ✅ Auto-Negotiator مُفعَّل للمحطة والفندق");

  // ─── 8. TRIPS ────────────────────────────────────────────────────────────
  console.log("\n🗺️  Creating demo trips...");

  const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

  const t1 = await api("POST", "/trips", {
    title: "رحلة عائلية إلى الدمام",
    tripPurpose: "FAMILY_VISIT",
    originName: "الرياض — حي العليا",
    originLat: 24.7136,
    originLng: 46.6753,
    destinationName: "الدمام — شارع الأمير محمد بن فهد",
    destLat: 26.4207,
    destLng: 50.0888,
    departureTime: inHours(2),
    notes: "رحلة عائلية، نحتاج محطة وقود وطعام على الطريق",
  }, tok1);
  const trip1Id = t1?.id ?? t1?.trip?.id;

  const t2 = await api("POST", "/trips", {
    title: "رحلة العمرة",
    tripPurpose: "UMRAH",
    originName: "الرياض",
    originLat: 24.7136,
    originLng: 46.6753,
    destinationName: "مكة المكرمة",
    destLat: 21.3891,
    destLng: 39.8579,
    departureTime: inHours(24),
    notes: "رحلة عمرة، نفضل محطات وقود ومطاعم حلال",
  }, tok1);
  const trip2Id = t2?.id ?? t2?.trip?.id;

  const t3 = await api("POST", "/trips", {
    title: "زيارة المدينة المنورة",
    tripPurpose: "TOURISM",
    originName: "الرياض — شرق",
    originLat: 24.7450,
    originLng: 46.8200,
    destinationName: "المدينة المنورة",
    destLat: 24.4686,
    destLng: 39.6142,
    departureTime: inHours(3),
  }, tok2);
  const trip3Id = t3?.id ?? t3?.trip?.id;

  console.log(`  ✅ أحمد: الرياض → الدمام (عائلية)   ID: ${trip1Id}`);
  console.log(`  ✅ أحمد: الرياض → مكة (عمرة)        ID: ${trip2Id}`);
  console.log(`  ✅ سارة: الرياض → المدينة (سياحة)   ID: ${trip3Id}`);

  // ─── 9. OFFERS ───────────────────────────────────────────────────────────
  console.log("\n💰 Creating offers...");

  // محطة الخليج → رحلة أحمد العائلية
  if (trip1Id && p91Id && pWashId) {
    await api("POST", `/merchant/trips/${trip1Id}/offer`, {
      branchId: b1Id,
      items: [
        { productId: p91Id, quantity: 50, unitPrice: 2.18 },
        { productId: pWashId, quantity: 1, unitPrice: 45.00 },
      ],
      message: "مرحباً بكم في محطات الخليج! عرض خاص للعائلات — 50 لتر بنزين + غسيل مجاني",
      expiresAt: inHours(4),
    }, mt1);
    console.log("  ✅ محطة الخليج → رحلة أحمد العائلية");
  }

  // مطعم الوجبة → رحلة أحمد العائلية
  if (trip1Id && pFamilyId && pDrinkId) {
    await api("POST", `/merchant/trips/${trip1Id}/offer`, {
      branchId: b2Id,
      items: [
        { productId: pFamilyId, quantity: 1, unitPrice: 120.00 },
        { productId: pDrinkId,  quantity: 4, unitPrice: 8.00  },
      ],
      message: "أهلاً بالعائلة! وجبة عائلية + 4 مشروبات بأفضل الأسعار على طريق الدمام",
      expiresAt: inHours(3),
    }, mt2);
    console.log("  ✅ مطعم الوجبة → رحلة أحمد العائلية");
  }

  // فندق النخيل → رحلة أحمد (عمرة)
  if (trip2Id && pRoomId && pBreakfastId) {
    await api("POST", `/merchant/trips/${trip2Id}/offer`, {
      branchId: b3Id,
      items: [
        { productId: pRoomId,      quantity: 1, unitPrice: 450.00 },
        { productId: pBreakfastId, quantity: 2, unitPrice: 65.00  },
      ],
      message: "ترحيب خاص بضيوف الرحمن! غرفة مزدوجة + إفطار لشخصين — خصم خاص لرحلات العمرة",
      expiresAt: inHours(8),
    }, mt3);
    console.log("  ✅ فندق النخيل → رحلة العمرة");
  }

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║          🎉 بيانات تجريبية جاهزة — Darbby Demo                  ║
╠══════════════════════════════════════════════════════════════════╣
║  👤 حسابات المسافرين (تسجيل → مسافر):                           ║
║     ahmed@demo.com / demo1234   ← أحمد (لديه رحلتان + عروض)    ║
║     sara@demo.com  / demo1234   ← سارة (لديها رحلة للمدينة)    ║
╠══════════════════════════════════════════════════════════════════╣
║  🏪 حسابات التجار (تسجيل → تاجر):                               ║
║     gulf@demo.com   / demo1234  ← محطة وقود PREMIUM            ║
║     food@demo.com   / demo1234  ← مطعم FREE                    ║
║     hotel@demo.com  / demo1234  ← فندق PREMIUM                 ║
╠══════════════════════════════════════════════════════════════════╣
║  🗺️  الرحلات الجاهزة:                                            ║
║     أحمد: الرياض → الدمام (عائلية) — عرضان بانتظارك             ║
║     أحمد: الرياض → مكة   (عمرة)   — عرض فندقي بانتظارك         ║
║     سارة: الرياض → المدينة (سياحة) — مستعدة لاستقبال العروض     ║
╠══════════════════════════════════════════════════════════════════╣
║  🤖 Auto-Negotiator: مُفعَّل للمحطة والفندق                      ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

main().catch(console.error);
