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
  CalendarDays,
  ArrowRight
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

// Import generated assets
import imgPlanning from "@assets/generated_images/landscape_architecture_plans_and_tools.png";
import imgMaterials from "@assets/generated_images/landscaping_materials_stone_and_plants.png";
import imgCrew from "@assets/generated_images/modern_landscape_crew_working.png";
import imgMarketing from "@assets/generated_images/office_desk_with_marketing_charts.png";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Home() {
  const { user } = useAuth();

  const tiles = [
    { 
      title: "SOP Library", 
      desc: "Standard Operating Procedures", 
      icon: BookOpen, 
      href: "/sops", 
      image: imgPlanning,
      color: "bg-emerald-900/10 text-emerald-900",
      colSpan: "md:col-span-2 lg:col-span-1"
    },
    { 
      title: "Sales Playbook", 
      desc: "Scripts, Estimates & Proposals", 
      icon: CalendarDays, 
      href: "/sales", 
      image: null,
      color: "bg-amber-100 text-amber-900",
      colSpan: "md:col-span-1"
    },
    { 
      title: "Materials Catalog", 
      desc: "Inventory, Pricing & Suppliers", 
      icon: Hammer, 
      href: "/materials", 
      image: imgMaterials,
      color: "bg-stone-100 text-stone-900",
      colSpan: "md:col-span-1 lg:col-span-2"
    },
    { 
      title: "Hiring Automation", 
      desc: "Pipeline, Candidates & Onboarding", 
      icon: Users, 
      href: "/hiring", 
      image: imgCrew,
      color: "bg-blue-100 text-blue-900",
      colSpan: "md:col-span-2"
    },
    { 
      title: "Marketing & Ads", 
      desc: "Campaigns, ROI & Lead Gen", 
      icon: Megaphone, 
      href: "/marketing", 
      image: imgMarketing,
      color: "bg-purple-100 text-purple-900",
      colSpan: "md:col-span-1"
    },
    { 
      title: "Forms Library", 
      desc: "Checklists, Safety & Intake", 
      icon: FileText, 
      href: "/forms", 
      image: null,
      color: "bg-rose-100 text-rose-900",
      colSpan: "md:col-span-1"
    },
    { 
      title: "Integrations Hub", 
      desc: "API Keys & Webhooks", 
      icon: Settings, 
      href: "/integrations", 
      image: null,
      color: "bg-slate-100 text-slate-900",
      colSpan: "md:col-span-1"
    },
    { 
      title: "Education Center", 
      desc: "Training & Resources", 
      icon: GraduationCap, 
      href: "/education", 
      image: null,
      color: "bg-cyan-100 text-cyan-900",
      colSpan: "md:col-span-1"
    },
    { 
      title: "Company HQ", 
      desc: "Mission, Vision & Team", 
      icon: Building2, 
      href: "/hq", 
      image: null,
      color: "bg-primary/10 text-primary",
      colSpan: "md:col-span-1"
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-heading font-bold text-foreground">
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Here's what's happening at Company HQ today.
        </p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"
      >
        {tiles.map((tile, i) => (
          <motion.div 
            key={i} 
            variants={item}
            className={tile.colSpan}
          >
            <Link href={tile.href}>
              <div 
                className="tile-dash group relative h-64 w-full cursor-pointer"
                data-testid={`tile-${tile.title.toLowerCase().replace(/\s+/g, '-')}`}
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

                <div className={`relative z-10 h-full flex flex-col justify-between ${tile.image ? 'text-white' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-lg transition-all duration-300 group-hover:scale-110 ${tile.image ? 'bg-white/20 backdrop-blur-md text-white group-hover:bg-white/30' : tile.color}`}>
                      <tile.icon className="w-6 h-6" />
                    </div>
                    <div className="p-2 rounded-full bg-primary/10 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      <ArrowRight className={`w-5 h-5 ${tile.image ? 'text-white' : 'text-primary'}`} />
                    </div>
                  </div>
                  
                  <div className="transform transition-transform duration-300 group-hover:translate-x-1">
                    <h3 className="text-2xl font-heading font-bold mb-1 drop-shadow-md">{tile.title}</h3>
                    <p className={`text-sm ${tile.image ? 'text-white/90' : 'text-muted-foreground'}`}>
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
