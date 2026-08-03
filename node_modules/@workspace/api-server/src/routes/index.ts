import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trafficRouter from "./traffic";

const router: IRouter = Router();

router.use(healthRouter);
router.use(trafficRouter);

export default router;
