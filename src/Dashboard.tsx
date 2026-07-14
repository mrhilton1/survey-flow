import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Survey, TelemetryEvent } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Trash2, Edit3, Share2, BarChart3, LogOut, Layout, Terminal, ShieldAlert, Key, Clock, Code, ChevronDown, ChevronUp } from 'lucide-react';
import { DEFAULT_STYLE, SAMPLE_QUESTIONS } from './constants';
import { toast } from 'sonner';

export const Dashboard: React.FC = () => {
  const { user, logout, login, loading, authError } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();

  // Telemetry related state
  const [selectedTelemetrySurvey, setSelectedTelemetrySurvey] = useState<Survey | null>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryEvent[]>([]);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchTelemetry = async (survey: Survey) => {
    try {
      setLoadingTelemetry(true);
      setSelectedTelemetrySurvey(survey);
      setTelemetryLogs([]);
      setExpandedLogId(null);
      
      const telemetryQuery = query(
        collection(db, 'telemetry'), 
        where('surveyId', '==', survey.id)
      );
      const snapshot = await getDocs(telemetryQuery);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TelemetryEvent));
      // Sort telemetry events by timestamp descending
      logs.sort((a, b) => b.timestamp - a.timestamp);
      setTelemetryLogs(logs);
    } catch (error) {
      console.error("Error fetching telemetry logs:", error);
      toast.error("Failed to load telemetry logs");
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const deleteTelemetryLog = async (logId: string) => {
    if (!selectedTelemetrySurvey) return;
    try {
      await deleteDoc(doc(db, 'telemetry', logId));
      setTelemetryLogs(prev => prev.filter(log => log.id !== logId));
      toast.success("Telemetry log entry deleted");
    } catch (error) {
      console.error("Error deleting telemetry log:", error);
      toast.error("Failed to delete log entry");
    }
  };

  const syncAllCounts = async () => {
    if (!user || surveys.length === 0) return;
    try {
      setIsSyncing(true);
      for (const survey of surveys) {
        const q = query(collection(db, 'responses'), where('surveyId', '==', survey.id));
        const snapshot = await getDocs(q);
        const actualCount = snapshot.size;
        
        if (actualCount !== survey.responsesCount) {
          await updateDoc(doc(db, 'surveys', survey.id), {
            responsesCount: actualCount
          });
        }
      }
      toast.success('All response counts synchronized');
    } catch (error) {
      console.error("Sync error:", error);
      toast.error('Failed to sync some counts');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'surveys'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const surveyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Survey));
      setSurveys(surveyList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'surveys');
    });

    return () => unsubscribe();
  }, [user]);

  // Silent sync to keep count fields correct without triggering toast messages
  useEffect(() => {
    if (!user || surveys.length === 0) return;
    let isActive = true;
    const runSilentSync = async () => {
      try {
        for (const survey of surveys) {
          const q = query(collection(db, 'responses'), where('surveyId', '==', survey.id));
          const snapshot = await getDocs(q);
          const actualCount = snapshot.size;
          if (actualCount !== (survey.responsesCount || 0) && isActive) {
            await updateDoc(doc(db, 'surveys', survey.id), {
              responsesCount: actualCount
            });
          }
        }
      } catch (err) {
        console.warn("Silent synchronization warning:", err);
      }
    };
    runSilentSync();
    return () => {
      isActive = false;
    };
  }, [user, surveys.length]);

  const createNewSurvey = async () => {
    if (!user) return;
    try {
      const newSurvey: Omit<Survey, 'id'> = {
        name: 'Untitled Survey',
        description: 'A new survey description',
        seoDescription: 'A professional survey created with SurveyFlow AI.',
        ownerId: user.uid,
        questions: [],
        style: DEFAULT_STYLE,
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        responsesCount: 0,
        settings: {
          urlParams: ['utm_source', 'utm_medium', 'utm_campaign'],
          tracking: {}
        }
      };
      const docRef = await addDoc(collection(db, 'surveys'), newSurvey);
      navigate(`/editor/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'surveys');
    }
  };

  const deleteSurvey = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'surveys', id));
      toast.success('Survey deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `surveys/${id}`);
    }
  };

  const updateSurveyStatus = async (surveyId: string, newStatus: 'draft' | 'testing' | 'published') => {
    try {
      await updateDoc(doc(db, 'surveys', surveyId), {
        status: newStatus,
        updatedAt: Date.now()
      });
      toast.success(`Survey status updated to ${newStatus.toUpperCase()}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `surveys/${surveyId}`);
    }
  };

  const handleLogin = async (method: 'popup' | 'redirect' = 'popup') => {
    try {
      await login(method);
      if (method === 'popup') {
        toast.success('Signed in successfully');
      }
    } catch (error: any) {
      console.error("Login Error Details:", error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('Sign-in popup was blocked by your browser. Please allow popups for this site.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore user cancellation
      } else {
        toast.error(`Sign-in failed: ${error.message || 'Unknown error'}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground">Initializing application...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="text-center max-w-md w-full">
          <div className="mb-6 flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <Layout className="w-12 h-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">SurveyFlow AI</h1>
          <p className="text-muted-foreground mb-8">
            Create powerful, AI-driven surveys and personalized reports for your business.
          </p>
          
          <div className="space-y-4">
            <Button onClick={() => handleLogin('popup')} size="lg" className="w-full">
              Sign in with Google (Popup)
            </Button>
            <Button onClick={() => handleLogin('redirect')} variant="outline" size="lg" className="w-full">
              Sign in with Google (Redirect)
            </Button>
          </div>

          {authError && (
            <div className="mt-6 p-4 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
              <p className="font-bold mb-1">Authentication Error:</p>
              <p>{authError}</p>
            </div>
          )}

          <div className="mt-10">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs text-muted-foreground"
            >
              {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
            </Button>
            
            {showDebug && (
              <div className="mt-4 p-4 bg-muted text-left text-[10px] font-mono rounded overflow-auto max-h-40">
                <p>Status: Not Authenticated</p>
                <p>Loading: {String(loading)}</p>
                <p>Origin: {window.location.origin}</p>
                <p>User Agent: {navigator.userAgent}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Surveys</h1>
          <p className="text-muted-foreground">Manage and track your survey performance.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={syncAllCounts} disabled={isSyncing}>
            {isSyncing ? 'Syncing...' : 'Sync Counts'}
          </Button>
          <Button onClick={createNewSurvey}>
            <Plus className="w-4 h-4 mr-2" />
            New Survey
          </Button>
          <Button variant="outline" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {surveys.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl">
          <p className="text-muted-foreground mb-4">You haven't created any surveys yet.</p>
          <Button onClick={createNewSurvey} variant="secondary">
            Create your first survey
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {surveys.map((survey) => (
            <Card key={survey.id} className="group hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="line-clamp-1">{survey.name}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded cursor-pointer border transition-colors hover:opacity-80 focus:outline-none ${
                      survey.status === 'published' 
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' 
                        : survey.status === 'testing' 
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25' 
                        : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/15'
                    }`}>
                      {survey.status}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateSurveyStatus(survey.id, 'draft')}>
                        Draft
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateSurveyStatus(survey.id, 'testing')}>
                        Testing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateSurveyStatus(survey.id, 'published')}>
                        Published
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-2">{survey.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  {Math.max(0, survey.responsesCount || 0)} responses
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-4">
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/editor/${survey.id}`)}>
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/r/${survey.id}`)}>
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/s/${survey.id}`);
                    toast.success('Link copied to clipboard');
                  }}>
                    <Share2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    title="Telemetry & Error Logs"
                    onClick={() => fetchTelemetry(survey)}
                    className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                  >
                    <Terminal className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteSurvey(survey.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Telemetry and Error Logs Modal */}
      {selectedTelemetrySurvey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 border-b">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight">Telemetry & Error Logs</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Diagnostic event feed for <span className="font-semibold text-foreground">{selectedTelemetrySurvey.name}</span>
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedTelemetrySurvey(null)}
                className="rounded-full w-8 h-8 p-0"
              >
                ✕
              </Button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* Webhook Secret & Documentation Box */}
              <div className="bg-muted/50 rounded-xl p-4 border space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Key className="w-3.5 h-3.5 text-primary" />
                    Internal Webhook Configuration
                  </div>
                  <span className="text-[10px] font-bold uppercase bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded border border-green-500/20 flex items-center gap-1">
                    ● System-Active
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  A high-priority internal webhook captures error submissions and progressive save disruptions silently in the background. It records all event diagnostics to your secure telemetry ledger.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="bg-background p-2.5 rounded-lg border flex flex-col justify-center">
                    <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">Webhook Endpoint</span>
                    <span className="font-mono text-foreground mt-0.5 select-all truncate">{window.location.origin}/api/telemetry</span>
                  </div>
                  <div className="bg-background p-2.5 rounded-lg border flex flex-col justify-center">
                    <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">Security State</span>
                    <span className="font-semibold text-amber-500 mt-0.5">🔒 Hidden & Isolated from Survey Takers</span>
                  </div>
                </div>
              </div>

              {/* Logs Feed */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex justify-between items-center">
                  <span>Diagnostic Events ({telemetryLogs.length})</span>
                  {telemetryLogs.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => fetchTelemetry(selectedTelemetrySurvey)}
                      className="text-xs h-7 py-0 px-2"
                    >
                      Refresh Feed
                    </Button>
                  )}
                </h3>

                {loadingTelemetry ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                    <p className="text-sm text-muted-foreground">Retrieving secure logs...</p>
                  </div>
                ) : telemetryLogs.length === 0 ? (
                  <div className="py-12 border-2 border-dashed rounded-xl text-center space-y-2">
                    <div className="mx-auto w-10 h-10 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                      <Terminal className="w-5 h-5 text-green-500" />
                    </div>
                    <h4 className="font-semibold text-sm">Perfect Performance</h4>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      No errors or anomalous telemetry events have been reported for this survey.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {telemetryLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      const dateString = new Date(log.timestamp).toLocaleString();
                      
                      return (
                        <div key={log.id} className="border rounded-xl overflow-hidden bg-background">
                          {/* Log Row Summary */}
                          <div 
                            className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id || null)}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                                log.type === 'error' 
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' 
                                  : log.type === 'save_progress_error'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                              }`}>
                                {log.type.replace(/_/g, ' ')}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-mono font-semibold truncate text-foreground max-w-[200px] sm:max-w-[350px]">
                                  {log.payload?.errorMessage || "Anomalous Event Captured"}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {dateString}
                                  </span>
                                  {log.questionId && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono bg-muted px-1.5 py-0.2 rounded text-muted-foreground">
                                        QID: {log.questionId}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs text-muted-foreground h-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedLogId(isExpanded ? null : log.id || null);
                                }}
                              >
                                {isExpanded ? (
                                  <span className="flex items-center gap-1">Hide <ChevronUp className="w-3.5 h-3.5" /></span>
                                ) : (
                                  <span className="flex items-center gap-1 font-medium text-primary">Diagnose <ChevronDown className="w-3.5 h-3.5" /></span>
                                )}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (log.id) deleteTelemetryLog(log.id);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Expanded Details Panel */}
                          {isExpanded && (
                            <div className="border-t bg-muted/10 p-5 space-y-4 animate-in slide-in-from-top-1 duration-100">
                              
                              {/* Metadata list */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="space-y-1.5">
                                  <div className="text-muted-foreground font-medium">Diagnostic Details</div>
                                  <div className="bg-background border rounded-lg p-3 space-y-2 font-mono text-[11px]">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Workspace ID:</span> <span className="text-foreground text-right break-all">{log.workspaceId}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Survey ID:</span> <span className="text-foreground text-right break-all">{log.surveyId}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Question ID:</span> <span className="text-foreground text-right break-all">{log.questionId || "N/A"}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Timestamp:</span> <span className="text-foreground text-right">{log.timestamp}</span></div>
                                  </div>
                                </div>
                                
                                <div className="space-y-1.5">
                                  <div className="text-muted-foreground font-medium">Environment Metadata</div>
                                  <div className="bg-background border rounded-lg p-3 space-y-2 font-mono text-[11px]">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Browser:</span> <span className="text-foreground text-right truncate max-w-[200px]" title={log.payload?.browser}>{log.payload?.browser || "Unknown"}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Device Type:</span> <span className="text-foreground text-right capitalize">{log.payload?.device || "Unknown"}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Origin Url:</span> <span className="text-foreground text-right truncate max-w-[200px]" title={log.payload?.url}>{log.payload?.url || "Unknown"}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Session Step:</span> <span className="text-foreground text-right">{log.payload?.currentStep !== undefined ? `Step ${log.payload.currentStep}` : "N/A"}</span></div>
                                  </div>
                                </div>
                              </div>

                              {/* Error message text */}
                              {log.payload?.errorMessage && (
                                <div className="space-y-1">
                                  <div className="text-xs text-red-500 font-semibold flex items-center gap-1">
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                    Exception Logged
                                  </div>
                                  <div className="bg-red-500/5 border border-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-lg font-mono text-xs break-all whitespace-pre-wrap">
                                    {log.payload.errorMessage}
                                  </div>
                                </div>
                              )}

                              {/* JSON Payload viewer */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Code className="w-3.5 h-3.5" />
                                    Active Answers & Full Telemetry Payload
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(JSON.stringify(log.payload, null, 2));
                                      toast.success("Payload copied");
                                    }}
                                    className="text-[10px] h-6 py-0"
                                  >
                                    Copy JSON
                                  </Button>
                                </div>
                                <div className="bg-card border rounded-lg p-3 max-h-52 overflow-auto font-mono text-[11px] text-muted-foreground dark:text-gray-400">
                                  <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                                </div>
                              </div>

                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t bg-muted/25 flex justify-between items-center rounded-b-2xl">
              <span className="text-xs text-muted-foreground font-mono">
                Workspace: d5aa7b3b-8e9c-4d87-91d2-73d8f0822c0c
              </span>
              <Button onClick={() => setSelectedTelemetrySurvey(null)}>
                Close Feed
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
