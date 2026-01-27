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

const SAMPLE_MATERIALS = [
  { name: 'Premium Mulch - Brown', category: 'Mulch', unit: 'cubic yard', price: 45.00, stock: 100, sku: 'MLH-BRN-001' },
  { name: 'Premium Mulch - Black', category: 'Mulch', unit: 'cubic yard', price: 48.00, stock: 85, sku: 'MLH-BLK-001' },
  { name: 'River Rock - Medium', category: 'Stone', unit: 'ton', price: 125.00, stock: 50, sku: 'STN-RVR-001' },
  { name: 'Paver Bricks - Gray', category: 'Hardscape', unit: 'piece', price: 2.50, stock: 500, sku: 'PVR-GRY-001' },
  { name: 'Paver Bricks - Red', category: 'Hardscape', unit: 'piece', price: 2.75, stock: 400, sku: 'PVR-RED-001' },
  { name: 'Topsoil - Premium', category: 'Soil', unit: 'cubic yard', price: 35.00, stock: 75, sku: 'SOL-TOP-001' },
  { name: 'Compost - Organic', category: 'Soil', unit: 'cubic yard', price: 40.00, stock: 60, sku: 'SOL-CMP-001' },
  { name: 'Sod - Kentucky Bluegrass', category: 'Grass', unit: 'pallet', price: 275.00, stock: 25, sku: 'GRS-KYB-001' },
  { name: 'Landscape Fabric', category: 'Supplies', unit: 'roll', price: 45.00, stock: 30, sku: 'SUP-FAB-001' },
  { name: 'Edging - Black Plastic', category: 'Supplies', unit: 'box', price: 28.00, stock: 40, sku: 'SUP-EDG-001' },
];

const SAMPLE_SOPS = [
  { title: 'Safety Equipment Requirements', content: 'All crew members must wear appropriate PPE including safety glasses, steel-toe boots, gloves, and hearing protection when operating equipment.', category: 'Onboarding & Basics' },
  { title: 'Proper Mulch Installation', content: 'Apply mulch 2-4 inches deep around plants. Keep mulch 2-3 inches away from plant stems and tree trunks to prevent rot.', category: 'Softscape' },
  { title: 'Paver Installation Guide', content: 'Excavate area to proper depth, install base material, compact, add sand layer, lay pavers in pattern, fill joints with polymeric sand.', category: 'Hardscape' },
  { title: 'Lawn Mowing Best Practices', content: 'Never remove more than 1/3 of grass blade height. Mow when grass is dry. Alternate mowing patterns to prevent soil compaction.', category: 'Lawn Maintenance' },
  { title: 'Equipment Pre-Start Checklist', content: 'Before starting any equipment: Check fuel, oil, and coolant levels. Inspect for damage or loose parts. Test safety features.', category: 'Vehicles & Equipment' },
  { title: 'Customer Communication Standards', content: 'Always greet customers professionally. Explain work being done. Address concerns promptly. Leave property cleaner than you found it.', category: 'Onboarding & Basics' },
];

const DEFAULT_MATERIAL_CATEGORIES = [
  'Aggregates',
  'Hardscape',
  'Mulch',
  'Plants',
  'Soil & Amendments',
  'Stone',
  'Supplies',
  'Grass & Sod',
  'Fertilizer',
  'Tools',
];

interface FieldTemplate {
  fieldName: string;
  fieldType: 'text' | 'textarea' | 'number' | 'dropdown' | 'multiselect' | 'boolean' | 'date' | 'url';
  required?: boolean;
  options?: string[];
  helpText?: string;
  showInPublicCatalog?: boolean;
  categories: string[];
}

const DEFAULT_FIELD_TEMPLATES: FieldTemplate[] = [
  {
    fieldName: 'Size/Grade',
    fieldType: 'dropdown',
    options: ['Fine', 'Medium', 'Coarse', '#57', '#67', '#8', '#3', '#4'],
    categories: ['Aggregates', 'Stone'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Color',
    fieldType: 'text',
    categories: ['Aggregates', 'Mulch', 'Stone', 'Hardscape'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Material Type',
    fieldType: 'dropdown',
    options: ['Limestone', 'Granite', 'River Rock', 'Pea Gravel', 'Crushed Concrete'],
    categories: ['Aggregates'],
  },
  {
    fieldName: 'Coverage Rate',
    fieldType: 'text',
    helpText: 'e.g., 100 sq ft per cubic yard at 3" depth',
    categories: ['Aggregates', 'Mulch', 'Soil & Amendments', 'Stone'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Mulch Type',
    fieldType: 'dropdown',
    options: ['Hardwood', 'Pine Bark', 'Cedar', 'Cypress', 'Rubber', 'Dyed'],
    categories: ['Mulch'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Sun Exposure',
    fieldType: 'dropdown',
    options: ['Full Sun', 'Partial Sun', 'Partial Shade', 'Full Shade'],
    categories: ['Plants', 'Grass & Sod'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Mature Height',
    fieldType: 'text',
    helpText: 'Expected height at maturity',
    categories: ['Plants'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Hardiness Zone',
    fieldType: 'text',
    helpText: 'USDA Hardiness Zone range (e.g., 5-9)',
    categories: ['Plants', 'Grass & Sod'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Native',
    fieldType: 'boolean',
    helpText: 'Is this a native species?',
    categories: ['Plants'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Drought Tolerant',
    fieldType: 'boolean',
    categories: ['Plants', 'Grass & Sod'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Thickness',
    fieldType: 'dropdown',
    options: ['1"', '1.5"', '2"', '2.5"', '3"', '4"'],
    categories: ['Hardscape', 'Stone'],
  },
  {
    fieldName: 'Paver Style',
    fieldType: 'dropdown',
    options: ['Brick', 'Flagstone', 'Cobblestone', 'Slab', 'Interlocking'],
    categories: ['Hardscape'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'NPK Ratio',
    fieldType: 'text',
    helpText: 'Nitrogen-Phosphorus-Potassium ratio',
    categories: ['Fertilizer'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Application Rate',
    fieldType: 'text',
    helpText: 'Recommended application rate',
    categories: ['Fertilizer', 'Soil & Amendments'],
  },
  {
    fieldName: 'Organic',
    fieldType: 'boolean',
    categories: ['Fertilizer', 'Soil & Amendments', 'Mulch'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Grass Type',
    fieldType: 'dropdown',
    options: ['Kentucky Bluegrass', 'Bermuda', 'Fescue', 'Zoysia', 'St. Augustine', 'Buffalo'],
    categories: ['Grass & Sod'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'pH Level',
    fieldType: 'text',
    helpText: 'Soil pH level or range',
    categories: ['Soil & Amendments'],
  },
  {
    fieldName: 'Brand',
    fieldType: 'text',
    categories: ['Tools', 'Supplies', 'Fertilizer'],
  },
  {
    fieldName: 'Weight Capacity',
    fieldType: 'text',
    helpText: 'Maximum weight capacity',
    categories: ['Tools', 'Supplies'],
  },
];

export async function seedMaterialCategories(): Promise<void> {
  try {
    const existingCategories = await storage.getMaterialCategories();
    if (existingCategories.length === 0) {
      console.log("[seed] Adding default material categories...");
      
      const categoryMap: Record<string, string> = {};
      
      for (const categoryName of DEFAULT_MATERIAL_CATEGORIES) {
        const category = await storage.createMaterialCategory({ name: categoryName });
        categoryMap[categoryName] = category.id;
      }
      console.log(`[seed] Added ${DEFAULT_MATERIAL_CATEGORIES.length} material categories`);
      
      console.log("[seed] Adding default category fields...");
      let fieldCount = 0;
      
      for (const template of DEFAULT_FIELD_TEMPLATES) {
        const categoryIds = template.categories
          .map(name => categoryMap[name])
          .filter(Boolean);
        
        for (const categoryId of categoryIds) {
          await storage.createCategoryField({
            categoryId,
            fieldName: template.fieldName,
            fieldType: template.fieldType,
            required: template.required || false,
            options: template.options || null,
            helpText: template.helpText || null,
            showInPublicCatalog: template.showInPublicCatalog ?? true,
          });
          fieldCount++;
        }
      }
      console.log(`[seed] Added ${fieldCount} category field templates`);
    }
  } catch (error) {
    console.error("[seed] Error seeding material categories:", error);
  }
}

export async function seedSampleData(): Promise<void> {
  try {
    await seedMaterialCategories();
    
    const existingMaterials = await storage.getMaterials();
    if (existingMaterials.length === 0) {
      console.log("[seed] Adding sample materials...");
      for (const material of SAMPLE_MATERIALS) {
        await storage.createMaterial(material);
      }
      console.log(`[seed] Added ${SAMPLE_MATERIALS.length} sample materials`);
    }

    const existingSOPs = await storage.getSops();
    if (existingSOPs.length === 0) {
      console.log("[seed] Adding sample SOPs...");
      for (const sop of SAMPLE_SOPS) {
        await storage.createSop(sop);
      }
      console.log(`[seed] Added ${SAMPLE_SOPS.length} sample SOPs`);
    }
  } catch (error) {
    console.error("[seed] Error seeding sample data:", error);
  }
}
