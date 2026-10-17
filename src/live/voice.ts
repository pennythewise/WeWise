import { useEffect, useRef, useState } from 'react';

/** Browser speech is optional. No microphone recording is uploaded by this application. */
export function useVoice(locale: string, onText?: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<any>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const Speech = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  const canSpeak = 'speechSynthesis' in window;
  const stop = () => { recognition.current?.stop(); if (canSpeak) window.speechSynthesis.cancel(); setListening(false); setSpeaking(false); };
  useEffect(() => () => { recognition.current?.abort(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  const listen = () => {
    if (!Speech) { setError('此浏览器不支持语音识别，请使用文字。 / Speech input unavailable; please type.'); return; }
    setError('');
    const r = new Speech(); recognition.current = r;
    r.lang = locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US';
    r.interimResults = false; r.continuous = false;
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onerror = (event: any) => { setListening(false); setError(`语音不可用 (${event.error})，请继续输入文字。 / Please continue with text.`); };
    r.onresult = (event: any) => onTextRef.current?.(event.results[0][0].transcript);
    try { r.start(); } catch { setError('无法启用麦克风，请使用文字。 / Microphone unavailable.'); }
  };
  const speak = (text: string, lang = locale) => {
    if (!canSpeak) { setError('此浏览器不支持朗读。 / Speech output unavailable.'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en-US';
    utterance.rate = .9; utterance.onstart = () => setSpeaking(true); utterance.onend = () => setSpeaking(false); utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };
  return { canListen: !!Speech, canSpeak, listening, speaking, error, listen, speak, stop };
}
