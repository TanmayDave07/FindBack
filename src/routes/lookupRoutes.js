import { Router } from "express";
import { getCategories, getLocations } from "../controllers/lookupController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);
router.get("/categories", getCategories);
router.get("/locations", getLocations);

export default router;
