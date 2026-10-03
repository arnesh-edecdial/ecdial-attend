import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getR2Config() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const region = process.env.R2_REGION || 'auto';

    if (!accountId) {
        throw new Error('R2_ACCOUNT_ID is not configured.');
    }

    if (!accessKeyId) {
        throw new Error('R2_ACCESS_KEY_ID is not configured.');
    }

    if (!secretAccessKey) {
        throw new Error('R2_SECRET_ACCESS_KEY is not configured.');
    }

    if (!bucketName) {
        throw new Error('R2_BUCKET_NAME is not configured.');
    }

    return {
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        region,
    };
}

function getR2Client() {
    const config = getR2Config();

    return new S3Client({
        region: config.region,
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });
}

export const r2Service = {
    async createUploadUrl(
        key: string,
        contentType: string,
        expiresIn = 900,
    ) {
        const config = getR2Config();
        const client = getR2Client();

        const command = new PutObjectCommand({
            Bucket: config.bucketName,
            Key: key,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(client, command, {
            expiresIn,
        });

        return {
            uploadUrl,
            key,
            expiresIn,
        };
    },

    async createDownloadUrl(
        key: string,
        expiresIn = 3600,
    ) {
        const config = getR2Config();
        const client = getR2Client();

        const command = new GetObjectCommand({
            Bucket: config.bucketName,
            Key: key,
        });

        return getSignedUrl(client, command, {
            expiresIn,
        });
    },

    async objectExists(key: string) {
        const config = getR2Config();
        const client = getR2Client();

        try {
            await client.send(
                new HeadObjectCommand({
                    Bucket: config.bucketName,
                    Key: key,
                }),
            );

            return true;
        } catch {
            return false;
        }
    },

    async getObjectMetadata(key: string) {
        const config = getR2Config();
        const client = getR2Client();

        try {
            const result = await client.send(
                new HeadObjectCommand({
                    Bucket: config.bucketName,
                    Key: key,
                }),
            );

            return {
                exists: true,
                contentLength: result.ContentLength ?? 0,
                contentType: result.ContentType ?? null,
                etag: result.ETag ?? null,
            };
        } catch {
            return {
                exists: false,
                contentLength: 0,
                contentType: null,
                etag: null,
            };
        }
    },

    async deleteObject(key: string) {
        const config = getR2Config();
        const client = getR2Client();

        await client.send(
            new DeleteObjectCommand({
                Bucket: config.bucketName,
                Key: key,
            }),
        );
    },

    getBucketName() {
        return getR2Config().bucketName;
    },
};