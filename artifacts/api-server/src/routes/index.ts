import { Router, type IRouter } from "express";
import healthRouter from "./health";
import xadonRouter from "./xadon";

const router: IRouter = Router();

router.use(healthRouter);
router.use(xadonRouter);

export default router;
