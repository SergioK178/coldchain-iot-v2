'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type QrPayload = { serial: string; displayName?: string; zone?: string };

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtorLike = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function parseQrText(text: string): QrPayload | null {
  const t = text.trim();
  if (!t) return null;
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    if (typeof j.serial === 'string') {
      return {
        serial: j.serial,
        displayName: typeof j.displayName === 'string' ? j.displayName : undefined,
        zone: typeof j.zone === 'string' ? j.zone : undefined,
      };
    }
  } catch {
    // plain serial
  }
  if (/^[A-Za-z0-9_-]+$/.test(t)) return { serial: t };
  return null;
}

export function QrScanner({
  onScan,
  disabled,
}: {
  onScan: (payload: QrPayload) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const startScan = useCallback(async () => {
    setError(null);
    setOpen(true);
    setScanning(true);
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Видео-элемент недоступен');
      video.srcObject = stream;
      await video.play();

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtorLike }).BarcodeDetector;
      if (!Detector) {
        setError('Сканирование камерой не поддерживается в этом браузере. Введите serial вручную.');
        setScanning(false);
        return;
      }

      const detector = new Detector({ formats: ['qr_code'] });
      timerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes.find((c) => typeof c.rawValue === 'string')?.rawValue;
          if (!raw) return;
          const payload = parseQrText(raw);
          if (!payload) return;
          stop();
          setOpen(false);
          onScan(payload);
        } catch {
          // keep trying; camera feed can be noisy
        }
      }, 350);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Камера недоступна');
      setScanning(false);
    }
  }, [onScan, stop]);

  const close = useCallback(() => {
    stop();
    setOpen(false);
    setError(null);
  }, [stop]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Сканировать QR</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!open && (
          <Button type="button" variant="outline" onClick={startScan} disabled={disabled}>
            Открыть сканер
          </Button>
        )}
        {open && (
          <>
            <video
              ref={videoRef}
              className="min-h-[200px] w-full max-w-sm rounded-md bg-muted object-cover"
              playsInline
              muted
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={close} disabled={!scanning && !error}>
                Закрыть
              </Button>
              {error && (
                <Button type="button" variant="outline" size="sm" onClick={startScan}>
                  Повторить
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
