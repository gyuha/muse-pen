// 회차·설정 본문의 저장 원본은 에디터 블록 JSON이고, 저장 때마다 일반 텍스트와 Markdown을 파생한다.
// 에디터 라이브러리가 정해지기 전이라 파생기는 교체 가능한 인터페이스로 두고, 임시 일반 구현을 쓴다.
export interface DerivedBody {
  text: string;
  markdown: string;
}

export interface BlockDeriver {
  derive(blockJson: unknown): DerivedBody;
}

// 임시 구현: 블록 JSON 안의 문자열 `text` 필드를 문서 순서대로 모아 블록(최상위 배열 원소)마다 한 문단으로 만든다.
// 블록 type이 heading이면 Markdown에서 level만큼 '#'을 붙인다.
function collectText(node: unknown): string {
  if (Array.isArray(node)) return node.map(collectText).join('');
  if (typeof node !== 'object' || node === null) return '';
  const record = node as Record<string, unknown>;
  let out = typeof record.text === 'string' ? record.text : '';
  for (const key of ['content', 'children']) out += collectText(record[key]);
  return out;
}

export const genericBlockDeriver: BlockDeriver = {
  derive(blockJson) {
    const blocks = Array.isArray(blockJson) ? blockJson : blockJson == null ? [] : [blockJson];
    const paragraphs = blocks.map((block) => {
      const text = collectText(block);
      const record = (typeof block === 'object' && block !== null ? block : {}) as Record<string, unknown>;
      const level = record.type === 'heading' ? Math.min(Math.max(Number((record.props as { level?: number } | undefined)?.level ?? record.level ?? 1), 1), 6) : 0;
      return { text, markdown: level ? `${'#'.repeat(level)} ${text}` : text };
    });
    return {
      text: paragraphs.map((p) => p.text).join('\n'),
      markdown: paragraphs.map((p) => p.markdown).join('\n\n'),
    };
  },
};
