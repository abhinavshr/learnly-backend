import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  createUser,
  findUserByEmail,
  findUserById,
} from "../models/userModel.js";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(72), // bcrypt ignores anything past 72 bytes
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

function formatZodError(error) {
  return error.issues.map((i) => ({
    field: i.path.join("."),
    message: i.message,
  }));
}

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

export async function register(req, res, next) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: formatZodError(parsed.error) });
    }

    const { name, email, password } = parsed.data;

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let userId;
    try {
      userId = await createUser({ name, email, passwordHash });
    } catch (err) {
      // Two requests with the same email at the same moment
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Email is already registered" });
      }
      throw err;
    }

    const token = signToken(userId);
    res.status(201).json({
      token,
      user: { id: userId, name, email },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: formatZodError(parsed.error) });
    }

    const { email, password } = parsed.data;

    const user = await findUserByEmail(email);
    // Same message for "no such email" and "wrong password"
    // so attackers can't find out which emails exist
    const isMatch = user && (await bcrypt.compare(password, user.passwordHash));
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user.id);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
}