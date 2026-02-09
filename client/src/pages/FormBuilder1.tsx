import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormInput } from "lucide-react";

export default function FormBuilder1() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FormInput className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-form-builder-1-title">Form Builder 1</h1>
          <p className="text-muted-foreground">Create and manage custom forms</p>
        </div>
      </div>

      <Card data-testid="card-form-builder-1-placeholder">
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Your custom form builder workspace. Start building forms here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
