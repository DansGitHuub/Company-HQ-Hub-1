import React, { useState } from "react";
import { useApp, SOP } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function SOPs() {
  const { sops, addSOP } = useApp();
  const [search, setSearch] = useState("");
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null);

  const filtered = sops.filter(s => 
    s.title.toLowerCase().includes(search.toLowerCase()) || 
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedSOP) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
        <Button variant="ghost" onClick={() => setSelectedSOP(null)} className="pl-0 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </Button>
        
        <div className="space-y-4">
          <div className="flex items-start justify-between">
             <div>
               <Badge variant="outline" className="mb-2">{selectedSOP.category}</Badge>
               <h1 className="text-4xl font-heading font-bold text-primary">{selectedSOP.title}</h1>
               <p className="text-sm text-muted-foreground mt-2">Last updated: {selectedSOP.lastUpdated}</p>
             </div>
             <Button variant="outline">Edit SOP</Button>
          </div>
          
          <Card className="min-h-[60vh]">
            <CardContent className="p-8 prose prose-slate max-w-none">
              <div dangerouslySetInnerHTML={{ __html: selectedSOP.content }} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">SOP Library</h1>
          <p className="text-muted-foreground">Standard Operating Procedures & Knowledge Base</p>
        </div>
        <NewSOPDialog />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search procedures..." 
          className="pl-9 max-w-md bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(sop => (
          <Card 
            key={sop.id} 
            className="group hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-primary/0 hover:border-l-primary"
            onClick={() => setSelectedSOP(sop)}
          >
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <Badge variant="secondary">{sop.category}</Badge>
                <span className="text-xs text-muted-foreground">{sop.lastUpdated}</span>
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">{sop.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {sop.content.replace(/<[^>]*>?/gm, '')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewSOPDialog() {
  const { addSOP } = useApp();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit } = useForm<Omit<SOP, "id" | "lastUpdated">>();

  const onSubmit = (data: Omit<SOP, "id" | "lastUpdated">) => {
    addSOP(data);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> New SOP
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Procedure</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Title</label>
            <Input {...register("title", { required: true })} placeholder="e.g. Morning Safety Check" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Category</label>
            <Input {...register("category", { required: true })} placeholder="e.g. Operations" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Content (HTML allowed)</label>
            <Textarea 
              {...register("content", { required: true })} 
              className="h-40 font-mono text-sm" 
              placeholder="Step 1: ..." 
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create SOP</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
