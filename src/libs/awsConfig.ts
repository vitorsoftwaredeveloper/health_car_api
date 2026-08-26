export interface AwsClientConfig {
  region?: string;
  endpoint?: string;
}

export interface AwsS3ClientConfig extends AwsClientConfig {
  forcePathStyle?: boolean;
  requestChecksumCalculation?: "WHEN_SUPPORTED" | "WHEN_REQUIRED";
}

const localEndpoint = (): string | undefined =>
  process.env.AWS_ENDPOINT_URL || undefined;

export const isLocalAws = (): boolean => !!localEndpoint();

export const awsClientConfig = (): AwsClientConfig => {
  const endpoint = localEndpoint();

  return {
    region: process.env.REGION,
    ...(endpoint ? { endpoint } : {}),
  };
};

export const s3ClientConfig = (): AwsS3ClientConfig => ({
  ...awsClientConfig(),
  requestChecksumCalculation: "WHEN_REQUIRED",
  ...(isLocalAws() ? { forcePathStyle: true } : {}),
});
