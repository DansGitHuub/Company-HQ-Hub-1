// Property setup screen

import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';
import { useState, useMemo, useEffect } from 'react';

export default function PropertySetup() {
  const navigate = useNavigate();
  const { assessment, updateProperty, createNewAssessment } = useAssessment();

  // Local state for form fields before assessment is created
  const [formData, setFormData] = useState({
    propertyName: assessment?.property.propertyName || '',
    address: assessment?.property.address || '',
    inspectionDate: assessment?.property.inspectionDate || new Date().toISOString().split('T')[0],
    inspectorName: assessment?.property.inspectorName || '',
    inspectorEmail: assessment?.property.inspectorEmail || '',
    inspectorPhone: assessment?.property.inspectorPhone || '',
    customerName: assessment?.property.customerName || '',
    customerEmail: assessment?.property.customerEmail || ''
  });

  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Update form data when assessment is loaded (for editing existing assessment)
  useEffect(() => {
    if (assessment) {
      setFormData({
        propertyName: assessment.property.propertyName || '',
        address: assessment.property.address || '',
        inspectionDate: assessment.property.inspectionDate || new Date().toISOString().split('T')[0],
        inspectorName: assessment.property.inspectorName || '',
        inspectorEmail: assessment.property.inspectorEmail || '',
        inspectorPhone: assessment.property.inspectorPhone || '',
        customerName: assessment.property.customerName || '',
        customerEmail: assessment.property.customerEmail || ''
      });
    }
  }, [assessment?.id]); // Only run when assessment ID changes

  // Handle navigation after assessment is created
  useEffect(() => {
    if (pendingNavigation && assessment) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [assessment, pendingNavigation, navigate]);

  // Check if all mandatory fields are filled
  const isFormValid = useMemo(() => {
    return (
      formData.propertyName.trim() !== '' &&
      formData.address.trim() !== '' &&
      formData.inspectionDate.trim() !== '' &&
      formData.inspectorName.trim() !== '' &&
      formData.inspectorEmail.trim() !== '' &&
      formData.inspectorPhone.trim() !== ''
    );
  }, [formData]);

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // If assessment already exists, update it in real-time
    if (assessment) {
      updateProperty({ [field]: value });
    }
  };

  const handleContinue = () => {
    if (!isFormValid) {
      alert('Please fill in all required fields');
      return;
    }

    // If no assessment exists, create one with the form data
    if (!assessment) {
      const assessmentId = createNewAssessment({
        propertyName: formData.propertyName,
        address: formData.address,
        inspectionDate: formData.inspectionDate,
        inspectorName: formData.inspectorName,
        inspectorEmail: formData.inspectorEmail,
        inspectorPhone: formData.inspectorPhone,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail
      });
      // Set pending navigation to happen after assessment is created
      setPendingNavigation(`/assessment/${assessmentId}`);
    } else {
      // Assessment already exists, navigate immediately
      navigate(`/assessment/${assessment.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Property Setup</h1>
            <p className="text-sm text-muted-foreground">Step 1 of 4</p>
          </div>
        </div>

        {/* Form */}
        <Card className="p-6 space-y-6">
          {/* Property Information */}
          <div className="space-y-4">
            <h2 className="font-semibold text-foreground">Property Information</h2>
            
            <div>
              <Label htmlFor="propertyName">Property Name *</Label>
              <Input
                id="propertyName"
                value={formData.propertyName}
                onChange={(e) => handleFieldChange('propertyName', e.target.value)}
                placeholder="Enter property name"
                required
              />
            </div>

            <div>
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                placeholder="Enter property address"
                required
              />
            </div>

            <div>
              <Label htmlFor="inspectionDate">Inspection Date *</Label>
              <Input
                id="inspectionDate"
                type="date"
                value={formData.inspectionDate}
                onChange={(e) => handleFieldChange('inspectionDate', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Inspector Information */}
          <div className="space-y-4">
            <h2 className="font-semibold text-foreground">Inspector Information</h2>
            
            <div>
              <Label htmlFor="inspectorName">Inspector Name *</Label>
              <Input
                id="inspectorName"
                value={formData.inspectorName}
                onChange={(e) => handleFieldChange('inspectorName', e.target.value)}
                placeholder="Enter inspector name"
                required
              />
            </div>

            <div>
              <Label htmlFor="inspectorEmail">Inspector Email *</Label>
              <Input
                id="inspectorEmail"
                type="email"
                value={formData.inspectorEmail}
                onChange={(e) => handleFieldChange('inspectorEmail', e.target.value)}
                placeholder="inspector@example.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="inspectorPhone">Inspector Phone *</Label>
              <Input
                id="inspectorPhone"
                type="tel"
                value={formData.inspectorPhone}
                onChange={(e) => handleFieldChange('inspectorPhone', e.target.value)}
                placeholder="(555) 123-4567"
                required
              />
            </div>
          </div>

          {/* Customer Information (Optional) */}
          <div className="space-y-4">
            <h2 className="font-semibold text-foreground">Customer Information <span className="text-sm text-muted-foreground">(Optional)</span></h2>
            
            <div>
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => handleFieldChange('customerName', e.target.value)}
                placeholder="Enter customer name"
              />
            </div>

            <div>
              <Label htmlFor="customerEmail">Customer Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => handleFieldChange('customerEmail', e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
          </div>
        </Card>

        {/* Continue Button */}
        <Button
          onClick={handleContinue}
          className="w-full h-12"
          disabled={!isFormValid}
        >
          Start Assessment
        </Button>
      </div>
    </div>
  );
}