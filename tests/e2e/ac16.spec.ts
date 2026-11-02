import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, API_URL } from '../playwright.config';

test('[AC-16] 초대 코드로 가입 → 로그인 → 작품 목록 → 작품 생성 → 캐릭터 설정 생성 → 새로고침 후에도 보인다', async ({ page, playwright }) => {
  const stamp = Date.now();
  const email = `writer-${stamp}@example.com`;
  const password = 'writer-password-1';
  const workTitle = `E2E 작품 ${stamp}`;
  const characterName = `하린-${stamp}`;

  // 준비: 관리자로 로그인해 초대 코드를 발급한다(/api/admin/invites)
  const adminApi = await playwright.request.newContext({ baseURL: API_URL, extraHTTPHeaders: { origin: API_URL } });
  const adminLogin = await adminApi.post('/api/auth/sign-in/email', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  expect(adminLogin.status(), '관리자 로그인').toBe(200);
  const invite = await adminApi.post('/api/admin/invites', { data: {} });
  expect(invite.status(), '초대 코드 발급').toBe(201);
  const { code } = (await invite.json()) as { code: string };
  expect(code).toBeTruthy();
  await adminApi.dispose();

  // 가입(브라우저)
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: '초대 코드로 가입' })).toBeVisible();
  await page.getByLabel('초대 코드').fill(code);
  await page.getByLabel('이름', { exact: true }).fill('E2E 작가');
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호').fill(password);
  await page.getByRole('button', { name: '가입' }).click();
  await expect(page.getByRole('heading', { name: '내 작품' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // 로그아웃 후 로그인 화면에서 다시 로그인
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호').fill(password);
  await page.getByRole('button', { name: '로그인' }).click();

  // 작품 목록(비어 있다) → 작품 생성
  await expect(page.getByRole('heading', { name: '내 작품' })).toBeVisible();
  await expect(page.getByText('아직 작품이 없습니다.')).toBeVisible();
  await page.getByRole('link', { name: '새 작품 만들기' }).click();
  const workForm = page.getByRole('form', { name: '작품 생성' });
  await workForm.getByLabel('제목').fill(workTitle);
  await workForm.getByLabel('장르').fill('무협');
  await workForm.getByLabel('톤').fill('건조하고 냉소적');
  await workForm.getByLabel('서술 시점').selectOption('first_person');
  await workForm.getByLabel('타깃 독자').fill('2030 독자');
  await workForm.getByLabel('화풍 프리셋 문구').fill('수묵화 풍');
  await workForm.getByRole('button', { name: '작품 만들기' }).click();

  // 작품 화면 → 설정(캐릭터) 생성
  await expect(page.getByRole('heading', { name: workTitle })).toBeVisible();
  await expect(page.getByText('무협 · 건조하고 냉소적 · 1인칭 · 2030 독자')).toBeVisible();
  await expect(page.getByRole('tab', { name: '캐릭터' })).toHaveAttribute('aria-selected', 'true');
  const form = page.getByRole('form', { name: '캐릭터 생성' });
  await form.getByLabel('이름', { exact: true }).fill(characterName);
  await form.getByLabel('별칭(쉼표로 구분)').fill('린, 검은 여우');
  await form.getByLabel('성별').fill('여');
  await form.getByLabel('연령대').fill('20대');
  await form.getByLabel('외형 키워드(쉼표로 구분)').fill('흑발, 검은 눈');
  await form.getByLabel('상태').selectOption('alive');
  await form.getByRole('button', { name: '캐릭터 만들기' }).click();
  const characterList = page.getByRole('list', { name: '캐릭터 목록' });
  await expect(characterList.getByText(characterName)).toBeVisible();

  // 새로고침 후에도 로그인·작품·캐릭터가 그대로 보인다
  await page.reload();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole('heading', { name: workTitle })).toBeVisible();
  await expect(page.getByRole('list', { name: '캐릭터 목록' }).getByText(characterName)).toBeVisible();

  // 작품 목록으로 돌아가도 작품이 있고, 목록에서 새로고침해도 유지된다
  await page.getByRole('link', { name: '← 작품 목록' }).click();
  const works = page.getByRole('list', { name: '작품 목록' });
  await expect(works.getByRole('link', { name: workTitle })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('list', { name: '작품 목록' }).getByRole('link', { name: workTitle })).toBeVisible();

  // 저장 결과를 api에서 다시 조회해도 같다(화면만 보고 통과하지 않는다)
  const listed = await page.request.get(`${API_URL}/api/works`);
  expect(listed.status()).toBe(200);
  const rows = (await listed.json()) as { id: string; title: string }[];
  const work = rows.find((w) => w.title === workTitle);
  expect(work).toBeTruthy();
  const settings = await page.request.get(`${API_URL}/api/works/${work!.id}/settings?kind=character`);
  const chars = (await settings.json()) as { name: string; aliases: string[]; status: string }[];
  expect(chars).toHaveLength(1);
  expect(chars[0]).toMatchObject({ name: characterName, aliases: ['린', '검은 여우'], status: 'alive' });
});
