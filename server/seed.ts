import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

interface SeedUser {
  username: string;
  password: string;
  name: string;
  role: "Admin" | "Manager" | "Crew" | "Customer";
  isMasterAdmin?: boolean;
}

const SEED_USERS: SeedUser[] = [
  {
    username: "Chapin123",
    password: "PassW0rd123",
    name: "Chapin",
    role: "Admin",
    isMasterAdmin: true,
  },
  {
    username: "tester1",
    password: "Test1234!",
    name: "Tester One",
    role: "Admin",
  },
  {
    username: "tester2",
    password: "Test1234!",
    name: "Tester Two",
    role: "Manager",
  },
  {
    username: "tester3",
    password: "Test1234!",
    name: "Tester Three",
    role: "Crew",
  },
];

export async function seedUsers(): Promise<void> {
  console.log("[seed] Checking for required accounts...");
  
  for (const seedUser of SEED_USERS) {
    try {
      const existingUser = await storage.getUserByUsername(seedUser.username);
      
      if (!existingUser) {
        const hashedPassword = await hashPassword(seedUser.password);
        const newUser = await storage.createUser({
          username: seedUser.username,
          password: hashedPassword,
          name: seedUser.name,
          email: `${seedUser.username.toLowerCase()}@example.com`,
          role: seedUser.role,
        });
        
        if (seedUser.isMasterAdmin) {
          await storage.updateUser(newUser.id, { isMasterAdmin: true });
        }
        
        console.log(`[seed] Created account: ${seedUser.username} (${seedUser.role})${seedUser.isMasterAdmin ? ' [MASTER ADMIN]' : ''}`);
      } else {
        const hashedPassword = await hashPassword(seedUser.password);
        const updates: any = { password: hashedPassword };
        
        if (seedUser.isMasterAdmin) {
          updates.isMasterAdmin = true;
        }
        
        await storage.updateUser(existingUser.id, updates);
        console.log(`[seed] Reset password for: ${seedUser.username}${seedUser.isMasterAdmin ? ' [MASTER ADMIN]' : ''}`);
      }
    } catch (error) {
      console.error(`[seed] Error with account ${seedUser.username}:`, error);
    }
  }
  
  console.log("[seed] Account check complete");
}
