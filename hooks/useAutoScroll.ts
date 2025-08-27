import { useEffect, useRef, useState } from 'react';

// threshold: En alttan bu kadar piksel uzakta isek otomatik kaydır
// dependencies: scroll'u tetiklemek istediğin durumlar (örn. [messages, isLoading])
// isStreaming: true iken "auto" davranış kullanılır; smooth animasyon jitter yaratmasın diye
export const useAutoScroll = (
  dependencies: unknown[],
  threshold = 100,
  options?: { isStreaming?: boolean; throttleMs?: number; smoothOnStreamEnd?: boolean }
) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const lastScrollTop = useRef(0);
  const lastSmoothAtRef = useRef(0);
  const prevStreamingRef = useRef<boolean>(false);

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

  // Mesajlar/streaming değiştiğinde otomatik kaydır (kullanıcı yukarıda değilse)
  useEffect(() => {
    if (isUserScrolling) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const now = Date.now();
    let behavior: ScrollBehavior = 'smooth';

    if (options?.isStreaming) {
      const throttle = options?.throttleMs ?? 150;
      if (now - lastSmoothAtRef.current < throttle) {
        // Çok sık tetikleniyorsa, bu sefer kaydırmayı atla
        return;
      }
      lastSmoothAtRef.current = now;
      behavior = 'smooth';
    } else {
      // Streaming bitti: en sona nazikçe yerleş
      behavior = 'smooth';
    }

    // Layout tamamlandıktan sonra kaydır
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserScrolling, ...(dependencies || [])]);

  // Streaming'den çıkarken son bir smooth kaydırma (isteğe bağlı)
  useEffect(() => {
    const isStreaming = !!options?.isStreaming;
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = isStreaming;

    if (wasStreaming && !isStreaming && options?.smoothOnStreamEnd !== false) {
      const container = scrollContainerRef.current;
      if (!container || isUserScrolling) return;
      requestAnimationFrame(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [options?.isStreaming, isUserScrolling]);

  // Kullanıcı input'a geldiğinde dibe yakınsa dibe çek
  const scrollToBottomIfNear = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollHeight, scrollTop, clientHeight } = container;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceToBottom <= threshold) {
      container.scrollTo({ top: scrollHeight, behavior: 'smooth' });
      setIsUserScrolling(false);
    }
  };

  return { scrollContainerRef, scrollToBottomIfNear } as const;
};
