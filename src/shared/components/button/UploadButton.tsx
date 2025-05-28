import React, {useRef, useState, ReactNode} from "react"

import {
  calculateImageMetadata,
  calculateVideoMetadata,
} from "@/shared/components/embed/media/mediaUtils"
import {uploadFile} from "@/shared/upload"

type Props = {
  onUpload: (
    url: string,
    metadata?: {width: number; height: number; blurhash: string}
  ) => void
  onError?: (error: Error) => void
  text?: ReactNode
  className?: string
  disabled?: boolean
  accept?: string
  multiple?: boolean
}

const hasExifData = async (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const view = new DataView(e.target?.result as ArrayBuffer)
      // Check for JPEG signature
      if (view.getUint16(0, false) === 0xffd8) {
        console.log(`[EXIF] Checking JPEG file: ${file.name}`)
        const length = view.byteLength
        let offset = 2
        while (offset < length) {
          if (view.getUint16(offset, false) === 0xffe1) {
            console.log(`[EXIF] Found EXIF data in JPEG file: ${file.name}`)
            resolve(true)
            return
          }
          offset += 2 + view.getUint16(offset + 2, false)
        }
        console.log(`[EXIF] No EXIF data found in JPEG file: ${file.name}`)
      } else {
        console.log(`[EXIF] Not a JPEG file: ${file.name}`)
      }
      resolve(false)
    }
    reader.readAsArrayBuffer(file)
  })
}

const stripExifData = async (file: File): Promise<File> => {
  // Only process JPEG files
  if (file.type !== "image/jpeg") {
    console.log(`[EXIF] Not a JPEG file: ${file.name}`)
    return file
  }

  // Check if the file has EXIF data
  const hasExif = await hasExifData(file)
  if (!hasExif) {
    console.log(`[EXIF] No EXIF data to remove from: ${file.name}`)
    return file
  }

  console.log(`[EXIF] Removing EXIF data from: ${file.name}`)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        console.log(`[EXIF] Failed to create canvas context for: ${file.name}`)
        resolve(file)
        return
      }

      // Draw image without EXIF data
      ctx.drawImage(img, 0, 0)

      // Convert back to file
      canvas.toBlob((blob) => {
        if (blob) {
          const newFile = new File([blob], file.name, {
            type: file.type,
            lastModified: file.lastModified,
          })
          console.log(`[EXIF] Successfully removed EXIF data from: ${file.name}`)
          resolve(newFile)
        } else {
          console.log(`[EXIF] Failed to create blob from canvas for: ${file.name}`)
          resolve(file)
        }
      }, file.type)
    }
    img.onerror = () => {
      console.log(`[EXIF] Failed to load image: ${file.name}`)
      resolve(file)
    }
    img.src = URL.createObjectURL(file)
  })
}

const UploadButton = ({
  onUpload,
  onError,
  text,
  className,
  disabled = false,
  accept,
  multiple = false,
}: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [failedFiles, setFailedFiles] = useState<Array<{name: string; error: string}>>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)

  const processFile = async (file: File) => {
    try {
      setCurrentFile(file.name)
      setProgress(0)
      setErrorMessage(null)

      // Strip EXIF data if it's a JPEG
      if (file.type === "image/jpeg") {
        file = await stripExifData(file)
      }

      // Calculate metadata based on file type
      let metadata
      if (file.type.startsWith("image/")) {
        metadata = await calculateImageMetadata(file)
      } else if (file.type.startsWith("video/")) {
        metadata = await calculateVideoMetadata(file)
      }

      const url = await uploadFile(file, (progress) => {
        setProgress(progress)
      })

      onUpload(url, metadata || undefined)
      return url
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setErrorMessage(errorMessage)
      setFailedFiles((prev) => [...prev, {name: file.name, error: errorMessage}])
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)))
      }
      return null
    }
  }

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return
    }

    try {
      setUploading(true)
      setFailedFiles([])
      const files = Array.from(e.target.files)
      setTotalFiles(files.length)
      setCurrentFileIndex(0)

      for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i + 1)
        await processFile(files[i])
      }
    } finally {
      setUploading(false)
      setProgress(0)
      setCurrentFile(null)
      setCurrentFileIndex(0)
      setTotalFiles(0)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    fileInputRef.current?.click()
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        role="button"
        className={className || "btn btn-neutral"}
        onClick={handleClick}
        disabled={disabled || uploading}
      >
        {uploading ? "Uploading..." : text || "Upload"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        style={{display: "none"}}
      />
      {uploading && (
        <div className="w-full mt-2">
          {currentFile && (
            <p className="text-sm text-center mb-1">
              [{currentFileIndex}/{totalFiles}] {currentFile}
            </p>
          )}
          <div className="bg-neutral rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full"
              style={{width: `${progress}%`}}
            ></div>
          </div>
          <p className="text-sm text-center mt-1">{Math.round(progress)}%</p>
        </div>
      )}
      {errorMessage && <p className="text-sm text-error mt-2">{errorMessage}</p>}
      {failedFiles.length > 0 && (
        <div className="w-full mt-2">
          <p className="text-sm font-semibold text-error mb-1">Failed uploads:</p>
          <div className="max-h-32 overflow-y-auto">
            {failedFiles.map((file, index) => (
              <p key={index} className="text-sm text-error">
                {file.name}: {file.error}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default UploadButton
