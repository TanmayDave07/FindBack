import { Router } from "express";
import { getUsers } from "../controllers/adminController.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requireAdmin);
router.get("/users", getUsers);

export default router;
