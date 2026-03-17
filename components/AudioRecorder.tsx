
import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface AudioRecorderProps {
  onAudioRecorded: (base64: string, mimeType: string, audioUrl: string) => void;
  isProcessing: boolean;
  disabled: boolean;
}

export interface AudioRecorderRef {
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
}

export const AudioRecorder = forwardRef<AudioRecorderRef, AudioRecorderProps>(({ onAudioRecorded, isProcessing, disabled }, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = async () => {
    if (isRecording || disabled || isProcessing) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const duration = Date.now() - startTimeRef.current;
        if (duration < 500) {
            console.warn("Recording too short, ignored.");
            return;
        }

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size < 100) {
            console.warn("Recording empty, ignored.");
            return;
        }

        const audioUrl = URL.createObjectURL(blob);
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          onAudioRecorded(base64String, mediaRecorder.mimeType, audioUrl);
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Precisamos de acesso ao microfone para praticar a fala.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
         streamRef.current.getTracks().forEach(track => track.stop());
         streamRef.current = null;
      }
      setIsRecording(false);
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
    isRecording
  }));

  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
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
        <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-opacity duration-300 ${isRecording ? 'text-red-500' : 'text-gray-400'}`}>
            {isRecording ? "Gravando..." : isProcessing ? "Processando..." : ""}
        </p>
      </div>
    </div>
  );
});

AudioRecorder.displayName = 'AudioRecorder';
