const { BlobServiceClient } = require("@azure/storage-blob");

const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = "mp3";

// Check if the connection string is available
if (!AZURE_CONNECTION_STRING) {
    throw new Error("Azure connection string is missing.");
}

async function uploadToAzureBlobFromServer(fileBuffer, fileName) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    
    // Create the container if it doesn't exist
    await containerClient.createIfNotExists({ access: "blob" });

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    
    // Upload the file
    await blockBlobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: {
            blobContentType: "audio/mp3", // Adjust based on the actual file type
        }
    });

    // Return the URL of the uploaded file
    return `https://${blobServiceClient.accountName}.blob.core.windows.net/${CONTAINER_NAME}/${fileName}`;
}

module.exports = { uploadToAzureBlobFromServer };