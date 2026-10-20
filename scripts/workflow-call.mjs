// One real SDK-bridge request. Input is base64 JSON to avoid shell quoting loss.
// Output filtering only reduces transcript size; the bridge owns active RAM state.
const input = JSON.parse(Buffer.from(process.argv[2], 'base64').toString());
const response = await fetch(
  'http://127.0.0.1:' + (process.argv[3] ?? process.env.MIMICUS_WORKFLOW_PORT),
  {
    method: 'POST',
    headers: {
      authorization: process.argv[4] ?? process.env.MIMICUS_WORKFLOW_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  },
);
const result = await response.json();
if (input.output === 'images') {
  const { default: sharp } = await import('sharp');
  const { createHash } = await import('node:crypto');
  const originalImages = (result.content?.filter((c) => c.type === 'image') ?? []).slice(0, 8);
  const imageSummaries = originalImages.map((img, imageIndex) => ({
    imageIndex,
    byteLength: Buffer.byteLength(img.data, 'base64'),
    sha256: createHash('sha256').update(Buffer.from(img.data, 'base64')).digest('hex'),
  }));
  const images = await Promise.all(
    originalImages.map(async (img) => ({
      ...img,
      data: (
        await sharp(Buffer.from(img.data, 'base64'))
          .resize({ width: 800, withoutEnlargement: true })
          .jpeg({ quality: 40 })
          .toBuffer()
      ).toString('base64'),
    })),
  );
  console.log(
    JSON.stringify({
      images,
      imageSummaries,
      data: result.structuredContent?.data,
      error: result.isError ? result.content : result.error,
    }),
  );
} else if (input.output === 'image') {
  const images = result.content?.filter((c) => c.type === 'image') ?? [];
  const chosen = images[input.imageIndex ?? 0];
  if (chosen) {
    const { default: sharp } = await import('sharp');
    chosen.data = (
      await sharp(Buffer.from(chosen.data, 'base64'))
        .resize({ width: 1000, withoutEnlargement: true })
        .jpeg({ quality: 45 })
        .toBuffer()
    ).toString('base64');
  }
  console.log(
    JSON.stringify({
      image: chosen,
      data: result.structuredContent?.data,
      error: result.isError ? result.content : result.error,
    }),
  );
} else
  console.log(
    JSON.stringify({
      data: result.structuredContent?.data ?? result,
      error: result.isError ? result.content : undefined,
    }),
  );
