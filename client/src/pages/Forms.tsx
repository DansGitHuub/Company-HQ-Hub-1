import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Settings, 
  Trash2, 
  GripVertical, 
  CheckSquare, 
  Type, 
  ChevronDown,
  Eye,
  Share2
} from "lucide-react";

export default function Forms() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Forms Library</h1>
          <p className="text-muted-foreground">Create and manage digital forms</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4"/> New Form</Button>
      </div>

      <Tabs defaultValue="library" className="w-full">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="builder">Builder (Demo)</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="library" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {["Daily Job Report", "Vehicle Inspection", "Incident Report", "Client Satisfaction"].map((form, i) => (
              <Card key={i} className="hover:shadow-md transition-all cursor-pointer">
                <CardHeader>
                  <CardTitle>{form}</CardTitle>
                  <CardDescription>Last updated 2 days ago</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="w-full"><Share2 className="w-4 h-4 mr-2"/> Share</Button>
                    <Button variant="secondary" size="sm" className="w-full">Edit</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="builder">
          <FormBuilderDemo />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FormBuilderDemo() {
  const [fields, setFields] = useState([
    { id: 1, type: "text", label: "Client Name" },
    { id: 2, type: "date", label: "Service Date" },
    { id: 3, type: "select", label: "Service Type", options: ["Mowing", "Install", "Pruning"] }
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[600px]">
      {/* Toolbox */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start gap-2">
            <Type className="w-4 h-4" /> Text Input
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2">
            <ChevronDown className="w-4 h-4" /> Dropdown
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2">
            <CheckSquare className="w-4 h-4" /> Checkbox
          </Button>
        </CardContent>
      </Card>

      {/* Canvas */}
      <Card className="col-span-2 bg-secondary/20 border-dashed">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Untitled Form</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost"><Settings className="w-4 h-4" /></Button>
            <Button size="sm"><Eye className="w-4 h-4 mr-2"/> Preview</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field) => (
            <div key={field.id} className="group flex gap-2 items-start p-4 bg-card rounded-lg border shadow-sm relative">
              <GripVertical className="w-5 h-5 text-muted-foreground cursor-move mt-2" />
              <div className="flex-1 space-y-2">
                <Label>{field.label}</Label>
                {field.type === "text" && <Input disabled placeholder="Text answer" />}
                {field.type === "date" && <Input disabled type="date" />}
                {field.type === "select" && (
                    <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm opacity-50">
                        Select option...
                    </div>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                onClick={() => setFields(fields.filter(f => f.id !== field.id))}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Properties */}
      <Card className="col-span-1">
        <CardHeader>
           <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Properties</CardTitle>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground">Select a field to edit its properties.</p>
        </CardContent>
      </Card>
    </div>
  );
}
