import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Search, BookOpen, GraduationCap, Trophy, CheckCircle2, XCircle,
  ArrowLeft, Clock, Target, Loader2, AlertCircle, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { SopQuiz, SopQuizQuestion, UserQuizAttempt, Sop } from "@shared/schema";

type CatalogEntry = {
  sop: Sop;
  quizzes: SopQuiz[];
};

type QuizWithQuestions = SopQuiz & { questions: SopQuizQuestion[] };

export default function TestingKnowledge() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState<QuizWithQuestions | null>(null);
  const [selectedSopEntry, setSelectedSopEntry] = useState<CatalogEntry | null>(null);
  const [activeSkillTab, setActiveSkillTab] = useState("beginner");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<UserQuizAttempt | null>(null);
  const [showExplanations, setShowExplanations] = useState(false);

  const { data: catalog = [], isLoading: loadingCatalog } = useQuery<CatalogEntry[]>({
    queryKey: ["/api/quiz-catalog"],
  });

  const { data: myAttempts = [] } = useQuery<UserQuizAttempt[]>({
    queryKey: ["/api/quiz-attempts/me"],
  });

  const fetchQuizMutation = useMutation({
    mutationFn: async (quizId: string) => {
      const res = await apiRequest("GET", `/api/quizzes/${quizId}`);
      return await res.json();
    },
    onSuccess: (data: QuizWithQuestions) => {
      setSelectedQuiz(data);
      setQuizAnswers({});
      setQuizResult(null);
      setShowExplanations(false);
    },
  });

  const submitQuizMutation = useMutation({
    mutationFn: async ({ quizId, answers }: { quizId: string; answers: number[] }) => {
      const res = await apiRequest("POST", `/api/quizzes/${quizId}/attempts`, { answers });
      return await res.json();
    },
    onSuccess: (data: UserQuizAttempt) => {
      setQuizResult(data);
      setShowExplanations(true);
      queryClient.invalidateQueries({ queryKey: ["/api/quiz-attempts/me"] });
      toast({
        title: data.passed ? "Quiz Passed!" : "Quiz Not Passed",
        description: `You scored ${data.score}/${data.totalQuestions} (${Math.round((data.score / data.totalQuestions) * 100)}%)`,
      });
    },
  });

  const filteredCatalog = catalog.filter((entry) =>
    entry.sop.title.toLowerCase().includes(search.toLowerCase())
  );

  const getAttemptForQuiz = (quizId: string) => {
    return myAttempts.find((a) => a.quizId === quizId);
  };

  const getBestAttemptForQuiz = (quizId: string) => {
    const attempts = myAttempts.filter((a) => a.quizId === quizId);
    if (attempts.length === 0) return null;
    return attempts.reduce((best, curr) => (curr.score > best.score ? curr : best));
  };

  const handleStartQuiz = (quizId: string) => {
    fetchQuizMutation.mutate(quizId);
  };

  const handleSubmitQuiz = () => {
    if (!selectedQuiz) return;
    const totalQuestions = selectedQuiz.questions.length;
    const answers = Array.from({ length: totalQuestions }, (_, i) => quizAnswers[i] ?? -1);
    
    const unanswered = answers.filter((a) => a === -1).length;
    if (unanswered > 0) {
      toast({
        title: "Incomplete Quiz",
        description: `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. Please answer all questions.`,
        variant: "destructive",
      });
      return;
    }

    submitQuizMutation.mutate({ quizId: selectedQuiz.id, answers });
  };

  const handleBackToList = () => {
    setSelectedQuiz(null);
    setSelectedSopEntry(null);
    setQuizAnswers({});
    setQuizResult(null);
    setShowExplanations(false);
  };

  const handleBackToSop = () => {
    setSelectedQuiz(null);
    setQuizAnswers({});
    setQuizResult(null);
    setShowExplanations(false);
  };

  if (selectedQuiz) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="quiz-active-view">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBackToSop} data-testid="button-back-to-sop">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{selectedQuiz.title}</h1>
            <p className="text-muted-foreground text-sm">{selectedQuiz.description}</p>
          </div>
        </div>

        {quizResult && (
          <Card className={`border-2 ${quizResult.passed ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-orange-500 bg-orange-50 dark:bg-orange-950/20"}`} data-testid="quiz-result-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                {quizResult.passed ? (
                  <Trophy className="h-10 w-10 text-green-500" />
                ) : (
                  <AlertCircle className="h-10 w-10 text-orange-500" />
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold" data-testid="text-quiz-score">
                    Score: {quizResult.score}/{quizResult.totalQuestions} ({Math.round((quizResult.score / quizResult.totalQuestions) * 100)}%)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {quizResult.passed ? "Congratulations! You passed this quiz." : "You need 70% to pass. Review the explanations and try again."}
                  </p>
                </div>
                <Badge variant={quizResult.passed ? "default" : "secondary"} className={quizResult.passed ? "bg-green-500" : ""} data-testid="badge-pass-status">
                  {quizResult.passed ? "PASSED" : "NOT PASSED"}
                </Badge>
              </div>
              <Progress value={(quizResult.score / quizResult.totalQuestions) * 100} className="mt-4" />
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {selectedQuiz.questions.map((question, qIndex) => {
            const resultAnswer = quizResult ? (quizResult.answers as any[])?.[qIndex] : null;
            const isCorrect = resultAnswer?.isCorrect;
            const selectedAnswer = quizResult ? resultAnswer?.selectedIndex : quizAnswers[qIndex];

            return (
              <Card
                key={question.id}
                className={`${quizResult ? (isCorrect ? "border-green-300" : "border-red-300") : ""}`}
                data-testid={`card-question-${qIndex}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                      {qIndex + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium" data-testid={`text-question-${qIndex}`}>{question.question}</p>
                      {question.isStandard && (
                        <Badge variant="outline" className="mt-1 text-xs">Standard Question</Badge>
                      )}
                    </div>
                    {quizResult && (
                      isCorrect ? <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" /> : <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                  </div>

                  <div className="grid gap-2 ml-11">
                    {(question.options as string[]).map((option, oIndex) => {
                      const isSelected = selectedAnswer === oIndex;
                      const isCorrectOption = quizResult && oIndex === question.correctIndex;
                      let optionClass = "border p-3 rounded-lg cursor-pointer transition-all text-sm";

                      if (quizResult) {
                        if (isCorrectOption) {
                          optionClass += " border-green-500 bg-green-50 dark:bg-green-950/30";
                        } else if (isSelected && !isCorrect) {
                          optionClass += " border-red-500 bg-red-50 dark:bg-red-950/30";
                        } else {
                          optionClass += " opacity-60";
                        }
                      } else {
                        optionClass += isSelected
                          ? " border-primary bg-primary/5 ring-2 ring-primary/20"
                          : " hover:border-primary/50 hover:bg-muted/50";
                      }

                      return (
                        <div
                          key={oIndex}
                          className={optionClass}
                          onClick={() => {
                            if (!quizResult) {
                              setQuizAnswers((prev) => ({ ...prev, [qIndex]: oIndex }));
                            }
                          }}
                          data-testid={`option-${qIndex}-${oIndex}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold">
                              {String.fromCharCode(65 + oIndex)}
                            </span>
                            <span>{option}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {showExplanations && question.explanation && (
                    <div className="mt-3 ml-11 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm">
                      <span className="font-medium text-blue-700 dark:text-blue-400">Explanation: </span>
                      <span className="text-blue-600 dark:text-blue-300">{question.explanation}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {Object.keys(quizAnswers).length}/{selectedQuiz.questions.length} answered
          </p>
          {!quizResult ? (
            <Button
              size="lg"
              onClick={handleSubmitQuiz}
              disabled={submitQuizMutation.isPending}
              data-testid="button-submit-quiz"
            >
              {submitQuizMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Grading...</>
              ) : (
                <>Submit Quiz</>
              )}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowExplanations(!showExplanations)} data-testid="button-toggle-explanations">
                {showExplanations ? "Hide Explanations" : "Show Explanations"}
              </Button>
              <Button onClick={() => {
                setQuizAnswers({});
                setQuizResult(null);
                setShowExplanations(false);
              }} data-testid="button-retake-quiz">
                Retake Quiz
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedSopEntry) {
    const quizzes = selectedSopEntry.quizzes;
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="sop-quiz-selection">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBackToList} data-testid="button-back-to-list">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Catalog
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{selectedSopEntry.sop.title}</h1>
            <p className="text-muted-foreground text-sm">Select a skill level to start the quiz</p>
          </div>
        </div>

        <Tabs value={activeSkillTab} onValueChange={setActiveSkillTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="beginner" data-testid="tab-beginner">Beginner</TabsTrigger>
            <TabsTrigger value="intermediate" data-testid="tab-intermediate">Intermediate</TabsTrigger>
            <TabsTrigger value="advanced" data-testid="tab-advanced">Advanced</TabsTrigger>
          </TabsList>

          {["beginner", "intermediate", "advanced"].map((level) => {
            const quiz = quizzes.find((q) => q.skillLevel === level);
            const bestAttempt = quiz ? getBestAttemptForQuiz(quiz.id) : null;
            const attemptCount = quiz ? myAttempts.filter((a) => a.quizId === quiz.id).length : 0;

            return (
              <TabsContent key={level} value={level}>
                {quiz ? (
                  <Card data-testid={`card-quiz-${level}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5" />
                        {quiz.title}
                      </CardTitle>
                      <CardDescription>{quiz.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-2xl font-bold" data-testid={`text-question-count-${level}`}>{quiz.questionCount}</p>
                          <p className="text-xs text-muted-foreground">Questions</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-2xl font-bold" data-testid={`text-attempt-count-${level}`}>{attemptCount}</p>
                          <p className="text-xs text-muted-foreground">Attempts</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-2xl font-bold" data-testid={`text-best-score-${level}`}>
                            {bestAttempt ? `${Math.round((bestAttempt.score / bestAttempt.totalQuestions) * 100)}%` : "--"}
                          </p>
                          <p className="text-xs text-muted-foreground">Best Score</p>
                        </div>
                      </div>

                      {bestAttempt && (
                        <div className="flex items-center gap-2">
                          <Badge variant={bestAttempt.passed ? "default" : "secondary"} className={bestAttempt.passed ? "bg-green-500" : ""}>
                            {bestAttempt.passed ? "PASSED" : "NOT PASSED"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Best: {bestAttempt.score}/{bestAttempt.totalQuestions}
                          </span>
                        </div>
                      )}

                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => handleStartQuiz(quiz.id)}
                        disabled={fetchQuizMutation.isPending}
                        data-testid={`button-start-quiz-${level}`}
                      >
                        {fetchQuizMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</>
                        ) : (
                          <>{bestAttempt ? "Retake Quiz" : "Start Quiz"}</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground">No quiz available for this skill level yet.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="testing-knowledge-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-8 w-8" />
            Testing & Knowledge
          </h1>
          <p className="text-muted-foreground mt-1">Take quizzes to test your knowledge of company procedures</p>
        </div>
      </div>

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
          <span data-testid="text-catalog-count">{catalog.length} SOP{catalog.length !== 1 ? "s" : ""} with quizzes</span>
        </div>
      </div>

      {loadingCatalog ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCatalog.length === 0 ? (
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
          {filteredCatalog.map((entry) => {
            const totalQuizzes = entry.quizzes.length;
            const passedQuizzes = entry.quizzes.filter((q) => {
              const best = getBestAttemptForQuiz(q.id);
              return best?.passed;
            }).length;

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
                    <Badge variant="outline" className="text-xs w-fit">
                      {entry.sop.sopType}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Target className="h-3.5 w-3.5" />
                      <span>{totalQuizzes} skill levels</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {passedQuizzes > 0 ? (
                        <Badge variant="default" className="bg-green-500 text-xs">
                          {passedQuizzes}/{totalQuizzes} passed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Not started</Badge>
                      )}
                    </div>
                  </div>
                  {passedQuizzes > 0 && (
                    <Progress value={(passedQuizzes / totalQuizzes) * 100} className="mt-3 h-1.5" />
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
