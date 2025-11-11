import fs from 'fs/promises'
import path from 'path'

/**
 * Storage adapter for file uploads
 * Can be swapped for S3 or other cloud storage
 */

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

export interface StorageAdapter {
  save(file: Buffer, filename: string): Promise<string>
  delete(filepath: string): Promise<void>
  getUrl(filepath: string): string
}

class LocalStorageAdapter implements StorageAdapter {
  async save(file: Buffer, filename: string): Promise<string> {
    await ensureUploadDir()
    const filepath = path.join(UPLOAD_DIR, filename)
    await fs.writeFile(filepath, file)
    return `/uploads/${filename}`
  }

  async delete(filepath: string): Promise<void> {
    if (filepath.startsWith('/uploads/')) {
      const fullPath = path.join(process.cwd(), 'public', filepath)
      try {
        await fs.unlink(fullPath)
      } catch (error) {
        // File might not exist, ignore
      }
    }
  }

  getUrl(filepath: string): string {
    return filepath
  }
}

// Export singleton instance
export const storage: StorageAdapter = new LocalStorageAdapter()

// For future S3 implementation:
// export const storage: StorageAdapter = new S3StorageAdapter()

