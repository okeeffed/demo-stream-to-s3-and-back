import { createWriteStream } from "fs";
import { pipeline } from "node:stream/promises";
import { format } from "fast-csv";
import { createGzip } from "node:zlib";
import { S3Client } from "@aws-sdk/client-s3";
import { PassThrough, Readable } from "node:stream";
import { Upload } from "@aws-sdk/lib-storage";

const s3Client = new S3Client();

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
    const uploadToS3PassThrough = new PassThrough();

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: "stream-to-s3-and-back",
        Key: "output.csv.gz",
        Body: uploadToS3PassThrough,
      },
    });

    await pipeline(
      Readable.from(data),
      format({ quoteColumns: true, headers: ["flavor", "topping"] }),
      createGzip(),
      uploadToS3PassThrough
    );

    // Close the PassThrough stream to signal the end of data
    uploadToS3PassThrough.end();

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
