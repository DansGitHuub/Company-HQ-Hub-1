import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  HelpCircle,
  ChevronRight,
  Book,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  categoryId: string | null;
  minRole: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface HelpCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  minRole: string;
  sortOrder: number;
}

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: articles = [] } = useQuery<HelpArticle[]>({
    queryKey: ["/api/help/articles"],
  });

  const { data: categories = [] } = useQuery<HelpCategory[]>({
    queryKey: ["/api/help/categories"],
  });

  const { data: searchResults = [], isLoading: isSearching } = useQuery<HelpArticle[]>({
    queryKey: ["/api/help/articles/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/help/articles/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.trim().length > 0,
  });

  const displayedArticles = searchQuery.trim()
    ? searchResults
    : selectedCategory
    ? articles.filter((a) => a.categoryId === selectedCategory)
    : articles;

  const getCategoryIcon = (iconName: string | null) => {
    switch (iconName) {
      case "book":
        return <Book className="h-5 w-5" />;
      case "file":
        return <FileText className="h-5 w-5" />;
      default:
        return <HelpCircle className="h-5 w-5" />;
    }
  };

  if (selectedArticle) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => setSelectedArticle(null)}
          data-testid="back-to-articles"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Help Center
        </Button>

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border p-6"
        >
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">{selectedArticle.title}</h1>
          <p className="text-muted-foreground mb-6">{selectedArticle.summary}</p>
          <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
            {selectedArticle.content}
          </div>
        </motion.article>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4"
        >
          <HelpCircle className="h-8 w-8 text-primary" />
        </motion.div>
        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Help Center</h1>
        <p className="text-muted-foreground">
          Find answers to your questions and learn how to use Company HQ
        </p>
      </div>

      <div className="relative max-w-xl mx-auto mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search for help..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 text-lg"
          data-testid="help-search-input"
        />
      </div>

      {!searchQuery && categories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {categories.map((category) => (
            <motion.div
              key={category.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={`cursor-pointer transition-colors hover:border-primary ${
                  selectedCategory === category.id ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() =>
                  setSelectedCategory(selectedCategory === category.id ? null : category.id)
                }
                data-testid={`category-${category.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-primary/10 text-primary">
                      {getCategoryIcon(category.icon)}
                    </span>
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                  </div>
                </CardHeader>
                {category.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </CardContent>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div>
        {selectedCategory && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {categories.find((c) => c.id === selectedCategory)?.name || "Articles"}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)}>
              Show all
            </Button>
          </div>
        )}

        {searchQuery && (
          <div className="mb-4">
            <h2 className="text-xl font-semibold">
              {isSearching
                ? "Searching..."
                : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQuery}"`}
            </h2>
          </div>
        )}

        <ScrollArea className="h-[calc(100vh-400px)]">
          <AnimatePresence mode="popLayout">
            {displayedArticles.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-muted-foreground"
              >
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No articles found</p>
                <p className="text-sm mt-1">Try adjusting your search or browse categories</p>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {displayedArticles.map((article, index) => (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className="group p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedArticle(article)}
                    data-testid={`article-${article.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {article.summary}
                        </p>
                        {article.categoryId && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {categories.find((c) => c.id === article.categoryId)?.name || "General"}
                          </Badge>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </div>
    </div>
  );
}
