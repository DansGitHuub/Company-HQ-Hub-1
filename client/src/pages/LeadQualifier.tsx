import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, RotateCcw, Save, Trash2, ChevronDown, ChevronUp,
  Star, Phone, Mail, MapPin, Building2, Calendar, DollarSign, Users, Target,
  Flame, Thermometer, Snowflake as SnowflakeIcon, CheckCircle2, XCircle, Clock
} from "lucide-react";
import type { QualifiedLead } from "@shared/schema";

const PROPERTY_TYPES = ["Residential", "Commercial", "HOA / Multi-Unit", "Municipal / Government", "Industrial"];
const SERVICE_TYPES = ["Lawn Maintenance", "Landscape Installation", "Hardscaping", "Irrigation", "Snow Removal", "Tree Service", "Full Property Management", "Other"];
const PROJECT_SIZES = ["Small (under $1,000)", "Medium ($1,000 - $5,000)", "Large ($5,000 - $25,000)", "Enterprise ($25,000+)"];
const TIMELINES = ["Immediate (within 1 week)", "Short-term (1-4 weeks)", "Medium-term (1-3 months)", "Long-term (3+ months)", "Flexible / No rush"];
const SOURCES = ["Referral", "Website", "Social Media", "Door-to-door", "Trade Show", "Google / Search", "Yard Sign", "Repeat Customer", "Other"];

interface QuestionAnswer {
  question: string;
  answer: string;
  weight: number;
  score: number;
}

const QUALIFICATION_QUESTIONS: { question: string; options: { label: string; score: number }[]; weight: number }[] = [
  {
    question: "Does the prospect have decision-making authority?",
    options: [
      { label: "Yes — they're the owner/decision maker", score: 3 },
      { label: "Shared — part of a committee or couple", score: 2 },
      { label: "No — need approval from someone else", score: 1 },
      { label: "Unknown", score: 0 },
    ],
    weight: 3,
  },
  {
    question: "How clearly defined is the scope of work?",
    options: [
      { label: "Very clear — specific project in mind", score: 3 },
      { label: "Somewhat clear — general idea", score: 2 },
      { label: "Vague — just browsing options", score: 1 },
      { label: "No idea what they want", score: 0 },
    ],
    weight: 2,
  },
  {
    question: "Is there an established budget?",
    options: [
      { label: "Yes — budget set and realistic", score: 3 },
      { label: "Ballpark — have a general range", score: 2 },
      { label: "No budget set but willing to discuss", score: 1 },
      { label: "Unrealistic expectations / price shoppers", score: 0 },
    ],
    weight: 3,
  },
  {
    question: "What's the urgency level?",
    options: [
      { label: "High — need it done ASAP", score: 3 },
      { label: "Medium — within the next month", score: 2 },
      { label: "Low — sometime this season", score: 1 },
      { label: "None — just getting quotes", score: 0 },
    ],
    weight: 2,
  },
  {
    question: "Is the property in our service area?",
    options: [
      { label: "Yes — core service area", score: 3 },
      { label: "Yes — extended service area", score: 2 },
      { label: "Borderline — might work", score: 1 },
      { label: "No — outside our range", score: 0 },
    ],
    weight: 2,
  },
  {
    question: "Is this a recurring or one-time opportunity?",
    options: [
      { label: "Recurring / maintenance contract potential", score: 3 },
      { label: "One-time but large project", score: 2 },
      { label: "One-time small project", score: 1 },
      { label: "Unknown", score: 0 },
    ],
    weight: 2,
  },
  {
    question: "How did they engage with us?",
    options: [
      { label: "They reached out to us directly", score: 3 },
      { label: "Referral from existing client", score: 3 },
      { label: "Responded to our marketing", score: 2 },
      { label: "Cold outreach by us", score: 1 },
    ],
    weight: 1,
  },
  {
    question: "What's the competitive situation?",
    options: [
      { label: "We're the only one they're talking to", score: 3 },
      { label: "Getting 2-3 quotes", score: 2 },
      { label: "Shopping around extensively", score: 1 },
      { label: "Already has a provider, just comparing", score: 0 },
    ],
    weight: 2,
  },
];

function calculateScore(answers: QuestionAnswer[]): { score: number; maxScore: number; rating: string } {
  let score = 0;
  let maxScore = 0;
  for (const q of QUALIFICATION_QUESTIONS) {
    maxScore += 3 * q.weight;
  }
  for (const a of answers) {
    if (a) score += a.score * a.weight;
  }
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  let rating: string;
  if (pct >= 75) rating = "hot";
  else if (pct >= 50) rating = "warm";
  else if (pct >= 25) rating = "cold";
  else rating = "unqualified";
  return { score, maxScore, rating };
}

function RatingBadge({ rating }: { rating: string }) {
  const config: Record<string, { icon: typeof Flame; color: string; label: string }> = {
    hot: { icon: Flame, color: "bg-red-100 text-red-700 border-red-300", label: "Hot Lead" },
    warm: { icon: Thermometer, color: "bg-orange-100 text-orange-700 border-orange-300", label: "Warm Lead" },
    cold: { icon: SnowflakeIcon, color: "bg-blue-100 text-blue-700 border-blue-300", label: "Cold Lead" },
    unqualified: { icon: XCircle, color: "bg-gray-100 text-gray-600 border-gray-300", label: "Unqualified" },
  };
  const c = config[rating] || config.cold;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`${c.color} gap-1 text-sm px-3 py-1`} data-testid={`badge-rating-${rating}`}>
      <Icon className="h-3.5 w-3.5" /> {c.label}
    </Badge>
  );
}

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const color = pct >= 75 ? "bg-red-500" : pct >= 50 ? "bg-orange-500" : pct >= 25 ? "bg-blue-500" : "bg-gray-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Qualification Score</span>
        <span className="font-semibold">{score} / {maxScore} ({pct}%)</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden" data-testid="score-bar">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function LeadQualifier() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [view, setView] = useState<"qualifier" | "saved">("qualifier");
  const [step, setStep] = useState(0);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  const [contactInfo, setContactInfo] = useState({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    companyName: "",
    propertyType: "",
    serviceType: "",
    projectSize: "",
    budget: "",
    timeline: "",
    source: "",
    location: "",
    notes: "",
  });

  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);

  const { data: savedLeads = [], isLoading: loadingSaved } = useQuery<QualifiedLead[]>({
    queryKey: ["/api/qualified-leads"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/qualified-leads", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qualified-leads"] });
      toast({ title: "Lead saved successfully" });
      resetForm();
      setView("saved");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save lead", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/qualified-leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qualified-leads"] });
      toast({ title: "Lead deleted" });
    },
  });

  function resetForm() {
    setStep(0);
    setContactInfo({
      contactName: "", contactEmail: "", contactPhone: "", companyName: "",
      propertyType: "", serviceType: "", projectSize: "", budget: "",
      timeline: "", source: "", location: "", notes: "",
    });
    setAnswers([]);
  }

  function handleAnswer(qIndex: number, optIndex: number) {
    const q = QUALIFICATION_QUESTIONS[qIndex];
    const opt = q.options[optIndex];
    const newAnswers = [...answers];
    newAnswers[qIndex] = {
      question: q.question,
      answer: opt.label,
      weight: q.weight,
      score: opt.score,
    };
    setAnswers(newAnswers);
  }

  function handleSave() {
    if (!contactInfo.contactName || !contactInfo.propertyType || !contactInfo.serviceType || !contactInfo.projectSize) {
      toast({ title: "Missing required fields", description: "Please fill in contact name, property type, service type, and project size.", variant: "destructive" });
      return;
    }
    const { score, maxScore, rating } = calculateScore(answers);
    saveMutation.mutate({
      ...contactInfo,
      answers,
      score,
      maxScore,
      rating,
    });
  }

  const currentScoreData = calculateScore(answers);
  const totalSteps = 3;

  return (
    <div className="space-y-6" data-testid="lead-qualifier-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="text-qualifier-title">
            {t("leadQualifier.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("leadQualifier.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "qualifier" ? "default" : "outline"}
            onClick={() => setView("qualifier")}
            data-testid="button-view-qualifier"
          >
            <Target className="h-4 w-4 mr-2" /> {t("leadQualifier.qualify")}
          </Button>
          <Button
            variant={view === "saved" ? "default" : "outline"}
            onClick={() => setView("saved")}
            data-testid="button-view-saved"
          >
            <Users className="h-4 w-4 mr-2" /> {t("common.saved")} ({savedLeads.length})
          </Button>
        </div>
      </div>

      {view === "qualifier" ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                {i < totalSteps - 1 && <div className={`h-0.5 w-8 ${i < step ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
            <span className="text-sm text-muted-foreground ml-2">
              {step === 0 ? "Contact Info" : step === 1 ? "Qualification Questions" : "Review & Save"}
            </span>
          </div>

          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Contact & Project Information</CardTitle>
                <CardDescription>Enter the prospect's details and project overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Contact Name *</Label>
                    <Input
                      id="contactName"
                      value={contactInfo.contactName}
                      onChange={(e) => setContactInfo({ ...contactInfo, contactName: e.target.value })}
                      placeholder="John Smith"
                      data-testid="input-contact-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={contactInfo.companyName}
                      onChange={(e) => setContactInfo({ ...contactInfo, companyName: e.target.value })}
                      placeholder="ABC Properties"
                      data-testid="input-company-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={contactInfo.contactEmail}
                      onChange={(e) => setContactInfo({ ...contactInfo, contactEmail: e.target.value })}
                      placeholder="john@example.com"
                      data-testid="input-contact-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Phone</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      value={contactInfo.contactPhone}
                      onChange={(e) => setContactInfo({ ...contactInfo, contactPhone: e.target.value })}
                      placeholder="(555) 123-4567"
                      data-testid="input-contact-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location / Address</Label>
                    <Input
                      id="location"
                      value={contactInfo.location}
                      onChange={(e) => setContactInfo({ ...contactInfo, location: e.target.value })}
                      placeholder="123 Main St, Anytown"
                      data-testid="input-location"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Lead Source</Label>
                    <select
                      id="source"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={contactInfo.source}
                      onChange={(e) => setContactInfo({ ...contactInfo, source: e.target.value })}
                      data-testid="select-source"
                    >
                      <option value="">Select source...</option>
                      {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <hr className="my-4" />

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Property Type *</Label>
                    <div className="flex flex-wrap gap-2" data-testid="select-property-type">
                      {PROPERTY_TYPES.map((pt) => (
                        <Button
                          key={pt}
                          type="button"
                          variant={contactInfo.propertyType === pt ? "default" : "outline"}
                          size="sm"
                          onClick={() => setContactInfo({ ...contactInfo, propertyType: pt })}
                          data-testid={`button-property-${pt.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {pt}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Service Type *</Label>
                    <div className="flex flex-wrap gap-2" data-testid="select-service-type">
                      {SERVICE_TYPES.map((st) => (
                        <Button
                          key={st}
                          type="button"
                          variant={contactInfo.serviceType === st ? "default" : "outline"}
                          size="sm"
                          onClick={() => setContactInfo({ ...contactInfo, serviceType: st })}
                          data-testid={`button-service-${st.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {st}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Project Size *</Label>
                    <div className="flex flex-wrap gap-2" data-testid="select-project-size">
                      {PROJECT_SIZES.map((ps) => (
                        <Button
                          key={ps}
                          type="button"
                          variant={contactInfo.projectSize === ps ? "default" : "outline"}
                          size="sm"
                          onClick={() => setContactInfo({ ...contactInfo, projectSize: ps })}
                          data-testid={`button-size-${ps.split(" ")[0].toLowerCase()}`}
                        >
                          {ps}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Timeline</Label>
                    <div className="flex flex-wrap gap-2" data-testid="select-timeline">
                      {TIMELINES.map((t) => (
                        <Button
                          key={t}
                          type="button"
                          variant={contactInfo.timeline === t ? "default" : "outline"}
                          size="sm"
                          onClick={() => setContactInfo({ ...contactInfo, timeline: t })}
                          data-testid={`button-timeline-${t.split(" ")[0].toLowerCase()}`}
                        >
                          {t}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget">Stated Budget</Label>
                    <Input
                      id="budget"
                      value={contactInfo.budget}
                      onChange={(e) => setContactInfo({ ...contactInfo, budget: e.target.value })}
                      placeholder="e.g. $3,000 - $5,000"
                      data-testid="input-budget"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={contactInfo.notes}
                    onChange={(e) => setContactInfo({ ...contactInfo, notes: e.target.value })}
                    placeholder="Any additional notes about this prospect..."
                    rows={3}
                    data-testid="input-notes"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <ScoreBar score={currentScoreData.score} maxScore={currentScoreData.maxScore} />
              {QUALIFICATION_QUESTIONS.map((q, qIndex) => (
                <Card key={qIndex}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                        {qIndex + 1}
                      </span>
                      {q.question}
                      {q.weight >= 3 && <Badge variant="secondary" className="text-xs">High Weight</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIndex) => {
                        const isSelected = answers[qIndex]?.answer === opt.label;
                        return (
                          <Button
                            key={optIndex}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            className={`h-auto py-3 px-4 text-left justify-start whitespace-normal ${
                              isSelected ? "" : "hover:bg-muted/50"
                            }`}
                            onClick={() => handleAnswer(qIndex, optIndex)}
                            data-testid={`button-answer-${qIndex}-${optIndex}`}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? "border-primary-foreground bg-primary-foreground" : "border-muted-foreground"
                              }`}>
                                {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                              </div>
                              <span className="text-sm">{opt.label}</span>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Qualification Result</span>
                    <RatingBadge rating={currentScoreData.rating} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScoreBar score={currentScoreData.score} maxScore={currentScoreData.maxScore} />

                  <div className="grid md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Contact</h3>
                      <div className="space-y-1 text-sm">
                        <p className="font-medium">{contactInfo.contactName}</p>
                        {contactInfo.companyName && <p className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-3 w-3" /> {contactInfo.companyName}</p>}
                        {contactInfo.contactEmail && <p className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {contactInfo.contactEmail}</p>}
                        {contactInfo.contactPhone && <p className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {contactInfo.contactPhone}</p>}
                        {contactInfo.location && <p className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" /> {contactInfo.location}</p>}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Project</h3>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Property:</span> {contactInfo.propertyType}</p>
                        <p><span className="text-muted-foreground">Service:</span> {contactInfo.serviceType}</p>
                        <p><span className="text-muted-foreground">Size:</span> {contactInfo.projectSize}</p>
                        {contactInfo.budget && <p className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-muted-foreground" /> {contactInfo.budget}</p>}
                        {contactInfo.timeline && <p className="flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" /> {contactInfo.timeline}</p>}
                        {contactInfo.source && <p><span className="text-muted-foreground">Source:</span> {contactInfo.source}</p>}
                      </div>
                    </div>
                  </div>

                  {answers.length > 0 && (
                    <div className="pt-2">
                      <h3 className="font-semibold mb-2">Question Responses</h3>
                      <div className="space-y-2">
                        {answers.filter(Boolean).map((a, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm p-2 bg-muted/30 rounded">
                            <Star className={`h-4 w-4 mt-0.5 flex-shrink-0 ${a.score >= 2 ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                            <div>
                              <p className="text-muted-foreground">{a.question}</p>
                              <p className="font-medium">{a.answer}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {contactInfo.notes && (
                    <div className="pt-2">
                      <h3 className="font-semibold mb-1">Notes</h3>
                      <p className="text-sm text-muted-foreground">{contactInfo.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex justify-between">
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} data-testid="button-prev-step">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
              )}
              <Button variant="ghost" onClick={resetForm} data-testid="button-reset">
                <RotateCcw className="h-4 w-4 mr-2" /> Start Over
              </Button>
            </div>
            <div className="flex gap-2">
              {step < totalSteps - 1 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 0 && (!contactInfo.contactName || !contactInfo.propertyType || !contactInfo.serviceType || !contactInfo.projectSize)}
                  data-testid="button-next-step"
                >
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-lead">
                  <Save className="h-4 w-4 mr-2" />
                  {saveMutation.isPending ? "Saving..." : "Save Lead"}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {loadingSaved ? (
            <div className="text-center py-12 text-muted-foreground">Loading saved leads...</div>
          ) : savedLeads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Saved Leads Yet</h3>
                <p className="text-muted-foreground mb-4">Qualify your first prospect to get started.</p>
                <Button onClick={() => setView("qualifier")} data-testid="button-start-qualifying">
                  <Target className="h-4 w-4 mr-2" /> Start Qualifying
                </Button>
              </CardContent>
            </Card>
          ) : (
            savedLeads.map((lead) => {
              const isExpanded = expandedLead === lead.id;
              const answersData = (lead.answers || []) as QuestionAnswer[];
              return (
                <Card key={lead.id} data-testid={`card-lead-${lead.id}`}>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpandedLead(isExpanded ? null : lead.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <RatingBadge rating={lead.rating} />
                        <div>
                          <CardTitle className="text-base">{lead.contactName}</CardTitle>
                          <CardDescription className="flex items-center gap-3 mt-1">
                            {lead.companyName && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {lead.companyName}</span>}
                            <span>{lead.serviceType}</span>
                            <span>{lead.projectSize}</span>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-sm">
                          <p className="font-semibold">{lead.score}/{lead.maxScore}</p>
                          <p className="text-muted-foreground text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : ""}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="space-y-4 border-t pt-4">
                      <ScoreBar score={lead.score} maxScore={lead.maxScore} />
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2 text-sm">
                          <h4 className="font-semibold">Contact Details</h4>
                          {lead.contactEmail && <p className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /> {lead.contactEmail}</p>}
                          {lead.contactPhone && <p className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" /> {lead.contactPhone}</p>}
                          {lead.location && <p className="flex items-center gap-2"><MapPin className="h-3 w-3 text-muted-foreground" /> {lead.location}</p>}
                          {lead.source && <p><span className="text-muted-foreground">Source:</span> {lead.source}</p>}
                        </div>
                        <div className="space-y-2 text-sm">
                          <h4 className="font-semibold">Project Details</h4>
                          <p><span className="text-muted-foreground">Property:</span> {lead.propertyType}</p>
                          <p><span className="text-muted-foreground">Service:</span> {lead.serviceType}</p>
                          <p><span className="text-muted-foreground">Size:</span> {lead.projectSize}</p>
                          {lead.budget && <p className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-muted-foreground" /> {lead.budget}</p>}
                          {lead.timeline && <p className="flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" /> {lead.timeline}</p>}
                        </div>
                      </div>
                      {answersData.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Qualification Responses</h4>
                          <div className="space-y-1">
                            {answersData.filter(Boolean).map((a: QuestionAnswer, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm p-2 bg-muted/30 rounded">
                                <Star className={`h-3 w-3 mt-0.5 flex-shrink-0 ${a.score >= 2 ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                                <div>
                                  <span className="text-muted-foreground">{a.question}</span>{" "}
                                  <span className="font-medium">{a.answer}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {lead.notes && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Notes</h4>
                          <p className="text-sm text-muted-foreground">{lead.notes}</p>
                        </div>
                      )}
                      <div className="flex justify-end pt-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this lead?")) {
                              deleteMutation.mutate(lead.id);
                            }
                          }}
                          data-testid={`button-delete-lead-${lead.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
