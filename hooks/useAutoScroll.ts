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

  // Mesajlar değiştiğinde otomatik kaydır (kullanıcı yukarıda değilse)
  useEffect(() => {
    if (isUserScrolling) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    // Zaten dibe yakın değilsek zorla kaydırma (özellikle streaming sırasında zıplamaya yol açar)
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceToBottom > threshold) return;

    // Aynı frame içinde birden fazla kaydırmayı engelle
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'auto',
      });
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dependency, isUserScrolling, streaming]);

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
