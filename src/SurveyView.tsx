import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, addDoc, collection, updateDoc, increment, setDoc } from 'firebase/firestore';
import { Survey, SurveyQuestion } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Send, CheckCircle2, ArrowUp, ArrowDown, GripVertical, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const safeGetLocalStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

const safeSetLocalStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Ignore
  }
};

const cleanUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)).filter(item => item !== undefined);
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
};

export const SurveyView: React.FC = () => {
  const { id } = useParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [currentStep, setCurrentStep] = useState(-1); // -1 is welcome screen
  const [history, setHistory] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const responseIdRef = useRef<string | null>(null);
  const lastSavePromiseRef = useRef<Promise<any>>(Promise.resolve());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [totMatchups, setTotMatchups] = useState<Array<{ left: string; right: string; selected?: string }>>([]);
  const [totIndex, setTotIndex] = useState(0);
  const [isTest, setIsTest] = useState(false);
  const [isTestParam, setIsTestParam] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const testParam = urlParams.get('test') === 'true' || urlParams.get('preview') === 'true';
    if (testParam) {
      setIsTest(true);
      setIsTestParam(true);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchSurvey = async () => {
      try {
        const docRef = doc(db, 'surveys', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.id ? { id: docSnap.id, ...docSnap.data() } as Survey : null;
          
          // Check if multiple submissions are disabled and they already completed
          const isTestMode = data?.status === 'testing' || 
            new URLSearchParams(window.location.search).get('test') === 'true' || 
            new URLSearchParams(window.location.search).get('preview') === 'true';
          const hasSubmitted = safeGetLocalStorage(`survey_submitted_${id}`) === 'true';
          if (data?.settings?.preventMultiple && hasSubmitted && !isTestMode) {
            setAlreadySubmitted(true);
            setSurvey(data);
            setInitialLoading(false);
            return;
          }

          if (data?.status === 'draft') {
             toast.error('This survey is currently in Draft mode');
          } else if (data?.status === 'testing') {
             setIsTest(true);
             setIsTestParam(true);
          }
          setSurvey(data);

          // Increment views count
          if (data?.status === 'published' || data?.status === 'testing') {
            updateDoc(docRef, {
              viewsCount: increment(1)
            }).catch(e => console.warn("Failed to increment views:", e));
          }

          // SEO & AEO: Update Page Title and Meta Description
          if (data) {
            document.title = data.name;
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
              metaDesc = document.createElement('meta');
              metaDesc.setAttribute('name', 'description');
              document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute('content', data.seoDescription || data.description);
          }

          // Capture URL Parameters & Map to Questions
          const urlParams = new URLSearchParams(window.location.search);
          const captured: Record<string, string> = {};
          
          // 1. Capture general settings params
          if (data?.settings?.urlParams) {
            data.settings.urlParams.forEach(param => {
              const val = urlParams.get(param);
              if (val) captured[param] = val;
            });
          }

          // 2. Map params to specific questions
          if (data?.questions) {
            data.questions.forEach(q => {
              if (q.paramMapping) {
                const val = urlParams.get(q.paramMapping);
                if (val) captured[q.id] = val;
              }
            });
          }

          if (Object.keys(captured).length > 0) {
            setAnswers(prev => ({ ...prev, ...captured }));
          }

          // If skipIntro is true, we immediately go to first non-prefilled step
          if (data?.settings?.skipIntro) {
            setStartTime(Date.now());
            let firstStep = 0;
            while (
              firstStep < (data.questions?.length || 0) &&
              data.questions[firstStep].paramMapping &&
              captured[data.questions[firstStep].id]
            ) {
              firstStep++;
            }
            if (firstStep < (data.questions?.length || 0)) {
              setCurrentStep(firstStep);
            } else {
              // all are prefilled! let's auto-submit!
              const autoSubmitAnswers = { ...captured };
              setAnswers(autoSubmitAnswers);
              setCurrentStep(data.questions.length - 1);
              setTimeout(() => {
                submitSurvey(autoSubmitAnswers, {});
              }, 100);
            }
          }

          // Tracking Simulation (In a real app, you'd inject scripts here)
          if (data?.settings?.tracking) {
            const { googleAnalyticsId, facebookPixelId, linkedinInsightId, tiktokPixelId, customScript } = data.settings.tracking;
            if (googleAnalyticsId) console.log(`[Tracking] Initializing Google Analytics: ${googleAnalyticsId}`);
            if (facebookPixelId) console.log(`[Tracking] Initializing Facebook Pixel: ${facebookPixelId}`);
            if (linkedinInsightId) console.log(`[Tracking] Initializing LinkedIn Insight: ${linkedinInsightId}`);
            if (tiktokPixelId) console.log(`[Tracking] Initializing TikTok Pixel: ${tiktokPixelId}`);
            
            if (customScript) {
              console.log("[Tracking] Injecting custom script...");
              const div = document.createElement('div');
              div.innerHTML = customScript;
              // Extract and execute scripts from the HTML
              const scripts = div.querySelectorAll('script');
              scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                document.head.appendChild(newScript);
              });
            }
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `surveys/${id}`);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchSurvey();
  }, [id]);

  useEffect(() => {
    if (!survey || currentStep < 0 || currentStep >= survey.questions.length) return;
    const currentQuestion = survey.questions[currentStep];
    if (currentQuestion.type === 'this-or-that') {
      const existing = answers[currentQuestion.id];
      if (Array.isArray(existing) && existing.length > 0) {
        setTotMatchups(existing);
        const firstUnanswered = existing.findIndex((m: any) => !m.selected);
        setTotIndex(firstUnanswered !== -1 ? firstUnanswered : 0);
      } else {
        const opts = currentQuestion.options || [];
        if (opts.length >= 2) {
          const pairs: Array<[string, string]> = [];
          for (let i = 0; i < opts.length; i++) {
            for (let j = i + 1; j < opts.length; j++) {
              pairs.push([opts[i], opts[j]]);
            }
          }
          const shuffled = [...pairs].sort(() => Math.random() - 0.5);
          let matchups = shuffled.map(([a, b]) => {
            const swap = Math.random() > 0.5;
            return {
              left: swap ? b : a,
              right: swap ? a : b,
            };
          });
          if (matchups.length > 15) {
            matchups = matchups.slice(0, 15);
          }
          setTotMatchups(matchups);
          setTotIndex(0);
          setAnswers(prev => ({ ...prev, [currentQuestion.id]: matchups }));
        } else {
          setTotMatchups([]);
          setTotIndex(0);
        }
      }
    }
  }, [currentStep, survey]);

  const runTransitiveInference = (matchupsList: Array<any>, options: Array<string>) => {
    // 1. Initialize direct wins map from user-made selections
    const directWins = new Map<string, Set<string>>();
    options.forEach(opt => directWins.set(opt, new Set()));

    matchupsList.forEach(m => {
      // Only use non-inferred (direct user) selections for building transitives
      if (m.selected && !m.inferred) {
        const winner = m.selected;
        const loser = m.selected === m.left ? m.right : m.left;
        directWins.get(winner)?.add(loser);
      }
    });

    // 2. Transitive reachability map
    const reachable = new Map<string, Set<string>>();
    options.forEach(opt => {
      reachable.set(opt, new Set(directWins.get(opt)));
    });

    let changed = true;
    while (changed) {
      changed = false;
      for (const u of options) {
        const uReach = reachable.get(u)!;
        for (const v of Array.from(uReach)) {
          const vReach = reachable.get(v)!;
          for (const w of Array.from(vReach)) {
            if (!uReach.has(w) && u !== w) {
              uReach.add(w);
              changed = true;
            }
          }
        }
      }
    }

    // 3. Update any unanswered or previously inferred matchups based on current users selections
    return matchupsList.map(m => {
      if (m.selected && !m.inferred) {
        // Keep user's direct selection intact
        return m;
      }

      // Check if we can infer this matchup
      const leftReachesRight = reachable.get(m.left)?.has(m.right) || false;
      const rightReachesLeft = reachable.get(m.right)?.has(m.left) || false;

      if (leftReachesRight && !rightReachesLeft) {
        return { ...m, selected: m.left, inferred: true };
      } else if (rightReachesLeft && !leftReachesRight) {
        return { ...m, selected: m.right, inferred: true };
      } else {
        // Can't infer, so keep it clear
        return { ...m, selected: undefined, inferred: undefined };
      }
    });
  };

  const handleThisOrThatSelection = (option: string) => {
    if (!survey || currentStep < 0) return;
    const currentQuestion = survey.questions[currentStep];
    const opts = currentQuestion.options || [];
    
    let updatedMatchups = totMatchups.map((m, idx) => {
      if (idx === totIndex) {
        return { ...m, selected: option, inferred: false };
      }
      return m;
    });

    // Apply Ranksmash Inference if enabled
    if (survey.settings?.useRanksmashFormula) {
      updatedMatchups = runTransitiveInference(updatedMatchups, opts);
    }
    
    setTotMatchups(updatedMatchups);
    const nextAnswers = { ...answers, [currentQuestion.id]: updatedMatchups };
    setAnswers(nextAnswers);
    
    // Auto-save this choice selection incrementally
    saveResponse(false, nextAnswers, scores);
    
    // Find next unanswered matchup
    let nextIdx = -1;
    for (let i = totIndex + 1; i < updatedMatchups.length; i++) {
      if (!updatedMatchups[i].selected) {
        nextIdx = i;
        break;
      }
    }
    if (nextIdx === -1) {
      for (let i = 0; i < totIndex; i++) {
        if (!updatedMatchups[i].selected) {
          nextIdx = i;
          break;
        }
      }
    }

    if (nextIdx !== -1) {
      setTimeout(() => {
        setTotIndex(nextIdx);
      }, 350);
    } else {
      // It was the last matchup of this question! Auto-submit if last, or auto-advance if more questions.
      setTimeout(() => {
        if (currentStep === survey.questions.length - 1) {
          submitSurvey(nextAnswers, scores);
        } else {
          handleNext(nextAnswers, scores);
        }
      }, 400);
    }
  };

  const saveResponse = (isComplete: boolean = false, customAnswers?: Record<string, any>, customScores?: Record<string, any>) => {
    const runSave = async () => {
      if (!id || !survey) return;
      
      const activeAnswers = customAnswers || answers;
      const activeScores = customScores || scores;
      
      let totalScore = 0;
      Object.keys(activeScores).forEach(qId => {
        totalScore += Number(activeScores[qId] || 0);
      });

      const urlParamsMetadata: Record<string, string> = {};
      
      if (survey.settings?.urlParams) {
        survey.settings.urlParams.forEach(param => {
          if (activeAnswers[param]) urlParamsMetadata[param] = activeAnswers[param];
        });
      }

      survey.questions.forEach(q => {
        if (q.paramMapping && activeAnswers[q.id]) {
          urlParamsMetadata[q.paramMapping] = activeAnswers[q.id];
        }
      });

      const timeToComplete = isComplete && startTime ? Math.round((Date.now() - startTime) / 1000) : 0;

      const responseData = {
        surveyId: id,
        answers: activeAnswers,
        scores: activeScores,
        totalScore,
        status: isComplete ? 'completed' : 'partial',
        isTest: isTest,
        lastActiveAt: Date.now(),
        ...(isComplete ? { submittedAt: Date.now() } : {}),
        metadata: {
          browser: navigator.userAgent,
          device: window.innerWidth < 768 ? 'mobile' : 'desktop',
          urlParams: urlParamsMetadata,
          ...(isComplete ? { timeToComplete } : {}),
          ...urlParamsMetadata
        }
      };

      try {
        const cleanedData = cleanUndefined(responseData);
        let currentId = responseIdRef.current;
        if (currentId) {
          // Use setDoc with merge: true instead of updateDoc to ensure document existence does not cause race condition errors
          await setDoc(doc(db, 'responses', currentId), cleanedData, { merge: true });
        } else {
          const docRef = doc(collection(db, 'responses'));
          currentId = docRef.id;
          responseIdRef.current = currentId;
          setResponseId(currentId);
          
          await setDoc(docRef, cleanedData);
          
          // Increment count on first save
          try {
            await updateDoc(doc(db, 'surveys', id), {
              responsesCount: increment(1)
            });
          } catch (e) {
            console.warn("Could not update count:", e);
          }
        }
        return responseData;
      } catch (error) {
        console.error("Error saving response:", error);
        if (isComplete) {
          throw error;
        }
        return responseData;
      }
    };

    const nextPromise = lastSavePromiseRef.current
      .then(runSave)
      .catch((err) => {
        console.warn("Queue error, attempting standalone save:", err);
        return runSave();
      });

    lastSavePromiseRef.current = nextPromise;
    return nextPromise;
  };

  const handleNext = async (customAnswers?: Record<string, any>, customScores?: Record<string, any>) => {
    const activeAnswers = customAnswers || answers;
    const activeScores = customScores || scores;

    if (currentStep === -1) {
      setHistory([-1]);
      setStartTime(Date.now());
      
      // Find first question that isn't auto-filled
      let firstStep = 0;
      const urlParams = new URLSearchParams(window.location.search);
      while (firstStep < (survey?.questions.length || 0)) {
        const q = survey?.questions[firstStep];
        if (q?.paramMapping && urlParams.get(q.paramMapping)) {
          firstStep++;
        } else {
          break;
        }
      }
      
      if (firstStep < (survey?.questions.length || 0)) {
        setCurrentStep(firstStep);
      } else {
        // If all questions are prefilled, stay on first/last question and auto-submit
        setCurrentStep(Math.max(0, (survey?.questions.length || 1) - 1));
        await submitSurvey(activeAnswers, activeScores);
      }
      return;
    }
    
    const currentQuestion = survey?.questions[currentStep];
    if (currentQuestion?.type === 'ranked-order' && !activeAnswers[currentQuestion.id]) {
      activeAnswers[currentQuestion.id] = currentQuestion.options || [];
      setAnswers({ ...activeAnswers });
    }
    
    if (currentQuestion?.type === 'this-or-that') {
      const totAns = activeAnswers[currentQuestion.id];
      const allCompleted = Array.isArray(totAns) && totAns.length > 0 && totAns.every((m: any) => m.selected);
      if (currentQuestion?.required && !allCompleted) {
        toast.error('Please complete all "This or That" pairings to continue');
        return;
      }
    }
    
    if (currentQuestion?.required && !activeAnswers[currentQuestion.id]) {
      toast.error('Please answer this question to continue');
      return;
    }

    // Save progress
    await saveResponse(false, activeAnswers, activeScores);

    // Handle Logic
    let nextStep = currentStep + 1;
    const answer = activeAnswers[currentQuestion?.id || ''];
    
    if (currentQuestion?.logic?.[answer]) {
      const targetId = currentQuestion.logic[answer];
      if (targetId === 'end') {
        await submitSurvey(activeAnswers, activeScores);
        return;
      }
      const targetIndex = survey?.questions.findIndex(q => q.id === targetId);
      if (targetIndex !== undefined && targetIndex !== -1) {
        nextStep = targetIndex;
      }
    }

    // Skip questions that are auto-filled via URL params
    const urlParams = new URLSearchParams(window.location.search);
    while (nextStep < (survey?.questions.length || 0)) {
      const q = survey?.questions[nextStep];
      if (q?.paramMapping && urlParams.get(q.paramMapping)) {
        nextStep++;
      } else {
        break;
      }
    }

    if (nextStep < (survey?.questions.length || 0)) {
      setHistory([...history, currentStep]);
      setCurrentStep(nextStep);
    } else {
      // It is the last question! Auto-submit
      await submitSurvey(activeAnswers, activeScores);
    }
  };

  const handleBack = () => {
    if (history.length > 0) {
      const prevStep = history[history.length - 1];
      setHistory(history.slice(0, -1));
      setCurrentStep(prevStep);
    }
  };

  const triggerWebhook = async (url: string, payload: any) => {
    try {
      console.log("[Webhook] Triggering webhook...", url);
      const dataToSend = {
        event: "survey.submitted",
        surveyId: id,
        surveyName: survey.name,
        responseId: responseIdRef.current || responseId,
        answers: payload.answers,
        scores: payload.scores,
        totalScore: payload.totalScore,
        metadata: payload.metadata,
        submittedAt: payload.submittedAt || Date.now()
      };
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend)
      });
      console.log("[Webhook] Success response status:", response.status);
    } catch (err) {
      console.warn("[Webhook] Failed sending response JSON:", err);
    }
  };

  const submitSurvey = async (customAnswers?: Record<string, any>, customScores?: Record<string, any>) => {
    if (!id || !survey) return;
    try {
      setLoading(true);
      const payload = await saveResponse(true, customAnswers, customScores);
      
      // Store flag to prevent multiple responses
      safeSetLocalStorage(`survey_submitted_${id}`, 'true');
      
      // Trigger webhook if configured
      if (survey.settings?.webhookUrl) {
        triggerWebhook(survey.settings.webhookUrl, payload);
      }

      setSubmitted(true);
    } catch (error: any) {
      console.error("Submission failed:", error);
      toast.error("Failed to submit response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!survey) return <div className="flex items-center justify-center min-h-screen">Survey not found</div>;

  const currentQuestion = currentStep >= 0 ? survey.questions[currentStep] : null;

  const getAdaptiveStyle = (opacity: number) => {
    const hex = survey.style.textColor;
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return `${hex}${alpha}`;
  };

  const renderThankYouResults = () => {
    if (!survey?.settings?.thankYouShowResults || !survey?.settings?.thankYouHighlightedQuestionId) {
      return null;
    }

    const qId = survey.settings.thankYouHighlightedQuestionId;
    const question = survey.questions.find(q => q.id === qId);
    if (!question) return null;

    const answer = answers[qId];
    if (!answer) return null;

    let rankedOptions: string[] = [];

    if (question.type === 'ranked-order') {
      rankedOptions = Array.isArray(answer) ? answer : [];
    } else if (question.type === 'this-or-that') {
      const opts = question.options || [];
      const matchHistory = Array.isArray(answer) ? answer : [];

      if (survey.settings?.useRanksmashFormula) {
        // --- RANKSMLASH TRANSITIVE IMPLICATION & V2 TIE BREAKER FORMULA ---
        const directWins = new Map<string, Set<string>>();
        opts.forEach(opt => {
          directWins.set(opt, new Set());
        });

        matchHistory.forEach((m: any) => {
          if (m.selected) {
            const winner = m.selected;
            const loser = m.selected === m.left ? m.right : m.left;
            if (directWins.has(winner)) directWins.get(winner)!.add(loser);
          }
        });

        // Floyd-Warshall reachability map to find any preference path
        const reachable = new Map<string, Set<string>>();
        opts.forEach(opt => {
          reachable.set(opt, new Set(directWins.get(opt)));
        });

        let changed = true;
        while (changed) {
          changed = false;
          for (const u of opts) {
            const uReach = reachable.get(u)!;
            for (const v of Array.from(uReach)) {
              const vReach = reachable.get(v)!;
              for (const w of Array.from(vReach)) {
                if (!uReach.has(w)) {
                  uReach.add(w);
                  changed = true;
                }
              }
            }
          }
        }

        // Strict preference: A beats B transitive and non-cyclic (A reaches B, B does not reach A)
        const strictWins = new Map<string, Set<string>>();
        opts.forEach(opt => {
          strictWins.set(opt, new Set());
        });

        opts.forEach(a => {
          opts.forEach(b => {
            if (a !== b) {
              const aReachesB = reachable.get(a)?.has(b) || false;
              const bReachesA = reachable.get(b)?.has(a) || false;
              if (aReachesB && !bReachesA) {
                strictWins.get(a)!.add(b);
              }
            }
          });
        });

        // Compute strict transitive wins and actual game win percentages
        const totalWinsMap: Record<string, number> = {};
        const winPercentageMap: Record<string, number> = {};
        opts.forEach(opt => {
          const w = strictWins.get(opt)?.size || 0;
          totalWinsMap[opt] = w;

          const played = matchHistory.filter((m: any) => m.selected && (m.left === opt || m.right === opt)).length;
          const wins = matchHistory.filter((m: any) => m.selected === opt).length;
          winPercentageMap[opt] = played > 0 ? wins / played : 0;
        });

        // Group options to apply Tie Breakers for elements with identical win counts
        const optionStats = opts.map(opt => ({
          option: opt,
          totalWins: totalWinsMap[opt],
          winPercentage: winPercentageMap[opt],
          higherWinPercentConstant: 1,
          finalRankValue: 0,
        }));

        const groups: Record<number, typeof optionStats> = {};
        optionStats.forEach(stat => {
          groups[stat.totalWins] = groups[stat.totalWins] || [];
          groups[stat.totalWins].push(stat);
        });

        Object.keys(groups).forEach(winsKey => {
          const group = groups[Number(winsKey)];
          if (group.length > 1) {
            for (let i = 0; i < group.length; i++) {
              for (let j = i + 1; j < group.length; j++) {
                const X = group[i];
                const Y = group[j];
                if (X.winPercentage > Y.winPercentage) {
                  X.higherWinPercentConstant = Math.min(10, X.higherWinPercentConstant * 2);
                } else if (Y.winPercentage > X.winPercentage) {
                  Y.higherWinPercentConstant = Math.min(10, Y.higherWinPercentConstant * 2);
                } else {
                  if (X.option < Y.option) {
                    X.higherWinPercentConstant = Math.min(10, X.higherWinPercentConstant * 2);
                  } else {
                    Y.higherWinPercentConstant = Math.min(10, Y.higherWinPercentConstant * 2);
                  }
                }
              }
            }
          }
        });

        optionStats.forEach(stat => {
          stat.finalRankValue = stat.totalWins + Math.pow(2, stat.higherWinPercentConstant);
        });

        const sortedStats = [...optionStats].sort((a, b) => b.finalRankValue - a.finalRankValue);
        rankedOptions = sortedStats.map(s => s.option);

        (window as any).__ranksmashStats = sortedStats.reduce((acc, s) => {
          acc[s.option] = s;
          return acc;
        }, {} as Record<string, any>);
      } else {
        const counts: Record<string, number> = {};
        opts.forEach(opt => {
          counts[opt] = 0;
        });

        matchHistory.forEach((m: any) => {
          if (m.selected) {
            counts[m.selected] = (counts[m.selected] || 0) + 1;
          }
        });

        rankedOptions = [...opts].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
        (window as any).__ranksmashStats = null;
      }
    } else if (question.type === 'multiple-choice') {
      const selected = String(answer);
      const otherOpts = (question.options || []).filter(o => o !== selected);
      rankedOptions = [selected, ...otherOpts];
    } else {
      rankedOptions = question.options || [];
    }

    const hasAnyLinks = rankedOptions.some(option => {
      const optionKey = `${qId}_${option}`;
      const optionLink = survey.settings?.thankYouOptionLinks?.[optionKey];
      return optionLink && optionLink.url;
    });

    const adaptiveBorder = getAdaptiveStyle(0.12);
    const adaptiveMuted = getAdaptiveStyle(0.60);
    const adaptiveCardBg = getAdaptiveStyle(0.04);

    return (
      <div className="mt-10 sm:mt-12 text-left w-full max-w-xl mx-auto space-y-6">
        <div className="text-center sm:text-left space-y-2 px-1">
          <h2 className="text-lg md:text-xl font-extrabold tracking-tight" style={{ color: survey.style.textColor }}>
            {survey.settings?.thankYouRankingsHeader || 'Your Preference Rankings'}
          </h2>
          {(survey.settings?.thankYouRankingsSubtext !== undefined || hasAnyLinks) && (
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: adaptiveMuted }}>
              {survey.settings?.thankYouRankingsSubtext ?? '💡 We found custom resources for your top choices. Tap or click any item with a link icon ↗ below to access yours!'}
            </p>
          )}
        </div>

        <div className="space-y-3.5">
          {rankedOptions.map((option, idx) => {
            const optionKey = `${qId}_${option}`;
            const optionLink = survey.settings?.thankYouOptionLinks?.[optionKey];
            const hasLink = optionLink && optionLink.url;

            let badgeText = '';
            if (question.type === 'ranked-order') {
              badgeText = `#${idx + 1}`;
            } else if (question.type === 'this-or-that') {
              if (survey.settings?.useRanksmashFormula) {
                const cachedStats = (window as any).__ranksmashStats?.[option];
                if (cachedStats) {
                  const ratePercent = Math.round(cachedStats.winPercentage * 100);
                  badgeText = `#${idx + 1} (${ratePercent}% Win)`;
                } else {
                  badgeText = `#${idx + 1}`;
                }
              } else {
                const matches = Array.isArray(answer) ? answer.filter((m: any) => m.selected === option).length : 0;
                badgeText = `${matches} win${matches !== 1 ? 's' : ''}`;
              }
            } else if (question.type === 'multiple-choice') {
              badgeText = option === String(answer) ? 'Selected' : '';
            }

            return (
              <div 
                key={option} 
                onClick={hasLink ? () => window.open(optionLink.url, '_blank', 'noopener,noreferrer') : undefined}
                className={`group relative flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-300 gap-4 ${
                  hasLink 
                    ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.995]' 
                    : ''
                }`}
                style={{ 
                  borderColor: hasLink ? getAdaptiveStyle(0.24) : adaptiveBorder,
                  backgroundColor: adaptiveCardBg,
                }}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {badgeText && (
                    <span 
                      className="px-3 py-1 rounded-xl text-[11px] font-black font-mono text-white tracking-wide shrink-0 shadow-sm"
                      style={{ backgroundColor: survey.style.accentColor }}
                    >
                      {badgeText}
                    </span>
                  )}
                  <span className="font-bold text-sm sm:text-base leading-snug truncate" style={{ color: survey.style.textColor }}>
                    {option}
                  </span>
                </div>
                {hasLink && (
                  <div 
                    className="flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-300 group-hover:scale-110 group-hover:bg-white/10 shrink-0"
                    style={{ 
                      borderColor: survey.style.accentColor,
                      color: survey.style.accentColor,
                      backgroundColor: `${survey.style.accentColor}10`
                    }}
                    title={optionLink.label || "Resources link"}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: survey.style.backgroundColor, color: survey.style.textColor, fontFamily: survey.style.fontFamily }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md p-8 rounded-3xl border shadow-xl bg-background/80 backdrop-blur" style={{ borderColor: getAdaptiveStyle(0.12) }}>
          <CheckCircle2 className="w-16 h-16 mx-auto mb-6" style={{ color: survey.style.accentColor }} />
          <h1 className="text-2xl font-black mb-3">Response Already Saved</h1>
          <p className="opacity-80 text-sm mb-6">
            Multiple responses are restricted for this survey. You have already completed this questionnaire.
          </p>
          <div className="text-xs font-mono opacity-50 px-3 py-1.5 bg-black/5 dark:bg-white/5 rounded-md inline-block">
            Device Reference Confirmed
          </div>
        </motion.div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-start py-12 md:py-20 px-4 md:px-6 w-full overflow-y-auto" style={{ backgroundColor: survey.style.backgroundColor, color: survey.style.textColor, fontFamily: survey.style.fontFamily }}>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center max-w-2xl w-full flex flex-col items-center">
          <motion.div 
            initial={{ scale: 0, rotate: -45 }} 
            animate={{ scale: 1, rotate: 0 }} 
            transition={{ type: "spring", stiffness: 100, damping: 10, delay: 0.1 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 relative border-4 shadow-inner"
            style={{ borderColor: survey.style.accentColor, backgroundColor: `${survey.style.accentColor}10` }}
          >
            <CheckCircle2 className="w-10 h-10" style={{ color: survey.style.accentColor }} />
            <motion.div 
              className="absolute inset-0 rounded-full border border-current opacity-30 animate-pulse"
              style={{ color: survey.style.accentColor }}
            />
          </motion.div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">{survey.settings?.thankYouTitle || 'Thank You!'}</h1>
          <p className="text-base md:text-lg opacity-80 mb-8 leading-relaxed max-w-xl mx-auto">{survey.settings?.thankYouMessage || 'Your response has been recorded. We appreciate your feedback.'}</p>
          
          {renderThankYouResults()}

          <div className="mt-12">
            {!survey.settings?.preventMultiple && survey.settings?.thankYouShowSubmitAnother !== false ? (
              <Button 
                onClick={() => window.location.reload()}
                style={{ backgroundColor: survey.style.accentColor, color: '#fff' }}
                className="px-8 py-6 rounded-full font-extrabold hover:scale-105 active:scale-[0.98] transition-all duration-300 shadow-lg cursor-pointer"
              >
                {survey.settings?.thankYouSubmitAnotherButtonText || 'Submit Another Response'}
              </Button>
            ) : (
              survey.settings?.preventMultiple && (
                <p className="text-xs font-mono opacity-40">Your response is safely recorded on the secure ledger.</p>
              )
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-12 md:py-20 px-4 md:px-6 transition-colors duration-500 overflow-y-auto w-full" style={{ backgroundColor: survey.style.backgroundColor, color: survey.style.textColor, fontFamily: survey.style.fontFamily }}>
      {/* 🧪 Test Mode Floating Banner */}
      {isTestParam && (
        <div className="mb-6 w-full max-w-2xl px-5 py-4 bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 rounded-3xl flex flex-col sm:flex-row gap-3 items-center justify-between text-sm backdrop-blur shadow-sm">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <span className="text-xl">🧪</span>
            <div>
              <p className="font-bold">Test Submission Mode</p>
              <p className="text-xs opacity-80">This response will be marked as a test entry so you can easily clear it.</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/40 text-amber-500 hover:bg-amber-500/20 text-xs h-8 px-4 rounded-full font-bold shadow-sm shrink-0"
            onClick={() => {
              const newVal = !isTest;
              setIsTest(newVal);
              toast.info(newVal ? 'Test Mode Enabled' : 'Test Mode Disabled: Saving as real response');
            }}
            style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}
          >
            {isTest ? 'Disable Test Mode' : 'Enable Test Mode'}
          </Button>
        </div>
      )}

      <div className="w-full max-w-2xl relative">
        <AnimatePresence mode="wait">
          {currentStep === -1 ? (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">{survey.name}</h1>
              <p className="text-lg opacity-80 mb-6 leading-relaxed">{survey.description}</p>
              
              {Object.keys(answers).length > 0 && (
                <div className="mb-8 p-4 rounded-xl bg-black/5 dark:bg-white/5 text-left max-w-sm mx-auto">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">Pre-filled Information</p>
                  <div className="space-y-2">
                    {survey.questions.map(q => {
                      if (q.paramMapping && answers[q.id]) {
                        return (
                          <div key={q.id} className="flex justify-between items-center text-sm">
                            <span className="opacity-60">{q.question.substring(0, 30)}...</span>
                            <span className="font-medium">{String(answers[q.id])}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              )}

              <Button 
                size="lg" 
                onClick={handleNext}
                className="px-8 py-6 text-lg rounded-full transition-transform hover:scale-105"
                style={{ backgroundColor: survey.style.accentColor, color: '#fff' }}
              >
                Get Started
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          ) : currentQuestion ? (
            <motion.div 
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full"
            >
              <div className="mb-12">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold tracking-widest uppercase opacity-60">
                    {currentQuestion.category || 'Question'}
                  </span>
                  <span className="text-xs font-medium opacity-60">
                    {currentStep + 1} of {survey.questions.length}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: getAdaptiveStyle(0.1) }}>
                  <motion.div 
                    className="h-full" 
                    style={{ backgroundColor: survey.style.accentColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / survey.questions.length) * 100}%` }}
                  />
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-semibold mb-8 leading-tight">
                {currentQuestion.question}
              </h2>

              <div className="space-y-3 mb-12">
                {currentQuestion.type === 'multiple-choice' && currentQuestion.options?.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      const nextAnswers = { ...answers, [currentQuestion.id]: option };
                      let nextScores = { ...scores };
                      if (currentQuestion.scores?.[option] !== undefined) {
                        nextScores = { ...scores, [currentQuestion.id]: currentQuestion.scores[option] };
                        setScores(nextScores);
                      }
                      setAnswers(nextAnswers);
                      saveResponse(false, nextAnswers, nextScores);
                      
                      setTimeout(() => {
                        if (currentStep === survey.questions.length - 1) {
                          submitSurvey(nextAnswers, nextScores);
                        } else {
                          handleNext(nextAnswers, nextScores);
                        }
                      }, 350);
                    }}
                    className={`w-full p-4 text-left rounded-xl border-2 transition-all duration-200 ${
                      answers[currentQuestion.id] === option 
                        ? 'bg-accent/10' 
                        : 'hover:bg-opacity-20'
                    }`}
                    style={{ 
                      borderColor: answers[currentQuestion.id] === option ? survey.style.accentColor : getAdaptiveStyle(0.1),
                      backgroundColor: answers[currentQuestion.id] === option ? `${survey.style.accentColor}15` : getAdaptiveStyle(0.05)
                    }}
                  >
                    {option}
                  </button>
                ))}

                {currentQuestion.type === 'text' && (
                  <Input 
                    className="h-14 text-lg focus:border-accent"
                    style={{ 
                      borderColor: answers[currentQuestion.id] ? survey.style.accentColor : getAdaptiveStyle(0.1),
                      backgroundColor: getAdaptiveStyle(0.05),
                      color: survey.style.textColor
                    }}
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => {
                      setAnswers({ ...answers, [currentQuestion.id]: e.target.value });
                      // Text input scoring could be added here if needed
                    }}
                    onBlur={() => {
                      saveResponse(false, answers, scores);
                    }}
                    placeholder={currentQuestion.placeholder || "Type your answer here..."}
                  />
                )}

                {currentQuestion.type === 'rating' && (
                  <div className="flex flex-wrap gap-3 justify-start">
                    {Array.from({ length: (currentQuestion.maxRating || 5) - (currentQuestion.minRating || 1) + 1 }).map((_, i) => {
                      const val = (currentQuestion.minRating || 1) + i;
                      return (
                        <button
                          key={val}
                          onClick={() => {
                            const nextAnswers = { ...answers, [currentQuestion.id]: val };
                            const nextScores = { ...scores, [currentQuestion.id]: val };
                            setAnswers(nextAnswers);
                            setScores(nextScores);
                            saveResponse(false, nextAnswers, nextScores);
                            
                            setTimeout(() => {
                              if (currentStep === survey.questions.length - 1) {
                                submitSurvey(nextAnswers, nextScores);
                              } else {
                                handleNext(nextAnswers, nextScores);
                              }
                            }, 350);
                          }}
                          className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg font-bold transition-all ${
                            answers[currentQuestion.id] === val 
                              ? 'bg-accent/10' 
                              : ''
                          }`}
                          style={{ 
                            borderColor: answers[currentQuestion.id] === val ? survey.style.accentColor : getAdaptiveStyle(0.1),
                            backgroundColor: answers[currentQuestion.id] === val ? `${survey.style.accentColor}15` : getAdaptiveStyle(0.05)
                          }}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === 'ranked-order' && (
                  <div className="space-y-4">
                    <p className="text-sm opacity-70 mb-4 font-mono">
                      ✨ Click and drag items into preference order, or use the arrows to arrange them (1st is your top choice).
                    </p>
                    <div className="space-y-2 max-w-xl">
                      {(((answers[currentQuestion.id] as string[]) || currentQuestion.options || [])).map((option, optIdx, arr) => {
                        const isDragging = draggedIndex === optIdx;
                        return (
                          <motion.div
                            key={option}
                            layout
                            transition={{ type: "spring", stiffness: 450, damping: 35 }}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedIndex(optIdx);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              if (draggedIndex !== null && draggedIndex !== optIdx) {
                                const currentRankedOrder = (answers[currentQuestion.id] as string[]) || [...(currentQuestion.options || [])];
                                const newOrder = [...currentRankedOrder];
                                
                                // Perform real-time swap
                                const [movedItem] = newOrder.splice(draggedIndex, 1);
                                newOrder.splice(optIdx, 0, movedItem);
                                
                                const nextAns = { ...answers, [currentQuestion.id]: newOrder };
                                setAnswers(nextAns);
                                saveResponse(false, nextAns, scores);
                                setDraggedIndex(optIdx);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggedIndex(null);
                            }}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                              isDragging ? 'opacity-40 border-dashed scale-95 shadow-inner' : 'shadow-sm hover:shadow-md'
                            }`}
                            style={{
                              borderColor: isDragging ? survey.style.accentColor : getAdaptiveStyle(0.15),
                              backgroundColor: getAdaptiveStyle(0.03),
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-4 h-4 opacity-50" />
                              </span>
                              <span 
                                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                                style={{ backgroundColor: survey.style.accentColor }}
                              >
                                {optIdx + 1}
                              </span>
                              <span className="font-semibold text-base" style={{ color: survey.style.textColor }}>
                                {option}
                              </span>
                            </div>
                            
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg"
                                disabled={optIdx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentRankedOrder = (answers[currentQuestion.id] as string[]) || [...(currentQuestion.options || [])];
                                  const newOrder = [...currentRankedOrder];
                                  const temp = newOrder[optIdx];
                                  newOrder[optIdx] = newOrder[optIdx - 1];
                                  newOrder[optIdx - 1] = temp;
                                  const nextAns = { ...answers, [currentQuestion.id]: newOrder };
                                  setAnswers(nextAns);
                                  saveResponse(false, nextAns, scores);
                                }}
                              >
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg"
                                disabled={optIdx === arr.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentRankedOrder = (answers[currentQuestion.id] as string[]) || [...(currentQuestion.options || [])];
                                  const newOrder = [...currentRankedOrder];
                                  const temp = newOrder[optIdx];
                                  newOrder[optIdx] = newOrder[optIdx + 1];
                                  newOrder[optIdx + 1] = temp;
                                  const nextAns = { ...answers, [currentQuestion.id]: newOrder };
                                  setAnswers(nextAns);
                                  saveResponse(false, nextAns, scores);
                                }}
                              >
                                <ArrowDown className="w-4 h-4" />
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}


                {currentQuestion.type === 'this-or-that' && totMatchups.length > 0 && (() => {
                  const activeMatchup = totMatchups[totIndex];
                  if (!activeMatchup) return null;
                  return (
                    <div className="space-y-6">
                      <p className="text-sm opacity-70 mb-4 text-center font-sans tracking-wide">
                        Choose your preferred choice in each pair matchup. We will compute your ultimate preferences!
                      </p>

                      {/* Matchups dots list progress bar */}
                      <div className="flex items-center gap-1.5 justify-center mb-6 max-w-md mx-auto flex-wrap">
                        {totMatchups.map((match, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setTotIndex(idx)}
                            className={`h-2.5 rounded-full transition-all duration-300 ${
                              idx === totIndex 
                                ? 'w-6 shadow-sm' 
                                : match.selected 
                                  ? (match.inferred ? 'w-2.5 opacity-60' : 'w-2.5 opacity-90') 
                                  : 'w-2.5 opacity-30 bg-muted-foreground'
                            }`}
                            style={{
                              backgroundColor: idx === totIndex 
                                ? survey.style.accentColor 
                                : match.selected 
                                  ? survey.style.accentColor 
                                  : undefined,
                              border: match.selected && match.inferred ? '1px dashed currentColor' : undefined
                            }}
                            title={`Set ${idx + 1}`}
                          />
                        ))}
                      </div>

                      {/* Pair comparison choice cards with overlapping OR badge with 3D Flip revealing mechanics */}
                      <div className="relative flex flex-col md:flex-row items-center justify-center max-w-3xl mx-auto w-full py-4 md:gap-0" style={{ perspective: '1200px' }}>
                        {/* Left Card Option */}
                        <div className="w-full md:flex-grow md:flex-1 relative overflow-visible" style={{ perspective: '1200px' }}>
                          <AnimatePresence mode="wait">
                            <motion.button
                              key={`left_${totIndex}_${activeMatchup.left}`}
                              initial={{ rotateY: 90, opacity: 0 }}
                              animate={{ rotateY: 0, opacity: 1 }}
                              exit={{ rotateY: -90, opacity: 0 }}
                              transition={{ duration: 0.28, ease: "easeInOut" }}
                              type="button"
                              whileHover={{ scale: 1.01, zIndex: 10 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleThisOrThatSelection(activeMatchup.left)}
                              className={`relative flex flex-col items-center justify-center p-4 md:p-8 rounded-2xl border-2 text-center cursor-pointer transition-all min-h-[90px] md:min-h-[160px] shadow-sm hover:shadow-md w-full z-0 ${
                                activeMatchup.selected === activeMatchup.left 
                                  ? 'border-solid' 
                                  : 'border-dashed'
                              }`}
                              style={{
                                borderColor: activeMatchup.selected === activeMatchup.left ? survey.style.accentColor : getAdaptiveStyle(0.12),
                                backgroundColor: activeMatchup.selected === activeMatchup.left ? `${survey.style.accentColor}15` : getAdaptiveStyle(0.02),
                                transformStyle: 'preserve-3d',
                                backfaceVisibility: 'hidden',
                              }}
                            >
                              {activeMatchup.selected === activeMatchup.left && (
                                <span 
                                  className="absolute top-3 right-3 w-5 h-5 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg z-20"
                                  style={{ backgroundColor: survey.style.accentColor }}
                                >
                                  ✓
                                </span>
                              )}
                              <span className="text-base md:text-lg font-bold tracking-tight px-4" style={{ color: survey.style.textColor }}>
                                {activeMatchup.left}
                              </span>
                            </motion.button>
                          </AnimatePresence>
                        </div>

                        {/* OR Divider Badge overlapping both */}
                        <div className="relative -my-5 md:-my-0 md:-mx-5 flex-shrink-0 select-none pointer-events-none" style={{ zIndex: 40 }}>
                          <div 
                            className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-xs md:text-sm shadow-md border-2 relative"
                            style={{
                              borderColor: getAdaptiveStyle(0.15),
                              backgroundColor: survey.style.backgroundColor || (survey.style.theme === 'dark' ? '#0b0f19' : '#ffffff'),
                              color: survey.style.textColor,
                            }}
                          >
                            OR
                          </div>
                        </div>

                        {/* Right Card Option */}
                        <div className="w-full md:flex-grow md:flex-1 relative overflow-visible" style={{ perspective: '1200px' }}>
                          <AnimatePresence mode="wait">
                            <motion.button
                              key={`right_${totIndex}_${activeMatchup.right}`}
                              initial={{ rotateY: 90, opacity: 0 }}
                              animate={{ rotateY: 0, opacity: 1 }}
                              exit={{ rotateY: -90, opacity: 0 }}
                              transition={{ duration: 0.28, ease: "easeInOut" }}
                              type="button"
                              whileHover={{ scale: 1.01, zIndex: 10 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleThisOrThatSelection(activeMatchup.right)}
                              className={`relative flex flex-col items-center justify-center p-4 md:p-8 rounded-2xl border-2 text-center cursor-pointer transition-all min-h-[90px] md:min-h-[160px] shadow-sm hover:shadow-md w-full z-0 ${
                                activeMatchup.selected === activeMatchup.right 
                                  ? 'border-solid' 
                                  : 'border-dashed'
                              }`}
                              style={{
                                borderColor: activeMatchup.selected === activeMatchup.right ? survey.style.accentColor : getAdaptiveStyle(0.12),
                                backgroundColor: activeMatchup.selected === activeMatchup.right ? `${survey.style.accentColor}15` : getAdaptiveStyle(0.02),
                                transformStyle: 'preserve-3d',
                                backfaceVisibility: 'hidden',
                              }}
                            >
                              {activeMatchup.selected === activeMatchup.right && (
                                <span 
                                  className="absolute top-3 right-3 w-5 h-5 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg z-20"
                                  style={{ backgroundColor: survey.style.accentColor }}
                                >
                                  ✓
                                </span>
                              )}
                              <span className="text-base md:text-lg font-bold tracking-tight px-4" style={{ color: survey.style.textColor }}>
                                {activeMatchup.right}
                              </span>
                            </motion.button>
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  );
                })()}


                {currentQuestion.type === 'contact-info' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(currentQuestion.contactFields || ['first_name', 'email']).map(field => (
                      <div key={field} className="space-y-2">
                        <Label className="opacity-60 capitalize">{field.replace('_', ' ')}</Label>
                        <Input 
                          className="border-0 border-b rounded-none px-0 focus-visible:ring-0"
                          style={{ 
                            borderColor: getAdaptiveStyle(0.2),
                            backgroundColor: 'transparent',
                            color: survey.style.textColor
                          }}
                          value={answers[`${currentQuestion.id}_${field}`] || ''}
                          onChange={(e) => setAnswers({ 
                            ...answers, 
                            [`${currentQuestion.id}_${field}`]: e.target.value,
                            [currentQuestion.id]: 'filled' 
                          })}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mt-6">
                {currentQuestion.type !== 'this-or-that' ? (
                  <Button 
                    variant="ghost" 
                    onClick={handleBack}
                    style={{ color: survey.style.textColor }}
                    disabled={loading || history.length === 0}
                  >
                    <ChevronLeft className="mr-2 w-4 h-4" />
                    Back
                  </Button>
                ) : <div />}

                {currentQuestion.type !== 'multiple-choice' && 
                 currentQuestion.type !== 'rating' && 
                 currentQuestion.type !== 'this-or-that' && (
                  <Button 
                    onClick={() => handleNext()}
                    className="px-8 py-6 rounded-xl font-bold flex items-center justify-center transition-all"
                    style={{ backgroundColor: survey.style.accentColor, color: '#fff' }}
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : null}
                    {survey.style.buttonText || 'Next'}
                    {!loading && <ChevronRight className="ml-2 w-4 h-4" />}
                  </Button>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Submit Confirmation Modal */}
      <AnimatePresence>
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with blurring and transition fade */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSubmitModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="relative w-full max-w-md p-8 border-2 border-dashed rounded-3xl shadow-2xl overflow-hidden z-10"
              style={{
                backgroundColor: survey.style.backgroundColor,
                color: survey.style.textColor,
                borderColor: getAdaptiveStyle(0.2)
              }}
            >
              {/* Subtle accent color top overlay light glow */}
              <div 
                className="absolute -top-10 left-12 right-12 h-20 rounded-full blur-2xl opacity-15"
                style={{ backgroundColor: survey.style.accentColor }}
              />

              <div className="text-center space-y-6">
                {/* SVG/Icon badge */}
                <div 
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center shadow-lg border-2 animate-bounce"
                  style={{
                    borderColor: survey.style.accentColor,
                    backgroundColor: `${survey.style.accentColor}15`
                  }}
                >
                  <Send className="w-8 h-8" style={{ color: survey.style.accentColor }} />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black tracking-tight" style={{ color: survey.style.textColor }}>
                    Submit Your Answers?
                  </h3>
                  <p className="text-sm opacity-80 leading-relaxed">
                    You have answered all the questions! Would you like to submit your responses and see the results?
                  </p>
                </div>

                {/* mini summary card inside modal */}
                <div 
                  className="p-4 rounded-2xl border flex items-center justify-between text-left"
                  style={{
                    borderColor: getAdaptiveStyle(0.12),
                    backgroundColor: getAdaptiveStyle(0.04)
                  }}
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">Questions</span>
                    <p className="text-base font-bold mt-0.5">{survey.questions.length} / {survey.questions.length}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 text-right block">State</span>
                    <span className="text-xs font-black uppercase text-emerald-500 tracking-wider flex items-center gap-1 font-sans">
                      Ready ✓
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowSubmitModal(false)}
                    className="flex-1 h-12 rounded-xl border font-bold"
                    style={{ 
                      color: survey.style.textColor,
                      borderColor: getAdaptiveStyle(0.12)
                    }}
                    disabled={loading}
                  >
                    Go Back
                  </Button>
                  <Button
                    type="button"
                    onClick={async () => {
                      await submitSurvey();
                      setShowSubmitModal(false);
                    }}
                    className="flex-1 h-12 rounded-xl font-bold transition-transform active:scale-95"
                    style={{
                      backgroundColor: survey.style.accentColor,
                      color: '#fff'
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Submit Now
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
