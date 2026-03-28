import { Router } from "express";
import { getRouteFromGoogle } from "../lib/geoUtils.js";

const router = Router();

// POST /api/geo/route
router.post("/route", async (req, res) => {
  const { originLat, originLng, destLat, destLng } = req.body;

  if (originLat === undefined || originLng === undefined || destLat === undefined || destLng === undefined) {
    res.status(400).json({ error: "originLat, originLng, destLat, destLng are required" });
    return;
  }

  try {
    const result = await getRouteFromGoogle(
      parseFloat(originLat),
      parseFloat(originLng),
      parseFloat(destLat),
      parseFloat(destLng)
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Route calculation failed" });
  }
});

export default router;
