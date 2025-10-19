import { useEffect, useRef, useState } from 'react';

// Minimal, güvenli tipler (tarayıcı desteklemiyorsa derleme hatasını önlemek için)
type AnySpeechRecognition = any;
type AnySpeechRecognitionEvent = any;

declare global {
  // Window alanına erişimde SSR hatasını önlemek için opsiyonel tanım
  interface Window {
    webkitSpeechRecognition?: AnySpeechRecognition;
    SpeechRecognition?: AnySpeechRecognition;
  }
}

export const useSpeechRecognition = () => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<AnySpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const manuallyStoppedRef = useRef<boolean>(false);

  const hasRecognitionSupport = typeof window !== 'undefined' && (
    !!window.SpeechRecognition || !!window.webkitSpeechRecognition
  );

  useEffect(() => {
    if (!hasRecognitionSupport) return;

    const SR: AnySpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition: AnySpeechRecognition = new SR();

    // Sürekli dinleme ve anlık sonuçlar
    recognition.continuous = true;
    recognition.interimResults = true;
    // Türkçe (TR), istenirse 'en-US' gibi dile çevrilebilir
    recognition.lang = 'tr-TR';

    recognition.onresult = (event: AnySpeechRecognitionEvent) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setText(finalTranscriptRef.current + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      // Ağ veya izin hatalarında yeniden denemeyi kesebiliriz
      console.error('Konuşma tanıma hatası:', event?.error || event);
      if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        manuallyStoppedRef.current = true;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Kullanıcı manuel durdurmadıysa (sessizlik vb. ile bitti), otomatik yeniden başlat
      if (!manuallyStoppedRef.current) {
        try {
          recognition.start();
          setIsListening(true);
        } catch (_) {
          // start sırasında InvalidStateError atabilir, kısa gecikme ile tekrar denenebilir
          setTimeout(() => {
            try { recognition.start(); setIsListening(true); } catch { /* no-op */ }
          }, 250);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        manuallyStoppedRef.current = true;
        recognition.stop();
      } catch (_) {
        // no-op
      }
    };
  }, [hasRecognitionSupport]);

  const startListening = () => {
    if (!recognitionRef.current || isListening) return;
    // Yeni oturum: önceki final metni temizle, state'i sıfırla
    finalTranscriptRef.current = '';
    setText('');
    try {
      manuallyStoppedRef.current = false;
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.error('Dinleme başlatılamadı:', e);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current || !isListening) return;
    try {
      manuallyStoppedRef.current = true;
      recognitionRef.current.stop();
    } finally {
      setIsListening(false);
    }
  };

  return {
    text,
    setText,
    isListening,
    startListening,
    stopListening,
    hasRecognitionSupport,
  } as const;
};
