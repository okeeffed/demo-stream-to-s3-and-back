import { Duplex, PassThrough } from "node:stream";

/**
 * We create a demultiplexer to write out to two different
 * streams.
 *
 * 1. To handle writing the CSV file.
 * 2. To handle writing the JSON file.
 *
 * Reading is handled by the pipeline implementation.
 */
export class Demultiplexer extends Duplex {
  private outputStreams: PassThrough[];

  constructor(outputStreams: PassThrough[]) {
    super({
      objectMode: true,
    });
    this.outputStreams = outputStreams;
  }

  _write(
    chunk: any,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    for (const outputStream of this.outputStreams) {
      outputStream.write(chunk);
    }
    callback();
  }

  _final(callback: (error?: Error | null) => void): void {
    for (const outputStream of this.outputStreams) {
      outputStream.end();
    }
    callback();
  }
}
