import express from "express";
import argon2 from "argon2";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "./models/user.js";
import RefreshToken from "./models/RefreshToken.js";

// Parámetros Argon2id
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1,
};

// Rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos, intente más tarde" },
});

const router = express.Router();

// ---------------- Helpers ----------------
function signAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m",
  });
}

function genRefreshTokenPair() {
  const token = crypto.randomBytes(parseInt(process.env.REFRESH_TOKEN_BYTES || 64)).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

// ---------------- REGISTRO ----------------
export const registerRoute = express.Router();
registerRoute.post("/register", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Faltan campos" });

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await argon2.hash(password + salt, ARGON_OPTIONS);

    const newUser = new User({ email, password_hash: hash, argon_salt: salt });
    await newUser.save();

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error en servidor" });
  }
});

// ---------------- LOGIN ----------------
export const loginRoute = express.Router();
loginRoute.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Faltan campos" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      return res.status(423).json({ error: "Cuenta temporalmente bloqueada" });
    }

    const ok = await argon2.verify(user.password_hash, password + user.argon_salt, ARGON_OPTIONS).catch(() => false);
    if (!ok) {
      let attempts = (user.failed_attempts || 0) + 1;
      let lockUntil = null;
      if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        attempts = 0;
      }
      user.failed_attempts = attempts;
      user.lock_until = lockUntil;
      await user.save();
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    user.failed_attempts = 0;
    user.lock_until = null;
    await user.save();

    const accessToken = signAccessToken(user._id);
    const { token: refreshTokenPlain, hash: refreshHash } = genRefreshTokenPair();
    const newToken = new RefreshToken({ user_id: user._id, token_hash: refreshHash });
    await newToken.save();

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refresh_token", refreshTokenPlain, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error servidor" });
  }
});

// ---------------- REFRESH TOKEN ----------------
export const refreshRoute = express.Router();
refreshRoute.post("/refresh", authLimiter, async (req, res) => {
  try {
    const rt = req.cookies["refresh_token"];
    if (!rt) return res.status(401).json({ error: "No refresh token" });

    const hash = crypto.createHash("sha256").update(rt).digest("hex");
    const row = await RefreshToken.findOne({ token_hash: hash, revoked: false });
    if (!row) return res.status(401).json({ error: "Refresh token inválido" });

    row.revoked = true;
    await row.save();

    const { token: newTokenPlain, hash: newHash } = genRefreshTokenPair();
    const newToken = new RefreshToken({ user_id: row.user_id, token_hash: newHash, replaced_by: row._id });
    await newToken.save();

    const accessToken = signAccessToken(row.user_id);

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refresh_token", newTokenPlain, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error servidor" });
  }
});

// ---------------- LOGOUT ----------------
export const logoutRoute = express.Router();
logoutRoute.post("/logout", authLimiter, async (req, res) => {
  try {
    const rt = req.cookies["refresh_token"];
    if (rt) {
      const hash = crypto.createHash("sha256").update(rt).digest("hex");
      await RefreshToken.updateOne({ token_hash: hash }, { revoked: true });
    }

    res.clearCookie("access_token", { httpOnly: true, secure: true, sameSite: "Strict" });
    res.clearCookie("refresh_token", { httpOnly: true, secure: true, sameSite: "Strict" });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error servidor" });
  }
});

export default router;
