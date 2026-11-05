import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { TextRequest, TextStreamEvent } from '../provider';
import { ClaudeCodeTextProvider, type SpawnClaude } from './claude-code';

const request: TextRequest = {
  task: 'continue',
  feature: 'text_generation',
  model: 'claude-haiku-5-5',
  system: '짧게 답하라',
  prompt: '한 문장만 써라',
};

// 실제 `claude -p --output-format stream-json --include-partial-messages --verbose` 출력에서 필요한 줄만 추린 것(2026-11-05 확인).
const delta = (text: string) => ({
  type: 'stream_event',
  event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
});
const SAMPLE = [
  { type: 'system', subtype: 'init', model: 'claude-haiku-5-5' },
  {
    type: 'stream_event',
    event: {
      type: 'message_start',
      message: {
        model: 'claude-haiku-5-5',
        usage: { input_tokens: 2, cache_creation_input_tokens: 530, cache_read_input_tokens: 876, output_tokens: 1 },
      },
    },
  },
  delta('네'),
  delta(', 알'),
  delta('겠습니다.'),
  { type: 'assistant', message: { content: [{ type: 'text', text: '네, 알겠습니다.' }] } },
  { type: 'stream_event', event: { type: 'message_stop' } },
  {
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: '네, 알겠습니다.',
    usage: { input_tokens: 2, cache_creation_input_tokens: 530, cache_read_input_tokens: 876, output_tokens: 28 },
  },
];

interface Spawned {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
}

// 가짜 프로세스: stdout에 lines를 쓰고 exitCode로 닫는다. exitCode가 undefined면 kill 전까지 닫히지 않는다.
function fakeSpawn(lines: unknown[], exitCode: number | undefined, stderr = '') {
  const spawned: Spawned[] = [];
  const spawnFn: SpawnClaude = (command, args, options) => {
    const child = new EventEmitter() as any;
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.exitCode = null;
    child.killed = false;
    const record: Spawned = { command, args, cwd: options.cwd, stdin: '' };
    spawned.push(record);
    child.stdin.on('data', (chunk: Buffer) => (record.stdin += chunk.toString()));
    const close = (code: number | null) => {
      child.exitCode = code;
      child.stdout.end();
      child.emit('close', code);
    };
    child.kill = () => {
      child.killed = true;
      close(null);
    };
    setImmediate(() => {
      if (stderr) child.stderr.write(stderr);
      for (const line of lines) child.stdout.write(`${JSON.stringify(line)}\n`);
      if (exitCode !== undefined) close(exitCode);
    });
    return child;
  };
  return { spawnFn, spawned };
}

async function collect(stream: AsyncIterable<TextStreamEvent>): Promise<TextStreamEvent[]> {
  const events: TextStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe('claude-code 공급자', () => {
  it('claude-code: stream-json을 token들과 usage 1회로 바꾼다', async () => {
    const { spawnFn } = fakeSpawn(SAMPLE, 0);
    const events = await collect(new ClaudeCodeTextProvider({ spawnFn }).stream(request));
    expect(events).toEqual([
      { type: 'token', text: '네' },
      { type: 'token', text: ', 알' },
      { type: 'token', text: '겠습니다.' },
      { type: 'usage', usage: { modelId: 'claude-haiku-5-5', inputTokens: 1408, outputTokens: 28 } },
    ]);
  });

  it('claude-code: generate는 이어 붙인 text와 usage를 돌려준다', async () => {
    const { spawnFn } = fakeSpawn(SAMPLE, 0);
    const response = await new ClaudeCodeTextProvider({ spawnFn }).generate(request);
    expect(response).toEqual({
      text: '네, 알겠습니다.',
      usage: { modelId: 'claude-haiku-5-5', inputTokens: 1408, outputTokens: 28 },
    });
  });

  it('claude-code: 응답 모델이 없으면 request.model을 modelId로 쓴다', async () => {
    const lines = SAMPLE.filter((line) => line.type !== 'stream_event' || (line as any).event.type !== 'message_start');
    const { spawnFn } = fakeSpawn(lines, 0);
    const response = await new ClaudeCodeTextProvider({ spawnFn }).generate({ ...request, model: 'm-x' });
    expect(response.usage.modelId).toBe('m-x');
  });

  it('claude-code: 0이 아닌 종료 코드는 stderr와 함께 throw한다', async () => {
    const { spawnFn } = fakeSpawn([], 1, 'not logged in');
    await expect(new ClaudeCodeTextProvider({ spawnFn }).generate(request)).rejects.toThrow(/종료 코드 1.*not logged in/);
  });

  it('claude-code: result의 is_error는 throw한다', async () => {
    const lines = [{ type: 'result', subtype: 'error_during_execution', is_error: true, result: 'API Error: 529' }];
    const { spawnFn } = fakeSpawn(lines, 0);
    await expect(new ClaudeCodeTextProvider({ spawnFn }).generate(request)).rejects.toThrow(/API Error: 529/);
  });

  it('claude-code: 시간 초과면 프로세스를 kill하고 throw한다', async () => {
    const { spawnFn, spawned } = fakeSpawn([], undefined);
    const provider = new ClaudeCodeTextProvider({ spawnFn, timeoutMs: 20 });
    await expect(provider.generate(request)).rejects.toThrow(/시간 초과/);
    expect(spawned).toHaveLength(1);
  });

  it('claude-code: 인자에 --setting-sources ""와 --tools ""가 들어가고 셸 없이 인자 배열로 실행한다', async () => {
    const { spawnFn, spawned } = fakeSpawn(SAMPLE, 0);
    await new ClaudeCodeTextProvider({ spawnFn, command: '/bin/claude' }).generate(request);
    const { command, args, cwd } = spawned[0]!;
    expect(command).toBe('/bin/claude');
    expect(args).toEqual([
      '-p', '--tools', '', '--setting-sources', '', '--strict-mcp-config', '--no-session-persistence',
      '--model', 'claude-haiku-5-5', '--system-prompt', '짧게 답하라',
      '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
    ]);
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(cwd).not.toContain('muse-pen');
  });

  it('claude-code: 프롬프트를 stdin으로 전달한다', async () => {
    const { spawnFn, spawned } = fakeSpawn(SAMPLE, 0);
    await new ClaudeCodeTextProvider({ spawnFn }).generate(request);
    expect(spawned[0]!.stdin).toBe('한 문장만 써라');
    expect(spawned[0]!.args).not.toContain('한 문장만 써라');
  });
});
