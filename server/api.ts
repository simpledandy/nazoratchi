import { Router } from "express";
import authRouter from "./api-auth.js";
import statsRouter from "./api-stats.js";
import cosmeticsRouter from "./api-cosmetics.js";
import botRouter from "./api-bot.js";

const apiRouter = Router();

// Mount modular sub-routers
apiRouter.use("/", authRouter);
apiRouter.use("/", statsRouter);
apiRouter.use("/", cosmeticsRouter);
apiRouter.use("/", botRouter);

export default apiRouter;
