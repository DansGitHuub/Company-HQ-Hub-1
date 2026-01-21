import React from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  HelpCircle, 
  Map, 
  Clock, 
  ShieldCheck, 
  ArrowRight,
  PlayCircle,
  FileText
} from "lucide-react";

export default function Education() {
  const faqData = [
    { q: "How long does a typical installation take?", a: "Residential projects usually take 1-2 weeks depending on scope and weather." },
    { q: "What is your warranty policy?", a: "We offer a 2-year warranty on all hardscape installations and a 1-year plant health guarantee." },
    { q: "Do I need to be home for the maintenance crew?", a: "No, as long as we have access to the gates and any pets are inside." }
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-heading font-bold text-foreground">Customer Hub</h1>
          <p className="text-xl text-muted-foreground">Everything you need to know about your landscape journey.</p>
        </div>
        <Button size="lg" className="gap-2">
          <FileText className="w-5 h-5" /> Download Welcome Guide
        </Button>
      </div>

      <Tabs defaultValue="process" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="process">Our Process</TabsTrigger>
          <TabsTrigger value="faq">FAQs</TabsTrigger>
          <TabsTrigger value="guides">Care Guides</TabsTrigger>
        </TabsList>

        <TabsContent value="process" className="mt-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {[
              { title: "Consultation", icon: HelpCircle, desc: "We discuss your vision and budget." },
              { title: "Design", icon: Map, desc: "Visualizing your dream outdoor space." },
              { title: "Install", icon: ShieldCheck, desc: "Expert crews bring the design to life." },
              { title: "Maintain", icon: Clock, desc: "Keeping your investment beautiful." }
            ].map((step, i) => (
              <div key={i} className="relative p-6 bg-card border rounded-xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                  {i + 1}
                </div>
                <h3 className="text-xl font-heading font-bold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
                {i < 3 && <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 w-6 h-6" />}
              </div>
            ))}
          </div>

          <Card className="bg-primary text-primary-foreground overflow-hidden">
             <div className="md:flex">
                <div className="p-8 md:w-1/2 space-y-4">
                  <h2 className="text-3xl font-heading font-bold">What to expect on Day 1</h2>
                  <p className="text-primary-foreground/80">
                    Our crew will arrive between 7:30-8:00 AM. We'll start with a site walkthrough and material staging. Expect some noise and heavy equipment—it's all part of the magic!
                  </p>
                  <Button variant="secondary" className="gap-2">
                    <PlayCircle className="w-4 h-4" /> Watch Onboarding Video
                  </Button>
                </div>
                <div className="md:w-1/2 bg-black/20 min-h-[200px] flex items-center justify-center">
                   <PlayCircle className="w-16 h-16 opacity-50" />
                </div>
             </div>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="mt-8">
          <div className="space-y-4 max-w-3xl">
            {faqData.map((item, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="guides" className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {["New Lawn Care", "Pruning 101", "Irrigation Setup", "Paver Sealing"].map((guide, i) => (
              <Card key={i} className="hover:shadow-md cursor-pointer transition-shadow">
                <div className="h-32 bg-secondary rounded-t-xl" />
                <CardHeader>
                  <CardTitle>{guide}</CardTitle>
                  <CardDescription>Comprehensive guide for homeowners</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
