import { Router } from "express";
import {
  uploadDocument,
  listDocuments,
  getDocument,
  removeDocument,
} from "../controllers/documentController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadPdf } from "../middleware/upload.js";

const router = Router();

router.use(requireAuth); // every document route needs a logged-in user

router.post("/", uploadPdf, uploadDocument);
router.get("/", listDocuments);
router.get("/:id", getDocument);
router.delete("/:id", removeDocument);

export default router;