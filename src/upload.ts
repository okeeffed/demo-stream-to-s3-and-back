import { readFileSync } from "fs";
import { pipeline } from "node:stream/promises";
import { format } from "fast-csv";
import { createGzip } from "node:zlib";
import { S3Client } from "@aws-sdk/client-s3";
import { PassThrough, Readable } from "node:stream";
import { Upload } from "@aws-sdk/lib-storage";
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

async function uploadToS3() {
  try {
    const data = [
      {
        flavor: "vanilla",
        topping: "sprinkles",
      },
      {
        flavor: "chocolate",
        topping: "fudge",
      },
      {
        flavor: "strawberry",
        topping: "whipped cream",
      },
    ];

    await sftp.connect(config);
    console.log("SFTP connected successfully");

    // We use a PassThrough to support uploading
    // via the pipeline API.
    const uploadToS3PassThrough = new PassThrough();
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: "output.csv.gz",
        Body: uploadToS3PassThrough,
      },
    });

    // PassThroughs for Demux
    const s3UploadPassThrough = new PassThrough({
      objectMode: true,
    });

    const sftpUploadPassThrough = new PassThrough({
      objectMode: true,
    });
    const demux = new Demultiplexer([
      s3UploadPassThrough,
      sftpUploadPassThrough,
    ]);

    await Promise.all([
      pipeline(
        Readable.from(data),
        format({ quoteColumns: true, headers: ["flavor", "topping"] }),
        createGzip(),
        demux
      ),
      pipeline(s3UploadPassThrough, uploadToS3PassThrough),
      pipeline(
        sftpUploadPassThrough,
        sftp.createWriteStream(`/${BUCKET_NAME}/sftp-upload.csv.gz`)
      ),
    ]);

    await sftp.end();
    await upload.done();

    console.log("File processed and uploaded successfully");
  } catch (error) {
    console.error("Error:", error);
  }
}

async function main() {
  await uploadToS3();
}

main();
