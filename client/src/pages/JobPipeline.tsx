import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  MoreHorizontal, 
  MessageSquare, 
  MapPin,
  Calendar,
  Filter,
  Layers
} from "lucide-react";

const PIPELINE_STAGES = ["Lead", "Quoted", "Scheduled", "In Progress", "Quality Check", "Completed"];

const PROJECTS = [
  { id: "p1", client: "Smith Residence", type: "Full Install", stage: "Lead", value: "$12,500", date: "Oct 28" },
  { id: "p2", client: "Oakwood Park", type: "Maintenance", stage: "In Progress", value: "$4,200", date: "Oct 25" },
  { id: "p3", client: "The Lofts", type: "Hardscape", stage: "Quoted", value: "$8,900", date: "Oct 20" },
  { id: "p4", client: "River Trail", type: "Planting", stage: "Scheduled", value: "$3,100", date: "Nov 2" },
];

export default function JobPipeline() {
  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Job Pipeline</h1>
          <p className="text-muted-foreground">Track project velocity from lead to completion</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline"><Filter className="w-4 h-4 mr-2"/> Filter</Button>
            <Button className="gap-2"><Plus className="w-4 h-4"/> New Job</Button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const stageJobs = PROJECTS.filter(p => p.stage === stage);
          
          return (
            <div key={stage} className="w-72 shrink-0 flex flex-col bg-stone-200/70 dark:bg-secondary/40 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">
                  {stage}
                </h3>
                <Badge variant="secondary" className="rounded-full px-2 py-0">{stageJobs.length}</Badge>
              </div>

              <div className="flex-1 space-y-3">
                {stageJobs.map((job) => (
                  <Card key={job.id} className="hover-elevate cursor-pointer border-l-4 border-l-primary shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <Badge variant="outline" className="text-[10px]">{job.type}</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="w-4 h-4" /></Button>
                      </div>
                      
                      <div>
                        <h4 className="font-bold text-foreground leading-tight">{job.client}</h4>
                        <p className="text-lg font-heading text-primary mt-1">{job.value}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                         <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {job.date}
                         </div>
                         <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Zone A
                         </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {stageJobs.length === 0 && (
                  <div className="h-24 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground/50">
                    <Layers className="w-5 h-5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
