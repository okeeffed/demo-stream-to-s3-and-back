import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as transfer from "aws-cdk-lib/aws-transfer";
import * as iam from "aws-cdk-lib/aws-iam";
import { readFileSync } from "fs";
import * as path from "path";

const SFTP_PUBLIC_KEY = readFileSync(path.join(__dirname, "../sftp_key.pub"));

export class DemoStreamToS3AndBackStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "StreamToS3AndBackBucket", {
      bucketName: "stream-to-s3-and-back",
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create an IAM role for SFTP users
    const sftpUserRole = new iam.Role(this, "SftpUserRole", {
      assumedBy: new iam.ServicePrincipal("transfer.amazonaws.com"),
    });

    // Grant read/write permissions to the S3 bucket
    bucket.grantReadWrite(sftpUserRole);

    // Create the SFTP server
    const server = new transfer.CfnServer(this, "SftpServer", {
      protocols: ["SFTP"],
      identityProviderType: "SERVICE_MANAGED",
      loggingRole: sftpUserRole.roleArn,
    });

    // Create an SFTP user
    const user = new transfer.CfnUser(this, "SftpUser", {
      userName: "testuser",
      serverId: server.attrServerId,
      role: sftpUserRole.roleArn,
      homeDirectory: `/${bucket.bucketName}`,
      sshPublicKeys: [SFTP_PUBLIC_KEY.toString()],
    });

    // Output the SFTP server endpoint
    new cdk.CfnOutput(this, "SftpEndpoint", {
      value: `${server.attrServerId}.server.transfer.${this.region}.amazonaws.com`,
      description: "SFTP Server Endpoint",
    });
  }
}
