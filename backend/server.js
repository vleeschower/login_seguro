import fs from "fs";
import https from "https";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import csurf from "csurf";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import cors from "cors";
import { registerRoute, loginRoute, refreshRoute, logoutRoute } from "./auth.js";
import connectDB from "./db.js"; // Tu conexión a MongoDB

dotenv.config();

const app = express();

// Conectar MongoDB
connectDB();

// Configuración CORS
const allowedOrigins = process.env.ORIGIN.split(",");
app.use(
  cors({
     origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("No permitido por CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "CSRF-Token",
      "X-Requested-With",
      "X-CSRF-Token",
    ],
  })
);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Rate limiting general
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
});
app.use(generalLimiter);

// Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'", ...allowedOrigins],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CSRF protection
const csrfProtection = csurf({
  cookie: {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production", // solo secure en producción
    sameSite: "Lax", // Lax permite desarrollo local con cookies
  },
});

// Ruta para obtener token CSRF
app.get("/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Rutas de auth con CSRF
app.use("/auth", csrfProtection, registerRoute);
app.use("/auth", csrfProtection, loginRoute);
app.use("/auth", csrfProtection, refreshRoute);
app.use("/auth", csrfProtection, logoutRoute);

// Ruta de health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Manejo de errores
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ error: "Token CSRF inválido" });
  }
  console.error("Error:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

// Iniciar servidor HTTPS con mkcert
try {
  const key = fs.readFileSync("../localhost+1-key.pem");
  const cert = fs.readFileSync("../localhost+1.pem");
  https.createServer({ key, cert }, app).listen(process.env.PORT, () => {
    console.log(`Servidor seguro en https://localhost:${process.env.PORT}`);
    console.log(`CORS habilitado para: ${process.env.ORIGIN}`);
  });
} catch (error) {
  console.error("Error al iniciar servidor:", error.message);
  console.log("Verifica que los certificados SSL existan en las rutas especificadas");
}
