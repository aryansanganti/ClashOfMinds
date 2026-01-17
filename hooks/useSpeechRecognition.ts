import { useState, useEffect, useCallback, useRef } from 'react';

// Define the SpeechRecognition interface roughly since it's not standard in all TS lib versions yet
interface CustomSpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: (event: any) => void;
    onerror: (event: any) => void;
    onend: () => void;
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export const useSpeechRecognition = () => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<CustomSpeechRecognition | null>(null);

    // Initialize recognition instance
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false; // We want single answers
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            recognitionRef.current = recognition;
        } else {
            setError("Browser doesn't support speech recognition.");
        }
    }, []);

    const startListening = useCallback(() => {
        if (!recognitionRef.current) return;

        setError(null);
        setTranscript('');
        setIsListening(true);

        try {
            recognitionRef.current.start();
        } catch (e) {
            console.error("Failed to start speech recognition:", e);
        }
    }, []);

    const stopListening = useCallback(() => {
        if (!recognitionRef.current) return;
        recognitionRef.current.stop();
        setIsListening(false);
    }, []);

    useEffect(() => {
        const recognition = recognitionRef.current;
        if (!recognition) return;

        recognition.onresult = (event: any) => {
            let currentTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                currentTranscript += event.results[i][0].transcript;
            }
            setTranscript(currentTranscript);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setError(event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        return () => {
            recognition.onresult = null;
            recognition.onerror = null;
            recognition.onend = null;
        };
    }, []);

    return {
        isListening,
        transcript,
        error,
        startListening,
        stopListening,
        hasSupport: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    };
};
