import { createWriteStream, readFileSync } from "node:fs";
import { parse } from "fast-csv";
import { createGunzip } from "node:zlib";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { PassThrough, Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { stringify } from "yaml";
import { Demultiplexer } from "./demultiplexer";
import * as path from "node:path";
import Client = require("ssh2-sftp-client");

const BUCKET_NAME = "stream-to-s3-and-back";
const sftp = new Client();
const s3Client = new S3Client();

const config = {
  host: "cdk-output.server.transfer.ap-southeast-2.amazonaws.com",
  port: 22,
  username: "testuser",
  privateKey: readFileSync(path.join(__dirname, "../sftp_key")),
};

const yamlTransformStream = new Transform({
  objectMode: true,
  transform(chunk, _encoding, callback) {
    this.push(stringify([chunk]) + "\n");
    callback();
  },
});

async function downloadFromS3() {
  try {
    await sftp.connect(config);
    console.log("SFTP connected successfully");

    const { Body: s3UploadBody } = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: "output.csv.gz",
      })
    );

    if (s3UploadBody instanceof Readable === false) {
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

    // Create a write stream for the SFTP CSV output
    const sftpCsvOutput = createWriteStream("downloaded_sftp_output.csv");
    const sftpReadableStream = sftp.createReadStream("output.csv.gz");

    // Buffer everything into the demux stream
    await Promise.all([
      // S3 download streams
      pipeline(s3UploadBody, createGunzip(), demux),
      pipeline(csvStreamPassThrough, csvOutput),
      pipeline(
        yamlStreamPassThrough,
        parse({ headers: true, objectMode: true }),
        yamlTransformStream,
        yamlOutput
      ),
      // SFTP download stream
      pipeline(sftpReadableStream, createGunzip(), sftpCsvOutput),
    ]);

    await sftp.end();

    console.log("File downloaded, decompressed, and processed successfully");
  } catch (error) {
    console.error("Error:", error);
  }
}

async function main() {
  await downloadFromS3();
}

main();
