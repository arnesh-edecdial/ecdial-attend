import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
} from '@aws-sdk/client-s3';

import {
    B2_BUCKET_NAME,
    storageClient,
} from '../config/storage';

export interface UploadImageInput {
    buffer: Buffer;
    contentType: string;
    key: string;
}

export async function uploadImage({
    buffer,
    contentType,
    key,
}: UploadImageInput): Promise<string> {
    await storageClient.send(
        new PutObjectCommand({
            Bucket: B2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        }),
    );

    return key;
}

export async function deleteImage(key: string): Promise<void> {
    await storageClient.send(
        new DeleteObjectCommand({
            Bucket: B2_BUCKET_NAME,
            Key: key,
        }),
    );
}

export async function getImageObject(key: string) {
    return storageClient.send(
        new GetObjectCommand({
            Bucket: B2_BUCKET_NAME,
            Key: key,
        }),
    );
}