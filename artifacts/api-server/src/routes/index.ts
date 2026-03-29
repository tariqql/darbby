import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import vehiclesRouter from "./vehicles.js";
import tripsRouter from "./trips.js";
import offersRouter from "./offers.js";
import merchantRouter from "./merchant.js";
import notificationsRouter from "./notifications.js";
import geoRouter from "./geo.js";
import dinaRouter from "./dina.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/vehicles", vehiclesRouter);
router.use("/trips", tripsRouter);
router.use("/offers", offersRouter);
router.use("/merchant", merchantRouter);
router.use("/notifications", notificationsRouter);
router.use("/geo", geoRouter);
router.use("/dina", dinaRouter);

export default router;
