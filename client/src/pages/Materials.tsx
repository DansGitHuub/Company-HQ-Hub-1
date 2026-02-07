import React, { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Plus, Trash2, Edit, Package, ChevronRight, ChevronLeft, FolderPlus, Check, Sparkles, Loader2, FolderInput, CheckSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showErrorToast } from "@/lib/errorToast";
import type { Material, MaterialCategory, CategoryField } from "@shared/schema";

type WizardStep = "name" | "category" | "ai-fill" | "review" | "confirm";

export default function Materials() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAdmin = user?.role === "Admin";
  
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("materials");
  
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showMaterialDetail, setShowMaterialDetail] = useState<Material | null>(null);
  const [showEditMaterial, setShowEditMaterial] = useState<Material | null>(null);
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MaterialCategory | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  
  const [wizardStep, setWizardStep] = useState<WizardStep>("name");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [wizardData, setWizardData] = useState({
    name: "",
    categoryId: "",
    status: "Active",
    description: "",
    vendor: "",
    unitOfMeasure: "",
    primaryImage: "",
    fieldValues: {} as Record<string, string>,
  });

  const { data: categories = [] } = useQuery<MaterialCategory[]>({
    queryKey: ["/api/material-categories"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const selectedCategory = categories.find(c => c.id === wizardData.categoryId);

  const { data: categoryFields = [] } = useQuery<CategoryField[]>({
    queryKey: ["/api/material-categories", wizardData.categoryId, "fields"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!wizardData.categoryId,
  });

  const sortedCategories = useMemo(() => 
    [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchesSearch = search === "" || 
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.vendor && m.vendor.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = categoryFilter === "all" || m.categoryId === categoryFilter;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, search, categoryFilter]);

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/material-categories", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories"] });
      toast({ title: "Category created" });
      setShowCategoryDialog(false);
    },
    onError: (err: any) => {
      showErrorToast(err, "Error");
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/material-categories/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories"] });
      toast({ title: "Category updated" });
      setEditingCategory(null);
      setShowCategoryDialog(false);
    },
    onError: (err: any) => {
      showErrorToast(err, "Error");
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/material-categories/${id}?deleteWithMaterials=true`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: "Category deleted" });
    },
    onError: (err: any) => {
      showErrorToast(err, "Error");
    },
  });

  const createMaterialMutation = useMutation({
    mutationFn: async (data: typeof wizardData) => {
      const res = await apiRequest("POST", "/api/materials", {
        name: data.name,
        categoryId: data.categoryId,
        status: data.status,
        description: data.description,
        vendor: data.vendor,
        unitOfMeasure: data.unitOfMeasure,
        primaryImage: data.primaryImage || null,
      });
      const material = await res.json();
      
      if (Object.keys(data.fieldValues).length > 0) {
        await apiRequest("POST", `/api/materials/${material.id}/field-values`, {
          fieldValues: data.fieldValues,
        });
      }
      return material;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: "Material created successfully" });
      setShowAddWizard(false);
      resetWizard();
    },
    onError: (err: any) => {
      showErrorToast(err, "Error");
    },
  });

  const updateMaterialMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Material>) => {
      const res = await apiRequest("PATCH", `/api/materials/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: "Material updated" });
      setShowEditMaterial(null);
    },
    onError: (err: any) => {
      showErrorToast(err, "Error");
    },
  });

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ materialIds, targetCategoryId }: { materialIds: string[]; targetCategoryId: string }) => {
      const promises = materialIds.map(id => 
        apiRequest("PATCH", `/api/materials/${id}`, { categoryId: targetCategoryId })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: `Moved ${selectedMaterials.size} materials` });
      setSelectedMaterials(new Set());
      setShowBulkMove(false);
    },
    onError: (err: any) => {
      showErrorToast(err, "Error");
    },
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/materials/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: "Material deleted" });
    },
    onError: (err: any) => {
      showErrorToast(err, "Error");
    },
  });

  const resetWizard = () => {
    setWizardStep("name");
    setWizardData({
      name: "",
      categoryId: "",
      status: "Active",
      description: "",
      vendor: "",
      unitOfMeasure: "",
      primaryImage: "",
      fieldValues: {},
    });
    setIsAiLoading(false);
  };

  const generateAiContent = async () => {
    if (!wizardData.name || !selectedCategory) return;
    
    setIsAiLoading(true);
    try {
      const res = await apiRequest("POST", "/api/materials/ai-generate", {
        name: wizardData.name,
        category: selectedCategory.name,
      });
      const data = await res.json();
      
      setWizardData(prev => ({
        ...prev,
        description: data.description || prev.description,
        unitOfMeasure: data.unitOfMeasure || prev.unitOfMeasure,
        vendor: data.vendor || prev.vendor,
        fieldValues: { ...prev.fieldValues, ...data.fieldValues },
      }));
      
      toast({ title: "AI filled material details" });
    } catch (err: any) {
      showErrorToast(err, "AI generation failed");
    } finally {
      setIsAiLoading(false);
    }
  };

  const canProceed = (step: WizardStep) => {
    switch (step) {
      case "name": return wizardData.name.trim().length > 0;
      case "category": return wizardData.categoryId !== "";
      case "ai-fill": return true;
      case "review": return true;
      case "confirm": return true;
      default: return false;
    }
  };

  const nextStep = () => {
    const steps: WizardStep[] = ["name", "category", "ai-fill", "review", "confirm"];
    const currentIndex = steps.indexOf(wizardStep);
    if (currentIndex < steps.length - 1) {
      const next = steps[currentIndex + 1];
      setWizardStep(next);
      if (next === "ai-fill") {
        generateAiContent();
      }
    }
  };

  const prevStep = () => {
    const steps: WizardStep[] = ["name", "category", "ai-fill", "review", "confirm"];
    const currentIndex = steps.indexOf(wizardStep);
    if (currentIndex > 0) {
      setWizardStep(steps[currentIndex - 1]);
    }
  };

  const getCategoryMaterialCount = (categoryId: string) => {
    return materials.filter(m => m.categoryId === categoryId).length;
  };

  const toggleMaterialSelection = (id: string) => {
    const newSelection = new Set(selectedMaterials);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedMaterials(newSelection);
  };

  const selectAllVisible = () => {
    const allIds = new Set(filteredMaterials.map(m => m.id));
    setSelectedMaterials(allIds);
  };

  const clearSelection = () => {
    setSelectedMaterials(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Materials Catalog</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Manage materials and categories" : "Browse materials"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAddWizard(true)} data-testid="button-add-material">
            <Sparkles className="w-4 h-4 mr-2" /> Add Material with AI
          </Button>
        )}
      </div>

      {isAdmin && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="materials" data-testid="tab-materials">Materials</TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Material Categories</h2>
                <Button onClick={() => { setEditingCategory(null); setShowCategoryDialog(true); }} data-testid="button-add-category">
                  <FolderPlus className="w-4 h-4 mr-2" /> Add Category
                </Button>
              </div>
              
              <div className="grid gap-2">
                {sortedCategories.map(cat => (
                  <Card key={cat.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{cat.name}</span>
                        <Badge variant="secondary">
                          {getCategoryMaterialCount(cat.id)} materials
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => { setEditingCategory(cat); setShowCategoryDialog(true); }}
                          data-testid={`button-edit-category-${cat.id}`}
                        >
                          <Edit className="w-4 h-4 mr-1" /> Rename
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" data-testid={`button-delete-category-${cat.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete "{cat.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {getCategoryMaterialCount(cat.id) > 0 
                                  ? `This will also delete ${getCategoryMaterialCount(cat.id)} materials in this category.`
                                  : "This action cannot be undone."
                                }
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteCategoryMutation.mutate(cat.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </Card>
                ))}
                {sortedCategories.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">No categories yet.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="materials" className="mt-4">
            <MaterialsGrid 
              materials={filteredMaterials}
              categories={sortedCategories}
              search={search}
              setSearch={setSearch}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              selectedMaterials={selectedMaterials}
              toggleSelection={toggleMaterialSelection}
              selectAll={selectAllVisible}
              clearSelection={clearSelection}
              onSelectMaterial={setShowMaterialDetail}
              onEditMaterial={setShowEditMaterial}
              onBulkMove={() => setShowBulkMove(true)}
              onDeleteMaterial={(id) => deleteMaterialMutation.mutate(id)}
              isAdmin={isAdmin}
            />
          </TabsContent>
        </Tabs>
      )}

      {!isAdmin && (
        <MaterialsGrid 
          materials={filteredMaterials}
          categories={sortedCategories}
          search={search}
          setSearch={setSearch}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          selectedMaterials={selectedMaterials}
          toggleSelection={toggleMaterialSelection}
          selectAll={selectAllVisible}
          clearSelection={clearSelection}
          onSelectMaterial={setShowMaterialDetail}
          onEditMaterial={() => {}}
          onBulkMove={() => {}}
          onDeleteMaterial={() => {}}
          isAdmin={false}
        />
      )}

      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Rename Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <CategoryForm 
            initial={editingCategory}
            onSubmit={(name) => {
              if (editingCategory) {
                updateCategoryMutation.mutate({ id: editingCategory.id, name });
              } else {
                createCategoryMutation.mutate(name);
              }
            }}
            isPending={createCategoryMutation.isPending || updateCategoryMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showAddWizard} onOpenChange={(open) => { if (!open) resetWizard(); setShowAddWizard(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Add New Material
            </DialogTitle>
            <DialogDescription>
              Step {["name", "category", "ai-fill", "review", "confirm"].indexOf(wizardStep) + 1} of 5: {
                wizardStep === "name" ? "Material Name" :
                wizardStep === "category" ? "Select Category" :
                wizardStep === "ai-fill" ? "AI Auto-Fill" :
                wizardStep === "review" ? "Review & Edit" :
                "Confirm & Save"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 min-h-[200px]">
            {wizardStep === "name" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="material-name">What material do you want to add?</Label>
                  <Input
                    id="material-name"
                    value={wizardData.name}
                    onChange={(e) => setWizardData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., #57 Limestone Gravel, Brown Mulch, Red Maple Tree"
                    className="mt-2"
                    data-testid="input-material-name"
                    autoFocus
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Enter the name of the material. AI will help fill in the details based on the category.
                  </p>
                </div>
              </div>
            )}

            {wizardStep === "category" && (
              <div className="space-y-4">
                <Label>Select a category for "{wizardData.name}"</Label>
                <div className="grid grid-cols-2 gap-2">
                  {sortedCategories.map(cat => (
                    <Button
                      key={cat.id}
                      variant={wizardData.categoryId === cat.id ? "default" : "outline"}
                      className="justify-start h-auto py-3"
                      onClick={() => setWizardData(prev => ({ ...prev, categoryId: cat.id, fieldValues: {} }))}
                      data-testid={`select-category-${cat.id}`}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === "ai-fill" && (
              <div className="flex flex-col items-center justify-center py-8">
                {isAiLoading ? (
                  <>
                    <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                    <p className="text-lg font-medium">AI is generating details...</p>
                    <p className="text-sm text-muted-foreground">Based on "{wizardData.name}" in {selectedCategory?.name}</p>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-12 h-12 text-primary mb-4" />
                    <p className="text-lg font-medium">Details Generated</p>
                    <p className="text-sm text-muted-foreground">Review and edit on the next step</p>
                  </>
                )}
              </div>
            )}

            {wizardStep === "review" && (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={wizardData.description}
                    onChange={(e) => setWizardData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Material description..."
                    className="mt-1"
                    data-testid="input-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Unit of Measure</Label>
                    <Input
                      value={wizardData.unitOfMeasure}
                      onChange={(e) => setWizardData(prev => ({ ...prev, unitOfMeasure: e.target.value }))}
                      placeholder="e.g., cubic yard, bag, each"
                      className="mt-1"
                      data-testid="input-unit"
                    />
                  </div>
                  <div>
                    <Label>Vendor/Supplier</Label>
                    <Input
                      value={wizardData.vendor}
                      onChange={(e) => setWizardData(prev => ({ ...prev, vendor: e.target.value }))}
                      placeholder="Supplier name"
                      className="mt-1"
                      data-testid="input-vendor"
                    />
                  </div>
                </div>
                {categoryFields.filter(f => !f.isHidden).map(field => (
                  <div key={field.id}>
                    <Label>{field.fieldName}</Label>
                    {field.fieldType === "dropdown" ? (
                      <Select
                        value={wizardData.fieldValues[field.id] || ""}
                        onValueChange={(v) => setWizardData(prev => ({
                          ...prev,
                          fieldValues: { ...prev.fieldValues, [field.id]: v }
                        }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.fieldType === "boolean" ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Checkbox
                          checked={wizardData.fieldValues[field.id] === "true"}
                          onCheckedChange={(checked) => setWizardData(prev => ({
                            ...prev,
                            fieldValues: { ...prev.fieldValues, [field.id]: checked ? "true" : "false" }
                          }))}
                        />
                        <span className="text-sm">{field.helpText || "Yes"}</span>
                      </div>
                    ) : (
                      <Input
                        value={wizardData.fieldValues[field.id] || ""}
                        onChange={(e) => setWizardData(prev => ({
                          ...prev,
                          fieldValues: { ...prev.fieldValues, [field.id]: e.target.value }
                        }))}
                        placeholder={field.helpText || ""}
                        className="mt-1"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {wizardStep === "confirm" && (
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-secondary rounded flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{wizardData.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedCategory?.name}</p>
                      {wizardData.unitOfMeasure && <p className="text-sm">Unit: {wizardData.unitOfMeasure}</p>}
                      {wizardData.vendor && <p className="text-sm">Vendor: {wizardData.vendor}</p>}
                    </div>
                  </div>
                  {wizardData.description && (
                    <p className="mt-3 text-sm border-t pt-3">{wizardData.description}</p>
                  )}
                </Card>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {wizardStep !== "name" && (
                <Button variant="outline" onClick={prevStep} disabled={isAiLoading}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowAddWizard(false)}>Cancel</Button>
              {wizardStep !== "confirm" ? (
                <Button onClick={nextStep} disabled={!canProceed(wizardStep) || isAiLoading} data-testid="button-next-step">
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button 
                  onClick={() => createMaterialMutation.mutate(wizardData)} 
                  disabled={createMaterialMutation.isPending}
                  data-testid="button-confirm-save"
                >
                  <Check className="w-4 h-4 mr-1" /> Save Material
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showEditMaterial} onOpenChange={() => setShowEditMaterial(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Material</DialogTitle>
          </DialogHeader>
          {showEditMaterial && (
            <EditMaterialForm 
              material={showEditMaterial}
              categories={sortedCategories}
              onSave={(updates) => updateMaterialMutation.mutate({ id: showEditMaterial.id, ...updates })}
              isPending={updateMaterialMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkMove} onOpenChange={setShowBulkMove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selectedMaterials.size} Materials</DialogTitle>
            <DialogDescription>Select a category to move the selected materials to.</DialogDescription>
          </DialogHeader>
          <BulkMoveForm 
            categories={sortedCategories}
            onMove={(targetCategoryId) => {
              bulkMoveMutation.mutate({ 
                materialIds: Array.from(selectedMaterials), 
                targetCategoryId 
              });
            }}
            isPending={bulkMoveMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!showMaterialDetail} onOpenChange={() => setShowMaterialDetail(null)}>
        <DialogContent className="max-w-lg">
          {showMaterialDetail && (
            <>
              <DialogHeader>
                <DialogTitle>{showMaterialDetail.name}</DialogTitle>
              </DialogHeader>
              <MaterialDetailView material={showMaterialDetail} categories={categories} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryForm({ initial, onSubmit, isPending }: { 
  initial: MaterialCategory | null; 
  onSubmit: (name: string) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="cat-name">Category Name</Label>
        <Input
          id="cat-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Trees & Shrubs"
          data-testid="input-category-name"
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(name)} disabled={!name.trim() || isPending} data-testid="button-save-category">
          {isPending ? "Saving..." : initial ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function EditMaterialForm({ material, categories, onSave, isPending }: {
  material: Material;
  categories: MaterialCategory[];
  onSave: (updates: Partial<Material>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(material.name);
  const [categoryId, setCategoryId] = useState(material.categoryId || "");
  const [description, setDescription] = useState(material.description || "");
  const [vendor, setVendor] = useState(material.vendor || "");
  const [unitOfMeasure, setUnitOfMeasure] = useState(material.unitOfMeasure || "");
  const [status, setStatus] = useState(material.status);

  return (
    <div className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="edit-material-name" />
      </div>
      <div>
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger data-testid="edit-material-category">
            <SelectValue placeholder="Select category..." />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Unit of Measure</Label>
          <Input value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} />
        </div>
        <div>
          <Label>Vendor</Label>
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button 
          onClick={() => onSave({ name, categoryId, description, vendor, unitOfMeasure, status })} 
          disabled={!name.trim() || isPending}
          data-testid="button-save-material"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function BulkMoveForm({ categories, onMove, isPending }: {
  categories: MaterialCategory[];
  onMove: (categoryId: string) => void;
  isPending: boolean;
}) {
  const [targetCategory, setTargetCategory] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <Label>Target Category</Label>
        <Select value={targetCategory} onValueChange={setTargetCategory}>
          <SelectTrigger data-testid="select-target-category">
            <SelectValue placeholder="Select category..." />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button onClick={() => onMove(targetCategory)} disabled={!targetCategory || isPending}>
          {isPending ? "Moving..." : "Move Materials"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function MaterialsGrid({
  materials,
  categories,
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  selectedMaterials,
  toggleSelection,
  selectAll,
  clearSelection,
  onSelectMaterial,
  onEditMaterial,
  onBulkMove,
  onDeleteMaterial,
  isAdmin,
}: {
  materials: Material[];
  categories: MaterialCategory[];
  search: string;
  setSearch: (s: string) => void;
  categoryFilter: string;
  setCategoryFilter: (s: string) => void;
  selectedMaterials: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  onSelectMaterial: (m: Material) => void;
  onEditMaterial: (m: Material) => void;
  onBulkMove: () => void;
  onDeleteMaterial: (id: string) => void;
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search materials..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-materials"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isAdmin && selectedMaterials.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <CheckSquare className="w-4 h-4" />
          <span className="font-medium">{selectedMaterials.size} selected</span>
          <Button variant="outline" size="sm" onClick={onBulkMove}>
            <FolderInput className="w-4 h-4 mr-1" /> Move to Category
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
        </div>
      )}

      {isAdmin && materials.length > 0 && (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
          {selectedMaterials.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>Clear Selection</Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {materials.map(material => (
          <Card 
            key={material.id} 
            className={`overflow-hidden transition-shadow ${selectedMaterials.has(material.id) ? 'ring-2 ring-primary' : ''}`}
            data-testid={`card-material-${material.id}`}
          >
            <div 
              className="h-28 bg-secondary relative cursor-pointer"
              onClick={() => onSelectMaterial(material)}
            >
              {material.primaryImage ? (
                <img src={material.primaryImage} className="w-full h-full object-cover" alt={material.name} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-10 h-10 text-muted-foreground opacity-30" />
                </div>
              )}
              {isAdmin && (
                <div 
                  className="absolute top-2 left-2"
                  onClick={(e) => { e.stopPropagation(); toggleSelection(material.id); }}
                >
                  <Checkbox checked={selectedMaterials.has(material.id)} />
                </div>
              )}
            </div>
            <CardContent className="p-3">
              <h3 className="font-semibold truncate cursor-pointer" onClick={() => onSelectMaterial(material)}>
                {material.name}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {categories.find(c => c.id === material.categoryId)?.name || "Uncategorized"}
              </p>
              {isAdmin && (
                <div className="flex gap-1 mt-2">
                  <Button variant="ghost" size="sm" onClick={() => onEditMaterial(material)}>
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{material.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDeleteMaterial(material.id)}
                          className="bg-destructive text-destructive-foreground"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {materials.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No materials found</p>
        </div>
      )}
    </div>
  );
}

function MaterialDetailView({ material, categories }: { material: Material; categories: MaterialCategory[] }) {
  const { data: fieldValues = [] } = useQuery({
    queryKey: ["/api/materials", material.id, "field-values"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const category = categories.find(c => c.id === material.categoryId);

  const { data: categoryFields = [] } = useQuery<CategoryField[]>({
    queryKey: ["/api/material-categories", material.categoryId, "fields"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!material.categoryId,
  });

  const getFieldValue = (fieldId: string) => {
    const fv = (fieldValues as any[]).find((v: any) => v.fieldId === fieldId);
    return fv?.value || null;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {material.primaryImage ? (
          <img src={material.primaryImage} className="w-24 h-24 object-cover rounded" alt={material.name} />
        ) : (
          <div className="w-24 h-24 bg-secondary rounded flex items-center justify-center">
            <Package className="w-10 h-10 text-muted-foreground opacity-30" />
          </div>
        )}
        <div>
          <Badge variant={material.status === "Active" ? "default" : "secondary"}>
            {material.status}
          </Badge>
          <p className="text-sm text-muted-foreground mt-1">{category?.name}</p>
          {material.vendor && <p className="text-sm mt-1">Vendor: {material.vendor}</p>}
          {material.unitOfMeasure && <p className="text-sm">Unit: {material.unitOfMeasure}</p>}
        </div>
      </div>

      {material.description && (
        <div>
          <h4 className="font-medium text-sm">Description</h4>
          <p className="text-sm text-muted-foreground">{material.description}</p>
        </div>
      )}

      {categoryFields.length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2">Details</h4>
          <div className="space-y-1">
            {categoryFields.filter(f => !f.isHidden && getFieldValue(f.id)).map(field => (
              <div key={field.id} className="flex gap-2 text-sm">
                <span className="text-muted-foreground">{field.fieldName}:</span>
                <span>{getFieldValue(field.id)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
