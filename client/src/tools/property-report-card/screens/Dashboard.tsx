// Dashboard screen

import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Search, Trash2, Eye, X } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';
import { getAllAssessments, deleteAssessment, saveAssessment } from '../utils/storage';
import { useState, useEffect } from 'react';
import { Assessment } from '../types';
import { GradeBadge } from '../components/GradeBadge';
import { format } from 'date-fns';
import { createDemoAssessment } from '../utils/demoData';

export default function Dashboard() {
  const navigate = useNavigate();
  const { clearAssessment } = useAssessment();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setAssessments(getAllAssessments());
  }, []);

  const handleNewAssessment = () => {
    // Clear any existing assessment in context
    // Don't create the assessment yet - that will happen in PropertySetup
    // after the user fills in all required fields
    clearAssessment();
    navigate('/property-setup');
  };

  const draftAssessments = assessments.filter(a => a.status === 'draft');
  const completeAssessments = assessments.filter(a => a.status === 'complete');

  // Filter assessments based on search query
  const filteredAssessments = searchQuery.trim()
    ? completeAssessments.filter(assessment => {
        const query = searchQuery.toLowerCase();
        const customerName = assessment.property.customerName?.toLowerCase() || '';
        const address = assessment.property.address?.toLowerCase() || '';
        const propertyName = assessment.property.propertyName?.toLowerCase() || '';
        
        return customerName.includes(query) || 
               address.includes(query) || 
               propertyName.includes(query);
      })
    : completeAssessments;

  const handleDeleteDraft = (e: React.MouseEvent, assessmentId: string) => {
    e.stopPropagation(); // Prevent card click navigation
    
    if (window.confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
      deleteAssessment(assessmentId);
      setAssessments(getAllAssessments());
    }
  };

  const handleContinueDraft = (assessmentId: string) => {
    navigate(`/assessment/${assessmentId}`);
  };

  const handleDemoAssessment = () => {
    const demoAssessment = createDemoAssessment();
    saveAssessment(demoAssessment);
    setAssessments(getAllAssessments());
    navigate(`/assessment/${demoAssessment.id}`);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      // Scroll to Past Reports section
      setTimeout(() => {
        const pastReportsSection = document.querySelector('.past-reports-section');
        if (pastReportsSection) {
          pastReportsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold text-foreground">Landscape Health Assessment</h1>
          <p className="text-muted-foreground mt-2">Create and manage property assessments</p>
        </div>

        {/* New Assessment Button */}
        <Button
          onClick={handleNewAssessment}
          className="w-full h-16 text-lg"
        >
          <Plus className="w-6 h-6 mr-2" />
          Start New Assessment
        </Button>

        {/* Demo/Preview Button */}
        <Button
          onClick={handleDemoAssessment}
          variant="outline"
          className="w-full h-12"
        >
          <Eye className="w-5 h-5 mr-2" />
          View Demo Assessment
        </Button>

        {/* Search Bar - Only show if there are completed assessments */}
        {completeAssessments.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by customer name or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </Card>
        )}

        {/* Draft Assessments */}
        {draftAssessments.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Continue Draft
            </h2>
            {draftAssessments.map(assessment => (
              <Card
                key={assessment.id}
                className="p-4 hover:shadow-lg transition-shadow relative"
              >
                <div 
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => {
                    handleContinueDraft(assessment.id);
                  }}
                >
                  <div className="flex-1">
                    <h3 className="font-medium">{assessment.property.propertyName || 'Untitled Property'}</h3>
                    <p className="text-sm text-muted-foreground">{assessment.property.address}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {format(new Date(assessment.updatedAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-medium rounded-full">
                      Draft
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteDraft(e, assessment.id)}
                      className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Past Reports */}
        <div className="space-y-3 past-reports-section">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Past Reports {searchQuery && completeAssessments.length > 0 && `(${filteredAssessments.length} result${filteredAssessments.length !== 1 ? 's' : ''})`}
          </h2>
          {completeAssessments.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground mb-2">No completed assessments yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Completed assessments will appear here. Try the demo to see an example of a finished report!
              </p>
              <Button
                onClick={handleDemoAssessment}
                variant="outline"
                size="sm"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Demo Assessment
              </Button>
            </Card>
          ) : filteredAssessments.length > 0 ? (
            filteredAssessments.map(assessment => (
              <Card
                key={assessment.id}
                className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => {
                  navigate(`/report/${assessment.id}`);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium">{assessment.property.propertyName}</h3>
                    <p className="text-sm text-muted-foreground">{assessment.property.address}</p>
                    {assessment.property.customerName && (
                      <p className="text-sm text-muted-foreground">Customer: {assessment.property.customerName}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(assessment.property.inspectionDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {assessment.overallGrade === '-' ? (
                        <div className="text-sm text-orange-600">In Progress</div>
                      ) : (
                        <>
                          <div className="text-lg font-bold">{assessment.overallScore.toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">Score</div>
                        </>
                      )}
                    </div>
                    <GradeBadge grade={assessment.overallGrade} size="sm" />
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No assessments found matching "{searchQuery}"</p>
              <Button
                variant="link"
                onClick={handleClearSearch}
                className="mt-2"
              >
                Clear search
              </Button>
            </Card>
          )}
        </div>

        {/* Empty state only if no assessments or drafts at all */}
        {assessments.length === 0 && (
          <Card className="p-8 text-center">
            <div className="max-w-md mx-auto">
              <h3 className="font-medium text-foreground mb-2">Welcome to Landscape Health Assessment</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by viewing a demo assessment to see how the complete workflow works, 
                or jump right in and create your first assessment.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleDemoAssessment}
                  variant="outline"
                  className="w-full"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Demo Assessment
                </Button>
                <Button
                  onClick={handleNewAssessment}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Start New Assessment
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}