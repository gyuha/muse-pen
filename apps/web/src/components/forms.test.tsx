import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginForm, SignupForm } from './AuthForms';
import { SettingForm } from './SettingForm';
import { WorkForm } from './WorkForm';

afterEach(cleanup);

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('LoginForm', () => {
  it('비어 있으면 제출하지 않고 오류를 보여준다', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect((await screen.findByRole('alert')).textContent).toContain('이메일');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('이메일과 비밀번호로 제출한다', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    type('이메일', 'a@example.com');
    type('비밀번호', 'password-1');
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ email: 'a@example.com', password: 'password-1' }));
  });

  it('제출 실패 메시지를 보여준다', async () => {
    render(<LoginForm onSubmit={() => Promise.reject(new Error('이메일 또는 비밀번호가 올바르지 않습니다.'))} />);
    type('이메일', 'a@example.com');
    type('비밀번호', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect((await screen.findByRole('alert')).textContent).toContain('올바르지 않습니다');
  });
});

describe('SignupForm', () => {
  it('초대 코드가 없으면 거절한다', async () => {
    const onSubmit = vi.fn();
    render(<SignupForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '가입' }));
    expect((await screen.findByRole('alert')).textContent).toContain('초대 코드');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('WorkForm', () => {
  it('컨셉 5항목이 비면 제출하지 않는다', async () => {
    const onSubmit = vi.fn();
    render(<WorkForm onSubmit={onSubmit} />);
    type('제목', '새 작품');
    fireEvent.click(screen.getByRole('button', { name: '작품 만들기' }));
    await screen.findByRole('alert');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shared 스키마에 맞는 입력으로 제출한다', async () => {
    const onSubmit = vi.fn();
    render(<WorkForm onSubmit={onSubmit} />);
    type('제목', '달빛 아래');
    type('장르', '판타지');
    type('톤', '서정적');
    type('서술 시점', 'first_person');
    type('타깃 독자', '20대');
    type('화풍 프리셋 문구', '수채화풍');
    fireEvent.click(screen.getByRole('button', { name: '작품 만들기' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: '달빛 아래',
        concept: { genre: '판타지', tone: '서정적', pointOfView: 'first_person', targetReader: '20대', artStylePreset: { prompt: '수채화풍', referenceImageIds: [] } },
      }),
    );
  });
});

describe('SettingForm(캐릭터)', () => {
  it('이름이 없으면 제출하지 않는다', async () => {
    const onSubmit = vi.fn();
    render(<SettingForm kind="character" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '캐릭터 만들기' }));
    await screen.findByRole('alert');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('정형 필드를 고정 스키마대로 만들어 제출한다', async () => {
    const onSubmit = vi.fn();
    render(<SettingForm kind="character" onSubmit={onSubmit} />);
    type('이름', '서하');
    type('별칭(쉼표로 구분)', '하, 서서');
    type('성별', '여');
    type('연령대', '20대');
    type('외형 키워드(쉼표로 구분)', '검은 머리, 큰 눈');
    type('상태', 'missing');
    fireEvent.click(screen.getByRole('button', { name: '캐릭터 만들기' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        kind: 'character',
        name: '서하',
        aliases: ['하', '서서'],
        gender: '여',
        ageGroup: '20대',
        appearanceKeywords: ['검은 머리', '큰 눈'],
        status: 'missing',
        representativeImageId: null,
      }),
    );
  });
});
