import { useState, type FormEvent } from 'react';

// 폼 제출 공통 처리: 검증/요청 오류는 throw한 Error의 메시지를 role="alert"로 보여줄 문자열로 만든다.
export function useSubmit(action: () => Promise<void> | void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setPending(false);
    }
  };
  return { error, pending, onSubmit };
}
