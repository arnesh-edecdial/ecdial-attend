import dotenv from 'dotenv';

dotenv.config();

import { r2Service } from '../services/r2.service';

async function main() {
    console.log('Testing Cloudflare R2...');

    const testKey = `test/r2-test-${Date.now()}.txt`;

    console.log('\n1. Generating upload URL...');

    const upload = await r2Service.createUploadUrl(
        testKey,
        'text/plain',
        900,
    );

    console.log('Upload URL generated successfully.');
    console.log('Key:', upload.key);
    console.log('Expires in:', upload.expiresIn, 'seconds');

    console.log('\n2. Upload URL:');
    console.log(upload.uploadUrl);

    console.log('\n3. R2 connection test completed.');
    console.log(
        'Use the generated PUT URL to upload a test object if required.',
    );
}

main().catch((error) => {
    console.error('\nR2 TEST FAILED');
    console.error(error);
    process.exit(1);
});