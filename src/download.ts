import { createWriteStream } from "node:fs";
import { parse } from "fast-csv";
import { createGunzip } from "node:zlib";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Duplex, PassThrough, Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { stringify } from "yaml";

const s3Client = new S3Client();

/**
 * We create a demultiplexer to write out to two different
 * streams.
 *
 * 1. To handle writing the CSV file.
 * 2. To handle writing the JSON file.
 *
 * Reading is handled by the pipeline implementation.
 */
class Demultiplexer extends Duplex {
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

const yamlTransformStream = new Transform({
  objectMode: true,
  transform(chunk, _encoding, callback) {
    this.push(stringify([chunk]) + "\n");
    callback();
  },
});

async function downloadFromS3() {
  try {
    const { Body } = await s3Client.send(
      new GetObjectCommand({
        Bucket: "stream-to-s3-and-back",
        Key: "output.csv.gz",
      })
    );

    if (Body instanceof Readable === false) {
      throw new Error("S3 object body is not a readable stream");
    }

    const csvStreamPassThrough = new PassThrough({
      objectMode: true,
    });
    const csvOutput = createWriteStream("downloaded_output.csv");

    const yamlStreamPassThrough = new PassThrough({
      objectMode: true,
    });
    const yamlOutput = createWriteStream("downloaded_output.yaml");

    const demux = new Demultiplexer([
      csvStreamPassThrough,
      yamlStreamPassThrough,
    ]);

    // Buffer everything into the demux stream
    await Promise.all([
      pipeline(Body, createGunzip(), demux),
      pipeline(csvStreamPassThrough, csvOutput),
      pipeline(
        yamlStreamPassThrough,
        parse({ headers: true, objectMode: true }),
        yamlTransformStream,
        yamlOutput
      ),
    ]);

    console.log("File downloaded, decompressed, and processed successfully");
  } catch (error) {
    console.error("Error:", error);
  }
}

async function main() {
  await downloadFromS3();
}

main();
