import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Upload, Sparkles, Loader2, Image as ImageIcon, Calculator, FileSpreadsheet, X, Package, Truck, Scale, Ruler } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Material } from "@shared/schema";

const MATERIAL_TYPES = [
  "Aggregates",
  "Mulch", 
  "Plants",
  "Hardscape",
  "Soil",
  "Fertilizer",
  "Tools",
  "Miscellaneous"
];

export default function Materials() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const { toast } = useToast();

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const refreshMaterials = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
  };

  const isInternal = user?.role !== "Customer";

  const filtered = materials.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.category.toLowerCase().includes(search.toLowerCase()) ||
    (m.sku && m.sku.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Materials Catalog</h1>
          <p className="text-muted-foreground">
            {isInternal ? "Inventory, Suppliers & Specifications" : "Available Materials & Info"}
          </p>
        </div>
        {isInternal && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulkImport(true)} data-testid="button-bulk-import">
              <FileSpreadsheet className="w-4 h-4 mr-2"/> Bulk Import
            </Button>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-material">
              <Sparkles className="w-4 h-4 mr-2"/> Smart Add Material
            </Button>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search materials by name, category, or SKU..." 
          className="pl-9 max-w-md bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-material-search"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.map(item => (
          <Card 
            key={item.id} 
            className="overflow-hidden group hover:shadow-lg transition-all cursor-pointer"
            onClick={() => setSelectedMaterial(item)}
            data-testid={`card-material-${item.id}`}
          >
            <div className="h-40 bg-secondary relative">
              {item.image && <img src={item.image} className="w-full h-full object-cover" alt={item.name}/>}
              {!item.image && (
                <div className="w-full h-full flex items-center justify-center bg-secondary/50 text-muted-foreground">
                  <Package className="h-12 w-12 opacity-30" />
                </div>
              )}
              <div className="absolute top-2 right-2">
                <Badge variant={item.stock < 10 ? "destructive" : "secondary"}>
                  {item.stock} {item.unit}
                </Badge>
              </div>
            </div>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <Badge variant="outline" className="mb-2">{item.category}</Badge>
                <span className="text-xs font-mono text-muted-foreground">{item.sku}</span>
              </div>
              <CardTitle className="text-lg">{item.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {item.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
              )}
              <div className="flex gap-4 text-xs text-muted-foreground">
                {item.weight && (
                  <span className="flex items-center gap-1">
                    <Scale className="h-3 w-3" /> {item.weight} {item.weightUnit || 'lbs'}
                  </span>
                )}
                {item.coverageArea && (
                  <span className="flex items-center gap-1">
                    <Ruler className="h-3 w-3" /> {item.coverageArea} {item.coverageUnit || 'sq ft'}
                  </span>
                )}
              </div>
            </CardContent>
            <CardFooter className="bg-secondary/20 p-3">
              <Button variant="ghost" size="sm" className="w-full" data-testid={`button-view-material-${item.id}`}>
                View Details
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p>No materials found</p>
        </div>
      )}

      {/* Smart Add Material Dialog */}
      <SmartAddMaterialDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          refreshMaterials();
          setShowAddDialog(false);
        }}
      />

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        onSuccess={() => {
          refreshMaterials();
          setShowBulkImport(false);
        }}
      />

      {/* Material Details Dialog */}
      <MaterialDetailsDialog
        material={selectedMaterial}
        open={!!selectedMaterial}
        onOpenChange={(open) => !open && setSelectedMaterial(null)}
        isInternal={isInternal}
      />
    </div>
  );
}

function SmartAddMaterialDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [materialType, setMaterialType] = useState("");
  const [name, setName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const { toast } = useToast();

  const resetForm = () => {
    setStep(1);
    setMaterialType("");
    setName("");
    setFormData({});
    setIsGenerating(false);
    setIsGeneratingImage(false);
  };

  const handleGenerateAI = async () => {
    if (!name.trim()) {
      toast({ title: "Please enter a material name", variant: "destructive" });
      return;
    }
    
    setIsGenerating(true);
    try {
      const response = await apiRequest("POST", "/api/materials/ai-draft", {
        materialType,
        name: name.trim()
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        setFormData({
          name: name.trim(),
          materialType: materialType || data.data.suggestedCategory,
          category: data.data.suggestedCategory || materialType || "Miscellaneous",
          sku: data.data.suggestedSku || generateSku(name, materialType),
          unit: data.data.suggestedUnit || "each",
          stock: 0,
          description: data.data.description,
          weight: data.data.weight,
          weightUnit: data.data.weightUnit || "lbs",
          coverageArea: data.data.coverageArea,
          coverageUnit: data.data.coverageUnit,
          calculationFormula: data.data.calculationFormula,
          crewNotes: data.data.crewNotes,
          customerNotes: data.data.customerNotes
        });
        setStep(2);
        toast({ title: "AI generated material info!", description: "Review and adjust the details below." });
      }
    } catch (err) {
      toast({ title: "AI generation failed", description: "Please try again or enter details manually.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    try {
      const response = await apiRequest("POST", "/api/materials/ai-image", {
        name: formData.name,
        materialType: formData.materialType,
        description: formData.description
      });
      const data = await response.json();
      
      if (data.success && data.imageUrl) {
        setFormData({ ...formData, image: data.imageUrl });
        toast({ title: "Image generated!" });
      }
    } catch (err) {
      toast({ title: "Image generation failed", variant: "destructive" });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSave = async () => {
    try {
      await apiRequest("POST", "/api/materials", {
        ...formData,
        aiGenerated: true
      });
      toast({ title: "Material added successfully!" });
      resetForm();
      onSuccess();
    } catch (err) {
      toast({ title: "Failed to save material", variant: "destructive" });
    }
  };

  const generateSku = (name: string, type: string) => {
    const prefix = (type || "MAT").substring(0, 3).toUpperCase();
    const suffix = name.substring(0, 3).toUpperCase();
    const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${suffix}-${num}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Add Material
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? "Enter the material type and name - AI will help fill in the details." : "Review and adjust the generated information."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Material Type</Label>
              <Select value={materialType} onValueChange={setMaterialType}>
                <SelectTrigger data-testid="select-material-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Material Name *</Label>
              <Input 
                placeholder="e.g., Premium Brown Mulch, River Rock 3/4 inch, Tall Fescue Sod"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-material-name"
              />
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 inline mr-1" />
                AI will automatically generate: description, weight, coverage calculations, crew notes, and more based on the material type and name.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="specs">Specs</TabsTrigger>
                <TabsTrigger value="supplier">Supplier</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={formData.name || ""} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={formData.category || ""} onChange={(e) => setFormData({...formData, category: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input value={formData.sku || ""} onChange={(e) => setFormData({...formData, sku: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input value={formData.unit || ""} placeholder="bags, cubic yards, each" onChange={(e) => setFormData({...formData, unit: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={formData.description || ""} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Image</Label>
                  <div className="flex gap-2">
                    {formData.image ? (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
                        <img src={formData.image} alt="Material" className="w-full h-full object-cover" />
                        <button 
                          className="absolute top-1 right-1 bg-black/50 rounded-full p-1"
                          onClick={() => setFormData({...formData, image: undefined})}
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    ) : (
                      <Button variant="outline" onClick={handleGenerateImage} disabled={isGeneratingImage} data-testid="button-generate-image">
                        {isGeneratingImage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
                        {isGeneratingImage ? "Generating..." : "Generate Image with AI"}
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="specs" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Weight</Label>
                    <div className="flex gap-2">
                      <Input type="number" value={formData.weight || ""} onChange={(e) => setFormData({...formData, weight: parseInt(e.target.value) || undefined})} placeholder="40" />
                      <Input value={formData.weightUnit || "lbs"} onChange={(e) => setFormData({...formData, weightUnit: e.target.value})} className="w-24" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Coverage Area</Label>
                    <div className="flex gap-2">
                      <Input type="number" value={formData.coverageArea || ""} onChange={(e) => setFormData({...formData, coverageArea: parseInt(e.target.value) || undefined})} placeholder="8" />
                      <Input value={formData.coverageUnit || "sq ft"} onChange={(e) => setFormData({...formData, coverageUnit: e.target.value})} placeholder="sq ft per bag" className="flex-1" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" /> Calculation Formula
                  </Label>
                  <Textarea 
                    value={formData.calculationFormula || ""} 
                    onChange={(e) => setFormData({...formData, calculationFormula: e.target.value})} 
                    placeholder="e.g., Sq ft needed ÷ 8 = number of bags at 3 inch depth"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">This formula helps crews calculate how much material they need.</p>
                </div>
              </TabsContent>

              <TabsContent value="supplier" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  <Truck className="h-4 w-4 inline mr-1" />
                  Supplier info is only visible to crew and managers, not customers.
                </p>
                <div className="space-y-2">
                  <Label>Supplier Name</Label>
                  <Input value={formData.supplier || ""} onChange={(e) => setFormData({...formData, supplier: e.target.value})} placeholder="ABC Landscape Supply" />
                </div>
                <div className="space-y-2">
                  <Label>Supplier Contact</Label>
                  <Input value={formData.supplierContact || ""} onChange={(e) => setFormData({...formData, supplierContact: e.target.value})} placeholder="555-1234" />
                </div>
                <div className="space-y-2">
                  <Label>Supplier Website</Label>
                  <Input value={formData.supplierUrl || ""} onChange={(e) => setFormData({...formData, supplierUrl: e.target.value})} placeholder="https://..." />
                </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Crew Notes</Label>
                  <Textarea 
                    value={formData.crewNotes || ""} 
                    onChange={(e) => setFormData({...formData, crewNotes: e.target.value})} 
                    placeholder="Notes for crew about handling, storage, application..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">Visible to crew and managers only.</p>
                </div>
                <div className="space-y-2">
                  <Label>Customer Notes</Label>
                  <Textarea 
                    value={formData.customerNotes || ""} 
                    onChange={(e) => setFormData({...formData, customerNotes: e.target.value})} 
                    placeholder="Simple tips for customers about this material..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">Visible to everyone including customers.</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleGenerateAI} disabled={isGenerating || !name.trim()} data-testid="button-generate-ai">
                {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {isGenerating ? "Generating..." : "Generate with AI"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleSave} data-testid="button-save-material">
                <Plus className="h-4 w-4 mr-2" /> Save Material
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkImportDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const [importData, setImportData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<{ imported: number; errors: { row: number; error: string }[] } | null>(null);
  const { toast } = useToast();

  const handleImport = async () => {
    try {
      const lines = importData.trim().split('\n');
      if (lines.length < 2) {
        toast({ title: "Please paste data with headers and at least one row", variant: "destructive" });
        return;
      }

      const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
      const materials = lines.slice(1).map(line => {
        const values = line.split('\t');
        const obj: any = {};
        headers.forEach((header, i) => {
          const key = header.replace(/\s+/g, '');
          if (values[i]) obj[key] = values[i].trim();
        });
        return obj;
      }).filter(m => m.name);

      setIsImporting(true);
      const response = await apiRequest("POST", "/api/materials/bulk-import", { materials });
      const data = await response.json();
      setResults(data);
      
      if (data.imported > 0) {
        toast({ title: `Imported ${data.imported} materials` });
        onSuccess();
      }
    } catch (err) {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await apiRequest("GET", "/api/materials/template");
      const template = await response.json();
      
      const csvContent = [
        template.headers.join('\t'),
        Object.values(template.example).join('\t')
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/tab-separated-values' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'materials_template.tsv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Failed to download template", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Bulk Import Materials
          </DialogTitle>
          <DialogDescription>
            Copy and paste data from Excel or download the template to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
              <Upload className="h-4 w-4 mr-2" /> Download Template
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Paste Excel Data (Tab-separated)</Label>
            <Textarea 
              placeholder="Paste your Excel data here. First row should be headers: name, category, sku, unit, stock, materialType, description..."
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              data-testid="textarea-import-data"
            />
          </div>

          {results && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-medium">Import Results: {results.imported} materials imported</p>
              {results.errors.length > 0 && (
                <div className="text-sm text-destructive">
                  <p>Errors:</p>
                  <ul className="list-disc pl-5">
                    {results.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>Row {err.row}: {err.error}</li>
                    ))}
                    {results.errors.length > 5 && <li>...and {results.errors.length - 5} more errors</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleImport} disabled={isImporting || !importData.trim()} data-testid="button-import">
            {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {isImporting ? "Importing..." : "Import Materials"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaterialDetailsDialog({ material, open, onOpenChange, isInternal }: { material: Material | null; open: boolean; onOpenChange: (open: boolean) => void; isInternal: boolean }) {
  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {material.image ? (
              <img src={material.image} alt={material.name} className="w-24 h-24 rounded-lg object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-secondary flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <DialogTitle>{material.name}</DialogTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{material.category}</Badge>
                <Badge variant="secondary">{material.sku}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {material.description && (
            <div>
              <Label className="text-muted-foreground">Description</Label>
              <p className="text-sm">{material.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">In Stock</Label>
              <p className="font-medium">{material.stock} {material.unit}</p>
            </div>
            {material.weight && (
              <div>
                <Label className="text-muted-foreground">Weight</Label>
                <p className="font-medium">{material.weight} {material.weightUnit || 'lbs'}</p>
              </div>
            )}
            {material.coverageArea && (
              <div className="col-span-2">
                <Label className="text-muted-foreground">Coverage</Label>
                <p className="font-medium">{material.coverageArea} {material.coverageUnit}</p>
              </div>
            )}
          </div>

          {material.calculationFormula && (
            <div className="bg-primary/10 p-3 rounded-lg">
              <Label className="text-muted-foreground flex items-center gap-1">
                <Calculator className="h-4 w-4" /> How to Calculate
              </Label>
              <p className="text-sm font-medium mt-1">{material.calculationFormula}</p>
            </div>
          )}

          {material.customerNotes && (
            <div>
              <Label className="text-muted-foreground">Tips</Label>
              <p className="text-sm">{material.customerNotes}</p>
            </div>
          )}

          {/* Internal-only info */}
          {isInternal && (
            <>
              {material.crewNotes && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground">Crew Notes</Label>
                  <p className="text-sm">{material.crewNotes}</p>
                </div>
              )}
              
              {material.supplier && (
                <div className="bg-secondary/50 p-3 rounded-lg">
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <Truck className="h-4 w-4" /> Supplier Info (Internal Only)
                  </Label>
                  <p className="font-medium mt-1">{material.supplier}</p>
                  {material.supplierContact && <p className="text-sm text-muted-foreground">{material.supplierContact}</p>}
                  {material.supplierUrl && (
                    <a href={material.supplierUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      Visit Supplier Website
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
