import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { 
  BookOpen, 
  Hammer, 
  Users, 
  Megaphone, 
  FileText, 
  Settings, 
  GraduationCap,
  Building2,
  ArrowRight,
  Truck,
  LayoutDashboard,
  CheckSquare,
  Brain,
  Mail,
  Snowflake,
  Shield,
  HelpCircle
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

import imgPlanning from "@assets/generated_images/landscape_architecture_plans_and_tools.png";
import imgMaterials from "@assets/generated_images/landscaping_materials_stone_and_plants.png";
import imgCrew from "@assets/generated_images/modern_landscape_crew_working.png";
import imgMarketing from "@assets/generated_images/office_desk_with_marketing_charts.png";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 }
};

type TileDef = {
  id: string;
  title: string;
  desc: string;
  icon: any;
  href: string;
  image: string | null;
  color: string;
  colSpan: string;
  roles: string[];
};

const allTiles: TileDef[] = [
  { 
    id: "sops",
    title: "SOP Library", 
    desc: "Standard Operating Procedures", 
    icon: BookOpen, 
    href: "/sops", 
    image: imgPlanning,
    color: "bg-emerald-900/10 text-emerald-900",
    colSpan: "col-span-1 md:col-span-2",
    roles: ["Admin", "Manager", "Crew"]
  },
  { 
    id: "quizzes",
    title: "Quizzes", 
    desc: "Training & Knowledge Tests", 
    icon: Brain, 
    href: "/testing", 
    image: null,
    color: "bg-violet-100 text-violet-900",
    colSpan: "col-span-1",
    roles: ["Admin", "Manager", "Crew"]
  },
  { 
    id: "materials",
    title: "Materials Catalog", 
    desc: "Inventory, Pricing & Suppliers", 
    icon: Hammer, 
    href: "/materials", 
    image: imgMaterials,
    color: "bg-stone-100 text-stone-900",
    colSpan: "col-span-1 md:col-span-2",
    roles: ["Admin", "Manager", "Crew"]
  },
  { 
    id: "equipment",
    title: "Equipment", 
    desc: "Fleet Tracking & Maintenance", 
    icon: Truck, 
    href: "/equipment", 
    image: null,
    color: "bg-orange-100 text-orange-900",
    colSpan: "col-span-1",
    roles: ["Admin", "Manager", "Crew"]
  },
  { 
    id: "todos",
    title: "To-Do List", 
    desc: "Tasks, Priorities & Deadlines", 
    icon: CheckSquare, 
    href: "/todos", 
    image: null,
    color: "bg-green-100 text-green-900",
    colSpan: "col-span-1",
    roles: ["Admin", "Manager", "Crew"]
  },
  { 
    id: "hiring",
    title: "Hiring", 
    desc: "Pipeline & Onboarding", 
    icon: Users, 
    href: "/hiring", 
    image: imgCrew,
    color: "bg-blue-100 text-blue-900",
    colSpan: "col-span-1 md:col-span-2",
    roles: ["Admin", "Manager", "Crew"]
  },
  { 
    id: "jobs",
    title: "Jobs", 
    desc: "Active Projects & Tracking", 
    icon: LayoutDashboard, 
    href: "/jobs", 
    image: null,
    color: "bg-teal-100 text-teal-900",
    colSpan: "col-span-1",
    roles: ["Admin", "Manager", "Crew"]
  },
  { 
    id: "education",
    title: "Customer Hub", 
    desc: "Resources & Content", 
    icon: GraduationCap, 
    href: "/education", 
    image: null,
    color: "bg-cyan-100 text-cyan-900",
    colSpan: "col-span-1",
    roles: ["Admin", "Manager", "Crew"]
  },
  { 
    id: "messages",
    title: "Messages", 
    desc: "Internal Communications", 
    icon: Mail, 
    href: "/inbox", 
    image: null,
    color: "bg-indigo-100 text-indigo-900",
    colSpan: "col-span-1",
    roles: ["Admin", "Manager", "Crew"]
  },
  { 
    id: "tools",
    title: "Tools", 
    desc: "Plow Mapper & More", 
    icon: Snowflake, 
    href: "/tools", 
    image: null,
    color: "bg-sky-100 text-sky-900",
    colSpan: "col-span-1",
    roles: ["Admin", "Manager", "Crew"]
  },
  { 
    id: "hq",
    title: "Company HQ", 
    desc: "Mission, Vision & Team", 
    icon: Building2, 
    href: "/hq", 
    image: null,
    color: "bg-primary/10 text-primary",
    colSpan: "col-span-1",
    roles: ["Admin"]
  },
  { 
    id: "marketing",
    title: "Marketing", 
    desc: "Campaigns & Lead Gen", 
    icon: Megaphone, 
    href: "/marketing", 
    image: imgMarketing,
    color: "bg-purple-100 text-purple-900",
    colSpan: "col-span-1",
    roles: ["Admin"]
  },
  { 
    id: "forms",
    title: "Forms", 
    desc: "Checklists & Intake", 
    icon: FileText, 
    href: "/forms", 
    image: null,
    color: "bg-rose-100 text-rose-900",
    colSpan: "col-span-1",
    roles: ["Admin"]
  },
  { 
    id: "integrations",
    title: "Integrations", 
    desc: "Services & API Keys", 
    icon: Settings, 
    href: "/integrations", 
    image: null,
    color: "bg-slate-100 text-slate-900",
    colSpan: "col-span-1",
    roles: ["Admin"]
  },
  { 
    id: "admin",
    title: "Admin Panel", 
    desc: "Users & Settings", 
    icon: Shield, 
    href: "/admin", 
    image: null,
    color: "bg-red-100 text-red-900",
    colSpan: "col-span-1",
    roles: ["Admin"]
  },
  { 
    id: "help",
    title: "Help Center", 
    desc: "FAQs & Support", 
    icon: HelpCircle, 
    href: "/help", 
    image: null,
    color: "bg-amber-100 text-amber-900",
    colSpan: "col-span-1",
    roles: ["Admin", "Manager", "Crew"]
  },
];

export default function Home() {
  const { user } = useAuth();

  const userRole = user?.role || "Crew";
  const tiles = allTiles.filter(t => t.roles.includes(userRole));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's what's happening at Company HQ today.
        </p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3"
      >
        {tiles.map((tile) => (
          <motion.div 
            key={tile.id} 
            variants={item}
            className={tile.colSpan}
          >
            <Link href={tile.href}>
              <div 
                className="tile-dash group relative h-32 w-full cursor-pointer"
                data-testid={`tile-${tile.id}`}
              >
                {tile.image && (
                  <div className="absolute inset-0 z-0 rounded-xl overflow-hidden">
                    <img 
                      src={tile.image} 
                      alt={tile.title} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20 group-hover:from-black/60 group-hover:via-black/30 transition-colors duration-300" />
                  </div>
                )}

                <div className={`relative z-10 h-full flex flex-col justify-between p-3 ${tile.image ? 'text-white' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className={`p-2 rounded-lg transition-all duration-300 group-hover:scale-110 ${tile.image ? 'bg-white/20 backdrop-blur-md text-white group-hover:bg-white/30' : tile.color}`}>
                      <tile.icon className="w-4 h-4" />
                    </div>
                    <div className="p-1.5 rounded-full bg-primary/10 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      <ArrowRight className={`w-3.5 h-3.5 ${tile.image ? 'text-white' : 'text-primary'}`} />
                    </div>
                  </div>
                  
                  <div className="transform transition-transform duration-300 group-hover:translate-x-1">
                    <h3 className="text-base font-heading font-bold mb-0.5 drop-shadow-md leading-tight">{tile.title}</h3>
                    <p className={`text-xs leading-tight ${tile.image ? 'text-white/90' : 'text-muted-foreground'}`}>
                      {tile.desc}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
