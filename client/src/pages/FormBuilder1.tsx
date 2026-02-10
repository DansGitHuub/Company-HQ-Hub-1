import { FormInput } from "lucide-react";

export default function FormBuilder1() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center" data-testid="form-builder-1-page">
      <FormInput className="w-16 h-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-semibold mb-2">Form Builder 1</h2>
      <p className="text-muted-foreground max-w-md">
        This tab is ready to use. A form builder module can be added here.
      </p>
    </div>
  );
}
