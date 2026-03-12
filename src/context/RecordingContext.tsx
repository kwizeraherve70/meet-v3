import React, { createContext, useState, useCallback, useRef } from 'react';
import { recordingService } from '@/services/recordingService';

interface RecordingContextType {
  isRecording: boolean;
  recordingDuration: number;
  startRecording: (streams: MediaStream[]) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  uploadRecording: (blob: Blob, filename: string) => Promise<string>;
  downloadRecording: (blob: Blob, filename: string) => void;
  error: string | null;
  clearError: () => void;
}

export const RecordingContext = createContext<RecordingContextType | undefined>(
  undefined
);

interface RecordingProviderProps {
  children: React.ReactNode;
  roomId?: string;
  username?: string;
}

export const RecordingProvider: React.FC<RecordingProviderProps> = ({
  children,
  roomId = 'unknown',
  username = 'User',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize recording service on mount
  React.useEffect(() => {
    recordingService.init({ roomId, username });

    // Subscribe to duration updates
    recordingService.onDurationUpdate((duration) => {
      setRecordingDuration(duration);
    });

    return () => {
      recordingService.cleanup();
    };
  }, [roomId, username]);

  const startRecording = useCallback(async (streams: MediaStream[]) => {
    try {
      setError(null);
      if (streams.length === 0) {
        setError('No streams available for recording');
        return;
      }

      await recordingService.startRecording(streams);
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      console.error('Start recording error:', err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      setError(null);
      const blob = await recordingService.stopRecording();
      setIsRecording(false);
      return blob;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording';
      setError(errorMessage);
      console.error('Stop recording error:', err);
      return null;
    }
  }, []);

  const uploadRecording = useCallback(
    async (blob: Blob, filename: string) => {
      try {
        setError(null);
        const url = await recordingService.uploadRecording(blob, filename);
        return url;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upload recording';
        setError(errorMessage);
        console.error('Upload recording error:', err);
        throw err;
      }
    },
    []
  );

  const downloadRecording = useCallback((blob: Blob, filename: string) => {
    try {
      recordingService.downloadRecording(blob, filename);
    } catch (err) {
      console.error('Download recording error:', err);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: RecordingContextType = {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    uploadRecording,
    downloadRecording,
    error,
    clearError,
  };

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
};

export const useRecording = () => {
  const context = React.useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecording must be used within RecordingProvider');
  }
  return context;
};
