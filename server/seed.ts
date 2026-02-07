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

const CHAPIN_LOCKED_PASSWORD = "PassW0rd123";

export async function seedUsers(): Promise<void> {
  console.log("[seed] Startup check - running account maintenance...");
  
  try {
    // Fix Chapin123 email if incorrect
    const chapin = await storage.getUserByUsername("Chapin123");
    if (chapin && chapin.email !== "dan@chapinlandscapes.com") {
      await storage.updateUser(chapin.id, { email: "dan@chapinlandscapes.com" });
      console.log("[seed] Fixed Chapin123 email to dan@chapinlandscapes.com");
    }
    
    // Ensure Chapin123 is master admin
    if (chapin && !chapin.isMasterAdmin) {
      await storage.updateUser(chapin.id, { isMasterAdmin: true });
      console.log("[seed] Restored Chapin123 master admin status");
    }

    // Ensure Chapin123 role is always Admin
    if (chapin && chapin.role !== "Admin") {
      await storage.updateUser(chapin.id, { role: "Admin" });
      console.log("[seed] Restored Chapin123 Admin role");
    }

    // Ensure Chapin123 is always active
    if (chapin && !chapin.isActive) {
      await storage.updateUser(chapin.id, { isActive: true });
      console.log("[seed] Restored Chapin123 active status");
    }

    // Verify Chapin123 password works — re-hash if it doesn't
    if (chapin) {
      const { comparePasswords: cmp } = await import("./auth");
      const passwordValid = await cmp(CHAPIN_LOCKED_PASSWORD, chapin.password);
      if (!passwordValid) {
        const newHash = await hashPassword(CHAPIN_LOCKED_PASSWORD);
        await storage.updateUser(chapin.id, { password: newHash });
        console.log("[seed] Restored Chapin123 password");
      }
    }

    // Remove the extra 'admin' account if it exists
    const adminAccount = await storage.getUserByUsername("admin");
    if (adminAccount) {
      const deleted = await storage.deleteUser(adminAccount.id);
      console.log(`[seed] Removed duplicate admin account: ${deleted ? "success" : "failed"}`);
    }

    // Ensure no other users have master admin (only Chapin123)
    const allUsers = await storage.getAllUsers();
    for (const user of allUsers) {
      if (user.username !== "Chapin123" && user.isMasterAdmin) {
        await storage.updateUser(user.id, { isMasterAdmin: false });
        console.log(`[seed] Removed master admin from ${user.username}`);
      }
    }

    // Clean up test accounts created by automated tests
    const testPrefixes = ["e2eadmin", "testadmin", "testcustomer", "tester", "profile_test_"];
    const testSuffixes = ["_customer"];
    for (const user of allUsers) {
      const isTestAccount = testPrefixes.some(prefix => user.username.startsWith(prefix)) ||
        testSuffixes.some(suffix => user.username.endsWith(suffix) && user.email?.includes("test")) ||
        (user.email?.includes("@test.com") && user.username.includes("_customer")) ||
        (user.email?.includes("@example.com") && user.username !== "Chapin123" && user.username !== "Matt H");
      if (isTestAccount) {
        await storage.deleteUser(user.id);
        console.log(`[seed] Removed test account: ${user.username}`);
      }
    }
  } catch (error) {
    console.error("[seed] Error during account maintenance:", error);
  }
  
  console.log("[seed] Account maintenance complete");
}

const SAMPLE_MATERIALS = [
  { name: 'Premium Mulch - Brown', categoryName: 'Mulch & Soil', unitOfMeasure: 'cubic yard', description: 'High-quality brown hardwood mulch for landscape beds.' },
  { name: 'Premium Mulch - Black', categoryName: 'Mulch & Soil', unitOfMeasure: 'cubic yard', description: 'Premium dyed black mulch for decorative landscaping.' },
  { name: 'River Rock - Medium', categoryName: 'Aggregates & Gravel', unitOfMeasure: 'ton', description: 'Natural river rock for drainage and decorative applications.' },
  { name: 'Paver Bricks - Gray', categoryName: 'Hardscape & Pavers', unitOfMeasure: 'piece', description: 'Standard gray concrete pavers for patios and walkways.' },
  { name: 'Paver Bricks - Red', categoryName: 'Hardscape & Pavers', unitOfMeasure: 'piece', description: 'Classic red brick pavers for traditional designs.' },
  { name: 'Topsoil - Premium', categoryName: 'Mulch & Soil', unitOfMeasure: 'cubic yard', description: 'Screened topsoil for lawn and garden applications.' },
  { name: 'Compost - Organic', categoryName: 'Mulch & Soil', unitOfMeasure: 'cubic yard', description: 'Nutrient-rich organic compost for soil amendment.' },
  { name: 'Slow Release Fertilizer 10-10-10', categoryName: 'Chemicals & Fertilizer', unitOfMeasure: 'bag', description: 'Balanced slow-release fertilizer for lawns and gardens.' },
  { name: 'Landscape Fabric - Heavy Duty', categoryName: 'Landscape', unitOfMeasure: 'roll', description: 'Professional grade weed barrier fabric.' },
  { name: 'Black Plastic Edging', categoryName: 'Landscape', unitOfMeasure: 'box', description: 'Flexible landscape edging for clean bed lines.' },
];

const REQUIRED_SOP_TOPICS = [
  { name: 'Installation & Construction', sortOrder: 1 },
  { name: 'Property Maintenance & Services', sortOrder: 2 },
  { name: 'Equipment, Vehicles & Tools', sortOrder: 3 },
  { name: 'Materials & Inventory', sortOrder: 4 },
  { name: 'Safety & Risk Management', sortOrder: 5 },
  { name: 'Office & Administration', sortOrder: 6 },
  { name: 'Sales & Estimating', sortOrder: 7 },
  { name: 'Hiring & HR', sortOrder: 8 },
  { name: 'Technology & Systems', sortOrder: 9 },
  { name: 'Management & Leadership', sortOrder: 10 },
  { name: 'Emergency & Exception', sortOrder: 11 },
];

const SAMPLE_SOPS = [
  { title: 'Safety Equipment Requirements', content: 'All crew members must wear appropriate PPE including safety glasses, steel-toe boots, gloves, and hearing protection when operating equipment.', category: 'Safety & Risk Management' },
  { title: 'Proper Mulch Installation', content: 'Apply mulch 2-4 inches deep around plants. Keep mulch 2-3 inches away from plant stems and tree trunks to prevent rot.', category: 'Installation & Construction' },
  { title: 'Paver Installation Guide', content: 'Excavate area to proper depth, install base material, compact, add sand layer, lay pavers in pattern, fill joints with polymeric sand.', category: 'Installation & Construction' },
  { title: 'Lawn Mowing Best Practices', content: 'Never remove more than 1/3 of grass blade height. Mow when grass is dry. Alternate mowing patterns to prevent soil compaction.', category: 'Property Maintenance & Services' },
  { title: 'Equipment Pre-Start Checklist', content: 'Before starting any equipment: Check fuel, oil, and coolant levels. Inspect for damage or loose parts. Test safety features.', category: 'Equipment, Vehicles & Tools' },
  { title: 'Customer Communication Standards', content: 'Always greet customers professionally. Explain work being done. Address concerns promptly. Leave property cleaner than you found it.', category: 'Office & Administration' },
];

const DEFAULT_MATERIAL_CATEGORIES = [
  'Aggregates & Gravel',
  'Mulch & Soil',
  'Trees & Shrubs',
  'Perennials & Annuals',
  'Hardscape & Pavers',
  'Landscape',
  'Chemicals & Fertilizer',
  'Other',
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
    options: ['Fine', 'Medium', 'Coarse', '#57', '#67', '#8', '#3', '#4', 'Pea Gravel', '3/4"', '1.5"'],
    categories: ['Aggregates & Gravel', 'Hardscape & Pavers'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Color',
    fieldType: 'text',
    categories: ['Aggregates & Gravel', 'Mulch & Soil', 'Hardscape & Pavers'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Material Type',
    fieldType: 'dropdown',
    options: ['Limestone', 'Granite', 'River Rock', 'Pea Gravel', 'Crushed Concrete', 'Decomposed Granite', 'Slate', 'Flagstone'],
    categories: ['Aggregates & Gravel'],
  },
  {
    fieldName: 'Coverage Rate',
    fieldType: 'text',
    helpText: 'e.g., 100 sq ft per cubic yard at 3" depth',
    categories: ['Aggregates & Gravel', 'Mulch & Soil', 'Hardscape & Pavers'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Mulch Type',
    fieldType: 'dropdown',
    options: ['Hardwood', 'Pine Bark', 'Cedar', 'Cypress', 'Rubber', 'Dyed', 'Natural', 'Shredded'],
    categories: ['Mulch & Soil'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Sun Exposure',
    fieldType: 'dropdown',
    options: ['Full Sun', 'Partial Sun', 'Partial Shade', 'Full Shade'],
    categories: ['Trees & Shrubs', 'Perennials & Annuals'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Mature Height',
    fieldType: 'text',
    helpText: 'Expected height at maturity',
    categories: ['Trees & Shrubs', 'Perennials & Annuals'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Hardiness Zone',
    fieldType: 'text',
    helpText: 'USDA Hardiness Zone range (e.g., 5-9)',
    categories: ['Trees & Shrubs', 'Perennials & Annuals'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Native',
    fieldType: 'boolean',
    helpText: 'Is this a native species?',
    categories: ['Trees & Shrubs', 'Perennials & Annuals'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Drought Tolerant',
    fieldType: 'boolean',
    categories: ['Trees & Shrubs', 'Perennials & Annuals'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Bloom Season',
    fieldType: 'dropdown',
    options: ['Spring', 'Summer', 'Fall', 'Winter', 'Year-round'],
    categories: ['Perennials & Annuals'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Paver Style',
    fieldType: 'dropdown',
    options: ['Brick', 'Flagstone', 'Cobblestone', 'Slab', 'Interlocking', 'Travertine', 'Bluestone'],
    categories: ['Hardscape & Pavers'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Thickness',
    fieldType: 'dropdown',
    options: ['1"', '1.5"', '2"', '2.5"', '3"', '4"'],
    categories: ['Hardscape & Pavers'],
  },
  {
    fieldName: 'NPK Ratio',
    fieldType: 'text',
    helpText: 'Nitrogen-Phosphorus-Potassium ratio',
    categories: ['Chemicals & Fertilizer'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Application Rate',
    fieldType: 'text',
    helpText: 'Recommended application rate',
    categories: ['Chemicals & Fertilizer', 'Mulch & Soil'],
  },
  {
    fieldName: 'Organic',
    fieldType: 'boolean',
    categories: ['Chemicals & Fertilizer', 'Mulch & Soil'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Chemical Type',
    fieldType: 'dropdown',
    options: ['Pre-emergent', 'Post-emergent', 'Fungicide', 'Insecticide', 'Fertilizer', 'Growth Regulator'],
    categories: ['Chemicals & Fertilizer'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Soil Type',
    fieldType: 'dropdown',
    options: ['Topsoil', 'Compost', 'Potting Mix', 'Garden Soil', 'Fill Dirt', 'Sand'],
    categories: ['Mulch & Soil'],
    showInPublicCatalog: true,
  },
  {
    fieldName: 'Product Type',
    fieldType: 'text',
    categories: ['Landscape', 'Other'],
    showInPublicCatalog: true,
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

async function seedSopTopics(): Promise<void> {
  try {
    const existing = await storage.getSopCategories();
    const existingNames = new Set(existing.map(c => c.name));
    const requiredNames = new Set(REQUIRED_SOP_TOPICS.map(t => t.name));

    for (const topic of REQUIRED_SOP_TOPICS) {
      if (!existingNames.has(topic.name)) {
        await storage.createSopCategory({ name: topic.name, sortOrder: topic.sortOrder });
        console.log(`[seed] Added SOP topic: ${topic.name}`);
      }
    }

    for (const cat of existing) {
      if (!requiredNames.has(cat.name)) {
        const sopsInCategory = (await storage.getSops()).filter(s => s.categoryId === cat.id);
        if (sopsInCategory.length === 0) {
          await storage.deleteSopCategory(cat.id);
          console.log(`[seed] Removed non-standard empty SOP topic: ${cat.name}`);
        }
      }
    }
  } catch (error) {
    console.error("[seed] Error seeding SOP topics:", error);
  }
}

export async function seedSampleData(): Promise<void> {
  try {
    await seedSopTopics();
    await seedMaterialCategories();
    
    const existingMaterials = await storage.getMaterials();
    if (existingMaterials.length === 0) {
      console.log("[seed] Adding sample materials...");
      const categories = await storage.getMaterialCategories();
      for (const material of SAMPLE_MATERIALS) {
        const category = categories.find(c => c.name === material.categoryName);
        await storage.createMaterial({
          name: material.name,
          categoryId: category?.id || null,
          unitOfMeasure: material.unitOfMeasure,
          description: material.description,
          status: 'Active',
        });
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
