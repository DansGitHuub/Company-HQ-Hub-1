import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, CheckCircle2, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type QuizQuestion = {
  id: string;
  quizId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  difficultyLevel: number;
  sortOrder: number;
};

type QuizWithQuestions = {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  skillLevel: string;
  questions: QuizQuestion[];
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Basic",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  2: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  3: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  4: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  5: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

function QuestionCard({ question, index }: { question: QuizQuestion; index: number }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className="border rounded-xl overflow-hidden"
      data-testid={`question-card-${index}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">{question.question}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`text-[10px] px-1.5 ${LEVEL_COLORS[question.difficultyLevel] || LEVEL_COLORS[1]}`}>
            {LEVEL_LABELS[question.difficultyLevel] || `L${question.difficultyLevel}`}
          </Badge>
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-2 border-t bg-muted/20">
          {(question.options || []).map((opt, i) => {
            const isCorrect = i === question.correctIndex;
            return (
              <div
                key={i}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg text-sm ${
                  isCorrect
                    ? "bg-green-500/10 border border-green-500/30 text-green-800 dark:text-green-300"
                    : "bg-background border border-border text-muted-foreground"
                }`}
                data-testid={isCorrect ? `correct-answer-${index}` : `option-${index}-${i}`}
              >
                <span className={`shrink-0 flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${
                  isCorrect ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className={`flex-1 leading-snug ${isCorrect ? "font-medium" : ""}`}>{opt}</span>
                {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
              </div>
            );
          })}

          {question.explanation && (
            <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <BookOpen className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{question.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuizContent({ quizId }: { quizId: string }) {
  const { data: quiz, isLoading, error } = useQuery<QuizWithQuestions>({
    queryKey: ["/api/quizzes", quizId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/quizzes/${quizId}`);
      return res.json();
    },
  });

  const [levelFilter, setLevelFilter] = useState<number | "all">("all");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="text-center text-muted-foreground py-10">
        Failed to load quiz questions.
      </div>
    );
  }

  const questions = quiz.questions || [];
  const levels = [...new Set(questions.map((q) => q.difficultyLevel))].sort((a, b) => a - b);
  const isAdaptive = quiz.skillLevel === "adaptive";

  const filtered = levelFilter === "all"
    ? questions
    : questions.filter((q) => q.difficultyLevel === levelFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h3 className="font-semibold text-base">{quiz.title}</h3>
          {quiz.description && <p className="text-xs text-muted-foreground mt-0.5">{quiz.description}</p>}
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="outline">{questions.length} questions</Badge>
          {quiz.skillLevel && (
            <Badge variant="secondary" className="capitalize">{quiz.skillLevel}</Badge>
          )}
        </div>
      </div>

      {isAdaptive && levels.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setLevelFilter("all")}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${levelFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            data-testid="filter-all-levels"
          >
            All Levels
          </button>
          {levels.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${levelFilter === lvl ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              data-testid={`filter-level-${lvl}`}
            >
              {LEVEL_LABELS[lvl] || `Level ${lvl}`}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No questions at this level.</p>
        ) : (
          filtered.map((q, i) => (
            <QuestionCard key={q.id} question={q} index={i} />
          ))
        )}
      </div>
    </div>
  );
}

interface QuizViewModalProps {
  quizId: string | null;
  quizTitle?: string;
  open: boolean;
  onClose: () => void;
}

export function QuizViewModal({ quizId, quizTitle, open, onClose }: QuizViewModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden" data-testid="quiz-view-modal">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            {quizTitle || "Quiz Preview"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {quizId ? <QuizContent quizId={quizId} /> : null}
        </div>
        <div className="px-6 py-3 border-t shrink-0 flex justify-end">
          <Button variant="outline" onClick={onClose} data-testid="close-quiz-view">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ViewQuizButtonProps {
  quizId: string;
  quizTitle?: string;
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function ViewQuizButton({ quizId, quizTitle, variant = "outline", size = "sm", className = "" }: ViewQuizButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        data-testid={`button-view-quiz-${quizId}`}
      >
        <Eye className="h-3.5 w-3.5 mr-1.5" />
        View Quiz
      </Button>
      <QuizViewModal
        quizId={quizId}
        quizTitle={quizTitle}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
