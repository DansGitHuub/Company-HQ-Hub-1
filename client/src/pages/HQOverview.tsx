import React, { useState } from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Target, 
  Eye, 
  Users, 
  Rocket, 
  Calendar,
  MessageSquare,
  ArrowRight,
  Archive,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FileLibrary from "@/components/FileLibrary";

export default function HQOverview() {
  const { toast } = useToast();
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<typeof notes[0] | null>(null);

  const goals = [
    { text: "95% Customer Satisfaction Rating", target: "Q4 2025", status: "On Track" },
    { text: "Zero Workplace Safety Incidents", target: "Ongoing", status: "Met" },
    { text: "Launch 2 New Maintenance Packages", target: "Q3 2025", status: "In Progress" }
  ];

  const notes = [
    { date: "Oct 24, 2025", title: "Quarterly Strategy Alignment", attendees: "All Management", content: "Reviewed Q4 goals and realigned priorities. Focus areas: customer retention, crew training, and equipment maintenance." },
    { date: "Oct 17, 2025", title: "Safety Protocol Update", attendees: "All Hands", content: "Updated heat safety protocols for summer months. New hydration stations at all job sites. PPE compliance reminders." },
    { date: "Oct 10, 2025", title: "New Material Supplier Review", attendees: "Ops & Purchasing", content: "Evaluated three new mulch suppliers. Selected GreenGrow Materials for better pricing and quality. Implementation starts Nov 1." }
  ];

  const archivedNotes = [
    { date: "Oct 3, 2025", title: "Fleet Maintenance Schedule", attendees: "Operations" },
    { date: "Sep 26, 2025", title: "Fall Season Preparation", attendees: "All Crews" },
    { date: "Sep 19, 2025", title: "Customer Feedback Review", attendees: "Management" },
    { date: "Sep 12, 2025", title: "New Employee Orientation", attendees: "HR & Training" },
    { date: "Sep 5, 2025", title: "Monthly Budget Review", attendees: "Finance & Ops" },
    { date: "Aug 29, 2025", title: "Equipment Upgrade Discussion", attendees: "Operations" },
  ];

  const handleViewArchives = () => {
    setArchiveDialogOpen(true);
  };

  const handleNoteClick = (note: typeof notes[0]) => {
    setSelectedNote(note);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-20">
      <section className="text-center space-y-4">
        <h1 className="text-2xl font-heading font-bold text-foreground">Company HQ</h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          One team, one vision. Building the most respected landscape company in the region.
        </p>
      </section>

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

      <FileLibrary />

      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-heading font-bold flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-primary" /> Leadership Notes
          </h2>
          <Button variant="outline" onClick={handleViewArchives} className="gap-2">
            <Archive className="w-4 h-4" />
            View All Archives
          </Button>
        </div>
        <div className="space-y-4">
          {notes.map((note, i) => (
            <div 
              key={i} 
              className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-accent transition-colors cursor-pointer"
              onClick={() => handleNoteClick(note)}
            >
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

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Leadership Notes Archive
            </DialogTitle>
            <DialogDescription>Browse past meeting notes and company updates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {archivedNotes.map((note, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                onClick={() => {
                  toast({
                    title: note.title,
                    description: `Meeting notes from ${note.date} with ${note.attendees}.`,
                  });
                }}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{note.title}</p>
                    <p className="text-xs text-muted-foreground">{note.date} · {note.attendees}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedNote} onOpenChange={() => setSelectedNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNote?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> {selectedNote?.date} · {selectedNote?.attendees}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">{selectedNote?.content}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
