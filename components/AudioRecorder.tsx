import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface AudioRecorderProps {
  onAudioRecorded: (base64: string, mimeType: string, audioUrl: string, transcription?: string) => void;
  isProcessing: boolean;
  disabled: boolean;
}

export interface AudioRecorderRef {
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
}

const pickSupportedMimeType = (): string => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  for (const type of candidates) {
    try {
      if ((window as any).MediaRecorder?.isTypeSupported?.(type)) {
        return type;
      }
    } catch {}
  }

  return '';
};

export const AudioRecorder = forwardRef<AudioRecorderRef, AudioRecorderProps>(
  ({ onAudioRecorded, isProcessing, disabled }, ref) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const startTimeRef = useRef<number>(0);
    const recognitionRef = useRef<any>(null);
    const transcriptRef = useRef('');
    const isStoppingRef = useRef(false);

    const cleanupStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    const cleanupRecorder = () => {
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      isStoppingRef.current = false;
      setIsRecording(false);
    };

    const stopRecognition = () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
    };

    const startRecognition = () => {
      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognitionCtor) return;

      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results || [])
            .map((result: any) => result?.[0]?.transcript || '')
            .join(' ')
            .trim();

          transcriptRef.current = transcript;
        };

        recognition.onerror = () => {};
        recognition.onend = () => {
          recognitionRef.current = null;
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch {}
    };

    const startRecording = async () => {
      if (isRecording || disabled || isProcessing) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        streamRef.current = stream;

        const mimeType = pickSupportedMimeType();
        const mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        transcriptRef.current = '';
        startTimeRef.current = Date.now();
        isStoppingRef.current = false;

        startRecognition();

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onerror = (e) => {
          console.error('MediaRecorder error:', e);
        };

        mediaRecorder.onstop = () => {
          stopRecognition();

          const transcript = transcriptRef.current.trim();
          const duration = Date.now() - startTimeRef.current;
          const finalMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';

          try {
            if (duration < 500 && !transcript) {
              console.warn('Recording too short, ignored.');
              return;
            }

            const blob = new Blob(chunksRef.current, { type: finalMimeType });

            if (blob.size < 100) {
              if (transcript) {
                onAudioRecorded('', '', '', transcript);
                return;
              }

              console.warn('Recording empty, ignored.');
              return;
            }

            const audioUrl = URL.createObjectURL(blob);
            const reader = new FileReader();

            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              const base64String = ((reader.result as string).split(',')[1]) || '';
              onAudioRecorded(
                base64String,
                finalMimeType,
                audioUrl,
                transcript || undefined
              );
            };
          } finally {
            cleanupStream();
            cleanupRecorder();
          }
        };

        mediaRecorder.start(250);
        setIsRecording(true);
      } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Precisamos de acesso ao microfone para praticar a fala.');
        cleanupStream();
        cleanupRecorder();
      }
    };

    const stopRecording = () => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || !isRecording || isStoppingRef.current) return;

      isStoppingRef.current = true;

      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch (err) {
        console.error('Error stopping recorder:', err);
        cleanupStream();
        cleanupRecorder();
      }
    };

    const toggleRecording = () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    };

    useImperativeHandle(ref, () => ({
      startRecording,
      stopRecording,
      isRecording,
    }));

    React.useEffect(() => {
      return () => {
        stopRecognition();
        cleanupStream();
      };
    }, []);

    return (
      <div className="flex flex-col items-center justify-center py-2 sm:py-4 gap-2 sm:gap-3">
        <button
          onClick={toggleRecording}
          disabled={disabled || isProcessing}
          className={`
            relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 select-none
            ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-300 shadow-none ring-0' : ''}
            ${!disabled && !isRecording && !isProcessing ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 hover:shadow-indigo-300/40 shadow-indigo-200 ring-4 ring-indigo-50' : ''}
            ${isRecording ? 'bg-red-500 text-white ring-4 ring-red-100 scale-110 shadow-red-200 animate-pulse' : ''}
            ${isProcessing ? 'bg-white border-2 border-indigo-100 text-indigo-500 cursor-wait' : ''}
          `}
        >
          {isProcessing ? (
            <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin" />
          ) : isRecording ? (
            <Square className="w-6 h-6 sm:w-8 sm:h-8 fill-current rounded-sm" />
          ) : (
            <Mic className="w-7 h-7 sm:w-9 sm:h-9" />
          )}
        </button>

        <div className="h-4 flex items-center justify-center">
          <p
            className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-opacity duration-300 ${
              isRecording ? 'text-red-500' : 'text-gray-400'
            }`}
          >
            {isRecording ? 'Gravando...' : isProcessing ? 'Processando...' : ''}
          </p>
        </div>
      </div>
    );
  }
);

AudioRecorder.displayName = 'AudioRecorder';