import AgreementTemplatesPanel from "@/components/admin/AgreementTemplatesPanel";
import { useAuth } from "@/hooks/use-auth";
import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AgreementTemplatesPage() {
  const { user } = useAuth();
  if (user?.role !== "Admin") {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md text-center p-8">
          <CardContent>
            <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You need Admin privileges to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-4 max-w-5xl mx-auto p-6">
      <AgreementTemplatesPanel />
    </div>
  );
}
