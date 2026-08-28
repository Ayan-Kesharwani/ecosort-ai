import { useState } from "react";
import {
  useGetTrashHistory,
  getGetTrashHistoryQueryKey,
  useGetTrashAnalysis,
  getGetTrashAnalysisQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { Search, Info, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function History() {
  const { data: history, isLoading } = useGetTrashHistory({ query: { queryKey: getGetTrashHistoryQueryKey() } });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filteredHistory = history?.filter((item) => 
    item.summary?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analysis History</h1>
          <p className="text-muted-foreground">Review past scans and their segregation details.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Search summaries..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : !filteredHistory?.length ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Info className="text-muted-foreground" size={32} />
              </div>
              <h3 className="text-lg font-medium">No history found</h3>
              <p className="text-muted-foreground mt-1">You haven't analyzed any trash yet, or no results match your search.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredHistory.map((session) => (
                <div 
                  key={session.id}
                  onClick={() => setSelectedId(session.id)}
                  className="p-4 sm:px-6 flex items-center justify-between hover:bg-muted/50 cursor-pointer transition-colors group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 flex-1 min-w-0">
                    <div className="w-32 shrink-0">
                      <p className="text-sm font-medium">{format(new Date(session.createdAt), "MMM d, yyyy")}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(session.createdAt), "h:mm a")}</p>
                    </div>
                    
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium truncate">{session.summary || "No summary available"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="font-mono text-xs">
                          {session.itemCount} Items
                        </Badge>
                        <span className="text-xs text-muted-foreground">•</span>
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <span className={session.overallRecyclablePercent >= 50 ? "text-primary" : "text-muted-foreground"}>
                            {Math.round(session.overallRecyclablePercent)}% Recyclable
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AnalysisDetailSheet 
        id={selectedId} 
        open={selectedId !== null} 
        onOpenChange={(open) => !open && setSelectedId(null)} 
      />
    </div>
  );
}

function AnalysisDetailSheet({ id, open, onOpenChange }: { id: number | null, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { data: detail, isLoading } = useGetTrashAnalysis(id as number, {
    query: { enabled: !!id, queryKey: getGetTrashAnalysisQueryKey(id as number) },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col p-0 border-l">
        {isLoading || !detail ? (
          <div className="p-6 space-y-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-64 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b bg-muted/30">
              <SheetHeader>
                <SheetTitle>Analysis #{detail.id}</SheetTitle>
                <SheetDescription>
                  Scanned on {format(new Date(detail.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                </SheetDescription>
              </SheetHeader>
            </div>
            
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-8">
                {detail.imageBase64 && (
                  <div className="rounded-lg overflow-hidden border shadow-sm max-h-64 flex justify-center bg-black/5">
                    <img 
                      src={`data:image/jpeg;base64,${detail.imageBase64}`} 
                      alt="Analyzed trash" 
                      className="object-contain h-full max-w-full" 
                    />
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Overall Composition</h3>
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-semibold text-lg">{Math.round(detail.overallRecyclablePercent)}% Recyclable</span>
                  </div>
                  <Progress value={detail.overallRecyclablePercent} className="h-2 bg-secondary" />
                  <p className="mt-3 text-sm">{detail.summary}</p>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-4">Detected Items ({detail.items.length})</h3>
                  <div className="space-y-3">
                    {detail.items.map((item, idx) => (
                      <div key={idx} className="border rounded-md p-3 bg-card flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{item.name}</span>
                          {item.recyclable ? (
                            <Badge className="bg-primary/10 text-primary border-transparent text-[10px] h-5">Recyclable</Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-transparent text-[10px] h-5">Non-Recyclable</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          {item.handlingInstructions}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
