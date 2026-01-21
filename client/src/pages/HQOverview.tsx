import React from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Target, 
  Eye, 
  Users, 
  Rocket, 
  CheckCircle2,
  Calendar,
  MessageSquare,
  ArrowRight
} from "lucide-react";

export default function HQOverview() {
  const goals = [
    { text: "95% Customer Satisfaction Rating", target: "Q4 2025", status: "On Track" },
    { text: "Zero Workplace Safety Incidents", target: "Ongoing", status: "Met" },
    { text: "Launch 2 New Maintenance Packages", target: "Q3 2025", status: "In Progress" }
  ];

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-20">
      {/* Hero Section */}
      <section className="text-center space-y-4">
        <h1 className="text-5xl font-heading font-bold text-primary">Company HQ</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          One team, one vision. Building the most respected landscape company in the region.
        </p>
      </section>

      {/* Vision & Mission */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-6 h-6" /> Our Vision
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg leading-relaxed">
            To transform every outdoor space into a sustainable, living masterpiece that enhances the lives of our clients and the health of our environment.
          </CardContent>
        </Card>

        <Card className="bg-secondary text-secondary-foreground border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Rocket className="w-6 h-6" /> Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg leading-relaxed">
            Delivering elite landscape installation and maintenance through professional craftsmanship, innovative design, and unwavering commitment to client success.
          </CardContent>
        </Card>
      </div>

      {/* Strategic Goals */}
      <section className="space-y-6">
        <h2 className="text-3xl font-heading font-bold flex items-center gap-2">
          <Target className="w-8 h-8 text-primary" /> Strategic Goals 2025
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {goals.map((goal, i) => (
            <Card key={i} className="hover-elevate">
              <CardContent className="pt-6 space-y-4">
                <Badge variant={goal.status === "Met" ? "default" : "secondary"}>{goal.status}</Badge>
                <p className="font-bold text-lg">{goal.text}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" /> {goal.target}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Meeting Notes */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-heading font-bold flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-primary" /> Leadership Notes
          </h2>
          <Button variant="outline">View All Archives</Button>
        </div>
        <div className="space-y-4">
          {[
            { date: "Oct 24, 2025", title: "Quarterly Strategy Alignment", attendees: "All Management" },
            { date: "Oct 17, 2025", title: "Safety Protocol Update", attendees: "All Hands" },
            { date: "Oct 10, 2025", title: "New Material Supplier Review", attendees: "Ops & Purchasing" }
          ].map((note, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-accent transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary rounded-lg flex flex-col items-center justify-center text-[10px] font-bold">
                  <span>{note.date.split(" ")[0]}</span>
                  <span className="text-base leading-none">{note.date.split(" ")[1].replace(",", "")}</span>
                </div>
                <div>
                   <h4 className="font-bold text-lg">{note.title}</h4>
                   <div className="flex items-center gap-2 text-sm text-muted-foreground">
                     <Users className="w-3 h-3" /> {note.attendees}
                   </div>
                </div>
              </div>
              <ArrowRight className="text-muted-foreground" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
