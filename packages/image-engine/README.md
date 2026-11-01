# Image engine

`generateImage(request, { provider: new FakeImageProvider(), storage, onUsage })`
returns `{ record, mode, prompt }`. Import from `@muse-pen/image-engine`.

Backend integration:
- Authorize the author/work/setting before calling. Pass the shared `Setting`, work's `ArtStylePreset`, fresh image ID/storage key and UTC ISO timestamp.
- Resolve approved reference records within the work into `referenceRecords`. The engine selects only `setting.representativeImageId` plus `artStyle.referenceImageIds`; unrelated previous outputs are ignored. Representative records must be marked representative and target this setting. Style records use `targetType: 'art_style'`, `targetId: workId`.
- Inject the shared `ImageStorage` implementation. The engine only reads inputs and saves output through it. Access control and access URL serving remain backend responsibilities. Allocate fresh storage keys (the engine rejects collisions with selected inputs).
- Persist `onUsage` once per successful provider response, adding usage ID, author ID, feature `image_generation` and timestamp. This callback precedes image persistence, so usage is retained if saving the image fails. Callback failure stops output saving; provider failures propagate without a fabricated usage report.
- Persist the returned shared `ImageRecord`. Output is never automatically representative; approval is a separate author action. Reuse the setting's approved representative on subsequent calls. `mode` is `candidate` until that representative exists.
- `quality: 'draft' | 'final'` selects `DRAFT_IMAGE_MODEL_ID` (`nano-banana-2.1`) or `FINAL_IMAGE_MODEL_ID` (`nano-banana-pro`). These are logical identifiers, not claims about live API endpoint names. A future real provider adapter under `src/providers/` must map them to verified API IDs and return the actual model ID, which the engine records.

`buildImagePrompt(fields, style)` is pure. It preserves author-defined keyword array order (character hair/eyes/build/outfit), uses fixed labels and places the style wording first. World settings are rejected before IO. No free-form setting body is read.

Provider contracts (`ImageProvider`, `ImageProviderRequest`, `ImageProviderResult`) and orchestration contracts (`GenerateImageRequest`, `ImageEngineDependencies`, `GeneratedImage`, `ImageUsage`) are package-local; shared entity/storage schemas are reused unchanged. The offline fake creates a valid deterministic 1x1 RGB PNG, reports one image and zero estimated cost. It performs no network or filesystem IO.
