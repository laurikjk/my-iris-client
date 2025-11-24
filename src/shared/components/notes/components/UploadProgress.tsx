import {type UploadState} from "@/shared/components/button/UploadButton"

interface UploadProgressProps {
  uploadState: UploadState
  onDismissError: () => void
  onDismissFailedFiles: () => void
}

export function UploadProgress({
  uploadState,
  onDismissError,
  onDismissFailedFiles,
}: UploadProgressProps) {
  if (
    !uploadState.uploading &&
    !uploadState.errorMessage &&
    uploadState.failedFiles.length === 0
  ) {
    return null
  }

  return (
    <div className="mt-3 bg-base-200 rounded-lg p-3">
      {uploadState.uploading && (
        <div className="w-full">
          {uploadState.currentFile && (
            <p className="text-sm mb-2 truncate">
              {uploadState.totalFiles > 1
                ? `[${uploadState.currentFileIndex}/${uploadState.totalFiles}] `
                : ""}
              {uploadState.currentFile}
            </p>
          )}
          <div className="bg-neutral rounded-full h-2.5 w-full">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-300"
              style={{width: `${uploadState.progress}%`}}
            ></div>
          </div>
          <p className="text-sm text-center mt-2 font-medium">
            {Math.round(uploadState.progress)}%
          </p>
        </div>
      )}
      {!uploadState.uploading && uploadState.errorMessage && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-error">{uploadState.errorMessage}</p>
          <button onClick={onDismissError} className="btn btn-xs btn-ghost">
            Dismiss
          </button>
        </div>
      )}
      {!uploadState.uploading &&
        uploadState.failedFiles.length > 0 &&
        !uploadState.errorMessage && (
          <div>
            <p className="text-sm font-semibold text-error mb-2">Failed uploads:</p>
            <div className="max-h-32 overflow-y-auto">
              {uploadState.failedFiles.map((file, index) => (
                <p key={index} className="text-sm text-error truncate">
                  {file.name}: {file.error}
                </p>
              ))}
            </div>
            <button onClick={onDismissFailedFiles} className="btn btn-xs btn-ghost mt-2">
              Dismiss
            </button>
          </div>
        )}
    </div>
  )
}
