
import { SurveyStyle } from './types';

export const DEFAULT_STYLE: SurveyStyle = {
  backgroundColor: '#000000',
  textColor: '#FFFFFF',
  accentColor: '#F27D26',
  fontFamily: 'Inter',
  buttonText: 'Next →',
};

export const SAMPLE_QUESTIONS = [
  {
    id: 'q1',
    type: 'multiple-choice',
    question: 'How is your team using AI tools today?',
    category: 'AI ADOPTION',
    options: [
      'Not at all — we haven\'t started with AI yet',
      'A few people experimenting on their own (ChatGPT, Copilot, etc.)',
      'Several team members use AI regularly, but everyone\'s doing their own thing',
      'AI tools are part of how we work — with shared practices and clear use cases'
    ],
    required: true,
  },
  {
    id: 'q2',
    type: 'multiple-choice',
    question: 'Do you know where AI would make the biggest difference in your business?',
    category: 'AI ADOPTION',
    options: [
      'No — I know AI matters but I don\'t know where to start',
      'I have some ideas, but nothing concrete or prioritized',
      'I\'ve identified a few areas, but haven\'t gone deep on any of them',
      'Yes — I have a clear picture of where AI creates leverage in my operation'
    ],
    required: true,
  }
];
