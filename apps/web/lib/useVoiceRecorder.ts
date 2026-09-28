'use client';

import { MAX_VOICE_SECONDS, VOICE_MIME_TYPES } from '@repo/convex/chat/attachments';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Recording a voice message.
 *
 * Wraps MediaRecorder, which is awkward in three ways this hook exists to
 * absorb. It produces a different container per browser — WebM/Opus in Chrome
 * and Firefox, MP4/AAC in Safari — so the format is negotiated rather than
 * assumed. It hands back data through an event rather than a promise, so
 * stopping is inherently asynchronous. And it holds the microphone open until
 * every track is stopped explicitly, which means a component that unmounts
 * mid-recording leaves the browser's recording indicator lit.
 */

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'error';

export interface Recording {
  blob: Blob;
  mimeType: string;
  durationSec: number;
}

/** The first container this browser will actually record in. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return VOICE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);

  /** Releases the microphone. Safe to call when nothing is recording. */
  const releaseMicrophone = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    for (const track of recorderRef.current?.stream.getTracks() ?? []) track.stop();
  }, []);

  // The browser keeps the microphone open — and the recording indicator lit —
  // until the tracks are stopped, so closing the chat panel has to do it.
  useEffect(() => releaseMicrophone, [releaseMicrophone]);

  const start = useCallback(async () => {
    setError(null);

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError('This browser cannot record audio.');
      return;
    }

    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setSeconds(0);
      setState('recording');

      tickRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        setSeconds(elapsed);
        // Stopped at the limit rather than refused afterwards, so a long
        // recording is kept up to the cap instead of being thrown away.
        if (elapsed >= MAX_VOICE_SECONDS) recorderRef.current?.stop();
      }, 200);
    } catch (cause) {
      setState('error');
      setError(
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'Microphone access was denied.'
          : 'The microphone could not be started.'
      );
    }
  }, []);

  /** Stops and resolves with the clip, or null if nothing was captured. */
  const stop = useCallback(async (): Promise<Recording | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      releaseMicrophone();
      setState('idle');
      return null;
    }

    const durationSec = (Date.now() - startedAtRef.current) / 1000;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType })),
        { once: true }
      );
      recorder.stop();
    });

    releaseMicrophone();
    recorderRef.current = null;
    setState('idle');
    setSeconds(0);

    if (blob.size === 0) return null;
    return { blob, mimeType: recorder.mimeType, durationSec };
  }, [releaseMicrophone]);

  /** Abandons the recording without producing a clip. */
  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    releaseMicrophone();
    recorderRef.current = null;
    chunksRef.current = [];
    setState('idle');
    setSeconds(0);
  }, [releaseMicrophone]);

  return { state, seconds, error, start, stop, cancel };
}
