import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';

interface AudioRecorderProps {
  onAudioRecorded: (base64: string, mimeType: string, audioUrl: string, transcription?: string) => void;
  isProcessing: boolean;
  disabled: boolean;
  density?: 'normal' | 'compact' | 'ultra-compact';
  onRecordingStateChange?: (recording: boolean) => void;
  onRecorderLog?: (line: string) => void;
}

export interface AudioRecorderRef {
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
}

const MIN_DURATION_MS = 500;
const MIN_BLOB_SIZE_BYTES = 100;

const pickSupportedMimeType = (): string => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  for (const candidate of candidates) {
    try {
      if ((window as any).MediaRecorder?.isTypeSupported?.(candidate)) return candidate;
    } catch {
      // noop
    }
  }
  return '';
};

const getSpeechRecognitionCtor = () =>
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const makeRunId = () => `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const AudioRecorder = forwardRef<AudioRecorderRef, AudioRecorderProps>(
  ({ onAudioRecorded, isProcessing, disabled, density = 'normal', onRecordingStateChange, onRecorderLog }, ref) => {
    const [isRecording, setIsRecording] = useState(false);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<any>(null);

    const chunksRef = useRef<Blob[]>([]);
    const interimTranscriptRef = useRef('');
    const finalTranscriptRef = useRef('');
    const startedAtRef = useRef(0);
    const stoppingRef = useRef(false);
    const runIdRef = useRef('');

    const emitLog = (stage: string, extra?: Record<string, unknown>) => {
      const runId = runIdRef.current || 'no-run';
      const line = `[Recorder ${runId}] ${stage}`;
      onRecorderLog?.(line);
      if (extra) console.info(line, extra);
      else console.info(line);
    };

    const notifyRecordingState = (recording: boolean) => {
      setIsRecording(recording);
      onRecordingStateChange?.(recording);
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

    const stopStream = () => {
      if (!streamRef.current) return;
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };

    const resetState = () => {
      recorderRef.current = null;
      chunksRef.current = [];
      interimTranscriptRef.current = '';
      finalTranscriptRef.current = '';
      startedAtRef.current = 0;
      stoppingRef.current = false;
      notifyRecordingState(false);
    };

    const startSpeechRecognition = () => {
      const SpeechRecognitionCtor = getSpeechRecognitionCtor();
      if (!SpeechRecognitionCtor) {
        emitLog('SpeechRecognition unavailable on this browser');
        return;
      }

      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let finalTranscript = finalTranscriptRef.current;
          let interimTranscript = '';

          for (let i = event.resultIndex || 0; i < (event.results?.length || 0); i += 1) {
            const result = event.results[i];
            const text = result?.[0]?.transcript?.trim();
            if (!text) continue;

            if (result.isFinal) finalTranscript = `${finalTranscript} ${text}`.trim();
            else interimTranscript = `${interimTranscript} ${text}`.trim();
          }

          finalTranscriptRef.current = finalTranscript;
          interimTranscriptRef.current = interimTranscript;
        };

        recognition.onerror = (event: any) => {
          emitLog('SpeechRecognition error', { error: event?.error || 'unknown' });
        };

        recognition.onend = () => {
          recognitionRef.current = null;
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (error) {
        emitLog('SpeechRecognition start failed', { error: String(error) });
      }
    };

    const startRecording = async () => {
      if (isRecording || disabled || isProcessing) return;

      runIdRef.current = makeRunId();

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('getUserMedia unsupported');
        }
        if (!(window as any).MediaRecorder) {
          throw new Error('MediaRecorder unsupported');
        }

        emitLog('Requesting microphone permission');

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        streamRef.current = stream;
        chunksRef.current = [];
        interimTranscriptRef.current = '';
        finalTranscriptRef.current = '';
        startedAtRef.current = Date.now();
        stoppingRef.current = false;

        const mimeType = pickSupportedMimeType();
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        recorderRef.current = recorder;

        recorder.ondataavailable = event => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onerror = (event: any) => {
          emitLog('MediaRecorder error', { error: event?.error?.name || 'unknown' });
        };

        recorder.onstop = () => {
          stopRecognition();

          const transcript = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
          const durationMs = Date.now() - startedAtRef.current;
          const resolvedMimeType = recorder.mimeType || mimeType || 'audio/webm';

          emitLog('Recorder stopped', {
            durationMs,
            chunkCount: chunksRef.current.length,
            transcriptLength: transcript.length,
            mimeType: resolvedMimeType,
          });

          try {
            if (durationMs < MIN_DURATION_MS && !transcript) {
              emitLog('Ignored short recording with empty transcript');
              return;
            }

            const blob = new Blob(chunksRef.current, { type: resolvedMimeType });
            if (blob.size < MIN_BLOB_SIZE_BYTES) {
              if (transcript) {
                emitLog('Blob too small, falling back to transcript');
                onAudioRecorded('', '', '', transcript);
                return;
              }
              emitLog('Ignored empty recording');
              return;
            }

            const audioUrl = URL.createObjectURL(blob);
            const reader = new FileReader();

            reader.onloadend = () => {
              const encoded = typeof reader.result === 'string' ? reader.result : '';
              const base64 = encoded.split(',')[1] || '';
              emitLog('Audio ready for upload', { bytes: blob.size });
              onAudioRecorded(base64, resolvedMimeType, audioUrl, transcript || undefined);
            };

            reader.onerror = () => {
              emitLog('FileReader failed');
              if (transcript) onAudioRecorded('', '', '', transcript);
            };

            reader.readAsDataURL(blob);
          } finally {
            stopStream();
            resetState();
          }
        };

        startSpeechRecognition();
        recorder.start(250);
        notifyRecordingState(true);
        emitLog('Recording started', { mimeType: recorder.mimeType || mimeType || 'audio/webm' });
      } catch (error) {
        emitLog('Failed to start recording', { error: String(error) });
        alert('Precisamos de acesso ao microfone para praticar a fala.');
        stopRecognition();
        stopStream();
        resetState();
      }
    };

    const stopRecording = () => {
      const recorder = recorderRef.current;
      if (!recorder || !isRecording || stoppingRef.current) return;

      stoppingRef.current = true;
      emitLog('Stopping recording');

      try {
        if (recorder.state === 'recording') {
          recorder.requestData();
        }
        if (recorder.state !== 'inactive') {
          recorder.stop();
          return;
        }
      } catch (error) {
        emitLog('Failed to stop recording cleanly', { error: String(error) });
      }

      stopRecognition();
      stopStream();
      resetState();
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
        stopStream();
      };
    }, []);

    const isUltraCompact = density === 'ultra-compact';
    const isCompact = density === 'compact';
    const wrapperClass = isUltraCompact ? 'py-1 gap-1' : isCompact ? 'py-1.5 gap-2' : 'py-2 sm:py-4 gap-2 sm:gap-3';
    const buttonSizeClass = isUltraCompact ? 'w-12 h-12' : isCompact ? 'w-14 h-14' : 'w-16 h-16 sm:w-20 sm:h-20';
    const loaderIconClass = isUltraCompact ? 'w-5 h-5' : 'w-7 h-7 sm:w-8 sm:h-8';
    const squareIconClass = isUltraCompact ? 'w-4 h-4' : 'w-6 h-6 sm:w-8 sm:h-8';
    const micIconClass = isUltraCompact ? 'w-5 h-5' : 'w-7 h-7 sm:w-9 sm:h-9';

    return (
      <div className={`flex flex-col items-center justify-center ${wrapperClass}`}>
        <button
          onClick={toggleRecording}
          disabled={disabled || isProcessing}
          className={`
            relative ${buttonSizeClass} rounded-full flex items-center justify-center shadow-xl transition-all duration-300 select-none
            ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-300 shadow-none ring-0' : ''}
            ${!disabled && !isRecording && !isProcessing ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 hover:shadow-indigo-300/40 shadow-indigo-200 ring-4 ring-indigo-50' : ''}
            ${isRecording ? 'bg-red-500 text-white ring-4 ring-red-100 scale-110 shadow-red-200 animate-pulse' : ''}
            ${isProcessing ? 'bg-white border-2 border-indigo-100 text-indigo-500 cursor-wait' : ''}
          `}
        >
          {isProcessing ? (
            <Loader2 className={`${loaderIconClass} animate-spin`} />
          ) : isRecording ? (
            <Square className={`${squareIconClass} fill-current rounded-sm`} />
          ) : (
            <Mic className={micIconClass} />
          )}
        </button>

        <div className={`${isUltraCompact ? 'h-0' : 'h-4'} flex items-center justify-center`}>
          <p
            className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-opacity duration-300 ${
              isRecording ? 'text-red-500' : 'text-gray-400'
            }`}
          >
            {isUltraCompact ? '' : isRecording ? 'Gravando...' : isProcessing ? 'Processando...' : ''}
          </p>
        </div>
      </div>
    );
  }
);

AudioRecorder.displayName = 'AudioRecorder';
