import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const ALLOWED_ORIGINS = [
  "https://app.darbby.co",
  "https://partners.darbby.co",
  "https://staff.darbby.co",
  "https://darbby.co",
  "https://www.darbby.co",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      origin.endsWith(".replit.app") ||
      origin.endsWith(".replit.dev") ||
      process.env.NODE_ENV !== "production"
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin not allowed — ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
