import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trashRouter from "./trash";

const router: IRouter = Router();

router.use(healthRouter);
router.use(trashRouter);

export default router;
