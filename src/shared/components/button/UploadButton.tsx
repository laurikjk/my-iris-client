import {useRef, useState, ReactNode, ChangeEvent, MouseEvent, useEffect} from "react"

import type {EncryptionMeta} from "@/types/global"
import {RiLock2Line} from "@remixicon/react"
import {processFile} from "@/shared/upload"

export type UploadState = {
  uploading: boolean
  progress: number
  currentFile: string | null
  errorMessage: string | null
  failedFiles: Array<{name: string; error: string}>
  totalFiles: number
  currentFileIndex: number
}

type Props = {
  onUpload: (
    url: string,
    metadata?: {width: number; height: number; blurhash: string},
    encryptionMeta?: EncryptionMeta,
    imetaTag?: string[]
  ) => void
  onError?: (error: Error) => void
  text?: ReactNode
  className?: string
  disabled?: boolean
  accept?: string
  multiple?: boolean
  encrypt?: boolean
  onStateChange?: (state: UploadState) => void
}

const UploadButton = ({
  onUpload,
  onError,
  text,
  className,
  disabled = false,
  accept,
  multiple = false,
  encrypt = false,
  onStateChange,
}: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [failedFiles, setFailedFiles] = useState<Array<{name: string; error: string}>>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        uploading,
        progress,
        currentFile,
        errorMessage,
        failedFiles,
        totalFiles,
        currentFileIndex,
      })
    }
  }, [
    uploading,
    progress,
    currentFile,
    errorMessage,
    failedFiles,
    totalFiles,
    currentFileIndex,
    onStateChange,
  ])

  // Auto-clear errors after 10 seconds
  useEffect(() => {
    if (!uploading && (errorMessage || failedFiles.length > 0)) {
      const timer = setTimeout(() => {
        setErrorMessage(null)
        setFailedFiles([])
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [uploading, errorMessage, failedFiles])

  const handleFileProcess = async (file: File): Promise<string | null> => {
    try {
      setCurrentFile(file.name)
      setProgress(0)
      setErrorMessage(null)

      const {url, metadata, encryptionMeta, imetaTag} = await processFile(
        file,
        (progress: number) => {
          setProgress(progress)
        },
        encrypt
      )

      onUpload(url, metadata, encryptionMeta, imetaTag)
      return url
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setErrorMessage(errorMessage)
      setFailedFiles((prev) => [...prev, {name: file.name, error: errorMessage}])
      setProgress(0) // Reset progress on error
      setCurrentFile(null) // Clear current file on error
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)))
      }
      return null
    }
  }

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
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
        await handleFileProcess(files[i])
      }
    } finally {
      setUploading(false)
      setProgress(0)
      setCurrentFile(null)
      setCurrentFileIndex(0)
      setTotalFiles(0)
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      // Clear error message if no failed files
      if (failedFiles.length === 0) {
        setErrorMessage(null)
      }
    }
  }

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    fileInputRef.current?.click()
  }

  return (
    <>
      <button
        type="button"
        role="button"
        className={className || "btn btn-neutral"}
        onClick={handleClick}
        disabled={disabled || uploading}
        style={{position: "relative"}}
      >
        {text || "Upload"}
        {encrypt && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              pointerEvents: "none",
              padding: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RiLock2Line size={14} />
          </span>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        style={{display: "none"}}
      />
    </>
  )
}

export default UploadButton
