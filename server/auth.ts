import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { sendPasswordRecoveryEmail } from "./email";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  let sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.warn("WARNING: SESSION_SECRET not set. Sessions will not persist across restarts.");
    sessionSecret = randomBytes(32).toString("hex");
  }
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    rolling: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }
        if (!user.isActive) {
          return done(null, false, { message: "Account is deactivated. Contact administrator." });
        }
        if (!(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, email, name, role } = req.body;
      
      if (!username || !password || !email || !name) {
        return res.status(400).json({ message: "All fields are required", errorCode: "AUTH-005" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists", errorCode: "AUTH-005" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists", errorCode: "AUTH-005" });
      }

      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        email,
        name,
        role: "Customer",
      });

      req.login(user, (err) => {
        if (err) return next(err);
        const { password: _, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: SelectUser | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Login failed", errorCode: "AUTH-001" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        const { password: _, ...safeUser } = user;
        res.status(200).json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password: _, ...safeUser } = req.user!;
    res.json(safeUser);
  });

  app.post("/api/recover", async (req, res) => {
    try {
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Return success message even if user doesn't exist (security best practice)
        return res.json({ message: "If the email exists, a recovery link will be sent.", email });
      }
      
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await storage.setRecoveryToken(user.id, token, expires);
      
      try {
        await sendPasswordRecoveryEmail(user.email!, token, user.name || user.username, user.language || "en");
        console.log(`[email] Recovery email sent successfully to ${email}`);
        res.json({ message: "Recovery email sent!", email, sent: true });
      } catch (emailErr: any) {
        console.error("[email] Failed to send recovery email:", emailErr?.message || emailErr);
        // Still return success to not reveal if email exists, but log the error
        res.json({ message: "If the email exists, a recovery link will be sent.", email, sent: false });
      }
    } catch (err) {
      res.status(500).json({ message: "Error processing recovery request" });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      const user = await storage.getUserByRecoveryToken(token);
      
      if (!user || !user.recoveryExpires || user.recoveryExpires < new Date()) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      const updates: Record<string, any> = {
        password: await hashPassword(newPassword),
        recoveryToken: null,
        recoveryExpires: null,
      };
      
      // Update storedPassword for staff (non-customer) so Master Admin sees updated password
      if (user.role !== "Customer") {
        updates.storedPassword = newPassword;
      }
      
      await storage.updateUser(user.id, updates);
      
      res.json({ message: "Password reset successful" });
    } catch (err) {
      res.status(500).json({ message: "Error resetting password" });
    }
  });
}

import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (req.user?.role !== "Admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
