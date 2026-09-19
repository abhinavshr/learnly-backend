import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(), // no files left on disk
  limits: { fileSize: 20 * 1024 * 1024, files: 1 }, // 20 MB
  fileFilter(req, file, cb) {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("ONLY_PDF"));
    }
    cb(null, true);
  },
});

// Wrapped so upload errors return clean JSON instead of a 500
export function uploadPdf(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "File is too large (max 20 MB)" });
    }
    if (err.message === "ONLY_PDF") {
      return res.status(400).json({ message: "Only PDF files are allowed" });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res
        .status(400)
        .json({ message: 'Upload the file using the field name "file"' });
    }
    next(err);
  });
}