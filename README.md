# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template

## Process

1. `npx cdk init app --language typescript`
2. `npm i @aws-sdk/client-s3 @aws-sdk/lib-storage fast-csv  ssh2-sftp-client yaml`
3. `npm i --save-dev tsx`
4. `mkdir src`
5. `touch src/upload.ts src/download.ts src/demultiplex.ts`

### Creating a SSH key

Create a SSH asymmetric key pairing with the following:

```s
ssh-keygen -t rsa -b 2048 -f sftp_key
```

You will output `sftp_key` for your private key and `sftp_key.pub` for your public key.
