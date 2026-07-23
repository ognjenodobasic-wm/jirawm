/** Compress a string using CompressionStream (available in extension service workers). */
export async function compress(input: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(encoder.encode(input));
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) chunks.push(result.value);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

/** Decompress a gzip Uint8Array back to a string. */
export async function decompress(input: Uint8Array): Promise<string> {
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(input.buffer as ArrayBuffer);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) chunks.push(result.value);
  }

  const decoder = new TextDecoder();
  return chunks.map((c) => decoder.decode(c)).join('');
}
