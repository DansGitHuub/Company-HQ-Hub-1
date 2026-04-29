import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Search, BookOpen, GraduationCap, Trophy, CheckCircle2, XCircle,
  ArrowLeft, Clock, Target, Loader2, AlertCircle, ChevronRight,
  Shield, Users, BarChart3, Settings, Flag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { SopQuiz, UserQuizAttempt, Sop } from "@shared/schema";
import { ViewQuizButton } from "@/components/QuizViewModal";

type CatalogEntry = {
  sop: Sop;
  quizzes: SopQuiz[];
};

interface AdaptiveQuestion {
  id: string;
  question: string;
  options: string[];
  difficultyLevel: number;
  sortOrder: number;
}

interface AnswerResult {
  questionId: string;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string | null;
  difficultyLevel: number;
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Foundational",
  2: "Competent",
  3: "Proficient",
  4: "Advanced",
  5: "Expert",
};

const DIFFICULTY_COLORS: Record<number, string> = {
  1: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  2: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  3: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  4: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  5: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function TestingKnowledge() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedSopEntry, setSelectedSopEntry] = useState<CatalogEntry | null>(null);
  const [mainTab, setMainTab] = useState("catalog");

  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [activeQuizTitle, setActiveQuizTitle] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<AdaptiveQuestion | null>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState(1);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [allAnswers, setAllAnswers] = useState<AnswerResult[]>([]);
  const [highestLevelPassed, setHighestLevelPassed] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [lastAnswerResult, setLastAnswerResult] = useState<AnswerResult | null>(null);
  const [showingFeedback, setShowingFeedback] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [isAnswering, setIsAnswering] = useState(false);

  const isManager = user?.role && ["Admin", "Master Admin", "Manager", "HR"].includes(user.role);

  const { data: catalog = [], isLoading: loadingCatalog } = useQuery<CatalogEntry[]>({
    queryKey: ["/api/quiz-catalog"],
  });

  const { data: myAttempts = [] } = useQuery<UserQuizAttempt[]>({
    queryKey: ["/api/quiz-attempts/me"],
  });

  const { data: employeeStats = [] } = useQuery<any[]>({
    queryKey: ["/api/quiz-stats/employees"],
    enabled: !!isManager && mainTab === "manager",
  });

  const { data: safetyFlags = [] } = useQuery<any[]>({
    queryKey: ["/api/quiz-stats/safety-flags"],
    enabled: !!isManager && mainTab === "manager",
  });

  const filteredCatalog = catalog.filter((entry) =>
    entry.sop.title.toLowerCase().includes(search.toLowerCase())
  );

  const getBestAttemptForQuiz = (quizId: string) => {
    const attempts = myAttempts.filter((a) => a.quizId === quizId);
    if (attempts.length === 0) return null;
    return attempts.reduce((best, curr) =>
      ((curr as any).highestLevelPassed || 0) > ((best as any).highestLevelPassed || 0) ? curr : best
    );
  };

  const startAdaptiveQuiz = async (quizId: string) => {
    try {
      const res = await apiRequest("POST", `/api/quizzes/${quizId}/start`);
      const data = await res.json();
      if (data.error) {
        toast({ title: "Cannot Start Quiz", description: data.message || data.error, variant: "destructive" });
        return;
      }
      setActiveQuizId(quizId);
      setActiveQuizTitle(data.quizTitle || "Adaptive Quiz");
      setCurrentQuestion(data.question);
      setCurrentDifficulty(data.currentDifficulty);
      setQuestionNumber(data.questionNumber);
      setAnsweredIds([]);
      setAllAnswers([]);
      setHighestLevelPassed(0);
      setSelectedOption(null);
      setLastAnswerResult(null);
      setShowingFeedback(false);
      setQuizFinished(false);
      setFinalResult(null);
    } catch (err) {
      toast({ title: "Error", description: "Failed to start quiz", variant: "destructive" });
    }
  };

  const submitAnswer = async () => {
    if (!activeQuizId || !currentQuestion || selectedOption === null) return;
    setIsAnswering(true);
    try {
      const res = await apiRequest("POST", `/api/quizzes/${activeQuizId}/answer`, {
        questionId: currentQuestion.id,
        selectedIndex: selectedOption,
        answeredQuestionIds: answeredIds,
        currentDifficulty,
        questionNumber,
      });
      const data = await res.json();
      const result = data.answerResult as AnswerResult;
      setLastAnswerResult(result);
      setShowingFeedback(true);

      const newAnswers = [...allAnswers, result];
      setAllAnswers(newAnswers);
      setAnsweredIds(data.answeredQuestionIds || [...answeredIds, currentQuestion.id]);

      if (result.isCorrect && result.difficultyLevel > highestLevelPassed) {
        setHighestLevelPassed(result.difficultyLevel);
      }

      if (data.finished) {
        setQuizFinished(true);
      } else {
        setCurrentDifficulty(data.currentDifficulty);
        setQuestionNumber(data.questionNumber);
        if (data.nextQuestion) {
          setTimeout(() => {}, 0);
          (window as any).__nextQuestion = data.nextQuestion;
        }
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to submit answer", variant: "destructive" });
    } finally {
      setIsAnswering(false);
    }
  };

  const proceedToNext = async () => {
    if (quizFinished) {
      try {
        const res = await apiRequest("POST", `/api/quizzes/${activeQuizId}/complete`, {
          answers: allAnswers,
          questionsServed: answeredIds,
          highestLevelPassed,
        });
        const data = await res.json();
        setFinalResult(data);
        queryClient.invalidateQueries({ queryKey: ["/api/quiz-attempts/me"] });
      } catch (err) {
        toast({ title: "Error", description: "Failed to save results", variant: "destructive" });
      }
    } else {
      const nq = (window as any).__nextQuestion;
      if (nq) {
        setCurrentQuestion(nq);
        (window as any).__nextQuestion = null;
      }
    }
    setShowingFeedback(false);
    setSelectedOption(null);
    setLastAnswerResult(null);
  };

  const resetQuiz = () => {
    setActiveQuizId(null);
    setCurrentQuestion(null);
    setQuizFinished(false);
    setFinalResult(null);
    setSelectedSopEntry(null);
    setAllAnswers([]);
    setAnsweredIds([]);
    setHighestLevelPassed(0);
  };

  if (finalResult) {
    return (
      <div className="max-w-2xl mx-auto space-y-6" data-testid="quiz-results-view">
        <Button variant="ghost" size="sm" onClick={resetQuiz} data-testid="button-back-catalog">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Catalog
        </Button>

        <Card className={`border-2 ${finalResult.passed ? "border-green-500" : "border-orange-500"}`}>
          <CardContent className="p-8 text-center space-y-4">
            {finalResult.passed ? (
              <Trophy className="h-16 w-16 mx-auto text-green-500" />
            ) : (
              <AlertCircle className="h-16 w-16 mx-auto text-orange-500" />
            )}
            <h2 className="text-2xl font-bold" data-testid="text-final-label">
              {finalResult.finalScoreLabel || "Complete"}
            </h2>
            <p className="text-muted-foreground">
              Highest Level Reached: <span className="font-bold">Level {finalResult.highestLevelPassed}</span> ({DIFFICULTY_LABELS[finalResult.highestLevelPassed] || "N/A"})
            </p>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold" data-testid="text-final-score">{finalResult.score}/{finalResult.totalQuestions}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{Math.round((finalResult.score / finalResult.totalQuestions) * 100)}%</p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
            </div>
            <Badge variant={finalResult.passed ? "default" : "secondary"} className={`text-sm px-4 py-1 ${finalResult.passed ? "bg-green-500" : ""}`}>
              {finalResult.passed ? "PASSED" : `Need Level ${finalResult.minPassLevel} to Pass`}
            </Badge>

            <div className="flex w-full gap-1 mt-4">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={`flex-1 h-3 rounded-full ${level <= finalResult.highestLevelPassed ? DIFFICULTY_COLORS[level].split(" ")[0] : "bg-muted"}`}
                  title={`Level ${level}: ${DIFFICULTY_LABELS[level]}`}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Foundational</span>
              <span>Expert</span>
            </div>
          </CardContent>
        </Card>

        {finalResult.reviewAreas && finalResult.reviewAreas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Areas to Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {finalResult.reviewAreas.map((area: string, i: number) => (
                <div key={i} className="text-sm p-2 bg-muted rounded-lg" data-testid={`review-area-${i}`}>{area}</div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={() => { resetQuiz(); if (activeQuizId) startAdaptiveQuiz(activeQuizId); }} data-testid="button-retake">
            Retake Quiz
          </Button>
          <Button variant="outline" onClick={resetQuiz} data-testid="button-back-to-catalog">
            Back to Catalog
          </Button>
        </div>
      </div>
    );
  }

  if (activeQuizId && currentQuestion) {
    return (
      <div className="max-w-3xl mx-auto space-y-6" data-testid="quiz-active-view">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{activeQuizTitle}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge className={DIFFICULTY_COLORS[currentDifficulty]} data-testid="badge-difficulty">
                Level {currentDifficulty} — {DIFFICULTY_LABELS[currentDifficulty]}
              </Badge>
              <span className="text-sm text-muted-foreground">Question {questionNumber}</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={resetQuiz}>
            <XCircle className="h-4 w-4 mr-1" /> Quit
          </Button>
        </div>

        <div className="flex gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className={`flex-1 h-2 rounded-full transition-colors ${level <= currentDifficulty ? DIFFICULTY_COLORS[level].split(" ")[0] : "bg-muted"}`}
              title={DIFFICULTY_LABELS[level]}
            />
          ))}
        </div>

        <Card data-testid="card-current-question">
          <CardContent className="p-6">
            {showingFeedback && lastAnswerResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${lastAnswerResult.isCorrect ? "bg-green-50 dark:bg-green-950/30 border border-green-200" : "bg-red-50 dark:bg-red-950/30 border border-red-200"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {lastAnswerResult.isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium" data-testid="text-answer-feedback">
                      {lastAnswerResult.isCorrect ? "Correct!" : "Incorrect"}
                    </span>
                  </div>
                  <p className="text-sm font-medium mb-2">{currentQuestion.question}</p>
                  {!lastAnswerResult.isCorrect && (
                    <p className="text-sm">
                      Correct answer: <span className="font-medium">{(currentQuestion.options as string[])[lastAnswerResult.correctIndex]}</span>
                    </p>
                  )}
                  {lastAnswerResult.explanation && (
                    <p className="text-sm mt-2 opacity-80">{lastAnswerResult.explanation}</p>
                  )}
                </div>
                <Button onClick={proceedToNext} className="w-full" data-testid="button-next-question">
                  {quizFinished ? "See Results" : "Next Question"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-lg font-medium" data-testid="text-question">{currentQuestion.question}</p>
                <div className="grid gap-2">
                  {(currentQuestion.options as string[]).map((option, oIndex) => (
                    <div
                      key={oIndex}
                      className={`border p-3 rounded-lg cursor-pointer transition-all text-sm ${
                        selectedOption === oIndex
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "hover:border-primary/50 hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedOption(oIndex)}
                      data-testid={`option-${oIndex}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold">
                          {String.fromCharCode(65 + oIndex)}
                        </span>
                        <span>{option}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full"
                  disabled={selectedOption === null || isAnswering}
                  onClick={submitAnswer}
                  data-testid="button-submit-answer"
                >
                  {isAnswering ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking...</> : "Submit Answer"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          Highest level reached so far: <span className="font-medium">Level {highestLevelPassed} ({DIFFICULTY_LABELS[highestLevelPassed] || "—"})</span>
        </div>
      </div>
    );
  }

  if (selectedSopEntry) {
    const quizzes = selectedSopEntry.quizzes;
    const adaptiveQuiz = quizzes.find((q) => q.skillLevel === "adaptive") || quizzes[0];
    const bestAttempt = adaptiveQuiz ? getBestAttemptForQuiz(adaptiveQuiz.id) : null;
    const attemptCount = adaptiveQuiz ? myAttempts.filter((a) => a.quizId === adaptiveQuiz.id).length : 0;

    return (
      <div className="max-w-4xl mx-auto space-y-6" data-testid="sop-quiz-selection">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSopEntry(null)} data-testid="button-back-to-list">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Catalog
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">{selectedSopEntry.sop.title}</h1>
            <p className="text-muted-foreground text-sm">Adaptive difficulty quiz — adjusts to your skill level</p>
          </div>
        </div>

        {adaptiveQuiz ? (
          <Card data-testid="card-adaptive-quiz">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                {adaptiveQuiz.title}
              </CardTitle>
              <CardDescription>{adaptiveQuiz.description || "Questions adapt to your skill level. Answer correctly to unlock harder questions."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold" data-testid="text-question-count">{adaptiveQuiz.questionCount}</p>
                  <p className="text-xs text-muted-foreground">Questions</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold" data-testid="text-attempt-count">{attemptCount}</p>
                  <p className="text-xs text-muted-foreground">Attempts</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold" data-testid="text-best-level">
                    {bestAttempt ? `L${(bestAttempt as any).highestLevelPassed || 0}` : "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">Best Level</p>
                </div>
              </div>

              {bestAttempt && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={bestAttempt.passed ? "default" : "secondary"} className={bestAttempt.passed ? "bg-green-500" : ""}>
                    {bestAttempt.passed ? "PASSED" : "NOT PASSED"}
                  </Badge>
                  <Badge className={DIFFICULTY_COLORS[(bestAttempt as any).highestLevelPassed || 1]}>
                    {(bestAttempt as any).finalScoreLabel || DIFFICULTY_LABELS[(bestAttempt as any).highestLevelPassed || 0]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Best: {bestAttempt.score}/{bestAttempt.totalQuestions}
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Difficulty Levels</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div key={level} className="flex-1">
                      <div className={`h-2 rounded-full ${level <= ((bestAttempt as any)?.highestLevelPassed || 0) ? DIFFICULTY_COLORS[level].split(" ")[0] : "bg-muted"}`} />
                      <p className="text-[10px] text-center text-muted-foreground mt-0.5">{DIFFICULTY_LABELS[level]}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={() => startAdaptiveQuiz(adaptiveQuiz.id)}
                  data-testid="button-start-adaptive"
                >
                  {bestAttempt ? "Retake Quiz" : "Start Adaptive Quiz"}
                </Button>
                <ViewQuizButton
                  quizId={adaptiveQuiz.id}
                  quizTitle={adaptiveQuiz.title}
                  size="lg"
                  variant="outline"
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No quiz available for this SOP yet.</p>
            </CardContent>
          </Card>
        )}

        {quizzes.filter((q) => q.skillLevel !== "adaptive").length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legacy Quizzes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quizzes.filter((q) => q.skillLevel !== "adaptive").map((quiz) => {
                const best = getBestAttemptForQuiz(quiz.id);
                return (
                  <div key={quiz.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{quiz.title}</p>
                      <p className="text-xs text-muted-foreground">{quiz.questionCount} questions</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {best && (
                        <Badge variant={best.passed ? "default" : "secondary"} className={best.passed ? "bg-green-500" : ""}>
                          {best.passed ? "Passed" : `${best.score}/${best.totalQuestions}`}
                        </Badge>
                      )}
                      <ViewQuizButton quizId={quiz.id} quizTitle={quiz.title} />
                      <Button size="sm" variant="outline" onClick={() => startAdaptiveQuiz(quiz.id)}>
                        Take
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="testing-knowledge-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-8 w-8" />
            Training & Knowledge
          </h1>
          <p className="text-muted-foreground mt-1">Take adaptive quizzes to test your knowledge of company procedures</p>
        </div>
      </div>

      {isManager && (
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList>
            <TabsTrigger value="catalog" data-testid="tab-catalog">
              <BookOpen className="h-4 w-4 mr-1" /> Quiz Catalog
            </TabsTrigger>
            <TabsTrigger value="manager" data-testid="tab-manager">
              <BarChart3 className="h-4 w-4 mr-1" /> Team Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manager" className="mt-4 space-y-6">
            <ManagerQuizView
              employeeStats={employeeStats}
              safetyFlags={safetyFlags}
              catalog={catalog}
            />
          </TabsContent>

          <TabsContent value="catalog" className="mt-4">
            <QuizCatalog
              catalog={filteredCatalog}
              loadingCatalog={loadingCatalog}
              search={search}
              setSearch={setSearch}
              getBestAttemptForQuiz={getBestAttemptForQuiz}
              setSelectedSopEntry={setSelectedSopEntry}
              catalogCount={catalog.length}
            />
          </TabsContent>
        </Tabs>
      )}

      {!isManager && (
        <QuizCatalog
          catalog={filteredCatalog}
          loadingCatalog={loadingCatalog}
          search={search}
          setSearch={setSearch}
          getBestAttemptForQuiz={getBestAttemptForQuiz}
          setSelectedSopEntry={setSelectedSopEntry}
          catalogCount={catalog.length}
        />
      )}
    </div>
  );
}

function QuizCatalog({
  catalog, loadingCatalog, search, setSearch, getBestAttemptForQuiz, setSelectedSopEntry, catalogCount,
}: {
  catalog: CatalogEntry[];
  loadingCatalog: boolean;
  search: string;
  setSearch: (s: string) => void;
  getBestAttemptForQuiz: (id: string) => any;
  setSelectedSopEntry: (e: CatalogEntry) => void;
  catalogCount: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search quizzes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-quizzes"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span data-testid="text-catalog-count">{catalogCount} SOP{catalogCount !== 1 ? "s" : ""} with quizzes</span>
        </div>
      </div>

      {loadingCatalog ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : catalog.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <GraduationCap className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Quizzes Available Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Quizzes are generated from SOPs. Ask an admin to create quizzes from the SOP Library.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalog.map((entry) => {
            const adaptiveQuiz = entry.quizzes.find((q) => q.skillLevel === "adaptive");
            const quizToCheck = adaptiveQuiz || entry.quizzes[0];
            const best = quizToCheck ? getBestAttemptForQuiz(quizToCheck.id) : null;

            return (
              <Card
                key={entry.sop.id}
                className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/50"
                onClick={() => setSelectedSopEntry(entry)}
                data-testid={`card-sop-quiz-${entry.sop.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-2">{entry.sop.title}</CardTitle>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                  {entry.sop.sopType && (
                    <Badge variant="outline" className="text-xs w-fit">{entry.sop.sopType}</Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Target className="h-3.5 w-3.5" />
                      <span>Adaptive</span>
                    </div>
                    {best ? (
                      <Badge className={DIFFICULTY_COLORS[best.highestLevelPassed || 1] || ""}>
                        Level {best.highestLevelPassed || 0}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Not started</Badge>
                    )}
                  </div>
                  {best && (
                    <div className="flex gap-0.5 mt-3">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`flex-1 h-1.5 rounded-full ${level <= (best.highestLevelPassed || 0) ? DIFFICULTY_COLORS[level].split(" ")[0] : "bg-muted"}`}
                        />
                      ))}
                    </div>
                  )}
                  {quizToCheck && (
                    <div className="mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                      <ViewQuizButton
                        quizId={quizToCheck.id}
                        quizTitle={entry.sop.title}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ManagerQuizView({ employeeStats, safetyFlags, catalog }: { employeeStats: any[]; safetyFlags: any[]; catalog: CatalogEntry[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateSettingsMutation = useMutation({
    mutationFn: async ({ quizId, ...data }: { quizId: string; minPassLevel?: number; isSafetyCritical?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/quizzes/${quizId}/settings`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quiz-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quiz-stats/safety-flags"] });
      toast({ title: "Quiz settings updated" });
    },
  });

  const groupedByEmployee = employeeStats.reduce((acc: any, stat: any) => {
    if (!acc[stat.user_id]) {
      acc[stat.user_id] = { name: stat.name || stat.username, role: stat.role, quizzes: [] };
    }
    acc[stat.user_id].quizzes.push(stat);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {safetyFlags.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-600">
              <Flag className="h-4 w-4" /> Safety-Critical Alerts
            </CardTitle>
            <CardDescription>Employees who haven't reached Level 2 on safety-critical SOPs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {safetyFlags.map((flag: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg" data-testid={`safety-flag-${i}`}>
                  <div>
                    <p className="font-medium text-sm">{flag.name || flag.username}</p>
                    <p className="text-xs text-muted-foreground">{flag.role} — {flag.sop_title || flag.quiz_title}</p>
                  </div>
                  <Badge variant="destructive">Level {flag.best_level} / Need {flag.min_pass_level}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Employee Mastery Levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedByEmployee).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No quiz attempts recorded yet</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByEmployee).map(([userId, data]: [string, any]) => (
                <div key={userId} className="border rounded-lg p-4" data-testid={`employee-stats-${userId}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{data.name}</p>
                      <Badge variant="outline" className="text-xs">{data.role}</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {data.quizzes.map((stat: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1">
                        <span className="text-muted-foreground truncate flex-1">{stat.quiz_title}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={DIFFICULTY_COLORS[stat.best_level || 1]}>
                            L{stat.best_level}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{stat.attempt_count} tries</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" /> Quiz Settings
          </CardTitle>
          <CardDescription>Set minimum pass levels and mark safety-critical quizzes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {catalog.map((entry) => {
              const quiz = entry.quizzes.find((q) => q.skillLevel === "adaptive") || entry.quizzes[0];
              if (!quiz) return null;
              return (
                <div key={quiz.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`quiz-settings-${quiz.id}`}>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{entry.sop.title}</p>
                    <p className="text-xs text-muted-foreground">{quiz.questionCount} questions</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Min Level</Label>
                      <Select
                        defaultValue={String((quiz as any).minPassLevel || 2)}
                        onValueChange={(val) => updateSettingsMutation.mutate({ quizId: quiz.id, minPassLevel: parseInt(val) })}
                      >
                        <SelectTrigger className="w-20 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((l) => (
                            <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Switch
                        defaultChecked={(quiz as any).isSafetyCritical || false}
                        onCheckedChange={(checked) => updateSettingsMutation.mutate({ quizId: quiz.id, isSafetyCritical: checked })}
                      />
                      <Label className="text-xs">Safety Critical</Label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
