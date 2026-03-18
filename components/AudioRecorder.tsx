import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';

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

const MIN_RECORDING_DURATION_MS = 500;
const MIN_BLOB_SIZE_BYTES = 100;

const pickSupportedMimeType = (): string => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  for (const type of candidates) {
    try {
      if ((window as any).MediaRecorder?.isTypeSupported?.(type)) return type;
    } catch {
      // noop
    }
  }

  return '';
};

export const AudioRecorder = forwardRef<AudioRecorderRef, AudioRecorderProps>(
  ({ onAudioRecorded, isProcessing, disabled }, ref) => {
    const [isRecording, setIsRecording] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<any>(null);

    const chunksRef = useRef<Blob[]>([]);
    const transcriptRef = useRef('');
    const finalTranscriptRef = useRef('');
    const startTimeRef = useRef(0);
    const isStoppingRef = useRef(false);

    const cleanupStream = () => {
      if (!streamRef.current) return;
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };

    const cleanupRecorder = () => {
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      transcriptRef.current = '';
      finalTranscriptRef.current = '';
      startTimeRef.current = 0;
      isStoppingRef.current = false;
      setIsRecording(false);
    };

    const stopRecognition = () => {
      if (!recognitionRef.current) return;
      try {
        recognitionRef.current.stop();
      } catch {
        // noop
      }
      recognitionRef.current = null;
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
          let finalTranscript = finalTranscriptRef.current;
          let interimTranscript = '';

          for (let i = event.resultIndex || 0; i < (event.results?.length || 0); i += 1) {
            const result = event.results[i];
            const text = result?.[0]?.transcript?.trim();
            if (!text) continue;

            if (result.isFinal) {
              finalTranscript = `${finalTranscript} ${text}`.trim();
            } else {
              interimTranscript = `${interimTranscript} ${text}`.trim();
            }
          }

          finalTranscriptRef.current = finalTranscript;
          transcriptRef.current = `${finalTranscript} ${interimTranscript}`.trim();
        };

        recognition.onerror = () => {};
        recognition.onend = () => {
          recognitionRef.current = null;
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        // noop
      }
    };

    const startRecording = async () => {
      if (isRecording || disabled || isProcessing) return;

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('getUserMedia is not supported in this browser.');
        }

        if (!(window as any).MediaRecorder) {
          throw new Error('MediaRecorder is not supported in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        streamRef.current = stream;
        chunksRef.current = [];
        transcriptRef.current = '';
        finalTranscriptRef.current = '';
        startTimeRef.current = Date.now();
        isStoppingRef.current = false;

        const mimeType = pickSupportedMimeType();
        const mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = event => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onerror = event => {
          console.error('MediaRecorder error:', event);
        };

        mediaRecorder.onstop = () => {
          stopRecognition();

          const transcript = transcriptRef.current.trim() || finalTranscriptRef.current.trim();
          const durationMs = Date.now() - startTimeRef.current;
          const finalMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';

          try {
            if (durationMs < MIN_RECORDING_DURATION_MS && !transcript) {
              console.warn('Recording too short, ignored.');
              return;
            }

            const blob = new Blob(chunksRef.current, { type: finalMimeType });

            if (blob.size < MIN_BLOB_SIZE_BYTES) {
              if (transcript) {
                onAudioRecorded('', '', '', transcript);
                return;
              }

              console.warn('Recording empty, ignored.');
              return;
            }

            const audioUrl = URL.createObjectURL(blob);
            const reader = new FileReader();

            reader.onloadend = () => {
              const result = typeof reader.result === 'string' ? reader.result : '';
              const base64String = result.split(',')[1] || '';
              onAudioRecorded(base64String, finalMimeType, audioUrl, transcript || undefined);
            };

            reader.onerror = () => {
              if (transcript) {
                onAudioRecorded('', '', '', transcript);
              }
            };

            reader.readAsDataURL(blob);
          } finally {
            cleanupStream();
            cleanupRecorder();
          }
        };

        startRecognition();
        mediaRecorder.start(250);
        setIsRecording(true);
      } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Precisamos de acesso ao microfone para praticar a fala.');
        stopRecognition();
        cleanupStream();
        cleanupRecorder();
      }
    };

    const stopRecording = () => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || !isRecording || isStoppingRef.current) return;

      isStoppingRef.current = true;

      try {
        if (recorder.state === 'recording') {
          recorder.requestData();
        }

        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          cleanupStream();
          cleanupRecorder();
        }
      } catch (error) {
        console.error('Error stopping recorder:', error);
        stopRecognition();
        cleanupStream();
        cleanupRecorder();
      }
    };

    const toggleRecording = () => {
      if (isRecording) stopRecording();
      else startRecording();
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
