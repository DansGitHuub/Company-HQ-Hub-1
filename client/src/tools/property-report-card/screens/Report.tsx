// Report screen with PDF generation

import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Download, Mail, Share2 } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';
import { getAssessment } from '../utils/storage';
import { useEffect, useState, useRef } from 'react';
import { Assessment } from '../types';
import { GradeBadge } from '../components/GradeBadge';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

export default function Report() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { loadAssessment } = useAssessment();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      const loaded = getAssessment(id);
      if (loaded) {
        setAssessment(loaded);
      }
    }
  }, [id]);

  if (!assessment) return null;

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    
    setGenerating(true);
    toast.info('Generating PDF...');

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`${assessment.property.propertyName.replace(/\s+/g, '_')}_Assessment.pdf`);
      
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const handleEmailReport = () => {
    const subject = encodeURIComponent(`Landscape Assessment - ${assessment.property.propertyName}`);
    const scoreText = assessment.overallGrade === '-' 
      ? 'In Progress' 
      : `${assessment.overallScore.toFixed(1)} (${assessment.overallGrade})`;
    
    const body = encodeURIComponent(
      `Dear ${assessment.property.customerName || 'Customer'},\n\n` +
      `Please find attached the landscape health assessment for ${assessment.property.propertyName}.\n\n` +
      `Overall Score: ${scoreText}\n` +
      `Inspection Date: ${format(new Date(assessment.property.inspectionDate), 'MMMM d, yyyy')}\n\n` +
      `Inspector: ${assessment.property.inspectorName}\n` +
      `Email: ${assessment.property.inspectorEmail}\n` +
      `Phone: ${assessment.property.inspectorPhone}\n\n` +
      `Best regards,\n${assessment.property.inspectorName}`
    );

    const mailtoLink = `mailto:${assessment.property.customerEmail || ''}?subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Assessment - ${assessment.property.propertyName}`,
          text: `Overall Score: ${assessment.overallScore.toFixed(1)} (${assessment.overallGrade})`,
          url: window.location.href
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else {
      toast.info('Sharing not supported on this device');
    }
  };

  const categories = Object.values(assessment.categories);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Assessment Report</h1>
            <p className="text-sm text-gray-600">Step 4 of 4</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            onClick={handleDownloadPDF}
            disabled={generating}
            className="h-20 flex-col gap-2"
          >
            <Download className="w-6 h-6" />
            <span className="text-xs">Download PDF</span>
          </Button>
          <Button
            onClick={handleEmailReport}
            variant="outline"
            className="h-20 flex-col gap-2"
          >
            <Mail className="w-6 h-6" />
            <span className="text-xs">Email Report</span>
          </Button>
          <Button
            onClick={handleShare}
            variant="outline"
            className="h-20 flex-col gap-2"
          >
            <Share2 className="w-6 h-6" />
            <span className="text-xs">Share</span>
          </Button>
        </div>

        {/* Report Preview */}
        <Card className="p-8 bg-white" ref={reportRef}>
          {/* Header */}
          <div className="text-center border-b pb-6 mb-6">
            <h1 className="text-3xl font-bold mb-2">Landscape Health Assessment</h1>
            <p className="text-gray-600">Professional Property Evaluation Report</p>
          </div>

          {/* Property Information */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Property Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Property Name</p>
                <p className="font-medium">{assessment.property.propertyName}</p>
              </div>
              <div>
                <p className="text-gray-600">Address</p>
                <p className="font-medium">{assessment.property.address}</p>
              </div>
              <div>
                <p className="text-gray-600">Inspection Date</p>
                <p className="font-medium">
                  {format(new Date(assessment.property.inspectionDate), 'MMMM d, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Inspector</p>
                <p className="font-medium">{assessment.property.inspectorName}</p>
              </div>
            </div>
          </div>

          {/* Overall Score */}
          <div className="bg-gradient-to-br from-blue-50 to-green-50 p-8 rounded-lg mb-8 text-center">
            <p className="text-gray-600 mb-2">Overall Property Score</p>
            <div className="flex items-center justify-center gap-6 mt-4">
              {assessment.overallGrade === '-' ? (
                <div>
                  <p className="text-4xl font-bold text-gray-400">- -</p>
                  <p className="text-sm text-orange-600 mt-2">Assessment in progress</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-6xl font-bold text-gray-900">{assessment.overallScore.toFixed(1)}</p>
                    <p className="text-sm text-gray-600 mt-2">out of 5.0</p>
                  </div>
                  <GradeBadge grade={assessment.overallGrade} size="lg" />
                </>
              )}
            </div>
          </div>

          {/* Category Scores */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Category Breakdown</h2>
            <div className="space-y-3">
              {categories.map(category => {
                const checkedCount = category.checklistItems.filter(item => item === true).length;
                return (
                  <div key={category.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <GradeBadge grade={category.autoGrade} size="sm" />
                    <div className="flex-1">
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-gray-600">
                        {category.naToggle ? 'Not Applicable' : `${checkedCount}/10 items checked`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {category.naToggle ? 'N/A' : category.autoGrade === '-' ? '-' : category.autoScore.toFixed(1)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommended Services */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Recommended Services</h2>
            {categories.map(category => {
              const selectedServices = category.recommendedServices.filter(s => s.selected);
              if (selectedServices.length === 0) return null;

              return (
                <div key={category.id} className="mb-4">
                  <h3 className="font-medium text-lg mb-2">{category.name}</h3>
                  <div className="space-y-2">
                    {selectedServices.map(service => (
                      <div key={service.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="font-medium">{service.name}</p>
                          <p className="text-sm text-gray-600">
                            {service.measurementValue} {service.measurementType}
                          </p>
                          {service.notes && (
                            <p className="text-sm text-gray-600 mt-1">{service.notes}</p>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs rounded ${
                          service.internalExternal === 'INTERNAL'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {service.internalExternal}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t pt-6 text-center text-sm text-gray-600">
            <p>Inspector Contact: {assessment.property.inspectorEmail} | {assessment.property.inspectorPhone}</p>
            <p className="mt-2">Report Generated: {format(new Date(), 'MMMM d, yyyy')}</p>
          </div>
        </Card>

        {/* Back to Dashboard */}
        <Button
          onClick={() => navigate('/')}
          variant="outline"
          className="w-full"
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}