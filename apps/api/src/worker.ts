import type { Job, JobKind } from '@muse-pen/shared';
import type { Repository } from './repository';

export type JobHandler = (job: Job) => Promise<unknown>;

// api 프로세스 안에서 작업 테이블의 대기 작업을 하나씩 처리한다(Redis 큐 없음).
// 시작할 때 실행중으로 남은 작업(프로세스가 죽은 흔적)을 대기로 되돌린다.
export class JobWorker {
  private chain: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private readonly repo: Repository,
    private readonly handlers: Record<JobKind, JobHandler>,
  ) {}

  start(): void {
    this.repo.requeueRunningJobs();
    this.kick();
  }

  // 새 작업이 등록되거나 재요청되면 호출한다.
  kick(): void {
    if (this.stopped) return;
    this.chain = this.chain.then(() => this.drain());
  }

  // 지금까지 등록된 작업이 모두 끝날 때까지 기다린다(테스트·종료용).
  idle(): Promise<void> {
    return this.chain;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.chain;
  }

  private async drain(): Promise<void> {
    for (;;) {
      const job = this.repo.claimNextJob();
      if (!job) return;
      try {
        const result = await this.handlers[job.kind](job);
        this.repo.finishJob(job.id, { result });
      } catch (error) {
        this.repo.finishJob(job.id, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
}
