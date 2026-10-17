import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgentStore } from '@/agentStore';
import { useTx } from '@/i18n/useTx';

type SR = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
const ctor = (): (new () => SR) | undefined => {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

/**
 * F5 voice input (frontend mock). Default is a deterministic demo: it "hears" a sample phrase so recordings repeat.
 * `?voice=real` uses the browser's SpeechRecognition when available; any failure falls back to the demo phrase.
 */
export function useVoiceInput() {
  const { lang } = useTx();
  const [listening, setListening] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rec = useRef<SR | null>(null);
  const setDraft = useAgentStore((s) => s.setDraft);
  const real = new URLSearchParams(location.search).get('voice') === 'real' && !!ctor();

  const stop = useCallback(() => {
    timer.current.forEach(clearTimeout); timer.current = [];
    rec.current?.stop(); rec.current = null;
    setListening(false);
  }, []);
  useEffect(() => stop, [stop]);

  const demo = useCallback(() => {
    const phrase = lang === 'zh' ? '登革热住院在保障范围内吗？' : 'Am I covered for dengue hospitalisation?';
    timer.current.push(setTimeout(() => {
      [...phrase].forEach((_, i) => timer.current.push(setTimeout(() => setDraft(phrase.slice(0, i + 1)), i * 45)));
      timer.current.push(setTimeout(() => setListening(false), phrase.length * 45 + 300));
    }, 1600));
  }, [lang, setDraft]);

  const start = useCallback(() => {
    setListening(true);
    if (real) {
      const r = new (ctor()!)();
      r.lang = lang === 'zh' ? 'zh-CN' : 'en-US'; r.interimResults = true;
      r.onresult = (e) => setDraft(Array.from(e.results).map((x) => x[0].transcript).join(''));
      r.onend = () => setListening(false);
      r.onerror = () => { rec.current = null; demo(); };
      rec.current = r;
      try { r.start(); } catch { demo(); }
    } else demo();
  }, [real, lang, setDraft, demo]);

  return { listening, start, stop, real };
}
