import { useEffect, useRef, useState } from 'react';

type Options = {
  threshold?: number;
  streaming?: boolean; // İçerik hızlı büyürken smooth yerine auto kullan
};

// threshold: En alttan bu kadar piksel uzakta isek otomatik kaydır
export const useAutoScroll = <T,>(dependency: T, options: Options = {}) => {
  const { threshold = 100, streaming = false } = options;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const lastScrollTop = useRef(0);
  const rafRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);

  // streaming durumunu ref'te tut, effect'leri tetikleme
  useEffect(() => {
    isStreamingRef.current = streaming;
  }, [streaming]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;

      // Kullanıcı yukarı doğru kaydırıyorsa ve dipten uzaksa
      if (scrollTop < lastScrollTop.current && distanceToBottom > threshold) {
        setIsUserScrolling(true);
      } else if (distanceToBottom < threshold) {
        // Dibe yaklaştıysa otomatik kaydırmayı yeniden etkinleştir
        setIsUserScrolling(false);
      }

      lastScrollTop.current = scrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  // Mesaj sayısı değiştiğinde (dependency) ve streaming değilken dibe çek
  useEffect(() => {
    if (isUserScrolling) return;
    if (isStreamingRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceToBottom > threshold) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dependency, isUserScrolling, threshold]);

  // Streaming sırasında rAF ile akışı takip et (kullanıcı dibe yakınsa)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (!streaming) return;
    if (isUserScrolling) return;

    let stopped = false;
    const follow = () => {
      if (stopped) return;
      if (isStreamingRef.current && !isUserScrolling) {
        container.scrollTop = container.scrollHeight;
        rafRef.current = requestAnimationFrame(follow);
      }
    };
    rafRef.current = requestAnimationFrame(follow);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [streaming, isUserScrolling]);

  // Kullanıcı input'a geldiğinde dibe yakınsa dibe çek
  const scrollToBottomIfNear = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollHeight, scrollTop, clientHeight } = container;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceToBottom <= threshold) {
      container.scrollTo({ top: scrollHeight, behavior: 'auto' });
      setIsUserScrolling(false);
    }
  };

  return { scrollContainerRef, scrollToBottomIfNear } as const;
};
