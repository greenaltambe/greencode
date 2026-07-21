import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

import StorageFactory from "../storage/StorageFactory.js";

const storage = StorageFactory.create();

console.log("Storage implementation:", storage.constructor.name);

export default storage;
