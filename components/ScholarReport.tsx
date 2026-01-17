import React, { useState } from 'react';
import { StudyGuide } from '../types';
import { generateStudyGuide } from '../services/geminiService';
import { SparklesIcon, ChevronDownIcon, ChevronUpIcon, BookOpenIcon } from '@heroicons/react/24/solid';

interface ScholarReportProps {
    topicName: string;
    contextSummary?: string;
    missedQuestions: Array<{
        question: string;
        correctAnswer: string;
        playerAnswer: string;
    }>;
    totalQuestions: number;
    correctAnswers: number;
    onClose: () => void;
    soundManager?: any;
}

export const ScholarReport: React.FC<ScholarReportProps> = ({
    topicName,
    contextSummary,
    missedQuestions,
    totalQuestions,
    correctAnswers,
    onClose,
    soundManager
}) => {
    const [studyGuide, setStudyGuide] = useState<StudyGuide | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const guide = await generateStudyGuide({
                topicName,
                contextSummary,
                missedQuestions,
                totalQuestions,
                correctAnswers
            });
            setStudyGuide(guide);
            // Auto-expand first section
            setExpandedSections(new Set([0]));
        } catch (err: any) {
            console.error('Failed to generate study guide:', err);
            setError('Failed to generate study guide. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const toggleSection = (index: number) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedSections(newExpanded);
    };

    // Initial view - before generating
    if (!studyGuide && !loading && !error) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
                    <div className="inline-block p-4 rounded-full bg-purple-100 mb-4">
                        <BookOpenIcon className="w-10 h-10 text-purple-500" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Scholar's Report</h3>
                    <p className="text-slate-500 font-bold mb-6">
                        Get a personalized study guide based on your performance.
                        The AI will analyze your mistakes and recommend what to review.
                    </p>

                    <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
                        <div className="flex justify-between mb-2">
                            <span className="text-slate-600 text-sm font-bold">Questions Missed:</span>
                            <span className="text-red-600 font-black">{missedQuestions.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600 text-sm font-bold">Accuracy:</span>
                            <span className="text-green-600 font-black">
                                {((correctAnswers / totalQuestions) * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => { soundManager?.playButtonClick(); handleGenerate(); }}
                            className="w-full py-4 bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white border-b-4 border-purple-700 rounded-2xl font-black text-lg uppercase tracking-wide shadow-lg transition-all active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2"
                        >
                            <SparklesIcon className="w-6 h-6" />
                            Generate Study Guide
                        </button>
                        <button
                            onClick={() => { soundManager?.playButtonClick(); onClose(); }}
                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 border-b-4 border-slate-300 rounded-2xl font-bold text-sm uppercase tracking-wide transition-all active:border-b-0 active:translate-y-1"
                        >
                            Skip
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
                    <SparklesIcon className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
                    <h3 className="text-xl font-black text-slate-800 mb-2">Analyzing Performance...</h3>
                    <p className="text-slate-500 font-bold">Creating your personalized study guide</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
                    <div className="inline-block p-4 rounded-full bg-red-100 mb-4">
                        <span className="text-4xl">⚠️</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Error</h3>
                    <p className="text-slate-500 font-bold mb-6">{error}</p>
                    <div className="space-y-3">
                        <button
                            onClick={() => { soundManager?.playButtonClick(); handleGenerate(); }}
                            className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white border-b-4 border-purple-700 rounded-2xl font-bold text-sm uppercase tracking-wide transition-all active:border-b-0 active:translate-y-1"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => { soundManager?.playButtonClick(); onClose(); }}
                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 border-b-4 border-slate-300 rounded-2xl font-bold text-sm uppercase tracking-wide transition-all active:border-b-0 active:translate-y-1"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Study Guide Display
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl my-8">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-block p-4 rounded-full bg-purple-100 mb-4">
                        <BookOpenIcon className="w-10 h-10 text-purple-500" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-2">Scholar's Report</h3>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">{topicName}</p>
                </div>

                {/* Overall Performance */}
                <div className="bg-purple-50 rounded-2xl p-5 mb-6">
                    <h4 className="text-sm font-black text-purple-600 uppercase tracking-wide mb-2">Overall Performance</h4>
                    <p className="text-slate-700 font-bold leading-relaxed">{studyGuide?.overallPerformance}</p>
                </div>

                {/* Weak Areas */}
                {studyGuide?.weakAreas && studyGuide.weakAreas.length > 0 && (
                    <div className="bg-amber-50 rounded-2xl p-5 mb-6">
                        <h4 className="text-sm font-black text-amber-600 uppercase tracking-wide mb-3">Areas to Focus On</h4>
                        <div className="flex flex-wrap gap-2">
                            {studyGuide.weakAreas.map((area, idx) => (
                                <span
                                    key={idx}
                                    className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-bold"
                                >
                                    {area}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Study Sections */}
                <div className="space-y-3 mb-6">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-wide mb-3">Study Guide</h4>
                    {studyGuide?.sections?.map((section, idx) => (
                        <div key={idx} className="border-2 border-slate-100 rounded-2xl overflow-hidden">
                            <button
                                onClick={() => { soundManager?.playButtonClick(); toggleSection(idx); }}
                                className="w-full p-4 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between"
                            >
                                <span className="font-black text-slate-800 text-left">{section.subTopic}</span>
                                {expandedSections.has(idx) ? (
                                    <ChevronUpIcon className="w-5 h-5 text-slate-400" />
                                ) : (
                                    <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                                )}
                            </button>
                            {expandedSections.has(idx) && (
                                <div className="p-5 bg-white space-y-4 animate-fadeIn">
                                    <div>
                                        <p className="text-slate-600 font-bold leading-relaxed mb-3">{section.explanation}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-2">Key Points</p>
                                        <ul className="space-y-2">
                                            {section.keyPoints.map((point, pointIdx) => (
                                                <li key={pointIdx} className="flex items-start gap-2">
                                                    <span className="text-purple-500 mt-1">•</span>
                                                    <span className="text-slate-700 font-bold text-sm">{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="bg-blue-50 rounded-xl p-3">
                                        <p className="text-xs font-black text-blue-600 uppercase tracking-wide mb-1">Recommended Focus</p>
                                        <p className="text-blue-700 font-bold text-sm">{section.recommendedFocus}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Motivational Message */}
                {studyGuide?.motivationalMessage && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 mb-6 border-2 border-green-200">
                        <p className="text-green-700 font-bold text-center leading-relaxed italic">
                            "{studyGuide.motivationalMessage}"
                        </p>
                    </div>
                )}

                {/* Close Button */}
                <button
                    onClick={() => { soundManager?.playButtonClick(); onClose(); }}
                    className="w-full py-4 bg-gradient-to-br from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-white border-b-4 border-sky-600 rounded-2xl font-black text-lg uppercase tracking-wide shadow-lg transition-all active:border-b-0 active:translate-y-1"
                >
                    Back to Menu
                </button>
            </div>
        </div>
    );
};
