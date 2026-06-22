import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Survey, SurveyQuestion } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Plus, Trash2, Settings, Palette, ListTodo, X, GitBranch, Trophy, Link, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export const SurveyEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingWebhook, setTestingWebhook] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchSurvey = async () => {
      try {
        const docRef = doc(db, 'surveys', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSurvey({ id: docSnap.id, ...docSnap.data() } as Survey);
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
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!survey) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="gap-2" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <h1 className="font-semibold text-lg">{survey.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.open(`/s/${id}?test=true`, '_blank')}>
              Preview
            </Button>
            <Button onClick={saveSurvey}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="questions">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="questions">
                <ListTodo className="w-4 h-4 mr-2" />
                Questions
              </TabsTrigger>
              <TabsTrigger value="design">
                <Palette className="w-4 h-4 mr-2" />
                Design
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="questions" className="space-y-4">
              {survey.questions.map((q, index) => (
                <Card key={q.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Question {index + 1}</CardTitle>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeQuestion(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Category (Optional)</Label>
                        <Input 
                          value={q.category || ''} 
                          onChange={(e) => updateQuestion(index, { category: e.target.value })}
                          placeholder="e.g. AI ADOPTION"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Question Text</Label>
                        <Input 
                          value={q.question} 
                          onChange={(e) => updateQuestion(index, { question: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <select 
                          className="w-full h-10 px-3 rounded-md border bg-background"
                          value={q.type}
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
                      </div>
                      <div className="flex items-center space-x-2 pt-8">
                        <Switch 
                          id={`required-${q.id}`} 
                          checked={q.required} 
                          onCheckedChange={(val) => updateQuestion(index, { required: val })}
                        />
                        <Label htmlFor={`required-${q.id}`}>Required</Label>
                      </div>
                    </div>

                    <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-dashed">
                      <div className="flex items-center gap-2">
                        <Link className="w-3 h-3 text-primary" />
                        <Label className="text-xs font-bold uppercase tracking-wider text-primary">URL Parameter Mapping</Label>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Map a URL parameter (e.g. <code>?email=user@example.com</code>) to this question. 
                        If found, the answer will be auto-filled and this question will be hidden.
                      </p>
                      <Input 
                        placeholder="e.g. email, company, utm_source" 
                        value={q.paramMapping || ''} 
                        onChange={(e) => updateQuestion(index, { paramMapping: e.target.value })}
                        className="h-8 text-xs bg-background"
                      />
                    </div>

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
                        </div>
                      </div>
                    )}

                    {/* Ranked Order Config */}
                    {q.type === 'ranked-order' && (
                      <div className="space-y-4">
                        <div className="pb-3 border-b border-border/40 bg-muted/35 p-3 rounded-lg">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Option Sourcing Engine</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-xs ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                            value={q.dynamicOptionsFromQuestionId || ""}
                            onChange={(e) => {
                              updateQuestion(index, { dynamicOptionsFromQuestionId: e.target.value || undefined });
                            }}
                          >
                            <option value="">Static List of Options (Defined Below)</option>
                            <option value="stub" disabled>✨ Dynamic Source: Feed from previous Question input (Stubbed)...</option>
                          </select>
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            Allows you to dynamically seed this matching/ranking pool from answers/inputs collected in preceding questions.
                          </p>
                        </div>

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
                        <div className="pb-3 border-b border-border/40 bg-muted/35 p-3 rounded-lg">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Option Sourcing Engine</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-xs ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                            value={q.dynamicOptionsFromQuestionId || ""}
                            onChange={(e) => {
                              updateQuestion(index, { dynamicOptionsFromQuestionId: e.target.value || undefined });
                            }}
                          >
                            <option value="">Static List of Options (Defined Below)</option>
                            <option value="stub" disabled>✨ Dynamic Source: Feed from previous Question input (Stubbed)...</option>
                          </select>
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            Allows you to dynamically seed this matching/ranking pool from answers/inputs collected in preceding questions.
                          </p>
                        </div>

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
                      <div className="space-y-2">
                        <Label>Placeholder Text</Label>
                        <Input 
                          value={q.placeholder || ''} 
                          onChange={(e) => updateQuestion(index, { placeholder: e.target.value })}
                          placeholder="e.g. Type your answer here..."
                        />
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
                          {['First Name', 'Last Name', 'Email', 'Phone', 'Company'].map(field => (
                            <div key={field} className="flex items-center space-x-2">
                              <Switch 
                                id={`${q.id}-${field}`}
                                checked={q.contactFields?.includes(field.toLowerCase().replace(' ', '_')) || false}
                                onCheckedChange={(checked) => {
                                  const fieldKey = field.toLowerCase().replace(' ', '_');
                                  const currentFields = q.contactFields || [];
                                  const newFields = checked 
                                    ? [...currentFields, fieldKey]
                                    : currentFields.filter(f => f !== fieldKey);
                                  updateQuestion(index, { contactFields: newFields });
                                }}
                              />
                              <Label htmlFor={`${q.id}-${field}`}>{field}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" className="w-full border-dashed" onClick={addQuestion}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
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
        </div>

        <div className="space-y-6">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Questions</span>
                <span className="font-medium">{survey.questions.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Responses</span>
                <span className="font-medium">{survey.responsesCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground">Status</span>
                <select
                  value={survey.status}
                  onChange={(e) => setSurvey({...survey, status: e.target.value as 'draft' | 'testing' | 'published'})}
                  className="font-medium text-xs rounded border border-input bg-background px-2.5 py-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer focus:border-ring uppercase tracking-wide bg-no-repeat bg-right pr-6 appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='none' stroke='currentColor' stroke-width='2' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'></path></svg>")`,
                    backgroundSize: '10px',
                    backgroundPosition: 'calc(100% - 8px) center',
                  }}
                >
                  <option value="draft" className="text-foreground capitalize text-xs">Draft</option>
                  <option value="testing" className="text-foreground capitalize text-xs">Testing</option>
                  <option value="published" className="text-foreground capitalize text-xs">Published</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
