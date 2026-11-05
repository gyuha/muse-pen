import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import type {
  TextProvider,
  TextRequest,
  TextResponse,
  TextStreamEvent,
  TokenUsage,
} from '../provider';

// 개발 전용: 구독 로그인된 `claude -p`(Claude Code CLI 헤드리스)를 하위 프로세스로 부른다. 운영에서는 쓰지 않는다.

export type SpawnClaude = (
  command: string,
  args: string[],
  options: { cwd: string },
) => ChildProcessWithoutNullStreams;

export interface ClaudeCodeOptions {
  command?: string;
  spawnFn?: SpawnClaude;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const STDERR_LIMIT = 2000;

interface ResultLine {
  is_error?: boolean;
  result?: string;
  usage?: {
    input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens?: number;
  };
}

// `--setting-sources ""`가 빠지면 사용자 전역 CLAUDE.md가 컨텍스트에 들어가 출력이 오염된다.
// `--bare`는 구독 OAuth를 읽지 않아 쓸 수 없다.
export function claudeCodeArgs(request: TextRequest): string[] {
  return [
    '-p',
    '--tools',
    '',
    '--setting-sources',
    '',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--model',
    request.model,
    '--system-prompt',
    request.system,
    '--output-format',
    'stream-json',
    '--include-partial-messages',
    '--verbose',
  ];
}

export class ClaudeCodeTextProvider implements TextProvider {
  private readonly command: string;
  private readonly spawnFn: SpawnClaude;
  private readonly timeoutMs: number;

  constructor(options: ClaudeCodeOptions = {}) {
    this.command = options.command ?? 'claude';
    this.spawnFn = options.spawnFn ?? ((command, args, opts) => spawn(command, args, opts));
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async generate(request: TextRequest): Promise<TextResponse> {
    let text = '';
    let usage: TokenUsage | undefined;
    for await (const event of this.stream(request)) {
      if (event.type === 'token') text += event.text;
      else usage = event.usage;
    }
    if (!usage) throw new Error('claude-code: usage 이벤트가 없다');
    return { text, usage };
  }

  async *stream(request: TextRequest): AsyncIterable<TextStreamEvent> {
    const child = this.spawnFn(this.command, claudeCodeArgs(request), { cwd: tmpdir() });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer | string) => {
      if (stderr.length < STDERR_LIMIT) stderr += chunk.toString();
    });
    const exit = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    exit.catch(() => undefined);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, this.timeoutMs);

    child.stdin.on('error', () => undefined);
    child.stdin.write(request.prompt);
    child.stdin.end();

    try {
      let model = request.model;
      let result: ResultLine | undefined;
      for await (const line of createInterface({ input: child.stdout })) {
        let message: any;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.type === 'stream_event') {
          const event = message.event;
          if (event?.type === 'message_start' && event.message?.model) model = event.message.model;
          else if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            yield { type: 'token', text: event.delta.text };
          }
        } else if (message.type === 'result') {
          result = message;
        }
      }

      const code = await exit;
      const detail = stderr.trim().slice(0, STDERR_LIMIT);
      if (timedOut) throw new Error(`claude-code: ${this.timeoutMs}ms 시간 초과. ${detail}`);
      if (code !== 0) throw new Error(`claude-code: 종료 코드 ${code}. ${detail}`);
      if (!result) throw new Error(`claude-code: result 이벤트가 없다. ${detail}`);
      if (result.is_error) throw new Error(`claude-code: ${result.result ?? '알 수 없는 오류'}`);

      const u = result.usage ?? {};
      yield {
        type: 'usage',
        usage: {
          modelId: model,
          inputTokens:
            (u.input_tokens ?? 0) +
            (u.cache_creation_input_tokens ?? 0) +
            (u.cache_read_input_tokens ?? 0),
          outputTokens: u.output_tokens ?? 0,
        },
      };
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null && !child.killed) child.kill();
    }
  }
}
