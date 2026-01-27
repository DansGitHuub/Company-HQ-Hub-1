import React, { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Search, Plus, Settings, Trash2, Edit, Package, ChevronRight, ChevronLeft, Image as ImageIcon, FolderPlus, X, Check, ArrowRight, Upload, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Material, MaterialCategory, CategoryField } from "@shared/schema";

type WizardStep = "name" | "category" | "fields" | "images" | "preview";

export default function Materials() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAdmin = user?.role === "Admin";
  
  // State
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("materials");
  
  // Dialogs
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [showMaterialDetail, setShowMaterialDetail] = useState<Material | null>(null);
  const [editingCategory, setEditingCategory] = useState<MaterialCategory | null>(null);
  const [editingField, setEditingField] = useState<CategoryField | null>(null);
  
  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>("name");
  const [wizardData, setWizardData] = useState({
    name: "",
    categoryId: "",
    status: "Active",
    description: "",
    vendor: "",
    unitOfMeasure: "",
    primaryImage: "",
    galleryImages: [] as string[],
    tags: [] as string[],
    fieldValues: {} as Record<string, string>,
  });

  // Queries
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

  // Sorted categories (alphabetically)
  const sortedCategories = useMemo(() => 
    [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchesSearch = search === "" || 
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.vendor && m.vendor.toLowerCase().includes(search.toLowerCase())) ||
        (m.tags && m.tags.some(t => t.toLowerCase().includes(search.toLowerCase())));
      
      const matchesCategory = categoryFilter === "all" || m.categoryId === categoryFilter;
      const matchesStatus = statusFilter === "all" || m.status === statusFilter;
      
      return matchesSearch && matchesCategory && matchesStatus;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, search, categoryFilter, statusFilter]);

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/material-categories", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories"] });
      toast({ title: "Category created successfully" });
      setShowCategoryDialog(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/material-categories/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories"] });
      toast({ title: "Category updated successfully" });
      setEditingCategory(null);
      setShowCategoryDialog(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async ({ id, deleteWithMaterials }: { id: string; deleteWithMaterials: boolean }) => {
      const params = deleteWithMaterials ? "?deleteWithMaterials=true" : "";
      const res = await apiRequest("DELETE", `/api/material-categories/${id}${params}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: "Category deleted successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
        galleryImages: data.galleryImages,
        tags: data.tags,
      });
      const material = await res.json();
      
      // Save field values
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
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createFieldMutation = useMutation({
    mutationFn: async (data: { categoryIds: string[]; field: Partial<CategoryField> }) => {
      const res = await apiRequest("POST", "/api/category-fields", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories"] });
      toast({ title: "Field created successfully" });
      setShowFieldDialog(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
      galleryImages: [],
      tags: [],
      fieldValues: {},
    });
  };

  const canProceed = (step: WizardStep) => {
    switch (step) {
      case "name": return wizardData.name.trim().length > 0;
      case "category": return wizardData.categoryId !== "";
      case "fields": {
        const requiredFields = categoryFields.filter(f => f.required && !f.isHidden);
        return requiredFields.every(f => wizardData.fieldValues[f.id]?.trim());
      }
      case "images": return true;
      case "preview": return true;
      default: return false;
    }
  };

  const nextStep = () => {
    const steps: WizardStep[] = ["name", "category", "fields", "images", "preview"];
    const currentIndex = steps.indexOf(wizardStep);
    if (currentIndex < steps.length - 1) {
      setWizardStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: WizardStep[] = ["name", "category", "fields", "images", "preview"];
    const currentIndex = steps.indexOf(wizardStep);
    if (currentIndex > 0) {
      setWizardStep(steps[currentIndex - 1]);
    }
  };

  const getCategoryMaterialCount = (categoryId: string) => {
    return materials.filter(m => m.categoryId === categoryId).length;
  };

  // Render field input based on type
  const renderFieldInput = (field: CategoryField) => {
    const value = wizardData.fieldValues[field.id] || field.defaultValue || "";
    
    switch (field.fieldType) {
      case "textarea":
        return (
          <Textarea
            value={value}
            onChange={(e) => setWizardData(prev => ({
              ...prev,
              fieldValues: { ...prev.fieldValues, [field.id]: e.target.value }
            }))}
            placeholder={field.helpText || ""}
            data-testid={`input-field-${field.id}`}
          />
        );
      case "dropdown":
        return (
          <Select
            value={value}
            onValueChange={(v) => setWizardData(prev => ({
              ...prev,
              fieldValues: { ...prev.fieldValues, [field.id]: v }
            }))}
          >
            <SelectTrigger data-testid={`select-field-${field.id}`}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={value === "true"}
              onCheckedChange={(checked) => setWizardData(prev => ({
                ...prev,
                fieldValues: { ...prev.fieldValues, [field.id]: checked ? "true" : "false" }
              }))}
              data-testid={`checkbox-field-${field.id}`}
            />
            <span className="text-sm">{field.helpText || "Yes"}</span>
          </div>
        );
      case "number":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setWizardData(prev => ({
              ...prev,
              fieldValues: { ...prev.fieldValues, [field.id]: e.target.value }
            }))}
            placeholder={field.helpText || ""}
            data-testid={`input-field-${field.id}`}
          />
        );
      default:
        return (
          <Input
            value={value}
            onChange={(e) => setWizardData(prev => ({
              ...prev,
              fieldValues: { ...prev.fieldValues, [field.id]: e.target.value }
            }))}
            placeholder={field.helpText || ""}
            data-testid={`input-field-${field.id}`}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Materials Catalog</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Manage materials, categories, and custom fields" : "Browse available materials"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAddWizard(true)} data-testid="button-add-material">
            <Plus className="w-4 h-4 mr-2" /> Add Material
          </Button>
        )}
      </div>

      {/* Admin Tabs */}
      {isAdmin && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="materials" data-testid="tab-materials">Materials</TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">Categories</TabsTrigger>
            <TabsTrigger value="fields" data-testid="tab-fields">Category Fields</TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
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
                      <div>
                        <span className="font-medium">{cat.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {getCategoryMaterialCount(cat.id)} materials
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => { setEditingCategory(cat); setShowCategoryDialog(true); }}
                          data-testid={`button-edit-category-${cat.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`button-delete-category-${cat.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Category: {cat.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {getCategoryMaterialCount(cat.id) > 0 
                                  ? `This category has ${getCategoryMaterialCount(cat.id)} materials. They will also be deleted.`
                                  : "This action cannot be undone."
                                }
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteCategoryMutation.mutate({ id: cat.id, deleteWithMaterials: true })}
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
                  <p className="text-muted-foreground text-center py-8">No categories yet. Add one to get started!</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Fields Tab */}
          <TabsContent value="fields" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Category-Specific Fields</h2>
                <Button onClick={() => { setEditingField(null); setShowFieldDialog(true); }} data-testid="button-add-field">
                  <Plus className="w-4 h-4 mr-2" /> Add Field
                </Button>
              </div>
              
              {sortedCategories.map(cat => (
                <FieldsForCategory key={cat.id} category={cat} />
              ))}
            </div>
          </TabsContent>

          {/* Materials Tab */}
          <TabsContent value="materials" className="mt-4">
            <MaterialsGrid 
              materials={filteredMaterials}
              categories={sortedCategories}
              search={search}
              setSearch={setSearch}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              onSelectMaterial={setShowMaterialDetail}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Non-admin view */}
      {!isAdmin && (
        <MaterialsGrid 
          materials={filteredMaterials}
          categories={sortedCategories}
          search={search}
          setSearch={setSearch}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onSelectMaterial={setShowMaterialDetail}
        />
      )}

      {/* Category Add/Edit Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
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

      {/* Field Add Dialog */}
      <Dialog open={showFieldDialog} onOpenChange={setShowFieldDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Category Field</DialogTitle>
            <DialogDescription>Define a field that will appear for materials in selected categories.</DialogDescription>
          </DialogHeader>
          <FieldForm 
            categories={sortedCategories}
            onSubmit={(data) => createFieldMutation.mutate(data)}
            isPending={createFieldMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Smart Add Material Wizard */}
      <Dialog open={showAddWizard} onOpenChange={(open) => { if (!open) resetWizard(); setShowAddWizard(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Material</DialogTitle>
            <DialogDescription>
              Step {["name", "category", "fields", "images", "preview"].indexOf(wizardStep) + 1} of 5: {
                wizardStep === "name" ? "Material Name" :
                wizardStep === "category" ? "Select Category" :
                wizardStep === "fields" ? "Category Fields" :
                wizardStep === "images" ? "Upload Images" :
                "Preview & Confirm"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Step 1: Name */}
            {wizardStep === "name" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="material-name">Material Name *</Label>
                  <Input
                    id="material-name"
                    value={wizardData.name}
                    onChange={(e) => setWizardData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., #57 Limestone Gravel"
                    data-testid="input-material-name"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Category */}
            {wizardStep === "category" && (
              <div className="space-y-4">
                <Label>Select Category *</Label>
                <Select
                  value={wizardData.categoryId}
                  onValueChange={(v) => setWizardData(prev => ({ ...prev, categoryId: v, fieldValues: {} }))}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Choose a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Step 3: Fields */}
            {wizardStep === "fields" && (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                <p className="text-sm text-muted-foreground">
                  Fill in the fields for {selectedCategory?.name}
                </p>
                {categoryFields.filter(f => !f.isHidden).map(field => (
                  <div key={field.id} className="space-y-1">
                    <Label>
                      {field.fieldName}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {renderFieldInput(field)}
                    {field.helpText && (
                      <p className="text-xs text-muted-foreground">{field.helpText}</p>
                    )}
                  </div>
                ))}
                {categoryFields.filter(f => !f.isHidden).length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    No custom fields defined for this category.
                  </p>
                )}
              </div>
            )}

            {/* Step 4: Images */}
            {wizardStep === "images" && (
              <div className="space-y-4">
                <div>
                  <Label>Primary Image URL (optional)</Label>
                  <Input
                    value={wizardData.primaryImage}
                    onChange={(e) => setWizardData(prev => ({ ...prev, primaryImage: e.target.value }))}
                    placeholder="https://..."
                    data-testid="input-primary-image"
                  />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={wizardData.description}
                    onChange={(e) => setWizardData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Material description..."
                    data-testid="input-description"
                  />
                </div>
                <div>
                  <Label>Vendor/Supplier (optional)</Label>
                  <Input
                    value={wizardData.vendor}
                    onChange={(e) => setWizardData(prev => ({ ...prev, vendor: e.target.value }))}
                    placeholder="Supplier name"
                    data-testid="input-vendor"
                  />
                </div>
                <div>
                  <Label>Unit of Measure (optional)</Label>
                  <Input
                    value={wizardData.unitOfMeasure}
                    onChange={(e) => setWizardData(prev => ({ ...prev, unitOfMeasure: e.target.value }))}
                    placeholder="e.g., yard, bag, each"
                    data-testid="input-unit"
                  />
                </div>
              </div>
            )}

            {/* Step 5: Preview */}
            {wizardStep === "preview" && (
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="flex gap-4">
                    {wizardData.primaryImage ? (
                      <img src={wizardData.primaryImage} className="w-24 h-24 object-cover rounded" alt="Preview" />
                    ) : (
                      <div className="w-24 h-24 bg-secondary rounded flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-lg">{wizardData.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedCategory?.name}</p>
                      {wizardData.vendor && <p className="text-sm">Vendor: {wizardData.vendor}</p>}
                      {wizardData.unitOfMeasure && <p className="text-sm">Unit: {wizardData.unitOfMeasure}</p>}
                    </div>
                  </div>
                  {wizardData.description && (
                    <p className="mt-2 text-sm">{wizardData.description}</p>
                  )}
                  {Object.keys(wizardData.fieldValues).length > 0 && (
                    <div className="mt-4 space-y-1">
                      <p className="font-medium text-sm">Custom Fields:</p>
                      {categoryFields.filter(f => wizardData.fieldValues[f.id]).map(field => (
                        <p key={field.id} className="text-sm">
                          <span className="text-muted-foreground">{field.fieldName}:</span> {wizardData.fieldValues[field.id]}
                        </p>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {wizardStep !== "name" && (
                <Button variant="outline" onClick={prevStep}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowAddWizard(false)}>Cancel</Button>
              {wizardStep !== "preview" ? (
                <Button onClick={nextStep} disabled={!canProceed(wizardStep)} data-testid="button-next-step">
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button 
                  onClick={() => createMaterialMutation.mutate(wizardData)} 
                  disabled={createMaterialMutation.isPending}
                  data-testid="button-confirm-save"
                >
                  <Check className="w-4 h-4 mr-1" /> Confirm & Save
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material Detail Dialog */}
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

// Sub-components

function CategoryForm({ 
  initial, 
  onSubmit, 
  isPending 
}: { 
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

function FieldForm({
  categories,
  onSubmit,
  isPending,
}: {
  categories: MaterialCategory[];
  onSubmit: (data: { categoryIds: string[]; field: any }) => void;
  isPending: boolean;
}) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<string>("text");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState("");
  const [helpText, setHelpText] = useState("");
  const [showInPublic, setShowInPublic] = useState(true);

  const handleSubmit = () => {
    const optionsArray = fieldType === "dropdown" || fieldType === "multiselect" 
      ? options.split("\n").map(o => o.trim()).filter(Boolean)
      : null;
    
    onSubmit({
      categoryIds: selectedCategories,
      field: {
        fieldName,
        fieldType,
        required,
        options: optionsArray,
        helpText: helpText || null,
        showInPublicCatalog: showInPublic,
      },
    });
  };

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto">
      <div>
        <Label>Apply to Categories</Label>
        <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto border rounded p-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-2">
              <Checkbox
                checked={selectedCategories.includes(cat.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedCategories(prev => [...prev, cat.id]);
                  } else {
                    setSelectedCategories(prev => prev.filter(id => id !== cat.id));
                  }
                }}
              />
              <span className="text-sm">{cat.name}</span>
            </div>
          ))}
        </div>
        <Button 
          variant="link" 
          size="sm" 
          className="p-0 h-auto" 
          onClick={() => setSelectedCategories(categories.map(c => c.id))}
        >
          Select All
        </Button>
      </div>

      <div>
        <Label htmlFor="field-name">Field Name</Label>
        <Input
          id="field-name"
          value={fieldName}
          onChange={(e) => setFieldName(e.target.value)}
          placeholder="e.g., Material Type"
          data-testid="input-field-name"
        />
      </div>

      <div>
        <Label>Field Type</Label>
        <Select value={fieldType} onValueChange={setFieldType}>
          <SelectTrigger data-testid="select-field-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="textarea">Text Area</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="dropdown">Dropdown</SelectItem>
            <SelectItem value="multiselect">Multi-select</SelectItem>
            <SelectItem value="boolean">Yes/No</SelectItem>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="url">URL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(fieldType === "dropdown" || fieldType === "multiselect") && (
        <div>
          <Label>Options (one per line)</Label>
          <Textarea
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder="Option 1&#10;Option 2&#10;Option 3"
            rows={4}
          />
        </div>
      )}

      <div>
        <Label>Help Text (optional)</Label>
        <Input
          value={helpText}
          onChange={(e) => setHelpText(e.target.value)}
          placeholder="Helpful hint for users"
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox checked={required} onCheckedChange={(c) => setRequired(!!c)} />
          <span className="text-sm">Required</span>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={showInPublic} onCheckedChange={(c) => setShowInPublic(!!c)} />
          <span className="text-sm">Show in public catalog</span>
        </div>
      </div>

      <DialogFooter>
        <Button 
          onClick={handleSubmit} 
          disabled={!fieldName.trim() || selectedCategories.length === 0 || isPending}
          data-testid="button-save-field"
        >
          {isPending ? "Creating..." : "Create Field"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function FieldsForCategory({ category }: { category: MaterialCategory }) {
  const { data: fields = [] } = useQuery<CategoryField[]>({
    queryKey: ["/api/material-categories", category.id, "fields"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const visibleFields = fields.filter(f => !f.isHidden);

  if (visibleFields.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="font-medium">{category.name}</h3>
        <p className="text-sm text-muted-foreground">No fields defined</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-medium mb-2">{category.name}</h3>
      <div className="space-y-1">
        {visibleFields.map(field => (
          <div key={field.id} className="flex items-center gap-2 text-sm">
            <Badge variant="outline">{field.fieldType}</Badge>
            <span>{field.fieldName}</span>
            {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function MaterialsGrid({
  materials,
  categories,
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  onSelectMaterial,
}: {
  materials: Material[];
  categories: MaterialCategory[];
  search: string;
  setSearch: (s: string) => void;
  categoryFilter: string;
  setCategoryFilter: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  onSelectMaterial: (m: Material) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Filters */}
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
          <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {materials.map(material => (
          <Card 
            key={material.id} 
            className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onSelectMaterial(material)}
            data-testid={`card-material-${material.id}`}
          >
            <div className="h-32 bg-secondary relative">
              {material.primaryImage ? (
                <img src={material.primaryImage} className="w-full h-full object-cover" alt={material.name} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-10 h-10 text-muted-foreground opacity-30" />
                </div>
              )}
              <Badge 
                className="absolute top-2 right-2"
                variant={material.status === "Active" ? "default" : "secondary"}
              >
                {material.status}
              </Badge>
            </div>
            <CardContent className="p-3">
              <h3 className="font-semibold truncate">{material.name}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {categories.find(c => c.id === material.categoryId)?.name || "Uncategorized"}
              </p>
              {material.unitOfMeasure && (
                <p className="text-xs text-muted-foreground mt-1">Unit: {material.unitOfMeasure}</p>
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
          <img src={material.primaryImage} className="w-32 h-32 object-cover rounded" alt={material.name} />
        ) : (
          <div className="w-32 h-32 bg-secondary rounded flex items-center justify-center">
            <Package className="w-12 h-12 text-muted-foreground opacity-30" />
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
