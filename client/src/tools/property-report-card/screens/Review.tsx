// Review and overall score screen

import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';
import { GradeBadge } from '../components/GradeBadge';
import { getCategoryStatus, isAssessmentReadyForScore } from '../utils/scoring';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Review() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { assessment, markComplete } = useAssessment();

  if (!assessment) return null;

  const categories = Object.values(assessment.categories);
  const incompleteCategories = categories.filter(cat => 
    getCategoryStatus(cat) !== 'complete'
  );
  const isReadyForScore = isAssessmentReadyForScore(assessment.categories);

  const handleGenerateReport = () => {
    if (incompleteCategories.length > 0) {
      alert('Please complete all categories or mark them as N/A');
      return;
    }
    markComplete();
    navigate(`/report/${assessment.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/assessment/${id}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Review & Overall Score</h1>
            <p className="text-sm text-gray-600">Step 3 of 4</p>
          </div>
        </div>

        {/* Property Info */}
        <Card className="p-6">
          <h2 className="font-semibold text-lg mb-2">{assessment.property.propertyName}</h2>
          <p className="text-gray-600">{assessment.property.address}</p>
          <p className="text-sm text-gray-500 mt-1">
            Inspection Date: {new Date(assessment.property.inspectionDate).toLocaleDateString()}
          </p>
        </Card>

        {/* Overall Score Card */}
        {isReadyForScore ? (
          <Card className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 mb-2">Overall Property Score</p>
                <p className="text-5xl font-bold">{assessment.overallScore.toFixed(1)}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Based on {categories.filter(c => !c.naToggle).length} categories
                </p>
              </div>
              <GradeBadge grade={assessment.overallGrade} size="lg" />
            </div>
          </Card>
        ) : (
          <Card className="p-8">
            <div className="text-center">
              <p className="text-gray-600 mb-2">Overall Property Score</p>
              <p className="text-5xl font-bold text-gray-400">- -</p>
              <p className="text-sm text-gray-500 mt-2">
                Complete all categories to see overall score
              </p>
            </div>
          </Card>
        )}

        {/* Warnings */}
        {incompleteCategories.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {incompleteCategories.length} {incompleteCategories.length === 1 ? 'category' : 'categories'} incomplete: {' '}
              {incompleteCategories.map(c => c.name).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Category Summary Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Checked</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Grade</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(category => {
                const checkedCount = category.checklistItems.filter(Boolean).length;
                const status = getCategoryStatus(category);

                return (
                  <TableRow
                    key={category.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/assessment/${id}/category/${category.id}`)}
                  >
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-center">
                      {category.naToggle ? 'N/A' : `${checkedCount}/10`}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {category.naToggle ? 'N/A' : category.autoScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <GradeBadge grade={category.autoGrade} size="sm" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        status === 'complete' ? 'bg-green-100 text-green-800' :
                        status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {status.replace('-', ' ')}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Recommended Services Summary */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Recommended Services Summary</h3>
          <div className="space-y-2">
            {categories.map(category => {
              const selectedServices = category.recommendedServices.filter(s => s.selected);
              if (selectedServices.length === 0) return null;

              return (
                <div key={category.id} className="pb-2 border-b last:border-0">
                  <p className="font-medium text-sm">{category.name}</p>
                  <ul className="list-disc pl-5 text-sm text-gray-600 mt-1">
                    {selectedServices.map(service => (
                      <li key={service.id}>
                        {service.name} - {service.measurementValue} {service.measurementType} 
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                          service.internalExternal === 'INTERNAL' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {service.internalExternal}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Generate Report Button */}
        <Button
          onClick={handleGenerateReport}
          className="w-full h-12"
          disabled={incompleteCategories.length > 0}
        >
          {incompleteCategories.length > 0 
            ? 'Complete All Categories First' 
            : 'Generate Report'}
        </Button>
      </div>
    </div>
  );
}