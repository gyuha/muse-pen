import { Link, Navigate } from 'react-router';
import { useAuth } from '../auth';
import { LoginForm, SignupForm } from '../components/AuthForms';

export function LoginPage() {
  const { me, login } = useAuth();
  if (me) return <Navigate to="/" replace />;
  return (
    <>
      <h1>로그인</h1>
      <LoginForm onSubmit={({ email, password }) => login(email, password)} />
      <p className="muted">초대 코드가 있다면 <Link to="/signup">가입하기</Link></p>
    </>
  );
}

export function SignupPage() {
  const { me, signup } = useAuth();
  if (me) return <Navigate to="/" replace />;
  return (
    <>
      <h1>초대 코드로 가입</h1>
      <SignupForm onSubmit={signup} />
      <p className="muted">이미 계정이 있다면 <Link to="/login">로그인</Link></p>
    </>
  );
}
