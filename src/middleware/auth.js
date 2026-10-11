import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  // Cookie is the real auth path now; Authorization header stays as a fallback
  // so Postman/API testing without a browser still works.
  const headerToken = (req.headers.authorization || "").split(" ")[1];
  const token = req.cookies?.token || headerToken;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}