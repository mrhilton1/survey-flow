import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Survey, SurveyQuestion } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Plus, Trash2, Settings, Palette, ListTodo, X, GitBranch, Trophy, Link, Copy, ExternalLink, Eye, Tag, Edit3, SlidersHorizontal, HelpCircle, Sparkles, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export const SurveyEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'design' | 'settings'>('questions');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchSurvey = async () => {
      try {
        const docRef = doc(db, 'surveys', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Survey;
          setSurvey({ id: docSnap.id, ...data } as Survey);
          setTempName(data.name || '');
        } else {
          toast.error('Survey not found');
          navigate('/');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `surveys/${id}`);
      } finally {
        setLoading(false);
      }
    };
    fetchSurvey();
  }, [id, navigate]);

  const saveSurvey = async () => {
    if (!survey || !id) return;
    try {
      const docRef = doc(db, 'surveys', id);
      await updateDoc(docRef, {
        ...survey,
        updatedAt: Date.now(),
      });
      toast.success('Survey saved successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `surveys/${id}`);
    }
  };

  const testWebhook = async () => {
    if (!survey?.settings?.webhookUrl) {
      toast.error("Please enter a Webhook URL first.");
      return;
    }
    try {
      setTestingWebhook(true);
      const testPayload = {
        event: "survey.test",
        test: true,
        surveyId: survey.id,
        surveyName: survey.name,
        answers: {
          test_question_1: "Awesome Choice!",
          test_question_2: ["Option A", "Option B"]
        },
        scores: {
          test_question_1: 10
        },
        totalScore: 10,
        metadata: {
          browser: "Google Chrome",
          device: "desktop",
          testMode: true,
          timestamp: Date.now()
        },
        submittedAt: Date.now()
      };
      
      const response = await fetch(survey.settings.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(testPayload)
      });
      
      if (response.ok || (response.status >= 200 && response.status < 300)) {
        toast.success(`Webhook test payload sent successfully! Server responded with status: ${response.status}`);
      } else {
        toast.warning(`Webhook test sent, but server responded with error status: ${response.status}`);
      }
    } catch (e: any) {
      toast.error(`Could not reach Webhook: ${e?.message || e}`);
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleStatusChange = async (newStatus: 'draft' | 'testing' | 'published') => {
    if (!survey || !id) return;
    const updatedSurvey = { ...survey, status: newStatus };
    setSurvey(updatedSurvey);
    try {
      const docRef = doc(db, 'surveys', id);
      await updateDoc(docRef, {
        ...updatedSurvey,
        updatedAt: Date.now(),
      });
      toast.success(`Autosaved: Status set to ${newStatus.toUpperCase()}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `surveys/${id}`);
    }
  };

  const addQuestion = () => {
    if (!survey) return;
    const newQuestion: SurveyQuestion = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'multiple-choice',
      question: 'New Question',
      required: true,
      options: ['Option 1', 'Option 2'],
    };
    setSurvey({
      ...survey,
      questions: [...survey.questions, newQuestion],
    });
    setSelectedQuestionIndex(survey.questions.length);
  };

  const updateQuestion = (index: number, updates: Partial<SurveyQuestion>) => {
    if (!survey) return;
    const newQuestions = [...survey.questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setSurvey({ ...survey, questions: newQuestions });
  };

  const removeQuestion = (index: number) => {
    if (!survey) return;
    const newQuestions = survey.questions.filter((_, i) => i !== index);
    setSurvey({ ...survey, questions: newQuestions });
    if (selectedQuestionIndex >= newQuestions.length) {
      setSelectedQuestionIndex(Math.max(0, newQuestions.length - 1));
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!survey) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/')} title="Back to Dashboard">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            
            {/* Inline Editable Name */}
            <div className="flex items-center gap-1.5 min-w-0">
              {isEditingName ? (
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={() => {
                    setIsEditingName(false);
                    if (tempName.trim()) {
                      setSurvey({ ...survey, name: tempName.trim() });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingName(false);
                      if (tempName.trim()) {
                        setSurvey({ ...survey, name: tempName.trim() });
                      }
                    }
                  }}
                  className="h-8 py-1 px-2 font-bold text-base bg-background w-36 sm:w-64 focus-visible:ring-primary"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-1 min-w-0 group">
                  <h1 
                    className="font-bold text-base sm:text-lg cursor-pointer hover:text-primary transition-colors truncate max-w-[120px] sm:max-w-[240px] md:max-w-[360px]" 
                    onClick={() => { setTempName(survey.name); setIsEditingName(true); }}
                    title="Click to edit name"
                  >
                    {survey.name}
                  </h1>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => { setTempName(survey.name); setIsEditingName(true); }}
                    title="Edit Survey Name"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Quick Navigation Tabs inside the title bar section */}
            <div className="hidden md:flex items-center gap-1 bg-muted/60 p-1 rounded-lg border ml-2">
              <Button
                variant={activeTab === 'questions' ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-2.5 text-xs font-semibold gap-1.5 ${activeTab === 'questions' ? 'shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('questions')}
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>Questions</span>
              </Button>
              <Button
                variant={activeTab === 'design' ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-2.5 text-xs font-semibold gap-1.5 ${activeTab === 'design' ? 'shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('design')}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Design</span>
              </Button>
              <Button
                variant={activeTab === 'settings' ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-2.5 text-xs font-semibold gap-1.5 ${activeTab === 'settings' ? 'shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Small screen tab icons bar */}
            <div className="flex md:hidden items-center gap-1 bg-muted/60 p-0.5 rounded-lg border mr-1">
              <Button
                variant={activeTab === 'questions' ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setActiveTab('questions')}
                title="Questions"
              >
                <ListTodo className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={activeTab === 'design' ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setActiveTab('design')}
                title="Design"
              >
                <Palette className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={activeTab === 'settings' ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setActiveTab('settings')}
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Preview & Save Icons */}
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => window.open(`/s/${id}?test=true`, '_blank')}
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </Button>
            
            <Button 
              size="icon" 
              className="h-8 w-8"
              onClick={saveSurvey}
              title="Save Changes"
            >
              <Save className="w-4 h-4" />
            </Button>

            {/* Status Dropdown Farthest Right */}
            <select
              value={survey.status}
              onChange={(e) => handleStatusChange(e.target.value as any)}
              className="font-bold text-[11px] rounded border border-input bg-background/80 px-2.5 py-1.5 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer focus:border-ring uppercase tracking-wider bg-no-repeat bg-right pr-6 appearance-none h-8 max-w-[100px] sm:max-w-none text-muted-foreground hover:text-foreground"
              style={{
                backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='none' stroke='currentColor' stroke-width='2' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'></path></svg>")`,
                backgroundSize: '10px',
                backgroundPosition: 'calc(100% - 6px) center',
              }}
            >
              <option value="draft">DRAFT</option>
              <option value="testing">TESTING</option>
              <option value="published">PUBLISHED</option>
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-0">
          <TabsContent value="questions" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0 outline-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column: Scrollable Questions */}
              <div className={`${isSettingsCollapsed ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-4 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto pr-1`}>
                {survey.questions.length === 0 ? (
                  <Card className="border-2 border-dashed flex flex-col items-center justify-center p-12 text-center bg-muted/5">
                    <div className="p-4 bg-primary/10 rounded-full mb-4">
                      <ListTodo className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                    <CardTitle className="text-xl font-bold mb-2">Add your first question</CardTitle>
                    <CardDescription className="max-w-md mb-6 text-sm">
                      Get started by creating your first question. You can choose from Multiple Choice, This or That, Ranked Order, Rating, Text Input, and Contact Forms.
                    </CardDescription>
                    <Button onClick={addQuestion} size="lg" className="px-8 font-semibold shadow-sm hover:shadow transition-all">
                      <Plus className="w-5 h-5 mr-2" />
                      Add Question
                    </Button>
                  </Card>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 bg-muted/20 border p-3 rounded-lg">
                      <div className="space-y-0.5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                          Form Questions
                        </h3>
                        <p className="text-xs text-muted-foreground">Select any question card below to customize its questions, scoring, logic or properties.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-semibold gap-1.5 self-stretch sm:self-auto bg-background hover:bg-muted"
                        onClick={() => setIsSettingsCollapsed(!isSettingsCollapsed)}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {isSettingsCollapsed ? "Open Settings Panel" : "Close Settings Panel"}
                        {isSettingsCollapsed && <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />}
                      </Button>
                    </div>

                    {survey.questions.map((q, index) => {
                      const isSelected = index === selectedQuestionIndex;
                      return (
                        <Card 
                          key={q.id} 
                          className={`transition-all duration-200 cursor-pointer ${
                            isSelected 
                              ? 'border-2 border-primary ring-2 ring-primary/10 shadow-md bg-card/95' 
                              : 'hover:border-primary/40 bg-card/60'
                          }`}
                          onClick={() => setSelectedQuestionIndex(index)}
                        >
                          {/* Question Card header row */}
                          <div className="flex items-center justify-between gap-4 p-4 pb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-muted-foreground">Question {index + 1}</span>
                              {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                            </div>
                            <div className="flex items-center gap-2">
                              <select 
                                className="h-8 px-2 py-1 rounded-md border bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                value={q.type}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const newType = e.target.value as any;
                                  const updates: Partial<SurveyQuestion> = { type: newType };
                                  if ((newType === 'multiple-choice' || newType === 'ranked-order' || newType === 'this-or-that') && (!q.options || q.options.length === 0)) {
                                    updates.options = ['Option A', 'Option B', 'Option C'];
                                  }
                                  updateQuestion(index, updates);
                                }}
                              >
                                <option value="multiple-choice">Multiple Choice</option>
                                <option value="this-or-that">This or That</option>
                                <option value="ranked-order">Ranked Order</option>
                                <option value="text">Text Input</option>
                                <option value="rating">Rating</option>
                                <option value="contact-info">Contact Form</option>
                              </select>
                              <Button 
                                variant={isSelected && !isSettingsCollapsed ? "default" : "ghost"} 
                                size="icon" 
                                className={`h-8 w-8 rounded-md transition-all duration-200 ${
                                  isSelected && !isSettingsCollapsed 
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                    : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedQuestionIndex(index);
                                  if (selectedQuestionIndex === index) {
                                    setIsSettingsCollapsed(!isSettingsCollapsed);
                                  } else {
                                    setIsSettingsCollapsed(false);
                                  }
                                }}
                                title="Advanced Settings"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeQuestion(index);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <CardContent className="p-4 pt-0 space-y-4">
                            {/* Question Text */}
                            <div className="space-y-1.5">
                              <Input 
                                value={q.question} 
                                onChange={(e) => updateQuestion(index, { question: e.target.value })}
                                placeholder="Type your question here..."
                                className="font-semibold text-sm h-10 border-muted/70 focus-visible:ring-primary"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>

                            {/* Category and Required Toggle Row */}
                            <div className="flex items-center justify-between gap-4 pt-1 pb-2 border-b border-muted/50">
                              {/* Category tag system */}
                              <div className="flex-1 flex flex-wrap items-center gap-2">
                                {q.category ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                    <Tag className="w-3 h-3 text-primary" />
                                    {q.category}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateQuestion(index, { category: undefined });
                                      }}
                                      className="text-primary/70 hover:text-primary rounded-full ml-1"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
                                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                                    <div className="relative flex-1">
                                      <Input
                                        placeholder="Add category tag..."
                                        className="h-7 text-xs py-0 px-2 pr-8"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = (e.target as HTMLInputElement).value.trim();
                                            if (val) {
                                              updateQuestion(index, { category: val });
                                              (e.target as HTMLInputElement).value = '';
                                            }
                                          }
                                        }}
                                        onBlur={(e) => {
                                          const val = e.target.value.trim();
                                          if (val) {
                                            updateQuestion(index, { category: val });
                                            e.target.value = '';
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Suggested categories from other questions */}
                                {!q.category && (
                                  <div className="flex flex-wrap gap-1.5 items-center ml-2" onClick={(e) => e.stopPropagation()}>
                                    {(Array.from(new Set(survey.questions.map(oq => oq.category).filter(Boolean))) as string[])
                                      .filter(cat => cat !== q.category)
                                      .slice(0, 3)
                                      .map(cat => (
                                        <Button
                                          key={cat}
                                          variant="outline"
                                          size="sm"
                                          className="h-6 px-2 text-[10px] text-muted-foreground border-dashed bg-muted/20"
                                          onClick={() => updateQuestion(index, { category: cat })}
                                        >
                                          + {cat}
                                        </Button>
                                      ))}
                                  </div>
                                )}
                              </div>

                              {/* Required Switch next to Category */}
                              <div className="flex items-center gap-2 shrink-0 select-none" onClick={(e) => e.stopPropagation()}>
                                <Switch 
                                  id={`required-${q.id}`} 
                                  checked={q.required} 
                                  onCheckedChange={(val) => updateQuestion(index, { required: val })}
                                  className="scale-90"
                                />
                                <Label htmlFor={`required-${q.id}`} className="text-xs font-bold text-muted-foreground cursor-pointer">Required</Label>
                              </div>
                            </div>

                            {/* Options, Scoring, & Logic */}
                            <div onClick={(e) => e.stopPropagation()}>

                    {/* Multiple Choice Options */}
                    {q.type === 'multiple-choice' && (
                      <div className="space-y-4">
                        <Label>Options, Scoring & Logic</Label>
                        <div className="space-y-3">
                          {q.options?.map((option, optIndex) => (
                            <div key={optIndex} className="space-y-2 p-3 border rounded-lg bg-muted/20">
                              <div className="flex gap-2">
                                <Input 
                                  value={option} 
                                  onChange={(e) => {
                                    const newOptions = [...(q.options || [])];
                                    newOptions[optIndex] = e.target.value;
                                    updateQuestion(index, { options: newOptions });
                                  }}
                                  placeholder="Option text"
                                />
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => {
                                    const newOptions = q.options?.filter((_, i) => i !== optIndex);
                                    updateQuestion(index, { options: newOptions });
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2">
                                  <Trophy className="w-3 h-3 text-muted-foreground" />
                                  <Input 
                                    type="number"
                                    placeholder="Score"
                                    className="h-8 text-xs"
                                    value={q.scores?.[option] || 0}
                                    onChange={(e) => {
                                      const newScores = { ...(q.scores || {}) };
                                      newScores[option] = parseInt(e.target.value) || 0;
                                      updateQuestion(index, { scores: newScores });
                                    }}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <GitBranch className="w-3 h-3 text-muted-foreground" />
                                  <select 
                                    className="w-full h-8 px-2 rounded-md border bg-background text-xs"
                                    value={q.logic?.[option] || ''}
                                    onChange={(e) => {
                                      const newLogic = { ...(q.logic || {}) };
                                      newLogic[option] = e.target.value;
                                      updateQuestion(index, { logic: newLogic });
                                    }}
                                  >
                                    <option value="">Next Question (Default)</option>
                                    <option value="end">End Survey</option>
                                    {survey.questions.map((otherQ, otherIdx) => (
                                      otherIdx > index && (
                                        <option key={otherQ.id} value={otherQ.id}>
                                          Go to Q{otherIdx + 1}: {otherQ.question.substring(0, 20)}...
                                        </option>
                                      )
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center gap-4">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                const newOptions = [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`];
                                updateQuestion(index, { options: newOptions });
                              }}
                            >
                              <Plus className="w-3 h-3 mr-2" />
                              Add Option
                            </Button>
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
                              onClick={() => {
                                const hasOther = q.options?.some(o => o.toLowerCase() === 'other');
                                const newOptions = hasOther ? (q.options || []) : [...(q.options || []), 'Other'];
                                updateQuestion(index, { 
                                  options: newOptions,
                                  allowOther: true
                                });
                              }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Other/Write-in
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ranked Order Config */}
                    {q.type === 'ranked-order' && (
                      <div className="space-y-4">
                        <Label>Options to Rank</Label>
                        <p className="text-xs text-muted-foreground leading-tight">
                          Specify the list of items that respondents will rank in order of preference.
                        </p>
                        <div className="space-y-3">
                          {q.options?.map((option, optIndex) => (
                            <div key={optIndex} className="flex gap-2">
                              <Input 
                                value={option} 
                                onChange={(e) => {
                                  const newOptions = [...(q.options || [])];
                                  newOptions[optIndex] = e.target.value;
                                  updateQuestion(index, { options: newOptions });
                                }}
                                placeholder={`Item ${optIndex + 1}`}
                              />
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  const newOptions = q.options?.filter((_, i) => i !== optIndex);
                                  updateQuestion(index, { options: newOptions });
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              const newOptions = [...(q.options || []), `Item ${(q.options?.length || 0) + 1}`];
                              updateQuestion(index, { options: newOptions });
                            }}
                          >
                            <Plus className="w-3 h-3 mr-2" />
                            Add Item to Rank
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* This or That Config */}
                    {q.type === 'this-or-that' && (
                      <div className="space-y-4">
                        <Label>Items to Compare (Pairwise)</Label>
                        <p className="text-xs text-muted-foreground leading-tight">
                          Specify the list of items. Unique pairs will be generated automatically for the respondent to choose between.
                        </p>
                        <div className="space-y-3">
                          {q.options?.map((option, optIndex) => (
                            <div key={optIndex} className="flex gap-2">
                              <Input 
                                value={option} 
                                onChange={(e) => {
                                  const newOptions = [...(q.options || [])];
                                  newOptions[optIndex] = e.target.value;
                                  updateQuestion(index, { options: newOptions });
                                }}
                                placeholder={`Item ${optIndex + 1}`}
                              />
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  const newOptions = q.options?.filter((_, i) => i !== optIndex);
                                  updateQuestion(index, { options: newOptions });
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              const newOptions = [...(q.options || []), `Item ${(q.options?.length || 0) + 1}`];
                              updateQuestion(index, { options: newOptions });
                            }}
                          >
                            <Plus className="w-3 h-3 mr-2" />
                            Add Item to Compare
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Text Input Config */}
                    {q.type === 'text' && (
                      <div className="text-xs text-muted-foreground italic">
                        Configure advanced settings like placeholder and URL parameter mappings on the right panel.
                      </div>
                    )}

                    {/* Rating Config */}
                    {q.type === 'rating' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Min Rating</Label>
                          <Input 
                            type="number" 
                            value={q.minRating || 1} 
                            onChange={(e) => updateQuestion(index, { minRating: parseInt(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Max Rating</Label>
                          <Input 
                            type="number" 
                            value={q.maxRating || 5} 
                            onChange={(e) => updateQuestion(index, { maxRating: parseInt(e.target.value) })}
                          />
                        </div>
                      </div>
                    )}

                    {/* Contact Info Config */}
                    {q.type === 'contact-info' && (
                      <div className="space-y-2">
                        <Label>Fields to Include</Label>
                        <div className="flex flex-wrap gap-4 pt-2">
                          {['First Name', 'Last Name', 'Email', 'Phone', 'Company'].map(field => {
                            const fieldKey = field.toLowerCase().replace(' ', '_');
                            const isDefaultChecked = fieldKey === 'first_name' || fieldKey === 'email';
                            const isChecked = q.contactFields 
                              ? q.contactFields.includes(fieldKey) 
                              : isDefaultChecked;
                            return (
                              <div key={field} className="flex items-center space-x-2">
                                <Switch 
                                  id={`${q.id}-${field}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const currentFields = q.contactFields || ['first_name', 'email'];
                                    const newFields = checked 
                                      ? [...currentFields, fieldKey]
                                      : currentFields.filter(f => f !== fieldKey);
                                    updateQuestion(index, { contactFields: newFields });
                                  }}
                                />
                                <Label htmlFor={`${q.id}-${field}`}>{field}</Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                            </div> {/* closes div onClick */}
                          </CardContent>
                        </Card>
                      );
                    })}
                    <Button variant="outline" className="w-full border-dashed" onClick={addQuestion}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Question
                    </Button>
                  </>
                )}
              </div>

              {/* Right Column: Question Settings */}
              {!isSettingsCollapsed && (
                <div className="lg:col-span-1 lg:sticky lg:top-24 animate-in fade-in duration-200">
                  <Card className="border shadow-xs bg-card/70 backdrop-blur-xs">
                  <CardHeader className="pb-4 border-b">
                    <div className="flex items-center justify-between gap-2 text-primary font-bold">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4" />
                        <CardTitle className="text-sm tracking-tight">[Question {selectedQuestionIndex + 1}] Settings</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:bg-muted"
                        onClick={() => setIsSettingsCollapsed(true)}
                        title="Collapse settings"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                    <CardDescription className="text-xs">
                      Advanced configurations for this question.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-5 pt-5">
                    {(() => {
                      const q = survey.questions[selectedQuestionIndex];
                      if (!q) {
                        return (
                          <div className="text-center py-6 text-muted-foreground text-xs">
                            No question selected. Click a question on the left to configure.
                          </div>
                        );
                      }

                      const isMultipleChoice = q.type === 'multiple-choice';
                      const isText = q.type === 'text';
                      const isThisOrThat = q.type === 'this-or-that';
                      const isRankedOrder = q.type === 'ranked-order';
                      const isRating = q.type === 'rating';
                      const isContact = q.type === 'contact-info';

                      return (
                        <div className="space-y-5 text-sm">
                          {/* 1. Placeholder Text (for text inputs) */}
                          {isText && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Placeholder Text</Label>
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60" title="Displayed inside the input field before typing." />
                              </div>
                              <Input 
                                value={q.placeholder || ''} 
                                onChange={(e) => updateQuestion(selectedQuestionIndex, { placeholder: e.target.value })}
                                placeholder="e.g. Type your answer here..."
                                className="text-xs bg-background/50"
                              />
                            </div>
                          )}

                          {/* 2. URL Parameter (for all non-contact-info question types) */}
                          {!isContact && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">URL Parameter</Label>
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60" title="Map query params (e.g. ?email=foo) to auto-fill & hide." />
                              </div>
                              <div className="relative">
                                <Link className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
                                <Input 
                                  placeholder="e.g. email, company, utm_source" 
                                  value={q.paramMapping || ''} 
                                  onChange={(e) => updateQuestion(selectedQuestionIndex, { paramMapping: e.target.value })}
                                  className="pl-9 text-xs bg-background/50"
                                />
                              </div>
                            </div>
                          )}

                          {/* 3. Other write-in (for multiple-choice) */}
                          {isMultipleChoice && (
                            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                              <div className="space-y-0.5">
                                <Label htmlFor={`allow-other-opt-${q.id}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Other Write-In</Label>
                                <p className="text-[10px] text-muted-foreground">Allow respondents to submit custom text.</p>
                              </div>
                              <Switch 
                                id={`allow-other-opt-${q.id}`} 
                                checked={!!q.allowOther} 
                                onCheckedChange={(val) => updateQuestion(selectedQuestionIndex, { allowOther: val })}
                              />
                            </div>
                          )}

                          {/* 4. Multiple Selections (for multiple-choice) */}
                          {isMultipleChoice && (
                            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                              <div className="space-y-0.5">
                                <Label htmlFor={`allow-multiple-opt-${q.id}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Multiple Selections</Label>
                                <p className="text-[10px] text-muted-foreground">Enable selecting more than one option.</p>
                              </div>
                              <Switch 
                                id={`allow-multiple-opt-${q.id}`} 
                                checked={!!q.allowMultiple} 
                                onCheckedChange={(val) => {
                                  updateQuestion(selectedQuestionIndex, { 
                                    allowMultiple: val, 
                                    maxSelections: val ? 2 : undefined 
                                  });
                                }}
                              />
                            </div>
                          )}

                          {/* 5. Max Selections Number (for multiple-choice with allowMultiple) */}
                          {isMultipleChoice && q.allowMultiple && (
                            <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Max Selections</Label>
                              <Input 
                                type="number" 
                                min={1}
                                max={q.options?.length || 10}
                                value={q.maxSelections || 1} 
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  updateQuestion(selectedQuestionIndex, { maxSelections: val });
                                }}
                                className="text-xs w-24 bg-background/50"
                              />
                            </div>
                          )}

                          {/* 5.1 Multiple Choice Option Mappings */}
                          {isMultipleChoice && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Option URL Parameters</Label>
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60" title="Map specific URL parameter names to pre-select each option." />
                              </div>
                              <div className="space-y-2 border bg-muted/10 p-2.5 rounded-lg">
                                {q.options && q.options.length > 0 ? (
                                  q.options.map((option, optIdx) => (
                                    <div key={optIdx} className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground truncate block" title={option}>Option: "{option}"</Label>
                                      <div className="relative">
                                        <Link className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground/50" />
                                        <Input 
                                          placeholder={`e.g. opt_${optIdx + 1}`} 
                                          value={q.optionParamMappings?.[option] || ''} 
                                          onChange={(e) => {
                                            const newMappings = { ...(q.optionParamMappings || {}) };
                                            newMappings[option] = e.target.value;
                                            updateQuestion(selectedQuestionIndex, { optionParamMappings: newMappings });
                                          }}
                                          className="pl-8 h-7 text-xs bg-background/50"
                                        />
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-muted-foreground">No options defined on the left card.</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 6. Optional Sourcing (for this-or-that, ranked-order) */}
                          {(isThisOrThat || isRankedOrder) && (
                            <div className="space-y-2 p-3 border rounded-lg bg-primary/5">
                              <div className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                                <Label className="text-xs font-bold uppercase tracking-wider text-primary">Option Sourcing Engine</Label>
                              </div>
                              <select
                                className="flex h-9 w-full rounded-md border border-input bg-background/80 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary cursor-pointer"
                                value={q.dynamicOptionsFromQuestionId || ""}
                                onChange={(e) => {
                                  updateQuestion(selectedQuestionIndex, { dynamicOptionsFromQuestionId: e.target.value || undefined });
                                }}
                              >
                                <option value="">Static List (Defined on Left)</option>
                                {survey.questions.slice(0, selectedQuestionIndex).map((otherQ, otherIdx) => (
                                  <option key={otherQ.id} value={otherQ.id}>
                                    ✨ Feed Q{otherIdx + 1}: {otherQ.question.substring(0, 30)}...
                                  </option>
                                ))}
                              </select>
                              <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                                Dynamically seed choices/ranking pool from options picked or text entered in preceding questions.
                              </p>
                            </div>
                          )}

                          {/* Dynamic URL Parameters for Contact forms */}
                          {isContact && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Field URL Parameters</Label>
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60" title="Map specific URL query parameters to pre-fill each enabled field." />
                              </div>
                              <div className="space-y-3 border bg-muted/10 p-2.5 rounded-lg">
                                {(() => {
                                  const enabledFields = q.contactFields !== undefined ? q.contactFields : ['first_name', 'email'];
                                  if (enabledFields.length === 0) {
                                    return (
                                      <p className="text-xs text-muted-foreground italic text-center py-2">No fields are enabled on the left card.</p>
                                    );
                                  }
                                  return enabledFields.map(fieldKey => {
                                    const fieldLabel = fieldKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                    const hideIfPrefilled = q.contactHideIfPrefilled?.[fieldKey] !== false; // defaults to true
                                    const alwaysHidden = q.contactAlwaysHidden?.[fieldKey] || false; // defaults to false
                                    
                                    return (
                                      <div key={fieldKey} className="space-y-2 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                                        <Label className="text-xs font-semibold text-foreground/80 block">{fieldLabel}</Label>
                                        
                                        <div className="space-y-1">
                                          <div className="relative">
                                            <Link className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground/50" />
                                            <Input 
                                              placeholder={`e.g. ${fieldKey}`} 
                                              value={q.contactParamMappings?.[fieldKey] || ''} 
                                              onChange={(e) => {
                                                const newMappings = { ...(q.contactParamMappings || {}) };
                                                newMappings[fieldKey] = e.target.value;
                                                updateQuestion(selectedQuestionIndex, { contactParamMappings: newMappings });
                                              }}
                                              className="pl-8 h-7 text-xs bg-background/50"
                                            />
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-4 pt-1 bg-muted/25 px-2 py-1 rounded-md">
                                          <div className="space-y-0.5">
                                            <Label className="text-[10px] font-bold text-muted-foreground cursor-pointer" htmlFor={`hide-prefilled-${fieldKey}`}>
                                              Hide if Populated
                                            </Label>
                                            <p className="text-[9px] text-muted-foreground/60 leading-none">Hide when pre-filled from URL</p>
                                          </div>
                                          <Switch 
                                            id={`hide-prefilled-${fieldKey}`}
                                            checked={hideIfPrefilled}
                                            onCheckedChange={(checked) => {
                                              const newHideIfPrefilled = { ...(q.contactHideIfPrefilled || {}) };
                                              newHideIfPrefilled[fieldKey] = checked;
                                              
                                              const newAlwaysHidden = { ...(q.contactAlwaysHidden || {}) };
                                              if (checked) {
                                                newAlwaysHidden[fieldKey] = false;
                                              }
                                              
                                              updateQuestion(selectedQuestionIndex, { 
                                                contactHideIfPrefilled: newHideIfPrefilled,
                                                contactAlwaysHidden: newAlwaysHidden
                                              });
                                            }}
                                            className="scale-75"
                                          />
                                        </div>

                                        {!hideIfPrefilled && (
                                          <div className="flex items-center justify-between gap-4 pt-1 bg-amber-500/5 border border-amber-500/10 px-2 py-1 rounded-md transition-all duration-200">
                                            <div className="space-y-0.5">
                                              <Label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 cursor-pointer" htmlFor={`always-hidden-${fieldKey}`}>
                                                Is Hidden (Always)
                                              </Label>
                                              <p className="text-[9px] text-muted-foreground/60 leading-none">Always hide from respondent</p>
                                            </div>
                                            <Switch 
                                              id={`always-hidden-${fieldKey}`}
                                              checked={alwaysHidden}
                                              onCheckedChange={(checked) => {
                                                const newAlwaysHidden = { ...(q.contactAlwaysHidden || {}) };
                                                newAlwaysHidden[fieldKey] = checked;
                                                updateQuestion(selectedQuestionIndex, { contactAlwaysHidden: newAlwaysHidden });
                                              }}
                                              className="scale-75"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
              )}
            </div>
          </TabsContent>

            <TabsContent value="design" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Theme Colors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Background Color</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={survey.style.backgroundColor} onChange={(e) => setSurvey({...survey, style: {...survey.style, backgroundColor: e.target.value}})} className="w-12 p-1" />
                        <Input value={survey.style.backgroundColor} onChange={(e) => setSurvey({...survey, style: {...survey.style, backgroundColor: e.target.value}})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Text Color</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={survey.style.textColor} onChange={(e) => setSurvey({...survey, style: {...survey.style, textColor: e.target.value}})} className="w-12 p-1" />
                        <Input value={survey.style.textColor} onChange={(e) => setSurvey({...survey, style: {...survey.style, textColor: e.target.value}})} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Accent Color</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={survey.style.accentColor} onChange={(e) => setSurvey({...survey, style: {...survey.style, accentColor: e.target.value}})} className="w-12 p-1" />
                        <Input value={survey.style.accentColor} onChange={(e) => setSurvey({...survey, style: {...survey.style, accentColor: e.target.value}})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Button Text</Label>
                      <Input value={survey.style.buttonText} onChange={(e) => setSurvey({...survey, style: {...survey.style, buttonText: e.target.value}})} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Survey Name</Label>
                    <Input value={survey.name} onChange={(e) => setSurvey({...survey, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Internal Description</Label>
                    <Textarea value={survey.description} onChange={(e) => setSurvey({...survey, description: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>SEO & AEO Description (Public)</Label>
                    <Textarea 
                      placeholder="Optimized description for search engines and AI answer engines..."
                      value={survey.seoDescription || ''} 
                      onChange={(e) => setSurvey({...survey, seoDescription: e.target.value})} 
                    />
                    <p className="text-[10px] text-muted-foreground">This description is used for meta tags to help search engines and AI index your survey correctly.</p>
                  </div>
                  <div className="space-y-2 pt-4">
                    <Label htmlFor="statusSelect">Survey Status</Label>
                    <select
                      id="statusSelect"
                      value={survey.status}
                      onChange={(e) => setSurvey({...survey, status: e.target.value as 'draft' | 'testing' | 'published'})}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                    >
                      <option value="draft">Draft (Private edit mode)</option>
                      <option value="testing">Testing (Saves responses as test records)</option>
                      <option value="published">Published (Live for official submissions)</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {survey.status === 'draft' && "Draft surveys can only be edited. Respondents cannot submit answers yet."}
                      {survey.status === 'testing' && "Testing surveys are fully live for testing, but all submissions are labeled as TEST entries which can be filtered or bulk-deleted."}
                      {survey.status === 'published' && "Published surveys are live. Standard responses are logged as official subscriber records."}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch 
                      id="skipIntro" 
                      checked={survey.settings?.skipIntro || false} 
                      onCheckedChange={(val) => setSurvey({
                        ...survey,
                        settings: {
                          ...(survey.settings || {}),
                          skipIntro: val
                        }
                      })}
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="skipIntro">Skip Welcome / Intro Screen</Label>
                      <p className="text-xs text-muted-foreground">Start the first question immediately when the survey loads.</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch 
                      id="preventMultiple" 
                      checked={survey.settings?.preventMultiple || false} 
                      onCheckedChange={(val) => setSurvey({
                        ...survey,
                        settings: {
                          ...(survey.settings || {}),
                          preventMultiple: val
                        }
                      })}
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="preventMultiple">Restrict to One Response</Label>
                      <p className="text-xs text-muted-foreground">Prevent users from submitting twice on the same browser / device.</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch 
                      id="useRanksmashFormula" 
                      checked={survey.settings?.useRanksmashFormula || false} 
                      onCheckedChange={(val) => setSurvey({
                        ...survey,
                        settings: {
                          ...(survey.settings || {}),
                          useRanksmashFormula: val
                        }
                      })}
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="useRanksmashFormula">Use Ranksmash Inference & Rating Formula</Label>
                      <p className="text-xs text-muted-foreground">Enable the transitive implication sifter (transitive logic where Option A preferred to B, and B preferred to C implies A preferred to C) and the Win Percentage Tie Breaker (V2 formula) to compute the ultimate preference order with fewer user matchups.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custom Thank You Page Builder</CardTitle>
                  <CardDescription>Design the successful completion screen with custom titles/messages, personalized preference rankings, and destek links.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Thank You Title</Label>
                    <Input 
                      placeholder="e.g. Thank You!" 
                      value={survey.settings?.thankYouTitle ?? 'Thank You!'} 
                      onChange={(e) => setSurvey({
                        ...survey,
                        settings: {
                          ...(survey.settings || {}),
                          thankYouTitle: e.target.value
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Thank You Message</Label>
                    <Textarea 
                      placeholder="e.g. Your response has been recorded. We appreciate your feedback." 
                      value={survey.settings?.thankYouMessage ?? 'Your response has been recorded. We appreciate your feedback.'} 
                      onChange={(e) => setSurvey({
                        ...survey,
                        settings: {
                          ...(survey.settings || {}),
                          thankYouMessage: e.target.value
                        }
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preference Rankings Header Text</Label>
                    <Input 
                      placeholder="e.g. Your Preference Rankings" 
                      value={survey.settings?.thankYouRankingsHeader ?? 'Your Preference Rankings'} 
                      onChange={(e) => setSurvey({
                        ...survey,
                        settings: {
                          ...(survey.settings || {}),
                          thankYouRankingsHeader: e.target.value
                        }
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preference Rankings Description / Subtext</Label>
                    <Textarea 
                      placeholder="e.g. We found custom resources for your top choices. Tap or click any item below to access yours!" 
                      value={survey.settings?.thankYouRankingsSubtext ?? '💡 We found custom resources for your top choices. Tap or click any item with a link icon ↗ below to access yours!'} 
                      onChange={(e) => setSurvey({
                        ...survey,
                        settings: {
                          ...(survey.settings || {}),
                          thankYouRankingsSubtext: e.target.value
                        }
                      })}
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch 
                      id="thankYouShowSubmitAnother" 
                      checked={survey.settings?.thankYouShowSubmitAnother !== false} 
                      onCheckedChange={(val) => setSurvey({
                        ...survey,
                        settings: {
                          ...(survey.settings || {}),
                          thankYouShowSubmitAnother: val
                        }
                      })}
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="thankYouShowSubmitAnother">Show 'Submit Another Response' Button</Label>
                      <p className="text-xs text-muted-foreground">Allow respondents to submit another response from the thank you page.</p>
                    </div>
                  </div>

                  {survey.settings?.thankYouShowSubmitAnother !== false && (
                    <div className="space-y-2 pl-6 border-l-2 border-primary/30 pt-1">
                      <Label>Submit Another Response Button Text</Label>
                      <Input 
                        placeholder="e.g. Submit Another Response" 
                        value={survey.settings?.thankYouSubmitAnotherButtonText ?? 'Submit Another Response'} 
                        onChange={(e) => setSurvey({
                          ...survey,
                          settings: {
                            ...(survey.settings || {}),
                            thankYouSubmitAnotherButtonText: e.target.value
                          }
                        })}
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch 
                      id="thankYouShowResults" 
                      checked={survey.settings?.thankYouShowResults || false} 
                      onCheckedChange={(val) => setSurvey({
                        ...survey,
                        settings: {
                          ...(survey.settings || {}),
                          thankYouShowResults: val
                        }
                      })}
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="thankYouShowResults">Showcase Preference Rankings & Support Links</Label>
                      <p className="text-xs text-muted-foreground">Automatically display user's customized preference list with support resources.</p>
                    </div>
                  </div>

                  {survey.settings?.thankYouShowResults && (
                    <div className="space-y-4 pl-6 border-l-2 border-primary/30 pt-2">
                      <div className="space-y-2">
                        <Label>Select Question to Reference / Showcase</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={survey.settings?.thankYouHighlightedQuestionId || ''}
                          onChange={(e) => setSurvey({
                            ...survey,
                            settings: {
                              ...(survey.settings || {}),
                              thankYouHighlightedQuestionId: e.target.value
                            }
                          })}
                        >
                          <option value="">-- Choose a Question --</option>
                          {survey.questions.map(q => (
                            <option key={q.id} value={q.id}>
                              ({q.type}) {q.question.substring(0, 50)}...
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-muted-foreground">
                          Works perfectly with <strong>Ranked Order</strong> (user-reordered list), <strong>This or That</strong> (computed matchup choices), and <strong>Multiple Choice</strong>.
                        </p>
                      </div>

                      {(() => {
                        const selQId = survey.settings?.thankYouHighlightedQuestionId;
                        const selectedQuestion = survey.questions.find(q => q.id === selQId);
                        if (!selectedQuestion) return null;

                        const options = selectedQuestion.options || [];
                        if (options.length === 0) {
                          return (
                            <p className="text-xs text-amber-500 font-medium">
                              This question has no options configured. Add options in the Questions tab to tie links to.
                            </p>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Option Link & Resource Settings</Label>
                            
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                              {options.map(option => {
                                const optionKey = `${selQId}_${option}`;
                                const optionLink = survey.settings?.thankYouOptionLinks?.[optionKey] || { label: '', url: '' };

                                return (
                                  <div key={option} className="p-3 bg-muted/40 rounded-lg space-y-2 border border-muted">
                                    <div className="font-semibold text-xs truncate" title={option}>
                                      Option: <span className="text-foreground">{option}</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">Resource Link Title / Label</Label>
                                        <Input 
                                          placeholder="e.g. Learn More" 
                                          className="h-8 text-xs"
                                          value={optionLink.label || ''}
                                          onChange={(e) => {
                                            const updatedLinks = {
                                              ...(survey.settings?.thankYouOptionLinks || {}),
                                              [optionKey]: {
                                                label: e.target.value,
                                                url: optionLink.url || ''
                                              }
                                            };
                                            setSurvey({
                                              ...survey,
                                              settings: {
                                                ...(survey.settings || {}),
                                                thankYouOptionLinks: updatedLinks
                                              }
                                            });
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">Support Resource URL</Label>
                                        <Input 
                                          placeholder="https://example.com/guide" 
                                          className="h-8 text-xs"
                                          value={optionLink.url || ''}
                                          onChange={(e) => {
                                            const updatedLinks = {
                                              ...(survey.settings?.thankYouOptionLinks || {}),
                                              [optionKey]: {
                                                label: optionLink.label || '',
                                                url: e.target.value
                                              }
                                            };
                                            setSurvey({
                                              ...survey,
                                              settings: {
                                                ...(survey.settings || {}),
                                                thankYouOptionLinks: updatedLinks
                                              }
                                            });
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>URL Parameters</CardTitle>
                  <CardDescription>Prescribe parameters to capture from the URL (e.g., utm_source, ref_id).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(survey.settings?.urlParams || []).map((param, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-sm">
                        <span>{param}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-4 w-4" 
                          onClick={() => {
                            const newParams = (survey.settings?.urlParams || []).filter((_, i) => i !== idx);
                            setSurvey({...survey, settings: {...(survey.settings || {}), urlParams: newParams}});
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      id="new-param"
                      placeholder="e.g. utm_source" 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) {
                            const newParams = [...(survey.settings?.urlParams || []), val];
                            setSurvey({...survey, settings: {...(survey.settings || {}), urlParams: newParams}});
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById('new-param') as HTMLInputElement;
                        const val = input.value.trim();
                        if (val) {
                          const newParams = [...(survey.settings?.urlParams || []), val];
                          setSurvey({...survey, settings: {...(survey.settings || {}), urlParams: newParams}});
                          input.value = '';
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>URL Parameter Mapping Overview</CardTitle>
                  <CardDescription>See all questions mapped to URL parameters and test them.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    {survey.questions.some(q => q.paramMapping) ? (
                      <div className="border rounded-lg divide-y">
                        {survey.questions.filter(q => q.paramMapping).map((q, idx) => (
                          <div key={q.id} className="p-3 flex items-center justify-between text-sm">
                            <div className="space-y-1">
                              <p className="font-medium">{q.question.substring(0, 40)}...</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">?{q.paramMapping}=value</span>
                                <span className="text-[10px] text-muted-foreground">Auto-fills & Hides</span>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                const url = `${window.location.origin}/survey/${survey.id}?${q.paramMapping}=test_value`;
                                navigator.clipboard.writeText(url);
                                toast.success(`Test URL copied for ?${q.paramMapping}`);
                              }}
                            >
                              <Copy className="w-3 h-3 mr-2" />
                              Copy Test URL
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 border border-dashed rounded-lg bg-muted/20">
                        <p className="text-sm text-muted-foreground">No questions are currently mapped to URL parameters.</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Go to the Questions tab to add mappings.</p>
                      </div>
                    )}
                  </div>

                  {survey.questions.some(q => q.paramMapping) && (
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-3">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Master Test URL
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Test multiple parameters at once by combining them in the URL.
                      </p>
                      <div className="flex gap-2">
                        <Input 
                          readOnly 
                          value={`${window.location.origin}/survey/${survey.id}?${survey.questions.filter(q => q.paramMapping).map(q => `${q.paramMapping}=value`).join('&')}`}
                          className="h-8 text-[10px] font-mono bg-background"
                        />
                        <Button 
                          size="sm" 
                          className="h-8"
                          onClick={() => {
                            const url = `${window.location.origin}/survey/${survey.id}?${survey.questions.filter(q => q.paramMapping).map(q => `${q.paramMapping}=value`).join('&')}`;
                            window.open(url, '_blank');
                          }}
                        >
                          Test All
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tracking & Analytics</CardTitle>
                  <CardDescription>Add tracking IDs for Facebook, Google, and LinkedIn.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Google Analytics ID (G-XXXXXXX)</Label>
                    <Input 
                      value={survey.settings?.tracking?.googleAnalyticsId || ''} 
                      onChange={(e) => setSurvey({
                        ...survey, 
                        settings: {
                          ...(survey.settings || {}), 
                          tracking: {
                            ...(survey.settings?.tracking || {}), 
                            googleAnalyticsId: e.target.value
                          }
                        }
                      })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Facebook Pixel ID</Label>
                    <Input 
                      value={survey.settings?.tracking?.facebookPixelId || ''} 
                      onChange={(e) => setSurvey({
                        ...survey, 
                        settings: {
                          ...(survey.settings || {}), 
                          tracking: {
                            ...(survey.settings?.tracking || {}), 
                            facebookPixelId: e.target.value
                          }
                        }
                      })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>LinkedIn Insight ID</Label>
                    <Input 
                      value={survey.settings?.tracking?.linkedinInsightId || ''} 
                      onChange={(e) => setSurvey({
                        ...survey, 
                        settings: {
                          ...(survey.settings || {}), 
                          tracking: {
                            ...(survey.settings?.tracking || {}), 
                            linkedinInsightId: e.target.value
                          }
                        }
                      })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>TikTok Pixel ID</Label>
                    <Input 
                      value={survey.settings?.tracking?.tiktokPixelId || ''} 
                      onChange={(e) => setSurvey({
                        ...survey, 
                        settings: {
                          ...(survey.settings || {}), 
                          tracking: {
                            ...(survey.settings?.tracking || {}), 
                            tiktokPixelId: e.target.value
                          }
                        }
                      })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Tracking Script (HTML/JS)</Label>
                    <Textarea 
                      placeholder="<script>...</script>"
                      className="font-mono text-xs"
                      value={survey.settings?.tracking?.customScript || ''} 
                      onChange={(e) => setSurvey({
                        ...survey, 
                        settings: {
                          ...(survey.settings || {}), 
                          tracking: {
                            ...(survey.settings?.tracking || {}), 
                            customScript: e.target.value
                          }
                        }
                      })} 
                    />
                    <p className="text-[10px] text-muted-foreground">Warning: Be careful with custom scripts as they can affect survey performance.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Integrations & Webhooks</CardTitle>
                  <CardDescription>
                    Send survey form submissions as a JSON POST payload to an external URL (e.g. Zapier, Make, Slack, or a custom API).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhookUrl">Webhook Endpoint URL</Label>
                    <Input 
                      id="webhookUrl"
                      placeholder="e.g. https://api.yourdomain.com/webhooks/survey-results" 
                      value={survey.settings?.webhookUrl || ''} 
                      onChange={(e) => setSurvey({
                        ...survey, 
                        settings: {
                          ...(survey.settings || {}), 
                          webhookUrl: e.target.value
                        }
                      })} 
                    />
                    <p className="text-xs text-muted-foreground">
                      We will issue a <code>POST</code> request with a JSON payload whenever a respondent successfully completes this survey.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={testWebhook}
                      disabled={testingWebhook || !survey.settings?.webhookUrl}
                      className="w-full sm:w-auto"
                    >
                      {testingWebhook ? 'Sending Test Payload...' : 'Test Webhook Integration'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
      </main>
    </div>
  );
};
