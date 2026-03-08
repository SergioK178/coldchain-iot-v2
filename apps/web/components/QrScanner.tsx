'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type QrPayload = { serial: string; displayName?: string; zone?: string };

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtorLike = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export function parseQrText(text: string): QrPayload | null {
  const t = text.trim();
  if (!t) return null;

  // 1. URL format: https://host/onboard?serial=SENS-TH-00001&displayName=...
  if (t.startsWith('http://') || t.startsWith('https://')) {
    try {
      const url = new URL(t);
      const serial = url.searchParams.get('serial')?.trim();
      if (serial) {
        return {
          serial,
          displayName: url.searchParams.get('displayName')?.trim() || undefined,
          zone: url.searchParams.get('zone')?.trim() || undefined,
        };
      }
    } catch {
      // invalid URL
    }
    return null;
  }

  // 2. JSON format (full or compact)
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    const serial = (typeof j.serial === 'string' ? j.serial : typeof j.s === 'string' ? j.s : null)?.trim();
    if (serial) {
      return {
        serial,
        displayName: (typeof j.displayName === 'string' ? j.displayName : typeof j.n === 'string' ? j.n : undefined)?.trim() || undefined,
        zone: (typeof j.zone === 'string' ? j.zone : undefined)?.trim() || undefined,
      };
    }
  } catch {
    // not JSON
  }

  // 3. Plain serial: SENS-TH-00001
  if (/^SENS-[A-Z]{1,2}-\d{5}$/.test(t)) return { serial: t };
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
  const [useFallback, setUseFallback] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(async () => {
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
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
      } catch {
        // ignore
      }
      html5QrRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const containerId = useId().replace(/:/g, '-');
  const html5QrRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const startScan = useCallback(async () => {
    setError(null);
    setOpen(true);
    setScanning(true);
    stop();
    try {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtorLike }).BarcodeDetector;
      if (Detector) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error('Видео-элемент недоступен');
        video.srcObject = stream;
        await video.play();

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
            // keep trying
          }
        }, 350);
        return;
      }

      // Fallback: html5-qrcode (Firefox, older Safari)
      setUseFallback(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Камера недоступна');
      setScanning(false);
    }
  }, [onScan, stop]);

  const close = useCallback(() => {
    stop();
    setOpen(false);
    setError(null);
    setUseFallback(false);
  }, [stop]);

  useEffect(() => {
    if (!open || !useFallback || !containerId) return;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const html5Qr = new Html5Qrcode(containerId);
        html5QrRef.current = html5Qr;
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 5, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (cancelled) return;
            const payload = parseQrText(decodedText);
            if (!payload) return;
            html5Qr.stop().then(() => {
              html5QrRef.current = null;
              stop();
              setOpen(false);
              setUseFallback(false);
              onScan(payload);
            });
          },
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Камера недоступна');
          setScanning(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
        html5QrRef.current = null;
      }
    };
  }, [open, useFallback, containerId, onScan, stop]);

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
            <div className="min-h-[200px] w-full max-w-sm rounded-md overflow-hidden bg-muted">
              {!useFallback && (
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
              )}
              {useFallback && <div id={containerId} className="min-h-[200px] w-full" />}
            </div>
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
