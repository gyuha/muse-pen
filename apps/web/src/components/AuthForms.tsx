import { useState } from 'react';
import { useSubmit } from './useSubmit';

export interface LoginValues {
  email: string;
  password: string;
}
export interface SignupValues extends LoginValues {
  name: string;
  inviteCode: string;
}

const MIN_PASSWORD = 8;

function requireFilled(values: Record<string, string>, labels: Record<string, string>) {
  for (const [key, label] of Object.entries(labels)) {
    if (!(values[key] ?? '').trim()) throw new Error(`${label}을(를) 입력해 주세요.`);
  }
}

export function LoginForm({ onSubmit }: { onSubmit(values: LoginValues): Promise<void> | void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const form = useSubmit(async () => {
    requireFilled({ email, password }, { email: '이메일', password: '비밀번호' });
    await onSubmit({ email: email.trim(), password });
  });
  return (
    <form onSubmit={form.onSubmit} aria-label="로그인">
      <label>
        이메일
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        비밀번호
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {form.error && <p role="alert" className="error">{form.error}</p>}
      <button type="submit" disabled={form.pending}>로그인</button>
    </form>
  );
}

export function SignupForm({ onSubmit }: { onSubmit(values: SignupValues): Promise<void> | void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const form = useSubmit(async () => {
    requireFilled({ inviteCode, name, email, password }, { inviteCode: '초대 코드', name: '이름', email: '이메일', password: '비밀번호' });
    if (password.length < MIN_PASSWORD) throw new Error(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`);
    await onSubmit({ name: name.trim(), email: email.trim(), password, inviteCode: inviteCode.trim() });
  });
  return (
    <form onSubmit={form.onSubmit} aria-label="가입">
      <label>
        초대 코드
        <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
      </label>
      <label>
        이름
        <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        이메일
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        비밀번호
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {form.error && <p role="alert" className="error">{form.error}</p>}
      <button type="submit" disabled={form.pending}>가입</button>
    </form>
  );
}
