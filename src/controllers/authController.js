const COOKIE_NAME = "token";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches the JWT's expiresIn

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production", // requires HTTPS once deployed
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

export async function register(req, res, next) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation failed", errors: formatZodError(parsed.error) });
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
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Email is already registered" });
      }
      throw err;
    }

    const token = signToken(userId);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.status(201).json({ user: { id: userId, name, email } });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation failed", errors: formatZodError(parsed.error) });
    }

    const { email, password } = parsed.data;

    const user = await findUserByEmail(email);
    const isMatch = user && (await bcrypt.compare(password, user.passwordHash));
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
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

export async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ message: "Logged out" });
}