import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Survey } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Trash2, Edit3, Share2, BarChart3, LogOut, Layout } from 'lucide-react';
import { DEFAULT_STYLE, SAMPLE_QUESTIONS } from './constants';
import { toast } from 'sonner';

export const Dashboard: React.FC = () => {
  const { user, logout, login, loading, authError } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();

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
        questions: SAMPLE_QUESTIONS as any,
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
                </div>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteSurvey(survey.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
