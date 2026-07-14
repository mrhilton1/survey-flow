import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, deleteDoc, writeBatch, increment, updateDoc } from 'firebase/firestore';
import { Survey, SurveyResponse } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { GoogleGenAI } from "@google/genai";
import { Download, FileText, Loader2, Mail, Phone, Trash2, CheckSquare, Square, Search, List, LayoutGrid, ArrowLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const ReportView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiReport, setAiReport] = useState<string>('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [selectedResponses, setSelectedResponses] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmClearTests, setConfirmClearTests] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [clearingTests, setClearingTests] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    
    const surveyUnsubscribe = onSnapshot(doc(db, 'surveys', id), (docSnap) => {
      if (docSnap.exists()) {
        setSurvey({ id: docSnap.id, ...docSnap.data() } as Survey);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `surveys/${id}`);
      setLoading(false);
    });

    const q = query(collection(db, 'responses'), where('surveyId', '==', id));
    const responsesUnsubscribe = onSnapshot(q, (snapshot) => {
      const responseList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SurveyResponse));
      setResponses(responseList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'responses');
    });

    return () => {
      surveyUnsubscribe();
      responsesUnsubscribe();
    };
  }, [id]);

  // Sync count back to survey document to ensure accuracy
  useEffect(() => {
    if (id && survey && responses.length !== survey.responsesCount) {
      const syncCount = async () => {
        try {
          await updateDoc(doc(db, 'surveys', id), {
            responsesCount: responses.length
          });
          // Update local survey state to avoid re-syncing
          setSurvey(prev => prev ? { ...prev, responsesCount: responses.length } : null);
        } catch (err) {
          console.warn("Could not sync response count:", err);
        }
      };
      syncCount();
    }
  }, [id, survey, responses.length]);

  const toggleResponseSelection = (responseId: string) => {
    setSelectedResponses(prev => 
      prev.includes(responseId) 
        ? prev.filter(id => id !== responseId) 
        : [...prev, responseId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedResponses.length === responses.length) {
      setSelectedResponses([]);
    } else {
      setSelectedResponses(responses.map(r => r.id));
    }
  };

  const deleteIndividualResponse = async (responseId: string) => {
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'responses', responseId));
      
      toast.success('Response deleted');
      setSelectedResponses(prev => prev.filter(i => i !== responseId));
      setConfirmDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `responses/${responseId}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteBulkResponses = async () => {
    if (selectedResponses.length === 0) return;

    try {
      setIsDeleting(true);
      const batch = writeBatch(db);
      
      selectedResponses.forEach(respId => {
        batch.delete(doc(db, 'responses', respId));
      });

      await batch.commit();

      toast.success(`${selectedResponses.length} responses deleted`);
      setSelectedResponses([]);
      setConfirmBulkDelete(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'responses_bulk');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleTestStatus = async (response: SurveyResponse) => {
    try {
      const isCurrentlyTest = !!(response.isTest || (response as any).test);
      await updateDoc(doc(db, 'responses', response.id), {
        isTest: !isCurrentlyTest
      });
      toast.success(isCurrentlyTest ? "Response marked as official" : "Response marked as TEST");
    } catch (err) {
      console.error("Failed to toggle test status:", err);
      toast.error("Failed to update response status");
    }
  };

  const clearAllResponses = async () => {
    if (responses.length === 0) {
      toast.info("No responses to clear");
      return;
    }
    try {
      setClearingAll(true);
      const batch = writeBatch(db);
      responses.forEach(resp => {
        batch.delete(doc(db, 'responses', resp.id));
      });
      await batch.commit();

      await updateDoc(doc(db, 'surveys', id!), {
        responsesCount: 0
      });

      toast.success("All responses cleared successfully!");
      setSelectedResponses([]);
      setConfirmClearAll(false);
    } catch (err) {
      console.error("Failed to clear all responses:", err);
      toast.error("Failed to clear responses");
    } finally {
      setClearingAll(false);
    }
  };

  const clearTestResponses = async () => {
    const testResponses = responses.filter(r => r.isTest || (r as any).test);
    if (testResponses.length === 0) {
      toast.info("No test responses to clear");
      return;
    }
    try {
      setClearingTests(true);
      const batch = writeBatch(db);
      testResponses.forEach(resp => {
        batch.delete(doc(db, 'responses', resp.id));
      });
      await batch.commit();

      const newCount = Math.max(0, responses.length - testResponses.length);
      await updateDoc(doc(db, 'surveys', id!), {
        responsesCount: newCount
      });

      toast.success(`${testResponses.length} test responses cleared successfully!`);
      setSelectedResponses(prev => prev.filter(rId => !testResponses.some(tr => tr.id === rId)));
      setConfirmClearTests(false);
    } catch (err) {
       // Support both naming schemes safely
       try {
         const newCount = Math.max(0, responses.length - testResponses.length);
         await updateDoc(doc(db, 'surveys', id!), {
           responsesCount: newCount
         });
       } catch {}
       toast.success(`${testResponses.length} test responses cleared`);
       setConfirmClearTests(false);
    } finally {
      setClearingTests(false);
      setConfirmClearTests(false);
    }
  };

  const generateAiReport = async () => {
    if (!survey || responses.length === 0) return;
    setGeneratingReport(true);
    try {
      const prompt = `
        Analyze these survey responses for "${survey.name}".
        Survey Description: ${survey.description}
        Total Responses: ${responses.length}
        
        Responses Data:
        ${JSON.stringify(responses.map(r => ({ answers: r.answers, totalScore: r.totalScore })))}
        
        Generate a professional "AI Roadmap" report similar to the one in the provided PDF.
        Include:
        1. "Where You Are Today" - A summary of the current state.
        2. "What's at Stake" - Risks of not acting.
        3. "Your AI Roadmap: Top 3 Moves" - Actionable steps.
        4. "Your First Move" - Immediate next step.
        
        Format the output clearly with headings.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setAiReport(response.text || 'Failed to generate report.');
    } catch (error) {
      console.error('AI Generation Error:', error);
    } finally {
      setGeneratingReport(false);
    }
  };

  const filteredResponses = responses.filter(resp => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    // Search in answers
    const answersMatch = Object.values(resp.answers).some(val => 
      String(val).toLowerCase().includes(searchLower)
    );
    if (answersMatch) return true;

    // Search in metadata (browser, device)
    if (resp.metadata.browser.toLowerCase().includes(searchLower)) return true;
    if (resp.metadata.device.toLowerCase().includes(searchLower)) return true;

    // Search in URL params
    if (resp.metadata.urlParams) {
      const paramsMatch = Object.values(resp.metadata.urlParams).some(val => 
        String(val).toLowerCase().includes(searchLower)
      );
      if (paramsMatch) return true;
    }

    return false;
  }).sort((a, b) => (b.submittedAt || b.lastActiveAt) - (a.submittedAt || a.lastActiveAt));

  const calculateCompletionRate = () => {
    if (!survey || !survey.viewsCount || survey.viewsCount === 0) return responses.length > 0 ? '100%' : '0%';
    const completedCount = responses.filter(r => r.status === 'completed').length;
    const rate = Math.min(100, Math.round((completedCount / survey.viewsCount) * 100));
    return `${rate}%`;
  };

  const calculateAvgTime = () => {
    const completedResponses = responses.filter(r => r.status === 'completed' && r.metadata.timeToComplete);
    if (completedResponses.length === 0) return '0s';
    const avgSeconds = Math.round(completedResponses.reduce((acc, curr) => acc + (curr.metadata.timeToComplete || 0), 0) / completedResponses.length);
    
    if (avgSeconds < 60) return `${avgSeconds}s`;
    const mins = Math.floor(avgSeconds / 60);
    const secs = avgSeconds % 60;
    return `${mins}m ${secs}s`;
  };

  const calculateAvgScore = () => {
    const completedResponses = responses.filter(r => r.status === 'completed');
    if (completedResponses.length === 0) return 0;
    return Math.round(completedResponses.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / completedResponses.length);
  };

  const getRankedOrderAggregates = (qId: string, options: string[]) => {
    const optionScores: Record<string, { totalRankSum: number; count: number }> = {};
    (options || []).forEach(o => {
      optionScores[o] = { totalRankSum: 0, count: 0 };
    });

    responses.forEach(resp => {
      const answer = resp.answers[qId];
      if (Array.isArray(answer)) {
        answer.forEach((opt, idx) => {
          if (optionScores[opt]) {
            optionScores[opt].totalRankSum += (idx + 1); // 1-based rank position
            optionScores[opt].count += 1;
          }
        });
      }
    });

    return Object.entries(optionScores)
      .map(([option, stats]) => {
        const avg = stats.count > 0 ? stats.totalRankSum / stats.count : 0;
        return { option, avg, count: stats.count };
      })
      .sort((a, b) => {
        if (a.avg === 0) return 1; // Put unranked at the bottom
        if (b.avg === 0) return -1;
        return a.avg - b.avg; // Lower average rank is better (closest to 1st choice)
      });
  };

  const getMultipleChoiceAggregates = (qId: string, options: string[]) => {
    const counts: Record<string, number> = {};
    const cleanOptions = options || [];
    cleanOptions.forEach(o => { counts[o] = 0; });
    counts['Other'] = 0;
    
    let total = 0;
    responses.forEach(resp => {
      const answer = resp.answers[qId];
      if (Array.isArray(answer)) {
        answer.forEach(val => {
          if (typeof val === 'string') {
            if (cleanOptions.includes(val)) {
              counts[val] = (counts[val] || 0) + 1;
              total += 1;
            } else if (val.startsWith('Other: ') || val === '__other__') {
              counts['Other'] = (counts['Other'] || 0) + 1;
              total += 1;
            }
          }
        });
      } else if (typeof answer === 'string' && answer) {
        if (cleanOptions.includes(answer)) {
          counts[answer] = (counts[answer] || 0) + 1;
          total += 1;
        } else if (answer.startsWith('Other: ') || answer === '__other__') {
          counts['Other'] = (counts['Other'] || 0) + 1;
          total += 1;
        } else {
          counts['Other'] = (counts['Other'] || 0) + 1;
          total += 1;
        }
      }
    });
    
    const result = Object.entries(counts).map(([option, count]) => ({
      option,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }));
    
    if (counts['Other'] === 0) {
      return result.filter(item => item.option !== 'Other');
    }
    return result;
  };

  const getRatingAggregates = (qId: string) => {
    let sum = 0;
    let count = 0;
    responses.forEach(resp => {
      const answer = resp.answers[qId];
      if (typeof answer === 'number') {
        sum += answer;
        count += 1;
      }
    });
    return {
      average: count > 0 ? (sum / count).toFixed(1) : '0',
      count
    };
  };

  const getThisOrThatAggregates = (qId: string, options: string[]) => {
    const stats: Record<string, { wins: number; matches: number }> = {};
    (options || []).forEach(o => {
      stats[o] = { wins: 0, matches: 0 };
    });

    responses.forEach(resp => {
      const answer = resp.answers[qId];
      if (Array.isArray(answer)) {
        answer.forEach((match: any) => {
          const leftOption = match.left;
          const rightOption = match.right;
          const winner = match.selected;
          
          if (leftOption && stats[leftOption] !== undefined) {
            stats[leftOption].matches += 1;
            if (winner === leftOption) {
              stats[leftOption].wins += 1;
            }
          }
          
          if (rightOption && stats[rightOption] !== undefined) {
            stats[rightOption].matches += 1;
            if (winner === rightOption) {
              stats[rightOption].wins += 1;
            }
          }
        });
      }
    });

    return Object.entries(stats)
      .map(([option, data]) => {
        const winPct = data.matches > 0 ? Math.round((data.wins / data.matches) * 100) : 0;
        return { option, wins: data.wins, matches: data.matches, winPct };
      })
      .sort((a, b) => b.winPct - a.winPct);
  };

  const hasScoring = survey?.questions.some(q => q.scores && Object.keys(q.scores).length > 0);

  const downloadPdf = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${survey?.name || 'survey'}-report.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!survey) return <div className="flex items-center justify-center min-h-screen">Survey not found</div>;

  const COLORS = ['#F27D26', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="min-h-screen bg-muted/30 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="gap-2" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Analytics: {survey.name}</h1>
              <p className="text-muted-foreground">{responses.length} total submissions</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={generateAiReport} disabled={generatingReport || responses.length === 0}>
              {generatingReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Generate AI Report
            </Button>
            <Button onClick={downloadPdf} disabled={!aiReport}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calculateCompletionRate()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calculateAvgTime()}</div>
            </CardContent>
          </Card>
          {hasScoring && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {calculateAvgScore()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {aiReport && (
          <div ref={reportRef} className="bg-black text-white p-10 rounded-2xl shadow-2xl space-y-10 overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#F27D26] font-bold tracking-widest uppercase text-sm">
                  <div className="w-6 h-6 bg-[#F27D26] rounded flex items-center justify-center text-black">
                    <Loader2 className="w-4 h-4" />
                  </div>
                  Crankset.
                </div>
                <h2 className="text-4xl font-bold">AI Roadmap</h2>
                <p className="opacity-60">Prepared for your team</p>
              </div>
              <div className="relative w-32 h-32">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[{ value: 52 }, { value: 48 }]}
                        innerRadius={40}
                        outerRadius={50}
                        paddingAngle={5}
                        dataKey="value"
                        startAngle={90}
                        endAngle={450}
                      >
                        <Cell fill="#F27D26" />
                        <Cell fill="#333" />
                      </Pie>
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">
                      {responses.length > 0 
                        ? Math.round(responses.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / responses.length) 
                        : 0}
                    </span>
                    <span className="text-[10px] opacity-50">/100</span>
                 </div>
              </div>
            </div>

            <div className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap leading-relaxed opacity-90">
                {aiReport}
              </div>
            </div>

            <div className="pt-10 border-t border-white/10 flex flex-wrap gap-6 justify-center">
               <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-[#F27D26]" />
                  hello@crankset.ai
               </div>
               <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-[#F27D26]" />
                  480.382.4747
               </div>
            </div>
          </div>
        )}

        {!aiReport && (
          <div className="text-center py-20 bg-card rounded-xl border">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium mb-2">No AI Report Generated</h3>
            <p className="text-muted-foreground mb-6">Click the button above to analyze your survey data with AI.</p>
            <Button variant="outline" onClick={generateAiReport} disabled={responses.length === 0}>
              Analyze {responses.length} Responses
            </Button>
          </div>
        )}

        {/* Question Analytics Breakdown Section */}
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-bold">Question Analytics Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {survey.questions.map((q, idx) => (
              <Card key={q.id} className="overflow-hidden">
                <CardHeader className="bg-muted/30 pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-[#F27D26]">Q{idx + 1}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {q.type.replace('-', ' ')}
                    </span>
                  </div>
                  <CardTitle className="text-base font-semibold mt-1 leading-snug">{q.question}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Multiple Choice Aggregates */}
                  {q.type === 'multiple-choice' && (
                    <div className="space-y-2">
                      {getMultipleChoiceAggregates(q.id, q.options || []).map(({ option, count, percentage }) => (
                        <div key={option} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="truncate">{option}</span>
                            <span>{count} votes ({percentage}%)</span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#F27D26] rounded-full transition-all duration-500" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rating aggregates */}
                  {q.type === 'rating' && (() => {
                    const ratingData = getRatingAggregates(q.id);
                    const avgNum = parseFloat(ratingData.average) || 0;
                    const maxPossible = q.maxRating || 5;
                    const percentage = maxPossible > 0 ? (avgNum / maxPossible) * 100 : 0;
                    return (
                      <div className="flex items-center gap-4 py-2">
                        <div className="text-center bg-[#F27D26]/10 text-[#F27D26] p-4 rounded-xl border border-[#F27D26]/20">
                          <div className="text-4xl font-extrabold">{ratingData.average}</div>
                          <div className="text-[10px] font-bold uppercase opacity-60">Avg Rating</div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="text-xs text-muted-foreground">
                            Based on {ratingData.count} responses.
                          </div>
                          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#F27D26] rounded-full transition-all duration-500" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Min: {q.minRating || 1}</span>
                            <span>Max: {q.maxRating || 5}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Ranked Order aggregates */}
                  {q.type === 'ranked-order' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-tight">
                        Aggregated rankings calculated using average preference index (lower rank number is more preferred).
                      </p>
                      <div className="space-y-2">
                        {getRankedOrderAggregates(q.id, q.options || []).map(({ option, avg, count }, aggIdx) => {
                          const maxPossible = q.options?.length || 5;
                          // Invert so lowest average rank (position 1) is shown as highest progress percentage
                          const scaleScore = maxPossible > 1 ? ((maxPossible - avg) / (maxPossible - 1)) * 100 : 100;
                          return (
                            <div key={option} className="flex items-center gap-3 p-2 bg-muted/20 border border-dashed rounded-lg">
                              <span className="w-6 h-6 rounded-full bg-[#F27D26]/15 text-[#F27D26] flex items-center justify-center font-bold text-xs">
                                #{aggIdx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center text-xs font-semibold mb-1">
                                  <span className="truncate">{option}</span>
                                  <span className="text-xs font-bold text-[#F27D26]">
                                    Avg. #{avg > 0 ? avg.toFixed(1) : 'N/A'}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-[#F27D26] rounded-full transition-all duration-500" 
                                    style={{ width: `${avg > 0 ? Math.max(5, scaleScore) : 0}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* This or That aggregates */}
                  {q.type === 'this-or-that' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-tight">
                        Aggregate selection win percentages represent how often each item was chosen as the preferred item over all pairings.
                      </p>
                      <div className="space-y-2">
                        {getThisOrThatAggregates(q.id, q.options || []).map(({ option, wins, matches, winPct }, aggIdx) => {
                          return (
                            <div key={option} className="flex items-center gap-3 p-2 bg-muted/20 border border-dashed rounded-lg">
                              <span className="w-6 h-6 rounded-full bg-[#F27D26]/15 text-[#F27D26] flex items-center justify-center font-bold text-xs shrink-0 font-sans">
                                #{aggIdx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center text-xs font-semibold mb-1">
                                  <span className="truncate">{option}</span>
                                  <span className="text-xs font-bold text-[#F27D26]">
                                    {winPct}% wins ({wins}/{matches})
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-[#F27D26] rounded-full transition-all duration-500" 
                                    style={{ width: `${winPct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Text or Contact aggregated list highlights */}
                  {(q.type === 'text' || q.type === 'contact-info' || q.type === 'email') && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {responses.filter(r => r.answers[q.id] || (q.type === 'contact-info' && r.answers[`${q.id}_first_name`])).length} responses received.
                      </div>
                      <div className="max-h-32 overflow-y-auto text-xs space-y-1.5 p-2 bg-muted/40 rounded-lg border border-dashed">
                        {responses
                          .map(r => {
                            if (q.type === 'contact-info') {
                              const firstName = r.answers[`${q.id}_first_name`];
                              const email = r.answers[`${q.id}_email`];
                              return firstName ? `${firstName} (${email || ''})` : null;
                            }
                            return r.answers[q.id];
                          })
                          .filter(Boolean)
                          .slice(0, 5)
                          .map((ans, aIdx) => (
                            <div key={aIdx} className="pb-1.5 border-b border-muted last:border-0 truncate font-mono opacity-80">
                              ➔ {String(ans)}
                            </div>
                          ))}
                        {responses.filter(r => r.answers[q.id]).length > 5 && (
                          <p className="text-[10px] text-muted-foreground text-center pt-1 italic">... plus more in individual records</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold">Individual Responses</h2>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search responses..." 
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex border rounded-md overflow-hidden h-9">
                <Button 
                  variant={viewMode === 'cards' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="rounded-none px-3"
                  onClick={() => setViewMode('cards')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button 
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="rounded-none px-3 border-l"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
              {responses.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setConfirmClearTests(true)}
                  className="text-xs h-9 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 font-semibold"
                >
                  Clear Test Responses
                </Button>
              )}
              {responses.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setConfirmClearAll(true)}
                  className="text-xs h-9 text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30 font-semibold"
                >
                  Clear All Responses
                </Button>
              )}
              {responses.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleAllSelection}
                  className="text-xs h-9"
                >
                  {selectedResponses.length === responses.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
              {selectedResponses.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={isDeleting}
                  className="text-xs h-9"
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete Selected ({selectedResponses.length})
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {responses.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No responses yet.
                </CardContent>
              </Card>
            ) : filteredResponses.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No responses match your search.
                </CardContent>
              </Card>
            ) : viewMode === 'list' ? (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                      <tr>
                        <th className="p-3 w-10"></th>
                        <th className="p-3 whitespace-nowrap">Timestamp</th>
                        <th className="p-3 whitespace-nowrap">Type</th>
                        {hasScoring && <th className="p-3 whitespace-nowrap">Score</th>}
                        {survey.questions.slice(0, 3).map(q => (
                          <th key={q.id} className="p-3 whitespace-nowrap max-w-[200px] truncate" title={q.question}>
                            {q.question}
                          </th>
                        ))}
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredResponses.map(resp => (
                        <tr key={resp.id} className={`hover:bg-muted/30 transition-colors ${selectedResponses.includes(resp.id) ? 'bg-primary/5' : ''}`}>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleResponseSelection(resp.id)}
                            >
                              {selectedResponses.includes(resp.id) ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                          </td>
                          <td className="p-3 whitespace-nowrap text-xs">
                            {new Date(resp.submittedAt || resp.lastActiveAt).toLocaleString()}
                            {resp.status === 'partial' && (
                              <span className="ml-2 inline-flex items-center gap-1 text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-extrabold uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                Incomplete
                              </span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap text-xs">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleTestStatus(resp)}
                              className={`h-7 px-2.5 text-[10px] rounded-full border transition-all ${
                                !!(resp.isTest || (resp as any).test)
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20 font-bold'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/20 font-medium'
                              }`}
                            >
                              {!!(resp.isTest || (resp as any).test) ? '🧪 TEST RECORD' : '✔ OFFICIAL'}
                            </Button>
                          </td>
                          {hasScoring && (
                            <td className="p-3">
                              <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {resp.totalScore || 0}
                              </span>
                            </td>
                          )}
                          {survey.questions.slice(0, 3).map(q => {
                            const isPrefilled = q.paramMapping && resp.metadata.urlParams?.[q.paramMapping];
                            return (
                              <td key={q.id} className="p-3 max-w-[200px] truncate text-xs opacity-80">
                                <div className="flex items-center gap-1">
                                  {isPrefilled && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" title="Pre-filled" />}
                                  <span className="truncate">
                                    {q.type === 'ranked-order' && Array.isArray(resp.answers[q.id]) 
                                      ? (resp.answers[q.id] as string[]).join(' ➔ ')
                                      : q.type === 'this-or-that' && Array.isArray(resp.answers[q.id])
                                        ? (resp.answers[q.id] as any[]).map(m => m.selected).filter(Boolean).join(', ')
                                        : typeof resp.answers[q.id] === 'object' 
                                          ? JSON.stringify(resp.answers[q.id]) 
                                          : String(resp.answers[q.id] || '-')}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setConfirmDeleteId(resp.id)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              filteredResponses.map((resp) => (
                <Card key={resp.id} className={selectedResponses.includes(resp.id) ? 'border-primary/50 bg-primary/5' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3 items-start">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 mt-1"
                          onClick={() => toggleResponseSelection(resp.id)}
                        >
                          {selectedResponses.includes(resp.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                        <div>
                          <CardTitle className="text-sm font-medium flex flex-wrap items-center gap-2">
                            <span>Response from {new Date(resp.submittedAt || resp.lastActiveAt).toLocaleString()}</span>
                            {resp.status === 'partial' && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-extrabold uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                Incomplete
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleTestStatus(resp)}
                              className={`h-6 px-2 text-[9px] rounded-full border transition-all ${
                                !!(resp.isTest || (resp as any).test)
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20 font-bold'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/20 font-medium'
                              }`}
                            >
                              {!!(resp.isTest || (resp as any).test) ? '🧪 TEST RECORD' : '✔ OFFICIAL'}
                            </Button>
                          </CardTitle>
                          <div className="flex gap-2 mt-1">
                            {hasScoring && (
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                Score: {resp.totalScore || 0}
                              </span>
                            )}
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground capitalize">
                              {resp.metadata.device}
                            </span>
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground truncate max-w-[100px]" title={resp.metadata.browser}>
                              {resp.metadata.browser}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 items-start">
                        {resp.metadata.urlParams && Object.keys(resp.metadata.urlParams).length > 0 && (
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-[#F27D26] uppercase tracking-wider">URL Parameters</span>
                            <div className="flex flex-wrap gap-1 justify-end mt-1">
                              {Object.entries(resp.metadata.urlParams).map(([key, val]) => (
                                <span key={key} className="text-[9px] bg-[#F27D26]/10 text-[#F27D26] px-1.5 py-0.5 rounded border border-[#F27D26]/20">
                                  {key}: {val}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDeleteId(resp.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      {survey.questions.map((q) => {
                        const answer = resp.answers[q.id];
                        if (answer === undefined) return null;
                        const isPrefilled = q.paramMapping && resp.metadata.urlParams?.[q.paramMapping];
                        
                        return (
                          <div key={q.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">{q.question}</p>
                              {isPrefilled && (
                                <span className="text-[8px] bg-blue-500/10 text-blue-500 px-1 rounded border border-blue-500/20 font-bold uppercase">Pre-filled</span>
                              )}
                            </div>
                            <div className="text-sm">
                              {q.type === 'ranked-order' && Array.isArray(answer) ? (
                                <div className="space-y-1 mt-1">
                                  {(answer as string[]).map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px]">{idx + 1}</span>
                                      <span className="opacity-90">{item}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : q.type === 'this-or-that' && Array.isArray(answer) ? (
                                <div className="space-y-1 mt-1 max-h-40 overflow-y-auto border border-dashed rounded-lg p-2 bg-muted/20">
                                  {(answer as any[]).map((match, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-muted/50 last:border-0">
                                      <span className="opacity-70 font-sans">{match.left} vs {match.right}</span>
                                      <span className="font-bold text-[#F27D26] font-sans">{match.selected || 'N/A'}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : typeof answer === 'object' ? (
                                <span className="font-mono text-xs">{JSON.stringify(answer)}</span>
                              ) : (
                                <span>{String(answer)}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modals */}
      {(confirmDeleteId || confirmBulkDelete) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-sm w-full">
            <CardHeader>
              <CardTitle>Confirm Deletion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {confirmBulkDelete 
                  ? `Are you sure you want to delete ${selectedResponses.length} responses? This action cannot be undone.`
                  : "Are you sure you want to delete this response? This action cannot be undone."}
              </p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setConfirmDeleteId(null);
                  setConfirmBulkDelete(false);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (confirmBulkDelete) deleteBulkResponses();
                  else if (confirmDeleteId) deleteIndividualResponse(confirmDeleteId);
                }}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Delete
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Clear All Responses Confirmation Modal */}
      {confirmClearAll && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <Card className="max-w-md w-full shadow-2xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl font-bold text-destructive">Wipe Survey Data?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This will <strong className="text-foreground">permanently delete all {responses.length} responses</strong> recorded for this survey. 
                Webhooks will not be re-sent and this action is <strong className="text-destructive font-bold uppercase">completely irreversible</strong>.
              </p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-2">
              <Button 
                variant="ghost" 
                onClick={() => setConfirmClearAll(false)}
                disabled={clearingAll}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={clearAllResponses}
                disabled={clearingAll}
              >
                {clearingAll ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Yes, Wipe All Data
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Clear Test Responses Confirmation Modal */}
      {confirmClearTests && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <Card className="max-w-md w-full shadow-2xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl font-bold text-amber-600 dark:text-amber-400">Clear Test Data?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This will <strong className="text-foreground">permanently delete only the responses marked as TEST</strong>. 
                All official/actual subscriber submissions will remain completely untouched. This action cannot be undone.
              </p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-2">
              <Button 
                variant="ghost" 
                onClick={() => setConfirmClearTests(false)}
                disabled={clearingTests}
              >
                Cancel
              </Button>
              <Button 
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={clearTestResponses}
                disabled={clearingTests}
              >
                {clearingTests ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Wipe Test Records
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
