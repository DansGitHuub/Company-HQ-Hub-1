// Category detail screen

import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';
import { GradeBadge } from '../components/GradeBadge';
import { ScoreMeter } from '../components/ScoreMeter';
import { ChecklistRow } from '../components/ChecklistRow';
import { ServiceCard } from '../components/ServiceCard';
import { AddAttachmentButton, AttachmentTile } from '../components/AttachmentTile';
import { getCategoryDefinition } from '../data/categories';
import { CategoryId, Attachment } from '../types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState, useRef } from 'react';
import { toast } from 'sonner';

export default function CategoryDetail() {
  const navigate = useNavigate();
  const { id, categoryId } = useParams();
  const { assessment, toggleChecklistItem, updateCategory, toggleCategoryNA } = useAssessment();
  const [showNADialog, setShowNADialog] = useState(false);
  const [showScoringHelp, setShowScoringHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentServiceId, setCurrentServiceId] = useState<string | null>(null);

  if (!assessment || !categoryId) return null;

  const category = assessment.categories[categoryId as CategoryId];
  if (!category) return null;

  const definition = getCategoryDefinition(categoryId);
  if (!definition) return null;

  const checkedCount = category.checklistItems.filter(item => item === true).length;
  const allAnswered = category.checklistItems.every(item => item !== null);
  const answeredCount = category.checklistItems.filter(item => item !== null).length;

  const handleToggleNA = () => {
    if (!category.naToggle) {
      setShowNADialog(true);
    } else {
      toggleCategoryNA(categoryId as CategoryId);
    }
  };

  const confirmToggleNA = () => {
    toggleCategoryNA(categoryId as CategoryId);
    setShowNADialog(false);
  };

  const handleAddPhoto = (forService?: string) => {
    setCurrentServiceId(forService || null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const newAttachment: Attachment = {
        id: `attachment-${Date.now()}`,
        url: event.target?.result as string,
        type: file.type.startsWith('image/') ? 'photo' : 'file',
        timestamp: new Date()
      };

      if (currentServiceId) {
        // Add to service
        const service = category.recommendedServices.find(s => s.id === currentServiceId);
        if (service) {
          updateCategory(categoryId as CategoryId, {
            recommendedServices: category.recommendedServices.map(s =>
              s.id === currentServiceId
                ? { ...s, attachments: [...s.attachments, newAttachment] }
                : s
            )
          });
        }
      } else {
        // Add to category
        updateCategory(categoryId as CategoryId, {
          attachments: [...category.attachments, newAttachment]
        });
      }

      toast.success('Attachment added successfully');
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/assessment/${id}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{category.name}</h1>
            <p className="text-sm text-gray-600">Category Assessment</p>
          </div>
          <GradeBadge grade={category.autoGrade} size="md" />
        </div>

        {/* Score Card */}
        <Card className="p-4">
          <ScoreMeter
            score={category.autoScore}
            checkedCount={checkedCount}
            allAnswered={allAnswered}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowScoringHelp(true)}
            className="mt-2 text-blue-600"
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            How scoring works
          </Button>
        </Card>

        {/* N/A Toggle */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Mark as Not Applicable</Label>
              <p className="text-sm text-gray-600">Exclude from overall score</p>
            </div>
            <Switch
              checked={category.naToggle}
              onCheckedChange={handleToggleNA}
            />
          </div>
        </Card>

        {/* Checklist */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700">Checklist Items</h2>
          {definition.checklistItems.map((item, index) => (
            <ChecklistRow
              key={index}
              label={item}
              value={category.checklistItems[index]}
              onSetValue={(value) => {
                const newItems = [...category.checklistItems];
                newItems[index] = value;
                updateCategory(categoryId as CategoryId, { checklistItems: newItems });
              }}
              disabled={category.naToggle}
            />
          ))}
        </div>

        {/* Notes & Attachments */}
        <Accordion type="single" collapsible>
          <AccordionItem value="notes">
            <AccordionTrigger>Notes & Attachments</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={category.notes}
                  onChange={(e) => updateCategory(categoryId as CategoryId, { notes: e.target.value })}
                  placeholder="Add notes about this category..."
                  rows={4}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="mb-2 block">Attachments</Label>
                <div className="flex gap-2 flex-wrap">
                  {category.attachments.map((attachment) => (
                    <AttachmentTile
                      key={attachment.id}
                      attachment={attachment}
                      onRemove={() => {
                        updateCategory(categoryId as CategoryId, {
                          attachments: category.attachments.filter(a => a.id !== attachment.id)
                        });
                      }}
                    />
                  ))}
                  <AddAttachmentButton type="camera" onAdd={() => handleAddPhoto()} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="services">
            <AccordionTrigger>Recommended Services</AccordionTrigger>
            <AccordionContent className="space-y-3">
              {category.recommendedServices.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onUpdate={(updates) => {
                    updateCategory(categoryId as CategoryId, {
                      recommendedServices: category.recommendedServices.map(s =>
                        s.id === service.id ? { ...s, ...updates } : s
                      )
                    });
                  }}
                  onAddAttachment={() => handleAddPhoto(service.id)}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={() => navigate(`/assessment/${id}`)}
            className="w-full h-12"
          >
            Save & Continue
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* N/A Confirmation Dialog */}
      <AlertDialog open={showNADialog} onOpenChange={setShowNADialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Not Applicable?</AlertDialogTitle>
            <AlertDialogDescription>
              This will exclude this category from the overall score calculation and disable the checklist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleNA}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scoring Help Dialog */}
      <AlertDialog open={showScoringHelp} onOpenChange={setShowScoringHelp}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>How Scoring Works</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Category scores are calculated based on checked items:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>0-2 checked → Score 1 (F)</li>
                  <li>3-4 checked → Score 2 (D)</li>
                  <li>5-6 checked → Score 3 (C)</li>
                  <li>7-8 checked → Score 4 (B)</li>
                  <li>9-10 checked → Score 5 (A)</li>
                </ul>
                <p className="mt-3">The overall property score is the average of all category scores (excluding N/A).</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}