import LocalStorage from "./LocalStorage.js";
import MinIOStorage from "./MinIOStorage.js";
import S3Storage from "./S3Storage.js";
import R2Storage from "./R2Storage.js";

class StorageFactory {
  static create() {
    switch (process.env.STORAGE_TYPE) {
      case "local":
        return new LocalStorage(process.env.STORAGE_BASE_PATH);

      case "minio":
        return new MinIOStorage({
          endpoint: process.env.MINIO_ENDPOINT,
          accessKey: process.env.MINIO_ACCESS_KEY,
          secretKey: process.env.MINIO_SECRET_KEY,
          bucket: process.env.MINIO_BUCKET,
        });

      case "s3":
        return new S3Storage({
          region: process.env.AWS_REGION,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          bucket: process.env.AWS_S3_BUCKET,
        });

      case "r2":
        return new R2Storage({
          endpoint: process.env.R2_ENDPOINT,
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
          bucket: process.env.R2_BUCKET,
        });

      default:
        throw new Error(
          `Unsupported storage type: ${process.env.STORAGE_TYPE}`,
        );
    }
  }
}

export default StorageFactory;
