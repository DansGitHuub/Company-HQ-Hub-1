import React from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus, MoreHorizontal, Phone, Mail, MessageSquare } from "lucide-react";

const STAGES = ["Applied", "Phone Screen", "Interview", "Offer", "Hired", "Rejected"];

export default function Hiring() {
  const { candidates, updateCandidateStage } = useApp();

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    updateCandidateStage(result.draggableId, result.destination.droppableId as any);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Hiring Pipeline</h1>
          <p className="text-muted-foreground">Track candidates from application to offer</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4"/> Add Candidate</Button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageCandidates = candidates.filter(c => c.stage === stage);
            
            return (
              <Droppable key={stage} droppableId={stage}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="w-80 shrink-0 flex flex-col bg-secondary/30 rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                        {stage} <span className="ml-1 text-xs bg-secondary px-2 py-0.5 rounded-full text-foreground">{stageCandidates.length}</span>
                      </h3>
                    </div>

                    <div className="flex-1 space-y-3 min-h-[100px]">
                      {stageCandidates.map((candidate, index) => (
                        <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="bg-card p-4 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <Badge variant="outline" className="text-[10px]">{candidate.role}</Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="w-4 h-4" /></Button>
                              </div>
                              <h4 className="font-bold text-foreground">{candidate.name}</h4>
                              <p className="text-xs text-muted-foreground mb-3">Applied {candidate.appliedDate}</p>
                              
                              <div className="flex gap-1 border-t pt-3 mt-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><Phone className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><Mail className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MessageSquare className="w-3 h-3" /></Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
