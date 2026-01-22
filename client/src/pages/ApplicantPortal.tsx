import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle, 
  Clock,
  FileText,
  Upload,
  User,
  Briefcase,
  Calendar,
  AlertCircle,
  ChevronRight,
  Loader2,
  FileCheck,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type Candidate = {
  id: string;
  name: string;
  role: string;
  stage: string;
  appliedDate: string;
  email?: string;
  phone?: string;
  jobType?: string;
  workType?: string;
  notes?: string;
};

type CandidateDocument = {
  id: string;
  candidateId: string;
  name: string;
  type: string;
  url: string;
  acknowledged: boolean;
  uploadedAt: string;
};

const HIRING_STAGES = [
  { key: "Applied", label: "Application Submitted", description: "Your application is being reviewed" },
  { key: "Screening", label: "Initial Screening", description: "We're reviewing your qualifications" },
  { key: "Interview", label: "Interview Scheduled", description: "Time to meet the team!" },
  { key: "Assessment", label: "Skills Assessment", description: "Demonstrating your skills" },
  { key: "Background", label: "Background Check", description: "Final verification process" },
  { key: "Offer", label: "Offer Extended", description: "Congratulations! Review your offer" },
  { key: "Hired", label: "Welcome to the Team!", description: "You're officially hired!" },
];

const REQUIRED_DOCUMENTS = [
  { type: "drivers_license", label: "Driver's License", description: "Valid state-issued ID" },
  { type: "w4", label: "W-4 Form", description: "Tax withholding form" },
  { type: "direct_deposit", label: "Direct Deposit Form", description: "Banking information for payroll" },
  { type: "i9", label: "I-9 Employment Eligibility", description: "Work authorization verification" },
];

function getStageIndex(stage: string): number {
  const index = HIRING_STAGES.findIndex(s => s.key === stage);
  return index === -1 ? 0 : index;
}

function getStageProgress(stage: string): number {
  const index = getStageIndex(stage);
  return Math.round(((index + 1) / HIRING_STAGES.length) * 100);
}

export default function ApplicantPortal() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: application, isLoading } = useQuery<Candidate | null>({
    queryKey: ["/api/my-application"],
    queryFn: async () => {
      const res = await fetch("/api/my-application", { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch application");
      return res.json();
    },
  });

  const { data: documents = [] } = useQuery<CandidateDocument[]>({
    queryKey: ["/api/my-application/documents"],
    enabled: !!application,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Applicant Portal</h1>
          <p className="text-muted-foreground">Track your job application status</p>
        </div>
        
        <Card className="card-interactive">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">No Active Application</h2>
            <p className="text-muted-foreground">
              You don't have an active job application. Check out our open positions!
            </p>
            <Link href="/careers">
              <Button className="btn-glow">
                <Briefcase className="mr-2 h-4 w-4" />
                View Open Positions
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStageIndex = getStageIndex(application.stage);
  const progress = getStageProgress(application.stage);
  const uploadedDocTypes = documents.map(d => d.type);
  const missingDocs = REQUIRED_DOCUMENTS.filter(d => !uploadedDocTypes.includes(d.type));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Your Application</h1>
        <p className="text-muted-foreground">Track your progress and complete required steps</p>
      </div>

      <Card className="card-interactive">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                {application.jobType || application.role}
                {application.workType && (
                  <Badge variant="outline" className="ml-2">{application.workType}</Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Applied on {new Date(application.appliedDate).toLocaleDateString()}
              </CardDescription>
            </div>
            <Badge 
              className={
                application.stage === "Hired" ? "bg-green-500" :
                application.stage === "Rejected" ? "bg-red-500" :
                "bg-primary"
              }
            >
              {application.stage}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Application Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="space-y-3">
            {HIRING_STAGES.map((stage, index) => {
              const isComplete = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              const isFuture = index > currentStageIndex;
              
              return (
                <div 
                  key={stage.key}
                  className={`flex items-start gap-4 p-3 rounded-lg transition-colors ${
                    isCurrent ? 'bg-primary/10 border border-primary/20' :
                    isComplete ? 'bg-muted/50' : 'opacity-50'
                  }`}
                >
                  <div className={`mt-0.5 ${
                    isComplete ? 'text-green-500' :
                    isCurrent ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isCurrent ? (
                      <Clock className="h-5 w-5 animate-pulse" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${isFuture ? 'text-muted-foreground' : ''}`}>
                      {stage.label}
                    </p>
                    <p className="text-sm text-muted-foreground">{stage.description}</p>
                  </div>
                  {isCurrent && (
                    <Badge variant="outline" className="animate-pulse">Current</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="card-interactive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Required Documents
            </CardTitle>
            <CardDescription>
              {missingDocs.length === 0 
                ? "All documents submitted" 
                : `${missingDocs.length} documents still needed`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REQUIRED_DOCUMENTS.map((doc) => {
              const uploaded = documents.find(d => d.type === doc.type);
              return (
                <div 
                  key={doc.type}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    uploaded ? 'bg-green-50 border-green-200' : 'bg-muted/50 border-border'
                  }`}
                >
                  {uploaded ? (
                    <FileCheck className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{doc.label}</p>
                    <p className="text-xs text-muted-foreground">{doc.description}</p>
                  </div>
                  {!uploaded && (
                    <Button size="sm" variant="outline" className="gap-1">
                      <Upload className="h-3 w-3" />
                      Upload
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="card-interactive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Next Steps
            </CardTitle>
            <CardDescription>What to expect in the hiring process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {application.stage === "Applied" && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900">Application Under Review</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Our hiring team is reviewing your application. We'll be in touch within 2-3 business days.
                </p>
              </div>
            )}
            {application.stage === "Screening" && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-medium text-amber-900">Initial Screening</h4>
                <p className="text-sm text-amber-700 mt-1">
                  You may receive a phone call or email to schedule a brief screening call. Please keep your phone available.
                </p>
              </div>
            )}
            {application.stage === "Interview" && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900">Interview Time!</h4>
                <p className="text-sm text-green-700 mt-1">
                  Great news! We'd like to meet you. Check your email for interview scheduling details.
                </p>
              </div>
            )}
            {application.stage === "Background" && (
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-medium text-purple-900">Background Check</h4>
                <p className="text-sm text-purple-700 mt-1">
                  We're completing your background verification. This typically takes 3-5 business days.
                </p>
              </div>
            )}
            {application.stage === "Offer" && (
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <h4 className="font-medium text-emerald-900">Congratulations!</h4>
                <p className="text-sm text-emerald-700 mt-1">
                  We'd like to offer you a position! Check your email for your official offer letter.
                </p>
              </div>
            )}
            {application.stage === "Hired" && (
              <div className="p-4 bg-green-100 rounded-lg border border-green-300">
                <h4 className="font-medium text-green-900">Welcome to the Team!</h4>
                <p className="text-sm text-green-700 mt-1">
                  You're officially part of our crew! Your onboarding information will be sent shortly.
                </p>
              </div>
            )}

            <div className="pt-2">
              <h4 className="font-medium mb-2">Have Questions?</h4>
              <Link href="/customer-portal">
                <Button variant="outline" className="w-full gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Contact Our Team
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-interactive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Your Information
          </CardTitle>
          <CardDescription>The details we have on file</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="font-medium">{application.name}</p>
            </div>
            {application.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{application.email}</p>
              </div>
            )}
            {application.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{application.phone}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Position Applied</p>
              <p className="font-medium">{application.jobType || application.role}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
