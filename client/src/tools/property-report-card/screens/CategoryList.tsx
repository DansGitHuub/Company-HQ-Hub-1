// Category list screen

import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, ChevronRight, Edit } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';
import { GradeBadge } from '../components/GradeBadge';
import { ProgressPill } from '../components/ProgressPill';
import { getCategoryStatus, isAssessmentReadyForScore } from '../utils/scoring';
import { useEffect } from 'react';
import { getAssessment } from '../utils/storage';

export default function CategoryList() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { assessment, loadAssessment } = useAssessment();

  useEffect(() => {
    if (id && !assessment) {
      loadAssessment(id);
    }
  }, [id]);

  if (!assessment) return null;

  const categories = Object.values(assessment.categories);
  const allComplete = isAssessmentReadyForScore(assessment.categories);

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
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{assessment.property.propertyName}</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/property-setup')}
                className="h-7 px-2"
              >
                <Edit className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Step 2 of 4: Category Assessment</p>
          </div>
        </div>

        {/* Score Summary */}
        {allComplete ? (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Property Score</p>
                <p className="text-3xl font-bold mt-1">{assessment.overallScore.toFixed(1)}</p>
              </div>
              <GradeBadge grade={assessment.overallGrade} size="lg" />
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Overall Property Score</p>
              <p className="text-2xl font-bold text-muted-foreground">- -</p>
              <p className="text-xs text-muted-foreground mt-2">
                Complete all categories to see score
              </p>
            </div>
          </Card>
        )}

        {/* Category List */}
        <div className="space-y-3">
          <h2 className="font-semibold text-foreground">Assessment Categories</h2>
          {categories.map(category => {
            const status = getCategoryStatus(category);
            const checkedCount = category.checklistItems.filter(item => item === true).length;

            return (
              <Card
                key={category.id}
                className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/assessment/${assessment.id}/category/${category.id}`)}
              >
                <div className="flex items-center gap-4">
                  <GradeBadge grade={category.autoGrade} size="md" />
                  
                  <div className="flex-1">
                    <h3 className="font-medium">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {category.naToggle ? 'N/A' : `${checkedCount}/10 items checked`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <ProgressPill status={status} />
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Continue Button */}
        <Button
          onClick={() => navigate(`/assessment/${assessment.id}/review`)}
          className="w-full h-12"
          disabled={!allComplete}
        >
          {allComplete ? 'Review & Generate Report' : 'Complete All Categories First'}
        </Button>

        {!allComplete && (
          <p className="text-sm text-center text-muted-foreground">
            Complete all categories or mark them as N/A to proceed
          </p>
        )}
      </div>
    </div>
  );
}