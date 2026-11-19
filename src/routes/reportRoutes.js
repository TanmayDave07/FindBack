import { Router } from "express";
import { getReports, getReport, createReport, updateReport, closeReport, deleteReport } from "../controllers/reportController.js";
import { authenticate } from "../middleware/auth.js";
import { validateReportId, validateReport, validateReportQuery } from "../middleware/validation.js";

const router = Router();

router.use(authenticate);
router.get("/", validateReportQuery, getReports);
router.get("/:id", validateReportId, getReport);
router.post("/", validateReport, createReport);
router.patch("/:id", validateReportId, validateReport, updateReport);
router.post("/:id/close", validateReportId, closeReport);
router.delete("/:id", validateReportId, deleteReport);

export default router;
